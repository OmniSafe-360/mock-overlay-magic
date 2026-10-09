-- Réplica LOCAL do banco auditado (somente para teste; nunca aplicar em produção).
-- Simula o essencial do Supabase: papéis, auth.users, auth.uid() e o schema atual.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth, public to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create type public.app_role as enum ('dono', 'gerente', 'repositor');
create type public.tipo_comercio as enum ('mercado','farmacia','loja_roupas','material_construcao','pet_shop','autopecas');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null, created_at timestamptz not null default now(),
  unique (user_id, role));
create function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as
$$ select _user_id = auth.uid() and exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create function public.set_updated_at() returns trigger language plpgsql set search_path = public as
$$ begin new.updated_at = now(); return new; end $$;

create table public.comercios (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references auth.users(id) on delete cascade,
  tipo public.tipo_comercio not null, nome text not null,
  documento_tipo text not null default 'cpf', documento text not null default '00000000000',
  telefone text not null default '11999999999', telefone_whatsapp boolean not null default false,
  cep text not null default '01001000', rua text not null default 'Rua', numero text, sem_numero boolean not null default true,
  complemento text, bairro text not null default 'Centro', cidade text not null default 'SP', uf char(2) not null default 'SP',
  ativo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, dono_id));
create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references auth.users(id) on delete cascade,
  nome text not null, telefone text, email text, ativo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  codigo_barras text check (codigo_barras is null or char_length(codigo_barras) between 1 and 64),
  nome text not null check (char_length(btrim(nome)) between 1 and 160),
  categoria text, unidade text not null,
  preco_compra numeric(12,2) not null check (preco_compra > 0),
  preco_venda numeric(12,2) not null check (preco_venda > 0),
  marca text, detalhes jsonb not null default '{}', ativo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint produtos_id_comercio_unico unique (id, comercio_id));
create unique index produtos_codigo_unico_por_comercio on public.produtos (comercio_id, codigo_barras) where codigo_barras is not null;
create table public.produto_variacoes (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null, produto_id uuid not null,
  tamanho text, cor text, codigo_barras text,
  created_at timestamptz not null default now(),
  constraint variacoes_tem_tamanho_ou_cor check (tamanho is not null or cor is not null),
  constraint variacoes_produto_fk foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id) on delete cascade);
create unique index variacoes_codigo_unico_por_comercio on public.produto_variacoes (comercio_id, codigo_barras) where codigo_barras is not null;

grant select, insert, update, delete on public.comercios, public.fornecedores, public.produtos, public.produto_variacoes to authenticated;
grant select on public.user_roles to authenticated;
alter table public.comercios enable row level security;
alter table public.fornecedores enable row level security;
alter table public.produtos enable row level security;
alter table public.produto_variacoes enable row level security;
alter table public.user_roles enable row level security;
create policy r on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy s on public.comercios for select to authenticated using (dono_id = auth.uid());
create policy s on public.fornecedores for select to authenticated using (dono_id = auth.uid());
create policy s on public.produtos for select to authenticated using (exists (select 1 from public.comercios c where c.id = comercio_id and c.dono_id = auth.uid()));
create policy i on public.produtos for insert to authenticated with check (exists (select 1 from public.comercios c where c.id = comercio_id and c.dono_id = auth.uid()));
create policy u on public.produtos for update to authenticated using (exists (select 1 from public.comercios c where c.id = comercio_id and c.dono_id = auth.uid()));
create policy s on public.produto_variacoes for select to authenticated using (exists (select 1 from public.comercios c where c.id = comercio_id and c.dono_id = auth.uid()));
create policy d on public.produto_variacoes for delete to authenticated using (exists (select 1 from public.comercios c where c.id = comercio_id and c.dono_id = auth.uid()));
