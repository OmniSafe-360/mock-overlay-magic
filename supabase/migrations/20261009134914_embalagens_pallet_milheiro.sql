-- Entrega 3 da análise por comércio: embalagens Pallet e Milheiro (material de construção).
-- O app mostra a cada tipo só as embalagens dele (src/lib/embalagem.ts, EMBALAGENS_POR_TIPO); o banco aceita a lista completa.
alter table public.produto_embalagens drop constraint produto_embalagens_tipo_check;
alter table public.produto_embalagens add constraint produto_embalagens_tipo_check
  check (tipo in ('Caixa', 'Fardo', 'Pacote', 'Display', 'Saco', 'Pallet', 'Milheiro'));

-- Troca só a lista dentro de _salvar_embalagens, sem mexer no resto da função.
do $mig$
declare
  f regprocedure := (select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname = '_salvar_embalagens');
  d text := pg_get_functiondef(f);
  velho text := $q$'{Caixa,Fardo,Pacote,Display,Saco}'::text[]$q$;
  novo text := $q$'{Caixa,Fardo,Pacote,Display,Saco,Pallet,Milheiro}'::text[]$q$;
begin
  if position(velho in d) = 0 then raise exception '_salvar_embalagens: lista de embalagens não encontrada'; end if;
  execute replace(d, velho, novo);
end $mig$;
