-- A5 (checklist funcional 3): gaveta com falta falsa.
-- Ao cancelar no caixa uma venda de fiado que o cliente já tinha pago (em parte ou toda), o app manda devolver
-- esse valor ao cliente ("Devolva R$ X"), e o dinheiro sai da gaveta. Mas o fechamento não descontava essa saída:
-- o "deveria ter" ficava maior que o dinheiro na gaveta e aparecia uma falta que não existe.
-- Agora a devolução fica registrada como dinheiro tirado da gaveta (caixa_sangrias, com o motivo) no caixa aberto
-- de quem cancelou, na mesma transação. O fechamento já desconta o que foi tirado. Repetir o cancelamento não
-- registra de novo (a venda já cancelada volta "repetida" antes). Sem tabela nova; só esta função muda.
do $$
declare
  v_def text := pg_get_functiondef('public.caixa_cancelar_venda(text,uuid,text,text)'::regprocedure);
  a text := $a$  return jsonb_build_object('situacao', 'cancelada', 'venda', vd.id, 'devolver', v_devolver);$a$;
  b text := $b$  -- A5: a devolução ao cliente do fiado sai da gaveta do caixa aberto de quem cancelou.
  v_gaveta := false;
  if v_devolver > 0 then
    select * into t from caixa_turnos where funcionario_id = v.id and comercio_id = v.comercio_id and situacao = 'aberto' for update;
    if found then
      insert into caixa_sangrias (id, comercio_id, turno_id, funcionario_id, valor, motivo)
      values (gen_random_uuid(), v.comercio_id, t.id, v.id, v_devolver,
              left('Devolvido ao cliente do fiado (venda nº ' || coalesce(vd.numero::text, '?') || ' cancelada)', 120));
      v_gaveta := true;
    end if;
  end if;
  return jsonb_build_object('situacao', 'cancelada', 'venda', vd.id, 'devolver', v_devolver, 'gaveta', v_gaveta);$b$;
  a2 text := $a$declare v funcionarios%rowtype; vd vendas%rowtype; v_erro text; v_devolver numeric;$a$;
  b2 text := $b$declare v funcionarios%rowtype; vd vendas%rowtype; v_erro text; v_devolver numeric; t caixa_turnos%rowtype; v_gaveta boolean;$b$;
begin
  if md5(v_def) <> 'c8efe1abd466462e5a3904da008f5222' then
    raise exception 'versao_inesperada: caixa_cancelar_venda mudou desde a conferência';
  end if;
  if (length(v_def) - length(replace(v_def, a, ''))) / length(a) <> 1
     or (length(v_def) - length(replace(v_def, a2, ''))) / length(a2) <> 1 then
    raise exception 'versao_inesperada: trecho de caixa_cancelar_venda não encontrado uma única vez';
  end if;
  execute replace(replace(v_def, a, b), a2, b2);
end $$;
