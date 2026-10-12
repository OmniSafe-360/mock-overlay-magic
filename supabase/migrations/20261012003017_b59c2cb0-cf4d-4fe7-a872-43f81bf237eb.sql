CREATE OR REPLACE FUNCTION public.caixa_clientes_fiado(_chave text)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_caixa(_chave);
  return coalesce((
    with m as (
      select cliente_id, criado_em, id,
        sum(case when tipo = 'compra' then valor else -valor end)
          over (partition by cliente_id order by criado_em, id) saldo
      from fiado_movimentos where comercio_id = v.comercio_id
    ), zero as (
      select cliente_id, max(criado_em) ate from m where saldo <= 0 group by cliente_id
    ), res as (
      select c.id,
        greatest(coalesce((select m2.saldo from m m2 where m2.cliente_id = c.id order by m2.criado_em desc, m2.id desc limit 1), 0), 0) deve,
        (select min(m3.criado_em) from m m3 left join zero z on z.cliente_id = m3.cliente_id
          where m3.cliente_id = c.id and (z.ate is null or m3.criado_em > z.ate)) desde
      from clientes_fiado c where c.comercio_id = v.comercio_id and c.ativo
    )
    select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'telefone', c.telefone,
      'deve', r.deve, 'desde', case when r.deve > 0 then r.desde end) order by c.nome)
    from clientes_fiado c join res r on r.id = c.id
  ), '[]');
end $function$;