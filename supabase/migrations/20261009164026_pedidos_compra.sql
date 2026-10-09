-- Etapa D2a: pedido de compra (desenho aprovado pelo dono em 09/10/2026, com link para o fornecedor e controle de pagamento).
-- O pedido não mexe no estoque: o estoque só aumenta no recebimento (app do funcionário, etapa D3).
-- Leitura pela segurança por linha (RLS); gravação só pelas funções abaixo. As funções do link do fornecedor vêm na D2b.

alter table public.comercios add column if not exists proximo_numero_pedido bigint not null default 1;

create table public.pedidos_compra (
  id uuid primary key,
  comercio_id uuid not null references public.comercios(id),
  fornecedor_id uuid not null references public.fornecedores(id),
  numero bigint not null,
  situacao text not null default 'rascunho'
    check (situacao in ('rascunho', 'enviado', 'aceito', 'aceito_ajustes', 'recusado', 'recebido_parcial', 'recebido', 'cancelado')),
  canal text check (canal in ('whatsapp', 'email', 'copiado')),
  enviado_em timestamptz,
  observacao text check (observacao is null or char_length(observacao) <= 500),
  -- Link secreto do fornecedor (D2b): 64 caracteres aleatórios; trocar o link invalida o antigo.
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  -- Resposta do fornecedor (D2b).
  resposta_em timestamptz,
  previsao_entrega date,
  valor_total numeric(12,2) check (valor_total is null or valor_total >= 0),
  forma_pagamento text check (forma_pagamento in ('a_vista', 'pix', 'boleto', 'a_prazo')),
  prazo_dias int check (prazo_dias is null or prazo_dias between 0 and 365),
  recado_fornecedor text check (recado_fornecedor is null or char_length(recado_fornecedor) <= 500),
  -- Pagamento (D2c).
  pagamento_situacao text check (pagamento_situacao in ('a_pagar', 'pago')),
  vencimento date,
  pago_em date,
  criado_por uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (comercio_id, numero)
);
create index pedidos_compra_comercio_idx on public.pedidos_compra (comercio_id, created_at desc);

create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_compra(id),
  comercio_id uuid not null references public.comercios(id),
  produto_id uuid not null references public.produtos(id),
  variacao_id uuid references public.produto_variacoes(id),
  embalagem_id uuid references public.produto_embalagens(id),
  qtd_embalagens numeric(14,3) not null check (qtd_embalagens > 0),   -- quantas caixas/fardos (ou unidades, sem embalagem)
  qtd_unidades numeric(14,3) not null check (qtd_unidades > 0),       -- total em unidades de venda
  preco_estimado numeric(12,2) check (preco_estimado is null or preco_estimado >= 0),  -- por unidade de venda
  qtd_confirmada numeric(14,3) check (qtd_confirmada is null or qtd_confirmada >= 0),  -- quantas embalagens o fornecedor vai mandar (D2b); 0 = não tem
  qtd_recebida numeric(14,3) check (qtd_recebida is null or qtd_recebida >= 0),       -- preenchido no recebimento (D3)
  created_at timestamptz not null default now()
);
create index pedido_itens_pedido_idx on public.pedido_itens (pedido_id);
create index pedido_itens_produto_idx on public.pedido_itens (produto_id);

create trigger pedidos_compra_set_updated_at before update on public.pedidos_compra
  for each row execute function public.set_updated_at();

alter table public.pedidos_compra enable row level security;
alter table public.pedido_itens enable row level security;
create policy "dono ve pedidos do seu comercio" on public.pedidos_compra for select to authenticated
  using (public.pode_acessar_comercio(comercio_id));
create policy "dono ve itens dos pedidos do seu comercio" on public.pedido_itens for select to authenticated
  using (public.pode_acessar_comercio(comercio_id));
-- Sem políticas de gravação para o app: só as funções abaixo gravam.

/* Grava um pedido novo, já completo (o app monta o pedido e só envia pronto; pedido gravado não muda de itens).
   Repetir com o mesmo id (ex.: internet caiu) devolve o mesmo pedido, sem duplicar.
   p = {id, comercio_id, fornecedor_id, observacao, itens: [{produto_id, variacao_id, embalagem_id, qtd_embalagens, preco_estimado}]} */
