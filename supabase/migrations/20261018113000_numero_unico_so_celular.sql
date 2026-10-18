-- 031 (achado no teste da B12, checklist funcional 3): o número único da A6 (comercio + número) valia para
-- todas as vendas, inclusive as notas do Omni Conector, que trazem o número da nota fiscal. Duas notas com o
-- mesmo número (séries diferentes ou dois computadores de caixa) faziam a segunda ser recusada para sempre.
-- O número único passa a valer só para o caixa do celular, onde o próprio Omni numera as vendas.
-- Aplicado pelo dono no painel do Supabase em 18/10/2026 (o ambiente do Claude pede confirmação para apagar
-- índice); registrado como a versão 20261018113000. Antes: só 5 vendas, todas do celular, sem número repetido.
create unique index if not exists vendas_celular_numero_unico on public.vendas (comercio_id, numero) where numero is not null and origem = 'celular';
drop index if exists public.vendas_comercio_numero_unico;
