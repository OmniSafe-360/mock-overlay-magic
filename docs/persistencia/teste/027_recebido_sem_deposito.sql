-- B8: produto só com área de venda recebe mercadoria; o depósito passa a existir e mostra o que chegou.
-- Banco descartável, dados simulados e transação desfeita. Nunca usar produção.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('b8-'||t)::uuid $$;
create function pg_temp.ok(b boolean, nome text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', nome; end if; return 'OK '||nome; end $$;
insert into auth.users values(pg_temp.u('dono'),'b8@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('dono'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('loja'),pg_temp.u('dono'),'mercado','Mercado simulado B8');
insert into fornecedores(id,dono_id,nome) values(pg_temp.u('forn'),pg_temp.u('dono'),'Distribuidora simulada');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por) values(pg_temp.u('func'),pg_temp.u('loja'),'Equipe simulada','ambos','765801',pg_temp.u('dono'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate)
 values(pg_temp.u('func'),pg_temp.u('loja'),encode(extensions.digest(repeat('b',64),'sha256'),'hex'),now()+interval '12 hours');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
-- Só área de venda.
select salvar_produto(jsonb_build_object('operacao_id',pg_temp.u('cad'),'produto',jsonb_build_object(
  'id',pg_temp.u('sabao'),'comercio_id',pg_temp.u('loja'),'nome','Sabão simulado','unidade','Unidade','categoria','Mercearia',
  'preco_compra',1,'preco_venda',2,'detalhes','{}'::jsonb,'controla_validade',false),
  'variacoes','[]'::jsonb,'areas',jsonb_build_array(
  jsonb_build_object('area','venda','minimo',2,'maximo',20,'contagem',jsonb_build_object('quantidade',3)))));
select pg_temp.ok(not exists(select 1 from produto_areas where produto_id=pg_temp.u('sabao') and area='deposito'),'produto começa sem depósito');
select salvar_pedido(jsonb_build_object('id',pg_temp.u('p1'),'comercio_id',pg_temp.u('loja'),'fornecedor_id',pg_temp.u('forn'),
  'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('sabao'),'qtd_embalagens',12,'preco_estimado',1))));
select marcar_pedido_enviado(pg_temp.u('p1'),'copiado');
set local role anon;
select funcionario_abrir_recebimento(repeat('b',64),pg_temp.u('r1'),pg_temp.u('p1'),null);
select pg_temp.ok(funcionario_enviar_recebimento(repeat('b',64),pg_temp.u('r1'),0,
  jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('sabao'),'total',12,'avaria',0,'partes','[]'::jsonb)))->>'situacao'='concluido','entrega concluída');
reset role;
select pg_temp.ok(exists(select 1 from produto_areas where produto_id=pg_temp.u('sabao') and area='deposito' and local_id is null and minimo is null),
 'área do depósito criada, sem local nem mínimo');
select pg_temp.ok(exists(select 1 from contagens where produto_id=pg_temp.u('sabao') and area='deposito' and quantidade=0),'depósito marcado como contado (zero antes da entrada)');
select pg_temp.ok((select sum(quantidade) from saldos where produto_id=pg_temp.u('sabao') and area='deposito')=12,'depósito mostra as 12 que chegaram');
select pg_temp.ok((select sum(quantidade) from saldos where produto_id=pg_temp.u('sabao') and area='venda')=3,'área de venda igual');
select pg_temp.ok((select count(*) from operacoes where produto_id=pg_temp.u('sabao') and tipo='recebimento')=1,'uma operação de recebimento');
-- Segunda entrega: área já existe, nada é recriado.
select salvar_pedido(jsonb_build_object('id',pg_temp.u('p2'),'comercio_id',pg_temp.u('loja'),'fornecedor_id',pg_temp.u('forn'),
  'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('sabao'),'qtd_embalagens',5,'preco_estimado',1))));
select marcar_pedido_enviado(pg_temp.u('p2'),'copiado');
set local role anon;
select funcionario_abrir_recebimento(repeat('b',64),pg_temp.u('r2'),pg_temp.u('p2'),null);
select funcionario_enviar_recebimento(repeat('b',64),pg_temp.u('r2'),0,
  jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('sabao'),'total',5,'avaria',0,'partes','[]'::jsonb)));
reset role;
select pg_temp.ok((select sum(quantidade) from saldos where produto_id=pg_temp.u('sabao') and area='deposito')=17
 and (select count(*) from produto_areas where produto_id=pg_temp.u('sabao') and area='deposito')=1
 and (select count(*) from contagens where produto_id=pg_temp.u('sabao') and area='deposito')=1,'segunda entrega soma; área e contagem únicas');
-- Ajuste da revisão: roupa com 2 tamanhos e sem depósito; chega só o P. O depósito vale para P e M (M contado com zero).
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('roupas'),pg_temp.u('dono'),'loja_roupas','Roupas simuladas B8');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por) values(pg_temp.u('func-r'),pg_temp.u('roupas'),'Equipe roupas','ambos','765802',pg_temp.u('dono'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate)
 values(pg_temp.u('func-r'),pg_temp.u('roupas'),encode(extensions.digest(repeat('c',64),'sha256'),'hex'),now()+interval '12 hours');
insert into produtos(id,comercio_id,nome,categoria,unidade,preco_compra,preco_venda)
 values(pg_temp.u('camisa'),pg_temp.u('roupas'),'Camisa simulada','Camisetas','Peça',10,20);
insert into produto_variacoes(id,produto_id,comercio_id,tamanho,cor) values
 (pg_temp.u('P'),pg_temp.u('camisa'),pg_temp.u('roupas'),'P','Azul'),
 (pg_temp.u('M'),pg_temp.u('camisa'),pg_temp.u('roupas'),'M','Azul'),
 (pg_temp.u('G'),pg_temp.u('camisa'),pg_temp.u('roupas'),'G','Azul');
update produto_variacoes set removida_em=now() where id=pg_temp.u('G');
insert into produto_areas(comercio_id,produto_id,variacao_id,area) values
 (pg_temp.u('roupas'),pg_temp.u('camisa'),pg_temp.u('P'),'venda'),(pg_temp.u('roupas'),pg_temp.u('camisa'),pg_temp.u('M'),'venda');
select salvar_pedido(jsonb_build_object('id',pg_temp.u('p3'),'comercio_id',pg_temp.u('roupas'),'fornecedor_id',pg_temp.u('forn'),
  'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('P'),'qtd_embalagens',4,'preco_estimado',1))));
select marcar_pedido_enviado(pg_temp.u('p3'),'copiado');
set local role anon;
select funcionario_abrir_recebimento(repeat('c',64),pg_temp.u('r3'),pg_temp.u('p3'),null);
select pg_temp.ok(funcionario_enviar_recebimento(repeat('c',64),pg_temp.u('r3'),0,
  jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('P'),'total',4,'avaria',0,'partes','[]'::jsonb)))->>'situacao'='concluido','roupa: entrega concluída');
reset role;
select pg_temp.ok((select count(*) from produto_areas where produto_id=pg_temp.u('camisa') and area='deposito')=2
 and (select count(*) from contagens where produto_id=pg_temp.u('camisa') and area='deposito' and quantidade=0)=2,'roupa: depósito criado e contado para P e M (G removido fica de fora)');
select pg_temp.ok((select sum(quantidade) from saldos where produto_id=pg_temp.u('camisa') and variacao_id=pg_temp.u('P') and area='deposito')=4
 and not exists(select 1 from saldos where produto_id=pg_temp.u('camisa') and variacao_id=pg_temp.u('M') and area='deposito' and quantidade<>0),'roupa: P com 4, M com zero');
rollback;
