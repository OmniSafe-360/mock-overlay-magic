-- Fase 4.1 — fechar a conta (desenho aprovado pelo dono em 10/10/2026: "Pode fazer a próxima", com as 4 recomendações):
-- a) a perda sai do estoque NA HORA e o dono confirma depois (recusar vira diferença para investigar);
-- b) conferir 5 produtos do depósito por dia, revezando (os mais caros e os nunca conferidos primeiro), contagem cega até 3 vezes;
-- c) depois de uma contagem aceita, o estoque passa a ser o que foi contado e a diferença fica guardada;
-- d) quadro "Diferenças" para o dono explicar (quebra, vencido, erro de contagem, sumiu…), com o valor em reais.
-- A reposição passa a acusar diferença na gôndola quando o comércio tem um caixa ligado (as vendas chegam ao Omni).
-- Toda mudança de estoque grava uma `operacoes` na mesma transação (regra da base).

/* ---------- tabelas ---------- */
create table public.diferencas (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id),
  produto_id uuid not null,
  variacao_id uuid,
  area public.area_estoque not null,
  origem text not null check (origem in ('conferencia', 'conferencia_inconsistente', 'reposicao', 'perda_recusada')),
  esperado numeric(14,3) not null,                         -- o que o sistema tinha
  contado numeric(14,3) not null,                          -- o que foi contado
  diferenca numeric(14,3) not null,                        -- contado - esperado (negativo = faltou)
  valor numeric(14,2) not null,                            -- diferença × preço de compra
  funcionario_id uuid references public.funcionarios(id),
  referencia_id uuid,                                      -- conferência, reposição ou perda que gerou
  detalhes jsonb not null default '{}',
  situacao text not null default 'aberta' check (situacao in ('aberta', 'explicada')),
  motivo text check (motivo in ('quebra', 'vencido', 'erro_contagem', 'sumiu', 'consumo', 'outro')),
  observacao text check (length(observacao) <= 300),
  explicada_em timestamptz,
  explicada_por uuid,
  created_at timestamptz not null default now(),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id)
);
create index diferencas_comercio_idx on public.diferencas (comercio_id, created_at desc);
create index diferencas_abertas_idx on public.diferencas (comercio_id) where situacao = 'aberta';
create index diferencas_produto_comercio_fk_idx on public.diferencas (produto_id, comercio_id);
create index diferencas_variacao_produto_comercio_fk_idx on public.diferencas (variacao_id, produto_id, comercio_id);
create index diferencas_funcionario_fk_idx on public.diferencas (funcionario_id);

create table public.perdas (
  id uuid primary key,                                     -- gerado no app: repetir não duplica
  comercio_id uuid not null references public.comercios(id),
  produto_id uuid not null,
  variacao_id uuid,
  area public.area_estoque not null,
  quantidade numeric(14,3) not null check (quantidade > 0),-- o que foi informado
  baixado numeric(14,3) not null default 0,                -- o que saiu do estoque (no máximo o que o sistema tinha)
  motivo text not null check (motivo in ('quebrou', 'venceu', 'consumo', 'devolvido', 'outro')),
  observacao text check (length(observacao) <= 300),
  funcionario_id uuid references public.funcionarios(id),  -- quem registrou (funcionário) …
  registrado_por uuid,                                     -- … ou o dono
  situacao text not null check (situacao in ('aguardando', 'confirmada', 'recusada')),
  operacao_id uuid references public.operacoes(id),
  diferenca_id uuid references public.diferencas(id),
  decidida_em timestamptz,
  created_at timestamptz not null default now(),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id)
);
create index perdas_comercio_idx on public.perdas (comercio_id, created_at desc);
create index perdas_produto_comercio_fk_idx on public.perdas (produto_id, comercio_id);
create index perdas_variacao_produto_comercio_fk_idx on public.perdas (variacao_id, produto_id, comercio_id);
create index perdas_funcionario_fk_idx on public.perdas (funcionario_id);
create index perdas_operacao_fk_idx on public.perdas (operacao_id);
create index perdas_diferenca_fk_idx on public.perdas (diferenca_id);

