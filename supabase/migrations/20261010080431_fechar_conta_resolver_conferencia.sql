-- Fase 4.3 — aba Diferenças: o dono escolhe a contagem certa quando as 3 contagens da conferência não bateram.
-- Sem tabela nova. O estoque recebe a diferença entre a contagem escolhida e o que o sistema tinha na hora da contagem
-- (o que entrou ou saiu depois — vendas, reposições — continua valendo). Uma `operacoes` na mesma transação.
create or replace function public.resolver_conferencia(_diferenca uuid, _contado numeric) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d diferencas%rowtype; p produtos%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid(); v_atual numeric; v_novo numeric; v_dif numeric;
begin
  select * into d from diferencas where id = _diferenca for update;
  if not found or not public.pode_acessar_comercio(d.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if d.origem <> 'conferencia_inconsistente' then raise exception 'nao_e_contagem_inconsistente' using errcode = '22023'; end if;
  if d.detalhes ? 'resolvida' then raise exception 'contagem_ja_resolvida' using errcode = '23514'; end if;
  if _contado is null or (_contado <> d.esperado and not exists (select 1 from jsonb_array_elements_text(coalesce(d.detalhes->'tentativas', '[]')) t where t::numeric = _contado)) then
    raise exception 'contagem_invalida' using errcode = '22023';
  end if;
  select * into p from produtos where id = d.produto_id;
  select * into c from comercios where id = d.comercio_id;
  perform pg_advisory_xact_lock(hashtextextended(p.id::text, 0));
  v_dif := _contado - d.esperado;
  v_atual := public.saldo_chave(p.id, d.variacao_id, d.area);
  v_novo := greatest(0, v_atual + v_dif);
  insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash)
  values (v_op, c.dono_id, c.id, p.id, 'conferencia', md5(d.id::text || ':resolver'));
  if v_novo <> v_atual then
    perform public._acertar_area(c.id, p.id, d.variacao_id, d.area, v_novo, v_op, c.dono_id, null);
  end if;
  update diferencas set contado = _contado, diferenca = v_dif, valor = round(v_dif * coalesce(p.preco_compra, 0), 2),
         detalhes = detalhes || jsonb_build_object('resolvida', true, 'operacao', v_op),
         situacao = case when v_dif = 0 then 'explicada' else situacao end,
         motivo = case when v_dif = 0 then 'erro_contagem' else motivo end,
         explicada_em = case when v_dif = 0 then now() else explicada_em end,
         explicada_por = case when v_dif = 0 then auth.uid() else explicada_por end
   where id = d.id;
  update conferencias set situacao = 'concluida', contado = _contado, operacao_id = v_op where id = d.referencia_id and situacao = 'inconsistente';
  update operacoes set resultado = jsonb_build_object('diferenca', d.id, 'escolhida', _contado, 'antes', v_atual, 'depois', v_novo) where id = v_op;
  return jsonb_build_object('diferenca', v_dif, 'valor', round(v_dif * coalesce(p.preco_compra, 0), 2));
end $$;
revoke all on function public.resolver_conferencia(uuid, numeric) from public, anon, authenticated;
grant execute on function public.resolver_conferencia(uuid, numeric) to authenticated;
