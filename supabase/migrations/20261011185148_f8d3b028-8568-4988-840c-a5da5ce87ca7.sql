CREATE OR REPLACE FUNCTION public.responder_pedido(_token text, r jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  if exists (select 1 from recebimentos where pedido_id = v.id and situacao = 'contando') then
    raise exception 'recebimento_em_contagem' using errcode = '23514';
  end if;
  if v_recado is not null and char_length(v_recado) > 500 then raise exception 'recado_longo' using errcode = '23514'; end if;
  if v_valor is not null and (v_valor < 0 or v_valor > 99999999) then raise exception 'valor_invalido' using errcode = '23514'; end if;
  if v_forma is not null and v_forma not in ('a_vista', 'pix', 'boleto', 'a_prazo') then raise exception 'forma_invalida' using errcode = '23514'; end if;
  if v_prazo is not null and (v_prazo < 0 or v_prazo > 365) then raise exception 'prazo_invalido' using errcode = '23514'; end if;
  if v_prev is not null and (v_prev < current_date - 1 or v_prev > current_date + 366) then raise exception 'previsao_invalida' using errcode = '23514'; end if;

  if not v_aceito then
    -- Conta já paga continua inteira (valor e vencimento); conta só a pagar sai, como antes.
    update pedidos_compra set situacao = 'recusado', resposta_em = now(), recado_fornecedor = v_recado,
      previsao_entrega = null, forma_pagamento = null, prazo_dias = null,
      valor_total = case when pagamento_situacao = 'pago' then valor_total else null end,
      pagamento_situacao = case when pagamento_situacao = 'pago' then 'pago' else null end,
      vencimento = case when pagamento_situacao = 'pago' then vencimento else null end
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
  v_venc := case when v_forma in ('boleto', 'a_prazo') then v_prev + coalesce(v_prazo, 0) else v_prev end;
  -- Conta que já existe (a pagar ou paga) mantém o valor e o vencimento; o fornecedor só preenche o que está vazio.
  update pedidos_compra set situacao = case when v_ajuste then 'aceito_ajustes' else 'aceito' end,
    resposta_em = now(), previsao_entrega = v_prev, forma_pagamento = v_forma,
    valor_total = case when pagamento_situacao is not null then coalesce(valor_total, v_valor) else v_valor end,
    prazo_dias = case when v_forma in ('boleto', 'a_prazo') then v_prazo else null end, recado_fornecedor = v_recado,
    pagamento_situacao = case when pagamento_situacao = 'pago' then 'pago' else 'a_pagar' end,
    vencimento = case when pagamento_situacao is not null then coalesce(vencimento, v_venc) else v_venc end
   where id = v.id;
  return jsonb_build_object('situacao', case when v_ajuste then 'aceito_ajustes' else 'aceito' end);
end $function$;