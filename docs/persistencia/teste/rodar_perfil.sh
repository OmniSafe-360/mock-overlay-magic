#!/usr/bin/env bash
# Instância local descartável. Nenhuma URL, credencial ou dado de produção.
set -euo pipefail
for ferramenta in initdb pg_ctl psql python3; do
  command -v "$ferramenta" >/dev/null || { echo "Falta $ferramenta no PATH." >&2; exit 1; }
done
base_teste=$(cd "$(dirname "$0")" && pwd)
raiz_repo=$(cd "$base_teste/../../.." && pwd)
dir_perfil=$(mktemp -d /tmp/omni-perfil-pg.XXXXXX)
limpar() {
  if [ -f "$dir_perfil/dados/postmaster.pid" ]; then pg_ctl -D "$dir_perfil/dados" stop -m fast >/dev/null; fi
  rm -rf -- "$dir_perfil"
}
trap limpar EXIT
initdb -D "$dir_perfil/dados" -U postgres -A trust >/dev/null
pg_ctl -D "$dir_perfil/dados" -o "-p 55437 -k $dir_perfil -c listen_addresses=''" -l "$dir_perfil/servidor.log" start >/dev/null
psql_perfil=(psql -h "$dir_perfil" -p 55437 -U postgres -v ON_ERROR_STOP=1 -X -q)
"${psql_perfil[@]}" -d postgres -1 -f "$base_teste/000_base_simulada.sql"
"${psql_perfil[@]}" -d postgres -1 -f "$base_teste/000_base_operacional.sql"
# Usa as políticas do repositório; não cria uma versão permissiva para o teste.
python3 - "$raiz_repo" "$dir_perfil" <<'PY'
from pathlib import Path
import sys
texto=(Path(sys.argv[1])/'supabase/migrations/20261010011935_velocidade_indices_rls.sql').read_text()
inicio=texto.index('alter policy "Editar o proprio perfil"')
fim=texto.index('alter policy "Ver os proprios papeis"',inicio)
(Path(sys.argv[2])/'politicas.sql').write_text(texto[inicio:fim])
PY
"${psql_perfil[@]}" -d postgres -1 -f "$dir_perfil/politicas.sql"
"${psql_perfil[@]}" -d postgres -f "$base_teste/009_perfil.sql"
