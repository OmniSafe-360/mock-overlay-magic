-- A4, ajustes do Codex no PR #191:
--  1) produto que veio fora do pedido e espera o dono também impede abrir outra entrega (não conta em dobro);
--  2) o cartão da equipe conta só os produtos que ainda faltam (igual à tela de contagem).
do $$
begin
  if md5(pg_get_functiondef('public._pedido_recebe_resto(uuid)'::regprocedure)) <> '5f194c869f17e698eeab1430d88f4dbe'
     or md5(pg_get_functiondef('public.funcionario_entregas(text)'::regprocedure)) <> '91b31394cc3987c7c72a8e7cee42569b' then
    raise exception 'versao_inesperada: funções da entrega parcial mudaram desde a conferência';
  end if;
end $$;

create or replace function public._pedido_recebe_resto(_pedido uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select pc.situacao = 'recebido_parcial' and pc.entrega_encerrada_em is null
      and not exists (select 1 from recebimento_itens ri join recebimentos r on r.id = ri.recebimento_id
                       where r.pedido_id = pc.id and ri.situacao in ('inconsistente', 'fora_do_pedido'))
      and exists (select 1 from (select distinct produto_id, variacao_id from pedido_itens where pedido_id = pc.id) g
                   where public._pedido_resto(pc.id, g.produto_id, g.variacao_id) > 0)
    from pedidos_compra pc where pc.id = _pedido), false)
$$;

do $$
declare
  v_en text := pg_get_functiondef('public.funcionario_entregas(text)'::regprocedure);
  a text := $a$from pedido_itens i where i.pedido_id = pc.id)$a$;
  b text := $b$from pedido_itens i where i.pedido_id = pc.id
          and public._pedido_grupo_conta(pc.id, i.produto_id, i.variacao_id))$b$;
begin
  if (length(v_en) - length(replace(v_en, a, ''))) / length(a) <> 1 then
    raise exception 'versao_inesperada: trecho do cartão não encontrado uma única vez';
  end if;
  execute replace(v_en, a, b);
end $$;
