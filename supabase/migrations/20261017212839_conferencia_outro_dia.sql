-- B9 (checklist funcional 3): a contagem do depósito começada em outro dia recomeça do zero.
-- A versão da contagem cega (C5/C6) passou a retomar a contagem aberta de qualquer dia, com as contagens antigas
-- (item 8 do checklist 1 dizia: não misturar contagens de dias diferentes). Não dá para só esconder a antiga,
-- porque ela impede abrir outra (contagem_em_andamento). Então o mesmo registro é reaproveitado:
-- a lista mostra "Contagem 1" e, na primeira contagem do dia novo, as tentativas antigas são apagadas e o início vira agora.
-- Só trechos conferidos das duas funções mudam; SECURITY DEFINER, search_path e permissões iguais.
do $$
declare
  l text := pg_get_functiondef('public.funcionario_conferencia_lista(text)'::regprocedure);
  c text := pg_get_functiondef('public.funcionario_conferencia_contar(text,uuid,uuid,uuid,numeric,integer)'::regprocedure);
  l1 text := $x$'rodada', (select jsonb_array_length(cf.tentativas) + 1 from conferencias cf where cf.id = x.aberta)$x$;
  m1 text := $x$'rodada', (select case when (cf.created_at at time zone 'America/Sao_Paulo')::date < v_hoje then 1 else jsonb_array_length(cf.tentativas) + 1 end from conferencias cf where cf.id = x.aberta)$x$;
  c1 text := $x$    raise exception 'conferencia_de_outro_produto' using errcode = '42501';
  end if;$x$;
  d1 text := $x$    raise exception 'conferencia_de_outro_produto' using errcode = '42501';
  end if;
  -- B9: contagem começada em outro dia recomeça do zero, sem misturar dias.
  if cf.id is not null and cf.situacao = 'contando'
     and (cf.created_at at time zone 'America/Sao_Paulo')::date < (now() at time zone 'America/Sao_Paulo')::date then
    update conferencias set tentativas = '[]'::jsonb, esperado = null, contado = null, created_at = now(), funcionario_id = v.id
     where id = cf.id returning * into cf;
  end if;$x$;
begin
  if md5(l) <> 'c27c17ce10a07732949efc2d780f5119' then raise exception 'versao_inesperada: funcionario_conferencia_lista mudou'; end if;
  if md5(c) <> '6c4fbe6cea6aa1124a77d57d137c34d5' then raise exception 'versao_inesperada: funcionario_conferencia_contar mudou'; end if;
  if (length(l) - length(replace(l, l1, ''))) / length(l1) <> 1 or (length(c) - length(replace(c, c1, ''))) / length(c1) <> 1 then
    raise exception 'versao_inesperada: trecho não encontrado uma única vez';
  end if;
  execute replace(l, l1, m1);
  execute replace(c, c1, d1);
end $$;

notify pgrst, 'reload schema';
