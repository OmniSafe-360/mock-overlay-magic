-- A5, ajuste do Codex no PR #192: se a resposta do cancelamento se perder e o caixa repetir o envio, a resposta
-- "repetida" agora devolve o mesmo valor a devolver e se saiu da gaveta, para o aviso "Tire R$ X da gaveta e devolva"
-- aparecer de novo. A saída da gaveta passa a ter um id fixo por venda (nunca registra duas vezes).
do $$
declare
  v_def text := pg_get_functiondef('public.caixa_cancelar_venda(text,uuid,text,text)'::regprocedure);
  a1 text := $a$  if vd.situacao = 'cancelada' then return jsonb_build_object('situacao', 'repetida'); end if;$a$;
  b1 text := $b$  if vd.situacao = 'cancelada' then
    select coalesce(sum(case tipo when 'compra' then valor when 'cancelamento' then -valor else 0 end), 0) into v_devolver
      from fiado_movimentos where venda_id = vd.id;
    return jsonb_build_object('situacao', 'repetida', 'venda', vd.id, 'devolver', v_devolver,
      'gaveta', exists (select 1 from caixa_sangrias where id = md5('a5-devolucao-fiado:' || vd.id::text)::uuid));
  end if;$b$;
  a2 text := $a$      values (gen_random_uuid(), v.comercio_id, t.id, v.id, v_devolver,
              left('Devolvido ao cliente do fiado (venda nº ' || coalesce(vd.numero::text, '?') || ' cancelada)', 120));$a$;
  b2 text := $b$      values (md5('a5-devolucao-fiado:' || vd.id::text)::uuid, v.comercio_id, t.id, v.id, v_devolver,
              left('Devolvido ao cliente do fiado (venda nº ' || coalesce(vd.numero::text, '?') || ' cancelada)', 120))
      on conflict (id) do nothing;$b$;
begin
  if md5(v_def) <> '7a4a39ecb28891887853be3ae9d8e7ba' then
    raise exception 'versao_inesperada: caixa_cancelar_venda mudou desde a conferência';
  end if;
  if (length(v_def) - length(replace(v_def, a1, ''))) / length(a1) <> 1
     or (length(v_def) - length(replace(v_def, a2, ''))) / length(a2) <> 1 then
    raise exception 'versao_inesperada: trecho de caixa_cancelar_venda não encontrado uma única vez';
  end if;
  execute replace(replace(v_def, a1, b1), a2, b2);
end $$;
