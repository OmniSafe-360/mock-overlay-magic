-- Fase 5.2 — antifurto: limite do mês por comércio e produto visado conferido todo dia.
-- Produto visado = 3 faltas ou mais em 30 dias (falta = diferença negativa que não é erro de contagem nem contagem
-- ainda sem escolha), com a última nos últimos 7 dias. Ele entra primeiro na conferência do depósito, todo dia,
-- além dos 5 do revezamento. O funcionário não sabe que o produto é visado (a lista não diz).
alter table public.comercios add column limite_faltas_mes numeric(12,2) not null default 200
  check (limite_faltas_mes >= 0 and limite_faltas_mes <= 1000000);
comment on column public.comercios.limite_faltas_mes is 'Antifurto: avisar o dono quando o que faltou no mês passar deste valor (R$).';

create or replace function public._produtos_visados(_com uuid) returns table (produto_id uuid, variacao_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select d.produto_id, d.variacao_id from diferencas d
   where d.comercio_id = _com and d.created_at > now() - interval '30 days' and d.diferenca < 0
     and coalesce(d.motivo, '') <> 'erro_contagem'
     and not (d.origem = 'conferencia_inconsistente' and not (d.detalhes ? 'resolvida'))
   group by d.produto_id, d.variacao_id
  having count(*) >= 3 and max(d.created_at) > now() - interval '7 days'
$$;

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
    select jsonb_agg(public._produto_para_funcionario(x.produto_id, x.variacao_id, null) || jsonb_build_object('local', x.local, 'conferencia_id', x.aberta) order by x.ordem)
      from (
        select y.*, row_number() over (order by y.visado desc, y.ultima nulls first, y.valor desc, y.nome) as ordem
          from (
            select pa.produto_id, pa.variacao_id, l.nome as local, p.nome,
                   exists (select 1 from public._produtos_visados(v.comercio_id) vz where vz.produto_id = pa.produto_id and vz.variacao_id is not distinct from pa.variacao_id) as visado,
                   (select cf.id from conferencias cf where cf.produto_id = pa.produto_id and cf.variacao_id is not distinct from pa.variacao_id
                      and cf.area = 'deposito' and cf.situacao = 'contando' order by cf.created_at desc limit 1) as aberta,
                   (select max(cf.created_at) from conferencias cf where cf.produto_id = pa.produto_id and cf.variacao_id is not distinct from pa.variacao_id and cf.area = 'deposito') as ultima,
                   public.saldo_chave(pa.produto_id, pa.variacao_id, 'deposito') * p.preco_compra as valor
              from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
              left join locais l on l.id = pa.local_id
             where pa.comercio_id = v.comercio_id and pa.area = 'deposito'
               and (pa.variacao_id is null or exists (select 1 from produto_variacoes pv where pv.id = pa.variacao_id and pv.removida_em is null))
          ) y
         where (y.visado and not exists (select 1 from conferencias cf where cf.produto_id = y.produto_id and cf.variacao_id is not distinct from y.variacao_id
                                           and cf.area = 'deposito' and cf.situacao <> 'contando' and (cf.created_at at time zone 'America/Sao_Paulo')::date = v_hoje))
            or (not y.visado and not exists (select 1 from conferencias cf where cf.produto_id = y.produto_id and cf.variacao_id is not distinct from y.variacao_id
                                           and cf.area = 'deposito' and cf.situacao <> 'contando' and cf.created_at > now() - interval '7 days'))
      ) x where x.ordem <= v_falta), '[]'::jsonb));
end $$;

/* O dono muda o limite do aviso de faltas do mês (R$). */
create or replace function public.definir_limite_faltas(_comercio uuid, _valor numeric) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.pode_acessar_comercio(_comercio) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if _valor is null or _valor < 0 or _valor > 1000000 then raise exception 'valor_invalido' using errcode = '22023'; end if;
  update comercios set limite_faltas_mes = round(_valor, 2) where id = _comercio;
end $$;

revoke all on function public._produtos_visados(uuid), public.definir_limite_faltas(uuid, numeric) from public, anon, authenticated;
grant execute on function public.definir_limite_faltas(uuid, numeric) to authenticated;
