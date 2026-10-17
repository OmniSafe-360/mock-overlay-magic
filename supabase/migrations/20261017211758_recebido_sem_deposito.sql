-- B8 (checklist funcional 3): mercadoria recebida não fica invisível quando o produto não tem área de depósito.
-- Antes, o recebimento punha o saldo no depósito, mas o produto (só com área de venda) não tinha a área do depósito:
-- o app não mostrava esse saldo em lugar nenhum. Agora, ao receber, se o produto não tem a área do depósito,
-- ela é criada (sem local, sem mínimo/máximo) já contada com zero, então o depósito passa a mostrar o que chegou.
-- Só o trecho do local em _entrar_no_deposito muda; SECURITY DEFINER, search_path e permissões iguais.
do $$
declare
  d text := pg_get_functiondef('public._entrar_no_deposito(uuid,jsonb,uuid,uuid)'::regprocedure);
  a1 text := $x$  select local_id into v_local from produto_areas where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id and area = 'deposito';$x$;
  b1 text := $x$  select local_id into v_local from produto_areas where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id and area = 'deposito';
  if not found then
    -- B8: produto sem área de depósito: cria a área (sem local) já contada com zero, para o que chega aparecer.
    insert into produto_areas (comercio_id, produto_id, variacao_id, area) values (i.comercio_id, i.produto_id, i.variacao_id, 'deposito');
    insert into contagens (operacao_id, comercio_id, produto_id, variacao_id, area, quantidade, criado_por)
    values (v_op, i.comercio_id, i.produto_id, i.variacao_id, 'deposito', 0, _user) on conflict do nothing;
  end if;$x$;
begin
  if md5(d) <> '106655419685a84db87eb4889e431a30' then raise exception 'versao_inesperada: _entrar_no_deposito mudou'; end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 then
    raise exception 'versao_inesperada: trecho não encontrado uma única vez';
  end if;
  execute replace(d, a1, b1);
end $$;
