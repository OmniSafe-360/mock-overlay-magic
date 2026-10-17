-- B1: "Repor" da equipe = lista da equipe = "Para repor" do dono (mesma regra).
-- Banco descartável, dados simulados e transação desfeita. Nunca usar produção.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('b1-repor-'||t)::uuid $$;
create function pg_temp.ok(b boolean, nome text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', nome; end if; return 'OK '||nome; end $$;
create function pg_temp.recusa(s text, msg text) returns text language plpgsql as $$
declare m text;
begin
  begin execute s; raise exception 'sucesso_inesperado' using errcode='T0K00';
  exception when others then get stacked diagnostics m=message_text; end;
  if m <> msg then raise exception 'FALHOU: esperado %, veio %', msg, m; end if;
  return 'OK recusou '||msg;
end $$;
insert into auth.users values(pg_temp.u('dono'),'b1@teste.local'),(pg_temp.u('outro'),'b1-outro@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('dono'),'dono'),(pg_temp.u('outro'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('loja'),pg_temp.u('dono'),'mercado','Mercado simulado');
insert into fornecedores(id,dono_id,nome) values(pg_temp.u('forn'),pg_temp.u('dono'),'Distribuidora simulada');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por) values(pg_temp.u('func'),pg_temp.u('loja'),'Equipe simulada','ambos','765400',pg_temp.u('dono'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate)
 values(pg_temp.u('func'),pg_temp.u('loja'),encode(extensions.digest(repeat('a',64),'sha256'),'hex'),now()+interval '12 hours');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
create function pg_temp.produto(t text, dep numeric, ven numeric) returns jsonb language sql as $$
 select salvar_produto(jsonb_build_object('operacao_id',pg_temp.u('cad-'||t),'produto',jsonb_build_object(
  'id',pg_temp.u(t),'comercio_id',pg_temp.u('loja'),'nome','Produto '||t,'unidade','Unidade','categoria','Mercearia',
  'preco_compra',1,'preco_venda',2,'detalhes','{}'::jsonb,'controla_validade',false),
  'variacoes','[]'::jsonb,'areas',jsonb_build_array(
  jsonb_build_object('area','deposito','minimo',2,'maximo',50,'contagem',jsonb_build_object('quantidade',dep)),
  case when ven is null then jsonb_build_object('area','venda','minimo',2,'maximo',20)
       else jsonb_build_object('area','venda','minimo',2,'maximo',20,'contagem',jsonb_build_object('quantidade',ven)) end))) $$;
-- repor: gôndola 1 (mínimo 2) e depósito 10.
select pg_temp.produto('repor',10,1);
-- acabou: gôndola 0 e depósito 0 (o dono vê "Acabou", não "Repor").
select pg_temp.produto('acabou',0,0);
-- nao_contada: gôndola nunca contada (desconhecida, não zero).
select pg_temp.produto('nao_contada',10,null);
-- cheia: gôndola 5, acima do mínimo, mas com contagem pedida pelo caixa aberta.
select pg_temp.produto('cheia',10,5);
insert into conferencias(id,comercio_id,produto_id,area,funcionario_id,situacao)
 values(pg_temp.u('conf'),pg_temp.u('loja'),pg_temp.u('cheia'),'venda',pg_temp.u('func'),'contando');

set local role anon;
create temp table b1_lista as select (e->>'produto_id')::uuid id from jsonb_array_elements(funcionario_reposicao_lista(repeat('a',64))->'produtos') e;
create temp table b1_inicio as select (funcionario_inicio(repeat('a',64))->'avisos'->>'repor')::int n;
reset role;
select pg_temp.ok(exists(select 1 from b1_lista where id=pg_temp.u('repor')),'gôndola no mínimo com depósito: na lista');
select pg_temp.ok(not exists(select 1 from b1_lista where id=pg_temp.u('acabou')),'acabou de vez: fora da lista');
select pg_temp.ok(not exists(select 1 from b1_lista where id=pg_temp.u('nao_contada')),'gôndola não contada: fora da lista');
select pg_temp.ok(exists(select 1 from b1_lista where id=pg_temp.u('cheia')),'contagem pedida pelo caixa: na lista');
select pg_temp.ok((select n from b1_inicio)=(select count(*) from b1_lista),'contador da tela inicial = tamanho da lista');
select pg_temp.ok((select n from b1_inicio)=2,'contador 2');
select pg_temp.ok(not has_function_privilege('anon','public._precisa_repor(uuid,uuid,numeric)','execute')
  and not has_function_privilege('authenticated','public._precisa_repor(uuid,uuid,numeric)','execute'),'_precisa_repor fechada');
select 'OK B1' as resultado;
rollback;
