-- Etapa D2c: controle de pagamento do pedido (desenho aprovado pelo dono em 09/10/2026).
-- O dono marca como pago (com a data), desfaz, ou corrige o vencimento e o valor. Sem tabela nova.

/* p = {situacao: 'a_pagar' | 'pago', vencimento, pago_em, valor_total?}. valor_total ausente = mantém o atual. */
create or replace function public.atualizar_pagamento(_pedido uuid, p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v pedidos_compra%rowtype;
  v_sit text := p->>'situacao';
  v_venc date := nullif(p->>'vencimento', '')::date;
  v_pago date := nullif(p->>'pago_em', '')::date;
  v_valor numeric;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into v from pedidos_compra where id = _pedido for update;
  if not found or not public.pode_acessar_comercio(v.comercio_id) then raise exception 'sem_acesso_ao_comercio' using errcode = '42501'; end if;
  -- Pedido não enviado, cancelado ou recusado não tem conta a pagar (a não ser que já tivesse uma, para poder corrigir).
  if v.situacao in ('rascunho', 'cancelado', 'recusado') and v.pagamento_situacao is null then
    raise exception 'pedido_sem_pagamento' using errcode = '23514'; end if;
  if v_sit is null or v_sit not in ('a_pagar', 'pago') then raise exception 'situacao_pagamento_invalida' using errcode = '22023'; end if;
  if p ? 'valor_total' then
    v_valor := nullif(p->>'valor_total', '')::numeric;
    if v_valor is not null and (v_valor < 0 or v_valor > 99999999) then raise exception 'valor_invalido' using errcode = '23514'; end if;
  else
    v_valor := v.valor_total;
  end if;
  v_venc := coalesce(v_venc, v.vencimento);
  if v_sit = 'a_pagar' and v_venc is null then raise exception 'vencimento_obrigatorio' using errcode = '23514'; end if;
  if v_venc is not null and (v_venc < current_date - 3650 or v_venc > current_date + 3650) then raise exception 'vencimento_invalido' using errcode = '23514'; end if;
  if v_sit = 'pago' and v_pago is null then raise exception 'data_pagamento_obrigatoria' using errcode = '23514'; end if;
  if v_sit = 'pago' and (v_pago > current_date + 1 or v_pago < current_date - 3650) then raise exception 'data_pagamento_invalida' using errcode = '23514'; end if;
  update pedidos_compra set pagamento_situacao = v_sit, vencimento = v_venc, valor_total = v_valor,
    pago_em = case when v_sit = 'pago' then v_pago else null end
   where id = _pedido;
end $$;

revoke all on function public.atualizar_pagamento(uuid, jsonb) from public, anon;
grant execute on function public.atualizar_pagamento(uuid, jsonb) to authenticated;
