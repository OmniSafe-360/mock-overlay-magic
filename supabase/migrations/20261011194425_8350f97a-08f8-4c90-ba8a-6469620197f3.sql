CREATE OR REPLACE FUNCTION public._cancelar_venda_celular(_venda uuid, _por text, _motivo text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
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