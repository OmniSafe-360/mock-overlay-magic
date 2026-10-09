-- =====================================================================
-- PROPOSTA DE MIGRAÇÃO (revisão 2) — NÃO APLICADA EM PRODUÇÃO.
-- Omni Safe 360 · persistência do cadastro de produto.
-- Testada apenas em PostgreSQL 17 local e separado (docs/persistencia/teste).
-- Produção auditada: PostgreSQL 17.11; papel postgres com BYPASSRLS.
-- Não apaga nem reescreve dados existentes (produtos=0, variacoes=0).
-- =====================================================================

-- ---------- 0. Tipos ----------
create type public.area_estoque as enum ('deposito', 'venda');
create type public.tipo_movimento as enum ('contagem_inicial', 'entrada', 'transferencia', 'ajuste', 'divisao_pendencia');

-- ---------- 1. Regras puras (iguais às da tela) ----------
create function public.unidade_fracionada(_u text) returns boolean
language sql immutable set search_path = public, pg_temp as
$$ select _u in ('Kg', 'Metro', 'm²', 'Litro') $$;

-- Valida sem arredondar: até 3 casas; inteiro nas unidades não fracionadas.
create function public.qtd_valida(_q numeric, _u text, _permite_zero boolean) returns numeric
language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if _q is null then raise exception 'quantidade_vazia' using errcode = '22023'; end if;
  if _q < 0 then raise exception 'quantidade_negativa' using errcode = '22023'; end if;
  if _q <> round(_q, 3) then raise exception 'mais_de_tres_casas' using errcode = '22023'; end if;
  if not public.unidade_fracionada(_u) and _q <> trunc(_q) then
    raise exception 'unidade_exige_inteiro: %', _u using errcode = '22023'; end if;
  if not _permite_zero and _q = 0 then raise exception 'quantidade_zero' using errcode = '22023'; end if;
  return _q;
end $$;

-- Mesmo critério de normLote() da tela: trim, maiúsculas, espaços internos únicos.
create function public.normalizar_lote(_t text) returns text
language sql immutable set search_path = public, pg_temp as
$$ select nullif(upper(regexp_replace(btrim(coalesce(_t, '')), '\s+', ' ', 'g')), '') $$;

-- Regras dos seis tipos (mesmas listas da tela). Detalhes com opções fixas continuam opcionais.
create function public.validar_tipo(_tipo public.tipo_comercio, _un text, _cat text, _det jsonb) returns void
language plpgsql immutable set search_path = public, pg_temp as $$
declare u text[]; c text[]; k text; o text[]; v text;
begin
  case _tipo
    when 'mercado' then u := '{Unidade,Kg,Litro,Pacote,Caixa}';
      c := '{Mercearia,Bebidas,Hortifrúti,"Frios e laticínios",Limpeza,Higiene}';
    when 'farmacia' then u := '{Caixa,Cartela,Frasco,Unidade}';
      c := '{Medicamentos,Genéricos,Higiene,Dermocosméticos,Infantil,Suplementos}'; k := 'controlado'; o := '{Sim,Não}';
    when 'loja_roupas' then u := '{Peça,Par}';
      c := '{Camisetas,Calças,Vestidos,Calçados,Íntima,Acessórios}';
    when 'material_construcao' then u := '{Unidade,Metro,m²,Kg,Saco,Caixa,Lata}';
      c := '{Básico,Hidráulica,Elétrica,Pintura,Ferramentas,Acabamento}';
    when 'pet_shop' then u := '{Unidade,Kg,Litro,Pacote,Caixa}';
      c := '{Ração,Petiscos,Higiene,Acessórios,"Farmácia pet",Brinquedos}'; k := 'especie'; o := '{Cão,Gato,Outros}';
    when 'autopecas' then u := '{Unidade,Par,Jogo,Kit}';
      c := '{Motor,Freios,Suspensão,Elétrica,Filtros,Acessórios}'; k := 'posicao';
      o := '{Dianteira,Traseira,Esquerda,Direita,"Não se aplica"}';
  end case;
  if _un is null or not (_un = any (u)) then raise exception 'unidade_incompativel: %', _un using errcode = '23514'; end if;
  if _cat is null or not (_cat = any (c)) then raise exception 'categoria_incompativel: %', _cat using errcode = '23514'; end if;
  if k is not null then
    v := nullif(btrim(coalesce(_det->>k, '')), '');
    if v is not null and not (v = any (o)) then raise exception '%_invalido: %', k, v using errcode = '23514'; end if;
  end if;
end $$;

