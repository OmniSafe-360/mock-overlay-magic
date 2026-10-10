-- Fase 3.1 — tipos de movimento das vendas pelo caixa (separado porque um valor novo de enum só pode ser usado depois de gravado).
alter type public.tipo_movimento add value if not exists 'venda';
alter type public.tipo_movimento add value if not exists 'cancelamento_venda';
