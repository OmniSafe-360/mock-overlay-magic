-- Checklist funcional, item 14: venda "sem cadastro" feita no celular sem código ganhava uma chave por venda
-- ("avulso:<venda>:<n>"), então 30 sacolas viravam 30 itens para resolver. A chave passa a ser o nome digitado
-- ("avulso:sacola"): as vendas do mesmo item se juntam e a decisão do dono (ligar a um produto ou não controlar)
-- vale também para as próximas. Edita só esses trechos da função em produção.
do $do$
declare
  v_def text := pg_get_functiondef('public.caixa_registrar_venda(text, jsonb)'::regprocedure);
  trocas text[][] := array[
    array['v_ign boolean; v_tel text;', 'v_ign boolean; v_tel text; v_cod_avulso text;'],
    array['v_sit := null; v_mot := null; v_unid := null; v_ign := false;', 'v_sit := null; v_mot := null; v_unid := null; v_ign := false; v_cod_avulso := null;'],
    array[E'      if v_prod is not null then select nome into v_nome_prod from produtos where id = v_prod; end if;\n    end if;\n    if v_ign then',
          E'      if v_prod is not null then select nome into v_nome_prod from produtos where id = v_prod; end if;\n'
       || E'    else\n'
       || E'      -- Sem código: a chave é o nome digitado, para juntar as vendas do mesmo item e lembrar a decisão do dono.\n'
       || E'      v_cod_avulso := ''avulso:'' || lower(regexp_replace(coalesce(v_desc, ''Produto sem cadastro''), ''\\s+'', '' '', ''g''));\n'
       || E'      select * into a from public._achar_item_venda(c.id, v_cod_avulso, null);\n'
       || E'      v_prod := a.produto_id; v_var := a.variacao_id; v_emb := a.embalagem_id; v_ign := coalesce(a.ignorar, false);\n'
       || E'      if v_prod is not null then select nome into v_nome_prod from produtos where id = v_prod; end if;\n'
       || E'    end if;\n    if v_ign then'],
    array['coalesce(v_cod, case when v_prod is not null then', 'coalesce(v_cod, v_cod_avulso, case when v_prod is not null then']
  ];
  i int;
begin
  for i in 1 .. array_length(trocas, 1) loop
    if (length(v_def) - length(replace(v_def, trocas[i][1], ''))) / length(trocas[i][1]) <> 1 then
      raise exception 'trecho_nao_encontrado: %', i;
    end if;
    v_def := replace(v_def, trocas[i][1], trocas[i][2]);
  end loop;
  execute v_def;
end $do$;
