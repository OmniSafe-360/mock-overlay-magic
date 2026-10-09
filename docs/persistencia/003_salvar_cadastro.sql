-- Salva o produto e resolve as pendências escolhidas na MESMA transação.
-- Qualquer recusa (em salvar_produto ou em qualquer resolver_pendencia) desfaz tudo.
-- p = { operacao_id, produto_pedido: <pedido de salvar_produto>,
--       pendencias: [{ operacao_id, origem_id, partes:[...], confirmar_vencimento? }] }
-- confirmar_vencimento só é repassado quando vier explicitamente no pedido.
create function public.salvar_cadastro(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_op uuid := (p->>'operacao_id')::uuid;
  pp jsonb := p->'produto_pedido';
  v_com uuid := (pp->'produto'->>'comercio_id')::uuid;
  v_id uuid := (pp->'produto'->>'id')::uuid;
  v_prev jsonb; r jsonb; x jsonb; v_n int := 0;
begin
  if pp is null or jsonb_typeof(pp) <> 'object' then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
  v_prev := public._iniciar_operacao(v_op, v_com, v_id, 'salvar_cadastro', md5((p - 'operacao_id')::text));
  if v_prev is not null then return v_prev; end if;

  r := public.salvar_produto(pp);
  for x in select * from jsonb_array_elements(coalesce(p->'pendencias', '[]')) loop
    perform public.resolver_pendencia(jsonb_strip_nulls(jsonb_build_object(
      'operacao_id', x->'operacao_id', 'comercio_id', v_com, 'produto_id', v_id,
      'origem_id', x->'origem_id', 'partes', x->'partes',
      'confirmar_vencimento', case when (x->>'confirmar_vencimento')::boolean is true then true end)));
    v_n := v_n + 1;
  end loop;

  v_prev := r || jsonb_build_object('pendencias_resolvidas', v_n);
  update operacoes set resultado = v_prev where id = v_op;
  return v_prev;
end $$;
revoke execute on function public.salvar_cadastro(jsonb) from public, anon;
grant execute on function public.salvar_cadastro(jsonb) to authenticated;
