-- C10 (checklist 3): quando a contagem acha mais do que o sistema tinha, a sobra não entra num lote vencido.
-- Antes, o lote escolhido era o que tinha quantidade (mesmo vencido); agora lote vencido fica de fora:
-- a sobra vai para um lote dentro da validade ou, se não houver, entra sem lote (data desconhecida).
-- Vale para o acerto da contagem (_acertar_area: conferência e decisão do dono) e para a reposição.
do $$
declare
  d text; novo text; f record;
  antigo constant text := $a$     order by (s.quantidade > 0) desc, l.vencimento desc nulls last limit 1;$a$;
  trocado constant text := $b$       and coalesce(l.vencimento >= (now() at time zone 'America/Sao_Paulo')::date, true)
     order by (s.quantidade > 0) desc, l.vencimento desc nulls last limit 1;$b$;
begin
  for f in select * from (values
      ('public._acertar_area(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid)', 'a934ae66f27c254ced976aab6fc690ce'),
      ('public.funcionario_reposicao_concluir(text,uuid,numeric)', 'ffa46d8a0a76646d0eb72cc430770bff')) v(assinatura, hash)
  loop
    d := pg_get_functiondef(f.assinatura::regprocedure);
    if md5(d) <> f.hash then raise exception '% diferente do esperado', f.assinatura; end if;
    if (length(d) - length(replace(d, antigo, ''))) / length(antigo) <> 1 then raise exception 'trecho não encontrado uma vez só em %', f.assinatura; end if;
    novo := replace(d, antigo, trocado);
    execute novo;
  end loop;
end $$;