-- ---------- 2. Acesso por comércio ----------
-- Hoje só o dono. Papel global (user_roles) nunca autoriza sozinho.
create function public.pode_acessar_comercio(_comercio uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select auth.uid() is not null and exists (select 1 from public.comercios c where c.id = _comercio and c.dono_id = auth.uid()) $$;
revoke execute on function public.pode_acessar_comercio(uuid) from public, anon;
grant execute on function public.pode_acessar_comercio(uuid) to authenticated;

-- ---------- 3. Ajustes nas tabelas existentes ----------
alter table public.produtos
  add column controla_validade boolean,            -- null = "Validade não configurada"
  add column avisos_dias smallint[] not null default '{}',
  add constraint produtos_avisos_validos check (avisos_dias <@ array[30,60,90]::smallint[]);

alter table public.produto_variacoes
  add column qtd_informada numeric(14,3) check (qtd_informada >= 0),  -- "Quantidade informada no cadastro" (roupas); não é estoque
  add column removida_em timestamptz,                                -- remoção sem apagar histórico
  add constraint variacoes_id_produto_comercio_unico unique (id, produto_id, comercio_id);

-- Índice antigo contava variações removidas; passa a valer só para as ativas.
drop index public.variacoes_codigo_unico_por_comercio;
create unique index variacoes_codigo_unico_por_comercio on public.produto_variacoes (comercio_id, codigo_barras)
  where codigo_barras is not null and removida_em is null;

-- Toda gravação de produto/variação passa pelas funções abaixo.
revoke insert, update, delete on public.produtos, public.produto_variacoes from authenticated, anon;

create function public.produtos_vinculos() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.comercio_id <> old.comercio_id then
    raise exception 'produto_nao_muda_de_comercio' using errcode = '23514'; end if;
  if new.fornecedor_id is not null and not exists (
    select 1 from fornecedores f join comercios c on c.dono_id = f.dono_id
    where f.id = new.fornecedor_id and c.id = new.comercio_id) then
    raise exception 'fornecedor_de_outro_dono' using errcode = '23514'; end if;
  return new;
end $$;
create trigger produtos_vinculos before insert or update on public.produtos
  for each row execute function public.produtos_vinculos();

-- ---------- 4. Códigos de barras únicos no comércio (produtos + variações) ----------
create table public.codigos_barras (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  codigo text not null,
  produto_id uuid not null,
  variacao_id uuid,
  primary key (comercio_id, codigo));
grant select on public.codigos_barras to authenticated;
grant all on public.codigos_barras to service_role;
alter table public.codigos_barras enable row level security;
create policy "acesso ve codigos" on public.codigos_barras for select to authenticated
  using (public.pode_acessar_comercio(comercio_id));

create function public.sync_codigo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e_var boolean := tg_table_name = 'produto_variacoes';
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  o_cod text := case when o->>'removida_em' is null then o->>'codigo_barras' end;
  n_cod text := case when n->>'removida_em' is null then n->>'codigo_barras' end;
begin
  if o_cod is not distinct from n_cod then return coalesce(new, old); end if;
  if o_cod is not null then
    delete from codigos_barras where comercio_id = (o->>'comercio_id')::uuid and codigo = o_cod; end if;
  if n_cod is not null then
    begin
      insert into codigos_barras values ((n->>'comercio_id')::uuid, n_cod,
        (case when e_var then n->>'produto_id' else n->>'id' end)::uuid,
        (case when e_var then n->>'id' end)::uuid);
    exception when unique_violation then
      raise exception 'codigo_em_uso: %', n_cod using errcode = '23505';
    end;
  end if;
  return coalesce(new, old);
end $$;
create trigger produtos_codigo after insert or update or delete on public.produtos
  for each row execute function public.sync_codigo();
create trigger variacoes_codigo after insert or update or delete on public.produto_variacoes
  for each row execute function public.sync_codigo();

-- ---------- 5. Operações (idempotência) ----------
create table public.operacoes (
  id uuid primary key,                       -- gerado no app; reaproveitado ao repetir
  user_id uuid not null,
  comercio_id uuid not null references public.comercios(id),
  produto_id uuid not null,
  tipo text not null,
  hash text not null,                        -- conteúdo do pedido
  resultado jsonb,
  created_at timestamptz not null default now());

-- ---------- 6. Locais ----------
create table public.locais (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id),
  area public.area_estoque not null,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  nome_norm text generated always as (lower(regexp_replace(btrim(nome), '\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default now(),
  unique (comercio_id, area, nome_norm),
  unique (id, comercio_id, area));

-- ---------- 7. Configuração por produto/variação e área ----------
create table public.produto_areas (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  produto_id uuid not null,
  variacao_id uuid,
  area public.area_estoque not null,
  local_id uuid,                                   -- null = "Definir depois"
  local_definido_por uuid,                         -- quem definiu/alterou o local
  local_definido_em timestamptz,
  minimo numeric(14,3) check (minimo >= 0),
  maximo numeric(14,3) check (maximo >= 0),
  updated_at timestamptz not null default now(),
  check (minimo is null or maximo is null or maximo >= minimo),
  unique nulls not distinct (produto_id, variacao_id, area),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id),
  foreign key (local_id, comercio_id, area) references public.locais(id, comercio_id, area));

-- ---------- 8. "Esta área foi contada" (não altera saldo) ----------
create table public.contagens (
  id uuid primary key default gen_random_uuid(),
  operacao_id uuid not null references public.operacoes(id),
  comercio_id uuid not null,
  produto_id uuid not null,
  variacao_id uuid,
  area public.area_estoque not null,
  quantidade numeric(14,3) not null check (quantidade >= 0),   -- zero = contado e vazio
  criado_por uuid not null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (produto_id, variacao_id, area),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id));

-- ---------- 9. Lotes ----------
create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  produto_id uuid not null,
  variacao_id uuid,
  numero text check (numero is null or char_length(btrim(numero)) between 1 and 40),
  numero_norm text generated always as (public.normalizar_lote(numero)) stored,
  vencimento date,                                  -- só data
  vencimento_definido_por uuid,                     -- preenchimento posterior confirmado
  vencimento_definido_em timestamptz,
  created_at timestamptz not null default now(),
  check (numero is not null or vencimento is not null),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id));
