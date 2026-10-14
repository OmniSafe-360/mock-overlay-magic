#!/usr/bin/env bash
# Banco privado descartável; não aceita URL, chave ou dados do projeto oficial.
set -euo pipefail
for ferramenta in initdb pg_ctl psql python3; do
  command -v "$ferramenta" >/dev/null || { echo "Falta $ferramenta no PATH." >&2; exit 1; }
done
base_cega=$(cd "$(dirname "$0")" && pwd)
repo_cega=$(cd "$base_cega/../../.." && pwd)
temp_cega=$(mktemp -d /tmp/omni-comercio-desativado.XXXXXX)
limpar_cega() {
  if [ -f "$temp_cega/dados/postmaster.pid" ]; then pg_ctl -D "$temp_cega/dados" stop -m fast >/dev/null; fi
  rm -rf -- "$temp_cega"
}
trap limpar_cega EXIT
porta_cega=$(python3 - <<'PY'
import socket
with socket.socket() as s:
 s.bind(('127.0.0.1',0));print(s.getsockname()[1])
PY
)
initdb -D "$temp_cega/dados" -U postgres -A trust --no-locale >/dev/null
pg_ctl -D "$temp_cega/dados" -o "-p $porta_cega -k $temp_cega -c listen_addresses=''" -l "$temp_cega/servidor.log" start >/dev/null
psql_cega=(psql -h "$temp_cega" -p "$porta_cega" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q)
for arquivo in "$base_cega/000_base_simulada.sql" "$base_cega/000_base_operacional.sql"; do
  "${psql_cega[@]}" -1 -f "$arquivo" >>"$temp_cega/setup.log" 2>&1 || { tail -12 "$temp_cega/setup.log"; exit 1; }
done
for migracao in "$repo_cega"/supabase/migrations/*.sql; do
  case "$(basename "$migracao")" in
    20261010111223_*|20261010111310_*|20261010125732_*) continue ;;
  esac
  "${psql_cega[@]}" -1 -f "$migracao" >>"$temp_cega/setup.log" 2>&1 || { tail -12 "$temp_cega/setup.log"; exit 1; }
done
base_cega="$base_cega" bash "$base_cega/016_falha_compatibilidade.sh" psql -h "$temp_cega" -p "$porta_cega" -U postgres -d postgres -X -q || exit 1
"${psql_cega[@]}" -1 -f "$base_cega/../016_comercio_desativado.sql" >>"$temp_cega/setup.log" 2>&1 || { tail -12 "$temp_cega/setup.log"; exit 1; }
{ echo 'begin;'; cat "$base_cega/015_base_caixa_estoque.sql" "$base_cega/016_comercio_desativado.sql"; echo 'rollback;'; } >"$temp_cega/casos.sql"
"${psql_cega[@]}" -f "$temp_cega/casos.sql" >"$temp_cega/casos.log" 2>&1 || { tail -16 "$temp_cega/casos.log"; exit 1; }
tail -3 "$temp_cega/casos.log"
# Regressões do caixa/estoque e da contagem com a proposta aplicada.
{ echo 'begin;'; cat "$base_cega/015_base_caixa_estoque.sql" "$base_cega/015_caixa_estoque_contagens.sql"; echo 'rollback;'; } >"$temp_cega/reg.sql"
"${psql_cega[@]}" -f "$temp_cega/reg.sql" >"$temp_cega/reg.log" 2>&1 || { tail -16 "$temp_cega/reg.log"; exit 1; }
{ echo 'begin;'; cat "$base_cega/014_base_contagem_cega.sql" "$base_cega/014_contagem_cega.sql"; echo 'rollback;'; } >"$temp_cega/reg2.sql"
"${psql_cega[@]}" -f "$temp_cega/reg2.sql" >"$temp_cega/reg2.log" 2>&1 || { tail -16 "$temp_cega/reg2.log"; exit 1; }
for regressao in 005_melhorias_operacionais.sql 011_coerencia_recebimento.sql; do
  "${psql_cega[@]}" -f "$base_cega/$regressao" >>"$temp_cega/regressao.log" 2>&1 || { tail -16 "$temp_cega/regressao.log"; exit 1; }
done
"${psql_cega[@]}" -1 -f "$base_cega/../016_comercio_desativado_reverter.sql" >>"$temp_cega/setup.log" 2>&1 || { tail -12 "$temp_cega/setup.log"; exit 1; }
"${psql_cega[@]}" -f "$temp_cega/reg.sql" >"$temp_cega/reg3.log" 2>&1 || { tail -16 "$temp_cega/reg3.log"; exit 1; }
"${psql_cega[@]}" -At -c "select string_agg(md5(pg_get_functiondef(p::regprocedure)),',' order by p) from unnest(array['public._funcionario_da_chave(text)','public.conferir_codigo_funcionario(text)','public.entrar_funcionario(text,text,text)','public.funcionario_desbloquear(text,text)','public.funcionario_inicio(text)']) p" | grep -q '2dac2c308a1353655b9edd2a5d7c4142,3c9142aa6f7c603e5f40b034a44565ac,317ea1ffc7d0b8d145e32baf9f7bd82a,3c25e1b2aa53a250d4b368fb1232c8fe,a007058075eb8c944773dc84d51440b8' || { echo 'FALHOU: reversão não voltou ao md5 do banco real'; exit 1; }
echo 'OK: reversão aplicada, funções iguais ao banco real (md5) e caixa/estoque continuam iguais.'
echo 'OK: comércio desativado + regressões; banco descartado.'
