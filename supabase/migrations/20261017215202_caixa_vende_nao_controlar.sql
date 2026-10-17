-- B10 (checklist funcional 3): item que o dono marcou "não controlar" (sacola, serviço) pode ser vendido no caixa do celular.
-- Antes, caixa_registrar_venda tratava o item marcado igual a "sem cadastro" e recusava a venda inteira
-- (produto_sem_cadastro), e o caixa não tinha como achar esse código ("Produto não encontrado").
-- Agora: o item marcado é vendido sem tirar nada do estoque (fica "ignorado" na venda, como no Omni Conector);
-- a função nova caixa_itens_fora_estoque devolve ao caixa esses códigos com o nome, para ele achar e digitar o preço.
-- Sem tabela nova. Só o trecho do bloqueio em caixa_registrar_venda muda; SECURITY DEFINER, search_path e permissões iguais.
do $$
declare
  d text := pg_get_functiondef('public.caixa_registrar_venda(text,jsonb)'::regprocedure);
  a1 text := $x$    if v_prod is null or v_ign then
      v_bloqueios := v_bloqueios||jsonb_build_object('nome',coalesce(v_desc,'Produto sem cadastro'),'motivo','produto_sem_cadastro');$x$;
  b1 text := $x$    if v_ign then
      null; -- B10: "não controlar" (sacola, serviço): vende sem tirar do estoque.
    elsif v_prod is null then
      v_bloqueios := v_bloqueios||jsonb_build_object('nome',coalesce(v_desc,'Produto sem cadastro'),'motivo','produto_sem_cadastro');$x$;
begin
  if md5(d) <> '19e03588de2dfc69ef3a4d50998d4065' then raise exception 'versao_inesperada: caixa_registrar_venda mudou'; end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 then
    raise exception 'versao_inesperada: trecho não encontrado uma única vez';
  end if;
  execute replace(d, a1, b1);
end $$;

-- Códigos marcados "não controlar" deste comércio, com o nome da última venda. `codigo` vazio = item sem código (achado pelo nome).
create or replace function public.caixa_itens_fora_estoque(_chave text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_caixa(_chave);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'codigo', case when m.codigo like 'avulso:%' then null else m.codigo end,
      'nome', coalesce(
        (select vi.descricao from venda_itens vi join vendas vd on vd.id = vi.venda_id
          where vi.comercio_id = m.comercio_id and vi.codigo_pdv = m.codigo
          order by vd.emitida_em desc, vi.n_item desc limit 1),
        case when m.codigo like 'avulso:%' then substr(m.codigo, 8) end,
        'Item fora do estoque')) order by m.codigo)
    from codigos_pdv m where m.comercio_id = v.comercio_id and m.ignorar), '[]'::jsonb);
end $$;
revoke all on function public.caixa_itens_fora_estoque(text) from public;
grant execute on function public.caixa_itens_fora_estoque(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