create or replace function public.salvar_pedido(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid := (p->>'id')::uuid;
  v_com uuid := (p->>'comercio_id')::uuid;
  v_forn uuid := (p->>'fornecedor_id')::uuid;
  v_obs text := nullif(btrim(coalesce(p->>'observacao', '')), '');
  v_ped pedidos_compra%rowtype; v_num bigint;
  x jsonb; v_prod produtos%rowtype; v_var uuid; v_emb uuid; v_qe numeric; v_qu numeric; v_por numeric; v_preco numeric;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  if v_id is null or v_com is null or v_forn is null then raise exception 'pedido_incompleto' using errcode = '22023'; end if;
  if not public.pode_acessar_comercio(v_com) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  if not exists (select 1 from fornecedores f join comercios c on c.dono_id = f.dono_id where f.id = v_forn and c.id = v_com and f.ativo) then
    raise exception 'fornecedor_de_outro_dono' using errcode = '42501'; end if;
  if jsonb_typeof(p->'itens') is distinct from 'array' or jsonb_array_length(p->'itens') = 0 then
    raise exception 'pedido_sem_itens' using errcode = '23514'; end if;
  if jsonb_array_length(p->'itens') > 200 then raise exception 'pedido_itens_demais' using errcode = '23514'; end if;
  if v_obs is not null and char_length(v_obs) > 500 then raise exception 'observacao_longa' using errcode = '23514'; end if;

  select * into v_ped from pedidos_compra where id = v_id;
  if found then
    if v_ped.comercio_id <> v_com then raise exception 'pedido_de_outro_comercio' using errcode = '42501'; end if;
    return jsonb_build_object('id', v_id, 'numero', v_ped.numero);
  end if;
  -- A linha do comércio fica travada até o fim da transação: dois pedidos ao mesmo tempo nunca recebem o mesmo número.
  update comercios set proximo_numero_pedido = proximo_numero_pedido + 1 where id = v_com returning proximo_numero_pedido - 1 into v_num;
  insert into pedidos_compra (id, comercio_id, fornecedor_id, numero, observacao, criado_por)
  values (v_id, v_com, v_forn, v_num, v_obs, auth.uid());

  for x in select * from jsonb_array_elements(p->'itens') loop
    select * into v_prod from produtos where id = (x->>'produto_id')::uuid and comercio_id = v_com;
    if not found then raise exception 'produto_de_outro_comercio' using errcode = '42501'; end if;
    v_var := (x->>'variacao_id')::uuid; v_emb := (x->>'embalagem_id')::uuid;
    if v_var is not null and not exists (select 1 from produto_variacoes where id = v_var and produto_id = v_prod.id and removida_em is null) then
      raise exception 'variacao_invalida' using errcode = '23514'; end if;
    v_qe := (x->>'qtd_embalagens')::numeric;
    if v_qe is null or v_qe <= 0 then raise exception 'quantidade_invalida' using errcode = '23514'; end if;
    if v_emb is not null then
      select quantidade into v_por from produto_embalagens where id = v_emb and produto_id = v_prod.id and removida_em is null;
      if not found then raise exception 'embalagem_invalida' using errcode = '23514'; end if;
      if v_qe <> trunc(v_qe) then raise exception 'embalagem_inteira' using errcode = '23514'; end if;
      v_qu := v_qe * v_por;
    else
      v_qu := public.qtd_valida(v_qe, v_prod.unidade, false);
    end if;
    v_preco := (x->>'preco_estimado')::numeric;
    if v_preco is not null and v_preco < 0 then raise exception 'preco_invalido' using errcode = '23514'; end if;
    insert into pedido_itens (pedido_id, comercio_id, produto_id, variacao_id, embalagem_id, qtd_embalagens, qtd_unidades, preco_estimado)
    values (v_id, v_com, v_prod.id, v_var, v_emb, v_qe, v_qu, v_preco);
  end loop;
  if exists (select 1 from pedido_itens where pedido_id = v_id
             group by produto_id, variacao_id, embalagem_id having count(*) > 1) then
    raise exception 'item_repetido' using errcode = '23514'; end if;
  return jsonb_build_object('id', v_id, 'numero', v_num);
end $$;

/* Marca como enviado (WhatsApp, e-mail ou texto copiado). Reenviar só troca o canal; a data do primeiro envio fica.
   Reenviar um pedido já respondido não apaga a resposta do fornecedor. */
create or replace function public.marcar_pedido_enviado(_pedido uuid, _canal text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v pedidos_compra%rowtype;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  if _canal not in ('whatsapp', 'email', 'copiado') then raise exception 'canal_invalido' using errcode = '22023'; end if;
  select * into v from pedidos_compra where id = _pedido for update;
  if not found or not public.pode_acessar_comercio(v.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  if v.situacao in ('recebido_parcial', 'recebido', 'cancelado') then raise exception 'pedido_fechado' using errcode = '23514'; end if;
  update pedidos_compra set situacao = case when situacao = 'rascunho' then 'enviado' else situacao end,
    canal = _canal, enviado_em = coalesce(enviado_em, now()) where id = _pedido;
end $$;

/* Cancela um pedido que ainda não foi recebido (o link do fornecedor para de aceitar resposta). */
create or replace function public.cancelar_pedido(_pedido uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v pedidos_compra%rowtype;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into v from pedidos_compra where id = _pedido for update;
  if not found or not public.pode_acessar_comercio(v.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  if v.situacao in ('recebido_parcial', 'recebido', 'cancelado') then raise exception 'pedido_fechado' using errcode = '23514'; end if;
  update pedidos_compra set situacao = 'cancelado' where id = _pedido;
end $$;

revoke all on function public.salvar_pedido(jsonb), public.marcar_pedido_enviado(uuid, text), public.cancelar_pedido(uuid) from public, anon;
grant execute on function public.salvar_pedido(jsonb), public.marcar_pedido_enviado(uuid, text), public.cancelar_pedido(uuid) to authenticated;
