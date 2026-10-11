-- Checklist funcional, item 8: a conferência do depósito começada hoje aparece sempre, em primeiro lugar
-- (antes ia para o fim e era cortada pela meta do dia, ficando "contando" para sempre). Uma começada em outro dia
-- é deixada de lado: o produto é contado de novo do zero, sem misturar contagens de dias diferentes.
create or replace function public.funcionario_conferencia_lista(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_feitos int; v_vis int; v_meta int; v_falta int;
begin
  v := public._funcionario_da_chave(_chave);
  select count(distinct (produto_id, variacao_id)) into v_feitos from conferencias
   where comercio_id = v.comercio_id and area = 'deposito' and situacao <> 'contando' and (created_at at time zone 'America/Sao_Paulo')::date = v_hoje;
  select count(*) into v_vis from public._produtos_visados(v.comercio_id) vz
    join produto_areas pa on pa.produto_id = vz.produto_id and pa.variacao_id is not distinct from vz.variacao_id and pa.area = 'deposito'
    join produtos p on p.id = pa.produto_id and p.ativo;
  v_meta := 5 + v_vis;
  v_falta := greatest(0, v_meta - v_feitos);
  return jsonb_build_object('tipo', (select tipo from comercios where id = v.comercio_id), 'feitos_hoje', v_feitos, 'meta', v_meta, 'produtos', coalesce((
    select jsonb_agg(public._produto_para_funcionario(x.produto_id, x.variacao_id, null) || jsonb_build_object('local', x.local, 'conferencia_id', x.aberta,
             'rodada', (select jsonb_array_length(cf.tentativas) + 1 from conferencias cf where cf.id = x.aberta)) order by x.ordem)
      from (
        select y.*, row_number() over (order by (y.aberta is not null) desc, y.visado desc, y.ultima nulls first, y.valor desc, y.nome) as ordem
          from (
            select pa.produto_id, pa.variacao_id, l.nome as local, p.nome,
                   exists (select 1 from public._produtos_visados(v.comercio_id) vz where vz.produto_id = pa.produto_id and vz.variacao_id is not distinct from pa.variacao_id) as visado,
                   (select cf.id from conferencias cf where cf.produto_id = pa.produto_id and cf.variacao_id is not distinct from pa.variacao_id
                      and cf.area = 'deposito' and cf.situacao = 'contando' and (cf.created_at at time zone 'America/Sao_Paulo')::date = v_hoje
                    order by cf.created_at desc limit 1) as aberta,
                   (select max(cf.created_at) from conferencias cf where cf.produto_id = pa.produto_id and cf.variacao_id is not distinct from pa.variacao_id and cf.area = 'deposito') as ultima,
                   public.saldo_chave(pa.produto_id, pa.variacao_id, 'deposito') * p.preco_compra as valor
              from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
              left join locais l on l.id = pa.local_id
             where pa.comercio_id = v.comercio_id and pa.area = 'deposito'
               and (pa.variacao_id is null or exists (select 1 from produto_variacoes pv where pv.id = pa.variacao_id and pv.removida_em is null))
          ) y
         where y.aberta is not null
            or (y.visado and not exists (select 1 from conferencias cf where cf.produto_id = y.produto_id and cf.variacao_id is not distinct from y.variacao_id
                                           and cf.area = 'deposito' and cf.situacao <> 'contando' and (cf.created_at at time zone 'America/Sao_Paulo')::date = v_hoje))
            or (not y.visado and not exists (select 1 from conferencias cf where cf.produto_id = y.produto_id and cf.variacao_id is not distinct from y.variacao_id
                                           and cf.area = 'deposito' and cf.situacao <> 'contando' and cf.created_at > now() - interval '7 days'))
      ) x where x.ordem <= v_falta or x.aberta is not null), '[]'::jsonb));
end $$;

notify pgrst, 'reload schema';
