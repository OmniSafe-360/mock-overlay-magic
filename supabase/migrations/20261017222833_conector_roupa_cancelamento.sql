-- B12 (checklist funcional 3): Omni Conector.
-- (1) Roupa vendida sem tamanho/cor (a nota traz o código do produto, não o do tamanho): antes, a venda tentava tirar da
--     gôndola "sem tamanho", que não existe, e tudo virava "faltou". Agora fica para o dono dizer qual tamanho saiu
--     (situação "conferir", motivo "escolher_variacao"), como no caixa do celular.
-- (2) Cancelamento de nota de um mês antes de o caixa existir no Omni (a chave traz ano e mês): a venda nunca contou
--     ("anterior"), então o cancelamento também não; antes criava uma venda cancelada vazia.
-- Só trechos conferidos das duas funções mudam; SECURITY DEFINER, search_path e permissões iguais.
do $$
declare
  e text := pg_get_functiondef('public.conector_enviar_venda(text,jsonb)'::regprocedure);
  c text := pg_get_functiondef('public.conector_cancelar_venda(text,text)'::regprocedure);
  e1 text := $x$    else
      select x.unidades, x.motivo into v_unid, v_mot from public._unidades_item(a.produto_id, a.embalagem_id, v_qtd) x;$x$;
  f1 text := $x$    elsif a.variacao_id is null and exists (select 1 from produto_variacoes pv where pv.produto_id = a.produto_id and pv.removida_em is null) then
      -- B12: roupa sem tamanho/cor na nota: o dono diz qual saiu (não há gôndola "sem tamanho").
      v_sit := 'conferir'; v_mot := 'escolher_variacao'; v_sem := v_sem + 1;
    else
      select x.unidades, x.motivo into v_unid, v_mot from public._unidades_item(a.produto_id, a.embalagem_id, v_qtd) x;$x$;
  c1 text := $x$  if not found then
    insert into vendas (comercio_id, caixa_id, chave_nota, situacao, cancelada_em)$x$;
  d1 text := $x$  if not found then
    -- B12: nota de mês anterior ao do caixa no Omni (a chave traz ano e mês): a venda nunca contou, o cancelamento também não.
    if to_date('20' || substr(_chave_nota, 3, 4), 'YYYYMM') < date_trunc('month', cx.created_at at time zone 'America/Sao_Paulo')::date then
      return jsonb_build_object('situacao', 'anterior');
    end if;
    insert into vendas (comercio_id, caixa_id, chave_nota, situacao, cancelada_em)$x$;
begin
  if md5(e) <> 'a853e322ec48f91bede08128238b2104' then raise exception 'versao_inesperada: conector_enviar_venda mudou'; end if;
  if md5(c) <> '3ddd2ab9bd17d40fd6984826479226e7' then raise exception 'versao_inesperada: conector_cancelar_venda mudou'; end if;
  if (length(e) - length(replace(e, e1, ''))) / length(e1) <> 1 or (length(c) - length(replace(c, c1, ''))) / length(c1) <> 1 then
    raise exception 'versao_inesperada: trecho não encontrado uma única vez';
  end if;
  execute replace(e, e1, f1);
  execute replace(c, c1, d1);
end $$;

