#!/usr/bin/env bash
# Instância privada descartável: não recebe URL, chave nem dados de produção.
set -euo pipefail
for ferramenta in initdb pg_ctl psql postgrest python3; do
  command -v "$ferramenta" >/dev/null || { echo "Falta $ferramenta no PATH." >&2; exit 1; }
done
base_teste=$(cd "$(dirname "$0")" && pwd)
raiz_repo=$(cd "$base_teste/../../.." && pwd)
dir_caixa=$(mktemp -d /tmp/omni-caixa-http.XXXXXX)
pid_api=''
limpar() {
  if [ -n "$pid_api" ]; then kill "$pid_api" 2>/dev/null || true; wait "$pid_api" 2>/dev/null || true; fi
  if [ -f "$dir_caixa/dados/postmaster.pid" ]; then pg_ctl -D "$dir_caixa/dados" stop -m fast >/dev/null; fi
  rm -rf -- "$dir_caixa"
}
trap limpar EXIT
initdb -D "$dir_caixa/dados" -U postgres -A trust >/dev/null
pg_ctl -D "$dir_caixa/dados" -o "-p 55438 -k $dir_caixa -c listen_addresses=''" -l "$dir_caixa/servidor.log" start >/dev/null
psql_caixa=(psql -h "$dir_caixa" -p 55438 -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q)
for arquivo in "$base_teste/000_base_simulada.sql" "$base_teste/000_base_operacional.sql"; do
  "${psql_caixa[@]}" -1 -f "$arquivo" >>"$dir_caixa/setup.log" 2>&1
done
for migracao in "$raiz_repo"/supabase/migrations/*.sql; do
  case "$(basename "$migracao")" in
    # Catálogo externo não participa do Caixa e exige a extensão http do Supabase.
    20261010111223_*|20261010111310_*|20261010125732_*) continue ;;
    20261010161000_corrigir_carregamento_caixa.sql) continue ;;
  esac
  "${psql_caixa[@]}" -1 -f "$migracao" >>"$dir_caixa/setup.log" 2>&1
done
"${psql_caixa[@]}" -f "$base_teste/010_caixa_carregamento.sql" >>"$dir_caixa/setup.log" 2>&1
func_sql="select jsonb_agg(jsonb_build_object('nome',p.proname,'corpo',p.prosrc,'permissoes',p.proacl,'config',p.proconfig,'definer',p.prosecdef) order by p.proname) from pg_proc p where p.oid in ('public.caixa_produtos(text)'::regprocedure,'public.caixa_clientes_fiado(text)'::regprocedure)"
antes_func=$("${psql_caixa[@]}" -Atc "$func_sql")
estoque_sql="select jsonb_build_object('produtos',(select jsonb_agg(p order by id) from produtos p),'variacoes',(select jsonb_agg(v order by id) from produto_variacoes v),'saldos',(select jsonb_agg(s order by id) from saldos s),'movimentos',(select jsonb_agg(m order by id) from movimentos m),'contagens',(select jsonb_agg(c order by id) from contagens c),'lotes',(select jsonb_agg(l order by id) from lotes l),'operacoes',(select jsonb_agg(o order by id) from operacoes o),'vendas',(select jsonb_agg(v order by id) from vendas v))"
antes_estoque=$("${psql_caixa[@]}" -Atc "$estoque_sql")
porta_api=$(python3 - <<'PY'
import socket
with socket.socket() as s:
    s.bind(('127.0.0.1',0))
    print(s.getsockname()[1])
PY
)
cat >"$dir_caixa/api.conf" <<CONF
db-uri = "postgresql://postgres@/postgres?host=$dir_caixa&port=55438"
db-schemas = "public"
db-anon-role = "anon"
server-host = "127.0.0.1"
server-port = $porta_api
CONF
postgrest "$dir_caixa/api.conf" >"$dir_caixa/api.log" 2>&1 &
pid_api=$!
url_api="http://127.0.0.1:$porta_api"
python3 - "$url_api" <<'PY'
import sys,time,urllib.request,urllib.error
for _ in range(100):
    try:
        urllib.request.urlopen(sys.argv[1]+'/',timeout=1).close()
        break
    except (OSError,urllib.error.HTTPError):
        time.sleep(.1)
else:
    raise RuntimeError('PostgREST não ficou pronto')
PY
python3 "$base_teste/010_caixa_carregamento.py" "$url_api" antes
"${psql_caixa[@]}" -1 -f "$raiz_repo/supabase/migrations/20261010161000_corrigir_carregamento_caixa.sql"
python3 "$base_teste/010_caixa_carregamento.py" "$url_api" depois
"${psql_caixa[@]}" <<'SQL'
begin;
create function pg_temp.recusa(s text) returns void language plpgsql as $$
declare st text;
begin
  begin execute s;
  exception when others then
    get stacked diagnostics st=returned_sqlstate;
  end;
  if st is distinct from '42501' then raise exception 'FALHOU: gravação direta deveria ser recusada, veio %',st; end if;
end $$;
set local role anon;
select pg_temp.recusa('select * from saldos');
select pg_temp.recusa('insert into produtos default values');
select pg_temp.recusa('insert into movimentos default values');
select pg_temp.recusa('select public._funcionario_caixa(repeat(''c'',64))');
set local role authenticated;
select pg_temp.recusa('insert into produtos default values');
select pg_temp.recusa('insert into saldos default values');
select pg_temp.recusa('insert into movimentos default values');
select pg_temp.recusa('select public._funcionario_caixa(repeat(''c'',64))');
rollback;
SQL
[ "$antes_func" = "$("${psql_caixa[@]}" -Atc "$func_sql")" ] || { echo 'FALHOU: corpo ou segurança das funções mudou.' >&2; exit 1; }
[ "$antes_estoque" = "$("${psql_caixa[@]}" -Atc "$estoque_sql")" ] || { echo 'FALHOU: carga/abertura alterou produto, venda, estoque ou histórico.' >&2; exit 1; }
"${psql_caixa[@]}" -c "do \$\$ begin
  if (select count(*) from caixa_turnos)<>1 or (select sum(quantidade) from saldos) is distinct from 60 then
    raise exception 'FALHOU: abertura duplicou turno ou mudou estoque';
  end if;
end \$\$;"
echo 'OK: corpos, permissões, produtos, estoque e histórico preservados; instância descartada ao terminar.'
