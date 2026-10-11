CREATE OR REPLACE FUNCTION public.funcionario_buscar_produto(_chave text, _texto text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype; t text := btrim(coalesce(_texto,''));
begin
  v := public._funcionario_da_chave(_chave);
  if char_length(t)<2 then return '[]'::jsonb; end if;
  if t ~ '^[0-9]+$' then
    return coalesce((select jsonb_agg(public._produto_para_funcionario(cb.produto_id,cb.variacao_id,cb.embalagem_id))
      from codigos_barras cb join produtos p on p.id=cb.produto_id and p.ativo
      where cb.comercio_id=v.comercio_id and (cb.codigo=t or cb.ean_upc_mercado=public.ean_upc_mercado(t))), '[]'::jsonb);
  end if;
  -- B9: limite de 12 PRODUTOS (todas as variações ativas de cada um), não 12 linhas
  return coalesce((select jsonb_agg(public._produto_para_funcionario(x.pid,x.vid,null) order by x.nome,x.tamanho,x.cor) from (
    select p.id pid,p.nome,pv.id vid,pv.tamanho,pv.cor
    from (select p0.id from produtos p0
          where p0.comercio_id=v.comercio_id and p0.ativo and p0.nome ilike '%'||replace(replace(t,'%',''),'_','')||'%'
          order by p0.nome limit 12) sel
    join produtos p on p.id=sel.id
    left join produto_variacoes pv on pv.produto_id=p.id and pv.removida_em is null
    order by p.nome,pv.tamanho,pv.cor limit 500) x), '[]'::jsonb);
end $function$;