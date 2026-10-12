ALTER TABLE public.clientes_fiado ADD COLUMN IF NOT EXISTS limite numeric(12,2), ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public._conferir_limite_fiado()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
declare cl clientes_fiado%rowtype; v_deve numeric;
begin
  if new.tipo <> 'compra' then return new; end if;
  select * into cl from clientes_fiado where id = new.cliente_id for update;
  if cl.bloqueado then raise exception 'cliente_fiado_bloqueado' using errcode = 'P0001'; end if;
  if cl.limite is not null then
    select coalesce(sum(case when tipo = 'compra' then valor else -valor end), 0) into v_deve from fiado_movimentos where cliente_id = cl.id;
    if greatest(v_deve, 0) + new.valor > cl.limite then raise exception 'limite_fiado_excedido' using errcode = 'P0001'; end if;
  end if;
  return new;
end $function$;
REVOKE ALL ON FUNCTION public._conferir_limite_fiado() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS fiado_limite_antes ON public.fiado_movimentos;
CREATE TRIGGER fiado_limite_antes BEFORE INSERT ON public.fiado_movimentos FOR EACH ROW EXECUTE FUNCTION public._conferir_limite_fiado();

CREATE OR REPLACE FUNCTION public.definir_limite_fiado(_cliente uuid, _limite numeric, _bloqueado boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
declare cl clientes_fiado%rowtype;
begin
  select * into cl from clientes_fiado where id = _cliente for update;
  if not found or not public.pode_acessar_comercio(cl.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if _limite is not null and (_limite < 0 or _limite > 1000000) then raise exception 'valor_invalido' using errcode = '22023'; end if;
  update clientes_fiado set limite = round(_limite, 2), bloqueado = coalesce(_bloqueado, false) where id = cl.id;
end $function$;
REVOKE ALL ON FUNCTION public.definir_limite_fiado(uuid, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_limite_fiado(uuid, numeric, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.caixa_clientes_fiado(_chave text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype;
begin
  v := public._funcionario_caixa(_chave);
  return coalesce((
    with m as (
      select cliente_id, criado_em, id,
        sum(case when tipo = 'compra' then valor else -valor end)
          over (partition by cliente_id order by criado_em, id) saldo
      from fiado_movimentos where comercio_id = v.comercio_id
    ), zero as (
      select cliente_id, max(criado_em) ate from m where saldo <= 0 group by cliente_id
    ), res as (
      select c.id,
        greatest(coalesce((select m2.saldo from m m2 where m2.cliente_id = c.id order by m2.criado_em desc, m2.id desc limit 1), 0), 0) deve,
        (select min(m3.criado_em) from m m3 left join zero z on z.cliente_id = m3.cliente_id
          where m3.cliente_id = c.id and (z.ate is null or m3.criado_em > z.ate)) desde
      from clientes_fiado c where c.comercio_id = v.comercio_id and c.ativo
    )
    select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'telefone', c.telefone,
      'deve', r.deve, 'desde', case when r.deve > 0 then r.desde end,
      'limite', c.limite, 'bloqueado', c.bloqueado) order by c.nome)
    from clientes_fiado c join res r on r.id = c.id
  ), '[]');
end $function$;