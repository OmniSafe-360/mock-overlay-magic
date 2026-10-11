-- Checklist funcional, item 3: cancelar o pedido tira a conta a pagar (como a recusa do fornecedor já fazia).
-- O que já foi pago continua registrado.
create or replace function public.cancelar_pedido(_pedido uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v pedidos_compra%rowtype;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into v from pedidos_compra where id = _pedido for update;
  if not found or not public.pode_acessar_comercio(v.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  if v.situacao in ('recebido_parcial', 'recebido', 'cancelado') then raise exception 'pedido_fechado' using errcode = '23514'; end if;
  update pedidos_compra set situacao = 'cancelado',
    pagamento_situacao = case when pagamento_situacao = 'pago' then 'pago' end,
    vencimento = case when pagamento_situacao = 'pago' then vencimento end
   where id = _pedido;
end $$;
