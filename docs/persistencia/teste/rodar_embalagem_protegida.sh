#!/usr/bin/env bash
# Etapa 3 — banco privado descartável; não aceita URL, chave ou dados do projeto oficial.
set -euo pipefail
base=$(cd "$(dirname "$0")" && pwd); repo=$(cd "$base/../../.." && pwd)
tmp=$(mktemp -d /tmp/omni-embalagem.XXXXXX)
limpar() { [ -f "$tmp/dados/postmaster.pid" ] && pg_ctl -D "$tmp/dados" stop -m fast >/dev/null; rm -rf -- "$tmp"; }
trap limpar EXIT
porta=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1])")
initdb -D "$tmp/dados" -U postgres -A trust --no-locale >/dev/null
pg_ctl -D "$tmp/dados" -o "-p $porta -k $tmp -c listen_addresses=''" -l "$tmp/servidor.log" start >/dev/null
con=(psql -h "$tmp" -p "$porta" -U postgres -d postgres)
p=("${con[@]}" -v ON_ERROR_STOP=1 -X -q)
falha() { tail -15 "$1"; exit 1; }
for f in "$base/000_base_simulada.sql" "$base/000_base_operacional.sql"; do "${p[@]}" -1 -f "$f" >>"$tmp/setup.log" 2>&1 || falha "$tmp/setup.log"; done
for m in "$repo"/supabase/migrations/*.sql; do
  case "$(basename "$m")" in 20261010111223_*|20261010111310_*|20261010125732_*|20261016133627_*) continue ;; esac  # 20261016133627 = esta proteção (aplicada abaixo)
  "${p[@]}" -1 -f "$m" >>"$tmp/setup.log" 2>&1 || falha "$tmp/setup.log"
done
casos() { { echo 'begin;'; cat "$base/015_base_caixa_estoque.sql" "$base/017_embalagem_protegida.sql"; echo 'rollback;'; } >"$tmp/c.sql"; "${p[@]}" -f "$tmp/c.sql" >"$tmp/c.log" 2>&1; }
# Sem a proteção os casos TÊM que falhar (prova de que o teste enxerga o problema).
if casos; then echo 'FALHOU: casos passaram sem a proteção'; exit 1; fi
echo 'OK: sem a proteção os casos falham (o problema existe).'
"${p[@]}" -1 -f "$base/../017_embalagem_protegida.sql" >>"$tmp/setup.log" 2>&1 || falha "$tmp/setup.log"
# Repetir a aplicação: recusada sem alterar nada.
if "${p[@]}" -1 -f "$base/../017_embalagem_protegida.sql" >"$tmp/rep.log" 2>&1; then echo 'FALHOU: repetição aceita'; exit 1; fi
grep -q 'proteção já aplicada' "$tmp/rep.log" || falha "$tmp/rep.log"
echo 'OK: repetir a migração é recusado sem alterar nada.'
casos || falha "$tmp/c.log"; grep -o "OK: 017[^|]*" "$tmp/c.log"
# Regressões existentes com a proteção ligada.
for par in "015_base_caixa_estoque.sql 015_caixa_estoque_contagens.sql" "014_base_contagem_cega.sql 014_contagem_cega.sql"; do
  set -- $par; { echo 'begin;'; cat "$base/$1" "$base/$2"; echo 'rollback;'; } >"$tmp/r.sql"
  "${p[@]}" -f "$tmp/r.sql" >"$tmp/r.log" 2>&1 || falha "$tmp/r.log"
done
for r in 005_melhorias_operacionais.sql 011_coerencia_recebimento.sql; do "${p[@]}" -f "$base/$r" >>"$tmp/reg.log" 2>&1 || falha "$tmp/reg.log"; done
echo 'OK: regressões caixa/estoque, contagem, operacionais e recebimento.'
# Concorrência com conexões reais (dados fictícios em banco descartável).
"${p[@]}" -1 -f "$base/015_base_caixa_estoque.sql" >"$tmp/b.log" 2>&1 || falha "$tmp/b.log"
python3 "$base/017_embalagem_concorrencia.py" "${con[@]}"
# Reversão: volta ao comportamento anterior.
"${p[@]}" -1 -f "$base/../017_embalagem_protegida_reverter.sql" >>"$tmp/setup.log" 2>&1 || falha "$tmp/setup.log"
[ "$("${p[@]}" -At -c "select count(*) from pg_trigger where tgname like '%embalagem%' and not tgisinternal and tgname<>'embalagens_codigo'")" = 0 ] || { echo 'FALHOU: gatilhos ficaram'; exit 1; }
"${p[@]}" -c "update produto_embalagens set quantidade=quantidade where false" >/dev/null
echo 'OK: reversão retirou gatilhos e funções; banco descartado.'
