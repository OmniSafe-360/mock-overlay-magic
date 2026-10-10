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
  if [ "$(basename "$migracao")" = '20261010150302_codigos_mercado_ean_upc.sql' ]; then
    # Cópia local anterior à migração: demonstra que duplicados antigos interrompem tudo.
    "${psql_teste[@]}" -d postgres -c 'create database codigos_antigos template teste'
    "${psql_teste[@]}" -d codigos_antigos -f "$base_teste/007_codigos_antigos.sql"
    if "${psql_teste[@]}" -d codigos_antigos -1 -f "$migracao" >"$dir_teste/duplicados.log" 2>&1; then
      echo 'FALHOU: migração aceitou equivalentes antigos.' >&2; exit 1
    fi
    rg -q 'codigos_ean_upc_equivalentes_existentes' "$dir_teste/duplicados.log"
    "${psql_teste[@]}" -d codigos_antigos -c "do \$\$ begin
      if exists(select 1 from information_schema.columns where table_name='codigos_barras' and column_name='ean_upc_mercado')
        or (select count(*) from produtos)<>2 or (select count(*) from codigos_barras)<>2
        or (select sum(quantidade) from saldos)<>10 or (select count(*) from movimentos)<>1 then
        raise exception 'FALHOU: falha de migração alterou os dados antigos'; end if;
      end \$\$;"
    echo 'OK: equivalentes antigos recusados; migração desfeita e dados preservados.'
  fi
  "${psql_teste[@]}" -d teste -1 -f "$migracao"
done
"${psql_teste[@]}" -d teste -f "$base_teste/005_melhorias_operacionais.sql"
"${psql_teste[@]}" -d teste -f "$base_teste/006_codigos_mercado.sql"
"${psql_teste[@]}" -d teste -f "$base_teste/008_codigos_concorrencia.sql"

# Duas conexões reais, com pedidos distintos e códigos equivalentes.
cat >"$dir_teste/tx1.sql" <<'SQL'
begin;
select set_config('request.jwt.claim.sub',md5('sim-dono')::uuid::text,true);
set local role authenticated;
select salvar_cadastro(t_cadastro_codigos('sim-1','0036000291452'));
select pg_sleep(3);
commit;
SQL
cat >"$dir_teste/tx2.sql" <<'SQL'
\set VERBOSITY verbose
begin;
select set_config('request.jwt.claim.sub',md5('sim-dono')::uuid::text,true);
set local role authenticated;
select salvar_cadastro(t_cadastro_codigos('sim-2','036000291452'));
commit;
SQL
PGAPPNAME=omni-codigos-tx1 "${psql_teste[@]}" -d teste -f "$dir_teste/tx1.sql" >"$dir_teste/tx1.log" 2>&1 &
pid_tx1=$!
pronta=0
for ((i=0;i<100;i++)); do
  if [ "$("${psql_teste[@]}" -d teste -Atc "select count(*) from pg_stat_activity where application_name='omni-codigos-tx1' and wait_event='PgSleep'")" = 1 ]; then pronta=1; break; fi
  sleep 0.02
done
[ "$pronta" = 1 ] || { echo 'FALHOU: primeira conexão não chegou à pausa após salvar.' >&2; exit 1; }
PGAPPNAME=omni-codigos-tx2 "${psql_teste[@]}" -d teste -f "$dir_teste/tx2.sql" >"$dir_teste/tx2.log" 2>&1 &
pid_tx2=$!
esperou=0
for ((i=0;i<100;i++)); do
  if [ "$("${psql_teste[@]}" -d teste -Atc "select count(*) from pg_stat_activity where application_name='omni-codigos-tx2' and wait_event_type='Lock'")" = 1 ]; then esperou=1; break; fi
  sleep 0.02
done
[ "$esperou" = 1 ] || { echo 'FALHOU: segunda conexão não esperou a primeira.' >&2; exit 1; }
wait "$pid_tx1"
resultado_tx2=0
wait "$pid_tx2" || resultado_tx2=$?
[ "$resultado_tx2" != 0 ] || { echo 'FALHOU: segundo equivalente foi gravado.' >&2; exit 1; }
rg -q '23505:.*codigo_em_uso: 036000291452' "$dir_teste/tx2.log"
"${psql_teste[@]}" -d teste -c "do \$\$ begin
  if (select count(*) from produtos where comercio_id=md5('sim-mercado')::uuid)<>1
    or (select count(*) from codigos_barras where comercio_id=md5('sim-mercado')::uuid)<>1
    or (select count(*) from operacoes where comercio_id=md5('sim-mercado')::uuid)<>2 then
    raise exception 'FALHOU: concorrência duplicou cadastros ou deixou operação pela metade'; end if;
  end \$\$;"
echo 'OK: segunda conexão esperou, recebeu codigo_em_uso e não deixou cadastro parcial.'
echo 'OK: migrações e testes operacionais; dados de teste desfeitos.'
