-- Aplicada no Supabase oficial em 16/10/2026 (versão 20261016131458), depois de conferir os 5 md5 e simular com rollback.
-- Reversão: docs/persistencia/016_comercio_desativado_reverter.sql. Registro: docs/comercio-desativado-2026-10-14.md.
DO $migr$
declare
  linha constant text := E'  if not exists (select 1 from comercios where id = v.comercio_id and ativo) then raise exception ''comercio_desativado'' using errcode = ''42501''; end if;\n';
  alvo record;
  d text;
  n int;
  novos text[] := '{}';
begin
  -- ===== Fase 1: conferir as 5 funções, sem alterar nada =====
  for alvo in
    select * from (values
      (1, 'public._funcionario_da_chave(text)', '2dac2c308a1353655b9edd2a5d7c4142',
          E'  if a.desbloqueado_ate is null or a.desbloqueado_ate < now() then raise exception ''pin_necessario''', 'inserir'),
      (2, 'public.conferir_codigo_funcionario(text)', '3c9142aa6f7c603e5f40b034a44565ac',
          E'  if v.pin_hash is null then\n    if v.codigo_gerado_em < now() - interval ''48 hours'' then return ''expirado''', 'inserir'),
      (3, 'public.entrar_funcionario(text,text,text)', '317ea1ffc7d0b8d145e32baf9f7bd82a',
          E'  if v.travado_ate is not null and v.travado_ate > now() then', 'inserir'),
      (4, 'public.funcionario_desbloquear(text,text)', '3c25e1b2aa53a250d4b368fb1232c8fe',
          E'  if v.travado_ate is not null and v.travado_ate > now() then', 'inserir'),
      (5, 'public.funcionario_inicio(text)', 'a007058075eb8c944773dc84d51440b8',
          E'    return null;\n  end;', 'repassar')
    ) as t(ordem, fn, md5_esperado, ancora, modo)
    order by ordem
  loop
    d := pg_get_functiondef(alvo.fn::regprocedure);
    if md5(d) <> alvo.md5_esperado then
      raise exception 'compatibilidade: % diferente da versão conferida (md5 %); nada foi alterado', alvo.fn, md5(d);
    end if;
    n := (length(d) - length(replace(d, alvo.ancora, ''))) / length(alvo.ancora);
    if n <> 1 then
      raise exception 'compatibilidade: trecho de % aparece % vezes (esperado 1); nada foi alterado', alvo.fn, n;
    end if;
    if position('comercio_desativado' in d) > 0 then
      raise exception 'compatibilidade: % já tem a correção; nada foi alterado', alvo.fn;
    end if;
    if alvo.modo = 'inserir' then
      novos := novos || replace(d, alvo.ancora, linha || alvo.ancora);
    else
      novos := novos || replace(d, alvo.ancora, E'    if sqlerrm = ''comercio_desativado'' then raise; end if;\n' || alvo.ancora);
    end if;
  end loop;

  -- ===== Fase 2: aplicar (só chega aqui se as 5 passaram) =====
  for n in 1 .. array_length(novos, 1) loop
    execute novos[n];
  end loop;

  -- ===== Fase 3: conferir o resultado =====
  for alvo in select unnest(array['public._funcionario_da_chave(text)','public.conferir_codigo_funcionario(text)',
      'public.entrar_funcionario(text,text,text)','public.funcionario_desbloquear(text,text)','public.funcionario_inicio(text)']) as fn
  loop
    d := pg_get_functiondef(alvo.fn::regprocedure);
    if (length(d) - length(replace(d, 'comercio_desativado', ''))) / length('comercio_desativado') <> 1 then
      raise exception 'conferência final: % não ficou com a correção exatamente 1 vez; tudo desfeito', alvo.fn;
    end if;
  end loop;
end $migr$;
