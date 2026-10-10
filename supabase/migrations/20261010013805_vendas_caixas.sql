-- Fase 3.1 — vendas pelo caixa do mercado (desenho aprovado pelo dono em 10/10/2026).
-- Regra do dono: SÓ DESCONTA QUANDO A VENDA É FINALIZADA NO CAIXA. O que chega aqui é a nota do cupom (NFC-e ou SAT),
-- que o sistema do caixa só emite depois que a venda fecha. Bipar não desconta nada.
-- Cada caixa é ligado com um código de 8 números e passa a ter uma chave própria (só o resumo sha256 fica no banco).
-- A venda desconta da área de venda (gôndola), validade mais próxima primeiro, com uma `operacoes` por produto (regra da base).
-- O estoque nunca fica negativo: o que foi vendido além do que o sistema tinha fica anotado em `qtd_faltou` (sinal para o antifurto).
-- Nota cancelada devolve exatamente o que tinha saído. Cada nota só conta uma vez (chave de 44 números).

/* ---------- tabelas ---------- */
create table public.caixas (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id),
  nome text not null check (length(btrim(nome)) between 1 and 40),
  codigo text check (codigo ~ '^[0-9]{8}$'),              -- código para ligar (vale 24 h; some depois de usado)
  codigo_gerado_em timestamptz,
  chave_hash text,                                         -- resumo da chave guardada no computador do caixa
  aparelho text,
  ligado_em timestamptz,
  desligado_em timestamptz,                                -- desligado pelo dono: a chave para de valer
  ultimo_contato_em timestamptz,
  ultima_venda_em timestamptz,
  created_at timestamptz not null default now()
);
create unique index caixas_codigo_unico on public.caixas (codigo) where codigo is not null;
create unique index caixas_chave_unica on public.caixas (chave_hash) where chave_hash is not null;
create index caixas_comercio_idx on public.caixas (comercio_id);

create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id),
  caixa_id uuid not null references public.caixas(id),
  chave_nota text not null unique check (chave_nota ~ '^[0-9]{44}$'),
  numero integer,
  serie integer,
  emitida_em timestamptz,
  total numeric(14,2) not null default 0 check (total >= 0),
  pagamentos jsonb not null default '[]',
  situacao text not null default 'finalizada' check (situacao in ('finalizada', 'cancelada')),
  cancelada_em timestamptz,
  recebida_em timestamptz not null default now(),
  origem text not null default 'conector' check (origem in ('conector', 'api')),
  nota jsonb                                               -- o que o caixa mandou, para conferência
);
create index vendas_comercio_idx on public.vendas (comercio_id, emitida_em desc);
create index vendas_caixa_idx on public.vendas (caixa_id, emitida_em desc);

create table public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id),
  comercio_id uuid not null references public.comercios(id),
  n_item integer not null check (n_item between 1 and 990),
  codigo_pdv text not null,                                -- código do produto no sistema do caixa
  codigo_barras text,                                      -- código de barras que veio na nota (quando há)
  descricao text not null,
  qtd_nota numeric(14,4) not null check (qtd_nota > 0),
  unidade_nota text,
  valor numeric(14,2) not null default 0 check (valor >= 0),
  produto_id uuid,
  variacao_id uuid,
  embalagem_id uuid references public.produto_embalagens(id),
  qtd_unidades numeric(14,3),                              -- em unidades de venda (embalagem já convertida)
  qtd_baixada numeric(14,3) not null default 0,            -- quanto saiu da gôndola
  qtd_faltou numeric(14,3) not null default 0,             -- vendido além do que o sistema tinha na gôndola
  partes jsonb not null default '[]',                      -- de quais saldos saiu (para devolver igual se cancelar)
  situacao text not null check (situacao in ('baixado', 'sem_cadastro', 'conferir', 'ignorado', 'cancelado')),
  motivo text,
  operacao_id uuid references public.operacoes(id),
  resolvido_em timestamptz,
  unique (venda_id, n_item),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id)
);
create index venda_itens_venda_idx on public.venda_itens (venda_id);
create index venda_itens_pendentes_idx on public.venda_itens (comercio_id, codigo_pdv) where situacao in ('sem_cadastro', 'conferir');
create index venda_itens_produto_comercio_fk_idx on public.venda_itens (produto_id, comercio_id);
create index venda_itens_variacao_produto_comercio_fk_idx on public.venda_itens (variacao_id, produto_id, comercio_id);
create index venda_itens_embalagem_fk_idx on public.venda_itens (embalagem_id);
create index venda_itens_operacao_fk_idx on public.venda_itens (operacao_id);
create index venda_itens_comercio_fk_idx on public.venda_itens (comercio_id);

