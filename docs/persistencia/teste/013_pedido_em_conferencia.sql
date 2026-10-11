-- R02: somente banco descartável; todos os dados de teste são desfeitos.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('r02-'||t)::uuid $$;
create function pg_temp.ok(b boolean, t text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', t; end if; return 'OK: '||t; end $$;
create function pg_temp.recusa(s text, msg text, estado text) returns text language plpgsql as $$
declare st text; m text;
begin
  begin execute s; raise exception 'sucesso_inesperado' using errcode='T0K00';
  exception when others then get stacked diagnostics st=returned_sqlstate,m=message_text; end;
  if st is distinct from estado or m <> msg then raise exception 'FALHOU: esperado % [%], veio % [%]',msg,estado,m,st; end if;
  return 'OK recusou '||msg;
end $$;
insert into auth.users(id,email) values(pg_temp.u('dono'),'r02@teste.local'),(pg_temp.u('outro'),'r02-outro@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('dono'),'dono'),(pg_temp.u('outro'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('loja'),pg_temp.u('dono'),'mercado','Mercado simulado R02');
insert into fornecedores(id,dono_id,nome) values(pg_temp.u('forn'),pg_temp.u('dono'),'Fornecedor simulado R02');
insert into produtos(id,comercio_id,nome,categoria,unidade,preco_compra,preco_venda)
 values(pg_temp.u('arroz'),pg_temp.u('loja'),'Arroz simulado R02','Mercearia','Unidade',1,2);
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por)
 values(pg_temp.u('func'),pg_temp.u('loja'),'Equipe simulada R02','receber','920012',pg_temp.u('dono'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate)
 values(pg_temp.u('func'),pg_temp.u('loja'),encode(extensions.digest(repeat('a',64),'sha256'),'hex'),now()+interval '1 hour');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select salvar_pedido(jsonb_build_object('id',pg_temp.u('pedido'),'comercio_id',pg_temp.u('loja'),'fornecedor_id',pg_temp.u('forn'),
 'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('arroz'),'qtd_embalagens',5))));
select marcar_pedido_enviado(pg_temp.u('pedido'),'copiado');
reset role;
update pedidos_compra set token=repeat('b',64) where id=pg_temp.u('pedido');
set local role anon;
select responder_pedido(repeat('b',64),jsonb_build_object('aceito',true,'previsao_entrega',current_date,'valor_total',10,'forma_pagamento','boleto','prazo_dias',7,
 'itens',jsonb_build_array(jsonb_build_object('id',(select (pedido_publico(repeat('b',64))->'itens')->0->>'id'),'qtd_confirmada',5))));
select pg_temp.ok((pedido_publico(repeat('b',64))->>'pode_responder')::boolean,'fornecedor pode corrigir antes da conferência');
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('rec'),pg_temp.u('pedido'),null);
reset role;
-- Fotografia dos dados antes das recusas, sem tabela de auditoria.
select to_jsonb(p) as pedido_antes from pedidos_compra p where id=pg_temp.u('pedido') \gset
select jsonb_agg(to_jsonb(i) order by id) as itens_antes from pedido_itens i where pedido_id=pg_temp.u('pedido') \gset
set local role authenticated;
select pg_temp.recusa($q$select cancelar_pedido(pg_temp.u('pedido'))$q$,'recebimento_em_contagem','23514');
select pg_temp.recusa($q$select marcar_pedido_enviado(pg_temp.u('pedido'),'email')$q$,'recebimento_em_contagem','23514');
select pg_temp.recusa($q$select novo_link_pedido(pg_temp.u('pedido'))$q$,'recebimento_em_contagem','23514');
set local role anon;
select pg_temp.recusa($q$select responder_pedido(repeat('b',64),'{}'::jsonb)$q$,'recebimento_em_contagem','23514');
select pg_temp.recusa($q$select responder_pedido(repeat('b',64),jsonb_build_object('aceito',true,'previsao_entrega',current_date,
 'itens',jsonb_build_array(jsonb_build_object('id',(pedido_publico(repeat('b',64))->'itens')->0->>'id','qtd_confirmada',1))))$q$,'recebimento_em_contagem','23514');
select pg_temp.ok((pedido_publico(repeat('b',64))->>'pode_responder')::boolean=false
 and (pedido_publico(repeat('b',64))->>'em_contagem')::boolean=true,'link continua legível, mas não permite resposta enquanto conta');
select pg_temp.recusa($q$select responder_pedido(repeat('z',64),'{}'::jsonb)$q$,'link_invalido','42501');
select pg_temp.recusa($q$select funcionario_abrir_recebimento(repeat('z',64),pg_temp.u('rec'),pg_temp.u('pedido'),null)$q$,'acesso_encerrado','42501');
reset role;
select pg_temp.ok((select to_jsonb(p) from pedidos_compra p where id=pg_temp.u('pedido'))=:'pedido_antes'::jsonb
 and (select jsonb_agg(to_jsonb(i) order by id) from pedido_itens i where pedido_id=pg_temp.u('pedido'))=:'itens_antes'::jsonb,
 'recusas conservam pedido, link, canal, resposta, quantidades, conta e vencimento');
select pg_temp.ok(not exists(select 1 from operacoes where comercio_id=pg_temp.u('loja'))
 and not exists(select 1 from saldos where comercio_id=pg_temp.u('loja')),'ação recusada não altera estoque nem cria operação');
-- Pagamento independente da entrega: o dono ainda pode marcar o que já pagou.
set local role authenticated;
select atualizar_pagamento(pg_temp.u('pedido'),jsonb_build_object('situacao','pago','pago_em',current_date));
select set_config('request.jwt.claim.sub',pg_temp.u('outro')::text,true);
select pg_temp.recusa($q$select cancelar_pedido(pg_temp.u('pedido'))$q$,'sem_acesso_ao_comercio','42501');
select pg_temp.recusa($q$select marcar_pedido_enviado(pg_temp.u('pedido'),'email')$q$,'sem_acesso_ao_comercio','42501');
select pg_temp.recusa($q$select novo_link_pedido(pg_temp.u('pedido'))$q$,'sem_acesso_ao_comercio','42501');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.recusa($q$select cancelar_pedido(pg_temp.u('pedido'))$q$,'nao_autenticado','28000');
select pg_temp.recusa($q$select marcar_pedido_enviado(pg_temp.u('pedido'),'email')$q$,'nao_autenticado','28000');
select pg_temp.recusa($q$select novo_link_pedido(pg_temp.u('pedido'))$q$,'nao_autenticado','28000');
reset role;
-- A conferência e seu reenvio continuam terminando; entrada única com operação.
set local role anon;
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec'),0,
 jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('arroz'),'total',5)))->>'situacao')='concluido','equipe conclui a conferência normalmente');
