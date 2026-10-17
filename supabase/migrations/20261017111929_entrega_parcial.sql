-- A4 (checklist funcional 3): entrega em duas vezes. Decisão do dono (17/10/2026): "Pedido espera o resto".
-- Antes, a primeira entrega concluída fechava o pedido como "recebido", mesmo faltando produto, e a segunda parte
-- não podia mais ser recebida nele ("pedido_ja_recebido"; o pedido também saía da lista da equipe).
-- Agora:
--  * faltou produto (chegou menos que o confirmado) → o pedido fica "recebido_parcial" e volta para a lista da equipe;
--  * a próxima entrega é conferida só com os produtos que ainda faltam (o esperado já era o que faltava);
--  * enquanto há produto separado para o dono decidir, a equipe não abre outra entrega (evita contar em dobro);
--  * o dono encerra com "Não vem mais nada" (encerrar_entrega_pedido), e o pedido vira "recebido".
-- Pedidos que já tinham entrega concluída antes desta mudança ficam como estavam (marcados como encerrados).
-- Sem tabela nova; uma coluna nova em pedidos_compra. Estoque e operações não mudam.

do $$
begin
  if md5(pg_get_functiondef('public._fechar_pedido_recebido(uuid)'::regprocedure)) <> '57593da532590632177facdf2b35a322'
     or md5(pg_get_functiondef('public.funcionario_abrir_recebimento(text,uuid,uuid,uuid)'::regprocedure)) <> '5e03be2a5384de8d86fe3098cc3bfebe'
     or md5(pg_get_functiondef('public.funcionario_entregas(text)'::regprocedure)) <> '3a48f566b2f54422f1573a68c62f2c39'
     or md5(pg_get_functiondef('public.funcionario_enviar_recebimento(text,uuid,integer,jsonb)'::regprocedure)) <> '232423c52383ebd24efa558771e2779a'
     or md5(pg_get_functiondef('public.funcionario_inicio(text)'::regprocedure)) <> '5cd558937dc15f74316dff474106899d' then
    raise exception 'versao_inesperada: funções do recebimento mudaram desde a conferência';
  end if;
end $$;

alter table public.pedidos_compra add column entrega_encerrada_em timestamptz;
comment on column public.pedidos_compra.entrega_encerrada_em is 'Dono disse que não vem mais nada (ou pedido recebido antes da entrega em partes).';
update public.pedidos_compra pc set entrega_encerrada_em = now()
 where exists (select 1 from public.recebimentos r where r.pedido_id = pc.id and r.situacao = 'concluido');

