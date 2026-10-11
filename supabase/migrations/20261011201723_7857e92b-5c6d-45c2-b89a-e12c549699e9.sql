do $mig$
declare d text; antigo text := $a$  else
    v_dif := public._registrar_diferenca($a$;
novo text := $n$  elsif pe.baixado = 0 then
    -- Nada tinha saído do estoque (o sistema tinha 0): recusar não cria diferença para explicar.
    update perdas set situacao = 'recusada', decidida_em = now() where id = _id;
  else
    v_dif := public._registrar_diferenca($n$;
begin
  select pg_get_functiondef('public.decidir_perda(uuid,boolean)'::regprocedure) into d;
  if position(antigo in d) = 0 then raise exception 'trecho_nao_encontrado'; end if;
  execute replace(d, antigo, novo);
end $mig$;