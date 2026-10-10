-- C1 — caixa no celular (desenho aprovado pelo dono em 10/10/2026: "Sim, pode fazer").
-- O caixa fica no app da equipe (Omni Operação): o funcionário com a função "Caixa" abre o caixa com o troco da gaveta,
-- bipa, recebe (dinheiro, Pix, cartão ou fiado) e finaliza. Vale a regra do dono: SÓ DESCONTA QUANDO A VENDA É FINALIZADA.
-- A venda do celular não tem nota fiscal (o celular não emite NFC-e): é controle de estoque e de dinheiro.
-- Cada venda tem um id gerado no celular: sem internet ela fica guardada e, ao chegar, nunca conta duas vezes.
-- Cancelar venda e tirar dinheiro da gaveta (sangria) pedem o PIN do dono, digitado no celular do funcionário.
-- Fechar o caixa compara o dinheiro contado com o esperado (troco + dinheiro recebido − troco dado − sangrias).
-- Fiado: clientes e contas do fiado por comércio; a compra no fiado soma na conta, pagamento e cancelamento descontam.
-- Regra da base: cada produto vendido ou devolvido grava uma `operacoes` na mesma transação (reaproveita _baixar/_devolver).

/* ---------- funcionário que opera o caixa ---------- */
alter table public.funcionarios add column caixa boolean not null default false;
grant select (caixa) on public.funcionarios to authenticated;

/* ---------- o caixa do celular é um caixa do comércio (um por funcionário) ---------- */
alter table public.caixas
  add column tipo text not null default 'computador' check (tipo in ('computador', 'celular')),
  add column funcionario_id uuid references public.funcionarios(id);
alter table public.caixas add constraint caixas_celular_tem_funcionario check ((tipo = 'celular') = (funcionario_id is not null));
create unique index caixas_celular_unico on public.caixas (funcionario_id) where funcionario_id is not null;
grant select (tipo, funcionario_id) on public.caixas to authenticated;

/* ---------- número da venda do celular (por comércio) ---------- */
alter table public.comercios add column proximo_numero_venda bigint not null default 1;

/* ---------- PIN do dono (autoriza cancelamento e sangria no celular do funcionário) ---------- */
create table public.dono_pin (
  dono_id uuid primary key,
  pin_hash text not null,
  criado_em timestamptz not null default now(),
  tentativas int not null default 0,
  travado_ate timestamptz
);

/* ---------- abertura e fechamento do caixa ---------- */
create table public.caixa_turnos (
  id uuid primary key,                                     -- gerado no celular
  comercio_id uuid not null references public.comercios(id),
  caixa_id uuid not null references public.caixas(id),
  funcionario_id uuid not null references public.funcionarios(id),
  aberto_em timestamptz not null default now(),
  troco_inicial numeric(12,2) not null check (troco_inicial between 0 and 100000),
  situacao text not null default 'aberto' check (situacao in ('aberto', 'fechado')),
  fechado_em timestamptz,
  dinheiro_esperado numeric(12,2),
  dinheiro_contado numeric(12,2) check (dinheiro_contado between 0 and 1000000),
  diferenca numeric(12,2),
  observacao text check (char_length(observacao) <= 300),
  conferido_em timestamptz,                                -- o dono viu o fechamento
  check ((situacao = 'fechado') = (fechado_em is not null))
);
create unique index caixa_turnos_um_aberto on public.caixa_turnos (funcionario_id) where situacao = 'aberto';
create index caixa_turnos_comercio_idx on public.caixa_turnos (comercio_id, aberto_em desc);
create index caixa_turnos_caixa_fk_idx on public.caixa_turnos (caixa_id);

create table public.caixa_sangrias (
  id uuid primary key,                                     -- gerado no celular
  comercio_id uuid not null references public.comercios(id),
  turno_id uuid not null references public.caixa_turnos(id),
  funcionario_id uuid not null references public.funcionarios(id),
  valor numeric(12,2) not null check (valor > 0 and valor <= 100000),
  motivo text check (char_length(motivo) <= 120),
  criado_em timestamptz not null default now()
);
create index caixa_sangrias_turno_idx on public.caixa_sangrias (turno_id);
create index caixa_sangrias_comercio_fk_idx on public.caixa_sangrias (comercio_id);
create index caixa_sangrias_funcionario_fk_idx on public.caixa_sangrias (funcionario_id);

/* ---------- fiado ---------- */
create table public.clientes_fiado (
  id uuid primary key,                                     -- gerado no celular ou no app do dono
  comercio_id uuid not null references public.comercios(id),
  nome text not null check (char_length(btrim(nome)) between 2 and 60),
  telefone text check (telefone ~ '^[0-9]{10,11}$'),
  ativo boolean not null default true,
  criado_por_funcionario uuid references public.funcionarios(id),
  created_at timestamptz not null default now()
);
create index clientes_fiado_comercio_idx on public.clientes_fiado (comercio_id, nome);
create index clientes_fiado_funcionario_fk_idx on public.clientes_fiado (criado_por_funcionario);

/* ---------- vendas do celular ---------- */
alter table public.vendas alter column chave_nota drop not null;
alter table public.vendas drop constraint vendas_origem_check;
alter table public.vendas add constraint vendas_origem_check check (origem in ('conector', 'api', 'celular'));
alter table public.vendas add constraint vendas_nota_ou_celular check (chave_nota is not null or origem = 'celular');
alter table public.vendas
  add column turno_id uuid references public.caixa_turnos(id),
  add column funcionario_id uuid references public.funcionarios(id),
  add column troco numeric(12,2) not null default 0 check (troco >= 0),
  add column cliente_fiado_id uuid references public.clientes_fiado(id),
  add column cancelada_por text check (cancelada_por in ('funcionario', 'dono')),
  add column motivo_cancelamento text check (char_length(motivo_cancelamento) <= 200);
