#!/usr/bin/env bash
# Testa a cadeia completa em uma instância própria, sem URL nem credenciais de produção.
set -euo pipefail
if [ "$(id -u)" = 0 ]; then
  echo 'Execute como usuário comum: o PostgreSQL não inicia como root.' >&2
  exit 1
fi
for ferramenta in initdb pg_ctl psql; do
  command -v "$ferramenta" >/dev/null || { echo "Falta $ferramenta no PATH (PostgreSQL 17)." >&2; exit 1; }
done
base_teste=$(cd "$(dirname "$0")" && pwd)
raiz_repo=$(cd "$base_teste/../../.." && pwd)
dir_teste=$(mktemp -d /tmp/omni-operacional.XXXXXX)
porta_teste=55434
limpar() {
  if [ -f "$dir_teste/dados/postmaster.pid" ]; then
    pg_ctl -D "$dir_teste/dados" stop -m fast >/dev/null
  fi
  rm -rf -- "$dir_teste"
}
trap limpar EXIT
initdb -D "$dir_teste/dados" -U postgres -A trust >/dev/null
# Só socket privado. O número da porta não abre um serviço de rede.
pg_ctl -D "$dir_teste/dados" -o "-p $porta_teste -k $dir_teste -c listen_addresses=''" -l "$dir_teste/servidor.log" start >/dev/null
psql_teste=(psql -h "$dir_teste" -p "$porta_teste" -U postgres -v ON_ERROR_STOP=1 -X -q)
"${psql_teste[@]}" -d postgres -c 'create database teste'
"${psql_teste[@]}" -d teste -1 -f "$base_teste/000_base_simulada.sql"
"${psql_teste[@]}" -d teste -1 -f "$base_teste/000_base_operacional.sql"
for migracao in "$raiz_repo"/supabase/migrations/*.sql; do
  "${psql_teste[@]}" -d teste -1 -f "$migracao"
done
"${psql_teste[@]}" -d teste -f "$base_teste/005_melhorias_operacionais.sql"
echo 'OK: migrações e testes operacionais; dados de teste desfeitos.'
