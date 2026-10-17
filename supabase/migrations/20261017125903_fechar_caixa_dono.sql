-- A8 (checklist funcional 3): caixa preso aberto. Se o dono desliga o "Caixa" do funcionário ou o bloqueia com o
-- caixa aberto, o funcionário não consegue mais fechar (caixa_fechar exige a função Caixa e o funcionário ativo).
-- Agora o dono fecha esse caixa pelo app (Vendas → Caixas do celular), com o dinheiro que contou na gaveta.
-- Mesmo cálculo de caixa_fechar (_resumo_turno). Só vale quando o funcionário não pode mais fechar.
-- Sem tabela nova; estoque e vendas não mudam.
create function public.fechar_caixa_dono(_turno uuid, _contado numeric, _observacao text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare t caixa_turnos%rowtype; f funcionarios%rowtype; v_res jsonb; v_esp numeric;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into t from caixa_turnos where id = _turno for update;
  if not found or not public.pode_acessar_comercio(t.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if t.situacao = 'fechado' then return jsonb_build_object('situacao', 'repetida', 'turno', public._resumo_turno(t.id)); end if;
  select * into f from funcionarios where id = t.funcionario_id;
  if found and f.caixa and f.bloqueado_em is null then
    raise exception 'caixa_ainda_com_funcionario' using errcode = '23514'; end if;
  if _contado is null or _contado < 0 or _contado > 1000000 then raise exception 'valor_invalido' using errcode = '22023'; end if;
  v_res := public._resumo_turno(t.id);
  v_esp := (v_res->>'dinheiro_esperado')::numeric;
  update caixa_turnos set situacao = 'fechado', fechado_em = now(), dinheiro_esperado = v_esp, dinheiro_contado = round(_contado, 2),
         diferenca = round(_contado, 2) - v_esp,
         observacao = left('Fechado pelo dono' || coalesce(': ' || nullif(btrim(coalesce(_observacao, '')), ''), ''), 300),
         conferido_em = case when round(_contado, 2) = v_esp then now() end
   where id = t.id;
  return jsonb_build_object('situacao', 'fechado', 'turno', public._resumo_turno(t.id));
end $$;
revoke all on function public.fechar_caixa_dono(uuid, numeric, text) from public, anon;
grant execute on function public.fechar_caixa_dono(uuid, numeric, text) to authenticated, service_role;