create index vendas_turno_idx on public.vendas (turno_id) where turno_id is not null;
create index vendas_funcionario_fk_idx on public.vendas (funcionario_id);
create index vendas_cliente_fiado_fk_idx on public.vendas (cliente_fiado_id);

create table public.fiado_movimentos (
  id uuid primary key,
  comercio_id uuid not null references public.comercios(id),
  cliente_id uuid not null references public.clientes_fiado(id),
  tipo text not null check (tipo in ('compra', 'pagamento', 'cancelamento')),  -- compra soma na conta; pagamento e cancelamento descontam
  valor numeric(12,2) not null check (valor > 0 and valor <= 1000000),
  venda_id uuid references public.vendas(id),
  forma text check (forma in ('dinheiro', 'pix', 'cartao')),
  observacao text check (char_length(observacao) <= 200),
  funcionario_id uuid references public.funcionarios(id),
  registrado_por uuid,
  criado_em timestamptz not null default now(),
  check ((tipo = 'pagamento') = (forma is not null)),
  check ((tipo = 'pagamento') = (venda_id is null))
);
create unique index fiado_movimentos_venda_tipo on public.fiado_movimentos (venda_id, tipo) where venda_id is not null;
create index fiado_movimentos_cliente_idx on public.fiado_movimentos (cliente_id, criado_em);
create index fiado_movimentos_comercio_fk_idx on public.fiado_movimentos (comercio_id);
create index fiado_movimentos_funcionario_fk_idx on public.fiado_movimentos (funcionario_id);

/* ---------- segurança: o dono só lê; tudo é gravado por funções. O PIN do dono ninguém lê. ---------- */
alter table public.dono_pin enable row level security;
alter table public.caixa_turnos enable row level security;
alter table public.caixa_sangrias enable row level security;
alter table public.clientes_fiado enable row level security;
alter table public.fiado_movimentos enable row level security;
create policy "dono ve turnos de caixa do seu comercio" on public.caixa_turnos for select to authenticated using ((select public.pode_acessar_comercio(comercio_id)));
create policy "dono ve sangrias do seu comercio" on public.caixa_sangrias for select to authenticated using ((select public.pode_acessar_comercio(comercio_id)));
create policy "dono ve clientes do fiado do seu comercio" on public.clientes_fiado for select to authenticated using ((select public.pode_acessar_comercio(comercio_id)));
create policy "dono ve contas do fiado do seu comercio" on public.fiado_movimentos for select to authenticated using ((select public.pode_acessar_comercio(comercio_id)));
revoke all on public.dono_pin, public.caixa_turnos, public.caixa_sangrias, public.clientes_fiado, public.fiado_movimentos from anon, authenticated;
grant select on public.caixa_turnos, public.caixa_sangrias, public.clientes_fiado, public.fiado_movimentos to authenticated;

/* ---------- baixa e devolução guardam quem vendeu (venda do celular) ---------- */
create or replace function public._baixar_item_venda(_item uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare i venda_itens%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid(); v_disp numeric; v_baixa numeric; v_partes jsonb; v_lv uuid; v_func uuid;
begin
  select * into i from venda_itens where id = _item for update;
  select * into c from comercios where id = i.comercio_id;
  select funcionario_id into v_func from vendas where id = i.venda_id;
  perform pg_advisory_xact_lock(hashtextextended(i.produto_id::text, 0));
  v_disp := public.saldo_chave(i.produto_id, i.variacao_id, 'venda');
  v_baixa := least(v_disp, i.qtd_unidades);
  select local_id into v_lv from produto_areas where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id and area = 'venda';
  insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash, funcionario_id)
  values (v_op, c.dono_id, c.id, i.produto_id, 'venda', md5(i.id::text || ':venda'), v_func);
  v_partes := public._tirar_saldo(c.id, i.produto_id, i.variacao_id, 'venda', v_baixa, v_op, c.dono_id, v_func, 'venda', v_lv);
  update venda_itens set situacao = 'baixado', qtd_baixada = v_baixa, qtd_faltou = i.qtd_unidades - v_baixa, partes = v_partes,
         operacao_id = v_op, motivo = null where id = i.id;
  update operacoes set resultado = jsonb_build_object('venda', i.venda_id, 'item', i.id, 'vendido', i.qtd_unidades, 'baixado', v_baixa,
         'faltou', i.qtd_unidades - v_baixa) where id = v_op;
end $$;

create or replace function public._devolver_item_venda(_item uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare i venda_itens%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid(); pt jsonb; v_lv uuid; v_func uuid;
begin
  select * into i from venda_itens where id = _item for update;
  select * into c from comercios where id = i.comercio_id;
  select funcionario_id into v_func from vendas where id = i.venda_id;
  if i.qtd_baixada > 0 then
    perform pg_advisory_xact_lock(hashtextextended(i.produto_id::text, 0));
    select local_id into v_lv from produto_areas where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id and area = 'venda';
    insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash, resultado, funcionario_id)
    values (v_op, c.dono_id, c.id, i.produto_id, 'cancelamento_venda', md5(i.id::text || ':cancelamento'),
            jsonb_build_object('venda', i.venda_id, 'item', i.id, 'devolvido', i.qtd_baixada), v_func);
    for pt in select * from jsonb_array_elements(i.partes) loop
      perform public._por_saldo(c.id, i.produto_id, i.variacao_id, 'venda', (pt->>'lote_id')::uuid, (pt->>'pendente')::boolean,
        (pt->>'pendencia_confirmada')::boolean, (pt->>'quantidade')::numeric, v_op, c.dono_id, v_func, 'cancelamento_venda', v_lv);
    end loop;
  end if;
  update venda_itens set situacao = 'cancelado' where id = i.id;
end $$;