create unique index lotes_numero_unico on public.lotes (produto_id, variacao_id, numero_norm)
  nulls not distinct where numero_norm is not null;

-- ---------- 10. Saldos ----------
create table public.saldos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  produto_id uuid not null,
  variacao_id uuid,
  area public.area_estoque not null,
  lote_id uuid references public.lotes(id),
  pendente boolean not null default false,
  pendencia_confirmada boolean not null default false,   -- Farmácia: "pendente de conferência" confirmado
  origem_id uuid references public.saldos(id),
  quantidade numeric(14,3) not null check (quantidade >= 0),
  updated_at timestamptz not null default now(),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id));
create index saldos_chave_idx on public.saldos (produto_id, variacao_id, area);

-- ---------- 11. Movimentos (alteram saldo; só acrescenta) ----------
create table public.movimentos (
  id uuid primary key default gen_random_uuid(),
  operacao_id uuid not null references public.operacoes(id),
  comercio_id uuid not null,
  produto_id uuid not null,
  variacao_id uuid,
  area public.area_estoque not null,
  local_id uuid,
  lote_id uuid references public.lotes(id),
  saldo_id uuid not null references public.saldos(id),
  tipo public.tipo_movimento not null,
  quantidade numeric(14,3) not null check (quantidade <> 0),  -- + entra, - sai
  criado_por uuid not null,
  created_at timestamptz not null default now(),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id),
  foreign key (local_id, comercio_id, area) references public.locais(id, comercio_id, area));
create index movimentos_saldo_idx on public.movimentos (saldo_id);

-- ---------- 12. Compatibilidade entre vínculos ----------
create function public.checar_vinculos() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r jsonb := to_jsonb(new); l record; s record;
begin
  if r->>'lote_id' is not null then
    select * into l from lotes where id = (r->>'lote_id')::uuid;
    if l.comercio_id::text <> r->>'comercio_id' or l.produto_id::text <> r->>'produto_id'
       or l.variacao_id::text is distinct from r->>'variacao_id' then
      raise exception 'vinculo_incompativel: lote' using errcode = '23514'; end if;
  end if;
  if r->>'saldo_id' is not null then
    select * into s from saldos where id = (r->>'saldo_id')::uuid;
    if s.comercio_id::text <> r->>'comercio_id' or s.produto_id::text <> r->>'produto_id'
       or s.variacao_id::text is distinct from r->>'variacao_id' or s.area::text <> r->>'area'
       or s.lote_id::text is distinct from r->>'lote_id' then
      raise exception 'vinculo_incompativel: saldo' using errcode = '23514'; end if;
  end if;
  if r->>'origem_id' is not null then
    select * into s from saldos where id = (r->>'origem_id')::uuid;
    if s.comercio_id::text <> r->>'comercio_id' or s.produto_id::text <> r->>'produto_id'
       or s.variacao_id::text is distinct from r->>'variacao_id' or s.area::text <> r->>'area' or not s.pendente then
      raise exception 'vinculo_incompativel: origem' using errcode = '23514'; end if;
  end if;
  return new;
end $$;
create trigger saldos_vinculos before insert or update on public.saldos for each row execute function public.checar_vinculos();
create trigger movimentos_vinculos before insert on public.movimentos for each row execute function public.checar_vinculos();

-- Histórico imutável: sem exclusão nem alteração.
create function public.bloquear_alteracao() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare o jsonb := to_jsonb(old); n jsonb := case when tg_op = 'UPDATE' then to_jsonb(new) end;
begin
  -- operacoes: só o preenchimento único do resultado.
  if tg_table_name = 'operacoes' and n is not null and o->'resultado' = 'null'::jsonb
     and (n - 'resultado') = (o - 'resultado') then return new; end if;
  -- lotes: só preencher uma data que era desconhecida (nunca substituir).
  if tg_table_name = 'lotes' and n is not null and o->>'vencimento' is null and n->>'vencimento' is not null
     and n->>'vencimento_definido_por' is not null
     -- numero_norm é gerado e ainda vem vazio no gatilho; o número em si é comparado.
     and (n - 'vencimento' - 'vencimento_definido_por' - 'vencimento_definido_em' - 'numero_norm')
       = (o - 'vencimento' - 'vencimento_definido_por' - 'vencimento_definido_em' - 'numero_norm') then return new; end if;
  -- saldos: só a quantidade muda (identidade e vínculos fixos).
  if tg_table_name = 'saldos' and n is not null
     and (n - 'quantidade' - 'updated_at') = (o - 'quantidade' - 'updated_at') then return new; end if;
  raise exception 'historico_imutavel: %', tg_table_name using errcode = '42501';
