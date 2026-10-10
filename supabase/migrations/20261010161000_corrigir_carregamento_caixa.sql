-- As consultas do Caixa validam a chave por _funcionario_da_chave, que registra
-- ultimo_uso/ultimo_acesso. STABLE faz o PostgREST usar uma transação somente
-- leitura e esse registro falha com 25006, impedindo abrir o Caixa.
-- Corrige apenas a classificação; corpos, permissões e regras ficam iguais.
alter function public.caixa_produtos(text) volatile;
alter function public.caixa_clientes_fiado(text) volatile;

-- O PostgREST precisa reler a classificação antes da próxima chamada RPC.
notify pgrst, 'reload schema';
