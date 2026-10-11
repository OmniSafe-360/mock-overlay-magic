-- Checklist funcional, item 19: a tela inicial do funcionário contava em "Repor" a área de venda de uma variação
-- (tamanho/cor de roupa) já apagada, que a lista de reposição não mostra — o número não batia com a lista.
-- O contador passa a usar o mesmo filtro da lista (funcionario_reposicao_lista): só variações não removidas.
-- Edita só esse trecho da versão em produção de funcionario_inicio.
do $do$
declare
  v_def text := pg_get_functiondef('public.funcionario_inicio(text)'::regprocedure);
  v_de text := E'     where pa.comercio_id = v.comercio_id and pa.area = ''venda'' and pa.minimo is not null\n';
  v_para text := v_de || E'       and (pa.variacao_id is null or exists (select 1 from produto_variacoes pv where pv.id = pa.variacao_id and pv.removida_em is null))\n';
begin
  if (length(v_def) - length(replace(v_def, v_de, ''))) / length(v_de) <> 1 then
    raise exception 'trecho_nao_encontrado';
  end if;
  execute replace(v_def, v_de, v_para);
end $do$;
