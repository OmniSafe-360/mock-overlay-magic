-- B12, ajuste da revisão (PR #209): o tamanho/cor escolhido para uma venda vale só para ela.
-- Quando o caixa vende roupa com o código do produto (sem o tamanho), resolver_item_venda gravava o tamanho escolhido
-- no código do caixa (codigos_pdv) e resolvia todas as vendas pendentes desse código com ele: escolher P numa venda
-- fazia as outras e as próximas (de M, G…) tirarem P sem perguntar. Agora, se a venda já está ligada ao produto e só falta
-- o tamanho/cor (motivo escolher_variacao), a escolha resolve só aquela venda e o código continua sem tamanho.
-- Vale para o Omni Conector e para o caixa do celular. Só um trecho conferido muda; SECURITY DEFINER, search_path e permissões iguais.
do $$
declare
  d text := pg_get_functiondef('public.resolver_item_venda(uuid,text,uuid,uuid,uuid)'::regprocedure);
  a1 text := $x$  insert into codigos_pdv (comercio_id, codigo, produto_id, variacao_id, embalagem_id, ignorar, criado_por)
  values (i.comercio_id, i.codigo_pdv, _produto, _variacao, _embalagem, false, auth.uid())$x$;
  b1 text := $x$  -- B12: só falta o tamanho/cor desta venda: resolve só ela; o código do caixa continua sem tamanho (as próximas perguntam).
  if i.motivo = 'escolher_variacao' and i.produto_id = _produto and _variacao is not null then
    perform 1 from venda_itens where id = i.id and situacao = 'conferir' for update;
    if not found then raise exception 'item_ja_resolvido' using errcode = '23514'; end if;
    select x.unidades, x.motivo into v_unid, v_mot from public._unidades_item(_produto, _embalagem, i.qtd_nota) x;
    if v_unid is null then
      update venda_itens set variacao_id = _variacao, embalagem_id = _embalagem, motivo = v_mot where id = i.id;
      return jsonb_build_object('itens', 0, 'conferir', 1);
    end if;
    update venda_itens set variacao_id = _variacao, embalagem_id = _embalagem, qtd_unidades = v_unid, situacao = 'baixado', motivo = null, resolvido_em = now() where id = i.id;
    perform public._baixar_item_venda(i.id);
    return jsonb_build_object('itens', 1, 'conferir', 0);
  end if;
  insert into codigos_pdv (comercio_id, codigo, produto_id, variacao_id, embalagem_id, ignorar, criado_por)
  values (i.comercio_id, i.codigo_pdv, _produto, _variacao, _embalagem, false, auth.uid())$x$;
begin
  if md5(d) <> 'b53f0a2e8b17bb002f10668fbeb373e3' then raise exception 'versao_inesperada: resolver_item_venda mudou'; end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 then raise exception 'versao_inesperada: trecho não encontrado uma única vez'; end if;
  execute replace(d, a1, b1);
end $$;
