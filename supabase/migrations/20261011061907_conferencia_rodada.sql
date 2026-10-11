-- Checklist funcional, item 2: reenviar a mesma contagem do depósito (internet caiu antes da resposta)
-- não pode virar uma 2ª contagem. O celular passa a mandar a rodada (1, 2 ou 3); a lista diz em que rodada
-- uma contagem começada parou. A versão antiga (sem rodada) fica só até o app publicado usar a nova.
create or replace function public.funcionario_conferencia_contar(_chave text, _id uuid, _produto uuid, _variacao uuid, _contado numeric, _rodada int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; cf conferencias%rowtype; p produtos%rowtype; c comercios%rowtype; v_cont numeric; v_esp numeric; v_contada boolean;
  v_ant jsonb; v_aceita boolean := false; v_op uuid; v_dif uuid; v_n int;
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
  -- Rodada que o celular está enviando (1, 2 ou 3). Reenvio da mesma rodada (internet caiu antes da resposta)
  -- devolve a mesma resposta e não vira uma nova contagem.
  v_n := jsonb_array_length(cf.tentativas);
  if _rodada is not null and _rodada = v_n and v_n > 0 then
    if (cf.tentativas ->> (v_n - 1))::numeric = v_cont then
      return jsonb_build_object('situacao', 'recontar', 'rodada', v_n + 1);
    end if;
    raise exception 'operacao_repetida_com_outros_dados' using errcode = '23514';
  end if;
  if _rodada is distinct from v_n + 1 then raise exception 'rodada_desatualizada' using errcode = '40001'; end if;
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
revoke all on function public.funcionario_conferencia_contar(text, uuid, uuid, uuid, numeric, int) from public;
grant execute on function public.funcionario_conferencia_contar(text, uuid, uuid, uuid, numeric, int) to anon, authenticated;

create or replace function public.funcionario_conferencia_lista(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_feitos int; v_vis int; v_meta int; v_falta int;
begin
  v := public._funcionario_da_chave(_chave);
  select count(distinct (produto_id, variacao_id)) into v_feitos from conferencias
   where comercio_id = v.comercio_id and area = 'deposito' and situacao <> 'contando' and (created_at at time zone 'America/Sao_Paulo')::date = v_hoje;
  select count(*) into v_vis from public._produtos_visados(v.comercio_id) vz
    join produto_areas pa on pa.produto_id = vz.produto_id and pa.variacao_id is not distinct from vz.variacao_id and pa.area = 'deposito'
    join produtos p on p.id = pa.produto_id and p.ativo;
  v_meta := 5 + v_vis;
  v_falta := greatest(0, v_meta - v_feitos);
  return jsonb_build_object('tipo', (select tipo from comercios where id = v.comercio_id), 'feitos_hoje', v_feitos, 'meta', v_meta, 'produtos', coalesce((
    select jsonb_agg(public._produto_para_funcionario(x.produto_id, x.variacao_id, null) || jsonb_build_object('local', x.local, 'conferencia_id', x.aberta,
             'rodada', (select jsonb_array_length(cf.tentativas) + 1 from conferencias cf where cf.id = x.aberta)) order by x.ordem)
      from (
        select y.*, row_number() over (order by y.visado desc, y.ultima nulls first, y.valor desc, y.nome) as ordem
          from (
            select pa.produto_id, pa.variacao_id, l.nome as local, p.nome,
                   exists (select 1 from public._produtos_visados(v.comercio_id) vz where vz.produto_id = pa.produto_id and vz.variacao_id is not distinct from pa.variacao_id) as visado,
                   (select cf.id from conferencias cf where cf.produto_id = pa.produto_id and cf.variacao_id is not distinct from pa.variacao_id
                      and cf.area = 'deposito' and cf.situacao = 'contando' order by cf.created_at desc limit 1) as aberta,
                   (select max(cf.created_at) from conferencias cf where cf.produto_id = pa.produto_id and cf.variacao_id is not distinct from pa.variacao_id and cf.area = 'deposito') as ultima,
                   public.saldo_chave(pa.produto_id, pa.variacao_id, 'deposito') * p.preco_compra as valor
              from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
              left join locais l on l.id = pa.local_id
             where pa.comercio_id = v.comercio_id and pa.area = 'deposito'
               and (pa.variacao_id is null or exists (select 1 from produto_variacoes pv where pv.id = pa.variacao_id and pv.removida_em is null))
          ) y
         where (y.visado and not exists (select 1 from conferencias cf where cf.produto_id = y.produto_id and cf.variacao_id is not distinct from y.variacao_id
                                           and cf.area = 'deposito' and cf.situacao <> 'contando' and (cf.created_at at time zone 'America/Sao_Paulo')::date = v_hoje))
            or (not y.visado and not exists (select 1 from conferencias cf where cf.produto_id = y.produto_id and cf.variacao_id is not distinct from y.variacao_id
                                           and cf.area = 'deposito' and cf.situacao <> 'contando' and cf.created_at > now() - interval '7 days'))
      ) x where x.ordem <= v_falta), '[]'::jsonb));
end $$;

notify pgrst, 'reload schema';
