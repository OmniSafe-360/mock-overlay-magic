-- Checklist funcional, item 9: variação removida depois do pedido não trava a entrega.
-- Contagem positiva da variação histórica aguarda o dono; Não veio segue a conferência normal.
-- Aceitar restaura a variação com os vínculos existentes, sem estoque escondido nem código duplicado.
-- Nenhuma tabela ou função nova. Comparação obrigatória antes de substituir as funções existentes.
-- Se o banco foi alterado diretamente, interrompe sem substituir nada: revisar a diferença primeiro.
do $conferir$
declare v_body text;
begin
  select prosrc into v_body from pg_proc where oid = 'public.funcionario_enviar_recebimento(text,uuid,integer,jsonb)'::regprocedure and prosecdef and proconfig = array['search_path=public, pg_temp'];
  if md5(v_body) is distinct from '1d4b656ebac6b4676fe5ce600a8ecccd' then
    raise exception 'funcao_diverge_do_arquivo: funcionario_enviar_recebimento';
  end if;
  select prosrc into v_body from pg_proc where oid = 'public._entrar_no_deposito(uuid,jsonb,uuid,uuid)'::regprocedure and prosecdef and proconfig = array['search_path=public, pg_temp'];
  if md5(v_body) is distinct from '68092e99bd9bdcba4fd3c625e8523c3f' then
    raise exception 'funcao_diverge_do_arquivo: _entrar_no_deposito';
  end if;
  select prosrc into v_body from pg_proc where oid = 'public.resolver_item_recebimento(uuid,text,integer)'::regprocedure and prosecdef and proconfig = array['search_path=public, pg_temp'];
  if md5(v_body) is distinct from '0d373568424f135c98d3e1dfb28428b8' then
    raise exception 'funcao_diverge_do_arquivo: resolver_item_recebimento';
  end if;
end $conferir$;

create or replace function public.funcionario_enviar_recebimento(_chave text, _id uuid, _rodada int, _itens jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; r recebimentos%rowtype; c comercios%rowtype; x jsonb; i recebimento_itens%rowtype;
  p produtos%rowtype; v_total numeric; v_avaria numeric; v_esp numeric; v_no_ped boolean; v_tent jsonb; v_cont numeric[];
  v_sit text; v_recontar jsonb := '[]'; v_faltam jsonb := '[]'; v_res jsonb; v_estados jsonb; v_soma numeric; v_n int := 0; v_aviso boolean := false; v_removida boolean; v_variacao text;
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
    select * into p from produtos where id = (x->>'produto_id')::uuid and comercio_id = r.comercio_id and ativo for update;
    if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
    v_removida := false; v_variacao := null;
    if (x->>'variacao_id') is not null then
      select removida_em is not null, tamanho || ' · ' || cor into v_removida, v_variacao
        from produto_variacoes where id = (x->>'variacao_id')::uuid and produto_id = p.id and comercio_id = r.comercio_id for update;
      if not found or (v_removida and not exists (
        select 1 from pedido_itens where pedido_id = r.pedido_id and produto_id = p.id and variacao_id = (x->>'variacao_id')::uuid)) then
        raise exception 'variacao_invalida' using errcode = '23514'; end if;
    end if;
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
    v_tent := jsonb_build_object('total', v_total, 'avaria', v_avaria, 'partes', coalesce(x->'partes', '[]'), 'em', now(),
      'variacao_removida', v_removida, 'variacao', v_variacao);

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
      when v_removida and v_total > 0 then 'inconsistente'
      when r.pedido_id is not null and not i.no_pedido then 'fora_do_pedido'
      when i.esperado is null or v_total = i.esperado then 'aceito'
      when array_position(v_cont[1:cardinality(v_cont) - 1], v_total) is not null then 'aceito'
      when cardinality(v_cont) >= 3 then 'inconsistente'
      else 'recontar' end;
    update recebimento_itens set situacao = v_sit,
      quantidade_aceita = case when v_sit in ('aceito', 'fora_do_pedido') then v_total end,
      avaria = case when v_sit in ('aceito', 'fora_do_pedido') then v_avaria else 0 end
     where id = i.id;
  end loop;

  -- Uma variação pode ser removida depois de uma contagem parcial aceita.
  -- Trava a variação até a conclusão: nunca entra estoque escondido no cadastro.
  perform pv.id from produto_variacoes pv join recebimento_itens ri on ri.variacao_id = pv.id
    where ri.recebimento_id = r.id and ri.situacao = 'aceito' for update of pv;
  update recebimento_itens ri set situacao = 'inconsistente', quantidade_aceita = null, avaria = 0,
    tentativas = jsonb_set(ri.tentativas, array[(jsonb_array_length(ri.tentativas) - 1)::text],
      ri.tentativas -> (jsonb_array_length(ri.tentativas) - 1) || jsonb_build_object(
        'variacao_removida', true, 'variacao', pv.tamanho || ' · ' || pv.cor))
    from produto_variacoes pv where ri.recebimento_id = r.id and ri.variacao_id = pv.id
      and pv.removida_em is not null and ri.situacao = 'aceito' and ri.quantidade_aceita > 0;

  -- Toda recontagem pendente bloqueia a conclusão, inclusive itens omitidos neste envio parcial.
  select coalesce(jsonb_agg(jsonb_build_object('produto_id', produto_id, 'variacao_id', variacao_id)
    order by produto_id, variacao_id), '[]') into v_recontar
    from recebimento_itens where recebimento_id = r.id and situacao = 'recontar';
  select coalesce(jsonb_agg(jsonb_build_object('produto_id', produto_id, 'variacao_id', variacao_id, 'situacao', situacao)
    order by produto_id, variacao_id), '[]') into v_estados
    from recebimento_itens where recebimento_id = r.id;

  -- Produtos do pedido que ainda não foram contados (o funcionário conta ou marca "Não veio").
  if r.pedido_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('produto_id', x2.produto_id, 'variacao_id', x2.variacao_id)), '[]') into v_faltam
      from (select distinct produto_id, variacao_id from pedido_itens pi where pi.pedido_id = r.pedido_id
             and not exists (select 1 from recebimento_itens ri where ri.recebimento_id = r.id and ri.produto_id = pi.produto_id
                              and ri.variacao_id is not distinct from pi.variacao_id)) x2;
  end if;
  if not exists (select 1 from recebimento_itens where recebimento_id = r.id) then raise exception 'recebimento_vazio' using errcode = '23514'; end if;

  if jsonb_array_length(v_recontar) > 0 or jsonb_array_length(v_faltam) > 0 then
    v_res := jsonb_build_object('situacao', 'recontar', 'recontar', v_recontar, 'faltam', v_faltam, 'rodada', r.rodada + 1, 'itens', v_estados);
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
  v_res := jsonb_build_object('situacao', 'concluido', 'produtos', (select count(*) from recebimento_itens where recebimento_id = r.id), 'avisos', v_aviso, 'rodada', r.rodada + 1, 'itens', v_estados);
  v_res := v_res || jsonb_build_object('_pedido_hash', md5(_rodada::text || ':' || _itens::text));
  update recebimentos set situacao = 'concluido', concluido_em = now(), rodada = rodada + 1, ultimo_resultado = v_res where id = r.id;
  perform public._fechar_pedido_recebido(r.pedido_id);
  return v_res;
