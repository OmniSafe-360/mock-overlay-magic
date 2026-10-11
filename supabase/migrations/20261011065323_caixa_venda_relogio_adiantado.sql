-- Checklist funcional, item 7: venda do caixa no celular com o relógio do celular adiantado era recusada
-- ("data_invalida") e ficava presa no celular. Agora a hora no futuro vira a hora do servidor (o "least(v_feita, now())"
-- que já existia); só data com mais de 30 dias para trás continua recusada. Edita só essa linha da função em produção.
do $do$
declare
  v_def text := pg_get_functiondef('public.caixa_registrar_venda(text, jsonb)'::regprocedure);
  v_de text := 'if v_feita > now() + interval ''10 minutes'' or v_feita < now() - interval ''30 days'' then';
  v_para text := 'if v_feita < now() - interval ''30 days'' then';
begin
  if (length(v_def) - length(replace(v_def, v_de, ''))) / length(v_de) <> 1 then
    raise exception 'trecho_nao_encontrado';
  end if;
  execute replace(v_def, v_de, v_para);
end $do$;
