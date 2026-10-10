-- SOMENTE teste local. Completa a réplica antiga para aplicar a cadeia operacional.
-- Não representa uma auditoria nova de produção e nunca deve entrar nas migrações.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter policy s on comercios rename to "dono ve seus comercios";
create policy "dono cria seus comercios" on comercios for insert to authenticated with check (dono_id = auth.uid());
create policy "dono edita seus comercios" on comercios for update to authenticated using (dono_id = auth.uid());
alter policy s on fornecedores rename to "dono ve seus fornecedores";
create policy "dono cria seus fornecedores" on fornecedores for insert to authenticated with check (dono_id = auth.uid());
create policy "dono edita seus fornecedores" on fornecedores for update to authenticated using (dono_id = auth.uid());
alter policy s on produtos rename to "dono ve produtos dos seus comercios";
alter policy i on produtos rename to "dono cria produtos nos seus comercios";
alter policy u on produtos rename to "dono edita produtos dos seus comercios";
alter policy s on produto_variacoes rename to "dono ve variacoes dos seus produtos";
alter policy d on produto_variacoes rename to "dono apaga variacoes dos seus produtos";
create policy "dono cria variacoes nos seus produtos" on produto_variacoes for insert to authenticated
  with check (exists (select 1 from comercios c where c.id = comercio_id and c.dono_id = auth.uid()));
create policy "dono edita variacoes dos seus produtos" on produto_variacoes for update to authenticated
  using (exists (select 1 from comercios c where c.id = comercio_id and c.dono_id = auth.uid()));
alter policy r on user_roles rename to "Ver os proprios papeis";
create table profiles (id uuid primary key references auth.users(id));
alter table profiles enable row level security;
create policy "Editar o proprio perfil" on profiles for update to authenticated using (auth.uid() = id);
create policy "Ver o proprio perfil" on profiles for select to authenticated using (auth.uid() = id);
