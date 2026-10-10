-- Fase 3.3 — ao ligar o conector num caixa com notas antigas na pasta, as vendas de antes de o caixa existir no Omni
-- não descontam do estoque (o Omni ainda não contava aquela mercadoria). O conector também recebe a data "desde"
-- para nem ler os arquivos antigos.

/* Situação do caixa para a tela do conector (também avisa o Omni que o caixa está ligado). null = desligado. */
create or replace function public.conector_estado(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cx caixas%rowtype; c comercios%rowtype; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_n int; v_total numeric;
begin
  begin cx := public._caixa_da_chave(_chave); exception when others then return null; end;
  select * into c from comercios where id = cx.comercio_id;
  select count(*), coalesce(sum(total), 0) into v_n, v_total from vendas
   where caixa_id = cx.id and situacao = 'finalizada' and (coalesce(emitida_em, recebida_em) at time zone 'America/Sao_Paulo')::date = v_hoje;
  return jsonb_build_object('caixa', cx.nome, 'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo, 'documento', case when c.documento_tipo = 'cnpj' then c.documento end),
    'ultima_venda_em', cx.ultima_venda_em, 'desde', cx.created_at, 'hoje', jsonb_build_object('vendas', v_n, 'total', v_total));
end $$;

/* Uma venda FINALIZADA no caixa (a nota do cupom). Repetir a mesma nota não conta de novo.
   _nota = {chave, numero, serie, emitida_em, total, pagamentos:[{forma, valor}], itens:[{n, codigo, ean, descricao, qtd, unidade, valor}]} */
create or replace function public.conector_enviar_venda(_chave text, _nota jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cx caixas%rowtype; c comercios%rowtype; vd vendas%rowtype; v_chave_nota text; v_id uuid := gen_random_uuid(); it jsonb; a record; v_unid numeric;
  v_n int; v_qtd numeric; v_cod text; v_ean text; v_sit text; v_mot text; v_emitida timestamptz; v_sem int := 0; v_itens int := 0; r record;
begin
  cx := public._caixa_da_chave(_chave);
  select * into c from comercios where id = cx.comercio_id;
  v_chave_nota := _nota->>'chave';
  if not public.chave_nota_valida(v_chave_nota) then raise exception 'nota_invalida' using errcode = '22023'; end if;
  if c.documento_tipo = 'cnpj' and substr(v_chave_nota, 7, 14) <> c.documento then raise exception 'nota_de_outro_cnpj' using errcode = '42501'; end if;
  if jsonb_typeof(_nota->'itens') <> 'array' or jsonb_array_length(_nota->'itens') not between 1 and 990 then raise exception 'nota_sem_itens' using errcode = '22023'; end if;
  begin v_emitida := (_nota->>'emitida_em')::timestamptz; exception when others then raise exception 'nota_invalida' using errcode = '22023'; end;
  if v_emitida is null or v_emitida > now() + interval '1 day' then raise exception 'nota_invalida' using errcode = '22023'; end if;

  -- Nota de antes de o caixa existir no Omni (o conector achou notas antigas na pasta): não desconta nada.
  if v_emitida < cx.created_at - interval '10 minutes' then return jsonb_build_object('situacao', 'anterior'); end if;

  perform pg_advisory_xact_lock(hashtextextended(v_chave_nota, 0));
  select * into vd from vendas where chave_nota = v_chave_nota;
  if found then
    if vd.comercio_id <> cx.comercio_id then raise exception 'nota_de_outro_comercio' using errcode = '42501'; end if;
    return jsonb_build_object('situacao', case when vd.situacao = 'cancelada' then 'cancelada' else 'repetida' end, 'venda', vd.id);
  end if;

  insert into vendas (id, comercio_id, caixa_id, chave_nota, numero, serie, emitida_em, total, pagamentos, origem, nota)
  values (v_id, c.id, cx.id, v_chave_nota, nullif(_nota->>'numero', '')::int, nullif(_nota->>'serie', '')::int, v_emitida,
          greatest(coalesce((_nota->>'total')::numeric, 0), 0), coalesce(_nota->'pagamentos', '[]'), 'conector', _nota);

  for it in select * from jsonb_array_elements(_nota->'itens') loop
    v_itens := v_itens + 1;
    v_n := coalesce(nullif(it->>'n', '')::int, v_itens);
    v_cod := left(nullif(btrim(coalesce(it->>'codigo', '')), ''), 60);
    v_ean := nullif(regexp_replace(coalesce(it->>'ean', ''), '\D', '', 'g'), '');
    v_qtd := round(coalesce((it->>'qtd')::numeric, 0), 4);
    if v_qtd <= 0 then raise exception 'item_sem_quantidade' using errcode = '22023'; end if;
    v_cod := coalesce(v_cod, v_ean, 'item ' || v_n);
    select * into a from public._achar_item_venda(c.id, v_cod, v_ean);
    v_sit := null; v_mot := null; v_unid := null;
    if coalesce(a.ignorar, false) then v_sit := 'ignorado';
    elsif a.produto_id is null then v_sit := 'sem_cadastro'; v_sem := v_sem + 1;
    else
      select x.unidades, x.motivo into v_unid, v_mot from public._unidades_item(a.produto_id, a.embalagem_id, v_qtd) x;
      if v_unid is null then v_sit := 'conferir'; v_sem := v_sem + 1; end if;
    end if;
    insert into venda_itens (venda_id, comercio_id, n_item, codigo_pdv, codigo_barras, descricao, qtd_nota, unidade_nota, valor,
                             produto_id, variacao_id, embalagem_id, qtd_unidades, situacao, motivo)
    values (v_id, c.id, v_n, v_cod, v_ean, left(coalesce(nullif(btrim(it->>'descricao'), ''), v_cod), 120), v_qtd, left(it->>'unidade', 10),
            greatest(coalesce((it->>'valor')::numeric, 0), 0),
            case when v_sit in ('sem_cadastro', 'ignorado') then null else a.produto_id end,
            case when v_sit in ('sem_cadastro', 'ignorado') then null else a.variacao_id end,
            case when v_sit in ('sem_cadastro', 'ignorado') then null else a.embalagem_id end,
            v_unid, coalesce(v_sit, 'baixado'), v_mot);
  end loop;

  -- Desconta da gôndola, produto por produto, sempre na mesma ordem (evita travar com outro caixa).
  for r in select id from venda_itens where venda_id = v_id and situacao = 'baixado' order by produto_id, n_item loop
    perform public._baixar_item_venda(r.id);
  end loop;

  update caixas set ultima_venda_em = greatest(coalesce(ultima_venda_em, v_emitida), v_emitida) where id = cx.id;
  return jsonb_build_object('situacao', 'registrada', 'venda', v_id, 'itens', v_itens, 'sem_cadastro', v_sem);
end $$;
