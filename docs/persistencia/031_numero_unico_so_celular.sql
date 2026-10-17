-- PREPARADA, NÃO APLICADA (precisa da confirmação do dono: apaga um índice e cria outro no lugar).
-- Achado no teste da B12 (checklist funcional 3, 17/10/2026): o número único da A6 (vendas_comercio_numero_unico,
-- comercio + número) vale para todas as vendas, inclusive as notas do Omni Conector, que trazem o número da nota fiscal.
-- Duas notas com o mesmo número (séries diferentes, dois computadores de caixa ou uma venda do celular com o mesmo
-- número) fazem a segunda ser recusada, e o Conector tenta de novo para sempre ("Sem internet ou o Omni não respondeu").
-- A regra da A6 é do caixa do celular, então o número único passa a valer só para ele.
-- Em 17/10/2026 só existiam 3 vendas, todas do celular, sem número repetido: ninguém afetado ainda.
-- Reversão: create unique index vendas_comercio_numero_unico on public.vendas (comercio_id, numero) where numero is not null;
--           drop index public.vendas_celular_numero_unico;
create unique index vendas_celular_numero_unico on public.vendas (comercio_id, numero) where numero is not null and origem = 'celular';
drop index public.vendas_comercio_numero_unico;