create table public.conferencias (
  id uuid primary key,                                     -- gerado no app: repetir não duplica
  comercio_id uuid not null references public.comercios(id),
  produto_id uuid not null,
  variacao_id uuid,
  area public.area_estoque not null default 'deposito',
  funcionario_id uuid not null references public.funcionarios(id),
  tentativas jsonb not null default '[]',                  -- números contados (só o dono vê)
  esperado numeric(14,3),                                  -- o que o sistema tinha ao aceitar (só o dono vê)
  contado numeric(14,3),
  situacao text not null default 'contando' check (situacao in ('contando', 'concluida', 'inconsistente')),
  operacao_id uuid references public.operacoes(id),
  diferenca_id uuid references public.diferencas(id),
  created_at timestamptz not null default now(),
  concluida_em timestamptz,
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id)
);
create index conferencias_comercio_idx on public.conferencias (comercio_id, created_at desc);
create index conferencias_produto_comercio_fk_idx on public.conferencias (produto_id, comercio_id);
create index conferencias_variacao_produto_comercio_fk_idx on public.conferencias (variacao_id, produto_id, comercio_id);
create index conferencias_funcionario_fk_idx on public.conferencias (funcionario_id);
create index conferencias_operacao_fk_idx on public.conferencias (operacao_id);
create index conferencias_diferenca_fk_idx on public.conferencias (diferenca_id);

/* ---------- segurança: o dono só lê; tudo é gravado por funções ---------- */
alter table public.diferencas enable row level security;
alter table public.perdas enable row level security;
alter table public.conferencias enable row level security;
create policy "dono ve diferencas do seu comercio" on public.diferencas for select to authenticated using ((select public.pode_acessar_comercio(comercio_id)));
create policy "dono ve perdas do seu comercio" on public.perdas for select to authenticated using ((select public.pode_acessar_comercio(comercio_id)));
create policy "dono ve conferencias do seu comercio" on public.conferencias for select to authenticated using ((select public.pode_acessar_comercio(comercio_id)));
revoke all on public.diferencas, public.perdas, public.conferencias from anon, authenticated;
grant select on public.diferencas, public.perdas, public.conferencias to authenticated;

/* ---------- ajudantes ---------- */

/* Guarda uma diferença com o valor em reais (preço de compra). */
create or replace function public._registrar_diferenca(_com uuid, _prod uuid, _var uuid, _area area_estoque, _origem text, _esperado numeric, _contado numeric,
  _func uuid, _ref uuid, _detalhes jsonb default '{}') returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_preco numeric;
begin
  select preco_compra into v_preco from produtos where id = _prod;
  insert into diferencas (comercio_id, produto_id, variacao_id, area, origem, esperado, contado, diferenca, valor, funcionario_id, referencia_id, detalhes)
  values (_com, _prod, _var, _area, _origem, _esperado, _contado, _contado - _esperado, round((_contado - _esperado) * coalesce(v_preco, 0), 2), _func, _ref, coalesce(_detalhes, '{}'))
  returning id into v_id;
  return v_id;
end $$;

/* A área passa a ter exatamente `_novo` (contagem aceita). Faltou: sai da validade mais próxima; sobrou: entra no lote de validade
   mais distante que já está lá (ou sem lote). Primeira contagem da área vira `contagens`. Movimento `ajuste`. */
