-- Regra aprovada pelo dono após o caso do Nescau: até três contagens cegas em depósito/gôndola.
-- Duas iguais com diferença ou três diferentes aguardam o dono, sem acerto automático.
-- Reutiliza conferencias/diferencas/reposicoes; nenhuma tabela, coluna ou saldo histórico é alterado.

create or replace function public.funcionario_conferencia_contar(_chave text,_id uuid,_produto uuid,_variacao uuid,_contado numeric,_rodada int) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v funcionarios%rowtype; p produtos%rowtype; c comercios%rowtype; cf conferencias%rowtype; outra conferencias%rowtype;
 v_cont numeric; v_esp numeric; v_contada boolean; v_repete boolean; v_n int; v_ant jsonb; v_op uuid; v_dif uuid;
begin
 v := public._funcionario_da_chave(_chave);

  if _id is null then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
  if _rodada is null or _rodada < 1 or _rodada > 3 then raise exception 'contagem_exige_atualizacao' using errcode = '22023'; end if;
  select * into p from produtos where id = _produto and comercio_id = v.comercio_id and ativo;
  if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
  if _variacao is not null and not exists (select 1 from produto_variacoes where id = _variacao and produto_id = p.id and removida_em is null) then raise exception 'variacao_invalida' using errcode = '22023'; end if;
  if _variacao is null and exists (select 1 from produto_variacoes where produto_id = p.id and removida_em is null) then raise exception 'variacao_obrigatoria' using errcode = '22023'; end if;
  v_cont := public.qtd_valida(_contado, p.unidade, true);
  if v_cont > 1000000 then raise exception 'quantidade_grande_demais' using errcode = '23514'; end if;
  select * into c from comercios where id = v.comercio_id;
  -- Todos os caminhos desta contagem e a decisão do dono usam a mesma trava do produto.
  perform pg_advisory_xact_lock(hashtextextended(p.id::text, 0));
  select * into cf from conferencias where id = _id for update;
  if found and (cf.comercio_id <> c.id or cf.produto_id <> p.id or cf.variacao_id is distinct from _variacao or cf.area <> 'deposito') then
    raise exception 'conferencia_de_outro_produto' using errcode = '42501';
  end if;
  select * into outra from conferencias where produto_id = p.id and variacao_id is not distinct from _variacao
    and area = 'deposito' and situacao in ('contando','inconsistente') and id <> _id order by created_at,id limit 1;
  if found then
    if outra.situacao = 'inconsistente' then return jsonb_build_object('situacao','aguardando_dono'); end if;
    raise exception 'contagem_em_andamento' using errcode = '40001';
  end if;
  if cf.id is null then
    if _rodada <> 1 then raise exception 'rodada_desatualizada' using errcode = '40001'; end if;
    insert into conferencias(id,comercio_id,produto_id,variacao_id,area,funcionario_id)
      values(_id,c.id,p.id,_variacao,'deposito',v.id) returning * into cf;
  end if;
  v_n := jsonb_array_length(cf.tentativas);
  if _rodada <= v_n then
    if (cf.tentativas->>(_rodada-1))::numeric is distinct from v_cont then raise exception 'operacao_repetida_com_outros_dados' using errcode = '23514'; end if;
    if cf.situacao = 'inconsistente' then
      return jsonb_build_object('situacao',case when (select coalesce((d.detalhes->>'contagem_confirmada')::boolean,false) from diferencas d where d.id=cf.diferenca_id) then 'aguardando_dono' else 'inconsistente' end);
    end if;
    if cf.situacao = 'concluida' then return jsonb_build_object('situacao','concluida'); end if;
    if _rodada <> v_n then raise exception 'rodada_desatualizada' using errcode = '40001'; end if;
    return jsonb_build_object('situacao','recontar','rodada',v_n+1);
  end if;
  if cf.situacao = 'inconsistente' then return jsonb_build_object('situacao','aguardando_dono'); end if;
  if cf.situacao = 'concluida' then raise exception 'contagem_ja_resolvida' using errcode='23514'; end if;
  if _rodada <> v_n+1 then raise exception 'rodada_desatualizada' using errcode = '40001'; end if;
  v_esp := public.saldo_chave(p.id,_variacao,'deposito');
  v_contada := exists(select 1 from contagens where produto_id=p.id and variacao_id is not distinct from _variacao and area='deposito');
  v_ant := cf.tentativas;
  v_repete := exists(select 1 from jsonb_array_elements_text(v_ant) t where t::numeric=v_cont);
  update conferencias set tentativas=tentativas||to_jsonb(v_cont),esperado=v_esp,contado=v_cont where id=cf.id;
  if v_contada and v_cont <> v_esp then
    if v_repete or v_n+1 >= 3 then
      -- Uma contagem confirmada com diferença também espera o dono; nenhum saldo muda aqui.
      v_dif := public._registrar_diferenca(c.id,p.id,_variacao,'deposito','conferencia_inconsistente',v_esp,v_cont,v.id,cf.id,
        jsonb_build_object('tentativas',v_ant||to_jsonb(v_cont),'contagem_confirmada',v_repete,'aguardando_dono',true,'origem_contagem','conferencia'));
      update conferencias set situacao='inconsistente',diferenca_id=v_dif,concluida_em=now() where id=cf.id;
      return jsonb_build_object('situacao',case when v_repete then 'aguardando_dono' else 'inconsistente' end);
    end if;
    return jsonb_build_object('situacao','recontar','rodada',v_n+2);
  end if;
  -- Área ainda sem contagem ganha sua referência inicial; zero conhecido nunca vira desconhecido.
  v_op := gen_random_uuid();
  insert into operacoes(id,user_id,comercio_id,produto_id,tipo,hash,funcionario_id)
    values(v_op,c.dono_id,c.id,p.id,'conferencia',md5(cf.id::text||':conferencia'),v.id);
  if not v_contada then perform public._acertar_area(c.id,p.id,_variacao,'deposito',v_cont,v_op,c.dono_id,v.id); end if;
  update operacoes set resultado=jsonb_build_object('conferencia',cf.id,'esperado',v_esp,'contado',v_cont) where id=v_op;
  update conferencias set situacao='concluida',operacao_id=v_op,concluida_em=now() where id=cf.id returning * into cf;
 return jsonb_build_object('situacao','concluida');
