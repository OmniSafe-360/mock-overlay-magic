CREATE OR REPLACE FUNCTION public.funcionario_reposicao_concluir(_chave text, _id uuid, _levado numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype; rp reposicoes%rowtype; p produtos%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid();
  v_lev numeric; v_atual numeric; v_esperado numeric; v_dif numeric; v_lv uuid; v_ld uuid; pt jsonb; alvo record; v_contada boolean; v_caixa boolean;
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

  -- 1) Acerto da prateleira pela diferença NA HORA DA CONTAGEM (contado − o que o sistema tinha então).
  --    O que entrou ou saiu depois (ex.: vendas no caixa enquanto o funcionário buscava no depósito) continua valendo.
  v_atual := public.saldo_chave(p.id, rp.variacao_id, 'venda');
  v_esperado := coalesce(rp.esperado, v_atual);
  v_contada := exists (select 1 from contagens where produto_id = p.id and variacao_id is not distinct from rp.variacao_id and area = 'venda');
  v_caixa := exists (select 1 from caixas where comercio_id = c.id and ligado_em is not null and desligado_em is null);
  v_dif := rp.contado - v_esperado;
  if v_dif < 0 then
    -- Nunca tira mais do que há agora na prateleira.
    if least(-v_dif, greatest(v_atual, 0)) > 0 then
      perform public._tirar_saldo(c.id, p.id, rp.variacao_id, 'venda', least(-v_dif, greatest(v_atual, 0)), v_op, c.dono_id, v.id, 'ajuste', v_lv);
    end if;
  elsif v_dif > 0 then
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
  update operacoes set resultado = jsonb_build_object('reposicao', rp.id, 'contado', rp.contado, 'esperado', v_esperado, 'antes', v_atual, 'levado', v_lev) where id = v_op;
  if v_dif <> 0 and v_contada and v_caixa then
    perform public._registrar_diferenca(c.id, p.id, rp.variacao_id, 'venda', 'reposicao', v_esperado, rp.contado, v.id, rp.id);
  end if;
  return jsonb_build_object('situacao', 'concluido', 'levado', v_lev);
end $function$;