/* ---------- ajudantes ---------- */

/* Funcionário com a função Caixa (PIN digitado há pouco). */
create or replace function public._funcionario_caixa(_chave text) returns public.funcionarios
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_da_chave(_chave);
  if not v.caixa then raise exception 'funcao_nao_permite_caixa' using errcode = '42501'; end if;
  return v;
end $$;

/* Confere o PIN do dono do comércio. null = certo; senão o motivo (sem desfazer, para a contagem de tentativas ficar gravada). */
create or replace function public._conferir_pin_dono(_com uuid, _pin text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare d dono_pin%rowtype;
begin
  select dp.* into d from dono_pin dp join comercios c on c.dono_id = dp.dono_id where c.id = _com for update of dp;
  if not found then return 'dono_sem_pin'; end if;
  if d.travado_ate is not null and d.travado_ate > now() then
    return 'muitas_tentativas:' || ceil(extract(epoch from (d.travado_ate - now())) / 60)::int; end if;
  if _pin is null or _pin !~ '^[0-9]{4}$' then return 'pin_formato'; end if;
  if extensions.crypt(_pin, d.pin_hash) <> d.pin_hash then
    if d.tentativas + 1 >= 5 then
      update dono_pin set tentativas = 0, travado_ate = now() + interval '15 minutes' where dono_id = d.dono_id;
      return 'muitas_tentativas:15';
    end if;
    update dono_pin set tentativas = tentativas + 1 where dono_id = d.dono_id;
    return 'pin_errado:' || (5 - d.tentativas - 1);
  end if;
  update dono_pin set tentativas = 0, travado_ate = null where dono_id = d.dono_id and (tentativas > 0 or travado_ate is not null);
  return null;
end $$;

/* Resumo de um turno: vendas, total por forma de pagamento, sangrias e o dinheiro que deveria ter na gaveta. */
create or replace function public._resumo_turno(_turno uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare t caixa_turnos%rowtype; v_n int; v_total numeric; v_canc int; v_troco numeric; v_sang numeric; f jsonb;
begin
  select * into t from caixa_turnos where id = _turno;
  select count(*) filter (where situacao = 'finalizada'), coalesce(sum(total) filter (where situacao = 'finalizada'), 0),
         count(*) filter (where situacao = 'cancelada'), coalesce(sum(troco) filter (where situacao = 'finalizada'), 0)
    into v_n, v_total, v_canc, v_troco from vendas where turno_id = t.id;
  select jsonb_build_object(
      'dinheiro', coalesce(sum((p->>'valor')::numeric) filter (where p->>'forma' = 'dinheiro'), 0),
      'pix', coalesce(sum((p->>'valor')::numeric) filter (where p->>'forma' = 'pix'), 0),
      'cartao', coalesce(sum((p->>'valor')::numeric) filter (where p->>'forma' = 'cartao'), 0),
      'fiado', coalesce(sum((p->>'valor')::numeric) filter (where p->>'forma' = 'fiado'), 0))
    into f from vendas vd cross join lateral jsonb_array_elements(vd.pagamentos) p where vd.turno_id = t.id and vd.situacao = 'finalizada';
  select coalesce(sum(valor), 0) into v_sang from caixa_sangrias where turno_id = t.id;
  return jsonb_build_object('id', t.id, 'situacao', t.situacao, 'aberto_em', t.aberto_em, 'fechado_em', t.fechado_em,
    'troco_inicial', t.troco_inicial, 'vendas', v_n, 'canceladas', v_canc, 'total', v_total,
    'por_forma', f, 'troco_dado', v_troco, 'sangrias', v_sang,
    'dinheiro_esperado', coalesce(t.dinheiro_esperado, t.troco_inicial + (f->>'dinheiro')::numeric - v_troco - v_sang),
    'dinheiro_contado', t.dinheiro_contado, 'diferenca', t.diferenca);
end $$;

/* ---------- celular do funcionário (sem login, com a chave do celular) ---------- */

/* Situação do caixa: comércio (para o comprovante), se o dono já criou o PIN, o turno aberto e as vendas dele. */
create or replace function public.caixa_estado(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; c comercios%rowtype; t caixa_turnos%rowtype; v_vendas jsonb;
begin
  v := public._funcionario_caixa(_chave);
  select * into c from comercios where id = v.comercio_id;
  select * into t from caixa_turnos where funcionario_id = v.id and situacao = 'aberto';
  if found then
    select coalesce(jsonb_agg(x order by x->>'feita_em' desc), '[]') into v_vendas from (
      select jsonb_build_object('id', vd.id, 'numero', vd.numero, 'feita_em', vd.emitida_em, 'total', vd.total, 'situacao', vd.situacao,
        'pagamentos', vd.pagamentos, 'troco', vd.troco, 'cliente', (select nome from clientes_fiado where id = vd.cliente_fiado_id),
        'itens', (select coalesce(jsonb_agg(jsonb_build_object('descricao', vi.descricao, 'qtd', vi.qtd_nota, 'valor', vi.valor) order by vi.n_item), '[]')
                    from venda_itens vi where vi.venda_id = vd.id)) x
        from vendas vd where vd.turno_id = t.id order by vd.emitida_em desc limit 200) s;
  end if;
  return jsonb_build_object('nome', v.nome,
    'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo, 'telefone', c.telefone,
      'endereco', nullif(concat_ws(', ', nullif(concat_ws(' ', c.rua, c.numero), ''), c.bairro, nullif(concat_ws(' - ', c.cidade, c.uf), '')), ''),
      'documento', c.documento, 'documento_tipo', c.documento_tipo),
    'dono_tem_pin', exists (select 1 from dono_pin where dono_id = c.dono_id),
    'turno', case when t.id is null then null else public._resumo_turno(t.id) end,
    'vendas', coalesce(v_vendas, '[]'));
end $$;

/* Produtos com preço e códigos, para o celular procurar na hora (também sem internet). */
create or replace function public.caixa_produtos(_chave text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_caixa(_chave);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nome', p.nome, 'unidade', p.unidade, 'fracionado', public.unidade_fracionada(p.unidade), 'preco', p.preco_venda,
      'codigos', coalesce((select jsonb_agg(jsonb_build_object('codigo', cb.codigo, 'variacao_id', cb.variacao_id, 'embalagem_id', cb.embalagem_id))
                    from codigos_barras cb where cb.produto_id = p.id), '[]')
               || coalesce((select jsonb_agg(jsonb_build_object('codigo', m.codigo, 'variacao_id', m.variacao_id, 'embalagem_id', m.embalagem_id))
                    from codigos_pdv m where m.produto_id = p.id and m.comercio_id = p.comercio_id and not m.ignorar), '[]'),
      'variacoes', coalesce((select jsonb_agg(jsonb_build_object('id', pv.id, 'nome', concat_ws(' · ', pv.tamanho, pv.cor)) order by pv.tamanho, pv.cor)
                    from produto_variacoes pv where pv.produto_id = p.id and pv.removida_em is null), '[]'),
      'embalagens', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'quantidade', e.quantidade) order by e.quantidade desc)
                    from produto_embalagens e where e.produto_id = p.id and e.removida_em is null), '[]')) order by p.nome)
    from produtos p where p.comercio_id = v.comercio_id and p.ativo), '[]');
