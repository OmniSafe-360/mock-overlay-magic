-- A6 (checklist funcional 3): o dono cancela pelo app uma venda do caixa do celular com o caixa ainda aberto.
-- Antes: o fechamento deixava de contar o dinheiro da venda cancelada, mas ninguém avisava o caixa para devolver ao
-- cliente; o dinheiro ficava na gaveta e aparecia "sobra". Decisão do dono (17/10/2026): o caixa devolve, da gaveta.
-- Agora, com o caixa aberto:
--  * o caixa vê a venda como cancelada pelo dono e quanto devolver da gaveta (caixa_estado: cancelada_por, devolver_gaveta);
--    o dinheiro da venda já sai da conta do fechamento (como antes) e, devolvido ao cliente, a gaveta bate;
--  * o que o cliente já tinha pago desta venda no fiado também é devolvido pelo caixa: fica registrado como dinheiro
--    tirado da gaveta (mesmo id fixo da A5, nunca duas vezes);
--  * a resposta para o dono diz se o caixa foi avisado e quanto ele vai devolver; repetir devolve os mesmos números.
-- Caixa já fechado: nada muda (o fechamento já foi contado). Sem tabela nova.
do $$
begin
  if md5(pg_get_functiondef('public.cancelar_venda_celular(uuid,text)'::regprocedure)) <> '72753dff676cc6f8c27c1fdef741e5e6'
     or md5(pg_get_functiondef('public.caixa_estado(text)'::regprocedure)) <> 'f4fde1536d60ae52f1f6407134b9f665' then
    raise exception 'versao_inesperada: funções do cancelamento mudaram desde a conferência';
  end if;
end $$;

/* Quanto o caixa devolve da gaveta numa venda cancelada pelo dono: dinheiro da venda (menos o troco) + o que
   o cliente já tinha pago no fiado e foi tirado da gaveta. */
create function public._devolver_gaveta_venda(_venda uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(0, coalesce((select sum((p->>'valor')::numeric) from jsonb_array_elements(vd.pagamentos) p where p->>'forma' = 'dinheiro'), 0)
                     - coalesce(vd.troco, 0))
       + coalesce((select valor from caixa_sangrias where id = md5('a5-devolucao-fiado:' || vd.id::text)::uuid), 0)
    from vendas vd where vd.id = _venda
$$;
revoke all on function public._devolver_gaveta_venda(uuid) from public, anon, authenticated;
grant execute on function public._devolver_gaveta_venda(uuid) to service_role;

create or replace function public.cancelar_venda_celular(_venda uuid, _motivo text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare vd vendas%rowtype; v_devolver numeric; t caixa_turnos%rowtype; v_aberto boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended(_venda::text, 0));
  select * into vd from vendas where id = _venda and origem = 'celular' for update;
  if not found or not public.pode_acessar_comercio(vd.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  -- A6: o caixa desta venda ainda está aberto? Trava o turno, como o fechamento faz.
  if vd.turno_id is not null then
    select * into t from caixa_turnos where id = vd.turno_id for update;
    v_aberto := found and t.situacao = 'aberto';
  end if;
  if vd.situacao = 'cancelada' then
    select coalesce(sum(case tipo when 'compra' then valor when 'cancelamento' then -valor else 0 end), 0) into v_devolver
      from fiado_movimentos where venda_id = vd.id;
    return jsonb_build_object('situacao', 'repetida', 'venda', vd.id, 'devolver', v_devolver,
      'caixa_aberto', v_aberto and vd.cancelada_por = 'dono',
      'devolver_gaveta', case when v_aberto and vd.cancelada_por = 'dono' then public._devolver_gaveta_venda(vd.id) else 0 end);
  end if;
  perform public._cancelar_venda_celular(vd.id, 'dono', _motivo);
  select coalesce(sum(case tipo when 'compra' then valor when 'cancelamento' then -valor else 0 end), 0) into v_devolver
    from fiado_movimentos where venda_id = vd.id;
  -- A6: com o caixa aberto, quem devolve é o caixa; o que já foi pago no fiado sai da gaveta.
  if v_aberto and v_devolver > 0 then
    insert into caixa_sangrias (id, comercio_id, turno_id, funcionario_id, valor, motivo)
    values (md5('a5-devolucao-fiado:' || vd.id::text)::uuid, vd.comercio_id, t.id, t.funcionario_id, v_devolver,
            left('Devolvido ao cliente do fiado (venda nº ' || coalesce(vd.numero::text, '?') || ' cancelada pelo dono)', 120))
    on conflict (id) do nothing;
  end if;
  return jsonb_build_object('situacao', 'cancelada', 'venda', vd.id, 'devolver', v_devolver,
    'caixa_aberto', v_aberto,
    'devolver_gaveta', case when v_aberto then public._devolver_gaveta_venda(vd.id) else 0 end);
end $function$;

do $$
declare
  v_def text := pg_get_functiondef('public.caixa_estado(text)'::regprocedure);
  a text := $a$'troco', vd.troco, 'cliente',$a$;
  b text := $b$'troco', vd.troco, 'cancelada_por', vd.cancelada_por,
        'devolver_gaveta', case when vd.situacao = 'cancelada' and vd.cancelada_por = 'dono' then public._devolver_gaveta_venda(vd.id) end,
        'cliente',$b$;
begin
  if (length(v_def) - length(replace(v_def, a, ''))) / length(a) <> 1 then
    raise exception 'versao_inesperada: trecho de caixa_estado não encontrado uma única vez';
  end if;
  execute replace(v_def, a, b);
end $$;
