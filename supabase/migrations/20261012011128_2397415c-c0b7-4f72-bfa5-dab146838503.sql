CREATE OR REPLACE FUNCTION public._resumo_turno(_turno uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
declare t caixa_turnos%rowtype; v_n int; v_total numeric; v_canc int; v_troco numeric; v_sang numeric; f jsonb; r jsonb;
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
  -- F6: pagamentos do fiado recebidos no caixa por este funcionário durante o turno
  select jsonb_build_object(
      'dinheiro', coalesce(sum(valor) filter (where forma = 'dinheiro'), 0),
      'pix', coalesce(sum(valor) filter (where forma = 'pix'), 0),
      'cartao', coalesce(sum(valor) filter (where forma = 'cartao'), 0),
      'quantos', count(*))
    into r from fiado_movimentos
   where comercio_id = t.comercio_id and tipo = 'pagamento' and funcionario_id = t.funcionario_id and registrado_por is null
     and criado_em >= t.aberto_em and (t.fechado_em is null or criado_em <= t.fechado_em);
  return jsonb_build_object('id', t.id, 'situacao', t.situacao, 'aberto_em', t.aberto_em, 'fechado_em', t.fechado_em,
    'troco_inicial', t.troco_inicial, 'vendas', v_n, 'canceladas', v_canc, 'total', v_total,
    'por_forma', f, 'troco_dado', v_troco, 'sangrias', v_sang, 'fiado_recebido', r,
    'dinheiro_esperado', coalesce(t.dinheiro_esperado, t.troco_inicial + (f->>'dinheiro')::numeric + (r->>'dinheiro')::numeric - v_troco - v_sang),
    'dinheiro_contado', t.dinheiro_contado, 'diferenca', t.diferenca);
end $function$;

CREATE OR REPLACE FUNCTION public.caixa_receber_fiado(_chave text, _id uuid, _turno uuid, _cliente uuid, _valor numeric, _forma text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype; t caixa_turnos%rowtype; cl clientes_fiado%rowtype; m fiado_movimentos%rowtype; v_deve numeric;
begin
  v := public._funcionario_caixa(_chave);
  if _id is null then raise exception 'id_obrigatorio' using errcode = '22023'; end if;
  select * into m from fiado_movimentos where id = _id;
  if found then
    if m.comercio_id <> v.comercio_id or m.cliente_id <> _cliente or m.valor <> round(_valor, 2) or m.forma is distinct from _forma then
      raise exception 'operacao_repetida_com_outros_dados' using errcode = 'P0001';
    end if;
    select coalesce(sum(case when tipo = 'compra' then valor else -valor end), 0) into v_deve from fiado_movimentos where cliente_id = _cliente;
    return jsonb_build_object('situacao', 'repetida', 'deve', greatest(v_deve, 0));
  end if;
  select * into t from caixa_turnos where id = _turno and funcionario_id = v.id for update;
  if not found then raise exception 'turno_invalido' using errcode = '42501'; end if;
  if t.situacao <> 'aberto' then raise exception 'turno_fechado' using errcode = 'P0001'; end if;
  select * into cl from clientes_fiado where id = _cliente and comercio_id = v.comercio_id for update;
  if not found then raise exception 'cliente_nao_encontrado' using errcode = 'P0001'; end if;
  if _forma not in ('dinheiro', 'pix', 'cartao') then raise exception 'forma_invalida' using errcode = '22023'; end if;
  if _valor is null or round(_valor, 2) <= 0 then raise exception 'valor_invalido' using errcode = '22023'; end if;
  select coalesce(sum(case when tipo = 'compra' then valor else -valor end), 0) into v_deve from fiado_movimentos where cliente_id = cl.id;
  if round(_valor, 2) > v_deve then raise exception 'valor_maior_que_a_conta' using errcode = '23514'; end if;
  insert into fiado_movimentos (id, comercio_id, cliente_id, tipo, valor, forma, observacao, funcionario_id)
  values (_id, cl.comercio_id, cl.id, 'pagamento', round(_valor, 2), _forma, 'Recebido no caixa', v.id);
  return jsonb_build_object('situacao', 'registrado', 'deve', greatest(v_deve - round(_valor, 2), 0));
end $function$;
REVOKE ALL ON FUNCTION public.caixa_receber_fiado(text, uuid, uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.caixa_receber_fiado(text, uuid, uuid, uuid, numeric, text) TO anon, authenticated;