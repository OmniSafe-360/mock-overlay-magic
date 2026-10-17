-- A6, ajustes do Codex no PR #193: os avisos de venda cancelada pelo dono vêm numa lista própria
-- (avisos_cancelamento), sem o limite das 200 vendas mais recentes do turno.
do $$
declare
  v_def text := pg_get_functiondef('public.caixa_estado(text)'::regprocedure);
  a text := $a$    'vendas', coalesce(v_vendas, '[]'));$a$;
  b text := $b$    'vendas', coalesce(v_vendas, '[]'),
    'avisos_cancelamento', case when t.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'numero', x.numero, 'devolver_gaveta', x.dev) order by x.cancelada_em)
        from (select vd.id, vd.numero, vd.cancelada_em, public._devolver_gaveta_venda(vd.id) dev
                from vendas vd where vd.turno_id = t.id and vd.situacao = 'cancelada' and vd.cancelada_por = 'dono') x
       where x.dev > 0), '[]'::jsonb) end);$b$;
begin
  if md5(v_def) <> '616faaccc925495b7c24c265324a69b3' then
    raise exception 'versao_inesperada: caixa_estado mudou desde a conferência';
  end if;
  if (length(v_def) - length(replace(v_def, a, ''))) / length(a) <> 1 then
    raise exception 'versao_inesperada: trecho de caixa_estado não encontrado uma única vez';
  end if;
  execute replace(v_def, a, b);
end $$;
