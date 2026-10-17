-- B5 (checklist funcional 3): a conta a pagar acompanha a alteração da resposta do fornecedor.
-- Antes, ao alterar a resposta, uma conta já criada (a pagar) ficava com o valor e o vencimento antigos.
-- Agora, enquanto a conta está "a pagar", o valor e o vencimento seguem a nova resposta,
-- a não ser que o dono já tenha corrigido (o valor ou a data é diferente do que o fornecedor tinha mandado antes).
-- Conta paga continua igual. Só o trecho da conta em responder_pedido muda; SECURITY DEFINER, search_path e permissões iguais.
do $$
declare
  d text := pg_get_functiondef('public.responder_pedido(text,jsonb)'::regprocedure);
  a1 text := $a$  -- Conta que já existe (a pagar ou paga) mantém o valor e o vencimento; o fornecedor só preenche o que está vazio.$a$;
  b1 text := $b$  -- B5: conta paga não muda. Conta a pagar segue a nova resposta, menos o que o dono já corrigiu
  -- (valor ou vencimento diferente do que o fornecedor tinha mandado antes).$b$;
  a2 text := $a$    valor_total = case when pagamento_situacao is not null then coalesce(valor_total, v_valor) else v_valor end,$a$;
  b2 text := $b$    valor_total = case when pagamento_situacao = 'pago' then coalesce(valor_total, v_valor)
      when pagamento_situacao is not null and valor_total is not null and valor_total is distinct from v.valor_fornecedor then valor_total
      else v_valor end,$b$;
  a3 text := $a$    vencimento = case when pagamento_situacao is not null then coalesce(vencimento, v_venc) else v_venc end$a$;
  b3 text := $b$    vencimento = case when pagamento_situacao = 'pago' then coalesce(vencimento, v_venc)
      when pagamento_situacao is not null and vencimento is not null and vencimento is distinct from
        (case when v.forma_pagamento in ('boleto', 'a_prazo') then v.previsao_entrega + coalesce(v.prazo_dias, 0) else v.previsao_entrega end)
        then vencimento
      else v_venc end$b$;
begin
  if md5(d) <> 'b1fe60daeac6785f31c1df2c7cbcf3e2' then
    raise exception 'versao_inesperada: responder_pedido mudou desde a conferência';
  end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1
     or (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1
     or (length(d) - length(replace(d, a3, ''))) / length(a3) <> 1 then
    raise exception 'versao_inesperada: trecho não encontrado uma única vez';
  end if;
  execute replace(replace(replace(d, a1, b1), a2, b2), a3, b3);
end $$;
