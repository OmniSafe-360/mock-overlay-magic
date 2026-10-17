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
rollback;
