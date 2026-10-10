-- Mercado: UPC-A e EAN-13 com zero inicial representam o mesmo item.
-- Preserva códigos originais, produtos, embalagens, saldos e histórico.
-- Não interpreta balanças, UPC-E nem códigos de 14 dígitos.

create function public.ean_upc_mercado(_codigo text) returns text
language plpgsql immutable strict set search_path = public, pg_temp as $$
declare c text := btrim(_codigo); soma integer := 0; n integer; i integer;
begin
  if c !~ '^[0-9]{12,13}$' then return null; end if;
  n := length(c);
  for i in 1..n-1 loop
    soma := soma + substr(c,i,1)::integer * case when (n-i)%2=1 then 3 else 1 end;
  end loop;
  if (10-soma%10)%10 <> right(c,1)::integer then return null; end if;
  return lpad(c,13,'0');
end $$;

-- Um índice único, e não apenas uma consulta prévia, protege envios simultâneos.
alter table public.codigos_barras add column ean_upc_mercado text;

-- Recusa a migração se houver equivalentes antigos. Nada é juntado nem apagado.
do $$
begin
  if exists (
    select 1 from public.codigos_barras cb join public.comercios c on c.id=cb.comercio_id
    where c.tipo='mercado' and public.ean_upc_mercado(cb.codigo) is not null
    group by cb.comercio_id, public.ean_upc_mercado(cb.codigo) having count(*)>1
  ) then
    raise exception 'codigos_ean_upc_equivalentes_existentes: revisar os códigos do Mercado antes de aplicar' using errcode='23505';
  end if;
end $$;

update public.codigos_barras cb set ean_upc_mercado=public.ean_upc_mercado(cb.codigo)
from public.comercios c where c.id=cb.comercio_id and c.tipo='mercado';

create unique index codigos_barras_mercado_ean_upc_uidx
on public.codigos_barras(comercio_id,ean_upc_mercado) where ean_upc_mercado is not null;

create function public.sync_ean_upc_mercado() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Ignora qualquer valor de comparação fornecido pelo chamador.
  new.ean_upc_mercado := case when exists (select 1 from public.comercios c where c.id=new.comercio_id and c.tipo='mercado')
    then public.ean_upc_mercado(new.codigo) else null end;
  return new;
end $$;
create trigger codigos_mercado_ean_upc before insert or update on public.codigos_barras
for each row execute function public.sync_ean_upc_mercado();

-- Mantém a comparação coerente se um comércio sem restrição própria mudar de tipo.
create function public.sync_tipo_ean_upc_mercado() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.tipo is distinct from old.tipo then
    update public.codigos_barras set ean_upc_mercado=null where comercio_id=new.id;
  end if;
  return new;
end $$;
create trigger comercio_tipo_ean_upc after update of tipo on public.comercios
for each row execute function public.sync_tipo_ean_upc_mercado();

-- A chave/PIN continua sendo conferida antes de procurar qualquer produto.
create or replace function public.funcionario_buscar_produto(_chave text, _texto text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; t text := btrim(coalesce(_texto,''));
begin
  v := public._funcionario_da_chave(_chave);
  if char_length(t)<2 then return '[]'::jsonb; end if;
  if t ~ '^[0-9]+$' then
    return coalesce((select jsonb_agg(public._produto_para_funcionario(cb.produto_id,cb.variacao_id,cb.embalagem_id))
      from codigos_barras cb join produtos p on p.id=cb.produto_id and p.ativo
      where cb.comercio_id=v.comercio_id and (cb.codigo=t or cb.ean_upc_mercado=public.ean_upc_mercado(t))), '[]'::jsonb);
  end if;
  return coalesce((select jsonb_agg(public._produto_para_funcionario(x.pid,x.vid,null)) from (
    select p.id pid,pv.id vid from produtos p left join produto_variacoes pv on pv.produto_id=p.id and pv.removida_em is null
    where p.comercio_id=v.comercio_id and p.ativo and p.nome ilike '%'||replace(replace(t,'%',''),'_','')||'%'
    order by p.nome,pv.tamanho,pv.cor limit 12) x), '[]'::jsonb);
end $$;

-- Mantém a prioridade de um vínculo explícito do caixa, depois EAN da nota, depois código do caixa.
create or replace function public._achar_item_venda(_com uuid,_codigo text,_ean text,
  out produto_id uuid,out variacao_id uuid,out embalagem_id uuid,out ignorar boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  select m.produto_id,m.variacao_id,m.embalagem_id,m.ignorar into produto_id,variacao_id,embalagem_id,ignorar
    from codigos_pdv m where m.comercio_id=_com and m.codigo=_codigo;
  if found then return; end if;
  ignorar := false;
  select cb.produto_id,cb.variacao_id,cb.embalagem_id into produto_id,variacao_id,embalagem_id
    from codigos_barras cb where cb.comercio_id=_com and _ean is not null
    and (cb.codigo=_ean or cb.ean_upc_mercado=public.ean_upc_mercado(_ean));
  if found then return; end if;
  select cb.produto_id,cb.variacao_id,cb.embalagem_id into produto_id,variacao_id,embalagem_id
    from codigos_barras cb where cb.comercio_id=_com
    and (cb.codigo=_codigo or cb.ean_upc_mercado=public.ean_upc_mercado(_codigo));
end $$;

-- Funções internas continuam fora do acesso do navegador. RPCs existentes mantêm seus grants.
revoke all on function public.ean_upc_mercado(text),public.sync_ean_upc_mercado(),public.sync_tipo_ean_upc_mercado()
from public,anon,authenticated;
grant execute on function public.ean_upc_mercado(text),public.sync_ean_upc_mercado(),public.sync_tipo_ean_upc_mercado() to service_role;
