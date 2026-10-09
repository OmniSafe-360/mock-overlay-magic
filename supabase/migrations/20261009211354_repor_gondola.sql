-- Etapa E3: repor gôndola pelo app do funcionário (desenho aprovado pelo dono em 09/10/2026).
-- Primeiro o funcionário conta a prateleira (às cegas); só depois o app diz quanto buscar no depósito (até o máximo).
-- Até o PDV existir, a contagem da prateleira só acerta o estoque da área de venda (a diferença fica guardada para o dono, sem alerta).
-- Tudo numa transação, com uma operação permanente por reposição (regra da base consolidada).

create table public.reposicoes (
  id uuid primary key,                          -- gerado no celular: repetir não duplica
  comercio_id uuid not null references public.comercios(id),
  produto_id uuid not null,
  variacao_id uuid,
  funcionario_id uuid not null references public.funcionarios(id),
  contado numeric(14,3) not null check (contado >= 0),     -- quanto havia na prateleira (contagem cega)
  esperado numeric(14,3) not null,                         -- quanto o sistema tinha na área de venda (só o dono vê)
  sugerido numeric(14,3) not null check (sugerido >= 0),   -- quanto o app mandou buscar
  levado numeric(14,3) check (levado is null or levado >= 0),
  situacao text not null default 'contado' check (situacao in ('contado', 'concluido')),
  operacao_id uuid references public.operacoes(id),
  created_at timestamptz not null default now(),
  concluido_em timestamptz,
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id),
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id)
);
create index reposicoes_comercio_idx on public.reposicoes (comercio_id, created_at desc);
alter table public.reposicoes enable row level security;
create policy "dono ve reposicoes do seu comercio" on public.reposicoes for select to authenticated
  using (public.pode_acessar_comercio(comercio_id));
revoke all on public.reposicoes from anon, authenticated;
grant select on public.reposicoes to authenticated;

/* Funcionário que pode repor. */
create or replace function public._funcionario_repoe(_chave text) returns public.funcionarios
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_da_chave(_chave);
  if v.funcao not in ('repor', 'ambos') then raise exception 'funcao_nao_permite_repor' using errcode = '42501'; end if;
  return v;
end $$;

/* Tira uma quantidade de uma área (validade mais próxima primeiro; sem validade conhecida por último). Devolve as partes tiradas. */
create or replace function public._tirar_saldo(_com uuid, _prod uuid, _var uuid, _area area_estoque, _qtd numeric, _op uuid, _user uuid, _func uuid, _tipo tipo_movimento, _local uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; v_rest numeric := _qtd; v_q numeric; v_out jsonb := '[]';
begin
  if _qtd <= 0 then return v_out; end if;
  for r in select s.id, s.lote_id, s.pendente, s.pendencia_confirmada, s.quantidade from saldos s left join lotes l on l.id = s.lote_id
            where s.produto_id = _prod and s.variacao_id is not distinct from _var and s.area = _area and s.quantidade > 0
            order by s.pendente, l.vencimento nulls last, s.updated_at for update of s loop
    exit when v_rest <= 0;
    v_q := least(r.quantidade, v_rest);
    update saldos set quantidade = quantidade - v_q, updated_at = now() where id = r.id;
    insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, lote_id, saldo_id, tipo, quantidade, criado_por, funcionario_id)
    values (_op, _com, _prod, _var, _area, _local, r.lote_id, r.id, _tipo, -v_q, _user, _func);
    v_out := v_out || jsonb_build_object('lote_id', r.lote_id, 'pendente', r.pendente, 'pendencia_confirmada', r.pendencia_confirmada, 'quantidade', v_q);
    v_rest := v_rest - v_q;
  end loop;
  if v_rest > 0 then raise exception 'saldo_insuficiente' using errcode = '23514'; end if;
  return v_out;
end $$;

/* Põe uma quantidade numa área, no mesmo lote (ou na mesma situação de validade). */
create or replace function public._por_saldo(_com uuid, _prod uuid, _var uuid, _area area_estoque, _lote uuid, _pend boolean, _pendconf boolean, _qtd numeric,
  _op uuid, _user uuid, _func uuid, _tipo tipo_movimento, _local uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_s uuid;
begin
  if _qtd <= 0 then return; end if;
  select id into v_s from saldos where produto_id = _prod and variacao_id is not distinct from _var and area = _area and lote_id is not distinct from _lote
     and pendente = _pend and pendencia_confirmada = _pendconf and origem_id is null order by updated_at limit 1 for update;
  if found then update saldos set quantidade = quantidade + _qtd, updated_at = now() where id = v_s;
  else insert into saldos (comercio_id, produto_id, variacao_id, area, lote_id, pendente, pendencia_confirmada, quantidade)
       values (_com, _prod, _var, _area, _lote, _pend, _pendconf, _qtd) returning id into v_s; end if;
  insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, lote_id, saldo_id, tipo, quantidade, criado_por, funcionario_id)
  values (_op, _com, _prod, _var, _area, _local, _lote, v_s, _tipo, _qtd, _user, _func);
end $$;