end $$;

drop function if exists public.funcionario_reposicao_contar(text,uuid,uuid,uuid,numeric);

create or replace function public.funcionario_reposicao_contar(_chave text,_id uuid,_produto uuid,_variacao uuid,_contado numeric,_rodada int default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v funcionarios%rowtype; p produtos%rowtype; c comercios%rowtype; cf conferencias%rowtype; outra conferencias%rowtype;
 v_cont numeric; v_esp numeric; v_contada boolean; v_repete boolean; v_n int; v_ant jsonb; v_op uuid; v_dif uuid; rp reposicoes%rowtype; pa produto_areas%rowtype; v_dep numeric; v_alvo numeric; v_sug numeric; v_ld uuid;
begin
 v := public._funcionario_repoe(_chave);

  if _id is null then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
  if _rodada is null or _rodada < 1 or _rodada > 3 then raise exception 'contagem_exige_atualizacao' using errcode = '22023'; end if;
  select * into p from produtos where id = _produto and comercio_id = v.comercio_id and ativo;
  if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
  if _variacao is not null and not exists (select 1 from produto_variacoes where id = _variacao and produto_id = p.id and removida_em is null) then raise exception 'variacao_invalida' using errcode = '22023'; end if;
  if _variacao is null and exists (select 1 from produto_variacoes where produto_id = p.id and removida_em is null) then raise exception 'variacao_obrigatoria' using errcode = '22023'; end if;
  v_cont := public.qtd_valida(_contado, p.unidade, true);
  if v_cont > 1000000 then raise exception 'quantidade_grande_demais' using errcode = '23514'; end if;
 select * into pa from produto_areas where produto_id=_produto and variacao_id is not distinct from _variacao and area='venda';
 if not found then raise exception 'produto_sem_area_venda' using errcode='23514'; end if;
  select * into c from comercios where id = v.comercio_id;
  -- Todos os caminhos desta contagem e a decisão do dono usam a mesma trava do produto.
  perform pg_advisory_xact_lock(hashtextextended(p.id::text, 0));
  select * into rp from reposicoes where id=_id for update;
  if found and rp.situacao='concluido' then
    if rp.comercio_id<>c.id or rp.produto_id<>p.id or rp.variacao_id is distinct from _variacao then raise exception 'reposicao_de_outro_produto' using errcode='42501'; end if;
    if rp.contado is distinct from v_cont then raise exception 'operacao_repetida_com_outros_dados' using errcode='23514'; end if;
    return jsonb_build_object('situacao','concluido');
  end if;
  select * into cf from conferencias where id = _id for update;
  if found and (cf.comercio_id <> c.id or cf.produto_id <> p.id or cf.variacao_id is distinct from _variacao or cf.area <> 'venda') then
    raise exception 'conferencia_de_outro_produto' using errcode = '42501';
  end if;
  select * into outra from conferencias where produto_id = p.id and variacao_id is not distinct from _variacao
    and area = 'venda' and situacao in ('contando','inconsistente') and id <> _id order by created_at,id limit 1;
  if found then
    if outra.situacao = 'inconsistente' then return jsonb_build_object('situacao','aguardando_dono'); end if;
    raise exception 'contagem_em_andamento' using errcode = '40001';
  end if;
  if cf.id is null then
    if _rodada <> 1 then raise exception 'rodada_desatualizada' using errcode = '40001'; end if;
    insert into conferencias(id,comercio_id,produto_id,variacao_id,area,funcionario_id)
      values(_id,c.id,p.id,_variacao,'venda',v.id) returning * into cf;
  end if;
  v_n := jsonb_array_length(cf.tentativas);
  if _rodada <= v_n then
    if (cf.tentativas->>(_rodada-1))::numeric is distinct from v_cont then raise exception 'operacao_repetida_com_outros_dados' using errcode = '23514'; end if;
    if cf.situacao = 'inconsistente' then
      return jsonb_build_object('situacao',case when (select coalesce((d.detalhes->>'contagem_confirmada')::boolean,false) from diferencas d where d.id=cf.diferenca_id) then 'aguardando_dono' else 'inconsistente' end);
    end if;
    if cf.situacao = 'concluida' then if cf.diferenca_id is not null then return jsonb_build_object('situacao','concluido'); end if;
      select * into rp from reposicoes where id=cf.id;
      if not found then raise exception 'contagem_exige_atualizacao' using errcode='23514'; end if;
      select local_id into v_ld from produto_areas where produto_id=p.id and variacao_id is not distinct from _variacao and area='deposito';
      return jsonb_build_object('situacao',rp.situacao,'sugerido',rp.sugerido,'cheio',rp.sugerido=0 and rp.contado>=coalesce(pa.maximo,pa.minimo*2,rp.contado),
        'deposito_vazio',rp.sugerido=0,'local_deposito',(select nome from locais where id=v_ld),'motivo_sem_reposicao',case when rp.sugerido=0 then public._motivo_sem_reposicao(p.id,_variacao) end); end if;
    if _rodada <> v_n then raise exception 'rodada_desatualizada' using errcode = '40001'; end if;
    return jsonb_build_object('situacao','recontar','rodada',v_n+1);
  end if;
  if cf.situacao = 'inconsistente' then return jsonb_build_object('situacao','aguardando_dono'); end if;
  if cf.situacao = 'concluida' then raise exception 'contagem_ja_resolvida' using errcode='23514'; end if;
  if _rodada <> v_n+1 then raise exception 'rodada_desatualizada' using errcode = '40001'; end if;
  v_esp := public.saldo_chave(p.id,_variacao,'venda');
  v_contada := exists(select 1 from contagens where produto_id=p.id and variacao_id is not distinct from _variacao and area='venda');
  v_ant := cf.tentativas;
  v_repete := exists(select 1 from jsonb_array_elements_text(v_ant) t where t::numeric=v_cont);
  update conferencias set tentativas=tentativas||to_jsonb(v_cont),esperado=v_esp,contado=v_cont where id=cf.id;
  if v_contada and v_cont <> v_esp then
    if v_repete or v_n+1 >= 3 then
      -- Uma contagem confirmada com diferença também espera o dono; nenhum saldo muda aqui.
      v_dif := public._registrar_diferenca(c.id,p.id,_variacao,'venda','conferencia_inconsistente',v_esp,v_cont,v.id,cf.id,
        jsonb_build_object('tentativas',v_ant||to_jsonb(v_cont),'contagem_confirmada',v_repete,'aguardando_dono',true,'origem_contagem','reposicao'));
      update conferencias set situacao='inconsistente',diferenca_id=v_dif,concluida_em=now() where id=cf.id;
      return jsonb_build_object('situacao',case when v_repete then 'aguardando_dono' else 'inconsistente' end);
    end if;
    return jsonb_build_object('situacao','recontar','rodada',v_n+2);
  end if;
  -- Área ainda sem contagem ganha sua referência inicial; zero conhecido nunca vira desconhecido.
  if not v_contada then
    v_op := gen_random_uuid();
    insert into operacoes(id,user_id,comercio_id,produto_id,tipo,hash,funcionario_id)
      values(v_op,c.dono_id,c.id,p.id,'conferencia',md5(cf.id::text||':inicial'),v.id);
    perform public._acertar_area(c.id,p.id,_variacao,'venda',v_cont,v_op,c.dono_id,v.id);
    update operacoes set resultado=jsonb_build_object('conferencia',cf.id,'contado',v_cont,'inicial',true) where id=v_op;
  end if;
  update conferencias set situacao='concluida',operacao_id=v_op,concluida_em=now() where id=cf.id returning * into cf;

  v_dep := public._saldo_reponivel(p.id,_variacao);
  v_alvo := coalesce(pa.maximo,pa.minimo*2,v_cont);
  v_sug := least(greatest(v_alvo-v_cont,0),greatest(v_dep,0));
  if not public.unidade_fracionada(p.unidade) then v_sug := floor(v_sug); end if;
  select * into rp from reposicoes where id=cf.id;
  if found then
    if rp.comercio_id<>c.id or rp.produto_id<>p.id or rp.variacao_id is distinct from _variacao or rp.situacao<>'contado' then raise exception 'reposicao_de_outro_produto' using errcode='42501'; end if;
    -- Reposição antiga não concluída: substitui a contagem apenas depois da nova confirmação explícita.
    update reposicoes set contado=v_cont,esperado=public.saldo_chave(p.id,_variacao,'venda'),sugerido=v_sug where id=cf.id returning * into rp;
  else
  insert into reposicoes(id,comercio_id,produto_id,variacao_id,funcionario_id,contado,esperado,sugerido)
    values(cf.id,c.id,p.id,_variacao,v.id,v_cont,public.saldo_chave(p.id,_variacao,'venda'),v_sug) returning * into rp;
  end if;
  select local_id into v_ld from produto_areas where produto_id=p.id and variacao_id is not distinct from _variacao and area='deposito';
  return jsonb_build_object('situacao',rp.situacao,'sugerido',v_sug,'cheio',v_alvo<=v_cont,'deposito_vazio',v_sug=0 and v_alvo>v_cont,
    'local_deposito',(select nome from locais where id=v_ld),'motivo_sem_reposicao',case when v_sug=0 then public._motivo_sem_reposicao(p.id,_variacao) end);
end $$;
revoke all on function public.funcionario_reposicao_contar(text,uuid,uuid,uuid,numeric,int) from public;
grant execute on function public.funcionario_reposicao_contar(text,uuid,uuid,uuid,numeric,int) to anon,authenticated,service_role;

create or replace function public.funcionario_reposicao_lista(_chave text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v funcionarios%rowtype;
begin
 v := public._funcionario_repoe(_chave);
 return jsonb_build_object('tipo',(select tipo from comercios where id=v.comercio_id),'produtos',coalesce((
  select jsonb_agg(public._produto_para_funcionario(pa.produto_id,pa.variacao_id,null)||jsonb_build_object(
   'local',lv.nome,'local_deposito',ld.nome,'deposito_vazio',public._saldo_reponivel(pa.produto_id,pa.variacao_id)<=0,
   'motivo_sem_reposicao',public._motivo_sem_reposicao(pa.produto_id,pa.variacao_id),
   'conferencia_id',cf.id,'rodada',case when cf.situacao='contando' then jsonb_array_length(cf.tentativas)+1 end,'aguardando_dono',coalesce(cf.situacao='inconsistente',false)))
  from produto_areas pa join produtos p on p.id=pa.produto_id and p.ativo
  left join locais lv on lv.id=pa.local_id
  left join produto_areas pd on pd.produto_id=pa.produto_id and pd.variacao_id is not distinct from pa.variacao_id and pd.area='deposito'
  left join locais ld on ld.id=pd.local_id
  left join lateral(select cc.id,cc.situacao,cc.tentativas from conferencias cc where cc.produto_id=p.id and cc.variacao_id is not distinct from pa.variacao_id
   and cc.area='venda' and cc.situacao in ('contando','inconsistente') order by cc.created_at,cc.id limit 1) cf on true
  where pa.comercio_id=v.comercio_id and pa.area='venda' and pa.minimo is not null
   and (pa.variacao_id is null or exists(select 1 from produto_variacoes pv where pv.id=pa.variacao_id and pv.removida_em is null))
   and (public.saldo_chave(p.id,pa.variacao_id,'venda')<=pa.minimo or cf.id is not null)), '[]'::jsonb));
end $$;

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
  select * into rp from reposicoes where id = _id;
  if not found or rp.comercio_id <> v.comercio_id then raise exception 'reposicao_nao_encontrada' using errcode = '42501'; end if;
  if rp.situacao = 'concluido' then
    if rp.levado is distinct from coalesce(_levado, 0) then raise exception 'operacao_repetida_com_outros_dados' using errcode = '23514'; end if;
    return jsonb_build_object('situacao', 'concluido', 'levado', rp.levado);
  end if;
  select * into p from produtos where id = rp.produto_id;
  select * into c from comercios where id = rp.comercio_id;
  v_lev := public.qtd_valida(coalesce(_levado, 0), p.unidade, true);
  perform pg_advisory_xact_lock(hashtextextended(p.id::text, 0));
  select * into rp from reposicoes where id=_id for update;
  if rp.situacao='concluido' then
    if rp.levado is distinct from coalesce(_levado,0) then raise exception 'operacao_repetida_com_outros_dados' using errcode='23514'; end if;
    return jsonb_build_object('situacao','concluido','levado',rp.levado);
  end if;
  if exists(select 1 from conferencias cf where cf.produto_id=p.id and cf.variacao_id is not distinct from rp.variacao_id
    and cf.area='venda' and cf.situacao='inconsistente') then raise exception 'contagem_aguardando_dono' using errcode='23514'; end if;
  if rp.contado is distinct from rp.esperado or not exists(select 1 from conferencias cf where cf.id=rp.id and cf.produto_id=p.id
    and cf.variacao_id is not distinct from rp.variacao_id and cf.area='venda' and cf.situacao='concluida' and cf.diferenca_id is null
    and cf.contado=rp.contado) then raise exception 'contagem_exige_recontagem' using errcode='23514'; end if;
  if v_lev > rp.sugerido then raise exception 'reposicao_acima_sugerido' using errcode = '23514'; end if;
  if exists (select 1 from produto_areas where produto_id = p.id and variacao_id is not distinct from rp.variacao_id
    and area = 'venda' and maximo is not null and v_lev > greatest(maximo - rp.contado, 0)) then
    raise exception 'reposicao_acima_maximo' using errcode = '23514';
  end if;
  if v_lev > public._saldo_reponivel(p.id, rp.variacao_id) then raise exception 'deposito_reponivel_insuficiente' using errcode = '23514'; end if;
  select local_id into v_lv from produto_areas where produto_id = p.id and variacao_id is not distinct from rp.variacao_id and area = 'venda';
  select local_id into v_ld from produto_areas where produto_id = p.id and variacao_id is not distinct from rp.variacao_id and area = 'deposito';
  -- Outra reposição pode ter ocupado espaço depois da contagem; nunca ultrapassar o máximo atual.
  if exists(select 1 from produto_areas pa where pa.produto_id=p.id and pa.variacao_id is not distinct from rp.variacao_id and pa.area='venda'
    and pa.maximo is not null and v_lev > greatest(pa.maximo-public.saldo_chave(p.id,rp.variacao_id,'venda'),0)) then
    raise exception 'reposicao_acima_maximo' using errcode='23514';
  end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.resolver_conferencia(_diferenca uuid, _contado numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare d diferencas%rowtype; p produtos%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid(); v_atual numeric; v_novo numeric; v_dif numeric;
begin
  select * into d from diferencas where id = _diferenca;
  if not found or not public.pode_acessar_comercio(d.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(d.produto_id::text,0));
  select * into d from diferencas where id=_diferenca for update;
  if d.origem <> 'conferencia_inconsistente' then raise exception 'nao_e_contagem_inconsistente' using errcode = '22023'; end if;
  if d.detalhes ? 'resolvida' then raise exception 'contagem_ja_resolvida' using errcode = '23514'; end if;
  if _contado is null or (_contado <> d.esperado and not exists (select 1 from jsonb_array_elements_text(coalesce(d.detalhes->'tentativas', '[]')) t where t::numeric = _contado)) then
    raise exception 'contagem_invalida' using errcode = '22023';
  end if;
  select * into p from produtos where id = d.produto_id;
  if _contado <> d.esperado and not p.ativo then raise exception 'produto_inativo' using errcode='23514'; end if;
  if _contado <> d.esperado and d.variacao_id is not null and not exists(select 1 from produto_variacoes where id=d.variacao_id and produto_id=p.id and removida_em is null) then
    raise exception 'variacao_removida' using errcode='23514';
  end if;
  select * into c from comercios where id = d.comercio_id;
  perform pg_advisory_xact_lock(hashtextextended(p.id::text, 0));
  v_dif := _contado - d.esperado;
  v_atual := public.saldo_chave(p.id, d.variacao_id, d.area);
  v_novo := greatest(0, v_atual + v_dif);
  insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash)
  values (v_op, c.dono_id, c.id, p.id, 'conferencia', md5(d.id::text || ':resolver'));
  if v_novo <> v_atual then
    perform public._acertar_area(c.id, p.id, d.variacao_id, d.area, v_novo, v_op, c.dono_id, null);
  end if;
  update diferencas set contado = _contado, diferenca = v_dif, valor = round(v_dif * coalesce(p.preco_compra, 0), 2),
         detalhes = detalhes || jsonb_build_object('resolvida', true, 'aguardando_dono', false, 'operacao', v_op),
         situacao = case when v_dif = 0 then 'explicada' else situacao end,
         motivo = case when v_dif = 0 then 'erro_contagem' else motivo end,
         explicada_em = case when v_dif = 0 then now() else explicada_em end,
         explicada_por = case when v_dif = 0 then auth.uid() else explicada_por end
   where id = d.id;
  update conferencias set situacao = 'concluida', contado = _contado, operacao_id = v_op where id = d.referencia_id and situacao = 'inconsistente';
  update operacoes set resultado = jsonb_build_object('diferenca', d.id, 'escolhida', _contado, 'antes', v_atual, 'depois', v_novo) where id = v_op;
  return jsonb_build_object('diferenca', v_dif, 'valor', round(v_dif * coalesce(p.preco_compra, 0), 2));
end $function$
;

CREATE OR REPLACE FUNCTION public.funcionario_conferencia_lista(_chave text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
             'rodada', (select jsonb_array_length(cf.tentativas) + 1 from conferencias cf where cf.id = x.aberta), 'aguardando_dono',x.bloqueada) order by x.ordem)
      from (
        select y.*, row_number() over (order by (y.aberta is not null) desc, y.visado desc, y.ultima nulls first, y.valor desc, y.nome) as ordem
          from (
            select pa.produto_id, pa.variacao_id, l.nome as local, p.nome,
                   exists(select 1 from conferencias cc where cc.produto_id=pa.produto_id and cc.variacao_id is not distinct from pa.variacao_id and cc.area='deposito' and cc.situacao='inconsistente') bloqueada,
                   exists (select 1 from public._produtos_visados(v.comercio_id) vz where vz.produto_id = pa.produto_id and vz.variacao_id is not distinct from pa.variacao_id) as visado,
                   (select cf.id from conferencias cf where cf.produto_id = pa.produto_id and cf.variacao_id is not distinct from pa.variacao_id
                      and cf.area = 'deposito' and cf.situacao = 'contando'
                    order by cf.created_at desc limit 1) as aberta,
                   (select max(cf.created_at) from conferencias cf where cf.produto_id = pa.produto_id and cf.variacao_id is not distinct from pa.variacao_id and cf.area = 'deposito') as ultima,
                   public.saldo_chave(pa.produto_id, pa.variacao_id, 'deposito') * p.preco_compra as valor
              from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
              left join locais l on l.id = pa.local_id
             where pa.comercio_id = v.comercio_id and pa.area = 'deposito'
               and (pa.variacao_id is null or exists (select 1 from produto_variacoes pv where pv.id = pa.variacao_id and pv.removida_em is null))
          ) y
         where y.bloqueada or y.aberta is not null
            or (y.visado and not exists (select 1 from conferencias cf where cf.produto_id = y.produto_id and cf.variacao_id is not distinct from y.variacao_id
                                           and cf.area = 'deposito' and cf.situacao <> 'contando' and (cf.created_at at time zone 'America/Sao_Paulo')::date = v_hoje))
            or (not y.visado and not exists (select 1 from conferencias cf where cf.produto_id = y.produto_id and cf.variacao_id is not distinct from y.variacao_id
                                           and cf.area = 'deposito' and cf.situacao <> 'contando' and cf.created_at > now() - interval '7 days'))
      ) x where x.bloqueada or x.ordem <= v_falta or x.aberta is not null), '[]'::jsonb));
end $function$
;

notify pgrst,'reload schema';
