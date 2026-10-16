-- Checklist 2, item A5: cancelar uma venda fiado que o cliente já pagou deixava a conta negativa
-- (crédito escondido: a tela mostrava "Em dia" e as próximas compras sumiam). Decisão do dono: devolver o dinheiro.
-- O cancelamento tira da conta no máximo o que o cliente ainda deve; o que ele já tinha pago desta venda
-- volta como "devolver" na resposta, para o app avisar quanto devolver ao cliente. A conta nunca fica negativa.
-- (Já aplicada no banco oficial em 11/10/2026 com esta versão; arquivo guardado no repositório em 16/10/2026,
-- igual ao registro em supabase_migrations.schema_migrations.)
CREATE OR REPLACE FUNCTION public._cancelar_venda_celular(_venda uuid, _por text, _motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare vd vendas%rowtype; r record; m fiado_movimentos%rowtype; v_deve numeric; v_tira numeric;
begin
  select * into vd from vendas where id = _venda for update;
  for r in select id from venda_itens where venda_id = vd.id order by produto_id nulls last, n_item loop
    perform public._devolver_item_venda(r.id);
  end loop;
  update vendas set situacao = 'cancelada', cancelada_em = now(), cancelada_por = _por,
         motivo_cancelamento = left(nullif(btrim(coalesce(_motivo, '')), ''), 200) where id = vd.id;
  select * into m from fiado_movimentos where venda_id = vd.id and tipo = 'compra';
  if found then
    perform 1 from clientes_fiado where id = m.cliente_id for update;
    select coalesce(sum(case when tipo = 'compra' then valor else -valor end), 0) into v_deve
      from fiado_movimentos where cliente_id = m.cliente_id;
    v_tira := least(m.valor, greatest(v_deve, 0));
    if v_tira > 0 then
      insert into fiado_movimentos (id, comercio_id, cliente_id, tipo, valor, venda_id, funcionario_id, registrado_por)
      values (gen_random_uuid(), m.comercio_id, m.cliente_id, 'cancelamento', v_tira, vd.id,
              case when _por = 'funcionario' then vd.funcionario_id end, case when _por = 'dono' then auth.uid() end);
    end if;
  end if;
end $function$;

-- Quanto devolver ao cliente do fiado depois de cancelar a venda (o que ele já tinha pago dela).
CREATE OR REPLACE FUNCTION public.caixa_cancelar_venda(_chave text, _venda uuid, _pin_dono text, _motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype; vd vendas%rowtype; v_erro text; v_devolver numeric;
begin
  v := public._funcionario_caixa(_chave);
  perform pg_advisory_xact_lock(hashtextextended(_venda::text, 0));
  select * into vd from vendas where id = _venda and comercio_id = v.comercio_id and origem = 'celular' for update;
  if not found then raise exception 'venda_invalida' using errcode = '42501'; end if;
  if vd.situacao = 'cancelada' then return jsonb_build_object('situacao', 'repetida'); end if;
  v_erro := public._conferir_pin_dono(v.comercio_id, _pin_dono);
  if v_erro is not null then return jsonb_build_object('erro', v_erro); end if;
  perform public._cancelar_venda_celular(vd.id, 'funcionario', _motivo);
  select coalesce(sum(case tipo when 'compra' then valor when 'cancelamento' then -valor else 0 end), 0) into v_devolver
    from fiado_movimentos where venda_id = vd.id;
  return jsonb_build_object('situacao', 'cancelada', 'venda', vd.id, 'devolver', v_devolver);
end $function$;

CREATE OR REPLACE FUNCTION public.cancelar_venda_celular(_venda uuid, _motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare vd vendas%rowtype; v_devolver numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(_venda::text, 0));
  select * into vd from vendas where id = _venda and origem = 'celular' for update;
  if not found or not public.pode_acessar_comercio(vd.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if vd.situacao = 'cancelada' then return jsonb_build_object('situacao', 'repetida'); end if;
  perform public._cancelar_venda_celular(vd.id, 'dono', _motivo);
  select coalesce(sum(case tipo when 'compra' then valor when 'cancelamento' then -valor else 0 end), 0) into v_devolver
    from fiado_movimentos where venda_id = vd.id;
  return jsonb_build_object('situacao', 'cancelada', 'venda', vd.id, 'devolver', v_devolver);
end $function$;
