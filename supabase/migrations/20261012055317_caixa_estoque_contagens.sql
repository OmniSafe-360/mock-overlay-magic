-- C6: Caixa valida estoque antes de gravar venda e solicita contagens existentes.
-- Sem tabela/coluna/função nova. Conector e baixa compartilhada preservados.


CREATE OR REPLACE FUNCTION public.caixa_produtos(_chave text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      'estoques',coalesce((select jsonb_agg(jsonb_build_object('variacao_id',pa.variacao_id,'quantidade',case when exists(select 1 from contagens ct where ct.produto_id=p.id and ct.variacao_id is not distinct from pa.variacao_id and ct.area='venda') then public.saldo_chave(p.id,pa.variacao_id,'venda') end)) from produto_areas pa where pa.produto_id=p.id and pa.area='venda' and (pa.variacao_id is null or exists(select 1 from produto_variacoes pv where pv.id=pa.variacao_id and pv.removida_em is null))),'[]'::jsonb),
      'embalagens', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'quantidade', e.quantidade) order by e.quantidade desc)
                    from produto_embalagens e where e.produto_id = p.id and e.removida_em is null), '[]')) order by p.nome)
    from produtos p where p.comercio_id = v.comercio_id and p.ativo), '[]');
end $function$
;


CREATE OR REPLACE FUNCTION public.caixa_registrar_venda(_chave text, _venda jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype; c comercios%rowtype; t caixa_turnos%rowtype; vd vendas%rowtype; v_id uuid; v_feita timestamptz;
  it jsonb; pg jsonb; a record; n int := 0; v_qtd numeric; v_preco numeric; v_valor numeric; v_total numeric := 0; v_cod text; v_desc text;
  v_prod uuid; v_var uuid; v_emb uuid; v_sit text; v_mot text; v_unid numeric; v_sem int := 0; v_pags jsonb := '[]'; v_soma numeric := 0;
  v_din numeric := 0; v_fiado numeric := 0; v_forma text; v_pv numeric; v_troco numeric; v_cli uuid; v_num bigint; r record; v_nome_prod text;
  v_ign boolean; v_tel text; v_cod_avulso text;
  v_acao text := coalesce(_venda->>'acao','vender'); v_resolvidos jsonb := '[]'; v_bloqueios jsonb := '[]';
  v_disponivel numeric; v_cf uuid; v_pedido uuid; v_antigo operacoes%rowtype; v_estado text; v_motivo text;
begin
  v := public._funcionario_caixa(_chave);
  begin v_id := (_venda->>'id')::uuid; exception when others then raise exception 'venda_invalida' using errcode = '22023'; end;
  if v_id is null then raise exception 'venda_invalida' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select * into vd from vendas where id = v_id;
  if found then
    if vd.comercio_id <> v.comercio_id then raise exception 'venda_invalida' using errcode = '42501'; end if;
    return jsonb_build_object('situacao', 'repetida', 'venda', vd.id, 'numero', vd.numero, 'troco', vd.troco, 'total', vd.total);
  end if;
  begin select * into t from caixa_turnos where id = (_venda->>'turno_id')::uuid and funcionario_id = v.id for update;
  exception when others then raise exception 'turno_invalido' using errcode = '22023'; end;
  if t.id is null then raise exception 'turno_invalido' using errcode = '42501'; end if;
  if t.situacao <> 'aberto' then raise exception 'turno_fechado' using errcode = '23514'; end if;
  begin v_feita := coalesce((_venda->>'feita_em')::timestamptz, now()); exception when others then raise exception 'venda_invalida' using errcode = '22023'; end;
  if v_feita < now() - interval '30 days' then raise exception 'data_invalida' using errcode = '22023'; end if;
  v_feita := least(v_feita, now());
  if jsonb_typeof(_venda->'itens') is distinct from 'array' or jsonb_array_length(_venda->'itens') not between 1 and 300 then
    raise exception 'venda_sem_itens' using errcode = '22023'; end if;
  if v_acao not in ('vender','conferir') then raise exception 'venda_invalida' using errcode='22023'; end if;
  if v_acao='vender' and (jsonb_typeof(_venda->'pagamentos') is distinct from 'array' or jsonb_array_length(_venda->'pagamentos') not between 1 and 6) then
    raise exception 'pagamento_invalido' using errcode = '22023'; end if;
  select * into c from comercios where id = v.comercio_id;

  -- pagamentos (o dinheiro pode passar do total: a diferença é o troco)
  for pg in select * from jsonb_array_elements(case when v_acao='conferir' then '[]'::jsonb else _venda->'pagamentos' end) loop
    v_forma := pg->>'forma';
    begin v_pv := round((pg->>'valor')::numeric, 2); exception when others then raise exception 'pagamento_invalido' using errcode = '22023'; end;
    if v_forma is null or v_forma not in ('dinheiro', 'pix', 'cartao', 'fiado') or v_pv is null or v_pv <= 0 or v_pv > 1000000 then
      raise exception 'pagamento_invalido' using errcode = '22023'; end if;
    v_soma := v_soma + v_pv;
    if v_forma = 'dinheiro' then v_din := v_din + v_pv; end if;
    if v_forma = 'fiado' then v_fiado := v_fiado + v_pv; end if;
    v_pags := v_pags || jsonb_build_array(jsonb_build_object('forma', v_forma, 'valor', v_pv));
  end loop;

  for it in select * from jsonb_array_elements(_venda->'itens') loop

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
    v_sit := null; v_mot := null; v_unid := null; v_ign := false; v_cod_avulso := null;
    if v_prod is not null then
      select nome into v_nome_prod from produtos where id = v_prod and comercio_id = c.id;
      if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
      if v_var is not null and not exists (select 1 from produto_variacoes where id = v_var and produto_id = v_prod) then raise exception 'variacao_invalida' using errcode = '22023'; end if;
      if v_emb is not null and not exists (select 1 from produto_embalagens where id = v_emb and produto_id = v_prod) then raise exception 'embalagem_invalida' using errcode = '22023'; end if;
    elsif v_cod is not null then
      select * into a from public._achar_item_venda(c.id, v_cod, case when v_cod ~ '^[0-9]+$' then v_cod end);
      v_prod := a.produto_id; v_var := a.variacao_id; v_emb := a.embalagem_id; v_ign := coalesce(a.ignorar, false);
      if v_prod is not null then select nome into v_nome_prod from produtos where id = v_prod; end if;
    else
      -- Sem código: a chave é o nome digitado, para juntar as vendas do mesmo item e lembrar a decisão do dono.
      v_cod_avulso := 'avulso:' || lower(regexp_replace(coalesce(v_desc, 'Produto sem cadastro'), '\s+', ' ', 'g'));
      select * into a from public._achar_item_venda(c.id, v_cod_avulso, null);
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
    if v_prod is null or v_ign then
      v_bloqueios := v_bloqueios||jsonb_build_object('nome',coalesce(v_desc,'Produto sem cadastro'),'motivo','produto_sem_cadastro');
    elsif v_sit='conferir' or v_unid is null then raise exception 'item_invalido' using errcode='22023';
    else
      if not exists(select 1 from produtos where id=v_prod and comercio_id=c.id and ativo) then raise exception 'produto_inativo' using errcode='23514'; end if;
      if v_var is not null and not exists(select 1 from produto_variacoes where id=v_var and produto_id=v_prod and removida_em is null) then raise exception 'variacao_invalida' using errcode='22023'; end if;
      if v_emb is not null and not exists(select 1 from produto_embalagens where id=v_emb and produto_id=v_prod and removida_em is null) then raise exception 'embalagem_invalida' using errcode='22023'; end if;
      perform public.qtd_valida(v_unid,(select unidade from produtos where id=v_prod),false);
      v_resolvidos := v_resolvidos||jsonb_build_object('produto',v_prod,'variacao',v_var,'unidades',v_unid);
    end if;
  end loop;
  if v_acao='vender' then
    if v_soma-v_din>v_total+0.005 then raise exception 'pagamento_maior_que_total' using errcode='23514'; end if;
    if v_soma<v_total-0.005 then raise exception 'pagamento_menor_que_total' using errcode='23514'; end if;
  end if;
  -- Mantém ordem de travas do caixa: turno, comércio e produtos em ordem estável.
  perform 1 from comercios where id=c.id for no key update;
  for r in select (x->>'produto')::uuid produto,(x->>'variacao')::uuid variacao,sum((x->>'unidades')::numeric) unidades
    from jsonb_array_elements(v_resolvidos)x group by 1,2 order by 1,2 loop
    perform pg_advisory_xact_lock(hashtextextended(r.produto::text,0));
    v_disponivel := null; v_motivo := null;
    if not exists(select 1 from produtos where id=r.produto and ativo) then raise exception 'produto_inativo' using errcode='23514'; end if;
    if not exists(select 1 from produto_areas where produto_id=r.produto and variacao_id is not distinct from r.variacao and area='venda') then v_motivo:='produto_sem_area_venda';
    elsif not exists(select 1 from contagens where produto_id=r.produto and variacao_id is not distinct from r.variacao and area='venda') then v_motivo:='gondola_nao_contada';
    else
      v_disponivel := public.saldo_chave(r.produto,r.variacao,'venda');
      if r.unidades>v_disponivel then v_motivo:='estoque_insuficiente'; end if;
    end if;
    if v_motivo is not null then
      v_cf:=null; v_estado:=null;
      if v_motivo<>'produto_sem_area_venda' then
        v_pedido:=md5(v_id::text||':contagem-caixa:'||r.produto::text||':'||coalesce(r.variacao::text,''))::uuid;
        select * into v_antigo from operacoes where id=v_pedido;
        if found then
          if v_antigo.comercio_id<>c.id or v_antigo.produto_id<>r.produto then raise exception 'venda_invalida' using errcode='42501'; end if;
          v_cf:=(v_antigo.resultado->>'conferencia_id')::uuid;
        else
          select id into v_cf from conferencias where produto_id=r.produto and variacao_id is not distinct from r.variacao and area='venda' and situacao in ('contando','inconsistente') order by created_at,id limit 1;
          if v_cf is null then
            v_cf:=gen_random_uuid();
            insert into conferencias(id,comercio_id,produto_id,variacao_id,area,funcionario_id) values(v_cf,c.id,r.produto,r.variacao,'venda',v.id);
          end if;
          insert into operacoes(id,user_id,comercio_id,produto_id,tipo,hash,funcionario_id,resultado)
           values(v_pedido,c.dono_id,c.id,r.produto,'conferencia',md5(v_pedido::text),v.id,
            jsonb_build_object('solicitacao_caixa',true,'conferencia_id',v_cf,'produto_id',r.produto,'variacao_id',r.variacao,'venda_id',v_id));
        end if;
        select situacao into v_estado from conferencias where id=v_cf;
      end if;
      v_bloqueios := v_bloqueios||jsonb_build_object('produto_id',r.produto,'variacao_id',r.variacao,'nome',(select nome from produtos where id=r.produto),
        'motivo',v_motivo,'disponivel',v_disponivel,'conferencia_id',v_cf,'contagem_solicitada',coalesce(v_estado in ('contando','inconsistente'),false));
    end if;
  end loop;
  if jsonb_array_length(v_bloqueios)>0 then
    -- HTTP de recusa também protege versões antigas, sem desfazer a solicitação gravada.
    perform set_config('response.status','409',true);
    return jsonb_build_object('situacao','bloqueada','bloqueios',v_bloqueios);
  end if;
  if v_acao='conferir' then return jsonb_build_object('situacao','aprovada'); end if;
  v_total:=0; n:=0;

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

  update comercios set proximo_numero_venda = proximo_numero_venda + 1 where id = c.id returning proximo_numero_venda - 1 into v_num;
  
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
    v_sit := null; v_mot := null; v_unid := null; v_ign := false; v_cod_avulso := null;
    if v_prod is not null then
      select nome into v_nome_prod from produtos where id = v_prod and comercio_id = c.id;
      if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
      if v_var is not null and not exists (select 1 from produto_variacoes where id = v_var and produto_id = v_prod) then raise exception 'variacao_invalida' using errcode = '22023'; end if;
      if v_emb is not null and not exists (select 1 from produto_embalagens where id = v_emb and produto_id = v_prod) then raise exception 'embalagem_invalida' using errcode = '22023'; end if;
    elsif v_cod is not null then
      select * into a from public._achar_item_venda(c.id, v_cod, case when v_cod ~ '^[0-9]+$' then v_cod end);
      v_prod := a.produto_id; v_var := a.variacao_id; v_emb := a.embalagem_id; v_ign := coalesce(a.ignorar, false);
      if v_prod is not null then select nome into v_nome_prod from produtos where id = v_prod; end if;
    else
      -- Sem código: a chave é o nome digitado, para juntar as vendas do mesmo item e lembrar a decisão do dono.
      v_cod_avulso := 'avulso:' || lower(regexp_replace(coalesce(v_desc, 'Produto sem cadastro'), '\s+', ' ', 'g'));
      select * into a from public._achar_item_venda(c.id, v_cod_avulso, null);
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
            coalesce(v_cod, v_cod_avulso, case when v_prod is not null then 'omni:' || v_prod::text else 'avulso:' || v_id::text || ':' || n end),
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
end $function$
;


CREATE OR REPLACE FUNCTION public.funcionario_reposicao_contar(_chave text, _id uuid, _produto uuid, _variacao uuid, _contado numeric, _rodada integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype; p produtos%rowtype; c comercios%rowtype; cf conferencias%rowtype; outra conferencias%rowtype;
 v_cont numeric; v_esp numeric; v_contada boolean; v_repete boolean; v_n int; v_ant jsonb; v_op uuid; v_dif uuid; rp reposicoes%rowtype; pa produto_areas%rowtype; v_dep numeric; v_alvo numeric; v_sug numeric; v_ld uuid;
 v_cx record; v_deposito_cf uuid;
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
  if v_n=0 then update conferencias set funcionario_id=v.id where id=cf.id; end if;
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
      for v_cx in select * from operacoes op where op.produto_id=p.id and op.resultado->>'solicitacao_caixa'='true' and op.resultado->>'conferencia_id'=cf.id::text order by op.created_at loop
        update diferencas set detalhes=detalhes||jsonb_build_object('solicitacao_caixa',v_cx.id) where id=v_dif;
        if v_repete then

    select (op.resultado->>'deposito_conferencia_id')::uuid into v_deposito_cf from operacoes op where op.id=md5(v_cx.id::text||':deposito')::uuid;
    if v_deposito_cf is null and exists(select 1 from produto_areas where produto_id=p.id and variacao_id is not distinct from _variacao and area='deposito') then
      select id into v_deposito_cf from conferencias where produto_id=p.id and variacao_id is not distinct from _variacao and area='deposito' and situacao in ('contando','inconsistente') order by created_at,id limit 1;
      if v_deposito_cf is null then
        v_deposito_cf:=gen_random_uuid();
        insert into conferencias(id,comercio_id,produto_id,variacao_id,area,funcionario_id) values(v_deposito_cf,c.id,p.id,_variacao,'deposito',v.id);
      end if;
      insert into operacoes(id,user_id,comercio_id,produto_id,tipo,hash,funcionario_id,resultado)
       values(md5(v_cx.id::text||':deposito')::uuid,c.dono_id,c.id,p.id,'conferencia',md5(v_cx.id::text||':deposito'),v.id,
        jsonb_build_object('solicitacao_caixa_deposito',true,'solicitacao_caixa',v_cx.id,'conferencia_id',cf.id,'deposito_conferencia_id',v_deposito_cf));
    end if;
    update diferencas set detalhes=detalhes||jsonb_build_object('solicitacao_caixa',v_cx.id,'deposito_conferencia_id',v_deposito_cf,'revisao_caixa_pendente',v_deposito_cf is not null) where id=v_dif;
    update diferencas set detalhes=detalhes||jsonb_build_object('solicitacao_caixa',v_cx.id,'gondola_conferencia_id',cf.id,'revisao_caixa_pendente',true) where referencia_id=v_deposito_cf;
        end if;
      end loop;

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
end $function$
;


CREATE OR REPLACE FUNCTION public.funcionario_conferencia_contar(_chave text, _id uuid, _produto uuid, _variacao uuid, _contado numeric, _rodada integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype; p produtos%rowtype; c comercios%rowtype; cf conferencias%rowtype; outra conferencias%rowtype;
 v_cont numeric; v_esp numeric; v_contada boolean; v_repete boolean; v_n int; v_ant jsonb; v_op uuid; v_dif uuid;
 v_cx record;
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
  if v_n=0 then update conferencias set funcionario_id=v.id where id=cf.id; end if;
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
      for v_cx in select * from operacoes op where op.produto_id=p.id and op.resultado->>'deposito_conferencia_id'=cf.id::text loop
        update diferencas set detalhes=detalhes||jsonb_build_object('solicitacao_caixa',v_cx.resultado->>'solicitacao_caixa','gondola_conferencia_id',v_cx.resultado->>'conferencia_id','revisao_caixa_pendente',true) where id=v_dif;
      end loop;

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
end $function$
;


CREATE OR REPLACE FUNCTION public.funcionario_reposicao_lista(_chave text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype;
begin
 v := public._funcionario_repoe(_chave);
 return jsonb_build_object('tipo',(select tipo from comercios where id=v.comercio_id),'produtos',coalesce((
  select jsonb_agg(public._produto_para_funcionario(pa.produto_id,pa.variacao_id,null)||jsonb_build_object(
   'solicitada_caixa',exists(select 1 from operacoes op where op.produto_id=p.id and op.resultado->>'solicitacao_caixa'='true' and op.resultado->>'conferencia_id'=cf.id::text),'local',lv.nome,'local_deposito',ld.nome,'deposito_vazio',public._saldo_reponivel(pa.produto_id,pa.variacao_id)<=0,
   'motivo_sem_reposicao',public._motivo_sem_reposicao(pa.produto_id,pa.variacao_id),
   'conferencia_id',cf.id,'rodada',case when cf.situacao='contando' then jsonb_array_length(cf.tentativas)+1 end,'aguardando_dono',coalesce(cf.situacao='inconsistente',false)))
  from produto_areas pa join produtos p on p.id=pa.produto_id and p.ativo
  left join locais lv on lv.id=pa.local_id
  left join produto_areas pd on pd.produto_id=pa.produto_id and pd.variacao_id is not distinct from pa.variacao_id and pd.area='deposito'
  left join locais ld on ld.id=pd.local_id
  left join lateral(select cc.id,cc.situacao,cc.tentativas from conferencias cc where cc.produto_id=p.id and cc.variacao_id is not distinct from pa.variacao_id
   and cc.area='venda' and cc.situacao in ('contando','inconsistente') order by cc.created_at,cc.id limit 1) cf on true
  where pa.comercio_id=v.comercio_id and pa.area='venda' and (pa.minimo is not null or cf.id is not null)
   and (pa.variacao_id is null or exists(select 1 from produto_variacoes pv where pv.id=pa.variacao_id and pv.removida_em is null))
   and (public.saldo_chave(p.id,pa.variacao_id,'venda')<=pa.minimo or cf.id is not null)), '[]'::jsonb));
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
             'rodada', (select jsonb_array_length(cf.tentativas) + 1 from conferencias cf where cf.id = x.aberta), 'aguardando_dono',x.bloqueada,'solicitada_caixa',exists(select 1 from operacoes op where op.produto_id=x.produto_id and op.resultado->>'deposito_conferencia_id'=x.aberta::text)) order by x.ordem)
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

CREATE OR REPLACE FUNCTION public.resolver_conferencia(_diferenca uuid, _contado numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare d diferencas%rowtype; p produtos%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid(); v_atual numeric; v_novo numeric; v_dif numeric;
 v_cx record; v_deposito_cf uuid; v_gondola_cf uuid; v_par_pronto boolean; v_total_preservado boolean;
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
  -- Ao confirmar a diferença da gôndola, as duas áreas são conferidas antes do acerto.
  if d.area='venda' and _contado<>d.esperado then
    for v_cx in select * from operacoes op where op.produto_id=p.id and op.resultado->>'solicitacao_caixa'='true' and op.resultado->>'conferencia_id'=d.referencia_id::text order by op.created_at loop

    select (op.resultado->>'deposito_conferencia_id')::uuid into v_deposito_cf from operacoes op where op.id=md5(v_cx.id::text||':deposito')::uuid;
    if v_deposito_cf is null and exists(select 1 from produto_areas where produto_id=p.id and variacao_id is not distinct from d.variacao_id and area='deposito') then
      select id into v_deposito_cf from conferencias where produto_id=p.id and variacao_id is not distinct from d.variacao_id and area='deposito' and situacao in ('contando','inconsistente') order by created_at,id limit 1;
      if v_deposito_cf is null then
        v_deposito_cf:=gen_random_uuid();
        insert into conferencias(id,comercio_id,produto_id,variacao_id,area,funcionario_id) values(v_deposito_cf,c.id,p.id,d.variacao_id,'deposito',coalesce(d.funcionario_id,v_cx.funcionario_id));
      end if;
      insert into operacoes(id,user_id,comercio_id,produto_id,tipo,hash,funcionario_id,resultado)
       values(md5(v_cx.id::text||':deposito')::uuid,c.dono_id,c.id,p.id,'conferencia',md5(v_cx.id::text||':deposito'),coalesce(d.funcionario_id,v_cx.funcionario_id),
        jsonb_build_object('solicitacao_caixa_deposito',true,'solicitacao_caixa',v_cx.id,'conferencia_id',d.referencia_id,'deposito_conferencia_id',v_deposito_cf));
    end if;
    update diferencas set detalhes=detalhes||jsonb_build_object('solicitacao_caixa',v_cx.id,'deposito_conferencia_id',v_deposito_cf,'revisao_caixa_pendente',v_deposito_cf is not null) where id=d.id;
    update diferencas set detalhes=detalhes||jsonb_build_object('solicitacao_caixa',v_cx.id,'gondola_conferencia_id',d.referencia_id,'revisao_caixa_pendente',true) where referencia_id=v_deposito_cf;

      if v_deposito_cf is not null and not exists(select 1 from conferencias where id=v_deposito_cf and situacao='concluida') then
        return jsonb_build_object('situacao','aguardando_deposito');
      end if;
    end loop;
  end if;
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
  -- Só avaliar falta total após concluir ambas as conferências vinculadas.
  for v_cx in select * from operacoes op where op.produto_id=p.id and op.resultado->>'solicitacao_caixa'='true'
    and d.referencia_id::text in (op.resultado->>'conferencia_id',(select child.resultado->>'deposito_conferencia_id' from operacoes child where child.id=md5(op.id::text||':deposito')::uuid)) loop
    v_gondola_cf:=(v_cx.resultado->>'conferencia_id')::uuid; select (child.resultado->>'deposito_conferencia_id')::uuid into v_deposito_cf from operacoes child where child.id=md5(v_cx.id::text||':deposito')::uuid;
    v_par_pronto:=exists(select 1 from conferencias where id=v_gondola_cf and situacao='concluida') and (v_deposito_cf is null or exists(select 1 from conferencias where id=v_deposito_cf and situacao='concluida'));
    v_total_preservado:=v_par_pronto and (select coalesce(sum(diferenca),0)=0 from diferencas where referencia_id in (v_gondola_cf,v_deposito_cf));
    update diferencas set detalhes=detalhes||jsonb_build_object('revisao_caixa_pendente',not v_par_pronto,'saldo_total_preservado',v_total_preservado)
     where referencia_id in (v_gondola_cf,v_deposito_cf);
  end loop;
  return jsonb_build_object('diferenca', v_dif, 'valor', round(v_dif * coalesce(p.preco_compra, 0), 2));
end $function$
;

CREATE OR REPLACE FUNCTION public._produtos_visados(_com uuid)
 RETURNS TABLE(produto_id uuid, variacao_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select d.produto_id, d.variacao_id from diferencas d
   where d.comercio_id = _com and d.created_at > now() - interval '30 days' and d.diferenca < 0
     and coalesce(d.motivo, '') <> 'erro_contagem' and coalesce((d.detalhes->>'revisao_caixa_pendente')::boolean,false)=false and coalesce((d.detalhes->>'saldo_total_preservado')::boolean,false)=false
     and not (d.origem = 'conferencia_inconsistente' and not (d.detalhes ? 'resolvida'))
   group by d.produto_id, d.variacao_id
  having count(*) >= 3 and max(d.created_at) > now() - interval '7 days'
$function$
;