end $$;

create or replace function public._entrar_no_deposito(_item uuid, _tentativa jsonb, _user uuid, _func uuid) returns numeric
language plpgsql security definer set search_path = public, pg_temp as $$
declare i recebimento_itens%rowtype; p produtos%rowtype; v_farm boolean; v_op uuid := gen_random_uuid(); v_local uuid;
  v_bons numeric; pt jsonb; v_q numeric; v_lote uuid; v_saldo uuid; v_soma numeric := 0; v_venc date; v_num text;
begin
  select * into i from recebimento_itens where id = _item for update;
  select * into p from produtos where id = i.produto_id for update;
  select tipo = 'farmacia' into v_farm from comercios where id = i.comercio_id;
  v_bons := (_tentativa->>'total')::numeric - coalesce((_tentativa->>'avaria')::numeric, 0);
  if v_bons <= 0 then return 0; end if;
  if i.variacao_id is not null then
    perform id from produto_variacoes where id = i.variacao_id and removida_em is null for update;
    if not found then raise exception 'variacao_removida_recebimento' using errcode = '23514'; end if;
  end if;
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

create or replace function public.resolver_item_recebimento(_item uuid, _acao text, _tentativa int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare i recebimento_itens%rowtype; r recebimentos%rowtype; v_t jsonb; pv produto_variacoes%rowtype;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into i from recebimento_itens where id = _item for update;
  if not found or not public.pode_acessar_comercio(i.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  select * into r from recebimentos where id = i.recebimento_id;
  if r.situacao <> 'concluido' then raise exception 'recebimento_em_contagem' using errcode = '23514'; end if;
  if i.situacao not in ('inconsistente', 'fora_do_pedido') then raise exception 'item_ja_resolvido' using errcode = '23514'; end if;
  if _acao = 'recusar' then
    update recebimento_itens set situacao = 'recusado', resolvido_por = auth.uid(), resolvido_em = now() where id = _item;
    if i.no_pedido then
      update pedido_itens set qtd_recebida = 0 where pedido_id = r.pedido_id and produto_id = i.produto_id
        and variacao_id is not distinct from i.variacao_id;
    end if;
  elsif _acao = 'aceitar' then
    v_t := case when i.situacao = 'inconsistente' then i.tentativas -> _tentativa else i.tentativas -> (jsonb_array_length(i.tentativas) - 1) end;
    if v_t is null then raise exception 'contagem_invalida' using errcode = '22023'; end if;
    -- Só a decisão do dono pode restaurar a variação, antes da entrada na mesma transação.
    -- Sem peças boas, nenhuma restauração é necessária.
    if i.variacao_id is not null and (v_t->>'total')::numeric - coalesce((v_t->>'avaria')::numeric, 0) > 0 then
      perform id from produtos where id = i.produto_id for update;
      select * into pv from produto_variacoes where id = i.variacao_id for update;
      if pv.removida_em is not null then
        if exists (select 1 from produto_variacoes where produto_id = i.produto_id and removida_em is null
          and id <> pv.id and lower(btrim(tamanho)) = lower(btrim(pv.tamanho)) and lower(btrim(cor)) = lower(btrim(pv.cor))) then
          raise exception 'variacao_igual_ativa_recebimento' using errcode = '23514'; end if;
        if pv.codigo_barras is not null and exists (select 1 from codigos_barras
          where comercio_id = i.comercio_id and codigo = pv.codigo_barras) then
          raise exception 'codigo_em_uso: %', pv.codigo_barras using errcode = '23505'; end if;
        update produto_variacoes set removida_em = null where id = pv.id;
      end if;
    end if;
    update recebimento_itens set situacao = 'aceito', quantidade_aceita = (v_t->>'total')::numeric, avaria = coalesce((v_t->>'avaria')::numeric, 0),
      resolvido_por = auth.uid(), resolvido_em = now() where id = _item;
    perform public._entrar_no_deposito(_item, v_t, auth.uid(), null);
  else
    raise exception 'acao_invalida' using errcode = '22023';
  end if;
  perform public._fechar_pedido_recebido(r.pedido_id);
end $$;

notify pgrst, 'reload schema';