-- Código do caixa ligado a um produto pelo dono (balança, código interno do caixa) ou "não controlar" (ex.: sacola).
create table public.codigos_pdv (
  comercio_id uuid not null references public.comercios(id),
  codigo text not null check (length(codigo) between 1 and 60),
  produto_id uuid,
  variacao_id uuid,
  embalagem_id uuid references public.produto_embalagens(id),
  ignorar boolean not null default false,
  criado_por uuid not null,
  criado_em timestamptz not null default now(),
  primary key (comercio_id, codigo),
  check (ignorar or produto_id is not null),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id)
);
create index codigos_pdv_produto_comercio_fk_idx on public.codigos_pdv (produto_id, comercio_id);
create index codigos_pdv_variacao_produto_comercio_fk_idx on public.codigos_pdv (variacao_id, produto_id, comercio_id);
create index codigos_pdv_embalagem_fk_idx on public.codigos_pdv (embalagem_id);

/* ---------- segurança: o dono só lê; tudo é gravado por funções ---------- */
alter table public.caixas enable row level security;
alter table public.vendas enable row level security;
alter table public.venda_itens enable row level security;
alter table public.codigos_pdv enable row level security;
create policy "dono ve caixas do seu comercio" on public.caixas for select to authenticated using ((select public.pode_acessar_comercio(comercio_id)));
create policy "dono ve vendas do seu comercio" on public.vendas for select to authenticated using ((select public.pode_acessar_comercio(comercio_id)));
create policy "dono ve itens vendidos do seu comercio" on public.venda_itens for select to authenticated using ((select public.pode_acessar_comercio(comercio_id)));
create policy "dono ve codigos do caixa do seu comercio" on public.codigos_pdv for select to authenticated using ((select public.pode_acessar_comercio(comercio_id)));
revoke all on public.caixas, public.vendas, public.venda_itens, public.codigos_pdv from anon, authenticated;
grant select (id, comercio_id, nome, codigo, codigo_gerado_em, aparelho, ligado_em, desligado_em, ultimo_contato_em, ultima_venda_em, created_at) on public.caixas to authenticated;
grant select on public.vendas, public.venda_itens, public.codigos_pdv to authenticated;

/* ---------- ajudantes ---------- */

/* Dígito verificador da chave da nota (módulo 11, como a Receita). */
create or replace function public.chave_nota_valida(_c text) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare s int := 0; p int := 2; i int; dv int;
begin
  if _c is null or _c !~ '^[0-9]{44}$' then return false; end if;
  for i in reverse 43..1 loop
    s := s + substr(_c, i, 1)::int * p;
    p := case when p = 9 then 2 else p + 1 end;
  end loop;
  dv := 11 - (s % 11);
  if dv >= 10 then dv := 0; end if;
  return dv = substr(_c, 44, 1)::int and substr(_c, 21, 2) in ('65', '59');
end $$;

/* Caixa dono da chave (ligado e não desligado). */
create or replace function public._caixa_da_chave(_chave text) returns public.caixas
language plpgsql security definer set search_path = public, pg_temp as $$
declare cx caixas%rowtype;
begin
  if _chave is null or _chave !~ '^[0-9a-f]{64}$' then raise exception 'caixa_desligado' using errcode = '42501'; end if;
  select * into cx from caixas where chave_hash = encode(extensions.digest(_chave, 'sha256'), 'hex') and desligado_em is null;
  if not found then raise exception 'caixa_desligado' using errcode = '42501'; end if;
  if not exists (select 1 from comercios where id = cx.comercio_id and ativo) then raise exception 'caixa_desligado' using errcode = '42501'; end if;
  update caixas set ultimo_contato_em = now() where id = cx.id and (ultimo_contato_em is null or ultimo_contato_em < now() - interval '1 minute');
  return cx;
