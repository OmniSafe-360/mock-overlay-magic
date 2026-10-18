-- C7 (checklist 3): PIN do fiado do cliente. Depois que a trava de 15 minutos acaba,
-- as tentativas voltam a zero; antes um único erro travava de novo e a página dizia "0 tentativas".
do $$
declare
  d text; novo text;
  antigo constant text := $a$  if a.travado_ate > now() then raise exception 'travado' using errcode = '42501'; end if;
$a$;
  trocado constant text := $b$  if a.travado_ate > now() then raise exception 'travado' using errcode = '42501'; end if;
  if a.travado_ate is not null then
    -- a trava já acabou: começa de novo com 5 tentativas
    update fiado_acessos set tentativas = 0, travado_ate = null where id = a.id;
    a.tentativas := 0;
  end if;
$b$;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'fiado_publico_entrar';
  if md5(d) <> 'e3df4dc9f9c165e2e7c399b5e691c837' then raise exception 'fiado_publico_entrar diferente do esperado'; end if;
  if (length(d) - length(replace(d, antigo, ''))) / length(antigo) <> 1 then raise exception 'trecho não encontrado uma vez só'; end if;
  novo := replace(d, antigo, trocado);
  execute novo;
end $$;
