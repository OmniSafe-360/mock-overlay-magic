do $mig$
declare d text; antigo text := $a$  -- Variações: ids estáveis do app; nunca de outro produto.$a$;
novo text := $n$  -- Ligar a validade num produto já contado: o saldo sem lote vira pendência, para receber as datas
  -- (resolver_pendencia, na mesma transação de salvar_cadastro). Nada de quantidade muda.
  if v_existe and v_old.controla_validade is distinct from true and v_ctrl is true then
    update saldos set pendente = true, pendencia_confirmada = false, updated_at = now()
     where produto_id = v_id and quantidade > 0 and lote_id is null and not pendente;
  end if;

  -- Variações: ids estáveis do app; nunca de outro produto.$n$;
begin
  select pg_get_functiondef('public.salvar_produto(jsonb)'::regprocedure) into d;
  if position(antigo in d) = 0 then raise exception 'trecho_nao_encontrado'; end if;
  execute replace(d, antigo, novo);
end $mig$;