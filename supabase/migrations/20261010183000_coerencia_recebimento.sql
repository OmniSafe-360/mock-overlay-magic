-- Coerência do recebimento e da reposição. Sem novas tabelas ou mudança no critério de aceite.
-- As respostas da equipe contêm somente identificação e situação, nunca a quantidade esperada.
create or replace function public._motivo_sem_reposicao(_prod uuid, _var uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when public._saldo_reponivel(_prod, _var) > 0 then null
    when public.saldo_chave(_prod, _var, 'deposito') > 0
      or exists (select 1 from recebimento_itens ri where ri.comercio_id = (select comercio_id from produtos where id = _prod)
        and ri.produto_id = _prod
        and ri.variacao_id is not distinct from _var and ri.situacao in ('inconsistente', 'fora_do_pedido'))
      then 'estoque_nao_liberado'
    when exists (select 1 from recebimentos r join produtos p on p.comercio_id = r.comercio_id
      where p.id = _prod and r.situacao = 'contando' and (
        exists (select 1 from recebimento_itens ri where ri.recebimento_id = r.id and ri.produto_id = _prod
          and ri.variacao_id is not distinct from _var and ri.situacao <> 'recusado')
        or exists (select 1 from pedido_itens pi where pi.pedido_id = r.pedido_id and pi.produto_id = _prod
          and pi.variacao_id is not distinct from _var))) then 'recebimento_em_conferencia'
    when not exists (select 1 from contagens where produto_id = _prod
      and variacao_id is not distinct from _var and area = 'deposito') then 'deposito_nao_contado'
    else 'deposito_sem_estoque' end;
$$;
revoke all on function public._motivo_sem_reposicao(uuid, uuid) from public, anon, authenticated;
grant execute on function public._motivo_sem_reposicao(uuid, uuid) to service_role;

create or replace function public.funcionario_reposicao_lista(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_repoe(_chave);
  return jsonb_build_object('tipo', (select tipo from comercios where id = v.comercio_id), 'produtos', coalesce((
    select jsonb_agg(public._produto_para_funcionario(pa.produto_id, pa.variacao_id, null)
             || jsonb_build_object('local', lv.nome, 'local_deposito', ld.nome, 'deposito_vazio', public._saldo_reponivel(pa.produto_id, pa.variacao_id) <= 0,
                'motivo_sem_reposicao', public._motivo_sem_reposicao(pa.produto_id, pa.variacao_id)))
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
    'motivo_sem_reposicao', case when rp.sugerido = 0 then public._motivo_sem_reposicao(rp.produto_id, rp.variacao_id) end,
    'deposito_vazio', rp.sugerido = 0 and coalesce(pa.maximo, pa.minimo * 2, rp.contado) > rp.contado);
end $$;

create or replace function public.funcionario_enviar_recebimento(_chave text, _id uuid, _rodada int, _itens jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; r recebimentos%rowtype; c comercios%rowtype; x jsonb; i recebimento_itens%rowtype;
  p produtos%rowtype; v_total numeric; v_avaria numeric; v_esp numeric; v_no_ped boolean; v_tent jsonb; v_cont numeric[];
  v_sit text; v_recontar jsonb := '[]'; v_faltam jsonb := '[]'; v_res jsonb; v_estados jsonb; v_soma numeric; v_n int := 0; v_aviso boolean := false;
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
  end loop;

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

notify pgrst, 'reload schema';
