-- Etapa E1: equipe e acesso do funcionário ao app "Omni Operação" (desenho aprovado pelo dono em 09/10/2026).
-- O dono cadastra o funcionário na aba Equipe; o sistema gera um código de 6 números (QR Code ou digitado).
-- No primeiro acesso o funcionário cria um PIN de 4 números; o celular fica ligado por uma chave guardada nele.
-- O dono bloqueia ou gera novo acesso a qualquer hora. O funcionário não usa conta do Supabase: só estas funções.

create table public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id),
  nome text not null check (char_length(btrim(nome)) between 2 and 60),
  funcao text not null check (funcao in ('receber', 'repor', 'ambos')),
  codigo text not null unique check (codigo ~ '^[0-9]{6}$'),
  codigo_gerado_em timestamptz not null default now(),
  pin_hash text,                       -- PIN embaralhado (bcrypt); null = ainda não fez o primeiro acesso
  pin_criado_em timestamptz,           -- quando o funcionário fez o primeiro acesso (o dono vê; o PIN nunca sai)
  pin_tentativas int not null default 0,
  travado_ate timestamptz,
  bloqueado_em timestamptz,
  ultimo_acesso timestamptz,
  criado_por uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index funcionarios_comercio_idx on public.funcionarios (comercio_id, created_at);

-- Celulares ligados: guarda só o resumo (sha256) da chave; a chave fica no celular.
create table public.funcionario_aparelhos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id),
  comercio_id uuid not null references public.comercios(id),
  chave_hash text not null unique,
  aparelho text check (aparelho is null or char_length(aparelho) <= 120),
  criado_em timestamptz not null default now(),
  ultimo_uso timestamptz not null default now(),
  encerrado_em timestamptz
);
create index funcionario_aparelhos_func_idx on public.funcionario_aparelhos (funcionario_id);

create trigger funcionarios_set_updated_at before update on public.funcionarios
  for each row execute function public.set_updated_at();

alter table public.funcionarios enable row level security;
alter table public.funcionario_aparelhos enable row level security;
-- O dono lê; ninguém grava direto (só as funções). O PIN embaralhado não sai pela leitura da tela (a tela não pede a coluna).
create policy "dono ve funcionarios do seu comercio" on public.funcionarios for select to authenticated
  using (public.pode_acessar_comercio(comercio_id));
create policy "dono ve aparelhos do seu comercio" on public.funcionario_aparelhos for select to authenticated
  using (public.pode_acessar_comercio(comercio_id));
-- O PIN embaralhado nunca sai: a leitura do dono não inclui essa coluna.
revoke all on public.funcionarios, public.funcionario_aparelhos from anon, authenticated;
grant select (id, comercio_id, nome, funcao, codigo, codigo_gerado_em, pin_criado_em, pin_tentativas, travado_ate, bloqueado_em, ultimo_acesso, criado_por, created_at, updated_at)
  on public.funcionarios to authenticated;
grant select (id, funcionario_id, comercio_id, aparelho, criado_em, ultimo_uso, encerrado_em) on public.funcionario_aparelhos to authenticated;


/* Código novo de 6 números, sem repetir nenhum já usado. */
create or replace function public._novo_codigo_funcionario() returns text
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare c text;
begin
  loop
    c := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when c !~ '^(\d)\1{5}$' and not exists (select 1 from funcionarios where codigo = c);
  end loop;
  return c;
end $$;

/* ---------- dono ---------- */
create or replace function public.criar_funcionario(_comercio uuid, _nome text, _funcao text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_cod text;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  if not public.pode_acessar_comercio(_comercio) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(_nome, ''))) < 2 then raise exception 'nome_funcionario_curto' using errcode = '23514'; end if;
  if char_length(btrim(_nome)) > 60 then raise exception 'nome_funcionario_longo' using errcode = '23514'; end if;
  if _funcao not in ('receber', 'repor', 'ambos') then raise exception 'funcao_invalida' using errcode = '23514'; end if;
  if (select count(*) from funcionarios where comercio_id = _comercio) >= 50 then raise exception 'funcionarios_demais' using errcode = '23514'; end if;
  v_cod := public._novo_codigo_funcionario();
  insert into funcionarios (comercio_id, nome, funcao, codigo, criado_por) values (_comercio, btrim(_nome), _funcao, v_cod, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'codigo', v_cod);
end $$;