end $$;

/* Clientes do fiado (só o nome e o telefone; a conta de cada um só o dono vê). */
create or replace function public.caixa_clientes_fiado(_chave text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_caixa(_chave);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'telefone', telefone) order by nome)
    from clientes_fiado where comercio_id = v.comercio_id and ativo), '[]');
end $$;

/* Abrir o caixa com o troco da gaveta. Se já há um caixa aberto deste funcionário, devolve o mesmo (celular reiniciou). */
create or replace function public.caixa_abrir(_chave text, _id uuid, _troco numeric) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; cx caixas%rowtype; t caixa_turnos%rowtype;
begin
  v := public._funcionario_caixa(_chave);
  perform pg_advisory_xact_lock(hashtextextended('caixa:' || v.id::text, 0));
  select * into t from caixa_turnos where funcionario_id = v.id and situacao = 'aberto';
  if found then return jsonb_build_object('situacao', 'ja_aberto', 'turno', public._resumo_turno(t.id)); end if;
  if _id is null then raise exception 'id_obrigatorio' using errcode = '22023'; end if;
  if exists (select 1 from caixa_turnos where id = _id) then raise exception 'turno_ja_fechado' using errcode = '23514'; end if;
  if _troco is null or _troco < 0 or _troco > 100000 then raise exception 'troco_invalido' using errcode = '22023'; end if;
  select * into cx from caixas where funcionario_id = v.id;
  if not found then
    insert into caixas (comercio_id, nome, tipo, funcionario_id, ligado_em, ultimo_contato_em)
    values (v.comercio_id, left('Celular · ' || v.nome, 40), 'celular', v.id, now(), now()) returning * into cx;
  elsif cx.desligado_em is not null then raise exception 'caixa_desligado' using errcode = '42501';
  end if;
  insert into caixa_turnos (id, comercio_id, caixa_id, funcionario_id, troco_inicial) values (_id, v.comercio_id, cx.id, v.id, round(_troco, 2));
  update caixas set ultimo_contato_em = now() where id = cx.id;
  return jsonb_build_object('situacao', 'aberto', 'turno', public._resumo_turno(_id));
end $$;

/* Venda finalizada no celular. Repetir a mesma venda (mesmo id) não conta de novo.
   _venda = {id, turno_id, feita_em, itens:[{produto_id?, variacao_id?, embalagem_id?, codigo?, descricao?, qtd, preco}],
             pagamentos:[{forma: dinheiro|pix|cartao|fiado, valor}], cliente?: {id, nome?, telefone?}} */
