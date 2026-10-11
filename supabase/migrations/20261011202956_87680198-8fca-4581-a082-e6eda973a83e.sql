alter table public.pedidos_compra add column if not exists valor_fornecedor numeric(12,2);
update public.pedidos_compra set valor_fornecedor = valor_total where resposta_em is not null and situacao <> 'recusado' and valor_fornecedor is null;
do $m$
declare d text; n text;
begin
  d := pg_get_functiondef('public.responder_pedido'::regproc);
  n := replace(d, 'previsao_entrega = null, forma_pagamento = null, prazo_dias = null,', 'previsao_entrega = null, forma_pagamento = null, prazo_dias = null, valor_fornecedor = null,');
  n := replace(n, 'resposta_em = now(), previsao_entrega = v_prev, forma_pagamento = v_forma,', 'resposta_em = now(), previsao_entrega = v_prev, forma_pagamento = v_forma, valor_fornecedor = v_valor,');
  if n = d or (length(n) - length(d)) <> length(' valor_fornecedor = null,') + length(' valor_fornecedor = v_valor,') then raise exception 'responder_pedido_divergente'; end if;
  execute n;
  d := pg_get_functiondef('public.pedido_publico'::regproc);
  n := replace(d, '''valor_total'', v.valor_total', '''valor_total'', v.valor_fornecedor');
  if n = d then raise exception 'pedido_publico_divergente'; end if;
  execute n;
end $m$;