create or replace function public.atualizar_funcionario(_id uuid, _nome text, _funcao text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into v from funcionarios where id = _id for update;
  if not found or not public.pode_acessar_comercio(v.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(_nome, ''))) < 2 then raise exception 'nome_funcionario_curto' using errcode = '23514'; end if;
  if char_length(btrim(_nome)) > 60 then raise exception 'nome_funcionario_longo' using errcode = '23514'; end if;
  if _funcao not in ('receber', 'repor', 'ambos') then raise exception 'funcao_invalida' using errcode = '23514'; end if;
  update funcionarios set nome = btrim(_nome), funcao = _funcao where id = _id;
end $$;

/* Bloquear desliga todos os celulares na hora. Desbloquear exige novo acesso (código novo e PIN novo). */
create or replace function public.bloquear_funcionario(_id uuid, _bloquear boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; v_cod text;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into v from funcionarios where id = _id for update;
  if not found or not public.pode_acessar_comercio(v.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  update funcionario_aparelhos set encerrado_em = now() where funcionario_id = _id and encerrado_em is null;
  if _bloquear then
    update funcionarios set bloqueado_em = coalesce(bloqueado_em, now()) where id = _id;
    return jsonb_build_object('codigo', null);
  end if;
  v_cod := public._novo_codigo_funcionario();
  update funcionarios set bloqueado_em = null, codigo = v_cod, codigo_gerado_em = now(), pin_hash = null, pin_criado_em = null, pin_tentativas = 0, travado_ate = null where id = _id;
  return jsonb_build_object('codigo', v_cod);
end $$;

/* "Novo acesso": esqueceu o PIN ou trocou de celular. Código novo, PIN apagado, celulares desligados. */
create or replace function public.novo_acesso_funcionario(_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; v_cod text;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into v from funcionarios where id = _id for update;
  if not found or not public.pode_acessar_comercio(v.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  if v.bloqueado_em is not null then raise exception 'funcionario_bloqueado' using errcode = '23514'; end if;
  update funcionario_aparelhos set encerrado_em = now() where funcionario_id = _id and encerrado_em is null;
  v_cod := public._novo_codigo_funcionario();
  update funcionarios set codigo = v_cod, codigo_gerado_em = now(), pin_hash = null, pin_criado_em = null, pin_tentativas = 0, travado_ate = null where id = _id;
  return jsonb_build_object('codigo', v_cod);
end $$;

/* ---------- funcionário (sem login) ---------- */
/* Primeiro passo da entrada: 'novo' (criar PIN), 'pin' (digitar PIN) ou null (código não vale). */
create or replace function public.conferir_codigo_funcionario(_codigo text) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  if _codigo is null or _codigo !~ '^[0-9]{6}$' then return null; end if;
  select * into v from funcionarios where codigo = _codigo and bloqueado_em is null;
  if not found then return null; end if;
  if v.pin_hash is null then
    if v.codigo_gerado_em < now() - interval '48 hours' then return 'expirado'; end if;
    return 'novo';
  end if;
  return 'pin';
end $$;

/* Entrar: com o código e o PIN (no primeiro acesso, o PIN é criado aqui). Devolve a chave do celular. */
create or replace function public.entrar_funcionario(_codigo text, _pin text, _aparelho text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; v_chave text; c comercios%rowtype;
begin
  if _codigo is null or _codigo !~ '^[0-9]{6}$' then raise exception 'codigo_invalido' using errcode = '42501'; end if;
  select * into v from funcionarios where codigo = _codigo and bloqueado_em is null for update;
  if not found then raise exception 'codigo_invalido' using errcode = '42501'; end if;
  if v.travado_ate is not null and v.travado_ate > now() then
    raise exception 'muitas_tentativas:%', ceil(extract(epoch from (v.travado_ate - now())) / 60)::int using errcode = '42501'; end if;
  if _pin is null or _pin !~ '^[0-9]{4}$' then raise exception 'pin_formato' using errcode = '22023'; end if;
  if v.pin_hash is null then
    if v.codigo_gerado_em < now() - interval '48 hours' then raise exception 'codigo_expirado' using errcode = '42501'; end if;
    if _pin ~ '^(\d)\1{3}$' or _pin in ('1234', '4321', '0123', '9876') then raise exception 'pin_facil' using errcode = '23514'; end if;
    update funcionarios set pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf', 8)), pin_criado_em = now() where id = v.id;
  elsif extensions.crypt(_pin, v.pin_hash) <> v.pin_hash then
    if v.pin_tentativas + 1 >= 5 then
      update funcionarios set pin_tentativas = 0, travado_ate = now() + interval '15 minutes' where id = v.id;
      -- A trava precisa ficar gravada: devolve o erro sem desfazer a transação.
      return jsonb_build_object('erro', 'muitas_tentativas:15');
    end if;
    update funcionarios set pin_tentativas = pin_tentativas + 1 where id = v.id;
    return jsonb_build_object('erro', 'pin_errado:' || (5 - v.pin_tentativas - 1));
  end if;
  v_chave := encode(extensions.gen_random_bytes(32), 'hex');
  insert into funcionario_aparelhos (funcionario_id, comercio_id, chave_hash, aparelho)
  values (v.id, v.comercio_id, encode(extensions.digest(v_chave, 'sha256'), 'hex'), left(nullif(btrim(coalesce(_aparelho, '')), ''), 120));
  update funcionarios set pin_tentativas = 0, travado_ate = null, ultimo_acesso = now() where id = v.id;
  select * into c from comercios where id = v.comercio_id;
  return jsonb_build_object('chave', v_chave, 'nome', v.nome, 'funcao', v.funcao, 'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo));
end $$;

/* Funcionário dono da chave (uso interno das funções do app do funcionário). */
create or replace function public._funcionario_da_chave(_chave text) returns public.funcionarios
language plpgsql security definer set search_path = public, pg_temp as $$
declare a funcionario_aparelhos%rowtype; v funcionarios%rowtype;
begin
  if _chave is null or _chave !~ '^[0-9a-f]{64}$' then raise exception 'acesso_encerrado' using errcode = '42501'; end if;
  select * into a from funcionario_aparelhos where chave_hash = encode(extensions.digest(_chave, 'sha256'), 'hex') and encerrado_em is null;
  if not found then raise exception 'acesso_encerrado' using errcode = '42501'; end if;
  select * into v from funcionarios where id = a.funcionario_id and bloqueado_em is null;
  if not found then raise exception 'acesso_encerrado' using errcode = '42501'; end if;
  update funcionario_aparelhos set ultimo_uso = now() where id = a.id and ultimo_uso < now() - interval '1 minute';
  update funcionarios set ultimo_acesso = now() where id = v.id and (ultimo_acesso is null or ultimo_acesso < now() - interval '1 minute');
  return v;
end $$;

/* Tela inicial do funcionário: quem é, o comércio e os números dos avisos. null = celular desligado (bloqueado ou novo acesso). */
create or replace function public.funcionario_inicio(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; c comercios%rowtype; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_entregas int; v_hoje_n int; v_repor int;
begin
  begin v := public._funcionario_da_chave(_chave);
  exception when others then return null; end;
  select * into c from comercios where id = v.comercio_id;
  select count(*), count(*) filter (where previsao_entrega is not null and previsao_entrega <= v_hoje)
    into v_entregas, v_hoje_n
    from pedidos_compra where comercio_id = v.comercio_id and situacao in ('enviado', 'aceito', 'aceito_ajustes', 'recebido_parcial');
  select count(*) into v_repor from (
    select pa.produto_id, pa.variacao_id
      from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
      left join saldos s on s.produto_id = pa.produto_id and s.variacao_id is not distinct from pa.variacao_id and s.area = 'venda'
     where pa.comercio_id = v.comercio_id and pa.area = 'venda' and pa.minimo is not null
     group by pa.produto_id, pa.variacao_id, pa.minimo
    having coalesce(sum(s.quantidade), 0) <= pa.minimo) x;
  return jsonb_build_object('nome', v.nome, 'funcao', v.funcao, 'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo),
    'avisos', jsonb_build_object('entregas', v_entregas, 'entregas_hoje', v_hoje_n, 'repor', v_repor));
end $$;

/* Sair neste celular. */
create or replace function public.sair_funcionario(_chave text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if _chave is null or _chave !~ '^[0-9a-f]{64}$' then return; end if;
  update funcionario_aparelhos set encerrado_em = now() where chave_hash = encode(extensions.digest(_chave, 'sha256'), 'hex') and encerrado_em is null;
end $$;

revoke all on function public._novo_codigo_funcionario(), public._funcionario_da_chave(text),
  public.criar_funcionario(uuid, text, text), public.atualizar_funcionario(uuid, text, text), public.bloquear_funcionario(uuid, boolean),
  public.novo_acesso_funcionario(uuid), public.conferir_codigo_funcionario(text), public.entrar_funcionario(text, text, text),
  public.funcionario_inicio(text), public.sair_funcionario(text) from public, anon, authenticated;
grant execute on function public.criar_funcionario(uuid, text, text), public.atualizar_funcionario(uuid, text, text),
  public.bloquear_funcionario(uuid, boolean), public.novo_acesso_funcionario(uuid) to authenticated;
grant execute on function public.conferir_codigo_funcionario(text), public.entrar_funcionario(text, text, text),
  public.funcionario_inicio(text), public.sair_funcionario(text) to anon, authenticated;