end $$;

/* Qual produto é este item da nota: código ligado pelo dono, código de barras da nota ou o próprio código do caixa. */
create or replace function public._achar_item_venda(_com uuid, _codigo text, _ean text,
  out produto_id uuid, out variacao_id uuid, out embalagem_id uuid, out ignorar boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  select m.produto_id, m.variacao_id, m.embalagem_id, m.ignorar into produto_id, variacao_id, embalagem_id, ignorar
    from codigos_pdv m where m.comercio_id = _com and m.codigo = _codigo;
  if found then return; end if;
  ignorar := false;
  select cb.produto_id, cb.variacao_id, cb.embalagem_id into produto_id, variacao_id, embalagem_id
    from codigos_barras cb where cb.comercio_id = _com and cb.codigo = _ean and _ean is not null;
  if found then return; end if;
  select cb.produto_id, cb.variacao_id, cb.embalagem_id into produto_id, variacao_id, embalagem_id
    from codigos_barras cb where cb.comercio_id = _com and cb.codigo = _codigo;
end $$;

/* Converte a quantidade da nota em unidades de venda e confere a unidade. Devolve null com o motivo quando não dá. */
create or replace function public._unidades_item(_prod uuid, _emb uuid, _qtd numeric, out unidades numeric, out motivo text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_un text; v_mult numeric := 1;
begin
  select unidade into v_un from produtos where id = _prod;
  if _emb is not null then
    select quantidade into v_mult from produto_embalagens where id = _emb and produto_id = _prod;
    if not found then motivo := 'embalagem_nao_encontrada'; return; end if;
  end if;
  unidades := round(_qtd * v_mult, 3);
  if not public.unidade_fracionada(v_un) and unidades <> trunc(unidades) then
    unidades := null; motivo := 'quantidade_quebrada'; return;
  end if;
end $$;

/* Desconta um item da gôndola (só o que o sistema tem; o resto vira "faltou"). Uma operação permanente por item. */
create or replace function public._baixar_item_venda(_item uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare i venda_itens%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid(); v_disp numeric; v_baixa numeric; v_partes jsonb; v_lv uuid;
begin
  select * into i from venda_itens where id = _item for update;
  select * into c from comercios where id = i.comercio_id;
  perform pg_advisory_xact_lock(hashtextextended(i.produto_id::text, 0));
  v_disp := public.saldo_chave(i.produto_id, i.variacao_id, 'venda');
  v_baixa := least(v_disp, i.qtd_unidades);
  select local_id into v_lv from produto_areas where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id and area = 'venda';
  insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash)
  values (v_op, c.dono_id, c.id, i.produto_id, 'venda', md5(i.id::text || ':venda'));
  v_partes := public._tirar_saldo(c.id, i.produto_id, i.variacao_id, 'venda', v_baixa, v_op, c.dono_id, null, 'venda', v_lv);
  update venda_itens set situacao = 'baixado', qtd_baixada = v_baixa, qtd_faltou = i.qtd_unidades - v_baixa, partes = v_partes,
         operacao_id = v_op, motivo = null where id = i.id;
  update operacoes set resultado = jsonb_build_object('venda', i.venda_id, 'item', i.id, 'vendido', i.qtd_unidades, 'baixado', v_baixa,
         'faltou', i.qtd_unidades - v_baixa) where id = v_op;
end $$;

/* Devolve para a gôndola exatamente o que um item tinha tirado (nota cancelada). */
create or replace function public._devolver_item_venda(_item uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare i venda_itens%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid(); pt jsonb; v_lv uuid;
begin
  select * into i from venda_itens where id = _item for update;
  select * into c from comercios where id = i.comercio_id;
  if i.qtd_baixada > 0 then
    perform pg_advisory_xact_lock(hashtextextended(i.produto_id::text, 0));
    select local_id into v_lv from produto_areas where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id and area = 'venda';
    insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash, resultado)
    values (v_op, c.dono_id, c.id, i.produto_id, 'cancelamento_venda', md5(i.id::text || ':cancelamento'),
            jsonb_build_object('venda', i.venda_id, 'item', i.id, 'devolvido', i.qtd_baixada));
    for pt in select * from jsonb_array_elements(i.partes) loop
      perform public._por_saldo(c.id, i.produto_id, i.variacao_id, 'venda', (pt->>'lote_id')::uuid, (pt->>'pendente')::boolean,
        (pt->>'pendencia_confirmada')::boolean, (pt->>'quantidade')::numeric, v_op, c.dono_id, null, 'cancelamento_venda', v_lv);
    end loop;
  end if;
  update venda_itens set situacao = 'cancelado' where id = i.id;
end $$;

/* ---------- computador do caixa (sem login, com a chave do caixa) ---------- */

/* Ligar o caixa com o código de 8 números. Devolve a chave que fica guardada no computador do caixa. */
create or replace function public.conector_ligar(_codigo text, _aparelho text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cx caixas%rowtype; c comercios%rowtype; v_chave text;
begin
  _codigo := regexp_replace(coalesce(_codigo, ''), '\D', '', 'g');
  if _codigo !~ '^[0-9]{8}$' then raise exception 'codigo_invalido' using errcode = '42501'; end if;
  select * into cx from caixas where codigo = _codigo and desligado_em is null for update;
  if not found then raise exception 'codigo_invalido' using errcode = '42501'; end if;
  if cx.codigo_gerado_em < now() - interval '24 hours' then raise exception 'codigo_expirado' using errcode = '42501'; end if;
  select * into c from comercios where id = cx.comercio_id;
  if not c.ativo then raise exception 'codigo_invalido' using errcode = '42501'; end if;
  v_chave := encode(extensions.gen_random_bytes(32), 'hex');
  update caixas set chave_hash = encode(extensions.digest(v_chave, 'sha256'), 'hex'), codigo = null, ligado_em = now(), ultimo_contato_em = now(),
         aparelho = left(nullif(btrim(coalesce(_aparelho, '')), ''), 120) where id = cx.id;
  return jsonb_build_object('chave', v_chave, 'caixa', cx.nome, 'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo));
end $$;

/* Situação do caixa para a tela do conector (também avisa o Omni que o caixa está ligado). null = desligado. */
create or replace function public.conector_estado(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cx caixas%rowtype; c comercios%rowtype; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_n int; v_total numeric;
begin
  begin cx := public._caixa_da_chave(_chave); exception when others then return null; end;
  select * into c from comercios where id = cx.comercio_id;
  select count(*), coalesce(sum(total), 0) into v_n, v_total from vendas
   where caixa_id = cx.id and situacao = 'finalizada' and (coalesce(emitida_em, recebida_em) at time zone 'America/Sao_Paulo')::date = v_hoje;
  return jsonb_build_object('caixa', cx.nome, 'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo, 'documento', case when c.documento_tipo = 'cnpj' then c.documento end),
    'ultima_venda_em', cx.ultima_venda_em, 'hoje', jsonb_build_object('vendas', v_n, 'total', v_total));
end $$;

/* Uma venda FINALIZADA no caixa (a nota do cupom). Repetir a mesma nota não conta de novo.
   _nota = {chave, numero, serie, emitida_em, total, pagamentos:[{forma, valor}], itens:[{n, codigo, ean, descricao, qtd, unidade, valor}]} */
create or replace function public.conector_enviar_venda(_chave text, _nota jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cx caixas%rowtype; c comercios%rowtype; vd vendas%rowtype; v_chave_nota text; v_id uuid := gen_random_uuid(); it jsonb; a record; v_unid numeric;
  v_n int; v_qtd numeric; v_cod text; v_ean text; v_sit text; v_mot text; v_emitida timestamptz; v_sem int := 0; v_itens int := 0; r record;
begin
  cx := public._caixa_da_chave(_chave);
  select * into c from comercios where id = cx.comercio_id;
  v_chave_nota := _nota->>'chave';
  if not public.chave_nota_valida(v_chave_nota) then raise exception 'nota_invalida' using errcode = '22023'; end if;
  if c.documento_tipo = 'cnpj' and substr(v_chave_nota, 7, 14) <> c.documento then raise exception 'nota_de_outro_cnpj' using errcode = '42501'; end if;
  if jsonb_typeof(_nota->'itens') <> 'array' or jsonb_array_length(_nota->'itens') not between 1 and 990 then raise exception 'nota_sem_itens' using errcode = '22023'; end if;
  begin v_emitida := (_nota->>'emitida_em')::timestamptz; exception when others then raise exception 'nota_invalida' using errcode = '22023'; end;
  if v_emitida is null or v_emitida > now() + interval '1 day' then raise exception 'nota_invalida' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_chave_nota, 0));
  select * into vd from vendas where chave_nota = v_chave_nota;
  if found then
    if vd.comercio_id <> cx.comercio_id then raise exception 'nota_de_outro_comercio' using errcode = '42501'; end if;
    return jsonb_build_object('situacao', case when vd.situacao = 'cancelada' then 'cancelada' else 'repetida' end, 'venda', vd.id);
  end if;

  insert into vendas (id, comercio_id, caixa_id, chave_nota, numero, serie, emitida_em, total, pagamentos, origem, nota)
  values (v_id, c.id, cx.id, v_chave_nota, nullif(_nota->>'numero', '')::int, nullif(_nota->>'serie', '')::int, v_emitida,
          greatest(coalesce((_nota->>'total')::numeric, 0), 0), coalesce(_nota->'pagamentos', '[]'), 'conector', _nota);

  for it in select * from jsonb_array_elements(_nota->'itens') loop
    v_itens := v_itens + 1;
    v_n := coalesce(nullif(it->>'n', '')::int, v_itens);
    v_cod := left(nullif(btrim(coalesce(it->>'codigo', '')), ''), 60);
    v_ean := nullif(regexp_replace(coalesce(it->>'ean', ''), '\D', '', 'g'), '');
    v_qtd := round(coalesce((it->>'qtd')::numeric, 0), 4);
    if v_qtd <= 0 then raise exception 'item_sem_quantidade' using errcode = '22023'; end if;
    v_cod := coalesce(v_cod, v_ean, 'item ' || v_n);
    select * into a from public._achar_item_venda(c.id, v_cod, v_ean);
    v_sit := null; v_mot := null; v_unid := null;
    if coalesce(a.ignorar, false) then v_sit := 'ignorado';
    elsif a.produto_id is null then v_sit := 'sem_cadastro'; v_sem := v_sem + 1;
    else
      select x.unidades, x.motivo into v_unid, v_mot from public._unidades_item(a.produto_id, a.embalagem_id, v_qtd) x;
      if v_unid is null then v_sit := 'conferir'; v_sem := v_sem + 1; end if;
    end if;
    insert into venda_itens (venda_id, comercio_id, n_item, codigo_pdv, codigo_barras, descricao, qtd_nota, unidade_nota, valor,
                             produto_id, variacao_id, embalagem_id, qtd_unidades, situacao, motivo)
    values (v_id, c.id, v_n, v_cod, v_ean, left(coalesce(nullif(btrim(it->>'descricao'), ''), v_cod), 120), v_qtd, left(it->>'unidade', 10),
            greatest(coalesce((it->>'valor')::numeric, 0), 0),
            case when v_sit in ('sem_cadastro', 'ignorado') then null else a.produto_id end,
            case when v_sit in ('sem_cadastro', 'ignorado') then null else a.variacao_id end,
            case when v_sit in ('sem_cadastro', 'ignorado') then null else a.embalagem_id end,
            v_unid, coalesce(v_sit, 'baixado'), v_mot);
  end loop;

  -- Desconta da gôndola, produto por produto, sempre na mesma ordem (evita travar com outro caixa).
  for r in select id from venda_itens where venda_id = v_id and situacao = 'baixado' order by produto_id, n_item loop
    perform public._baixar_item_venda(r.id);
  end loop;

  update caixas set ultima_venda_em = greatest(coalesce(ultima_venda_em, v_emitida), v_emitida) where id = cx.id;
  return jsonb_build_object('situacao', 'registrada', 'venda', v_id, 'itens', v_itens, 'sem_cadastro', v_sem);
end $$;

/* Nota cancelada no caixa: devolve à gôndola o que a venda tinha tirado. Se o cancelamento chegar antes da venda, ela já fica cancelada. */
create or replace function public.conector_cancelar_venda(_chave text, _chave_nota text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cx caixas%rowtype; vd vendas%rowtype; r record;
begin
  cx := public._caixa_da_chave(_chave);
  if not public.chave_nota_valida(_chave_nota) then raise exception 'nota_invalida' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(_chave_nota, 0));
  select * into vd from vendas where chave_nota = _chave_nota for update;
  if not found then
    insert into vendas (comercio_id, caixa_id, chave_nota, situacao, cancelada_em) values (cx.comercio_id, cx.id, _chave_nota, 'cancelada', now());
    return jsonb_build_object('situacao', 'cancelada');
  end if;
  if vd.comercio_id <> cx.comercio_id then raise exception 'nota_de_outro_comercio' using errcode = '42501'; end if;
  if vd.situacao = 'cancelada' then return jsonb_build_object('situacao', 'repetida'); end if;
  for r in select id from venda_itens where venda_id = vd.id order by produto_id nulls last, n_item loop
    perform public._devolver_item_venda(r.id);
  end loop;
  update vendas set situacao = 'cancelada', cancelada_em = now() where id = vd.id;
  return jsonb_build_object('situacao', 'cancelada', 'venda', vd.id);
end $$;

/* ---------- dono ---------- */

create or replace function public._codigo_caixa_novo() returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v text;
begin
  loop
    v := lpad((floor(random() * 100000000))::bigint::text, 8, '0');
    exit when not exists (select 1 from caixas where codigo = v);
  end loop;
  return v;
end $$;

/* Novo caixa: devolve o código para ligar no computador do caixa. */
create or replace function public.criar_caixa(_comercio uuid, _nome text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_cod text;
begin
  if not public.pode_acessar_comercio(_comercio) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if (select count(*) from caixas where comercio_id = _comercio and desligado_em is null) >= 50 then raise exception 'caixas_demais' using errcode = '23514'; end if;
  v_cod := public._codigo_caixa_novo();
  insert into caixas (comercio_id, nome, codigo, codigo_gerado_em) values (_comercio, btrim(coalesce(_nome, '')), v_cod, now()) returning id into v_id;
  return jsonb_build_object('id', v_id, 'codigo', v_cod);
end $$;

create or replace function public.renomear_caixa(_id uuid, _nome text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from caixas where id = _id and public.pode_acessar_comercio(comercio_id)) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  update caixas set nome = btrim(coalesce(_nome, '')) where id = _id;
end $$;

/* Código novo (trocou o computador, ou religar um caixa desligado). A chave antiga continua até o código novo ser usado. */
create or replace function public.novo_codigo_caixa(_id uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cod text := public._codigo_caixa_novo();
begin
  if not exists (select 1 from caixas where id = _id and public.pode_acessar_comercio(comercio_id)) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  update caixas set codigo = v_cod, codigo_gerado_em = now(), desligado_em = null,
         chave_hash = case when desligado_em is not null then null else chave_hash end where id = _id;
  return v_cod;
end $$;

/* Desligar: a chave do computador do caixa para de valer na hora. */
create or replace function public.desligar_caixa(_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from caixas where id = _id and public.pode_acessar_comercio(comercio_id)) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  update caixas set desligado_em = now(), chave_hash = null, codigo = null where id = _id;
end $$;

/* "Vendido sem cadastro": ligar o código do caixa a um produto (desconta agora todas as vendas pendentes desse código)
   ou marcar para não controlar (ex.: sacola). Vale também para as próximas vendas. */
create or replace function public.resolver_item_venda(_item uuid, _acao text, _produto uuid, _variacao uuid, _embalagem uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare i venda_itens%rowtype; r record; v_unid numeric; v_mot text; v_n int := 0; v_conferir int := 0;
begin
  select * into i from venda_itens where id = _item;
  if not found or not public.pode_acessar_comercio(i.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if i.situacao not in ('sem_cadastro', 'conferir') then raise exception 'item_ja_resolvido' using errcode = '23514'; end if;
  if _acao = 'ignorar' then
    insert into codigos_pdv (comercio_id, codigo, ignorar, criado_por) values (i.comercio_id, i.codigo_pdv, true, auth.uid())
    on conflict (comercio_id, codigo) do update set produto_id = null, variacao_id = null, embalagem_id = null, ignorar = true, criado_por = excluded.criado_por, criado_em = now();
    update venda_itens vi set situacao = 'ignorado', produto_id = null, variacao_id = null, embalagem_id = null, qtd_unidades = null, motivo = null, resolvido_em = now()
      from vendas v where v.id = vi.venda_id and v.situacao = 'finalizada'
       and vi.comercio_id = i.comercio_id and vi.codigo_pdv = i.codigo_pdv and vi.situacao in ('sem_cadastro', 'conferir');
    get diagnostics v_n = row_count;
    return jsonb_build_object('itens', v_n);
  end if;
  if _acao <> 'ligar' then raise exception 'acao_invalida' using errcode = '22023'; end if;
  if not exists (select 1 from produtos where id = _produto and comercio_id = i.comercio_id) then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
  if _variacao is not null and not exists (select 1 from produto_variacoes where id = _variacao and produto_id = _produto and removida_em is null) then
    raise exception 'variacao_invalida' using errcode = '22023'; end if;
  if _embalagem is not null and not exists (select 1 from produto_embalagens where id = _embalagem and produto_id = _produto and removida_em is null) then
    raise exception 'embalagem_invalida' using errcode = '22023'; end if;
  insert into codigos_pdv (comercio_id, codigo, produto_id, variacao_id, embalagem_id, ignorar, criado_por)
  values (i.comercio_id, i.codigo_pdv, _produto, _variacao, _embalagem, false, auth.uid())
  on conflict (comercio_id, codigo) do update set produto_id = excluded.produto_id, variacao_id = excluded.variacao_id, embalagem_id = excluded.embalagem_id,
     ignorar = false, criado_por = excluded.criado_por, criado_em = now();
  for r in select vi.id, vi.qtd_nota from venda_itens vi join vendas v on v.id = vi.venda_id
            where vi.comercio_id = i.comercio_id and vi.codigo_pdv = i.codigo_pdv and vi.situacao in ('sem_cadastro', 'conferir') and v.situacao = 'finalizada'
            order by vi.id for update of vi loop
    select x.unidades, x.motivo into v_unid, v_mot from public._unidades_item(_produto, _embalagem, r.qtd_nota) x;
    if v_unid is null then
      update venda_itens set produto_id = _produto, variacao_id = _variacao, embalagem_id = _embalagem, situacao = 'conferir', motivo = v_mot where id = r.id;
      v_conferir := v_conferir + 1;
    else
      update venda_itens set produto_id = _produto, variacao_id = _variacao, embalagem_id = _embalagem, qtd_unidades = v_unid, situacao = 'baixado', resolvido_em = now() where id = r.id;
      perform public._baixar_item_venda(r.id);
      v_n := v_n + 1;
    end if;
  end loop;
  return jsonb_build_object('itens', v_n, 'conferir', v_conferir);
end $$;

/* ---------- permissões das funções ---------- */
revoke all on function public.chave_nota_valida(text), public._caixa_da_chave(text), public._achar_item_venda(uuid, text, text),
  public._unidades_item(uuid, uuid, numeric), public._baixar_item_venda(uuid), public._devolver_item_venda(uuid), public._codigo_caixa_novo(),
  public.conector_ligar(text, text), public.conector_estado(text), public.conector_enviar_venda(text, jsonb), public.conector_cancelar_venda(text, text),
  public.criar_caixa(uuid, text), public.renomear_caixa(uuid, text), public.novo_codigo_caixa(uuid), public.desligar_caixa(uuid),
  public.resolver_item_venda(uuid, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.conector_ligar(text, text), public.conector_estado(text), public.conector_enviar_venda(text, jsonb),
  public.conector_cancelar_venda(text, text), public.chave_nota_valida(text) to anon, authenticated;
grant execute on function public.criar_caixa(uuid, text), public.renomear_caixa(uuid, text), public.novo_codigo_caixa(uuid),
  public.desligar_caixa(uuid), public.resolver_item_venda(uuid, text, uuid, uuid, uuid) to authenticated;
