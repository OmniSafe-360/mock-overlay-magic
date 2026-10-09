-- Etapa D2b: link do fornecedor (desenho aprovado pelo dono em 09/10/2026).
-- Quem tem o link (64 letras aleatórias) vê só aquele pedido — sem estoque, sem preços de compra, sem outros pedidos —
-- e pode responder enquanto o pedido não for recebido nem cancelado. Funciona sem login (anon), só por estas funções.

/* Dados do pedido para a página do fornecedor. null = link inválido. */
create or replace function public.pedido_publico(_token text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v pedidos_compra%rowtype; c comercios%rowtype; v_forn text; v_itens jsonb;
begin
  if _token is null or char_length(_token) <> 64 then return null; end if;
  select * into v from pedidos_compra where token = _token;
  if not found then return null; end if;
  select * into c from comercios where id = v.comercio_id;
  select nome into v_forn from fornecedores where id = v.fornecedor_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'produto', p.nome, 'codigo', p.codigo_barras, 'unidade', p.unidade,
      'variacao', case when pv.id is null then null else pv.tamanho || ' · ' || pv.cor end,
      'embalagem', e.tipo, 'por_embalagem', e.quantidade,
      'qtd_embalagens', i.qtd_embalagens, 'qtd_unidades', i.qtd_unidades, 'qtd_confirmada', i.qtd_confirmada
    ) order by i.created_at, p.nome), '[]'::jsonb)
    into v_itens
    from pedido_itens i join produtos p on p.id = i.produto_id
    left join produto_variacoes pv on pv.id = i.variacao_id
    left join produto_embalagens e on e.id = i.embalagem_id
   where i.pedido_id = v.id;
  return jsonb_build_object(
    'numero', v.numero, 'situacao', v.situacao, 'fornecedor', v_forn, 'observacao', v.observacao, 'enviado_em', v.enviado_em,
    'pode_responder', v.situacao not in ('recebido_parcial', 'recebido', 'cancelado'),
    'comercio', jsonb_build_object('nome', c.nome, 'rua', c.rua, 'numero', c.numero, 'bairro', c.bairro, 'cidade', c.cidade, 'uf', c.uf,
      'complemento', c.complemento, 'telefone', c.telefone),
    'resposta', case when v.resposta_em is null then null else jsonb_build_object(
      'em', v.resposta_em, 'previsao_entrega', v.previsao_entrega, 'valor_total', v.valor_total,
      'forma_pagamento', v.forma_pagamento, 'prazo_dias', v.prazo_dias, 'recado', v.recado_fornecedor) end,
    'itens', v_itens);
end $$;

/* Resposta do fornecedor. r = {aceito, itens: [{id, qtd_confirmada}], previsao_entrega, valor_total, forma_pagamento, prazo_dias, recado}.
   Pode responder de novo (corrigir) enquanto o pedido não for recebido nem cancelado. */
