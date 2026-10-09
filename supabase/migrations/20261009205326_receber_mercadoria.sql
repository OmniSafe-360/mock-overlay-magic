-- Etapa E2: receber mercadoria pelo app do funcionário (desenho aprovado pelo dono em 09/10/2026).
-- Conferência cega: o funcionário nunca vê quanto foi pedido. O servidor compara; se não bater, pede recontagem
-- (até 3 vezes; vale quando duas contagens dão o mesmo número; senão vira inconsistência para o dono decidir).
-- O estoque sobe no depósito numa única transação, com uma operação permanente por produto (regra da base consolidada).

-- Quem fez a operação quando foi um funcionário (user_id/criado_por continuam sendo o dono do comércio).
alter table public.operacoes add column if not exists funcionario_id uuid references public.funcionarios(id);
alter table public.movimentos add column if not exists funcionario_id uuid references public.funcionarios(id);

create table public.recebimentos (
  id uuid primary key,                                   -- gerado no celular: repetir não duplica
  comercio_id uuid not null references public.comercios(id),
  pedido_id uuid references public.pedidos_compra(id),   -- null = chegou sem pedido
  fornecedor_id uuid references public.fornecedores(id),
  funcionario_id uuid not null references public.funcionarios(id),
  situacao text not null default 'contando' check (situacao in ('contando', 'concluido')),
  rodada int not null default 0,                          -- quantas vezes o funcionário tocou em "Terminei"
  ultimo_resultado jsonb,                                 -- resposta da última rodada (reenvio devolve a mesma)
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  updated_at timestamptz not null default now()
);
create index recebimentos_comercio_idx on public.recebimentos (comercio_id, iniciado_em desc);
create index recebimentos_pedido_idx on public.recebimentos (pedido_id);

create table public.recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  recebimento_id uuid not null references public.recebimentos(id),
  comercio_id uuid not null references public.comercios(id),
  produto_id uuid not null,
  variacao_id uuid,
  no_pedido boolean not null,
  esperado numeric(14,3),            -- unidades de venda esperadas (só o dono vê); null = sem pedido para comparar
  tentativas jsonb not null default '[]',   -- cada contagem: {total, avaria, partes:[{quantidade, vencimento, lote}], em}
  situacao text not null check (situacao in ('recontar', 'aceito', 'inconsistente', 'fora_do_pedido', 'recusado')),
  quantidade_aceita numeric(14,3),   -- o que chegou (bons + avariados), em unidades de venda
  avaria numeric(14,3) not null default 0,
  entrou_estoque numeric(14,3) not null default 0,
  resolvido_por uuid,
  resolvido_em timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id),
  unique nulls not distinct (recebimento_id, produto_id, variacao_id)
);
create index recebimento_itens_rec_idx on public.recebimento_itens (recebimento_id);
create index recebimento_itens_comercio_idx on public.recebimento_itens (comercio_id, situacao);

create trigger recebimentos_set_updated_at before update on public.recebimentos for each row execute function public.set_updated_at();
create trigger recebimento_itens_set_updated_at before update on public.recebimento_itens for each row execute function public.set_updated_at();

alter table public.recebimentos enable row level security;
alter table public.recebimento_itens enable row level security;
create policy "dono ve recebimentos do seu comercio" on public.recebimentos for select to authenticated
  using (public.pode_acessar_comercio(comercio_id));
create policy "dono ve itens recebidos do seu comercio" on public.recebimento_itens for select to authenticated
  using (public.pode_acessar_comercio(comercio_id));
-- Ninguém grava direto (só as funções); o dono só lê.
revoke all on public.recebimentos, public.recebimento_itens from anon, authenticated;
grant select on public.recebimentos, public.recebimento_itens to authenticated;

/* Funcionário que pode receber (chave do celular válida e função receber/ambos). */
create or replace function public._funcionario_recebe(_chave text) returns public.funcionarios
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_da_chave(_chave);
  if v.funcao not in ('receber', 'ambos') then raise exception 'funcao_nao_permite_receber' using errcode = '42501'; end if;
  return v;