create or replace function public._acertar_area(_com uuid, _prod uuid, _var uuid, _area area_estoque, _novo numeric, _op uuid, _user uuid, _func uuid) returns numeric
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_atual numeric := public.saldo_chave(_prod, _var, _area); v_dif numeric := _novo - v_atual; v_local uuid; alvo record; p produtos%rowtype; c comercios%rowtype;
begin
  select local_id into v_local from produto_areas where produto_id = _prod and variacao_id is not distinct from _var and area = _area;
  if v_dif < 0 then
    perform public._tirar_saldo(_com, _prod, _var, _area, -v_dif, _op, _user, _func, 'ajuste', v_local);
  elsif v_dif > 0 then
    select s.lote_id, s.pendente, s.pendencia_confirmada into alvo from saldos s left join lotes l on l.id = s.lote_id
     where s.produto_id = _prod and s.variacao_id is not distinct from _var and s.area = _area and s.origem_id is null
     order by (s.quantidade > 0) desc, l.vencimento desc nulls last limit 1;
    if not found then
      select * into p from produtos where id = _prod;
      select * into c from comercios where id = _com;
      perform public._por_saldo(_com, _prod, _var, _area, null, coalesce(p.controla_validade, false), coalesce(p.controla_validade, false) and c.tipo = 'farmacia',
        v_dif, _op, _user, _func, 'ajuste', v_local);
    else
      perform public._por_saldo(_com, _prod, _var, _area, alvo.lote_id, alvo.pendente, alvo.pendencia_confirmada, v_dif, _op, _user, _func, 'ajuste', v_local);
    end if;
  end if;
  if not exists (select 1 from contagens where produto_id = _prod and variacao_id is not distinct from _var and area = _area) then
    insert into contagens (operacao_id, comercio_id, produto_id, variacao_id, area, quantidade, criado_por) values (_op, _com, _prod, _var, _area, _novo, _user);
  end if;
  return v_dif;
end $$;

/* Lança uma perda: sai do estoque na hora (no máximo o que o sistema tem). Uma operação permanente. */
create or replace function public._lancar_perda(_id uuid, _com uuid, _prod uuid, _var uuid, _area text, _qtd numeric, _motivo text, _obs text,
  _func uuid, _dono_registra uuid) returns perdas
language plpgsql security definer set search_path = public, pg_temp as $$
declare pe perdas%rowtype; p produtos%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid(); v_q numeric; v_baixa numeric; v_local uuid; v_area area_estoque;
begin
  if _id is null then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
  select * into pe from perdas where id = _id;
  if found then
    if pe.comercio_id <> _com then raise exception 'perda_de_outro_comercio' using errcode = '42501'; end if;
    return pe;
  end if;
  if _area not in ('deposito', 'venda') then raise exception 'area_invalida' using errcode = '22023'; end if;
  v_area := _area::area_estoque;
  if _motivo not in ('quebrou', 'venceu', 'consumo', 'devolvido', 'outro') then raise exception 'motivo_invalido' using errcode = '22023'; end if;
  select * into p from produtos where id = _prod and comercio_id = _com;
  if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
  if _var is not null and not exists (select 1 from produto_variacoes where id = _var and produto_id = _prod) then raise exception 'variacao_invalida' using errcode = '22023'; end if;
  if _var is null and exists (select 1 from produto_variacoes where produto_id = _prod and removida_em is null) then raise exception 'variacao_obrigatoria' using errcode = '22023'; end if;
  v_q := public.qtd_valida(_qtd, p.unidade, false);
  select * into c from comercios where id = _com;
  perform pg_advisory_xact_lock(hashtextextended(_prod::text, 0));
  v_baixa := least(public.saldo_chave(_prod, _var, v_area), v_q);
  select local_id into v_local from produto_areas where produto_id = _prod and variacao_id is not distinct from _var and area = v_area;
  insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash, funcionario_id)
  values (v_op, c.dono_id, _com, _prod, 'perda', md5(_id::text || ':perda'), _func);
  perform public._tirar_saldo(_com, _prod, _var, v_area, v_baixa, v_op, c.dono_id, _func, 'perda', v_local);
  insert into perdas (id, comercio_id, produto_id, variacao_id, area, quantidade, baixado, motivo, observacao, funcionario_id, registrado_por, situacao, operacao_id, decidida_em)
  values (_id, _com, _prod, _var, v_area, v_q, v_baixa, _motivo, nullif(left(btrim(coalesce(_obs, '')), 300), ''), _func, _dono_registra,
          case when _dono_registra is not null then 'confirmada' else 'aguardando' end, v_op, case when _dono_registra is not null then now() end)
  returning * into pe;
  update operacoes set resultado = jsonb_build_object('perda', _id, 'informado', v_q, 'baixado', v_baixa, 'motivo', _motivo) where id = v_op;
  return pe;
end $$;

/* ---------- app do funcionário (com a chave do celular e o PIN em dia) ---------- */

