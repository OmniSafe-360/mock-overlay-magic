-- B8, ajuste da revisão (PR #205): roupa com vários tamanhos/cores e sem depósito nenhum.
-- A primeira versão criava o depósito só para o tamanho/cor que chegou; os outros ficavam sem a área
-- e o total do produto virava "não contado". Agora, se o produto não tem depósito em nenhum tamanho/cor,
-- a área é criada para todos os tamanhos/cores ativos, cada um contado com zero, na mesma operação.
-- Se o produto já tem depósito em algum tamanho/cor, só o que chegou ganha a área (como antes).
-- Só o trecho da B8 em _entrar_no_deposito muda; SECURITY DEFINER, search_path e permissões iguais.
do $$
declare
  d text := pg_get_functiondef('public._entrar_no_deposito(uuid,jsonb,uuid,uuid)'::regprocedure);
  a1 text := $x$    insert into produto_areas (comercio_id, produto_id, variacao_id, area) values (i.comercio_id, i.produto_id, i.variacao_id, 'deposito');
    insert into contagens (operacao_id, comercio_id, produto_id, variacao_id, area, quantidade, criado_por)
    values (v_op, i.comercio_id, i.produto_id, i.variacao_id, 'deposito', 0, _user) on conflict do nothing;$x$;
  b1 text := $x$    -- Roupa sem depósito em nenhum tamanho/cor: a área vale para todos os ativos, para o total não virar "não contado".
    with x(vid) as (
      select i.variacao_id
      union
      select pv.id from produto_variacoes pv
       where i.variacao_id is not null and pv.produto_id = i.produto_id and pv.removida_em is null
         and not exists (select 1 from produto_areas pa where pa.produto_id = i.produto_id and pa.area = 'deposito')
    ), novas as (
      insert into produto_areas (comercio_id, produto_id, variacao_id, area)
      select i.comercio_id, i.produto_id, x.vid, 'deposito' from x on conflict do nothing returning 1
    )
    insert into contagens (operacao_id, comercio_id, produto_id, variacao_id, area, quantidade, criado_por)
    select v_op, i.comercio_id, i.produto_id, x.vid, 'deposito', 0, _user from x on conflict do nothing;$x$;
begin
  if md5(d) <> 'ec35d4b56c8996ce573bdeb741198e35' then raise exception 'versao_inesperada: _entrar_no_deposito mudou'; end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 then
    raise exception 'versao_inesperada: trecho não encontrado uma única vez';
  end if;
  execute replace(d, a1, b1);
end $$;
