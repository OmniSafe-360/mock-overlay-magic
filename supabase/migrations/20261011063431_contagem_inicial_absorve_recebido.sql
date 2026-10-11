-- Checklist funcional, item 4: produto com o depósito "definir depois" que recebe mercadoria e só depois tem a
-- primeira contagem ficava em dobro (o recebido + o contado). A primeira contagem é o total que existe agora,
-- já com o que chegou: o que entrou antes dela sai (movimento "ajuste", mesma operação) e fica só o contado.
-- Edita só esse trecho da versão em produção de salvar_produto (que difere do arquivo original).
do $do$
declare
  v_def text := pg_get_functiondef('public.salvar_produto(jsonb)'::regprocedure);
  v_de text := E'      v_cont := v_cont + 1;\n      v_soma := 0;\n';
  v_para text := E'      v_cont := v_cont + 1;\n      v_soma := 0;\n'
    || E'      -- O que entrou antes da primeira contagem (ex.: recebido com a área ainda não contada) já está no contado.\n'
    || E'      if public.saldo_chave(v_id, v_var, v_area) > 0 then\n'
    || E'        perform public._tirar_saldo(v_com, v_id, v_var, v_area, public.saldo_chave(v_id, v_var, v_area), v_op, v_uid, null, ''ajuste'', v_local);\n'
    || E'      end if;\n';
begin
  if (length(v_def) - length(replace(v_def, v_de, ''))) / length(v_de) <> 1 then
    raise exception 'trecho_nao_encontrado';
  end if;
  execute replace(v_def, v_de, v_para);
end $do$;