end $$;
create trigger operacoes_imutavel before update or delete on public.operacoes for each row execute function public.bloquear_alteracao();
create trigger contagens_imutavel before update or delete on public.contagens for each row execute function public.bloquear_alteracao();
create trigger lotes_imutavel before update or delete on public.lotes for each row execute function public.bloquear_alteracao();
create trigger saldos_imutavel before update or delete on public.saldos for each row execute function public.bloquear_alteracao();
create trigger movimentos_imutavel before update or delete on public.movimentos for each row execute function public.bloquear_alteracao();

-- ---------- 13. Permissões: leitura própria; escrita só pelas funções ----------
grant select on public.operacoes, public.locais, public.produto_areas, public.contagens,
  public.lotes, public.saldos, public.movimentos to authenticated;
grant all on public.operacoes, public.locais, public.produto_areas, public.contagens,
  public.lotes, public.saldos, public.movimentos to service_role;
alter table public.operacoes enable row level security;
alter table public.locais enable row level security;
alter table public.produto_areas enable row level security;
alter table public.contagens enable row level security;
alter table public.lotes enable row level security;
alter table public.saldos enable row level security;
alter table public.movimentos enable row level security;
create policy "dono ve operacoes" on public.operacoes for select to authenticated using (user_id = auth.uid());
create policy "acesso ve locais" on public.locais for select to authenticated using (public.pode_acessar_comercio(comercio_id));
create policy "acesso ve config" on public.produto_areas for select to authenticated using (public.pode_acessar_comercio(comercio_id));
create policy "acesso ve contagens" on public.contagens for select to authenticated using (public.pode_acessar_comercio(comercio_id));
create policy "acesso ve lotes" on public.lotes for select to authenticated using (public.pode_acessar_comercio(comercio_id));
create policy "acesso ve saldos" on public.saldos for select to authenticated using (public.pode_acessar_comercio(comercio_id));
create policy "acesso ve movimentos" on public.movimentos for select to authenticated using (public.pode_acessar_comercio(comercio_id));

-- ---------- 14. Funções internas ----------
create function public.saldo_chave(_p uuid, _v uuid, _a public.area_estoque) returns numeric
language sql stable set search_path = public, pg_temp as
$$ select coalesce(sum(quantidade), 0) from public.saldos where produto_id = _p and variacao_id is not distinct from _v and area = _a $$;

-- Início comum: autenticação, dono do comércio, idempotência e trava por produto.
-- Retorna o resultado anterior quando é repetição idêntica; null quando deve executar.
create function public._iniciar_operacao(_op uuid, _com uuid, _prod uuid, _tipo text, _hash text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); o record;
begin
  if v_uid is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  if _op is null or _com is null or _prod is null then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
  if not exists (select 1 from comercios where id = _com and dono_id = v_uid) then
    raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  -- Espera outra transação com o mesmo id terminar antes de decidir.
  insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash)
  values (_op, v_uid, _com, _prod, _tipo, _hash) on conflict (id) do nothing;
  if not found then
    select * into o from operacoes where id = _op;
    if o.user_id <> v_uid or o.comercio_id <> _com or o.produto_id <> _prod or o.tipo <> _tipo or o.hash <> _hash then
      raise exception 'operacao_reutilizada_com_conteudo_diferente' using errcode = '23505'; end if;
    return o.resultado;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(_prod::text, 0));
  return null;
end $$;
revoke execute on function public._iniciar_operacao(uuid, uuid, uuid, text, text) from public, anon, authenticated;

-- Resolve/cria o lote de uma parte, sem nunca sobrescrever data existente.
create function public._lote_da_parte(_com uuid, _prod uuid, _var uuid, _numero text, _venc date) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_venc date;
begin
  if public.normalizar_lote(_numero) is not null then
    select id, vencimento into v_id, v_venc from lotes
     where produto_id = _prod and variacao_id is not distinct from _var and numero_norm = public.normalizar_lote(_numero);
    if found then
      if v_venc is distinct from _venc then
        raise exception 'lote_com_datas_diferentes: %', _numero using errcode = '23514'; end if;
      return v_id;
    end if;
  elsif _venc is null then
    return null;                                  -- validade e lote desconhecidos
  end if;
  insert into lotes (comercio_id, produto_id, variacao_id, numero, vencimento)
  values (_com, _prod, _var, nullif(btrim(regexp_replace(coalesce(_numero, ''), '\s+', ' ', 'g')), ''), _venc)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public._lote_da_parte(uuid, uuid, uuid, text, date) from public, anon, authenticated;

