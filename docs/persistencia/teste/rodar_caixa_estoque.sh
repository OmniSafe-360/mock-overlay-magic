#!/usr/bin/env bash
# Banco privado descartável; não aceita URL, chave ou dados do projeto oficial.
set -euo pipefail
for ferramenta in initdb pg_ctl psql python3; do
  command -v "$ferramenta" >/dev/null || { echo "Falta $ferramenta no PATH." >&2; exit 1; }
done
base_cega=$(cd "$(dirname "$0")" && pwd)
repo_cega=$(cd "$base_cega/../../.." && pwd)
temp_cega=$(mktemp -d /tmp/omni-contagem-cega.XXXXXX)
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
# Caixa móvel: limite e baixa excluem vencidos conhecidos; dados fictícios com rollback.
{ echo 'begin;'; cat "$base_cega/015_base_caixa_estoque.sql" "$base_cega/034_caixa_validade.sql"; echo 'rollback;'; } >"$temp_cega/validade.sql"
"${psql_cega[@]}" -f "$temp_cega/validade.sql" >"$temp_cega/validade.log" 2>&1 || { tail -20 "$temp_cega/validade.log"; exit 1; }
"${psql_cega[@]}" -c 'create database caixa_validade_concorrencia template postgres;'
psql -h "$temp_cega" -p "$porta_cega" -U postgres -d caixa_validade_concorrencia -v ON_ERROR_STOP=1 -X -q -1 -f "$base_cega/015_base_caixa_estoque.sql" >"$temp_cega/validade-concorrencia.log" 2>&1
PGHOST="$temp_cega" PGPORT="$porta_cega" PGUSER=postgres PGDATABASE=caixa_validade_concorrencia PGOPTIONS='-c statement_timeout=10000' python3 "$base_cega/034_caixa_validade_concorrencia.py"
{
  echo 'begin;'
  cat "$base_cega/015_base_caixa_estoque.sql" "$base_cega/015_caixa_estoque_contagens.sql"
  echo 'rollback;'
} >"$temp_cega/casos.sql"
"${psql_cega[@]}" -f "$temp_cega/casos.sql" >"$temp_cega/casos.log" 2>&1 || { tail -16 "$temp_cega/casos.log"; exit 1; }
{ echo 'begin;'; cat "$base_cega/014_base_contagem_cega.sql" "$base_cega/014_contagem_cega.sql"; echo 'rollback;'; } >"$temp_cega/regra-anterior.sql"
"${psql_cega[@]}" -f "$temp_cega/regra-anterior.sql" >"$temp_cega/regra-anterior.log" 2>&1 || { tail -16 "$temp_cega/regra-anterior.log"; exit 1; }
{ echo 'begin;'; cat "$base_cega/015_base_caixa_estoque.sql" "$base_cega/016_f03_atomicidade.sql"; echo 'rollback;'; } >"$temp_cega/f03.sql"
"${psql_cega[@]}" -f "$temp_cega/f03.sql" >"$temp_cega/f03.log" 2>&1 || { tail -28 "$temp_cega/f03.log"; exit 1; }
{ echo 'begin;'; cat "$base_cega/015_base_caixa_estoque.sql" "$base_cega/018_vencido_por_ultimo.sql"; echo 'rollback;'; } >"$temp_cega/a1.sql"
"${psql_cega[@]}" -f "$temp_cega/a1.sql" >"$temp_cega/a1.log" 2>&1 || { tail -16 "$temp_cega/a1.log"; exit 1; }
{ echo 'begin;'; cat "$base_cega/015_base_caixa_estoque.sql" "$base_cega/033_sobra_fora_do_vencido.sql"; echo 'rollback;'; } >"$temp_cega/c10.sql"
"${psql_cega[@]}" -f "$temp_cega/c10.sql" >"$temp_cega/c10.log" 2>&1 || { tail -16 "$temp_cega/c10.log"; exit 1; }
{ echo 'begin;'; cat "$base_cega/015_base_caixa_estoque.sql" "$base_cega/021_devolucao_fiado_gaveta.sql"; echo 'rollback;'; } >"$temp_cega/a5.sql"
"${psql_cega[@]}" -f "$temp_cega/a5.sql" >"$temp_cega/a5.log" 2>&1 || { tail -16 "$temp_cega/a5.log"; exit 1; }
{ echo 'begin;'; cat "$base_cega/015_base_caixa_estoque.sql" "$base_cega/022_cancelamento_dono_caixa.sql"; echo 'rollback;'; } >"$temp_cega/a6.sql"
"${psql_cega[@]}" -f "$temp_cega/a6.sql" >"$temp_cega/a6.log" 2>&1 || { tail -16 "$temp_cega/a6.log"; exit 1; }
{ echo 'begin;'; cat "$base_cega/015_base_caixa_estoque.sql" "$base_cega/023_fechar_caixa_dono.sql"; echo 'rollback;'; } >"$temp_cega/a8.sql"
"${psql_cega[@]}" -f "$temp_cega/a8.sql" >"$temp_cega/a8.log" 2>&1 || { tail -16 "$temp_cega/a8.log"; exit 1; }
{ echo 'begin;'; cat "$base_cega/015_base_caixa_estoque.sql" "$base_cega/029_caixa_nao_controlar.sql"; echo 'rollback;'; } >"$temp_cega/b10.sql"
"${psql_cega[@]}" -f "$temp_cega/b10.sql" >"$temp_cega/b10.log" 2>&1 || { tail -16 "$temp_cega/b10.log"; exit 1; }
for regressao in 005_melhorias_operacionais.sql 011_coerencia_recebimento.sql 019_lote_outra_data.sql 020_entrega_parcial.sql 024_descartar_recebimento.sql 025_repor_mesma_regra.sql 026_conta_segue_resposta.sql 027_recebido_sem_deposito.sql 028_conferencia_outro_dia.sql 030_conector_roupa_cancelamento.sql 031_numero_unico_so_celular.sql 032_fiado_pin_depois_da_trava.sql; do
  "${psql_cega[@]}" -f "$base_cega/$regressao" >>"$temp_cega/regressao.log" 2>&1 || { tail -16 "$temp_cega/regressao.log"; exit 1; }
