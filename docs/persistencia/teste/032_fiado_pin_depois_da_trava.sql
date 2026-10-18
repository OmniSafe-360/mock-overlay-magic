-- C7 (checklist 3): PIN do fiado do cliente depois que a trava de 15 minutos acaba.
-- Banco descartável com as migrações; tudo é desfeito. Nunca usar produção.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('c7-'||t)::uuid $$;
create function pg_temp.ok(b boolean, nome text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', nome; end if; return 'OK '||nome; end $$;
insert into auth.users values(pg_temp.u('dono'),'c7@teste.local');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('loja'),pg_temp.u('dono'),'mercado','Mercado simulado C7');
insert into clientes_fiado(id,comercio_id,nome,telefone) values(pg_temp.u('cli'),pg_temp.u('loja'),'Cliente C7','14999998888');
insert into fiado_acessos(comercio_id,cliente_id,token,pin_hash,tentativas,travado_ate)
  values(pg_temp.u('loja'),pg_temp.u('cli'),repeat('a',64),extensions.crypt('2580',extensions.gen_salt('bf',4)),5,now() - interval '1 minute');
-- A trava já acabou: um PIN errado conta como a 1ª tentativa (restam 4) e não trava de novo.
select pg_temp.ok((public.fiado_publico_entrar(repeat('a',64),null,'1111')->>'restam')::int = 4, 'depois da trava, restam 4');
select pg_temp.ok((select tentativas = 1 and travado_ate is null from fiado_acessos where token = repeat('a',64)), 'não trava de novo no 1º erro');
-- Mais 4 erros travam de novo (5 no total).
select public.fiado_publico_entrar(repeat('a',64),null,'1111') from generate_series(1,4);
select pg_temp.ok((select travado_ate > now() from fiado_acessos where token = repeat('a',64)), '5 erros travam de novo');
-- Durante a trava continua recusando.
do $$ begin
  perform public.fiado_publico_entrar(repeat('a',64),null,'2580');
  raise exception 'FALHOU: entrou travado';
exception when insufficient_privilege then null; end $$;
-- Trava vencida + PIN certo: entra e zera.
update fiado_acessos set travado_ate = now() - interval '1 second' where token = repeat('a',64);
select pg_temp.ok((public.fiado_publico_entrar(repeat('a',64),null,'2580')->>'ok')::boolean, 'PIN certo depois da trava entra');
select pg_temp.ok((select tentativas = 0 from fiado_acessos where token = repeat('a',64)), 'tentativas zeradas');
select 'OK 032: PIN do fiado volta a ter 5 tentativas depois da trava' as resultado;
rollback;
