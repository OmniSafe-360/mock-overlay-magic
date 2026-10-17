-- B5, segundo ajuste da revisão (PR #203): a marca "o dono corrigiu" só liga quando o dono põe um valor ou uma data
-- diferente do que o fornecedor informou. Apagar o valor (em branco = vale o do fornecedor) desliga a marca,
-- e corrigir só o vencimento não marca o valor (a janela reenvia o valor que já estava na conta).
-- Só o trecho das marcas em atualizar_pagamento muda; SECURITY DEFINER, search_path e permissões iguais.
do $$
declare
  a text := pg_get_functiondef('public.atualizar_pagamento(uuid,jsonb)'::regprocedure);
  a1 text := $x$    valor_do_dono = valor_do_dono or v_valor is distinct from v.valor_total,
    vencimento_do_dono = vencimento_do_dono or v_venc is distinct from v.vencimento,$x$;
  t1 text := $x$    valor_do_dono = case when p ? 'valor_total' then v_valor is not null and v_valor is distinct from v.valor_fornecedor
      else valor_do_dono end,
    vencimento_do_dono = case when nullif(p->>'vencimento', '') is not null then v_venc is distinct from
        (case when v.forma_pagamento in ('boleto', 'a_prazo') then v.previsao_entrega + coalesce(v.prazo_dias, 0) else v.previsao_entrega end)
      else vencimento_do_dono end,$x$;
begin
  if md5(a) <> 'a3093ca9549918fc48ac2a62a1864818' then raise exception 'versao_inesperada: atualizar_pagamento mudou'; end if;
  if (length(a) - length(replace(a, a1, ''))) / length(a1) <> 1 then
    raise exception 'versao_inesperada: trecho não encontrado uma única vez';
  end if;
  execute replace(a, a1, t1);
end $$;
