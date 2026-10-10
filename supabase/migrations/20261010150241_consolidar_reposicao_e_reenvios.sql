-- Consolidação: correções das regras já aprovadas. Sem tabelas novas nem baixa automática de vencidos.
-- Aplicar somente após conferir as migrações anteriores no projeto oficial.

/* Estoque que pode ser reposto: validade conhecida, não vencida e sem pendência.
   Produto sem controle de validade continua usando o saldo físico sem lote. */
create or replace function public._saldo_reponivel(_prod uuid, _var uuid) returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(s.quantidade), 0) from saldos s join produtos p on p.id = s.produto_id
  left join lotes l on l.id = s.lote_id
  where s.produto_id = _prod and s.variacao_id is not distinct from _var and s.area = 'deposito' and s.quantidade > 0
    and not s.pendente and (not coalesce(p.controla_validade, false)
      or l.vencimento >= (now() at time zone 'America/Sao_Paulo')::date);
$$;


/* Alocador exclusivo da reposição. Perdas e ajustes continuam podendo retirar vencidos. */
create or replace function public._tirar_saldo_reposicao(_com uuid, _prod uuid, _var uuid, _area area_estoque, _qtd numeric, _op uuid, _user uuid, _func uuid, _tipo tipo_movimento, _local uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; v_rest numeric := _qtd; v_q numeric; v_out jsonb := '[]';
begin
  if _qtd <= 0 then return v_out; end if;
  for r in select s.id, s.lote_id, s.pendente, s.pendencia_confirmada, s.quantidade from saldos s left join lotes l on l.id = s.lote_id
            where s.comercio_id = _com and s.produto_id = _prod and s.variacao_id is not distinct from _var and s.area = _area and s.quantidade > 0
              and not s.pendente and exists (select 1 from produtos p where p.id = _prod
                and (not coalesce(p.controla_validade, false) or l.vencimento >= (now() at time zone 'America/Sao_Paulo')::date))
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

create or replace function public.funcionario_reposicao_lista(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_repoe(_chave);
  return jsonb_build_object('tipo', (select tipo from comercios where id = v.comercio_id), 'produtos', coalesce((
    select jsonb_agg(public._produto_para_funcionario(pa.produto_id, pa.variacao_id, null)
             || jsonb_build_object('local', lv.nome, 'local_deposito', ld.nome, 'deposito_vazio', public._saldo_reponivel(pa.produto_id, pa.variacao_id) <= 0))
      from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
      left join locais lv on lv.id = pa.local_id
      left join produto_areas pd on pd.produto_id = pa.produto_id and pd.variacao_id is not distinct from pa.variacao_id and pd.area = 'deposito'
      left join locais ld on ld.id = pd.local_id
     where pa.comercio_id = v.comercio_id and pa.area = 'venda' and pa.minimo is not null
       and (pa.variacao_id is null or exists (select 1 from produto_variacoes pv where pv.id = pa.variacao_id and pv.removida_em is null))
       and public.saldo_chave(pa.produto_id, pa.variacao_id, 'venda') <= pa.minimo), '[]'::jsonb));
end $$;

create or replace function public.funcionario_reposicao_contar(_chave text, _id uuid, _produto uuid, _variacao uuid, _contado numeric) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; rp reposicoes%rowtype; p produtos%rowtype; pa produto_areas%rowtype; v_cont numeric; v_dep numeric; v_alvo numeric; v_sug numeric;
  v_ldep text;
begin
  v := public._funcionario_repoe(_chave);
  if _id is null then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('reposicao:' || _id::text, 0));
  select * into rp from reposicoes where id = _id;
  if found then
    if rp.comercio_id <> v.comercio_id or rp.produto_id <> _produto or rp.variacao_id is distinct from _variacao then raise exception 'reposicao_de_outro_produto' using errcode = '42501'; end if;
    if rp.contado is distinct from _contado then raise exception 'operacao_repetida_com_outros_dados' using errcode = '23514'; end if;
  else
    select * into p from produtos where id = _produto and comercio_id = v.comercio_id and ativo;
    if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
    select * into pa from produto_areas where produto_id = p.id and variacao_id is not distinct from _variacao and area = 'venda';
    if not found then raise exception 'produto_sem_area_venda' using errcode = '23514'; end if;
    v_cont := public.qtd_valida(_contado, p.unidade, true);
    if v_cont > 1000000 then raise exception 'quantidade_grande_demais' using errcode = '23514'; end if;
    v_dep := public._saldo_reponivel(p.id, _variacao);
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

create or replace function public.funcionario_reposicao_concluir(_chave text, _id uuid, _levado numeric) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; rp reposicoes%rowtype; p produtos%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid();
  v_lev numeric; v_atual numeric; v_dif numeric; v_lv uuid; v_ld uuid; pt jsonb; alvo record; v_contada boolean; v_caixa boolean;
begin
  v := public._funcionario_repoe(_chave);
  select * into rp from reposicoes where id = _id for update;
  if not found or rp.comercio_id <> v.comercio_id then raise exception 'reposicao_nao_encontrada' using errcode = '42501'; end if;
  if rp.situacao = 'concluido' then
    if rp.levado is distinct from coalesce(_levado, 0) then raise exception 'operacao_repetida_com_outros_dados' using errcode = '23514'; end if;
    return jsonb_build_object('situacao', 'concluido', 'levado', rp.levado);
  end if;
  select * into p from produtos where id = rp.produto_id;
  select * into c from comercios where id = rp.comercio_id;
  v_lev := public.qtd_valida(coalesce(_levado, 0), p.unidade, true);
  perform pg_advisory_xact_lock(hashtextextended(p.id::text, 0));
  if v_lev > rp.sugerido then raise exception 'reposicao_acima_sugerido' using errcode = '23514'; end if;
  if exists (select 1 from produto_areas where produto_id = p.id and variacao_id is not distinct from rp.variacao_id
    and area = 'venda' and maximo is not null and v_lev > greatest(maximo - rp.contado, 0)) then
    raise exception 'reposicao_acima_maximo' using errcode = '23514';
  end if;
  if v_lev > public._saldo_reponivel(p.id, rp.variacao_id) then raise exception 'deposito_reponivel_insuficiente' using errcode = '23514'; end if;
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
  for pt in select * from jsonb_array_elements(public._tirar_saldo_reposicao(c.id, p.id, rp.variacao_id, 'deposito', v_lev, v_op, c.dono_id, v.id, 'transferencia', v_ld)) loop
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

create or replace function public._lancar_perda(_id uuid, _com uuid, _prod uuid, _var uuid, _area text, _qtd numeric, _motivo text, _obs text,
  _func uuid, _dono_registra uuid) returns perdas
language plpgsql security definer set search_path = public, pg_temp as $$
declare pe perdas%rowtype; p produtos%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid(); v_q numeric; v_baixa numeric; v_local uuid; v_area area_estoque;
begin
  if _id is null then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('perda:' || _id::text, 0));
  select * into pe from perdas where id = _id;
  if found then
    if pe.comercio_id <> _com then raise exception 'perda_de_outro_comercio' using errcode = '42501'; end if;
    if pe.produto_id is distinct from _prod or pe.variacao_id is distinct from _var or pe.area::text is distinct from _area
      or pe.quantidade is distinct from _qtd or pe.motivo is distinct from _motivo
      or pe.observacao is distinct from nullif(left(btrim(coalesce(_obs, '')), 300), '') then
      raise exception 'operacao_repetida_com_outros_dados' using errcode = '23514';
    end if;
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

