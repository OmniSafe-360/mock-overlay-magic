-- Embalagens de compra (caixa, fardo, pacote, display, saco). Aprovado pelo dono em 09/10/2026.
-- O estoque continua em unidades de venda; a embalagem diz quantas unidades vêm dentro.
-- Gravação só pela função salvar_cadastro (mesma transação do produto). Loja de roupas fica para depois.

create table public.produto_embalagens (
  id uuid primary key,                       -- gerado no app; reaproveitado ao repetir o envio
  comercio_id uuid not null,
  produto_id uuid not null,
  tipo text not null check (tipo in ('Caixa', 'Fardo', 'Pacote', 'Display', 'Saco')),
  quantidade numeric(14,3) not null check (quantidade > 0),   -- unidades de venda dentro da embalagem
  codigo_barras text check (codigo_barras is null or char_length(codigo_barras) between 1 and 64),
  preco_compra numeric(12,2) check (preco_compra is null or preco_compra > 0),   -- preço da embalagem inteira
  removida_em timestamptz,                   -- remoção sem apagar histórico
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id) on delete cascade);
create index produto_embalagens_produto_idx on public.produto_embalagens (produto_id);
create index produto_embalagens_comercio_idx on public.produto_embalagens (comercio_id);

alter table public.produto_embalagens enable row level security;
revoke all on public.produto_embalagens from public, anon, authenticated;
grant select on public.produto_embalagens to authenticated;
grant all on public.produto_embalagens to service_role;
create policy "acesso ve embalagens" on public.produto_embalagens for select to authenticated
  using (public.pode_acessar_comercio(comercio_id));

-- Código da embalagem entra na lista única de códigos do comércio.
alter table public.codigos_barras add column embalagem_id uuid;

create or replace function public.sync_codigo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e_var boolean := tg_table_name = 'produto_variacoes';
  e_emb boolean := tg_table_name = 'produto_embalagens';
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  o_cod text := case when o->>'removida_em' is null then o->>'codigo_barras' end;
  n_cod text := case when n->>'removida_em' is null then n->>'codigo_barras' end;
begin
  if o_cod is not distinct from n_cod then return coalesce(new, old); end if;
  if o_cod is not null then
    delete from codigos_barras where comercio_id = (o->>'comercio_id')::uuid and codigo = o_cod; end if;
  if n_cod is not null then
    begin
      insert into codigos_barras (comercio_id, codigo, produto_id, variacao_id, embalagem_id)
      values ((n->>'comercio_id')::uuid, n_cod,
        (case when e_var or e_emb then n->>'produto_id' else n->>'id' end)::uuid,
        (case when e_var then n->>'id' end)::uuid,
        (case when e_emb then n->>'id' end)::uuid);
    exception when unique_violation then
      raise exception 'codigo_em_uso: %', n_cod using errcode = '23505';
    end;
  end if;
  return coalesce(new, old);
end $$;
create trigger embalagens_codigo after insert or update or delete on public.produto_embalagens
  for each row execute function public.sync_codigo();

-- Lista completa das embalagens ativas do produto (as que faltarem são removidas).
create function public._salvar_embalagens(_com uuid, _prod uuid, _lista jsonb) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_un text; v_cod_prod text; v_tipo tipo_comercio; x jsonb; v_id uuid; e record; v_existe boolean;
  v_q numeric; v_cod text; v_preco numeric; v_ids uuid[] := '{}'; v_n int := 0;
