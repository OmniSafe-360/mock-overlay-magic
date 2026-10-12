create or replace function public.caixa_cliente_fiado_historico(_chave text, _cliente uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_caixa(_chave);
  if not exists (select 1 from clientes_fiado where id = _cliente and comercio_id = v.comercio_id) then
    raise exception 'cliente_nao_encontrado' using errcode = 'P0001';
  end if;
  return coalesce((select jsonb_agg(x order by x->>'criado_em' desc) from (
    select jsonb_build_object('id', m.id, 'tipo', m.tipo, 'valor', m.valor, 'forma', m.forma,
      'venda_numero', vd.numero, 'criado_em', m.criado_em) x
    from fiado_movimentos m left join vendas vd on vd.id = m.venda_id
    where m.cliente_id = _cliente and m.comercio_id = v.comercio_id
    order by m.criado_em desc, m.id desc limit 30) s), '[]');
end $function$;
revoke all on function public.caixa_cliente_fiado_historico(text, uuid) from public;
grant execute on function public.caixa_cliente_fiado_historico(text, uuid) to anon, authenticated;