end $$;

/* Produto como o funcionário vê: nome, unidade, embalagens e se pede validade/lote. Nunca quantidades nem preços. */
create or replace function public._produto_para_funcionario(_prod uuid, _var uuid, _emb uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'produto_id', p.id, 'variacao_id', _var, 'embalagem_id', _emb, 'nome', p.nome, 'unidade', p.unidade,
    'codigo', coalesce((select codigo_barras from produto_variacoes where id = _var), p.codigo_barras),
    'variacao', (select tamanho || ' · ' || cor from produto_variacoes where id = _var),
    'controla_validade', coalesce(p.controla_validade, false),
    'pede_lote', c.tipo = 'farmacia' and coalesce(p.controla_validade, false),
    'embalagens', case when _var is not null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'quantidade', e.quantidade) order by e.quantidade desc)
       from produto_embalagens e where e.produto_id = p.id and e.removida_em is null), '[]'::jsonb) end)
  from produtos p join comercios c on c.id = p.comercio_id where p.id = _prod
$$;

/* Entregas esperadas (sem quantidades) e fornecedores, para a tela "Receber mercadoria". */
create or replace function public.funcionario_entregas(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; c comercios%rowtype;
begin
  v := public._funcionario_recebe(_chave);
  select * into c from comercios where id = v.comercio_id;
  return jsonb_build_object(
    'pedidos', coalesce((select jsonb_agg(jsonb_build_object('id', pc.id, 'numero', pc.numero, 'fornecedor', f.nome, 'previsao_entrega', pc.previsao_entrega,
        'situacao', pc.situacao, 'produtos', (select count(distinct (i.produto_id, i.variacao_id)) from pedido_itens i where i.pedido_id = pc.id),
        'em_contagem', exists (select 1 from recebimentos r where r.pedido_id = pc.id and r.situacao = 'contando'))
        order by pc.previsao_entrega nulls last, pc.numero)
      from pedidos_compra pc join fornecedores f on f.id = pc.fornecedor_id
      where pc.comercio_id = v.comercio_id and pc.situacao in ('enviado', 'aceito', 'aceito_ajustes', 'recebido_parcial')
        and not exists (select 1 from recebimentos r where r.pedido_id = pc.id and r.situacao = 'concluido')), '[]'::jsonb),
    'fornecedores', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome) order by f.nome)
      from fornecedores f where f.dono_id = c.dono_id and f.ativo), '[]'::jsonb),
    'tipo', c.tipo);
end $$;