-- ---------- 15. Salvar produto (uma transação) ----------
-- p = { operacao_id, produto:{id, comercio_id, fornecedor_id, codigo_barras, nome, categoria, unidade,
--        preco_compra, preco_venda, marca, detalhes, controla_validade, avisos_dias},
--       variacoes:[{id, tamanho, cor, codigo_barras, qtd_informada}],   -- lista completa das ativas
--       areas:[{area, variacao_id, local:null|{id}|{nome}, minimo, maximo,
--               contagem?: {quantidade, partes:[{numero, vencimento, quantidade, confirmada}]}}] }
-- Ao editar, áreas já contadas vão SEM "contagem".
create function public.salvar_produto(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_op uuid := (p->>'operacao_id')::uuid;
  pr jsonb := p->'produto';
  v_id uuid := (pr->>'id')::uuid;
  v_com uuid := (pr->>'comercio_id')::uuid;
  v_prev jsonb; v_tipo tipo_comercio; v_old produtos%rowtype; v_existe boolean;
  v_un text := pr->>'unidade'; v_ctrl boolean := (pr->>'controla_validade')::boolean;
  v_farm boolean; v_roupas boolean;
  x jsonb; pt jsonb; vr record;
  v_var uuid; v_area area_estoque; v_local uuid; v_min numeric; v_max numeric; v_old_local uuid; v_tem_cfg boolean;
  v_q numeric; v_pq numeric; v_soma numeric; v_venc date; v_lote uuid; v_pend boolean; v_saldo uuid;
  v_ids uuid[] := '{}'; v_cont int := 0; v_var_existe boolean;
begin
  v_prev := public._iniciar_operacao(v_op, v_com, v_id, 'salvar_produto', md5((p - 'operacao_id')::text));
  if v_prev is not null then return v_prev; end if;

  select tipo into v_tipo from comercios where id = v_com;
  v_farm := v_tipo = 'farmacia'; v_roupas := v_tipo = 'loja_roupas';

  select * into v_old from produtos where id = v_id for update;
  v_existe := found;
  perform public.validar_tipo(v_tipo, v_un, pr->>'categoria', coalesce(pr->'detalhes', '{}'));
  if v_existe and v_old.comercio_id <> v_com then
    raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;

  -- Unidade travada depois de qualquer contagem.
  if v_existe and v_old.unidade <> v_un and exists (select 1 from contagens where produto_id = v_id) then
    raise exception 'unidade_travada' using errcode = '23514'; end if;
  -- Fornecedor do mesmo dono (o trigger também confere).
  if pr->>'fornecedor_id' is not null and not exists (
     select 1 from fornecedores where id = (pr->>'fornecedor_id')::uuid and dono_id = v_uid) then
    raise exception 'fornecedor_de_outro_dono' using errcode = '42501'; end if;
  -- Farmácia: validade sempre ligada (produto antigo pode continuar "não configurada").
  if v_farm and (v_ctrl is false or (v_ctrl is null and (not v_existe or v_old.controla_validade is not null))) then
    raise exception 'farmacia_exige_validade' using errcode = '23514'; end if;
  -- Desligar validade com quantidade em lote/pendência.
  if v_existe and v_old.controla_validade and v_ctrl is distinct from true and exists (
     select 1 from saldos where produto_id = v_id and quantidade > 0 and (lote_id is not null or pendente)) then
    raise exception 'desligar_validade_bloqueado' using errcode = '23514'; end if;

  if pr->>'codigo_barras' is not null and exists (select 1 from codigos_barras where comercio_id = v_com
     and codigo = pr->>'codigo_barras' and not (produto_id = v_id and variacao_id is null)) then
    raise exception 'codigo_em_uso: %', pr->>'codigo_barras' using errcode = '23505'; end if;
  if v_existe then
    update produtos set fornecedor_id = (pr->>'fornecedor_id')::uuid, codigo_barras = pr->>'codigo_barras',
      nome = pr->>'nome', categoria = pr->>'categoria', unidade = v_un,
      preco_compra = (pr->>'preco_compra')::numeric, preco_venda = (pr->>'preco_venda')::numeric,
      marca = pr->>'marca', detalhes = coalesce(pr->'detalhes', '{}'), controla_validade = v_ctrl,
      avisos_dias = coalesce(array(select jsonb_array_elements_text(pr->'avisos_dias'))::smallint[], '{}'),
      updated_at = now()
    where id = v_id;
  else
    insert into produtos (id, comercio_id, fornecedor_id, codigo_barras, nome, categoria, unidade,
      preco_compra, preco_venda, marca, detalhes, controla_validade, avisos_dias)
    values (v_id, v_com, (pr->>'fornecedor_id')::uuid, pr->>'codigo_barras', pr->>'nome', pr->>'categoria', v_un,
      (pr->>'preco_compra')::numeric, (pr->>'preco_venda')::numeric, pr->>'marca', coalesce(pr->'detalhes', '{}'),
      v_ctrl, coalesce(array(select jsonb_array_elements_text(pr->'avisos_dias'))::smallint[], '{}'));
  end if;

  -- Variações: ids estáveis do app; nunca de outro produto.
  for x in select * from jsonb_array_elements(coalesce(p->'variacoes', '[]')) loop
    select * into vr from produto_variacoes where id = (x->>'id')::uuid;
    v_var_existe := found;
    if v_var_existe and (vr.produto_id <> v_id or vr.comercio_id <> v_com) then
      raise exception 'variacao_de_outro_produto' using errcode = '42501'; end if;
    if v_var_existe and vr.removida_em is not null then
      raise exception 'variacao_removida' using errcode = '23514'; end if;
    if btrim(coalesce(x->>'codigo_barras', '')) <> '' and btrim(x->>'codigo_barras') = btrim(coalesce(pr->>'codigo_barras', '')) then
      raise exception 'codigo_igual_ao_principal' using errcode = '23514'; end if;
    if x->>'codigo_barras' is not null and exists (select 1 from codigos_barras where comercio_id = v_com
       and codigo = x->>'codigo_barras' and variacao_id is distinct from (x->>'id')::uuid) then
      raise exception 'codigo_em_uso: %', x->>'codigo_barras' using errcode = '23505'; end if;
    if x->>'qtd_informada' is not null then
      perform public.qtd_valida((x->>'qtd_informada')::numeric, v_un, true); end if;
    if v_var_existe then
      update produto_variacoes set tamanho = x->>'tamanho', cor = x->>'cor', codigo_barras = x->>'codigo_barras',
        qtd_informada = (x->>'qtd_informada')::numeric where id = vr.id;
    else
      insert into produto_variacoes (id, comercio_id, produto_id, tamanho, cor, codigo_barras, qtd_informada)
      values ((x->>'id')::uuid, v_com, v_id, x->>'tamanho', x->>'cor', x->>'codigo_barras', (x->>'qtd_informada')::numeric);
    end if;
    v_ids := v_ids || (x->>'id')::uuid;
  end loop;
  -- Ausentes da lista = removidas; só sem saldo em nenhuma área.
  for vr in select * from produto_variacoes where produto_id = v_id and removida_em is null and not (id = any (v_ids)) loop
    if exists (select 1 from saldos where variacao_id = vr.id and quantidade > 0) then
      raise exception 'remocao_bloqueada' using errcode = '23514'; end if;
    update produto_variacoes set removida_em = now() where id = vr.id;
  end loop;
  if v_roupas and cardinality(v_ids) = 0 then raise exception 'roupas_exige_variacao' using errcode = '23514'; end if;
  -- Roupas: tamanho da lista, cor, código próprio, quantidade informada e combinação única.
  if v_roupas then
    for x in select * from jsonb_array_elements(p->'variacoes') loop
      if not (coalesce(x->>'tamanho', '') = any ('{P,M,G,GG,36,38,40,42,44}'::text[])) then
        raise exception 'tamanho_invalido: %', x->>'tamanho' using errcode = '23514'; end if;
      if nullif(btrim(coalesce(x->>'cor', '')), '') is null then raise exception 'cor_obrigatoria' using errcode = '23514'; end if;
      if nullif(btrim(coalesce(x->>'codigo_barras', '')), '') is null then raise exception 'codigo_da_variacao_obrigatorio' using errcode = '23514'; end if;
      if btrim(x->>'codigo_barras') = btrim(coalesce(pr->>'codigo_barras', '')) then
        raise exception 'codigo_igual_ao_principal' using errcode = '23514'; end if;
      if coalesce((x->>'qtd_informada')::numeric, 0) <= 0 then raise exception 'quantidade_informada_obrigatoria' using errcode = '23514'; end if;
    end loop;
    if exists (select 1 from jsonb_array_elements(p->'variacoes') e
               group by lower(btrim(e->>'tamanho')), lower(btrim(e->>'cor')) having count(*) > 1) then
      raise exception 'combinacao_repetida' using errcode = '23514'; end if;
  end if;
  if not v_roupas and cardinality(v_ids) > 0 then raise exception 'tipo_sem_variacoes' using errcode = '23514'; end if;

  -- Áreas.
  for x in select * from jsonb_array_elements(coalesce(p->'areas', '[]')) loop
    v_var := (x->>'variacao_id')::uuid; v_area := (x->>'area')::area_estoque;
    if v_roupas and (v_var is null or not (v_var = any (v_ids))) then
      raise exception 'variacao_invalida' using errcode = '23514'; end if;
    if not v_roupas and v_var is not null then raise exception 'variacao_invalida' using errcode = '23514'; end if;

    v_local := null;
    if jsonb_typeof(x->'local') = 'object' then
      if x->'local'->>'id' is not null then
        v_local := (x->'local'->>'id')::uuid;
        if not exists (select 1 from locais where id = v_local and comercio_id = v_com and area = v_area) then
          raise exception 'local_de_outro_comercio_ou_area' using errcode = '42501'; end if;
      else
        insert into locais (comercio_id, area, nome) values (v_com, v_area, btrim(x->'local'->>'nome'))
        on conflict (comercio_id, area, nome_norm) do nothing;
        select id into v_local from locais where comercio_id = v_com and area = v_area
          and nome_norm = lower(regexp_replace(btrim(x->'local'->>'nome'), '\s+', ' ', 'g'));
      end if;
    end if;

    v_min := case when x->>'minimo' is null then null else public.qtd_valida((x->>'minimo')::numeric, v_un, true) end;
    v_max := case when x->>'maximo' is null then null else public.qtd_valida((x->>'maximo')::numeric, v_un, true) end;
    if v_min is not null and v_max is not null and v_max < v_min then
      raise exception 'maximo_menor_que_minimo' using errcode = '23514'; end if;

    select local_id, true into v_old_local, v_tem_cfg from produto_areas
     where produto_id = v_id and variacao_id is not distinct from v_var and area = v_area;
    -- Pendente -> local válido é permitido mesmo com saldo; trocar ou apagar um local definido, não.
    if v_tem_cfg and v_old_local is not null and v_old_local is distinct from v_local and public.saldo_chave(v_id, v_var, v_area) > 0 then
      raise exception 'troca_de_local_exige_transferencia' using errcode = '23514'; end if;
    insert into produto_areas (comercio_id, produto_id, variacao_id, area, local_id, minimo, maximo, local_definido_por, local_definido_em)
    values (v_com, v_id, v_var, v_area, v_local, v_min, v_max,
            case when v_local is not null then v_uid end, case when v_local is not null then now() end)
    on conflict (produto_id, variacao_id, area) do update
      set local_id = excluded.local_id, minimo = excluded.minimo, maximo = excluded.maximo, updated_at = now(),
          local_definido_por = case when produto_areas.local_id is distinct from excluded.local_id then v_uid else produto_areas.local_definido_por end,
          local_definido_em = case when produto_areas.local_id is distinct from excluded.local_id then now() else produto_areas.local_definido_em end;
    v_tem_cfg := null;

    if jsonb_typeof(x->'contagem') = 'object' then
      if exists (select 1 from contagens where produto_id = v_id and variacao_id is not distinct from v_var and area = v_area) then
        raise exception 'contagem_ja_registrada' using errcode = '23505'; end if;
      v_q := public.qtd_valida((x->'contagem'->>'quantidade')::numeric, v_un, true);
      insert into contagens (operacao_id, comercio_id, produto_id, variacao_id, area, quantidade, criado_por)
      values (v_op, v_com, v_id, v_var, v_area, v_q, v_uid);
      v_cont := v_cont + 1;
      v_soma := 0;

      if v_q = 0 then
        if jsonb_array_length(coalesce(x->'contagem'->'partes', '[]')) > 0 then
          raise exception 'partes_em_area_sem_estoque' using errcode = '23514'; end if;
      elsif v_ctrl is not true then
        -- Sem controle de validade: um saldo único, sem lote.
        insert into saldos (comercio_id, produto_id, variacao_id, area, quantidade)
        values (v_com, v_id, v_var, v_area, v_q) returning id into v_saldo;
        insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, saldo_id, tipo, quantidade, criado_por)
        values (v_op, v_com, v_id, v_var, v_area, v_local, v_saldo, 'contagem_inicial', v_q, v_uid);
        v_soma := v_q;
      else
        for pt in select * from jsonb_array_elements(coalesce(x->'contagem'->'partes', '[]')) loop
          v_pq := public.qtd_valida((pt->>'quantidade')::numeric, v_un, false);
          v_venc := (pt->>'vencimento')::date;
          v_lote := public._lote_da_parte(v_com, v_id, v_var, pt->>'numero', v_venc);
          v_pend := v_venc is null or (v_farm and public.normalizar_lote(pt->>'numero') is null);
          if v_pend and v_farm and coalesce((pt->>'confirmada')::boolean, false) is false then
            raise exception 'pendencia_sem_confirmacao' using errcode = '23514'; end if;
          insert into saldos (comercio_id, produto_id, variacao_id, area, lote_id, pendente, pendencia_confirmada, quantidade)
          values (v_com, v_id, v_var, v_area, v_lote, v_pend, v_pend and v_farm, v_pq) returning id into v_saldo;
          insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, lote_id, saldo_id, tipo, quantidade, criado_por)
          values (v_op, v_com, v_id, v_var, v_area, v_local, v_lote, v_saldo, 'contagem_inicial', v_pq, v_uid);
          v_soma := v_soma + v_pq;
        end loop;
      end if;
      if v_soma <> v_q then raise exception 'soma_diferente_da_contagem' using errcode = '23514'; end if;
    end if;
  end loop;

  v_prev := jsonb_build_object('produto_id', v_id, 'contagens_registradas', v_cont);
  update operacoes set resultado = v_prev where id = v_op;
  return v_prev;
