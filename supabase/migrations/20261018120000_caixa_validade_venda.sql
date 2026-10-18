do $$
begin
 if to_regprocedure('public._saldo_vendavel_caixa(uuid,uuid)') is not null or to_regprocedure('public._baixar_item_venda_caixa(uuid)') is not null then raise exception 'versao_inesperada: auxiliares já existem'; end if;
 if md5(pg_get_functiondef('public.caixa_produtos(text)'::regprocedure)) <> '7fd60674c9d30ee9e95a63781efef61f' then
 raise exception 'versao_inesperada: caixa_produtos mudou'; end if;
 if md5(pg_get_functiondef('public.caixa_registrar_venda(text,jsonb)'::regprocedure)) <> '78f3b4d30ac9b75db2c5732653f23355' then
 raise exception 'versao_inesperada: caixa_registrar_venda mudou'; end if;
end $$;
-- Correção autorizada: comparar funções e ACL do Supabase oficial antes da aplicação.
-- A migração é transacional no runner; não corrige nem descarta saldos existentes.
-- A elegibilidade muda somente para novas vendas pelo Caixa móvel.
create or replace function public._saldo_vendavel_caixa(_prod uuid, _var uuid)
returns numeric language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(sum(s.quantidade),0)
 from saldos s left join lotes l on l.id=s.lote_id
 where s.produto_id=_prod and s.variacao_id is not distinct from _var
   and s.area='venda' and s.quantidade>0
   and (l.vencimento is null or l.vencimento >= (now() at time zone 'America/Sao_Paulo')::date);
$$;
revoke all on function public._saldo_vendavel_caixa(uuid,uuid) from public,anon,authenticated;
grant execute on function public._saldo_vendavel_caixa(uuid,uuid) to service_role;
CREATE OR REPLACE FUNCTION public._baixar_item_venda_caixa(_item uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare i venda_itens%rowtype; c comercios%rowtype; v_op uuid := gen_random_uuid(); v_disp numeric; v_baixa numeric; v_partes jsonb; v_lv uuid; v_func uuid; r record; v_rest numeric; v_q numeric;
begin
  select * into i from venda_itens where id = _item for update;
  if not found or not exists(select 1 from vendas where id=i.venda_id and origem='celular') then raise exception 'item_invalido' using errcode='22023'; end if;
  select * into c from comercios where id = i.comercio_id;
  select funcionario_id into v_func from vendas where id = i.venda_id;
  perform pg_advisory_xact_lock(hashtextextended(i.produto_id::text, 0));
  v_disp := public._saldo_vendavel_caixa(i.produto_id, i.variacao_id);
  if i.qtd_unidades > v_disp then raise exception 'saldo_insuficiente' using errcode='23514'; end if;
  v_baixa := i.qtd_unidades;
  select local_id into v_lv from produto_areas where produto_id = i.produto_id and variacao_id is not distinct from i.variacao_id and area = 'venda';
  insert into operacoes (id, user_id, comercio_id, produto_id, tipo, hash, funcionario_id)
  values (v_op, c.dono_id, c.id, i.produto_id, 'venda', md5(i.id::text || ':venda'), v_func);
  v_partes := '[]'::jsonb; v_rest := v_baixa;
  for r in select s.* from saldos s left join lotes l on l.id=s.lote_id
    where s.comercio_id=c.id and s.produto_id=i.produto_id
      and s.variacao_id is not distinct from i.variacao_id
      and s.area='venda' and s.quantidade>0
      and (l.vencimento is null or l.vencimento >= (now() at time zone 'America/Sao_Paulo')::date)
    order by s.pendente,l.vencimento nulls last,s.updated_at
    for update of s loop
    exit when v_rest<=0;
    v_q:=least(r.quantidade,v_rest);
    update saldos set quantidade=quantidade-v_q,updated_at=now() where id=r.id;
    insert into movimentos(operacao_id,comercio_id,produto_id,variacao_id,area,local_id,lote_id,saldo_id,tipo,quantidade,criado_por,funcionario_id)
    values(v_op,c.id,i.produto_id,i.variacao_id,'venda',v_lv,r.lote_id,r.id,'venda',-v_q,c.dono_id,v_func);
    v_partes:=v_partes||jsonb_build_object('lote_id',r.lote_id,'pendente',r.pendente,
      'pendencia_confirmada',r.pendencia_confirmada,'quantidade',v_q);
    v_rest:=v_rest-v_q;
  end loop;
  if v_rest>0 then raise exception 'saldo_insuficiente' using errcode='23514'; end if;
  update venda_itens set situacao = 'baixado', qtd_baixada = v_baixa, qtd_faltou = i.qtd_unidades - v_baixa, partes = v_partes,
         operacao_id = v_op, motivo = null where id = i.id;
  update operacoes set resultado = jsonb_build_object('venda', i.venda_id, 'item', i.id, 'vendido', i.qtd_unidades, 'baixado', v_baixa,
         'faltou', i.qtd_unidades - v_baixa) where id = v_op;
end $function$;

revoke all on function public._baixar_item_venda_caixa(uuid) from public,anon,authenticated;
grant execute on function public._baixar_item_venda_caixa(uuid) to service_role;
do $patch$
declare d text;
begin
 d:=pg_get_functiondef('public.caixa_produtos(text)'::regprocedure);
 if (length(d)-length(replace(d,'public.saldo_chave(p.id,pa.variacao_id,''venda'')','')))/length('public.saldo_chave(p.id,pa.variacao_id,''venda'')')<>1 then raise exception 'trecho_inesperado: caixa_produtos'; end if;
 d:=replace(d,'public.saldo_chave(p.id,pa.variacao_id,''venda'')','public._saldo_vendavel_caixa(p.id,pa.variacao_id)');
 execute d;
 d:=pg_get_functiondef('public.caixa_registrar_venda(text,jsonb)'::regprocedure);
 if (length(d)-length(replace(d,'public.saldo_chave(r.produto,r.variacao,''venda'')','')))/length('public.saldo_chave(r.produto,r.variacao,''venda'')')<>1 then raise exception 'trecho_inesperado: caixa_registrar_venda'; end if;
 d:=replace(d,'public.saldo_chave(r.produto,r.variacao,''venda'')','public._saldo_vendavel_caixa(r.produto,r.variacao)');
 if (length(d)-length(replace(d,'perform public._baixar_item_venda(r.id);','')))/length('perform public._baixar_item_venda(r.id);')<>1 then raise exception 'trecho_inesperado: caixa_registrar_venda'; end if;
 d:=replace(d,'perform public._baixar_item_venda(r.id);','perform public._baixar_item_venda_caixa(r.id);');
 if (length(d)-length(replace(d,'if r.unidades>v_disponivel then v_motivo:=''estoque_insuficiente''; end if;','')))/length('if r.unidades>v_disponivel then v_motivo:=''estoque_insuficiente''; end if;')<>1 then raise exception 'trecho_inesperado: motivo da recusa'; end if;
 d:=replace(d,'if r.unidades>v_disponivel then v_motivo:=''estoque_insuficiente''; end if;','if r.unidades>v_disponivel then v_motivo:=case when r.unidades<=public.saldo_chave(r.produto,r.variacao,''venda'') then ''estoque_vencido'' else ''estoque_insuficiente'' end; end if;');
 execute d;
end $patch$;