create or replace function public.responder_pedido(_token text, r jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v pedidos_compra%rowtype; x jsonb; i pedido_itens%rowtype;
  v_aceito boolean := coalesce((r->>'aceito')::boolean, false);
  v_prev date := nullif(r->>'previsao_entrega', '')::date;
  v_valor numeric := nullif(r->>'valor_total', '')::numeric;
  v_forma text := nullif(r->>'forma_pagamento', '');
  v_prazo int := nullif(r->>'prazo_dias', '')::int;
  v_recado text := nullif(btrim(coalesce(r->>'recado', '')), '');
  v_q numeric; v_ajuste boolean := false; v_venc date;
begin
  if _token is null or char_length(_token) <> 64 then raise exception 'link_invalido' using errcode = '42501'; end if;
  select * into v from pedidos_compra where token = _token for update;
  if not found then raise exception 'link_invalido' using errcode = '42501'; end if;
  if v.situacao in ('recebido_parcial', 'recebido', 'cancelado') then raise exception 'pedido_fechado' using errcode = '23514'; end if;
  if v_recado is not null and char_length(v_recado) > 500 then raise exception 'recado_longo' using errcode = '23514'; end if;
  if v_valor is not null and (v_valor < 0 or v_valor > 99999999) then raise exception 'valor_invalido' using errcode = '23514'; end if;
  if v_forma is not null and v_forma not in ('a_vista', 'pix', 'boleto', 'a_prazo') then raise exception 'forma_invalida' using errcode = '23514'; end if;
  if v_prazo is not null and (v_prazo < 0 or v_prazo > 365) then raise exception 'prazo_invalido' using errcode = '23514'; end if;
  if v_prev is not null and (v_prev < current_date - 1 or v_prev > current_date + 366) then raise exception 'previsao_invalida' using errcode = '23514'; end if;

  if not v_aceito then
    update pedidos_compra set situacao = 'recusado', resposta_em = now(), recado_fornecedor = v_recado,
      previsao_entrega = null, valor_total = null, forma_pagamento = null, prazo_dias = null,
      pagamento_situacao = case when pagamento_situacao = 'pago' then 'pago' else null end, vencimento = null
     where id = v.id;
    return jsonb_build_object('situacao', 'recusado');
  end if;

  if v_prev is null then raise exception 'previsao_obrigatoria' using errcode = '23514'; end if;
  if jsonb_typeof(r->'itens') is distinct from 'array' then raise exception 'itens_obrigatorios' using errcode = '23514'; end if;
  for x in select * from jsonb_array_elements(r->'itens') loop
    select * into i from pedido_itens where id = (x->>'id')::uuid and pedido_id = v.id for update;
    if not found then raise exception 'item_de_outro_pedido' using errcode = '42501'; end if;
    v_q := (x->>'qtd_confirmada')::numeric;
    if v_q is null or v_q < 0 or v_q > i.qtd_embalagens * 100 then raise exception 'quantidade_invalida' using errcode = '23514'; end if;
    if i.embalagem_id is not null and v_q <> trunc(v_q) then raise exception 'embalagem_inteira' using errcode = '23514'; end if;
    if v_q <> round(v_q, 3) then raise exception 'mais_de_tres_casas' using errcode = '22023'; end if;
    update pedido_itens set qtd_confirmada = v_q where id = i.id;
  end loop;
  if exists (select 1 from pedido_itens where pedido_id = v.id and qtd_confirmada is null) then
    raise exception 'responda_todos_os_itens' using errcode = '23514'; end if;
  if not exists (select 1 from pedido_itens where pedido_id = v.id and qtd_confirmada > 0) then
    raise exception 'nenhum_item_disponivel' using errcode = '23514'; end if;
  v_ajuste := exists (select 1 from pedido_itens where pedido_id = v.id and qtd_confirmada <> qtd_embalagens);
  -- Vencimento sugerido: na entrega (à vista, Pix) ou na entrega + prazo (boleto, a prazo). O dono pode corrigir depois.
  v_venc := case when v_forma in ('boleto', 'a_prazo') then v_prev + coalesce(v_prazo, 0) else v_prev end;
  update pedidos_compra set situacao = case when v_ajuste then 'aceito_ajustes' else 'aceito' end,
    resposta_em = now(), previsao_entrega = v_prev, valor_total = v_valor, forma_pagamento = v_forma,
    prazo_dias = case when v_forma in ('boleto', 'a_prazo') then v_prazo else null end, recado_fornecedor = v_recado,
    pagamento_situacao = case when pagamento_situacao = 'pago' then 'pago' else 'a_pagar' end,
    vencimento = case when pagamento_situacao = 'pago' then vencimento else v_venc end
   where id = v.id;
  return jsonb_build_object('situacao', case when v_ajuste then 'aceito_ajustes' else 'aceito' end);
end $$;

/* Dono: troca o link do pedido (o antigo para de funcionar). */
create or replace function public.novo_link_pedido(_pedido uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v pedidos_compra%rowtype; t text;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into v from pedidos_compra where id = _pedido for update;
  if not found or not public.pode_acessar_comercio(v.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  t := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update pedidos_compra set token = t where id = _pedido;
  return t;
end $$;

revoke all on function public.pedido_publico(text), public.responder_pedido(text, jsonb), public.novo_link_pedido(uuid) from public;
grant execute on function public.pedido_publico(text), public.responder_pedido(text, jsonb) to anon, authenticated;
grant execute on function public.novo_link_pedido(uuid) to authenticated;
revoke execute on function public.novo_link_pedido(uuid) from anon;