create or replace function public.caixa_registrar_venda(_chave text, _venda jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; c comercios%rowtype; t caixa_turnos%rowtype; vd vendas%rowtype; v_id uuid; v_feita timestamptz;
  it jsonb; pg jsonb; a record; n int := 0; v_qtd numeric; v_preco numeric; v_valor numeric; v_total numeric := 0; v_cod text; v_desc text;
  v_prod uuid; v_var uuid; v_emb uuid; v_sit text; v_mot text; v_unid numeric; v_sem int := 0; v_pags jsonb := '[]'; v_soma numeric := 0;
  v_din numeric := 0; v_fiado numeric := 0; v_forma text; v_pv numeric; v_troco numeric; v_cli uuid; v_num bigint; r record; v_nome_prod text;
  v_ign boolean; v_tel text;
begin
  v := public._funcionario_caixa(_chave);
  begin v_id := (_venda->>'id')::uuid; exception when others then raise exception 'venda_invalida' using errcode = '22023'; end;
  if v_id is null then raise exception 'venda_invalida' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select * into vd from vendas where id = v_id;
  if found then
    if vd.comercio_id <> v.comercio_id then raise exception 'venda_invalida' using errcode = '42501'; end if;
    return jsonb_build_object('situacao', 'repetida', 'venda', vd.id, 'numero', vd.numero);
  end if;
  begin select * into t from caixa_turnos where id = (_venda->>'turno_id')::uuid and funcionario_id = v.id;
  exception when others then raise exception 'turno_invalido' using errcode = '22023'; end;
  if t.id is null then raise exception 'turno_invalido' using errcode = '42501'; end if;
  begin v_feita := coalesce((_venda->>'feita_em')::timestamptz, now()); exception when others then raise exception 'venda_invalida' using errcode = '22023'; end;
  if v_feita > now() + interval '10 minutes' or v_feita < now() - interval '30 days' then raise exception 'data_invalida' using errcode = '22023'; end if;
  v_feita := least(v_feita, now());
  if jsonb_typeof(_venda->'itens') <> 'array' or jsonb_array_length(_venda->'itens') not between 1 and 300 then
    raise exception 'venda_sem_itens' using errcode = '22023'; end if;
  if jsonb_typeof(_venda->'pagamentos') <> 'array' or jsonb_array_length(_venda->'pagamentos') not between 1 and 6 then
    raise exception 'pagamento_invalido' using errcode = '22023'; end if;
  select * into c from comercios where id = v.comercio_id;

  -- pagamentos (o dinheiro pode passar do total: a diferença é o troco)
  for pg in select * from jsonb_array_elements(_venda->'pagamentos') loop
    v_forma := pg->>'forma';
    begin v_pv := round((pg->>'valor')::numeric, 2); exception when others then raise exception 'pagamento_invalido' using errcode = '22023'; end;
    if v_forma not in ('dinheiro', 'pix', 'cartao', 'fiado') or v_pv is null or v_pv <= 0 or v_pv > 1000000 then
      raise exception 'pagamento_invalido' using errcode = '22023'; end if;
    v_soma := v_soma + v_pv;
    if v_forma = 'dinheiro' then v_din := v_din + v_pv; end if;
    if v_forma = 'fiado' then v_fiado := v_fiado + v_pv; end if;
    v_pags := v_pags || jsonb_build_array(jsonb_build_object('forma', v_forma, 'valor', v_pv));
  end loop;

  -- cliente do fiado (pode ser cadastrado na hora, no caixa)
  if v_fiado > 0 then
    begin v_cli := (_venda->'cliente'->>'id')::uuid; exception when others then raise exception 'cliente_invalido' using errcode = '22023'; end;
    if v_cli is null then raise exception 'fiado_sem_cliente' using errcode = '22023'; end if;
    if exists (select 1 from clientes_fiado where id = v_cli) then
      if not exists (select 1 from clientes_fiado where id = v_cli and comercio_id = v.comercio_id) then raise exception 'cliente_invalido' using errcode = '42501'; end if;
    else
      if char_length(btrim(coalesce(_venda->'cliente'->>'nome', ''))) not between 2 and 60 then raise exception 'nome_cliente_invalido' using errcode = '23514'; end if;
      v_tel := nullif(regexp_replace(coalesce(_venda->'cliente'->>'telefone', ''), '\D', '', 'g'), '');
      if v_tel is not null and v_tel !~ '^[0-9]{10,11}$' then raise exception 'telefone_cliente_invalido' using errcode = '23514'; end if;
      insert into clientes_fiado (id, comercio_id, nome, telefone, criado_por_funcionario)
      values (v_cli, v.comercio_id, btrim(_venda->'cliente'->>'nome'), v_tel, v.id);
    end if;
  end if;

  v_num := c.proximo_numero_venda;
  update comercios set proximo_numero_venda = proximo_numero_venda + 1 where id = c.id;
  insert into vendas (id, comercio_id, caixa_id, chave_nota, numero, emitida_em, total, pagamentos, origem, turno_id, funcionario_id, cliente_fiado_id)
  values (v_id, c.id, t.caixa_id, null, v_num, v_feita, 0, v_pags, 'celular', t.id, v.id, case when v_fiado > 0 then v_cli end);

  for it in select * from jsonb_array_elements(_venda->'itens') loop
    n := n + 1;
    begin
      v_qtd := round((it->>'qtd')::numeric, 3);
      v_preco := round((it->>'preco')::numeric, 2);
      v_prod := nullif(it->>'produto_id', '')::uuid; v_var := nullif(it->>'variacao_id', '')::uuid; v_emb := nullif(it->>'embalagem_id', '')::uuid;
    exception when others then raise exception 'item_invalido' using errcode = '22023'; end;
    if v_qtd is null or v_qtd <= 0 or v_qtd > 100000 or v_preco is null or v_preco < 0 or v_preco > 1000000 then
      raise exception 'item_invalido' using errcode = '22023'; end if;
    v_valor := round(v_qtd * v_preco, 2);
    v_total := v_total + v_valor;
    v_cod := left(nullif(btrim(coalesce(it->>'codigo', '')), ''), 60);
    v_desc := left(nullif(btrim(coalesce(it->>'descricao', '')), ''), 120);
    v_sit := null; v_mot := null; v_unid := null; v_ign := false;
    if v_prod is not null then
      select nome into v_nome_prod from produtos where id = v_prod and comercio_id = c.id;
      if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
      if v_var is not null and not exists (select 1 from produto_variacoes where id = v_var and produto_id = v_prod) then raise exception 'variacao_invalida' using errcode = '22023'; end if;
      if v_emb is not null and not exists (select 1 from produto_embalagens where id = v_emb and produto_id = v_prod) then raise exception 'embalagem_invalida' using errcode = '22023'; end if;
    elsif v_cod is not null then
      select * into a from public._achar_item_venda(c.id, v_cod, case when v_cod ~ '^[0-9]+$' then v_cod end);
      v_prod := a.produto_id; v_var := a.variacao_id; v_emb := a.embalagem_id; v_ign := coalesce(a.ignorar, false);
      if v_prod is not null then select nome into v_nome_prod from produtos where id = v_prod; end if;
    end if;
    if v_ign then v_sit := 'ignorado'; v_prod := null; v_var := null; v_emb := null;
    elsif v_prod is null then v_sit := 'sem_cadastro'; v_sem := v_sem + 1;
    elsif v_var is null and exists (select 1 from produto_variacoes where produto_id = v_prod and removida_em is null) then
      v_sit := 'conferir'; v_mot := 'escolher_variacao'; v_sem := v_sem + 1;
    else
      select x.unidades, x.motivo into v_unid, v_mot from public._unidades_item(v_prod, v_emb, v_qtd) x;
      if v_unid is null then v_sit := 'conferir'; v_sem := v_sem + 1; end if;
    end if;
    insert into venda_itens (venda_id, comercio_id, n_item, codigo_pdv, codigo_barras, descricao, qtd_nota, unidade_nota, valor,
                             produto_id, variacao_id, embalagem_id, qtd_unidades, situacao, motivo)
    values (v_id, c.id, n,
            coalesce(v_cod, case when v_prod is not null then 'omni:' || v_prod::text else 'avulso:' || v_id::text || ':' || n end),
            case when v_cod ~ '^[0-9]{8,14}$' then v_cod end,
            coalesce(case when v_prod is not null then v_nome_prod end, v_desc, 'Produto sem cadastro'),
            v_qtd, null, v_valor,
            case when v_sit in ('sem_cadastro', 'ignorado') then null else v_prod end,
            case when v_sit in ('sem_cadastro', 'ignorado') then null else v_var end,
            case when v_sit in ('sem_cadastro', 'ignorado') then null else v_emb end,
            v_unid, coalesce(v_sit, 'baixado'), v_mot);
  end loop;

  -- confere o pagamento com o total
  if v_soma - v_din > v_total + 0.005 then raise exception 'pagamento_maior_que_total' using errcode = '23514'; end if;
  if v_soma < v_total - 0.005 then raise exception 'pagamento_menor_que_total' using errcode = '23514'; end if;
  v_troco := round(v_soma - v_total, 2);
  update vendas set total = v_total, troco = v_troco where id = v_id;

  -- desconta da gôndola, produto por produto, sempre na mesma ordem
  for r in select id from venda_itens where venda_id = v_id and situacao = 'baixado' order by produto_id, n_item loop
    perform public._baixar_item_venda(r.id);
  end loop;

  if v_fiado > 0 then
    insert into fiado_movimentos (id, comercio_id, cliente_id, tipo, valor, venda_id, funcionario_id)
    values (gen_random_uuid(), c.id, v_cli, 'compra', v_fiado, v_id, v.id);
  end if;
  update caixas set ultima_venda_em = greatest(coalesce(ultima_venda_em, v_feita), v_feita), ultimo_contato_em = now() where id = t.caixa_id;
  return jsonb_build_object('situacao', 'registrada', 'venda', v_id, 'numero', v_num, 'total', v_total, 'troco', v_troco, 'sem_cadastro', v_sem);
end $$;

/* Cancelar no celular: com o PIN do dono. Devolve à gôndola o que tinha saído e tira da conta do fiado. */
create or replace function public._cancelar_venda_celular(_venda uuid, _por text, _motivo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare vd vendas%rowtype; r record; m fiado_movimentos%rowtype;
begin
  select * into vd from vendas where id = _venda for update;
  for r in select id from venda_itens where venda_id = vd.id order by produto_id nulls last, n_item loop
    perform public._devolver_item_venda(r.id);
  end loop;
  update vendas set situacao = 'cancelada', cancelada_em = now(), cancelada_por = _por,
         motivo_cancelamento = left(nullif(btrim(coalesce(_motivo, '')), ''), 200) where id = vd.id;
  select * into m from fiado_movimentos where venda_id = vd.id and tipo = 'compra';
  if found then
    insert into fiado_movimentos (id, comercio_id, cliente_id, tipo, valor, venda_id, funcionario_id, registrado_por)
    values (gen_random_uuid(), m.comercio_id, m.cliente_id, 'cancelamento', m.valor, vd.id,
            case when _por = 'funcionario' then vd.funcionario_id end, case when _por = 'dono' then auth.uid() end);
  end if;
end $$;

create or replace function public.caixa_cancelar_venda(_chave text, _venda uuid, _pin_dono text, _motivo text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; vd vendas%rowtype; v_erro text;
begin
  v := public._funcionario_caixa(_chave);
  perform pg_advisory_xact_lock(hashtextextended(_venda::text, 0));
  select * into vd from vendas where id = _venda and comercio_id = v.comercio_id and origem = 'celular' for update;
  if not found then raise exception 'venda_invalida' using errcode = '42501'; end if;
  if vd.situacao = 'cancelada' then return jsonb_build_object('situacao', 'repetida'); end if;
  v_erro := public._conferir_pin_dono(v.comercio_id, _pin_dono);
  if v_erro is not null then return jsonb_build_object('erro', v_erro); end if;
  perform public._cancelar_venda_celular(vd.id, 'funcionario', _motivo);
  return jsonb_build_object('situacao', 'cancelada', 'venda', vd.id);
end $$;

/* Sangria: tirar dinheiro da gaveta, com o PIN do dono. Repetir o mesmo id não tira duas vezes. */
create or replace function public.caixa_sangria(_chave text, _id uuid, _turno uuid, _valor numeric, _motivo text, _pin_dono text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; t caixa_turnos%rowtype; v_erro text;
begin
  v := public._funcionario_caixa(_chave);
  if _id is null then raise exception 'id_obrigatorio' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(_id::text, 0));
  if exists (select 1 from caixa_sangrias where id = _id and funcionario_id = v.id) then
    return jsonb_build_object('situacao', 'repetida', 'turno', public._resumo_turno(_turno)); end if;
  select * into t from caixa_turnos where id = _turno and funcionario_id = v.id;
  if not found then raise exception 'turno_invalido' using errcode = '42501'; end if;
  if t.situacao <> 'aberto' then raise exception 'turno_fechado' using errcode = '23514'; end if;
  if _valor is null or _valor <= 0 or _valor > 100000 then raise exception 'valor_invalido' using errcode = '22023'; end if;
  v_erro := public._conferir_pin_dono(v.comercio_id, _pin_dono);
  if v_erro is not null then return jsonb_build_object('erro', v_erro); end if;
  insert into caixa_sangrias (id, comercio_id, turno_id, funcionario_id, valor, motivo)
  values (_id, v.comercio_id, t.id, v.id, round(_valor, 2), left(nullif(btrim(coalesce(_motivo, '')), ''), 120));
  return jsonb_build_object('situacao', 'registrada', 'turno', public._resumo_turno(t.id));
end $$;

/* Fechar o caixa: o funcionário conta o dinheiro da gaveta; o Omni guarda o esperado e a diferença. */
create or replace function public.caixa_fechar(_chave text, _turno uuid, _contado numeric, _observacao text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; t caixa_turnos%rowtype; v_res jsonb; v_esp numeric;
begin
  v := public._funcionario_caixa(_chave);
  select * into t from caixa_turnos where id = _turno and funcionario_id = v.id for update;
  if not found then raise exception 'turno_invalido' using errcode = '42501'; end if;
  if t.situacao = 'fechado' then return jsonb_build_object('situacao', 'repetida', 'turno', public._resumo_turno(t.id)); end if;
  if _contado is null or _contado < 0 or _contado > 1000000 then raise exception 'valor_invalido' using errcode = '22023'; end if;
  v_res := public._resumo_turno(t.id);
  v_esp := (v_res->>'dinheiro_esperado')::numeric;
  update caixa_turnos set situacao = 'fechado', fechado_em = now(), dinheiro_esperado = v_esp, dinheiro_contado = round(_contado, 2),
         diferenca = round(_contado, 2) - v_esp, observacao = left(nullif(btrim(coalesce(_observacao, '')), ''), 300),
         conferido_em = case when round(_contado, 2) = v_esp then now() end
   where id = t.id;
  return jsonb_build_object('situacao', 'fechado', 'turno', public._resumo_turno(t.id));
end $$;

/* Tela inicial do funcionário: agora diz também se ele opera o caixa. */
create or replace function public.funcionario_inicio(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; c comercios%rowtype; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_entregas int; v_hoje_n int; v_repor int;
begin
  begin v := public._funcionario_da_chave(_chave);
  exception when others then
    if sqlerrm = 'pin_necessario' then
      select f.* into v from funcionario_aparelhos a join funcionarios f on f.id = a.funcionario_id
       where a.chave_hash = encode(extensions.digest(_chave, 'sha256'), 'hex') and a.encerrado_em is null and f.bloqueado_em is null;
      select * into c from comercios where id = v.comercio_id;
      return jsonb_build_object('pin_necessario', true, 'nome', v.nome, 'funcao', v.funcao, 'caixa', v.caixa, 'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo));
    end if;
    return null;
  end;
  select * into c from comercios where id = v.comercio_id;
  select count(*), count(*) filter (where previsao_entrega is not null and previsao_entrega <= v_hoje)
    into v_entregas, v_hoje_n
    from pedidos_compra pc where comercio_id = v.comercio_id and situacao in ('enviado', 'aceito', 'aceito_ajustes', 'recebido_parcial')
     and not exists (select 1 from recebimentos r where r.pedido_id = pc.id and r.situacao = 'concluido');
  select count(*) into v_repor from (
    select pa.produto_id, pa.variacao_id
      from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
      left join saldos s on s.produto_id = pa.produto_id and s.variacao_id is not distinct from pa.variacao_id and s.area = 'venda'
     where pa.comercio_id = v.comercio_id and pa.area = 'venda' and pa.minimo is not null
     group by pa.produto_id, pa.variacao_id, pa.minimo
    having coalesce(sum(s.quantidade), 0) <= pa.minimo) x;
  return jsonb_build_object('nome', v.nome, 'funcao', v.funcao, 'caixa', v.caixa, 'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo),
    'avisos', jsonb_build_object('entregas', v_entregas, 'entregas_hoje', v_hoje_n, 'repor', v_repor,
      'caixa_aberto', exists (select 1 from caixa_turnos where funcionario_id = v.id and situacao = 'aberto')));
end $$;

/* ---------- dono ---------- */

/* Criar ou trocar o PIN do dono (4 números; os fáceis, como 1111 e 1234, são recusados). */
create or replace function public.definir_pin_dono(_pin text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  if not exists (select 1 from comercios where dono_id = auth.uid()) then raise exception 'sem_comercio' using errcode = '42501'; end if;
  if _pin is null or _pin !~ '^[0-9]{4}$' then raise exception 'pin_formato' using errcode = '22023'; end if;
  if _pin ~ '^(\d)\1{3}$' or _pin in ('1234', '4321', '0123', '9876') then raise exception 'pin_facil' using errcode = '23514'; end if;
  insert into dono_pin (dono_id, pin_hash) values (auth.uid(), extensions.crypt(_pin, extensions.gen_salt('bf', 8)))
  on conflict (dono_id) do update set pin_hash = excluded.pin_hash, criado_em = now(), tentativas = 0, travado_ate = null;
end $$;

create or replace function public.tem_pin_dono() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and exists (select 1 from dono_pin where dono_id = auth.uid())
$$;

/* Ligar ou desligar a função Caixa de um funcionário. */
create or replace function public.definir_caixa_funcionario(_id uuid, _caixa boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into v from funcionarios where id = _id for update;
  if not found or not public.pode_acessar_comercio(v.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  if _caixa is null then raise exception 'valor_invalido' using errcode = '22023'; end if;
  update funcionarios set caixa = _caixa where id = _id;
  if _caixa then update caixas set desligado_em = null where funcionario_id = _id and desligado_em is not null; end if;
end $$;

/* O dono cancela uma venda do celular pelo app dele (não precisa do PIN: já está logado). */
create or replace function public.cancelar_venda_celular(_venda uuid, _motivo text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare vd vendas%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(_venda::text, 0));
  select * into vd from vendas where id = _venda and origem = 'celular' for update;
  if not found or not public.pode_acessar_comercio(vd.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if vd.situacao = 'cancelada' then return jsonb_build_object('situacao', 'repetida'); end if;
  perform public._cancelar_venda_celular(vd.id, 'dono', _motivo);
  return jsonb_build_object('situacao', 'cancelada', 'venda', vd.id);
end $$;

/* O dono viu o fechamento de caixa (com diferença). */
create or replace function public.conferir_fechamento_caixa(_turno uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from caixa_turnos where id = _turno and situacao = 'fechado' and public.pode_acessar_comercio(comercio_id)) then
    raise exception 'sem_permissao' using errcode = '42501'; end if;
  update caixa_turnos set conferido_em = coalesce(conferido_em, now()) where id = _turno;
end $$;

/* Cliente do fiado pelo dono: criar, mudar nome/telefone ou desativar (a conta continua guardada). */
create or replace function public.salvar_cliente_fiado(_id uuid, _comercio uuid, _nome text, _telefone text, _ativo boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare cl clientes_fiado%rowtype; v_tel text := nullif(regexp_replace(coalesce(_telefone, ''), '\D', '', 'g'), '');
begin
  if not public.pode_acessar_comercio(_comercio) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if _id is null then raise exception 'id_obrigatorio' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(_nome, ''))) not between 2 and 60 then raise exception 'nome_cliente_invalido' using errcode = '23514'; end if;
  if v_tel is not null and v_tel !~ '^[0-9]{10,11}$' then raise exception 'telefone_cliente_invalido' using errcode = '23514'; end if;
  select * into cl from clientes_fiado where id = _id for update;
  if found then
    if cl.comercio_id <> _comercio then raise exception 'sem_permissao' using errcode = '42501'; end if;
    update clientes_fiado set nome = btrim(_nome), telefone = v_tel, ativo = coalesce(_ativo, true) where id = _id;
  else
    insert into clientes_fiado (id, comercio_id, nome, telefone, ativo) values (_id, _comercio, btrim(_nome), v_tel, coalesce(_ativo, true));
  end if;
end $$;

/* O cliente pagou o fiado (tudo ou parte). Não aceita pagar mais do que deve. Repetir o mesmo id não paga duas vezes. */
create or replace function public.receber_fiado(_id uuid, _cliente uuid, _valor numeric, _forma text, _observacao text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cl clientes_fiado%rowtype; v_deve numeric;
begin
  select * into cl from clientes_fiado where id = _cliente for update;
  if not found or not public.pode_acessar_comercio(cl.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if _id is null then raise exception 'id_obrigatorio' using errcode = '22023'; end if;
  if exists (select 1 from fiado_movimentos where id = _id) then return jsonb_build_object('situacao', 'repetida'); end if;
  if _forma not in ('dinheiro', 'pix', 'cartao') then raise exception 'forma_invalida' using errcode = '22023'; end if;
  if _valor is null or round(_valor, 2) <= 0 then raise exception 'valor_invalido' using errcode = '22023'; end if;
  select coalesce(sum(case when tipo = 'compra' then valor else -valor end), 0) into v_deve from fiado_movimentos where cliente_id = cl.id;
  if round(_valor, 2) > v_deve then raise exception 'valor_maior_que_a_conta' using errcode = '23514'; end if;
  insert into fiado_movimentos (id, comercio_id, cliente_id, tipo, valor, forma, observacao, registrado_por)
  values (_id, cl.comercio_id, cl.id, 'pagamento', round(_valor, 2), _forma, left(nullif(btrim(coalesce(_observacao, '')), ''), 200), auth.uid());
  return jsonb_build_object('situacao', 'registrado', 'deve', v_deve - round(_valor, 2));
end $$;

/* ---------- permissões das funções ---------- */
revoke all on function public._baixar_item_venda(uuid), public._devolver_item_venda(uuid), public._funcionario_caixa(text),
  public._conferir_pin_dono(uuid, text), public._resumo_turno(uuid), public._cancelar_venda_celular(uuid, text, text),
  public.caixa_estado(text), public.caixa_produtos(text), public.caixa_clientes_fiado(text), public.caixa_abrir(text, uuid, numeric),
  public.caixa_registrar_venda(text, jsonb), public.caixa_cancelar_venda(text, uuid, text, text),
  public.caixa_sangria(text, uuid, uuid, numeric, text, text), public.caixa_fechar(text, uuid, numeric, text), public.funcionario_inicio(text),
  public.definir_pin_dono(text), public.tem_pin_dono(), public.definir_caixa_funcionario(uuid, boolean), public.cancelar_venda_celular(uuid, text),
  public.conferir_fechamento_caixa(uuid), public.salvar_cliente_fiado(uuid, uuid, text, text, boolean),
  public.receber_fiado(uuid, uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.caixa_estado(text), public.caixa_produtos(text), public.caixa_clientes_fiado(text), public.caixa_abrir(text, uuid, numeric),
  public.caixa_registrar_venda(text, jsonb), public.caixa_cancelar_venda(text, uuid, text, text),
  public.caixa_sangria(text, uuid, uuid, numeric, text, text), public.caixa_fechar(text, uuid, numeric, text), public.funcionario_inicio(text) to anon, authenticated;
grant execute on function public.definir_pin_dono(text), public.tem_pin_dono(), public.definir_caixa_funcionario(uuid, boolean),
  public.cancelar_venda_celular(uuid, text), public.conferir_fechamento_caixa(uuid), public.salvar_cliente_fiado(uuid, uuid, text, text, boolean),
  public.receber_fiado(uuid, uuid, numeric, text, text) to authenticated;