/* Abre (ou retoma) um recebimento. Com pedido: devolve os produtos do pedido (sem quantidades). */
create or replace function public.funcionario_abrir_recebimento(_chave text, _id uuid, _pedido uuid, _fornecedor uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; r recebimentos%rowtype; pc pedidos_compra%rowtype; c comercios%rowtype; v_forn uuid := _fornecedor;
begin
  v := public._funcionario_recebe(_chave);
  select * into c from comercios where id = v.comercio_id;
  if _pedido is not null then
    select * into pc from pedidos_compra where id = _pedido and comercio_id = v.comercio_id for update;
    if not found then raise exception 'pedido_nao_encontrado' using errcode = '42501'; end if;
    if pc.situacao not in ('enviado', 'aceito', 'aceito_ajustes', 'recebido_parcial') then raise exception 'pedido_fechado' using errcode = '23514'; end if;
    v_forn := pc.fornecedor_id;
    -- Uma contagem aberta por pedido: quem abrir de novo continua a mesma (celular reiniciado, troca de funcionário).
    select * into r from recebimentos where pedido_id = _pedido and situacao = 'contando' limit 1;
    if not found and exists (select 1 from recebimentos where pedido_id = _pedido and situacao = 'concluido') then
      raise exception 'pedido_ja_recebido' using errcode = '23514'; end if;
  end if;
  if r.id is null then
    select * into r from recebimentos where id = _id;
    if found and r.comercio_id <> v.comercio_id then raise exception 'recebimento_de_outro_comercio' using errcode = '42501'; end if;
  end if;
  if r.id is null then
    if v_forn is not null and not exists (select 1 from fornecedores where id = v_forn and dono_id = c.dono_id) then
      raise exception 'fornecedor_de_outro_dono' using errcode = '42501'; end if;
    insert into recebimentos (id, comercio_id, pedido_id, fornecedor_id, funcionario_id) values (_id, v.comercio_id, _pedido, v_forn, v.id) returning * into r;
  end if;
  return jsonb_build_object(
    'id', r.id, 'rodada', r.rodada, 'situacao', r.situacao, 'pedido_id', r.pedido_id,
    'numero', (select numero from pedidos_compra where id = r.pedido_id),
    'fornecedor', (select nome from fornecedores where id = r.fornecedor_id),
    'produtos', case when r.pedido_id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(public._produto_para_funcionario(x.produto_id, x.variacao_id, null) order by x.primeiro)
        from (select produto_id, variacao_id, min(created_at) primeiro from pedido_itens where pedido_id = r.pedido_id group by produto_id, variacao_id) x), '[]'::jsonb) end,
    'itens', coalesce((select jsonb_agg(jsonb_build_object('produto_id', i.produto_id, 'variacao_id', i.variacao_id, 'situacao', i.situacao))
       from recebimento_itens i where i.recebimento_id = r.id), '[]'::jsonb),
    'ultimo_resultado', r.ultimo_resultado);
end $$;

