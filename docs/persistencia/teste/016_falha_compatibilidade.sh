#!/usr/bin/env bash
# Chamado por rodar_comercio_desativado.sh com o banco descartável já montado (sem a correção).
# Simula versões incompatíveis e prova que a aplicação/reversão não alteram NADA.
set -euo pipefail
psql_f=("$@")
proposta="$base_cega/../016_comercio_desativado.sql"
reverter="$base_cega/../016_comercio_desativado_reverter.sql"
foto="create temp table foto as select p.oid, md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f';"
confere="select case when (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f')=(select count(*) from foto) and not exists (select 1 from foto f where md5(pg_get_functiondef(f.oid))<>f.h) then 'IGUAL' else 'DIFERENTE' end;"
cenario() { # $1 nome  $2 sql que estraga  $3 arquivo  $4 texto do erro esperado
  local saida
  saida=$({ echo "begin;"; echo "$2"; echo "$foto"; echo "\\set ON_ERROR_STOP 0"; echo "savepoint s;"; echo "\\i $3"; echo "rollback to savepoint s;"; echo "\\set ON_ERROR_STOP 1"; echo "$confere"; echo "rollback;"; } | "${psql_f[@]}" -At 2>&1) || true
  echo "$saida" | grep -q "$4" || { echo "FALHOU $1: erro esperado '$4' não apareceu"; echo "$saida" | tail -5; exit 1; }
  echo "$saida" | grep -qx "IGUAL" || { echo "FALHOU $1: banco mudou"; echo "$saida" | tail -5; exit 1; }
  echo "OK $1"
}
# Estraga a 2ª função: as outras 4 não podem ser alteradas.
cenario "segunda função divergente" "select set_config('x.d', replace(pg_get_functiondef('public.conferir_codigo_funcionario(text)'::regprocedure), 'return ''pin'';', 'return  ''pin'';'), true); do \$\$ begin execute current_setting('x.d'); end \$\$;" "$proposta" "compatibilidade: public.conferir_codigo_funcionario"
# Estraga a ÚLTIMA (5ª): prova que as 4 primeiras não foram trocadas antes da conferência.
cenario "última função divergente" "select set_config('x.d', replace(pg_get_functiondef('public.funcionario_inicio(text)'::regprocedure), 'return null;', 'return  null;'), true); do \$\$ begin execute current_setting('x.d'); end \$\$;" "$proposta" "compatibilidade: public.funcionario_inicio"
# Correção já aplicada: rodar de novo recusa sem mexer.
cenario "aplicar duas vezes" "\\i $proposta" "$proposta" "compatibilidade: public._funcionario_da_chave(text) diferente"
# Reverter um banco sem a correção: recusa sem mexer.
cenario "reverter sem correção" "select 1;" "$reverter" "reversão: public._funcionario_da_chave"
# Reverter quando a 5ª foi mexida depois: recusa e as 4 primeiras continuam corrigidas.
cenario "reverter com divergência na última" "\\i $proposta
select set_config('x.d', replace(pg_get_functiondef('public.funcionario_inicio(text)'::regprocedure), 'return null;', 'return  null;'), true); do \$\$ begin execute current_setting('x.d'); end \$\$;" "$reverter" "reversão: public.funcionario_inicio"
# Dentro de uma transação externa: erro aborta tudo, inclusive comando anterior.
saida=$({ echo "begin;"; echo "create temp table marca(x int);"; echo "select set_config('x.d', replace(pg_get_functiondef('public.funcionario_inicio(text)'::regprocedure), 'return null;', 'return  null;'), true);"; echo "do \$\$ begin execute current_setting('x.d'); end \$\$;"; echo "\\set ON_ERROR_STOP 0"; echo "\\i $proposta"; echo "commit;"; echo "\\set ON_ERROR_STOP 1"; echo "select count(*) from pg_class where relname='marca' and relpersistence='t';"; echo "select position('comercio_desativado' in pg_get_functiondef('public._funcionario_da_chave(text)'::regprocedure));"; } | "${psql_f[@]}" -At 2>&1) || true
echo "$saida" | tail -2 | tr '\n' ' ' | grep -q "^0 0 " || { echo "FALHOU transação externa"; echo "$saida" | tail -6; exit 1; }
echo "OK transação externa: erro desfez tudo (commit virou rollback)"
