-- B1 (checklist funcional 3): "Repor" da equipe ≠ "Para repor" do dono, e o contador da equipe ≠ a lista dela.
-- Uma regra só (_precisa_repor), igual à do app do dono (situacao.ts): a área de venda foi contada, está no mínimo ou abaixo
-- e o produto não acabou de vez (gôndola 0 e depósito contado com 0, ou sem depósito) — esse aparece ao dono como "Acabou".
-- Área de venda nunca contada é desconhecida, não zero: não entra. O contador da tela inicial conta as mesmas linhas da
-- lista, inclusive as contagens da gôndola pedidas pelo caixa.
create function public._precisa_repor(_prod uuid, _var uuid, _minimo numeric)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select _minimo is not null
     and exists (select 1 from contagens where produto_id = _prod and variacao_id is not distinct from _var and area = 'venda')
     and public.saldo_chave(_prod, _var, 'venda') <= _minimo
     and not (public.saldo_chave(_prod, _var, 'venda') = 0
              and (not exists (select 1 from produto_areas where produto_id = _prod and variacao_id is not distinct from _var and area = 'deposito')
                   or (exists (select 1 from contagens where produto_id = _prod and variacao_id is not distinct from _var and area = 'deposito')
                       and public.saldo_chave(_prod, _var, 'deposito') = 0)))
$$;
revoke all on function public._precisa_repor(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public._precisa_repor(uuid, uuid, numeric) to service_role;

do $$
declare
  v_in text := pg_get_functiondef('public.funcionario_inicio(text)'::regprocedure);
  v_li text := pg_get_functiondef('public.funcionario_reposicao_lista(text)'::regprocedure);
  a_in text := $a$  select count(*) into v_repor from (
    select pa.produto_id, pa.variacao_id
      from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
      left join saldos s on s.produto_id = pa.produto_id and s.variacao_id is not distinct from pa.variacao_id and s.area = 'venda'
     where pa.comercio_id = v.comercio_id and pa.area = 'venda' and pa.minimo is not null
       and (pa.variacao_id is null or exists (select 1 from produto_variacoes pv where pv.id = pa.variacao_id and pv.removida_em is null))
     group by pa.produto_id, pa.variacao_id, pa.minimo
    having coalesce(sum(s.quantidade), 0) <= pa.minimo) x;$a$;
  b_in text := $b$  -- B1: as mesmas linhas da lista de reposição (funcionario_reposicao_lista).
  select count(*) into v_repor
    from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
   where pa.comercio_id = v.comercio_id and pa.area = 'venda'
     and (pa.variacao_id is null or exists (select 1 from produto_variacoes pv where pv.id = pa.variacao_id and pv.removida_em is null))
     and (public._precisa_repor(pa.produto_id, pa.variacao_id, pa.minimo)
          or exists (select 1 from conferencias cc where cc.produto_id = pa.produto_id and cc.variacao_id is not distinct from pa.variacao_id
                       and cc.area = 'venda' and cc.situacao in ('contando', 'inconsistente')));$b$;
  a_li text := $a$and (public.saldo_chave(p.id,pa.variacao_id,'venda')<=pa.minimo or cf.id is not null)$a$;
  b_li text := $b$and (public._precisa_repor(p.id,pa.variacao_id,pa.minimo) or cf.id is not null)$b$;
begin
  if md5(v_in) not in ('608eaba3e89f84a7b8d71b16c1ab1f8c') or md5(v_li) not in ('b34a468f5923d637e831a30e8d6ebd8a')
     or (length(v_in) - length(replace(v_in, a_in, ''))) / length(a_in) <> 1
     or (length(v_li) - length(replace(v_li, a_li, ''))) / length(a_li) <> 1 then
    raise exception 'versao_inesperada: md5 in=% li=%', md5(v_in), md5(v_li);
  end if;
  execute replace(v_in, a_in, b_in);
  execute replace(v_li, a_li, b_li);
end $$;