select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec'),0,
 jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('arroz'),'total',5)));
select pg_temp.recusa($q$select responder_pedido(repeat('b',64),'{}'::jsonb)$q$,'pedido_fechado','23514');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('arroz'),null,'deposito')=5
 and (select count(*) from operacoes where comercio_id=pg_temp.u('loja'))=1
 and (select sum(quantidade) from movimentos where comercio_id=pg_temp.u('loja'))=5,'recebimento entra uma vez e histórico fecha na mesma transação');
select pg_temp.ok((select situacao='recebido' and pagamento_situacao='pago' from pedidos_compra where id=pg_temp.u('pedido')),
 'conclusão atualiza pedido sem perder o pagamento');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
select pg_temp.recusa($q$select cancelar_pedido(pg_temp.u('pedido'))$q$,'pedido_fechado','23514');
select pg_temp.recusa($q$select marcar_pedido_enviado(pg_temp.u('pedido'),'email')$q$,'pedido_fechado','23514');
select pg_temp.recusa($q$select novo_link_pedido(pg_temp.u('pedido'))$q$,'pedido_fechado','23514');
reset role;
select pg_temp.ok(not (pedido_publico(repeat('b',64))->>'pode_responder')::boolean
 and not (pedido_publico(repeat('b',64))->>'em_contagem')::boolean,'link da entrega concluída permanece somente leitura');
select pg_temp.ok(not has_table_privilege('authenticated','public.pedidos_compra','UPDATE')
 and not has_table_privilege('anon','public.pedidos_compra','UPDATE')
 and not has_table_privilege('authenticated','public.saldos','INSERT'),'gravações diretas continuam bloqueadas');
select pg_temp.ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.pedidos_compra'::regclass,'public.pedido_itens'::regclass,
 'public.recebimentos'::regclass,'public.saldos'::regclass)),'RLS permanece ligada');
rollback;