/* Lista do que repor: produtos com a área de venda no mínimo (sem quantidades). */
create or replace function public.funcionario_reposicao_lista(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_repoe(_chave);
  return jsonb_build_object('tipo', (select tipo from comercios where id = v.comercio_id), 'produtos', coalesce((
    select jsonb_agg(public._produto_para_funcionario(pa.produto_id, pa.variacao_id, null)
             || jsonb_build_object('local', lv.nome, 'local_deposito', ld.nome, 'deposito_vazio', public.saldo_chave(pa.produto_id, pa.variacao_id, 'deposito') <= 0))
      from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
      left join locais lv on lv.id = pa.local_id
      left join produto_areas pd on pd.produto_id = pa.produto_id and pd.variacao_id is not distinct from pa.variacao_id and pd.area = 'deposito'
      left join locais ld on ld.id = pd.local_id
     where pa.comercio_id = v.comercio_id and pa.area = 'venda' and pa.minimo is not null
       and (pa.variacao_id is null or exists (select 1 from produto_variacoes pv where pv.id = pa.variacao_id and pv.removida_em is null))
       and public.saldo_chave(pa.produto_id, pa.variacao_id, 'venda') <= pa.minimo), '[]'::jsonb));
end $$;

/* Passo 1: o funcionário contou a prateleira. Devolve só quanto buscar (nunca quanto o sistema tinha). */
create or replace function public.funcionario_reposicao_contar(_chave text, _id uuid, _produto uuid, _variacao uuid, _contado numeric) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; rp reposicoes%rowtype; p produtos%rowtype; pa produto_areas%rowtype; v_cont numeric; v_dep numeric; v_alvo numeric; v_sug numeric;
  v_ldep text;
begin
  v := public._funcionario_repoe(_chave);
  select * into rp from reposicoes where id = _id;
  if found then
    if rp.comercio_id <> v.comercio_id or rp.produto_id <> _produto then raise exception 'reposicao_de_outro_produto' using errcode = '42501'; end if;
  else
    select * into p from produtos where id = _produto and comercio_id = v.comercio_id and ativo;
    if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
    select * into pa from produto_areas where produto_id = p.id and variacao_id is not distinct from _variacao and area = 'venda';
    if not found then raise exception 'produto_sem_area_venda' using errcode = '23514'; end if;
    v_cont := public.qtd_valida(_contado, p.unidade, true);
    if v_cont > 1000000 then raise exception 'quantidade_grande_demais' using errcode = '23514'; end if;
    v_dep := public.saldo_chave(p.id, _variacao, 'deposito');
    v_alvo := coalesce(pa.maximo, pa.minimo * 2, v_cont);
    v_sug := least(greatest(v_alvo - v_cont, 0), greatest(v_dep, 0));
    if not public.unidade_fracionada(p.unidade) then v_sug := floor(v_sug); end if;
    insert into reposicoes (id, comercio_id, produto_id, variacao_id, funcionario_id, contado, esperado, sugerido)
    values (_id, v.comercio_id, p.id, _variacao, v.id, v_cont, public.saldo_chave(p.id, _variacao, 'venda'), v_sug) returning * into rp;
  end if;
  select l.nome into v_ldep from produto_areas pd join locais l on l.id = pd.local_id
   where pd.produto_id = rp.produto_id and pd.variacao_id is not distinct from rp.variacao_id and pd.area = 'deposito';
  select * into pa from produto_areas where produto_id = rp.produto_id and variacao_id is not distinct from rp.variacao_id and area = 'venda';
  return jsonb_build_object('id', rp.id, 'sugerido', rp.sugerido, 'situacao', rp.situacao, 'local_deposito', v_ldep,
    'cheio', coalesce(pa.maximo, pa.minimo * 2, rp.contado) <= rp.contado,
    'deposito_vazio', rp.sugerido = 0 and coalesce(pa.maximo, pa.minimo * 2, rp.contado) > rp.contado);
end $$;

/* Passo 2: "Coloquei na prateleira". Acerta a área de venda pela contagem e passa o que foi levado do depósito para a venda. */
create or replace function public.funcionario_reposicao_concluir(_chave text, _id uuid, _levado numeric) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; rp reposicoes%rowtype; p produtos%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid();
  v_lev numeric; v_atual numeric; v_dif numeric; v_lv uuid; v_ld uuid; pt jsonb; alvo record;
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

  -- 1) A prateleira passa a ter o que foi contado (até o PDV existir, a diferença não vira alerta).
  v_atual := public.saldo_chave(p.id, rp.variacao_id, 'venda');
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
  return jsonb_build_object('situacao', 'concluido', 'levado', v_lev);
end $$;

revoke all on function public._funcionario_repoe(text), public._tirar_saldo(uuid, uuid, uuid, area_estoque, numeric, uuid, uuid, uuid, tipo_movimento, uuid),
  public._por_saldo(uuid, uuid, uuid, area_estoque, uuid, boolean, boolean, numeric, uuid, uuid, uuid, tipo_movimento, uuid),
  public.funcionario_reposicao_lista(text), public.funcionario_reposicao_contar(text, uuid, uuid, uuid, numeric),
  public.funcionario_reposicao_concluir(text, uuid, numeric) from public, anon, authenticated;
grant execute on function public.funcionario_reposicao_lista(text), public.funcionario_reposicao_contar(text, uuid, uuid, uuid, numeric),
  public.funcionario_reposicao_concluir(text, uuid, numeric) to anon, authenticated;