create or replace function public._entrar_no_deposito(_item uuid, _tentativa jsonb, _user uuid, _func uuid) returns numeric
language plpgsql security definer set search_path = public, pg_temp as $$
declare i recebimento_itens%rowtype; p produtos%rowtype; v_farm boolean; v_op uuid := gen_random_uuid(); v_local uuid;
  v_bons numeric; pt jsonb; v_q numeric; v_lote uuid; v_saldo uuid; v_soma numeric := 0; v_venc date; v_num text;
begin
  select * into i from recebimento_itens where id = _item for update;
  select * into p from produtos where id = i.produto_id;
  select tipo = 'farmacia' into v_farm from comercios where id = i.comercio_id;
  v_bons := (_tentativa->>'total')::numeric - coalesce((_tentativa->>'avaria')::numeric, 0);
  if v_bons <= 0 then return 0; end if;
  insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash, funcionario_id)
  values (v_op, _user, i.comercio_id, i.produto_id, 'recebimento', md5(_item::text || coalesce(_tentativa::text, '')), _func);
  perform pg_advisory_xact_lock(hashtextextended(i.produto_id::text, 0));
  select local_id into v_local from produto_areas where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id and area = 'deposito';
  if coalesce(p.controla_validade, false) then
    for pt in select * from jsonb_array_elements(coalesce(_tentativa->'partes', '[]')) loop
      v_q := public.qtd_valida((pt->>'quantidade')::numeric, p.unidade, false);
      v_venc := nullif(pt->>'vencimento', '')::date;
      v_num := nullif(btrim(coalesce(pt->>'lote', '')), '');
      if v_venc is null then raise exception 'validade_obrigatoria' using errcode = '23514'; end if;
      if v_venc < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'recebimento_vencido_como_bom' using errcode = '23514'; end if;
      if v_farm and public.normalizar_lote(v_num) is null then raise exception 'lote_obrigatorio' using errcode = '23514'; end if;
      v_lote := public._lote_da_parte(i.comercio_id, i.produto_id, i.variacao_id, v_num, v_venc);
      select id into v_saldo from saldos where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id
         and area = 'deposito' and lote_id = v_lote and not pendente order by updated_at limit 1 for update;
      if found then update saldos set quantidade = quantidade + v_q, updated_at = now() where id = v_saldo;
      else insert into saldos (comercio_id, produto_id, variacao_id, area, lote_id, quantidade)
           values (i.comercio_id, i.produto_id, i.variacao_id, 'deposito', v_lote, v_q) returning id into v_saldo; end if;
      insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, lote_id, saldo_id, tipo, quantidade, criado_por, funcionario_id)
      values (v_op, i.comercio_id, i.produto_id, i.variacao_id, 'deposito', v_local, v_lote, v_saldo, 'entrada', v_q, _user, _func);
      v_soma := v_soma + v_q;
    end loop;
    if v_soma <> v_bons then raise exception 'validades_nao_somam' using errcode = '23514'; end if;
  else
    v_q := public.qtd_valida(v_bons, p.unidade, false);
    select id into v_saldo from saldos where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id
       and area = 'deposito' and lote_id is null and not pendente order by updated_at limit 1 for update;
    if found then update saldos set quantidade = quantidade + v_q, updated_at = now() where id = v_saldo;
    else insert into saldos (comercio_id, produto_id, variacao_id, area, quantidade)
         values (i.comercio_id, i.produto_id, i.variacao_id, 'deposito', v_q) returning id into v_saldo; end if;
    insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, saldo_id, tipo, quantidade, criado_por, funcionario_id)
    values (v_op, i.comercio_id, i.produto_id, i.variacao_id, 'deposito', v_local, v_saldo, 'entrada', v_q, _user, _func);
  end if;
  update operacoes set resultado = jsonb_build_object('recebimento_item', _item, 'entrada', v_bons) where id = v_op;
  update recebimento_itens set entrou_estoque = entrou_estoque + v_bons where id = _item;
  return v_bons;
