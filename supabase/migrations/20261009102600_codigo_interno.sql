-- Código interno para produto sem código de barras (aprovado pelo dono em 09/10/2026).
-- Formato EAN-13: "29" + sequência de 10 dígitos + dígito verificador. Prefixo 2 = uso interno da loja (GS1),
-- nunca colide com código de fábrica (Brasil: 789/790). Sequência própria de cada comércio.

alter table public.comercios
  add column proximo_codigo_interno bigint not null default 1 check (proximo_codigo_interno >= 1);

create function public.gerar_codigo_interno(_comercio uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n bigint; v_base text; v_cod text; v_soma int; i int;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  if not public.pode_acessar_comercio(_comercio) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  loop
    -- A linha do comércio fica travada até o fim da transação: dois pedidos ao mesmo tempo nunca recebem o mesmo número.
    update comercios set proximo_codigo_interno = proximo_codigo_interno + 1
     where id = _comercio returning proximo_codigo_interno - 1 into v_n;
    if v_n > 9999999999 then raise exception 'codigos_internos_esgotados' using errcode = '54000'; end if;
    v_base := '29' || lpad(v_n::text, 10, '0');
    v_soma := 0;
    for i in 1..12 loop
      v_soma := v_soma + substr(v_base, i, 1)::int * (case when i % 2 = 0 then 3 else 1 end);
    end loop;
    v_cod := v_base || ((10 - v_soma % 10) % 10)::text;
    -- Pula número já usado no comércio (ex.: digitado à mão).
    exit when not exists (select 1 from codigos_barras where comercio_id = _comercio and codigo = v_cod);
  end loop;
  return v_cod;
end $$;
revoke execute on function public.gerar_codigo_interno(uuid) from public, anon;
grant execute on function public.gerar_codigo_interno(uuid) to authenticated, service_role;
