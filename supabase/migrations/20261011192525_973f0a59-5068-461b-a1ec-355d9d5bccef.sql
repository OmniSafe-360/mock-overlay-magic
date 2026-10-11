do $mig$
declare v_def text; i1 int; i2 int;
  v_old_ag text := $o$  select coalesce(jsonb_agg(jsonb_build_object('produto_id', produto_id, 'variacao_id', variacao_id)
    order by produto_id, variacao_id), '[]') into v_recontar$o$;
  v_new_ag text := $n$  select coalesce(jsonb_agg(jsonb_build_object('produto_id', produto_id, 'variacao_id', variacao_id)
      || jsonb_strip_nulls(jsonb_build_object('motivo', tentativas -> -1 ->> 'motivo', 'lote', tentativas -> -1 ->> 'lote',
           'lote_data', tentativas -> -1 ->> 'lote_data'))
    order by produto_id, variacao_id), '[]') into v_recontar$n$;
  v_bloco text := $b$  -- A4: validade/lote que não pode entrar no depósito volta para a equipe contar de novo,
  -- com o motivo (vencido, sem_data, sem_lote, lote_outra_data), em vez de travar a entrega.
  update recebimento_itens ri set situacao = 'recontar', quantidade_aceita = null, avaria = 0,
    tentativas = jsonb_set(ri.tentativas, array[(jsonb_array_length(ri.tentativas) - 1)::text],
      ri.tentativas -> (jsonb_array_length(ri.tentativas) - 1) || jsonb_strip_nulls(jsonb_build_object(
        'validade_recontar', true, 'motivo', x.motivo, 'lote', x.lote, 'lote_data', x.lote_data)))
    from (
      select ri2.id, m.motivo, m.lote, m.lote_data
        from recebimento_itens ri2 join produtos pp on pp.id = ri2.produto_id
        cross join lateral (
          select q.motivo, q.lote, q.lote_data from (
            select 1 as o, 'vencido'::text as motivo, null::text as lote, null::text as lote_data
              from jsonb_array_elements(coalesce(ri2.tentativas -> -1 -> 'partes', '[]')) pt
             where nullif(pt->>'vencimento', '') is not null
               and (pt->>'vencimento')::date < (now() at time zone 'America/Sao_Paulo')::date
            union all
            select 2, 'sem_data', null, null
              from jsonb_array_elements(coalesce(ri2.tentativas -> -1 -> 'partes', '[]')) pt
             where nullif(pt->>'vencimento', '') is null
            union all
            select 3, 'sem_lote', null, null
              from jsonb_array_elements(coalesce(ri2.tentativas -> -1 -> 'partes', '[]')) pt
             where c.tipo = 'farmacia' and public.normalizar_lote(pt->>'lote') is null
            union all
            select 4, 'lote_outra_data', l.numero, to_char(l.vencimento, 'YYYY-MM-DD')
              from jsonb_array_elements(coalesce(ri2.tentativas -> -1 -> 'partes', '[]')) pt
              join lotes l on l.produto_id = ri2.produto_id and l.variacao_id is not distinct from ri2.variacao_id
                          and l.numero_norm = public.normalizar_lote(pt->>'lote')
                          and l.vencimento is distinct from nullif(pt->>'vencimento', '')::date
          ) q order by q.o limit 1) m
       where ri2.recebimento_id = r.id and ri2.situacao = 'aceito' and coalesce(pp.controla_validade, false)
         and coalesce((ri2.tentativas -> -1 ->> 'total')::numeric, 0)
             - coalesce((ri2.tentativas -> -1 ->> 'avaria')::numeric, 0) > 0
    ) x
   where ri.id = x.id;

$b$;
begin
  v_def := pg_get_functiondef('public.funcionario_enviar_recebimento'::regproc);
  i1 := position('  -- A4: validade/lote' in v_def);
  i2 := position('  -- Toda recontagem pendente bloqueia' in v_def);
  if i1 = 0 or i2 <= i1 or position(v_old_ag in v_def) = 0 then
    raise exception 'funcao_diverge: funcionario_enviar_recebimento';
  end if;
  v_def := substr(v_def, 1, i1 - 1) || v_bloco || substr(v_def, i2);
  v_def := replace(v_def, v_old_ag, v_new_ag);
  execute v_def;
end $mig$;