-- REVERSÃO da Correção de segurança 1 — volta as 5 funções exatamente como eram.
-- Mesmo cuidado da aplicação: um único comando (atômico), confere as 5 ANTES de alterar,
-- e no fim confere que cada uma voltou à impressão digital (md5) original do banco real.

DO $rev$
declare
  linha constant text := E'  if not exists (select 1 from comercios where id = v.comercio_id and ativo) then raise exception ''comercio_desativado'' using errcode = ''42501''; end if;\n';
  repassa constant text := E'    if sqlerrm = ''comercio_desativado'' then raise; end if;\n';
  alvo record;
  d text;
  trecho text;
  n int;
  novos text[] := '{}';
  fns text[] := '{}';
  hashes text[] := '{}';
begin
  -- ===== Fase 1: conferir as 5, sem alterar nada =====
  for alvo in
    select * from (values
      (1, 'public._funcionario_da_chave(text)', '2dac2c308a1353655b9edd2a5d7c4142', 'linha'),
      (2, 'public.conferir_codigo_funcionario(text)', '3c9142aa6f7c603e5f40b034a44565ac', 'linha'),
      (3, 'public.entrar_funcionario(text,text,text)', '317ea1ffc7d0b8d145e32baf9f7bd82a', 'linha'),
      (4, 'public.funcionario_desbloquear(text,text)', '3c25e1b2aa53a250d4b368fb1232c8fe', 'linha'),
      (5, 'public.funcionario_inicio(text)', 'a007058075eb8c944773dc84d51440b8', 'repassa')
    ) as t(ordem, fn, md5_original, tipo)
    order by ordem
  loop
    d := pg_get_functiondef(alvo.fn::regprocedure);
    trecho := case alvo.tipo when 'linha' then linha else repassa end;
    n := (length(d) - length(replace(d, trecho, ''))) / length(trecho);
    if n <> 1 then
      raise exception 'reversão: % tem a correção % vezes (esperado 1); nada foi alterado', alvo.fn, n;
    end if;
    if md5(replace(d, trecho, '')) <> alvo.md5_original then
      raise exception 'reversão: % mudou além da correção; nada foi alterado', alvo.fn;
    end if;
    novos := novos || replace(d, trecho, '');
    fns := fns || alvo.fn;
    hashes := hashes || alvo.md5_original;
  end loop;

  -- ===== Fase 2: aplicar =====
  for n in 1 .. array_length(novos, 1) loop
    execute novos[n];
  end loop;

  -- ===== Fase 3: conferir que voltaram ao original =====
  for n in 1 .. array_length(fns, 1) loop
    if md5(pg_get_functiondef(fns[n]::regprocedure)) <> hashes[n] then
      raise exception 'reversão: % não voltou ao original; tudo desfeito', fns[n];
    end if;
  end loop;
end $rev$;
