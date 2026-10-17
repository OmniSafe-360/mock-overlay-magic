-- B5: somente banco descartável; todos os dados de teste são desfeitos.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('b5-'||t)::uuid $$;
create function pg_temp.ok(b boolean, t text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', t; end if; return 'OK: '||t; end $$;
insert into auth.users(id,email) values(pg_temp.u('dono'),'b5@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('dono'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('loja'),pg_temp.u('dono'),'mercado','Mercado simulado B5');
insert into fornecedores(id,dono_id,nome) values(pg_temp.u('forn'),pg_temp.u('dono'),'Fornecedor simulado B5');
insert into produtos(id,comercio_id,nome,categoria,unidade,preco_compra,preco_venda)
 values(pg_temp.u('arroz'),pg_temp.u('loja'),'Arroz simulado B5','Mercearia','Unidade',1,2);
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select salvar_pedido(jsonb_build_object('id',pg_temp.u('p1'),'comercio_id',pg_temp.u('loja'),'fornecedor_id',pg_temp.u('forn'),
 'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('arroz'),'qtd_embalagens',5))));
select marcar_pedido_enviado(pg_temp.u('p1'),'copiado');
select salvar_pedido(jsonb_build_object('id',pg_temp.u('p2'),'comercio_id',pg_temp.u('loja'),'fornecedor_id',pg_temp.u('forn'),
 'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('arroz'),'qtd_embalagens',5))));
select marcar_pedido_enviado(pg_temp.u('p2'),'copiado');
select salvar_pedido(jsonb_build_object('id',pg_temp.u('p3'),'comercio_id',pg_temp.u('loja'),'fornecedor_id',pg_temp.u('forn'),
 'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('arroz'),'qtd_embalagens',5))));
select marcar_pedido_enviado(pg_temp.u('p3'),'copiado');
reset role;
update pedidos_compra set token=repeat('1',64) where id=pg_temp.u('p1');
update pedidos_compra set token=repeat('2',64) where id=pg_temp.u('p2');
update pedidos_compra set token=repeat('3',64) where id=pg_temp.u('p3');
create function pg_temp.responde(tk text, valor numeric, prev date, forma text, prazo int) returns jsonb language sql as $$
  select responder_pedido(tk, jsonb_build_object('aceito',true,'previsao_entrega',prev,'valor_total',valor,'forma_pagamento',forma,'prazo_dias',prazo,
   'itens',jsonb_build_array(jsonb_build_object('id',(pedido_publico(tk)->'itens')->0->>'id','qtd_confirmada',5)))) $$;
set local role anon;
select pg_temp.responde(repeat('1',64),100,current_date+1,'boleto',7);
select pg_temp.responde(repeat('2',64),100,current_date+1,'boleto',7);
select pg_temp.responde(repeat('3',64),100,current_date+1,'boleto',7);
reset role;
select pg_temp.ok((select valor_total=100 and vencimento=current_date+8 and pagamento_situacao='a_pagar' from pedidos_compra where id=pg_temp.u('p1')),
 'primeira resposta cria a conta');
-- p2: o dono corrige o valor; p3: o dono paga.
set local role authenticated;
select atualizar_pagamento(pg_temp.u('p2'),jsonb_build_object('situacao','a_pagar','vencimento',current_date+8,'valor_total',90));
select atualizar_pagamento(pg_temp.u('p3'),jsonb_build_object('situacao','pago','pago_em',current_date));
reset role;
-- O fornecedor altera a resposta: R$ 120, entrega em 3 dias, boleto 14.
set local role anon;
select pg_temp.responde(repeat('1',64),120,current_date+3,'boleto',14);
select pg_temp.responde(repeat('2',64),120,current_date+3,'boleto',14);
select pg_temp.responde(repeat('3',64),120,current_date+3,'boleto',14);
reset role;
select pg_temp.ok((select valor_total=120 and valor_fornecedor=120 and vencimento=current_date+17 and pagamento_situacao='a_pagar' from pedidos_compra where id=pg_temp.u('p1')),
 'conta a pagar segue a nova resposta (valor e vencimento)');
select pg_temp.ok((select valor_total=90 and valor_fornecedor=120 and vencimento=current_date+17 from pedidos_compra where id=pg_temp.u('p2')),
 'valor corrigido pelo dono fica; vencimento não mexido segue a resposta');
select pg_temp.ok((select valor_total=100 and vencimento=current_date+8 and pagamento_situacao='pago' from pedidos_compra where id=pg_temp.u('p3')),
 'conta paga não muda');
-- p2: o dono corrige o vencimento; nova resposta não mexe nele.
set local role authenticated;
select atualizar_pagamento(pg_temp.u('p2'),jsonb_build_object('situacao','a_pagar','vencimento',current_date+30,'valor_total',90));
reset role;
set local role anon;
select pg_temp.responde(repeat('2',64),130,current_date+2,'pix',null);
reset role;
select pg_temp.ok((select valor_total=90 and vencimento=current_date+30 from pedidos_compra where id=pg_temp.u('p2')),
 'vencimento corrigido pelo dono fica');
-- Revisão: o dono corrige para R$ 120, o fornecedor manda R$ 120 e depois R$ 130: a correção do dono continua.
set local role authenticated;
select salvar_pedido(jsonb_build_object('id',pg_temp.u('p4'),'comercio_id',pg_temp.u('loja'),'fornecedor_id',pg_temp.u('forn'),
 'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('arroz'),'qtd_embalagens',5))));
select marcar_pedido_enviado(pg_temp.u('p4'),'copiado');
reset role;
update pedidos_compra set token=repeat('4',64) where id=pg_temp.u('p4');
set local role anon;
select pg_temp.responde(repeat('4',64),100,current_date+1,'pix',null);
reset role;
set local role authenticated;
select atualizar_pagamento(pg_temp.u('p4'),jsonb_build_object('situacao','a_pagar','vencimento',current_date+1,'valor_total',120));
reset role;
select pg_temp.ok((select valor_do_dono and not vencimento_do_dono from pedidos_compra where id=pg_temp.u('p4')),'mudar só o valor marca só o valor');
set local role anon;
select pg_temp.responde(repeat('4',64),120,current_date+2,'pix',null);
select pg_temp.responde(repeat('4',64),130,current_date+4,'pix',null);
reset role;
select pg_temp.ok((select valor_total=120 and valor_fornecedor=130 and vencimento=current_date+4 from pedidos_compra where id=pg_temp.u('p4')),
 'correção do dono igual a uma resposta não se perde na resposta seguinte');
-- Recusa tira a conta e as marcas; a próxima resposta cria a conta do zero.
set local role anon;
select responder_pedido(repeat('4',64),jsonb_build_object('aceito',false));
reset role;
select pg_temp.ok((select pagamento_situacao is null and not valor_do_dono and not vencimento_do_dono from pedidos_compra where id=pg_temp.u('p4')),'recusa desliga as marcas');
set local role anon;
select pg_temp.responde(repeat('4',64),140,current_date+5,'pix',null);
select pg_temp.responde(repeat('4',64),150,current_date+6,'pix',null);
reset role;
select pg_temp.ok((select valor_total=150 and vencimento=current_date+6 from pedidos_compra where id=pg_temp.u('p4')),'conta nova segue as respostas');
-- Segundo ajuste: apagar o valor desliga a marca; corrigir só o vencimento (reenviando o valor do fornecedor) não marca o valor.
set local role authenticated;
select salvar_pedido(jsonb_build_object('id',pg_temp.u('p5'),'comercio_id',pg_temp.u('loja'),'fornecedor_id',pg_temp.u('forn'),
 'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('arroz'),'qtd_embalagens',5))));
select marcar_pedido_enviado(pg_temp.u('p5'),'copiado');
reset role;
update pedidos_compra set token=repeat('5',64) where id=pg_temp.u('p5');
set local role anon;
select pg_temp.responde(repeat('5',64),100,current_date+1,'pix',null);
reset role;
set local role authenticated;
select atualizar_pagamento(pg_temp.u('p5'),jsonb_build_object('situacao','a_pagar','vencimento',current_date+9,'valor_total',100));
reset role;
select pg_temp.ok((select not valor_do_dono and vencimento_do_dono from pedidos_compra where id=pg_temp.u('p5')),'corrigir só a data não marca o valor');
set local role authenticated;
select atualizar_pagamento(pg_temp.u('p5'),jsonb_build_object('situacao','a_pagar','vencimento',current_date+9,'valor_total',70));
select atualizar_pagamento(pg_temp.u('p5'),jsonb_build_object('situacao','a_pagar','vencimento',current_date+9,'valor_total',null));
reset role;
select pg_temp.ok((select not valor_do_dono and valor_total is null from pedidos_compra where id=pg_temp.u('p5')),'apagar o valor desliga a marca');
set local role anon;
select pg_temp.responde(repeat('5',64),110,current_date+2,'pix',null);
reset role;
select pg_temp.ok((select valor_total=110 and vencimento=current_date+9 from pedidos_compra where id=pg_temp.u('p5')),
 'valor volta a seguir o fornecedor; vencimento corrigido fica');
rollback;