done
# As disputas usam apenas os dados fictícios neste servidor privado; o EXIT descarta tudo.
"${psql_cega[@]}" -1 -f "$base_cega/015_base_caixa_estoque.sql" >"$temp_cega/concorrencia.log" 2>&1 || { tail -16 "$temp_cega/concorrencia.log"; exit 1; }
PGHOST="$temp_cega" PGPORT="$porta_cega" PGUSER=postgres PGDATABASE=postgres PGOPTIONS='-c statement_timeout=10000' python3 "$base_cega/015_caixa_estoque_concorrencia.py"
PGHOST="$temp_cega" PGPORT="$porta_cega" PGUSER=postgres PGDATABASE=postgres PGOPTIONS='-c statement_timeout=10000' python3 "$base_cega/016_f03_concorrencia.py"
echo 'OK A1: lote vencido sai por último (venda, perda, acerto, caixa).'
echo 'OK A2: lote com outra data não prende a entrega.'
echo 'OK A4: entrega em duas vezes; o dono encerra o resto.'
echo 'OK A5: devolução do fiado sai da gaveta; fechamento sem falta falsa.'
echo 'OK A6: dono cancela com o caixa aberto; o caixa devolve da gaveta e o fechamento bate.'
echo "OK A8: dono fecha o caixa que ficou aberto com o funcionário sem o Caixa ou bloqueado."
echo "OK A10: dono encerra a contagem de recebimento largada; nada entra no estoque."
echo "OK B1: Repor da equipe = lista da equipe = Para repor do dono."
echo "OK B5: conta a pagar segue a nova resposta do fornecedor; o que o dono corrigiu e a conta paga ficam."
echo "OK B8: mercadoria recebida aparece no depósito também quando o produto não tinha essa área."
echo "OK B9: contagem do depósito começada em outro dia recomeça do zero."
echo "OK B10: item \"não controlar\" (sacola, serviço) vendido no caixa do celular sem tirar do estoque."
echo "OK B12: Omni Conector sem \"faltou\" falso de roupa sem tamanho e sem venda cancelada vazia de nota antiga."
echo "OK C7: PIN do fiado do cliente volta a ter 5 tentativas depois da trava."
echo "OK C10: sobra da contagem não entra em lote vencido."
echo 'OK: bloqueio do Caixa, contagens vinculadas, decisão do dono, idempotência, RLS e regressões; banco descartado.'
