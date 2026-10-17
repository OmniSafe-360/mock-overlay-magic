-- A2 (checklist funcional 3): recebimento preso para sempre em "Conte de novo".
-- O bloco A4 de `funcionario_enviar_recebimento` devolve para recontar o item cuja validade/lote não pode entrar no
-- depósito. O caso que entra em laço é o "lote_outra_data" (lote já cadastrado com outra validade): a equipe reconta
-- com os mesmos dados verdadeiros, o item vira "aceito", o A4 devolve de novo, e a entrega nunca conclui.
-- Agora, se o item já voltou uma vez por esse motivo de validade/lote, na segunda vez ele fica separado para o dono
-- decidir ("inconsistente"), como acontece com as contagens que não batem. A entrega conclui e os outros produtos
-- aceitos entram no depósito. Só esses dois trechos mudam; o resto da função é o mesmo.

do $$
declare v_def text := pg_get_functiondef('public.funcionario_enviar_recebimento(text,uuid,integer,jsonb)'::regprocedure);
        a1 text := $a$  update recebimento_itens ri set situacao = 'recontar', quantidade_aceita = null, avaria = 0,
    tentativas = jsonb_set(ri.tentativas, array[(jsonb_array_length(ri.tentativas) - 1)::text],
      ri.tentativas -> (jsonb_array_length(ri.tentativas) - 1) || jsonb_strip_nulls(jsonb_build_object(
        'validade_recontar', true,$a$;
        b1 text := $b$  update recebimento_itens ri set situacao = case when x.ja_voltou then 'inconsistente' else 'recontar' end,
    quantidade_aceita = null, avaria = 0,
    tentativas = jsonb_set(ri.tentativas, array[(jsonb_array_length(ri.tentativas) - 1)::text],
      ri.tentativas -> (jsonb_array_length(ri.tentativas) - 1) || jsonb_strip_nulls(jsonb_build_object(
        'validade_recontar', true,$b$;
        a2 text := $a$      select ri2.id, m.motivo, m.lote, m.lote_data
$a$;
        b2 text := $b$      select ri2.id, m.motivo, m.lote, m.lote_data,
             -- A2: já voltou antes por validade/lote: na segunda vez fica para o dono, sem laço.
             exists (select 1 from jsonb_array_elements(ri2.tentativas) tv where (tv->>'validade_recontar')::boolean) as ja_voltou
$b$;
begin
  if md5(v_def) <> 'dac6b3b3cffbd87586a387d8ec702d7a' then
    raise exception 'versao_inesperada: funcionario_enviar_recebimento mudou desde a conferência';
  end if;
  if (length(v_def) - length(replace(v_def, a1, ''))) / length(a1) <> 1
     or (length(v_def) - length(replace(v_def, a2, ''))) / length(a2) <> 1 then
    raise exception 'versao_inesperada: trecho A4 não encontrado uma única vez';
  end if;
  execute replace(replace(v_def, a1, b1), a2, b2);
end $$;