/* Achar o produto pelo código (produto, variação ou embalagem) ou pelo nome. */
create or replace function public.funcionario_buscar_produto(_chave text, _texto text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; t text := btrim(coalesce(_texto, ''));
begin
  v := public._funcionario_da_chave(_chave);
  if char_length(t) < 2 then return '[]'::jsonb; end if;
  if t ~ '^[0-9]+$' then
    return coalesce((select jsonb_agg(public._produto_para_funcionario(cb.produto_id, cb.variacao_id, cb.embalagem_id))
      from codigos_barras cb join produtos p on p.id = cb.produto_id and p.ativo
      where cb.comercio_id = v.comercio_id and cb.codigo = t), '[]'::jsonb);
  end if;
  return coalesce((select jsonb_agg(public._produto_para_funcionario(x.pid, x.vid, null)) from (
      select p.id pid, pv.id vid from produtos p left join produto_variacoes pv on pv.produto_id = p.id and pv.removida_em is null
       where p.comercio_id = v.comercio_id and p.ativo and p.nome ilike '%' || replace(replace(t, '%', ''), '_', '') || '%'
       order by p.nome, pv.tamanho, pv.cor limit 12) x), '[]'::jsonb);
end $$;

/* Entrada no depósito de um item recebido (bons = total - avaria). Uma operação permanente por produto. */
create or replace function public._entrar_no_deposito(_item uuid, _tentativa jsonb, _user uuid, _func uuid) returns numeric
language plpgsql security definer set search_path = public, pg_temp as $$
declare i recebimento_itens%rowtype; p produtos%rowtype; v_farm boolean; v_op uuid := gen_random_uuid(); v_local uuid;
  v_bons numeric; pt jsonb; v_q numeric; v_lote uuid; v_saldo uuid; v_soma numeric := 0; v_venc date; v_num text;
begin
  select * into i from recebimento_itens where id = _item for update;
  select * into p from produtos where id = i.produto_id;
  select tipo = 'farmacia' into v_farm from comercios where id = i.comercio_id;
  v_bons := (_tentativa->>'total')::numeric - coalesce((_tentativa->>'avaria')::numeric, 0);
  if v_bons <= 0 then return 0; end if;
  insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash, funcionario_id)
  values (v_op, _user, i.comercio_id, i.produto_id, 'recebimento', md5(_item::text || coalesce(_tentativa::text, '')), _func);
  perform pg_advisory_xact_lock(hashtextextended(i.produto_id::text, 0));
  select local_id into v_local from produto_areas where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id and area = 'deposito';
  if coalesce(p.controla_validade, false) then
    for pt in select * from jsonb_array_elements(coalesce(_tentativa->'partes', '[]')) loop
      v_q := public.qtd_valida((pt->>'quantidade')::numeric, p.unidade, false);
      v_venc := nullif(pt->>'vencimento', '')::date;
      v_num := nullif(btrim(coalesce(pt->>'lote', '')), '');
      if v_venc is null then raise exception 'validade_obrigatoria' using errcode = '23514'; end if;
      if v_farm and public.normalizar_lote(v_num) is null then raise exception 'lote_obrigatorio' using errcode = '23514'; end if;
      v_lote := public._lote_da_parte(i.comercio_id, i.produto_id, i.variacao_id, v_num, v_venc);
      select id into v_saldo from saldos where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id
         and area = 'deposito' and lote_id = v_lote and not pendente order by updated_at limit 1 for update;
      if found then update saldos set quantidade = quantidade + v_q, updated_at = now() where id = v_saldo;
      else insert into saldos (comercio_id, produto_id, variacao_id, area, lote_id, quantidade)
           values (i.comercio_id, i.produto_id, i.variacao_id, 'deposito', v_lote, v_q) returning id into v_saldo; end if;
      insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, lote_id, saldo_id, tipo, quantidade, criado_por, funcionario_id)
      values (v_op, i.comercio_id, i.produto_id, i.variacao_id, 'deposito', v_local, v_lote, v_saldo, 'entrada', v_q, _user, _func);
      v_soma := v_soma + v_q;
    end loop;
    if v_soma <> v_bons then raise exception 'validades_nao_somam' using errcode = '23514'; end if;
  else
    v_q := public.qtd_valida(v_bons, p.unidade, false);
    select id into v_saldo from saldos where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id
       and area = 'deposito' and lote_id is null and not pendente order by updated_at limit 1 for update;
    if found then update saldos set quantidade = quantidade + v_q, updated_at = now() where id = v_saldo;
    else insert into saldos (comercio_id, produto_id, variacao_id, area, quantidade)
         values (i.comercio_id, i.produto_id, i.variacao_id, 'deposito', v_q) returning id into v_saldo; end if;
    insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, saldo_id, tipo, quantidade, criado_por, funcionario_id)
    values (v_op, i.comercio_id, i.produto_id, i.variacao_id, 'deposito', v_local, v_saldo, 'entrada', v_q, _user, _func);
  end if;
  update operacoes set resultado = jsonb_build_object('recebimento_item', _item, 'entrada', v_bons) where id = v_op;
  update recebimento_itens set entrou_estoque = entrou_estoque + v_bons where id = _item;
  return v_bons;
end $$;

