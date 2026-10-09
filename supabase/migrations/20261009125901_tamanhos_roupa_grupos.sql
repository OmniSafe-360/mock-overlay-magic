-- Entrega 3 das listas: tamanhos de roupa em grupos (Letras, Números, Infantil, Calçados, Tamanho único).
-- A lista fica numa função própria; salvar_produto passa a usá-la no lugar da lista fixa antiga
-- (P, M, G, GG, 36 a 44 — todos continuam válidos). A lista do app fica em src/lib/listas.ts (GRUPOS_TAMANHO).

create or replace function public.tamanho_valido(_t text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(_t, '') = any ('{PP,P,M,G,GG,XG,XXG,34,36,38,40,42,44,46,48,50,52,54,56,RN,1,2,3,4,6,8,10,12,14,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,35,37,39,41,43,45,Único}'::text[])
$$;
revoke execute on function public.tamanho_valido(text) from public, anon, authenticated;

-- Troca só a linha da lista fixa dentro de salvar_produto, sem mexer no resto da função.
do $mig$
declare
  d text := pg_get_functiondef('public.salvar_produto(jsonb)'::regprocedure);
  velho text := $q$if not (coalesce(x->>'tamanho', '') = any ('{P,M,G,GG,36,38,40,42,44}'::text[])) then$q$;
  novo text := $q$if not public.tamanho_valido(x->>'tamanho') then$q$;
begin
  if position(velho in d) = 0 then raise exception 'salvar_produto: lista de tamanhos não encontrada'; end if;
  execute replace(d, velho, novo);
end $mig$;
