#!/usr/bin/env bash
# Sobe um PostgreSQL descartável em /tmp (nunca toca produção) e roda todos os testes.
set -euo pipefail
if [ "$(id -u)" = 0 ]; then rm -rf /tmp/omni_pg; exec setpriv --reuid=65534 --regid=65534 --clear-groups env HOME=/tmp bash "$0" "$@"; fi
D=$(cd "$(dirname "$0")" && pwd)
PGD=/tmp/omni_pg; PORT=55432
rm -rf "$PGD"; initdb -D "$PGD" -U postgres -A trust >/dev/null
pg_ctl -D "$PGD" -o "-p $PORT -k /tmp" -l /tmp/omni_pg.log start >/dev/null
trap 'pg_ctl -D "$PGD" stop -m fast >/dev/null' EXIT
P="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -At"
$P -c "create database t" postgres
$P -d t -f "$D/000_base_simulada.sql"
$P -d t -f "$D/../001_estoque_proposta.sql"
echo "== migração aplicada no banco de teste =="
$P -d t -f "$D/002_testes.sql" | grep -E '^(OK|CONTAGEM)'

echo "== prova: a suíte para quando o verificador reprova =="
for caso in "select t_erro(\$\$select 1\$\$, 'quantidade_vazia')" \
            "select t_erro(\$\$select 1/0\$\$, 'quantidade_vazia')" \
            "select t_erro(\$\$do \$x\$ begin raise exception 'quantidade_vazia' using errcode='23514'; end \$x\$\$\$, 'quantidade_vazia')"; do
  if $P -d t -c "$caso" 2>/tmp/prova.err; then echo "FALHOU: psql aceitou: $caso"; exit 1; fi
  grep -q 'FALHOU' /tmp/prova.err && echo "OK suíte interrompida: $(grep -o 'FALHOU.*' /tmp/prova.err | head -1)"
done
$P -d t -c "select t_erro(\$\$do \$x\$ begin raise exception 'quantidade_vazia' using errcode='22023'; end \$x\$\$\$, 'quantidade_vazia')" >/dev/null && echo "OK erro correto passa no psql"

echo "== concorrência =="
A=$($P -d t -c "select u('A')")
COM="set role authenticated; select set_config('request.jwt.claim.sub','$A',false);"
PAY="t_p('c1','C1','cm1','Pacote',null,'[{\"area\":\"deposito\",\"contagem\":{\"quantidade\":30}}]')"
# 1) mesmo id em paralelo: a 2ª espera e devolve o mesmo resultado
( $P -d t -c "begin; $COM select salvar_produto($PAY); select pg_sleep(1.5); commit;" > /tmp/c1.out ) &
sleep 0.4
$P -d t -c "$COM select salvar_produto($PAY);" | tail -1 > /tmp/c2.out
wait
$P -d t -c "select t_ok((select sum(quantidade) from saldos where produto_id=u('C1'))=30 and (select count(*) from contagens where produto_id=u('C1'))=1, 'mesmo id simultaneo nao duplica')"
cmp -s <(tail -1 /tmp/c1.out | tail -c +1) <(cat /tmp/c2.out) || grep -q contagens_registradas /tmp/c2.out
echo "OK segunda chamada simultanea devolveu: $(cat /tmp/c2.out)"
# 2) ids diferentes em paralelo para o mesmo produto novo: a 2ª falha com erro explícito
PAY2="t_p('c3','C2','cm1','Pacote',null,'[{\"area\":\"deposito\",\"contagem\":{\"quantidade\":30}}]')"
PAY3="t_p('c4','C2','cm1','Pacote',null,'[{\"area\":\"deposito\",\"contagem\":{\"quantidade\":30}}]')"
( $P -d t -c "begin; $COM select salvar_produto($PAY2); select pg_sleep(1.5); commit;" >/dev/null ) &
sleep 0.4
if $P -d t -c "$COM select salvar_produto($PAY3);" 2>/tmp/c4.err; then echo "FALHOU: sucesso falso"; exit 1; fi
wait
grep -q contagem_ja_registrada /tmp/c4.err && echo "OK id diferente simultaneo: erro explícito (contagem_ja_registrada)"
$P -d t -c "select t_ok((select sum(quantidade) from saldos where produto_id=u('C2'))=30 and not exists (select 1 from operacoes where id=u('c4')), 'sem estoque duplicado nem operacao falsa')"
# 3) primeira transação desfeita: a repetição grava normalmente
( $P -d t -c "begin; $COM select salvar_produto(t_p('c5','C3','cm1','Pacote',null,'[{\"area\":\"deposito\",\"contagem\":{\"quantidade\":3}}]')); select pg_sleep(1); rollback;" >/dev/null ) &
sleep 0.3
$P -d t -c "$COM select salvar_produto(t_p('c5','C3','cm1','Pacote',null,'[{\"area\":\"deposito\",\"contagem\":{\"quantidade\":3}}]'));" >/dev/null
wait
$P -d t -c "select t_ok((select sum(quantidade) from saldos where produto_id=u('C3'))=3, 'tentativa desfeita e repetida grava uma vez')"
echo "== todos os testes passaram =="