/* Pedido depois do recebimento: quanto chegou de cada item (unidades de venda) e a situação. */
create or replace function public._fechar_pedido_recebido(_pedido uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
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
  update pedidos_compra set situacao = case
      when exists (select 1 from recebimento_itens ri join recebimentos r on r.id = ri.recebimento_id
                    where r.pedido_id = _pedido and ri.situacao = 'inconsistente') then 'recebido_parcial'
      else 'recebido' end
   where id = _pedido and situacao <> 'cancelado';
end $$;

/* "Terminei": manda as contagens. O servidor compara às cegas e devolve só o que recontar, o que falta contar
   ou "concluido". _rodada evita contar duas vezes a mesma rodada se a internet cair. */
create or replace function public.funcionario_enviar_recebimento(_chave text, _id uuid, _rodada int, _itens jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; r recebimentos%rowtype; c comercios%rowtype; x jsonb; i recebimento_itens%rowtype;
  p produtos%rowtype; v_total numeric; v_avaria numeric; v_esp numeric; v_no_ped boolean; v_tent jsonb; v_cont numeric[];
  v_sit text; v_recontar jsonb := '[]'; v_faltam jsonb := '[]'; v_res jsonb; v_soma numeric; v_n int := 0; v_aviso boolean := false;
begin
  v := public._funcionario_recebe(_chave);
  select * into r from recebimentos where id = _id for update;
  if not found or r.comercio_id <> v.comercio_id then raise exception 'recebimento_nao_encontrado' using errcode = '42501'; end if;
  if r.situacao = 'concluido' then return coalesce(r.ultimo_resultado, jsonb_build_object('situacao', 'concluido')); end if;
  if _rodada = r.rodada - 1 and r.ultimo_resultado is not null then return r.ultimo_resultado; end if;
  if _rodada is distinct from r.rodada then raise exception 'rodada_desatualizada' using errcode = '40001'; end if;
  if jsonb_typeof(_itens) is distinct from 'array' then raise exception 'itens_obrigatorios' using errcode = '22023'; end if;
  if jsonb_array_length(_itens) > 300 then raise exception 'itens_demais' using errcode = '23514'; end if;
  select * into c from comercios where id = r.comercio_id;

  for x in select * from jsonb_array_elements(_itens) loop
    select * into p from produtos where id = (x->>'produto_id')::uuid and comercio_id = r.comercio_id and ativo;
    if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
    if (x->>'variacao_id') is not null and not exists (select 1 from produto_variacoes where id = (x->>'variacao_id')::uuid and produto_id = p.id and removida_em is null) then
      raise exception 'variacao_invalida' using errcode = '23514'; end if;
    select * into i from recebimento_itens where recebimento_id = r.id and produto_id = p.id and variacao_id is not distinct from (x->>'variacao_id')::uuid for update;
    if found and i.situacao <> 'recontar' then continue; end if;   -- já conferido nesta entrega: não muda mais

    v_total := public.qtd_valida((x->>'total')::numeric, p.unidade, true);
    v_avaria := public.qtd_valida(coalesce((x->>'avaria')::numeric, 0), p.unidade, true);
    if v_avaria > v_total then raise exception 'avaria_maior_que_total' using errcode = '23514'; end if;
    if v_total > 1000000 then raise exception 'quantidade_grande_demais' using errcode = '23514'; end if;
    if coalesce(p.controla_validade, false) and v_total - v_avaria > 0 then
      select coalesce(sum((e->>'quantidade')::numeric), 0) into v_soma from jsonb_array_elements(coalesce(x->'partes', '[]')) e;
      if v_soma <> v_total - v_avaria then raise exception 'validades_nao_somam' using errcode = '23514'; end if;
      if exists (select 1 from jsonb_array_elements(x->'partes') e where nullif(e->>'vencimento', '') is null) then
        raise exception 'validade_obrigatoria' using errcode = '23514'; end if;
      if c.tipo = 'farmacia' and exists (select 1 from jsonb_array_elements(x->'partes') e where public.normalizar_lote(e->>'lote') is null) then
        raise exception 'lote_obrigatorio' using errcode = '23514'; end if;
    end if;
    v_tent := jsonb_build_object('total', v_total, 'avaria', v_avaria, 'partes', coalesce(x->'partes', '[]'), 'em', now());

    if i.id is null then
      v_no_ped := r.pedido_id is not null and exists (select 1 from pedido_itens where pedido_id = r.pedido_id and produto_id = p.id
                    and variacao_id is not distinct from (x->>'variacao_id')::uuid);
      v_esp := case when v_no_ped then greatest(0, (select sum(coalesce(qtd_confirmada * qtd_unidades / qtd_embalagens, qtd_unidades)) - sum(coalesce(qtd_recebida, 0))
                  from pedido_itens where pedido_id = r.pedido_id and produto_id = p.id and variacao_id is not distinct from (x->>'variacao_id')::uuid)) end;
      insert into recebimento_itens (recebimento_id, comercio_id, produto_id, variacao_id, no_pedido, esperado, situacao)
      values (r.id, r.comercio_id, p.id, (x->>'variacao_id')::uuid, v_no_ped, v_esp, 'recontar') returning * into i;
    end if;

    update recebimento_itens set tentativas = tentativas || v_tent where id = i.id returning * into i;
    select array_agg((t->>'total')::numeric) into v_cont from jsonb_array_elements(i.tentativas) t;
    v_sit := case
      when r.pedido_id is not null and not i.no_pedido then 'fora_do_pedido'
      when i.esperado is null or v_total = i.esperado then 'aceito'
      when array_position(v_cont[1:cardinality(v_cont) - 1], v_total) is not null then 'aceito'
      when cardinality(v_cont) >= 3 then 'inconsistente'
      else 'recontar' end;
    update recebimento_itens set situacao = v_sit,
      quantidade_aceita = case when v_sit in ('aceito', 'fora_do_pedido') then v_total end,
      avaria = case when v_sit in ('aceito', 'fora_do_pedido') then v_avaria else 0 end
     where id = i.id;
    if v_sit = 'recontar' then v_recontar := v_recontar || jsonb_build_object('produto_id', p.id, 'variacao_id', i.variacao_id); end if;
  end loop;

  -- Produtos do pedido que ainda não foram contados (o funcionário conta ou marca "Não veio").
  if r.pedido_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('produto_id', x2.produto_id, 'variacao_id', x2.variacao_id)), '[]') into v_faltam
      from (select distinct produto_id, variacao_id from pedido_itens pi where pi.pedido_id = r.pedido_id
             and not exists (select 1 from recebimento_itens ri where ri.recebimento_id = r.id and ri.produto_id = pi.produto_id
                              and ri.variacao_id is not distinct from pi.variacao_id)) x2;
  end if;
  if not exists (select 1 from recebimento_itens where recebimento_id = r.id) then raise exception 'recebimento_vazio' using errcode = '23514'; end if;

  if jsonb_array_length(v_recontar) > 0 or jsonb_array_length(v_faltam) > 0 then
    v_res := jsonb_build_object('situacao', 'recontar', 'recontar', v_recontar, 'faltam', v_faltam, 'rodada', r.rodada + 1);
    update recebimentos set rodada = rodada + 1, ultimo_resultado = v_res where id = r.id;
    return v_res;
  end if;

  -- Tudo conferido: entra no depósito o que foi aceito (fora do pedido e inconsistências esperam o dono).
  for i in select * from recebimento_itens where recebimento_id = r.id and situacao = 'aceito' loop
    perform public._entrar_no_deposito(i.id, i.tentativas -> (jsonb_array_length(i.tentativas) - 1), c.dono_id, v.id);
    v_n := v_n + 1;
  end loop;
  v_aviso := exists (select 1 from recebimento_itens where recebimento_id = r.id
     and (situacao in ('inconsistente', 'fora_do_pedido') or avaria > 0 or (esperado is not null and quantidade_aceita is distinct from esperado)));
  v_res := jsonb_build_object('situacao', 'concluido', 'produtos', (select count(*) from recebimento_itens where recebimento_id = r.id), 'avisos', v_aviso, 'rodada', r.rodada + 1);
  update recebimentos set situacao = 'concluido', concluido_em = now(), rodada = rodada + 1, ultimo_resultado = v_res where id = r.id;
  perform public._fechar_pedido_recebido(r.pedido_id);
  return v_res;