/* Registrar perda (quebrou, venceu, consumo da loja, devolvido ao fornecedor). Sai do estoque na hora; o dono confirma depois. */
create or replace function public.funcionario_registrar_perda(_chave text, _id uuid, _produto uuid, _variacao uuid, _area text, _quantidade numeric, _motivo text, _observacao text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; pe perdas%rowtype;
begin
  v := public._funcionario_da_chave(_chave);
  pe := public._lancar_perda(_id, v.comercio_id, _produto, _variacao, _area, _quantidade, _motivo, _observacao, v.id, null);
  return jsonb_build_object('situacao', 'registrada', 'id', pe.id);
end $$;

/* Conferir o depósito: até 5 produtos por dia, revezando (nunca conferidos e os de maior valor primeiro). Sem quantidades. */
create or replace function public.funcionario_conferencia_lista(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_feitos int; v_falta int;
begin
  v := public._funcionario_da_chave(_chave);
  select count(distinct (produto_id, variacao_id)) into v_feitos from conferencias
   where comercio_id = v.comercio_id and area = 'deposito' and situacao <> 'contando' and (created_at at time zone 'America/Sao_Paulo')::date = v_hoje;
  v_falta := greatest(0, 5 - v_feitos);
  return jsonb_build_object('tipo', (select tipo from comercios where id = v.comercio_id), 'feitos_hoje', v_feitos, 'meta', 5, 'produtos', coalesce((
    select jsonb_agg(public._produto_para_funcionario(x.produto_id, x.variacao_id, null) || jsonb_build_object('local', x.local, 'conferencia_id', x.aberta) order by x.ordem)
      from (
        select pa.produto_id, pa.variacao_id, l.nome as local,
               (select cf.id from conferencias cf where cf.produto_id = pa.produto_id and cf.variacao_id is not distinct from pa.variacao_id
                  and cf.area = 'deposito' and cf.situacao = 'contando' order by cf.created_at desc limit 1) as aberta,
               row_number() over (order by
                 (select max(cf.created_at) from conferencias cf where cf.produto_id = pa.produto_id and cf.variacao_id is not distinct from pa.variacao_id and cf.area = 'deposito') nulls first,
                 public.saldo_chave(pa.produto_id, pa.variacao_id, 'deposito') * p.preco_compra desc, p.nome) as ordem
          from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
          left join locais l on l.id = pa.local_id
         where pa.comercio_id = v.comercio_id and pa.area = 'deposito'
           and (pa.variacao_id is null or exists (select 1 from produto_variacoes pv where pv.id = pa.variacao_id and pv.removida_em is null))
           and not exists (select 1 from conferencias cf where cf.produto_id = pa.produto_id and cf.variacao_id is not distinct from pa.variacao_id
                             and cf.area = 'deposito' and cf.situacao <> 'contando' and cf.created_at > now() - interval '7 days')
      ) x where x.ordem <= v_falta), '[]'::jsonb));
end $$;

/* Uma contagem cega do depósito. Vale quando bate com o sistema, ou quando um número se repete; 3 números diferentes = inconsistente.
   Devolve só "recontar", "concluida" ou "inconsistente" (nunca quanto o sistema tinha). */
create or replace function public.funcionario_conferencia_contar(_chave text, _id uuid, _produto uuid, _variacao uuid, _contado numeric) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; cf conferencias%rowtype; p produtos%rowtype; c comercios%rowtype; v_cont numeric; v_esp numeric; v_contada boolean;
  v_ant jsonb; v_aceita boolean := false; v_op uuid; v_dif uuid;
begin
  v := public._funcionario_da_chave(_chave);
  if _id is null then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
  select * into cf from conferencias where id = _id for update;
  if found then
    if cf.comercio_id <> v.comercio_id or cf.produto_id <> _produto or cf.variacao_id is distinct from _variacao then raise exception 'conferencia_de_outro_produto' using errcode = '42501'; end if;
    if cf.situacao <> 'contando' then return jsonb_build_object('situacao', cf.situacao); end if;
  else
    select * into p from produtos where id = _produto and comercio_id = v.comercio_id and ativo;
    if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
    if _variacao is not null and not exists (select 1 from produto_variacoes where id = _variacao and produto_id = _produto and removida_em is null) then raise exception 'variacao_invalida' using errcode = '22023'; end if;
    if _variacao is null and exists (select 1 from produto_variacoes where produto_id = _produto and removida_em is null) then raise exception 'variacao_obrigatoria' using errcode = '22023'; end if;
    insert into conferencias (id, comercio_id, produto_id, variacao_id, area, funcionario_id) values (_id, v.comercio_id, _produto, _variacao, 'deposito', v.id) returning * into cf;
  end if;
  select * into p from produtos where id = cf.produto_id;
  select * into c from comercios where id = cf.comercio_id;
  v_cont := public.qtd_valida(_contado, p.unidade, true);
  perform pg_advisory_xact_lock(hashtextextended(p.id::text, 0));
  v_esp := public.saldo_chave(p.id, cf.variacao_id, 'deposito');
  v_contada := exists (select 1 from contagens where produto_id = p.id and variacao_id is not distinct from cf.variacao_id and area = 'deposito');
  v_ant := cf.tentativas;
  if not v_contada or v_cont = v_esp or exists (select 1 from jsonb_array_elements_text(v_ant) t where t::numeric = v_cont) then v_aceita := true; end if;
  update conferencias set tentativas = tentativas || to_jsonb(v_cont) where id = cf.id;

  if v_aceita then
    v_op := gen_random_uuid();
    insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash, funcionario_id)
    values (v_op, c.dono_id, c.id, p.id, 'conferencia', md5(cf.id::text || ':conferencia'), v.id);
    perform public._acertar_area(c.id, p.id, cf.variacao_id, 'deposito', v_cont, v_op, c.dono_id, v.id);
    if v_contada and v_cont <> v_esp then
      v_dif := public._registrar_diferenca(c.id, p.id, cf.variacao_id, 'deposito', 'conferencia', v_esp, v_cont, v.id, cf.id,
                 jsonb_build_object('tentativas', v_ant || to_jsonb(v_cont)));
    end if;
    update conferencias set situacao = 'concluida', esperado = v_esp, contado = v_cont, operacao_id = v_op, diferenca_id = v_dif, concluida_em = now() where id = cf.id;
    update operacoes set resultado = jsonb_build_object('conferencia', cf.id, 'esperado', v_esp, 'contado', v_cont) where id = v_op;
    return jsonb_build_object('situacao', 'concluida');
  end if;
  if jsonb_array_length(v_ant) + 1 >= 3 then
    -- Três números diferentes: o estoque não muda; o dono decide.
    v_dif := public._registrar_diferenca(c.id, p.id, cf.variacao_id, 'deposito', 'conferencia_inconsistente', v_esp, v_cont, v.id, cf.id,
               jsonb_build_object('tentativas', v_ant || to_jsonb(v_cont)));
    update conferencias set situacao = 'inconsistente', esperado = v_esp, contado = v_cont, diferenca_id = v_dif, concluida_em = now() where id = cf.id;
    return jsonb_build_object('situacao', 'inconsistente');
  end if;
  return jsonb_build_object('situacao', 'recontar', 'rodada', jsonb_array_length(v_ant) + 2);
end $$;

/* ---------- dono ---------- */

/* O dono registra uma perda (já confirmada). p = {id, comercio_id, produto_id, variacao_id, area, quantidade, motivo, observacao} */
create or replace function public.registrar_perda(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare pe perdas%rowtype; v_com uuid := (p->>'comercio_id')::uuid;
begin
  if not public.pode_acessar_comercio(v_com) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  pe := public._lancar_perda((p->>'id')::uuid, v_com, (p->>'produto_id')::uuid, nullif(p->>'variacao_id', '')::uuid, p->>'area',
          (p->>'quantidade')::numeric, p->>'motivo', p->>'observacao', null, auth.uid());
  return jsonb_build_object('situacao', pe.situacao, 'id', pe.id, 'baixado', pe.baixado);
end $$;

/* Confirmar ou recusar a perda que o funcionário registrou. Recusar vira uma diferença para investigar (o produto já não está lá). */
create or replace function public.decidir_perda(_id uuid, _aceitar boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare pe perdas%rowtype; v_dif uuid;
begin
  select * into pe from perdas where id = _id for update;
  if not found or not public.pode_acessar_comercio(pe.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if pe.situacao <> 'aguardando' then raise exception 'perda_ja_decidida' using errcode = '23514'; end if;
  if _aceitar then
    update perdas set situacao = 'confirmada', decidida_em = now() where id = _id;
  else
    v_dif := public._registrar_diferenca(pe.comercio_id, pe.produto_id, pe.variacao_id, pe.area, 'perda_recusada', pe.baixado, 0, pe.funcionario_id, pe.id,
               jsonb_build_object('motivo_informado', pe.motivo, 'observacao', pe.observacao));
    update perdas set situacao = 'recusada', decidida_em = now(), diferenca_id = v_dif where id = _id;
  end if;
end $$;

/* O dono explica uma diferença (pode mudar a explicação depois). */
create or replace function public.explicar_diferenca(_id uuid, _motivo text, _observacao text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare d diferencas%rowtype;
begin
  select * into d from diferencas where id = _id;
  if not found or not public.pode_acessar_comercio(d.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if _motivo not in ('quebra', 'vencido', 'erro_contagem', 'sumiu', 'consumo', 'outro') then raise exception 'motivo_invalido' using errcode = '22023'; end if;
  update diferencas set situacao = 'explicada', motivo = _motivo, observacao = nullif(left(btrim(coalesce(_observacao, '')), 300), ''),
         explicada_em = now(), explicada_por = auth.uid() where id = _id;
end $$;

/* ---------- permissões das funções ---------- */
revoke all on function public._registrar_diferenca(uuid, uuid, uuid, area_estoque, text, numeric, numeric, uuid, uuid, jsonb),
  public._acertar_area(uuid, uuid, uuid, area_estoque, numeric, uuid, uuid, uuid),
  public._lancar_perda(uuid, uuid, uuid, uuid, text, numeric, text, text, uuid, uuid),
  public.funcionario_registrar_perda(text, uuid, uuid, uuid, text, numeric, text, text), public.funcionario_conferencia_lista(text),
  public.funcionario_conferencia_contar(text, uuid, uuid, uuid, numeric), public.registrar_perda(jsonb), public.decidir_perda(uuid, boolean),
  public.explicar_diferenca(uuid, text, text) from public, anon, authenticated;
grant execute on function public.funcionario_registrar_perda(text, uuid, uuid, uuid, text, numeric, text, text), public.funcionario_conferencia_lista(text),
  public.funcionario_conferencia_contar(text, uuid, uuid, uuid, numeric) to anon, authenticated;
grant execute on function public.registrar_perda(jsonb), public.decidir_perda(uuid, boolean), public.explicar_diferenca(uuid, text, text) to authenticated;


/* ---------- reposição: com caixa ligado, a diferença da prateleira vai para o quadro Diferenças ---------- */
/* Passo 2: "Coloquei na prateleira". Acerta a área de venda pela contagem e passa o que foi levado do depósito para a venda. */
create or replace function public.funcionario_reposicao_concluir(_chave text, _id uuid, _levado numeric) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; rp reposicoes%rowtype; p produtos%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid();
  v_lev numeric; v_atual numeric; v_dif numeric; v_lv uuid; v_ld uuid; pt jsonb; alvo record; v_contada boolean; v_caixa boolean;
begin
  v := public._funcionario_repoe(_chave);
  select * into rp from reposicoes where id = _id for update;
  if not found or rp.comercio_id <> v.comercio_id then raise exception 'reposicao_nao_encontrada' using errcode = '42501'; end if;
  if rp.situacao = 'concluido' then return jsonb_build_object('situacao', 'concluido', 'levado', rp.levado); end if;
  select * into p from produtos where id = rp.produto_id;
  select * into c from comercios where id = rp.comercio_id;
  v_lev := public.qtd_valida(coalesce(_levado, 0), p.unidade, true);
  perform pg_advisory_xact_lock(hashtextextended(p.id::text, 0));
  if v_lev > public.saldo_chave(p.id, rp.variacao_id, 'deposito') then raise exception 'deposito_insuficiente' using errcode = '23514'; end if;
  select local_id into v_lv from produto_areas where produto_id = p.id and variacao_id is not distinct from rp.variacao_id and area = 'venda';
  select local_id into v_ld from produto_areas where produto_id = p.id and variacao_id is not distinct from rp.variacao_id and area = 'deposito';
  insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash, funcionario_id)
  values (v_op, c.dono_id, c.id, p.id, 'reposicao', md5(rp.id::text || v_lev::text), v.id);

  -- 1) A prateleira passa a ter o que foi contado.
  v_atual := public.saldo_chave(p.id, rp.variacao_id, 'venda');
  v_contada := exists (select 1 from contagens where produto_id = p.id and variacao_id is not distinct from rp.variacao_id and area = 'venda');
  -- Com um caixa ligado, as vendas chegam ao Omni: a diferença da prateleira vira alerta para o dono (Fase 4).
  v_caixa := exists (select 1 from caixas where comercio_id = c.id and ligado_em is not null and desligado_em is null);
  v_dif := rp.contado - v_atual;
  if v_dif < 0 then
    perform public._tirar_saldo(c.id, p.id, rp.variacao_id, 'venda', -v_dif, v_op, c.dono_id, v.id, 'ajuste', v_lv);
  elsif v_dif > 0 then
    -- Sobrou na prateleira: vai para o lote de validade mais distante que já está lá; sem lote, sem validade (ou a conferir).
    select s.lote_id, s.pendente, s.pendencia_confirmada into alvo from saldos s left join lotes l on l.id = s.lote_id
     where s.produto_id = p.id and s.variacao_id is not distinct from rp.variacao_id and s.area = 'venda' and s.origem_id is null
     order by (s.quantidade > 0) desc, l.vencimento desc nulls last limit 1;
    if not found then
      perform public._por_saldo(c.id, p.id, rp.variacao_id, 'venda', null, coalesce(p.controla_validade, false), coalesce(p.controla_validade, false) and c.tipo = 'farmacia',
        v_dif, v_op, c.dono_id, v.id, 'ajuste', v_lv);
    else
      perform public._por_saldo(c.id, p.id, rp.variacao_id, 'venda', alvo.lote_id, alvo.pendente, alvo.pendencia_confirmada, v_dif, v_op, c.dono_id, v.id, 'ajuste', v_lv);
    end if;
  end if;
  -- Primeira contagem da área de venda: a quantidade passa a ser conhecida.
  if not exists (select 1 from contagens where produto_id = p.id and variacao_id is not distinct from rp.variacao_id and area = 'venda') then
    insert into contagens (operacao_id, comercio_id, produto_id, variacao_id, area, quantidade, criado_por)
    values (v_op, c.id, p.id, rp.variacao_id, 'venda', rp.contado, c.dono_id);
  end if;

  -- 2) Do depósito para a prateleira, mantendo o lote e a validade.
  for pt in select * from jsonb_array_elements(public._tirar_saldo(c.id, p.id, rp.variacao_id, 'deposito', v_lev, v_op, c.dono_id, v.id, 'transferencia', v_ld)) loop
    perform public._por_saldo(c.id, p.id, rp.variacao_id, 'venda', (pt->>'lote_id')::uuid, (pt->>'pendente')::boolean, (pt->>'pendencia_confirmada')::boolean,
      (pt->>'quantidade')::numeric, v_op, c.dono_id, v.id, 'transferencia', v_lv);
  end loop;

  update reposicoes set levado = v_lev, situacao = 'concluido', concluido_em = now(), operacao_id = v_op where id = rp.id;
  update operacoes set resultado = jsonb_build_object('reposicao', rp.id, 'contado', rp.contado, 'antes', v_atual, 'levado', v_lev) where id = v_op;
  if v_dif <> 0 and v_contada and v_caixa then
    perform public._registrar_diferenca(c.id, p.id, rp.variacao_id, 'venda', 'reposicao', v_atual, rp.contado, v.id, rp.id);
  end if;
  return jsonb_build_object('situacao', 'concluido', 'levado', v_lev);
end $$;
