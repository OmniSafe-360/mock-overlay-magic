-- B10: item que o dono marcou "não controlar" (sacola, serviço) é vendido no caixa do celular sem tirar do estoque.
-- Dados fictícios; usar com 015_base_caixa_estoque.sql entre begin e rollback.
update funcionarios set caixa=true where id=pg_temp.u('func');
insert into codigos_pdv(comercio_id,codigo,ignorar,criado_por) values
 (pg_temp.u('com'),'SACOLA01',true,pg_temp.u('dono')),
 (pg_temp.u('com'),'avulso:sacola grande',true,pg_temp.u('dono'));
create function pg_temp.vende(t text, itens jsonb, total numeric) returns jsonb language sql as $$
 select caixa_registrar_venda(repeat('f',64),jsonb_build_object('id',pg_temp.u(t),'turno_id',pg_temp.u('turno-b10'),'feita_em',now(),
  'itens',itens,'pagamentos',jsonb_build_array(jsonb_build_object('forma','dinheiro','valor',total)))) $$;
create function pg_temp.fora() returns jsonb language sql as $$ select caixa_itens_fora_estoque(repeat('f',64)) $$;
set local role anon;
select caixa_abrir(repeat('f',64),pg_temp.u('turno-b10'),0);
-- 1. O caixa recebe a lista: código com nome padrão, item sem código pelo nome.
select pg_temp.ok(pg_temp.fora() @> '[{"codigo":"SACOLA01","nome":"Item fora do estoque"},{"codigo":null,"nome":"sacola grande"}]'::jsonb
 and jsonb_array_length(pg_temp.fora())=2,'lista dos itens fora do estoque');
-- 2. Venda com produto + sacola pelo código: registrada; a sacola não mexe no estoque.
select pg_temp.ok(pg_temp.vende('v1',jsonb_build_array(
  jsonb_build_object('produto_id',pg_temp.u('g'),'qtd',1,'preco',4),
  jsonb_build_object('codigo','SACOLA01','descricao','Sacola','qtd',2,'preco',0.25)),4.5)->>'situacao'='registrada','venda com sacola registrada');
-- 3. Item sem código, pelo nome guardado pelo dono.
select pg_temp.ok(pg_temp.vende('v2',jsonb_build_array(jsonb_build_object('descricao','Sacola  Grande','qtd',1,'preco',1)),1)->>'situacao'='registrada','sacola grande sem código registrada');
-- 4. Código desconhecido continua recusado.
select pg_temp.ok(pg_temp.vende('v3',jsonb_build_array(jsonb_build_object('codigo','XYZ','descricao','Outro','qtd',1,'preco',1)),1)->>'situacao'='bloqueada','código desconhecido continua bloqueado');
-- 5. A lista passa a mostrar o nome da última venda.
select pg_temp.ok(pg_temp.fora() @> '[{"codigo":"SACOLA01","nome":"Sacola"},{"codigo":null,"nome":"Sacola  Grande"}]'::jsonb,'nome da última venda');
-- 6. Chave errada recusada.
select pg_temp.recusa($q$select caixa_itens_fora_estoque(repeat('0',64))$q$,'acesso_encerrado');
reset role;
select pg_temp.ok((select count(*) from venda_itens where venda_id in (pg_temp.u('v1'),pg_temp.u('v2')) and situacao='ignorado' and produto_id is null)=2,'sacolas ficam "ignorado", sem produto');
select pg_temp.ok((select total from vendas where id=pg_temp.u('v1'))=4.5,'total inclui a sacola');
select pg_temp.ok(saldo_chave(pg_temp.u('g'),null,'venda')=4,'gôndola do produto 5 → 4; a sacola não tirou nada');
select pg_temp.ok((select count(*) from operacoes where produto_id is null and comercio_id=pg_temp.u('com') and tipo='venda')=0,'sem operação de estoque para a sacola');
select 'OK B10: item "não controlar" vendido no caixa sem tirar do estoque' as resultado;