end $$;

/* Dono: decide um item que não fechou (escolhe uma das contagens) ou um produto que veio fora do pedido (aceitar no estoque ou recusar). */
create or replace function public.resolver_item_recebimento(_item uuid, _acao text, _tentativa int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare i recebimento_itens%rowtype; r recebimentos%rowtype; v_t jsonb;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into i from recebimento_itens where id = _item for update;
  if not found or not public.pode_acessar_comercio(i.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  select * into r from recebimentos where id = i.recebimento_id;
  if r.situacao <> 'concluido' then raise exception 'recebimento_em_contagem' using errcode = '23514'; end if;
  if i.situacao not in ('inconsistente', 'fora_do_pedido') then raise exception 'item_ja_resolvido' using errcode = '23514'; end if;
  if _acao = 'recusar' then
    update recebimento_itens set situacao = 'recusado', resolvido_por = auth.uid(), resolvido_em = now() where id = _item;
  elsif _acao = 'aceitar' then
    v_t := case when i.situacao = 'inconsistente' then i.tentativas -> _tentativa else i.tentativas -> (jsonb_array_length(i.tentativas) - 1) end;
    if v_t is null then raise exception 'contagem_invalida' using errcode = '22023'; end if;
    update recebimento_itens set situacao = 'aceito', quantidade_aceita = (v_t->>'total')::numeric, avaria = coalesce((v_t->>'avaria')::numeric, 0),
      resolvido_por = auth.uid(), resolvido_em = now() where id = _item;
    perform public._entrar_no_deposito(_item, v_t, auth.uid(), null);
  else
    raise exception 'acao_invalida' using errcode = '22023';
  end if;
  perform public._fechar_pedido_recebido(r.pedido_id);
end $$;

-- funcionario_inicio: entrega já recebida não conta mais como esperada.
create or replace function public.funcionario_inicio(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; c comercios%rowtype; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_entregas int; v_hoje_n int; v_repor int;
begin
  begin v := public._funcionario_da_chave(_chave);
  exception when others then return null; end;
  select * into c from comercios where id = v.comercio_id;
  select count(*), count(*) filter (where previsao_entrega is not null and previsao_entrega <= v_hoje)
    into v_entregas, v_hoje_n
    from pedidos_compra pc where comercio_id = v.comercio_id and situacao in ('enviado', 'aceito', 'aceito_ajustes', 'recebido_parcial')
     and not exists (select 1 from recebimentos r where r.pedido_id = pc.id and r.situacao = 'concluido');
  select count(*) into v_repor from (
    select pa.produto_id, pa.variacao_id
      from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
      left join saldos s on s.produto_id = pa.produto_id and s.variacao_id is not distinct from pa.variacao_id and s.area = 'venda'
     where pa.comercio_id = v.comercio_id and pa.area = 'venda' and pa.minimo is not null
     group by pa.produto_id, pa.variacao_id, pa.minimo
    having coalesce(sum(s.quantidade), 0) <= pa.minimo) x;
  return jsonb_build_object('nome', v.nome, 'funcao', v.funcao, 'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo),
    'avisos', jsonb_build_object('entregas', v_entregas, 'entregas_hoje', v_hoje_n, 'repor', v_repor));
end $$;

revoke all on function public._funcionario_recebe(text), public._produto_para_funcionario(uuid, uuid, uuid), public._entrar_no_deposito(uuid, jsonb, uuid, uuid),
  public._fechar_pedido_recebido(uuid), public.funcionario_entregas(text), public.funcionario_abrir_recebimento(text, uuid, uuid, uuid),
  public.funcionario_buscar_produto(text, text), public.funcionario_enviar_recebimento(text, uuid, int, jsonb),
  public.resolver_item_recebimento(uuid, text, int) from public, anon, authenticated;
grant execute on function public.funcionario_entregas(text), public.funcionario_abrir_recebimento(text, uuid, uuid, uuid),
  public.funcionario_buscar_produto(text, text), public.funcionario_enviar_recebimento(text, uuid, int, jsonb) to anon, authenticated;
grant execute on function public.resolver_item_recebimento(uuid, text, int) to authenticated;
