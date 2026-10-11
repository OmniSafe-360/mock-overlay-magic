-- Checklist funcional, item 22: o preço estimado por unidade de venda era guardado com 2 casas
-- (caixa de R$ 10,00 com 12 → R$ 0,83 → total R$ 9,96), e o total do pedido salvo ficava alguns centavos
-- diferente do mostrado na montagem. Passa a guardar 8 casas; os valores antigos continuam iguais.
alter table public.pedido_itens alter column preco_estimado type numeric(18,8);
