create table public.fiado_acessos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id),
  cliente_id uuid not null unique references public.clientes_fiado(id),
  token text not null unique,
  pin_hash text,
  pin_criado_em timestamptz,
  tentativas integer not null default 0,
  travado_ate timestamptz,
  sessao_hash text,
  sessao_ate timestamptz,
  ultimo_acesso timestamptz,
  created_at timestamptz not null default now()
);
grant all on public.fiado_acessos to service_role;
alter table public.fiado_acessos enable row level security;
create index fiado_acessos_comercio_idx on public.fiado_acessos(comercio_id);

create or replace function public._fiado_novo_token() returns text language sql volatile set search_path = public, pg_temp as $$
  select replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')
$$;
revoke all on function public._fiado_novo_token() from public, anon, authenticated;

create or replace function public._fiado_link(_cliente uuid, _comercio uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare t text;
begin
  select token into t from fiado_acessos where cliente_id = _cliente;
  if t is null then
    t := public._fiado_novo_token();
    insert into fiado_acessos (comercio_id, cliente_id, token) values (_comercio, _cliente, t)
    on conflict (cliente_id) do nothing;
    select token into t from fiado_acessos where cliente_id = _cliente;
  end if;
  return t;
end $$;
revoke all on function public._fiado_link(uuid, uuid) from public, anon, authenticated;

-- Dono
create or replace function public.fiado_cliente_link(_cliente uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare c clientes_fiado%rowtype;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into c from clientes_fiado where id = _cliente;
  if not found or not public.pode_acessar_comercio(c.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  return public._fiado_link(c.id, c.comercio_id);
end $$;

create or replace function public.fiado_novo_link(_cliente uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare c clientes_fiado%rowtype; t text;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into c from clientes_fiado where id = _cliente;
  if not found or not public.pode_acessar_comercio(c.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  perform public._fiado_link(c.id, c.comercio_id);
  t := public._fiado_novo_token();
  update fiado_acessos set token = t, sessao_hash = null, sessao_ate = null where cliente_id = c.id;
  return t;
end $$;

create or replace function public.fiado_zerar_pin(_cliente uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare c clientes_fiado%rowtype;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into c from clientes_fiado where id = _cliente;
  if not found or not public.pode_acessar_comercio(c.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  update fiado_acessos set pin_hash = null, pin_criado_em = null, tentativas = 0, travado_ate = null,
    sessao_hash = null, sessao_ate = null where cliente_id = c.id;
end $$;

create or replace function public.fiado_acesso_info(_cliente uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare c clientes_fiado%rowtype; a fiado_acessos%rowtype;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into c from clientes_fiado where id = _cliente;
  if not found or not public.pode_acessar_comercio(c.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  select * into a from fiado_acessos where cliente_id = c.id;
  return jsonb_build_object('tem_link', a.id is not null, 'tem_pin', a.pin_hash is not null, 'ultimo_acesso', a.ultimo_acesso);
end $$;

-- Caixa (chave do celular)
create or replace function public.caixa_fiado_cliente_link(_chave text, _cliente uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_caixa(_chave);
  if not exists (select 1 from clientes_fiado where id = _cliente and comercio_id = v.comercio_id) then
    raise exception 'cliente_nao_encontrado' using errcode = 'P0001';
  end if;
  return public._fiado_link(_cliente, v.comercio_id);
end $$;

-- Cliente (sem login)
create or replace function public.fiado_publico_estado(_token text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a fiado_acessos%rowtype; c clientes_fiado%rowtype; co comercios%rowtype;
begin
  if _token is null or length(_token) <> 64 then return jsonb_build_object('estado','invalido'); end if;
  select * into a from fiado_acessos where token = _token;
  if not found then return jsonb_build_object('estado','invalido'); end if;
  select * into c from clientes_fiado where id = a.cliente_id;
  select * into co from comercios where id = a.comercio_id;
  return jsonb_build_object('estado', case when a.pin_hash is null then 'novo' else 'pin' end,
    'comercio', co.nome, 'cliente', split_part(c.nome, ' ', 1),
    'tem_telefone', coalesce(length(regexp_replace(c.telefone,'\D','','g')),0) >= 4,
    'travado_ate', case when a.travado_ate > now() then a.travado_ate end);
end $$;

create or replace function public.fiado_publico_entrar(_token text, _final_tel text, _pin text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a fiado_acessos%rowtype; c clientes_fiado%rowtype; tel text; s text;
begin
  select * into a from fiado_acessos where token = _token and _token is not null and length(_token) = 64 for update;
  if not found then raise exception 'link_invalido' using errcode = 'P0001'; end if;
  if a.travado_ate > now() then raise exception 'travado' using errcode = '42501'; end if;
  if _pin is null or _pin !~ '^[0-9]{4}$' then raise exception 'pin_formato' using errcode = '22023'; end if;
  if a.pin_hash is null then
    select * into c from clientes_fiado where id = a.cliente_id;
    tel := regexp_replace(coalesce(c.telefone,''), '\D', '', 'g');
    if length(tel) >= 4 and coalesce(_final_tel,'') <> right(tel, 4) then
      update fiado_acessos set tentativas = tentativas + 1,
        travado_ate = case when tentativas + 1 >= 5 then now() + interval '15 minutes' end where id = a.id;
      return jsonb_build_object('ok', false, 'erro', 'telefone_errado', 'restam', greatest(0, 4 - a.tentativas));
    end if;
    if _pin ~ '^(\d)\1{3}$' or _pin in ('1234','4321','0123','9876') then raise exception 'pin_facil' using errcode = '23514'; end if;
    update fiado_acessos set pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf', 8)), pin_criado_em = now() where id = a.id;
  elsif extensions.crypt(_pin, a.pin_hash) <> a.pin_hash then
    update fiado_acessos set tentativas = tentativas + 1,
      travado_ate = case when tentativas + 1 >= 5 then now() + interval '15 minutes' end where id = a.id;
    return jsonb_build_object('ok', false, 'erro', 'pin_errado', 'restam', greatest(0, 4 - a.tentativas));
  end if;
  s := public._fiado_novo_token();
  update fiado_acessos set tentativas = 0, travado_ate = null, ultimo_acesso = now(),
    sessao_hash = encode(extensions.digest(s, 'sha256'), 'hex'), sessao_ate = now() + interval '12 hours' where id = a.id;
  return jsonb_build_object('ok', true, 'sessao', s);
end $$;

create or replace function public.fiado_publico_extrato(_token text, _sessao text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a fiado_acessos%rowtype; c clientes_fiado%rowtype; co comercios%rowtype; deve numeric; desde timestamptz;
begin
  select * into a from fiado_acessos where token = _token and _token is not null and length(_token) = 64;
  if not found then raise exception 'link_invalido' using errcode = 'P0001'; end if;
  if a.sessao_hash is null or a.sessao_ate < now() or _sessao is null
     or encode(extensions.digest(_sessao, 'sha256'), 'hex') <> a.sessao_hash then
    raise exception 'pin_necessario' using errcode = '42501';
  end if;
  select * into c from clientes_fiado where id = a.cliente_id;
  select * into co from comercios where id = a.comercio_id;
  select coalesce(sum(case when tipo = 'compra' then valor else -valor end), 0) into deve
    from fiado_movimentos where cliente_id = c.id;
  select min(criado_em) into desde from fiado_movimentos where cliente_id = c.id and tipo = 'compra'
    and criado_em > coalesce((select max(criado_em) from fiado_movimentos m2 where m2.cliente_id = c.id
      and (select coalesce(sum(case when tipo='compra' then valor else -valor end),0) from fiado_movimentos m3
           where m3.cliente_id = c.id and m3.criado_em <= m2.criado_em) <= 0), '-infinity');
  return jsonb_build_object(
    'cliente', c.nome, 'comercio', co.nome, 'telefone_comercio', co.telefone, 'whatsapp', co.telefone_whatsapp,
    'deve', greatest(deve, 0), 'desde', case when deve > 0 then desde end,
    'limite', c.limite, 'bloqueado', c.bloqueado,
    'movimentos', coalesce((select jsonb_agg(x order by x->>'criado_em' desc) from (
      select jsonb_build_object('tipo', m.tipo, 'valor', m.valor, 'forma', m.forma, 'criado_em', m.criado_em,
        'venda_numero', vd.numero,
        'itens', (select coalesce(jsonb_agg(jsonb_build_object('descricao', vi.descricao, 'qtd', vi.qtd_nota, 'valor', vi.valor) order by vi.n_item), '[]')
                  from venda_itens vi where vi.venda_id = m.venda_id)) x
      from fiado_movimentos m left join vendas vd on vd.id = m.venda_id
      where m.cliente_id = c.id order by m.criado_em desc limit 100) s), '[]'));
end $$;

revoke all on function public.fiado_cliente_link(uuid), public.fiado_novo_link(uuid), public.fiado_zerar_pin(uuid), public.fiado_acesso_info(uuid) from public, anon;
grant execute on function public.fiado_cliente_link(uuid), public.fiado_novo_link(uuid), public.fiado_zerar_pin(uuid), public.fiado_acesso_info(uuid) to authenticated;
revoke all on function public.caixa_fiado_cliente_link(text, uuid), public.fiado_publico_estado(text), public.fiado_publico_entrar(text, text, text), public.fiado_publico_extrato(text, text) from public;
grant execute on function public.caixa_fiado_cliente_link(text, uuid), public.fiado_publico_estado(text), public.fiado_publico_entrar(text, text, text), public.fiado_publico_extrato(text, text) to anon, authenticated;