end $$;

create or replace function public.funcionario_enviar_recebimento(_chave text, _id uuid, _rodada int, _itens jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; r recebimentos%rowtype; c comercios%rowtype; x jsonb; i recebimento_itens%rowtype;
  p produtos%rowtype; v_total numeric; v_avaria numeric; v_esp numeric; v_no_ped boolean; v_tent jsonb; v_cont numeric[];
  v_sit text; v_recontar jsonb := '[]'; v_faltam jsonb := '[]'; v_res jsonb; v_soma numeric; v_n int := 0; v_aviso boolean := false;
begin
  v := public._funcionario_recebe(_chave);
  select * into r from recebimentos where id = _id for update;
  if not found or r.comercio_id <> v.comercio_id then raise exception 'recebimento_nao_encontrado' using errcode = '42501'; end if;
  if r.situacao = 'concluido' or (_rodada = r.rodada - 1 and r.ultimo_resultado is not null) then
    if r.ultimo_resultado ? '_pedido_hash' and r.ultimo_resultado->>'_pedido_hash' is distinct from md5(_rodada::text || ':' || _itens::text) then
      raise exception 'operacao_repetida_com_outros_dados' using errcode = '23514';
    end if;
    return coalesce(r.ultimo_resultado, jsonb_build_object('situacao', 'concluido'));
  end if;
  if _rodada is distinct from r.rodada then raise exception 'rodada_desatualizada' using errcode = '40001'; end if;
  if jsonb_typeof(_itens) is distinct from 'array' then raise exception 'itens_obrigatorios' using errcode = '22023'; end if;
  if jsonb_array_length(_itens) > 300 then raise exception 'itens_demais' using errcode = '23514'; end if;
  select * into c from comercios where id = r.comercio_id;

  for x in select * from jsonb_array_elements(_itens) loop
    select * into p from produtos where id = (x->>'produto_id')::uuid and comercio_id = r.comercio_id and ativo;
    if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
    if (x->>'variacao_id') is not null and not exists (select 1 from produto_variacoes where id = (x->>'variacao_id')::uuid and produto_id = p.id and removida_em is null) then
      raise exception 'variacao_invalida' using errcode = '23514'; end if;
    select * into i from recebimento_itens where recebimento_id = r.id and produto_id = p.id and variacao_id is not distinct from (x->>'variacao_id')::uuid for update;
    if found and i.situacao <> 'recontar' then continue; end if;   -- já conferido nesta entrega: não muda mais

    v_total := public.qtd_valida((x->>'total')::numeric, p.unidade, true);
    v_avaria := public.qtd_valida(coalesce((x->>'avaria')::numeric, 0), p.unidade, true);
    if v_avaria > v_total then raise exception 'avaria_maior_que_total' using errcode = '23514'; end if;
    if v_total > 1000000 then raise exception 'quantidade_grande_demais' using errcode = '23514'; end if;
    if coalesce(p.controla_validade, false) and v_total - v_avaria > 0 then
      select coalesce(sum((e->>'quantidade')::numeric), 0) into v_soma from jsonb_array_elements(coalesce(x->'partes', '[]')) e;
      if v_soma <> v_total - v_avaria then raise exception 'validades_nao_somam' using errcode = '23514'; end if;
      if exists (select 1 from jsonb_array_elements(x->'partes') e where nullif(e->>'vencimento', '') is null) then
        raise exception 'validade_obrigatoria' using errcode = '23514'; end if;
      if exists (select 1 from jsonb_array_elements(x->'partes') e where (e->>'vencimento')::date < (now() at time zone 'America/Sao_Paulo')::date) then
        raise exception 'recebimento_vencido_como_bom' using errcode = '23514'; end if;
      if c.tipo = 'farmacia' and exists (select 1 from jsonb_array_elements(x->'partes') e where public.normalizar_lote(e->>'lote') is null) then
        raise exception 'lote_obrigatorio' using errcode = '23514'; end if;
    end if;
    v_tent := jsonb_build_object('total', v_total, 'avaria', v_avaria, 'partes', coalesce(x->'partes', '[]'), 'em', now());

    if i.id is null then
      v_no_ped := r.pedido_id is not null and exists (select 1 from pedido_itens where pedido_id = r.pedido_id and produto_id = p.id
                    and variacao_id is not distinct from (x->>'variacao_id')::uuid);
      v_esp := case when v_no_ped then greatest(0, (select sum(coalesce(qtd_confirmada * qtd_unidades / qtd_embalagens, qtd_unidades)) - sum(coalesce(qtd_recebida, 0))
                  from pedido_itens where pedido_id = r.pedido_id and produto_id = p.id and variacao_id is not distinct from (x->>'variacao_id')::uuid)) end;
      insert into recebimento_itens (recebimento_id, comercio_id, produto_id, variacao_id, no_pedido, esperado, situacao)
      values (r.id, r.comercio_id, p.id, (x->>'variacao_id')::uuid, v_no_ped, v_esp, 'recontar') returning * into i;
    end if;

    update recebimento_itens set tentativas = tentativas || v_tent where id = i.id returning * into i;
    select array_agg((t->>'total')::numeric) into v_cont from jsonb_array_elements(i.tentativas) t;
    v_sit := case
      when r.pedido_id is not null and not i.no_pedido then 'fora_do_pedido'
      when i.esperado is null or v_total = i.esperado then 'aceito'
      when array_position(v_cont[1:cardinality(v_cont) - 1], v_total) is not null then 'aceito'
      when cardinality(v_cont) >= 3 then 'inconsistente'
      else 'recontar' end;
    update recebimento_itens set situacao = v_sit,
      quantidade_aceita = case when v_sit in ('aceito', 'fora_do_pedido') then v_total end,
      avaria = case when v_sit in ('aceito', 'fora_do_pedido') then v_avaria else 0 end
     where id = i.id;
    if v_sit = 'recontar' then v_recontar := v_recontar || jsonb_build_object('produto_id', p.id, 'variacao_id', i.variacao_id); end if;
  end loop;

  -- Produtos do pedido que ainda não foram contados (o funcionário conta ou marca "Não veio").
  if r.pedido_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('produto_id', x2.produto_id, 'variacao_id', x2.variacao_id)), '[]') into v_faltam
      from (select distinct produto_id, variacao_id from pedido_itens pi where pi.pedido_id = r.pedido_id
             and not exists (select 1 from recebimento_itens ri where ri.recebimento_id = r.id and ri.produto_id = pi.produto_id
                              and ri.variacao_id is not distinct from pi.variacao_id)) x2;
  end if;
  if not exists (select 1 from recebimento_itens where recebimento_id = r.id) then raise exception 'recebimento_vazio' using errcode = '23514'; end if;

  if jsonb_array_length(v_recontar) > 0 or jsonb_array_length(v_faltam) > 0 then
    v_res := jsonb_build_object('situacao', 'recontar', 'recontar', v_recontar, 'faltam', v_faltam, 'rodada', r.rodada + 1);
    v_res := v_res || jsonb_build_object('_pedido_hash', md5(_rodada::text || ':' || _itens::text));
    update recebimentos set rodada = rodada + 1, ultimo_resultado = v_res where id = r.id;
    return v_res;
  end if;

  -- Tudo conferido: entra no depósito o que foi aceito (fora do pedido e inconsistências esperam o dono).
  for i in select * from recebimento_itens where recebimento_id = r.id and situacao = 'aceito' loop
    perform public._entrar_no_deposito(i.id, i.tentativas -> (jsonb_array_length(i.tentativas) - 1), c.dono_id, v.id);
    v_n := v_n + 1;
  end loop;
  v_aviso := exists (select 1 from recebimento_itens where recebimento_id = r.id
     and (situacao in ('inconsistente', 'fora_do_pedido') or avaria > 0 or (esperado is not null and quantidade_aceita is distinct from esperado)));
  v_res := jsonb_build_object('situacao', 'concluido', 'produtos', (select count(*) from recebimento_itens where recebimento_id = r.id), 'avisos', v_aviso, 'rodada', r.rodada + 1);
  v_res := v_res || jsonb_build_object('_pedido_hash', md5(_rodada::text || ':' || _itens::text));
  update recebimentos set situacao = 'concluido', concluido_em = now(), rodada = rodada + 1, ultimo_resultado = v_res where id = r.id;
  perform public._fechar_pedido_recebido(r.pedido_id);
  return v_res;
end $$;

-- Helpers internos não são chamadas públicas. Permissões das RPCs existentes ficam preservadas.
revoke all on function public._saldo_reponivel(uuid, uuid),
 public._tirar_saldo_reposicao(uuid, uuid, uuid, area_estoque, numeric, uuid, uuid, uuid, tipo_movimento, uuid)
 from public, anon, authenticated;
grant execute on function public._saldo_reponivel(uuid, uuid),
 public._tirar_saldo_reposicao(uuid, uuid, uuid, area_estoque, numeric, uuid, uuid, uuid, tipo_movimento, uuid) to service_role;
