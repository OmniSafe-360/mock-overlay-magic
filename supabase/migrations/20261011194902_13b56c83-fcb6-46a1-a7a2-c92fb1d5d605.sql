do $mig$
declare d text; n text;
begin
  d := pg_get_functiondef('public.caixa_registrar_venda'::regproc);
  if position('v_num := c.proximo_numero_venda;' in d) = 0
     or position('update comercios set proximo_numero_venda = proximo_numero_venda + 1 where id = c.id;' in d) = 0 then
    raise exception 'trecho_nao_encontrado';
  end if;
  n := replace(d, 'v_num := c.proximo_numero_venda;',
    'update comercios set proximo_numero_venda = proximo_numero_venda + 1 where id = c.id returning proximo_numero_venda - 1 into v_num;');
  n := replace(n, 'update comercios set proximo_numero_venda = proximo_numero_venda + 1 where id = c.id;', '');
  n := replace(n, 'returning proximo_numero_venda - 1 into v_num;', 'returning proximo_numero_venda - 1 into v_num;');
  execute n;
end $mig$;
create unique index if not exists vendas_comercio_numero_unico on public.vendas (comercio_id, numero) where numero is not null;