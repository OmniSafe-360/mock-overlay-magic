-- A10, ajuste do Codex (PR #197): produto que ficou "separado para o dono" (inconsistente ou fora do pedido) numa contagem
-- que o dono encerrou não pode continuar travando a reposição ("estoque não liberado"). _motivo_sem_reposicao passa a
-- ignorar itens de contagens descartadas, como _fechar_pedido_recebido e _pedido_recebe_resto.
do $$
declare
  v text := pg_get_functiondef('public._motivo_sem_reposicao(uuid,uuid)'::regprocedure);
  a text := $a$and ri.situacao in ('inconsistente', 'fora_do_pedido')$a$;
  b text := $b$and ri.situacao in ('inconsistente', 'fora_do_pedido')
          and not exists (select 1 from recebimentos r0 where r0.id = ri.recebimento_id and r0.situacao = 'descartado')$b$;
begin
  -- Duas versões conferidas: a do banco oficial (reformatada) e a do arquivo de 10/10 (bancos de teste); a lógica é a mesma.
  if md5(v) not in ('12d4ac276493e2323536dee24ff171a9', 'f0dc298d5206e28f45d9d83478a3df80') or (length(v) - length(replace(v, a, ''))) / length(a) <> 1 then
    raise exception 'versao_inesperada: _motivo_sem_reposicao mudou desde a conferência';
  end if;
  execute replace(v, a, b);
end $$;