end $$;
revoke execute on function public.salvar_produto(jsonb) from public, anon;
grant execute on function public.salvar_produto(jsonb) to authenticated;

-- ---------- 16. Completar / dividir pendência ----------
-- p = { operacao_id, comercio_id, produto_id, origem_id, partes:[{numero, vencimento, quantidade, confirmada}] }
-- Partes somam exatamente a pendência; data e lote já conhecidos são mantidos; nenhum estoque novo.
create function public.resolver_pendencia(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_op uuid := (p->>'operacao_id')::uuid;
  v_com uuid := (p->>'comercio_id')::uuid;
  v_id uuid := (p->>'produto_id')::uuid;
  v_prev jsonb; s saldos%rowtype; l lotes%rowtype; v_un text; v_farm boolean; v_local uuid;
  pt jsonb; v_pq numeric; v_soma numeric := 0; v_num text; v_venc date; v_lote uuid; v_pend boolean; v_novo uuid; v_n int := 0;
  v_datas date[];
begin
  v_prev := public._iniciar_operacao(v_op, v_com, v_id, 'resolver_pendencia', md5((p - 'operacao_id')::text));
  if v_prev is not null then return v_prev; end if;

  select * into s from saldos where id = (p->>'origem_id')::uuid for update;
  if not found or s.comercio_id <> v_com or s.produto_id <> v_id then
    raise exception 'pendencia_de_outro_produto' using errcode = '42501'; end if;
  if not s.pendente or s.quantidade = 0 then raise exception 'nao_e_pendencia_aberta' using errcode = '23514'; end if;
  select unidade into v_un from produtos where id = v_id;
  select tipo = 'farmacia' into v_farm from comercios where id = v_com;
  select local_id into v_local from produto_areas where produto_id = v_id and variacao_id is not distinct from s.variacao_id and area = s.area;
  if s.lote_id is not null then select * into l from lotes where id = s.lote_id; end if;

  if jsonb_array_length(coalesce(p->'partes', '[]')) = 0 then raise exception 'sem_partes' using errcode = '22023'; end if;
  -- Lote com número conhecido e data desconhecida: a data pode ser preenchida uma vez,
  -- com confirmação explícita; o lote continua o mesmo nas duas áreas.
  if l.id is not null and l.numero_norm is not null and l.vencimento is null then
    select array_agg(distinct (e->>'vencimento')::date) filter (where e->>'vencimento' is not null)
      into v_datas from jsonb_array_elements(p->'partes') e;
    if cardinality(v_datas) > 1 then raise exception 'datas_diferentes_para_o_mesmo_lote' using errcode = '23514'; end if;
    if cardinality(v_datas) = 1 then
      if coalesce((p->>'confirmar_vencimento')::boolean, false) is false then
        raise exception 'confirmar_vencimento_do_lote' using errcode = '23514'; end if;
      update lotes set vencimento = v_datas[1], vencimento_definido_por = v_uid, vencimento_definido_em = now()
       where id = l.id and vencimento is null;
      l.vencimento := v_datas[1];
    end if;
  end if;
  for pt in select * from jsonb_array_elements(p->'partes') loop
    v_pq := public.qtd_valida((pt->>'quantidade')::numeric, v_un, false);
    v_num := coalesce(nullif(btrim(pt->>'numero'), ''), l.numero);
    v_venc := coalesce((pt->>'vencimento')::date, l.vencimento);
    if l.numero_norm is not null and public.normalizar_lote(v_num) is distinct from l.numero_norm then
      raise exception 'lote_conhecido_alterado' using errcode = '23514'; end if;
    if l.vencimento is not null and v_venc is distinct from l.vencimento then
      raise exception 'vencimento_conhecido_alterado' using errcode = '23514'; end if;
    v_lote := public._lote_da_parte(v_com, v_id, s.variacao_id, v_num, v_venc);
    v_pend := v_venc is null or (v_farm and public.normalizar_lote(v_num) is null);
    if v_pend and v_farm and coalesce((pt->>'confirmada')::boolean, s.pendencia_confirmada) is false then
      raise exception 'pendencia_sem_confirmacao' using errcode = '23514'; end if;
    insert into saldos (comercio_id, produto_id, variacao_id, area, lote_id, pendente, pendencia_confirmada, origem_id, quantidade)
    values (v_com, v_id, s.variacao_id, s.area, v_lote, v_pend, v_pend and v_farm, s.id, v_pq) returning id into v_novo;
    insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, lote_id, saldo_id, tipo, quantidade, criado_por)
    values (v_op, v_com, v_id, s.variacao_id, s.area, v_local, v_lote, v_novo, 'divisao_pendencia', v_pq, v_uid);
    v_soma := v_soma + v_pq; v_n := v_n + 1;
  end loop;
  if v_soma <> s.quantidade then
    raise exception 'soma_das_partes_diferente_da_pendencia: % de %', v_soma, s.quantidade using errcode = '23514'; end if;

  update saldos set quantidade = 0, updated_at = now() where id = s.id;
  insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, lote_id, saldo_id, tipo, quantidade, criado_por)
  values (v_op, v_com, v_id, s.variacao_id, s.area, v_local, s.lote_id, s.id, 'divisao_pendencia', -s.quantidade, v_uid);

  v_prev := jsonb_build_object('origem_id', s.id, 'partes', v_n);
  update operacoes set resultado = v_prev where id = v_op;
  return v_prev;
end $$;
revoke execute on function public.resolver_pendencia(jsonb) from public, anon;
grant execute on function public.resolver_pendencia(jsonb) to authenticated;