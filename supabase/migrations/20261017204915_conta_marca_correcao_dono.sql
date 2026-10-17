-- B5, ajuste da revisão: a correção do dono fica marcada (antes era deduzida comparando com a última resposta do fornecedor,
-- e se o dono corrigisse para o mesmo número que o fornecedor mandou depois, a resposta seguinte passava por cima).
-- Colunas novas em pedidos_compra: valor_do_dono e vencimento_do_dono (o dono mudou o valor/vencimento da conta).
-- atualizar_pagamento liga a marca quando o dono muda o valor ou o vencimento; responder_pedido não troca o que está marcado,
-- e desliga as marcas quando a conta some (recusa) ou nasce de novo. Conta paga continua igual.
-- Só trechos conferidos das duas funções mudam; SECURITY DEFINER, search_path e permissões iguais.
alter table public.pedidos_compra add column valor_do_dono boolean not null default false;
alter table public.pedidos_compra add column vencimento_do_dono boolean not null default false;
comment on column public.pedidos_compra.valor_do_dono is 'B5: o dono corrigiu o valor da conta; nova resposta do fornecedor não troca.';
comment on column public.pedidos_compra.vencimento_do_dono is 'B5: o dono corrigiu o vencimento da conta; nova resposta do fornecedor não troca.';
-- Contas a pagar que já existem: a mesma regra de antes (diferente do que o fornecedor mandou = foi o dono).
update public.pedidos_compra set
  valor_do_dono = valor_total is not null and valor_total is distinct from valor_fornecedor,
  vencimento_do_dono = vencimento is not null and vencimento is distinct from
    (case when forma_pagamento in ('boleto', 'a_prazo') then previsao_entrega + coalesce(prazo_dias, 0) else previsao_entrega end)
 where pagamento_situacao = 'a_pagar';

do $$
declare
  r text := pg_get_functiondef('public.responder_pedido(text,jsonb)'::regprocedure);
  a text := pg_get_functiondef('public.atualizar_pagamento(uuid,jsonb)'::regprocedure);
  r1 text := $x$      vencimento = case when pagamento_situacao = 'pago' then vencimento else null end
     where id = v.id;$x$;
  s1 text := $x$      vencimento = case when pagamento_situacao = 'pago' then vencimento else null end,
      valor_do_dono = coalesce(pagamento_situacao = 'pago', false) and valor_do_dono,
      vencimento_do_dono = coalesce(pagamento_situacao = 'pago', false) and vencimento_do_dono
     where id = v.id;$x$;
  r2 text := $x$      when pagamento_situacao is not null and valor_total is not null and valor_total is distinct from v.valor_fornecedor then valor_total$x$;
  s2 text := $x$      when pagamento_situacao is not null and valor_do_dono then valor_total$x$;
  r3 text := $x$      when pagamento_situacao is not null and vencimento is not null and vencimento is distinct from
        (case when v.forma_pagamento in ('boleto', 'a_prazo') then v.previsao_entrega + coalesce(v.prazo_dias, 0) else v.previsao_entrega end)
        then vencimento
      else v_venc end$x$;
  s3 text := $x$      when pagamento_situacao is not null and vencimento_do_dono then coalesce(vencimento, v_venc)
      else v_venc end,
    valor_do_dono = pagamento_situacao is not null and valor_do_dono,
    vencimento_do_dono = pagamento_situacao is not null and vencimento_do_dono$x$;
  r4 text := $x$  -- (valor ou vencimento diferente do que o fornecedor tinha mandado antes).$x$;
  s4 text := $x$  -- (marcas valor_do_dono/vencimento_do_dono, ligadas por atualizar_pagamento).$x$;
  a1 text := $x$  update pedidos_compra set pagamento_situacao = v_sit, vencimento = v_venc, valor_total = v_valor,$x$;
  t1 text := $x$  -- B5: o que o dono mudou fica marcado; a nova resposta do fornecedor não troca.
  update pedidos_compra set pagamento_situacao = v_sit, vencimento = v_venc, valor_total = v_valor,
    valor_do_dono = valor_do_dono or v_valor is distinct from v.valor_total,
    vencimento_do_dono = vencimento_do_dono or v_venc is distinct from v.vencimento,$x$;
begin
  if md5(r) <> 'ad38a99d9d4ac3480ba77693300538bb' then raise exception 'versao_inesperada: responder_pedido mudou'; end if;
  if md5(a) <> 'bc6081c8e19c919f0a1b4524e0e79989' then raise exception 'versao_inesperada: atualizar_pagamento mudou'; end if;
  if (length(r) - length(replace(r, r1, ''))) / length(r1) <> 1 or (length(r) - length(replace(r, r2, ''))) / length(r2) <> 1
     or (length(r) - length(replace(r, r3, ''))) / length(r3) <> 1 or (length(r) - length(replace(r, r4, ''))) / length(r4) <> 1
     or (length(a) - length(replace(a, a1, ''))) / length(a1) <> 1 then
    raise exception 'versao_inesperada: trecho não encontrado uma única vez';
  end if;
  execute replace(replace(replace(replace(r, r1, s1), r2, s2), r3, s3), r4, s4);
  execute replace(a, a1, t1);
end $$;
