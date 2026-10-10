-- SOMENTE teste descartável. A réplica antiga tem apenas o id de profiles.
-- Acrescenta aqui os campos já existentes nos tipos do app; não é migração de produção.
begin;
alter table public.profiles add column nome text, add column avatar_url text;
grant select,update on public.profiles to authenticated;
grant select on public.profiles to anon;
insert into auth.users(id,email) values
  (md5('perfil-a')::uuid,'a@exemplo.com'),(md5('perfil-b')::uuid,'b@exemplo.com'),(md5('perfil-c')::uuid,'c@exemplo.com');
insert into public.profiles(id,nome) values (md5('perfil-a')::uuid,'Monica'),(md5('perfil-b')::uuid,'Outro dono');
select set_config('request.jwt.claim.sub',md5('perfil-a')::uuid::text,true);
set local role authenticated;
do $$
declare r public.profiles%rowtype; n integer;
begin
  update public.profiles set nome='Maria Souza',avatar_url='data:image/jpeg;base64,/9j/2Q=='
    where id=md5('perfil-a')::uuid returning * into r;
  if r.nome is distinct from 'Maria Souza' or r.avatar_url is distinct from 'data:image/jpeg;base64,/9j/2Q==' then
    raise exception 'FALHOU: perfil próprio não foi confirmado'; end if;
  if (select count(*) from public.profiles)<>1 then raise exception 'FALHOU: leitura de outro perfil'; end if;
  update public.profiles set nome='Nome indevido',avatar_url='data:image/jpeg;base64,/9j/2Q==' where id=md5('perfil-b')::uuid;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'FALHOU: edição do perfil de outro dono'; end if;
  begin
    update public.profiles set id=md5('perfil-c')::uuid where id=md5('perfil-a')::uuid;
    raise exception 'FALHOU: perfil passado para outra pessoa';
  exception when insufficient_privilege then null; end;
  update public.profiles set avatar_url=null where id=md5('perfil-a')::uuid returning * into r;
  if r.avatar_url is not null or r.nome<>'Maria Souza' then raise exception 'FALHOU: remoção da foto alterou o nome'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  if (select count(*) from public.profiles)<>0 then raise exception 'FALHOU: visitante leu perfil'; end if;
  begin
    update public.profiles set nome='Visitante' where id=md5('perfil-a')::uuid;
    raise exception 'FALHOU: visitante editou perfil';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from public.profiles where id=md5('perfil-b')::uuid and nome='Outro dono' and avatar_url is null)
    or not exists(select 1 from auth.users where id=md5('perfil-a')::uuid and email='a@exemplo.com') then
    raise exception 'FALHOU: outro perfil ou login foram alterados'; end if;
end $$;
rollback;
\echo OK: perfil próprio, confirmação, remoção de foto, outro dono, visitante e login preservado.
