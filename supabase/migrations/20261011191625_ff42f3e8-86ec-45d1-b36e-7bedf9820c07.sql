do $mig$
declare v_def text; v_anchor text := '  -- Toda recontagem pendente bloqueia a conclusão';
  v_bloco text := $b$  -- A4: validade/lote que não pode entrar no depósito (vencido, sem data, sem lote na farmácia,
  -- lote já existente com outra data) volta para a equipe contar de novo, em vez de travar a entrega.
  update recebimento_itens ri set situacao = 'recontar', quantidade_aceita = null, avaria = 0,
    tentativas = jsonb_set(ri.tentativas, array[(jsonb_array_length(ri.tentativas) - 1)::text],
      ri.tentativas -> (jsonb_array_length(ri.tentativas) - 1) || jsonb_build_object('validade_recontar', true))
    from produtos pp
   where ri.recebimento_id = r.id and ri.situacao = 'aceito' and pp.id = ri.produto_id
     and coalesce(pp.controla_validade, false)
     and coalesce((ri.tentativas -> (jsonb_array_length(ri.tentativas) - 1) ->> 'total')::numeric, 0)
         - coalesce((ri.tentativas -> (jsonb_array_length(ri.tentativas) - 1) ->> 'avaria')::numeric, 0) > 0
     and exists (select 1 from jsonb_array_elements(coalesce(ri.tentativas -> (jsonb_array_length(ri.tentativas) - 1) -> 'partes', '[]')) pt
        where nullif(pt->>'vencimento', '') is null
           or (pt->>'vencimento')::date < (now() at time zone 'America/Sao_Paulo')::date
           or (c.tipo = 'farmacia' and public.normalizar_lote(pt->>'lote') is null)
           or exists (select 1 from lotes l where l.produto_id = ri.produto_id and l.variacao_id is not distinct from ri.variacao_id
                       and l.numero_norm = public.normalizar_lote(pt->>'lote')
                       and l.vencimento is distinct from (pt->>'vencimento')::date));

$b$;
begin
  v_def := pg_get_functiondef('public.funcionario_enviar_recebimento'::regproc);
  if position(v_anchor in v_def) = 0 or position('A4: validade/lote' in v_def) > 0 then
    raise exception 'funcao_diverge: funcionario_enviar_recebimento';
  end if;
  execute replace(v_def, v_anchor, v_bloco || v_anchor);
end $mig$;