/* Quanto ainda falta chegar de um produto do pedido (unidades de venda): confirmado (ou pedido) − recebido. */
create function public._pedido_resto(_pedido uuid, _prod uuid, _var uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(0, coalesce(sum(coalesce(qtd_confirmada * qtd_unidades / qtd_embalagens, qtd_unidades)), 0)
                     - coalesce(sum(coalesce(qtd_recebida, 0)), 0))
    from pedido_itens where pedido_id = _pedido and produto_id = _prod and variacao_id is not distinct from _var
$$;

/* O produto entra na conferência desta entrega: na primeira entrega, todos; nas seguintes, só os que faltam. */
create function public._pedido_grupo_conta(_pedido uuid, _prod uuid, _var uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select not exists (select 1 from recebimentos where pedido_id = _pedido and situacao = 'concluido')
      or public._pedido_resto(_pedido, _prod, _var) > 0
$$;

/* A equipe pode receber outra parte: recebido em parte, não encerrado, sem produto para o dono decidir, faltando algo. */
create function public._pedido_recebe_resto(_pedido uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select pc.situacao = 'recebido_parcial' and pc.entrega_encerrada_em is null
      and not exists (select 1 from recebimento_itens ri join recebimentos r on r.id = ri.recebimento_id
                       where r.pedido_id = pc.id and ri.situacao = 'inconsistente')
      and exists (select 1 from (select distinct produto_id, variacao_id from pedido_itens where pedido_id = pc.id) g
                   where public._pedido_resto(pc.id, g.produto_id, g.variacao_id) > 0)
    from pedidos_compra pc where pc.id = _pedido), false)
$$;

revoke all on function public._pedido_resto(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public._pedido_grupo_conta(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public._pedido_recebe_resto(uuid) from public, anon, authenticated;
grant execute on function public._pedido_resto(uuid,uuid,uuid) to service_role;
grant execute on function public._pedido_grupo_conta(uuid,uuid,uuid) to service_role;
grant execute on function public._pedido_recebe_resto(uuid) to service_role;

/* Reparte o que chegou entre os itens do pedido (como antes) e decide a situação: espera o resto se faltou algo. */
create or replace function public._fechar_pedido_recebido(_pedido uuid)
 returns void language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare x record; v_rest numeric; it record; v_por_item numeric;
begin
  if _pedido is null then return; end if;
  -- Reparte o que chegou entre os itens do pedido do mesmo produto, na ordem do pedido.
  for x in select ri.produto_id, ri.variacao_id, sum(coalesce(ri.quantidade_aceita, 0)) q
             from recebimento_itens ri join recebimentos r on r.id = ri.recebimento_id
            where r.pedido_id = _pedido and ri.no_pedido and ri.situacao = 'aceito'
            group by ri.produto_id, ri.variacao_id loop
    v_rest := x.q;
    for it in select id, coalesce(qtd_confirmada * qtd_unidades / qtd_embalagens, qtd_unidades) esperado,
                     row_number() over (order by created_at desc) = 1 ultimo
                from pedido_itens where pedido_id = _pedido and produto_id = x.produto_id and variacao_id is not distinct from x.variacao_id
               order by created_at loop
      v_por_item := case when it.ultimo then v_rest else least(v_rest, it.esperado) end;
      update pedido_itens set qtd_recebida = v_por_item where id = it.id;
      v_rest := v_rest - v_por_item;
    end loop;
  end loop;
  update pedidos_compra pc set situacao = case
      when exists (select 1 from recebimento_itens ri join recebimentos r on r.id = ri.recebimento_id
                    where r.pedido_id = _pedido and ri.situacao = 'inconsistente') then 'recebido_parcial'
      -- A4: faltou produto e o dono ainda não disse que não vem mais nada → espera o resto.
      when pc.entrega_encerrada_em is null and exists (
             select 1 from (select distinct produto_id, variacao_id from pedido_itens where pedido_id = _pedido) g
              where public._pedido_resto(_pedido, g.produto_id, g.variacao_id) > 0) then 'recebido_parcial'
      else 'recebido' end
   where id = _pedido and situacao <> 'cancelado';
end $function$;

/* Trechos conferidos: cada um tem de aparecer uma única vez na versão conferida acima. */
do $$
declare
  v_ab text := pg_get_functiondef('public.funcionario_abrir_recebimento(text,uuid,uuid,uuid)'::regprocedure);
  v_en text := pg_get_functiondef('public.funcionario_entregas(text)'::regprocedure);
  v_ev text := pg_get_functiondef('public.funcionario_enviar_recebimento(text,uuid,integer,jsonb)'::regprocedure);
  v_in text := pg_get_functiondef('public.funcionario_inicio(text)'::regprocedure);
  a_ab1 text := $a$situacao = 'concluido') then
      raise exception 'pedido_ja_recebido'$a$;
  b_ab1 text := $b$situacao = 'concluido')
       and not public._pedido_recebe_resto(_pedido) then
      raise exception 'pedido_ja_recebido'$b$;
  a_ab2 text := $a$from pedido_itens where pedido_id = r.pedido_id group by produto_id, variacao_id) x)$a$;
  b_ab2 text := $b$from pedido_itens where pedido_id = r.pedido_id group by produto_id, variacao_id
              having public._pedido_grupo_conta(r.pedido_id, produto_id, variacao_id)) x)$b$;
  a_lista text := $a$not exists (select 1 from recebimentos r where r.pedido_id = pc.id and r.situacao = 'concluido')$a$;
  b_lista text := $b$(not exists (select 1 from recebimentos r where r.pedido_id = pc.id and r.situacao = 'concluido')
             or public._pedido_recebe_resto(pc.id))$b$;
  a_ev text := $a$where pi.pedido_id = r.pedido_id
             and not exists$a$;
  b_ev text := $b$where pi.pedido_id = r.pedido_id
             and public._pedido_grupo_conta(r.pedido_id, pi.produto_id, pi.variacao_id)
             and not exists$b$;
  function_um constant text := 'trecho não encontrado uma única vez';
begin
  if (length(v_ab) - length(replace(v_ab, a_ab1, ''))) / length(a_ab1) <> 1
     or (length(v_ab) - length(replace(v_ab, a_ab2, ''))) / length(a_ab2) <> 1
     or (length(v_en) - length(replace(v_en, a_lista, ''))) / length(a_lista) <> 1
     or (length(v_in) - length(replace(v_in, a_lista, ''))) / length(a_lista) <> 1
     or (length(v_ev) - length(replace(v_ev, a_ev, ''))) / length(a_ev) <> 1 then
    raise exception 'versao_inesperada: %', function_um;
  end if;
  execute replace(replace(v_ab, a_ab1, b_ab1), a_ab2, b_ab2);
  execute replace(v_en, a_lista, b_lista);
  execute replace(v_in, a_lista, b_lista);
  execute replace(v_ev, a_ev, b_ev);
end $$;

/* Dono: "Não vem mais nada". O que faltou fica como faltou; o pedido sai da lista da equipe. */
create function public.encerrar_entrega_pedido(_pedido uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare pc pedidos_compra%rowtype;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into pc from pedidos_compra where id = _pedido for update;
  if not found or not public.pode_acessar_comercio(pc.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  if pc.situacao <> 'recebido_parcial' or pc.entrega_encerrada_em is not null then
    raise exception 'pedido_nao_espera_entrega' using errcode = '23514'; end if;
  if exists (select 1 from recebimentos where pedido_id = _pedido and situacao = 'contando') then
    raise exception 'recebimento_em_contagem' using errcode = '23514'; end if;
  update pedidos_compra set entrega_encerrada_em = now() where id = _pedido;
  perform public._fechar_pedido_recebido(_pedido);
end $$;
revoke all on function public.encerrar_entrega_pedido(uuid) from public, anon;
grant execute on function public.encerrar_entrega_pedido(uuid) to authenticated, service_role;