begin
  if jsonb_typeof(_lista) <> 'array' then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
  select p.unidade, p.codigo_barras, c.tipo into v_un, v_cod_prod, v_tipo
    from produtos p join comercios c on c.id = p.comercio_id where p.id = _prod and p.comercio_id = _com;
  if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
  if jsonb_array_length(_lista) > 5 then raise exception 'embalagens_demais' using errcode = '23514'; end if;
  if v_tipo = 'loja_roupas' and jsonb_array_length(_lista) > 0 then raise exception 'roupas_sem_embalagem' using errcode = '23514'; end if;
  if exists (select 1 from jsonb_array_elements(_lista) a group by a->>'tipo', (a->>'quantidade')::numeric having count(*) > 1) then
    raise exception 'embalagem_repetida' using errcode = '23514'; end if;

  for x in select * from jsonb_array_elements(_lista) loop
    v_id := (x->>'id')::uuid;
    if v_id is null then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
    select * into e from produto_embalagens where id = v_id for update;
    v_existe := found;
    if v_existe and (e.produto_id <> _prod or e.comercio_id <> _com) then
      raise exception 'embalagem_de_outro_produto' using errcode = '42501'; end if;
    if v_existe and e.removida_em is not null then raise exception 'embalagem_removida' using errcode = '23514'; end if;
    if not (coalesce(x->>'tipo', '') = any ('{Caixa,Fardo,Pacote,Display,Saco}'::text[])) then
      raise exception 'tipo_de_embalagem_invalido: %', x->>'tipo' using errcode = '23514'; end if;
    v_q := public.qtd_valida((x->>'quantidade')::numeric, v_un, false);
    v_cod := nullif(btrim(coalesce(x->>'codigo_barras', '')), '');
    if v_cod is not null and v_cod = btrim(coalesce(v_cod_prod, '')) then
      raise exception 'codigo_igual_ao_principal' using errcode = '23514'; end if;
    if v_cod is not null and exists (select 1 from codigos_barras where comercio_id = _com and codigo = v_cod
       and embalagem_id is distinct from v_id) then
      raise exception 'codigo_em_uso: %', v_cod using errcode = '23505'; end if;
    v_preco := (x->>'preco_compra')::numeric;
    if v_preco is not null and v_preco <= 0 then raise exception 'preco_da_embalagem_invalido' using errcode = '23514'; end if;
    if v_existe then
      update produto_embalagens set tipo = x->>'tipo', quantidade = v_q, codigo_barras = v_cod, preco_compra = v_preco, updated_at = now()
       where id = v_id;
    else
      insert into produto_embalagens (id, comercio_id, produto_id, tipo, quantidade, codigo_barras, preco_compra)
      values (v_id, _com, _prod, x->>'tipo', v_q, v_cod, v_preco);
    end if;
    v_ids := v_ids || v_id; v_n := v_n + 1;
  end loop;
  update produto_embalagens set removida_em = now(), updated_at = now()
   where produto_id = _prod and removida_em is null and not (id = any (v_ids));
  return v_n;
end $$;
revoke execute on function public._salvar_embalagens(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public._salvar_embalagens(uuid, uuid, jsonb) to service_role;

-- salvar_cadastro passa a gravar as embalagens na mesma transação (só quando o pedido traz a lista).
create or replace function public.salvar_cadastro(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_op uuid := (p->>'operacao_id')::uuid;
  pp jsonb := p->'produto_pedido';
  v_com uuid := (pp->'produto'->>'comercio_id')::uuid;
  v_id uuid := (pp->'produto'->>'id')::uuid;
  v_prev jsonb; r jsonb; x jsonb; v_n int := 0; v_emb int;
begin
  if pp is null or jsonb_typeof(pp) <> 'object' then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
  v_prev := public._iniciar_operacao(v_op, v_com, v_id, 'salvar_cadastro', md5((p - 'operacao_id')::text));
  if v_prev is not null then return v_prev; end if;

  r := public.salvar_produto(pp);
  if jsonb_typeof(pp->'embalagens') = 'array' then
    v_emb := public._salvar_embalagens(v_com, v_id, pp->'embalagens');
  end if;
  for x in select * from jsonb_array_elements(coalesce(p->'pendencias', '[]')) loop
    perform public.resolver_pendencia(jsonb_strip_nulls(jsonb_build_object(
      'operacao_id', x->'operacao_id', 'comercio_id', v_com, 'produto_id', v_id,
      'origem_id', x->'origem_id', 'partes', x->'partes',
      'confirmar_vencimento', case when (x->>'confirmar_vencimento')::boolean is true then true end)));
    v_n := v_n + 1;
  end loop;

  v_prev := r || jsonb_build_object('pendencias_resolvidas', v_n) || case when v_emb is null then '{}'::jsonb else jsonb_build_object('embalagens', v_emb) end;
  update operacoes set resultado = v_prev where id = v_op;
  return v_prev;
end $$;
