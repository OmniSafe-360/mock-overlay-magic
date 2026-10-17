-- B9: contagem do depósito começada em outro dia recomeça do zero; a do mesmo dia continua.
-- Banco descartável, dados simulados e transação desfeita. Nunca usar produção.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('b9-'||t)::uuid $$;
create function pg_temp.ok(b boolean, nome text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', nome; end if; return 'OK '||nome; end $$;
insert into auth.users values(pg_temp.u('dono'),'b9@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('dono'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('loja'),pg_temp.u('dono'),'mercado','Mercado simulado B9');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por) values(pg_temp.u('func'),pg_temp.u('loja'),'Equipe simulada','ambos','765901',pg_temp.u('dono'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate)
 values(pg_temp.u('func'),pg_temp.u('loja'),encode(extensions.digest(repeat('c',64),'sha256'),'hex'),now()+interval '12 hours');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
create function pg_temp.produto(t text) returns jsonb language sql as $$
 select salvar_produto(jsonb_build_object('operacao_id',pg_temp.u('cad-'||t),'produto',jsonb_build_object(
  'id',pg_temp.u(t),'comercio_id',pg_temp.u('loja'),'nome','Produto '||t,'unidade','Unidade','categoria','Mercearia',
  'preco_compra',1,'preco_venda',2,'detalhes','{}'::jsonb,'controla_validade',false),
  'variacoes','[]'::jsonb,'areas',jsonb_build_array(
  jsonb_build_object('area','deposito','minimo',2,'maximo',50,'contagem',jsonb_build_object('quantidade',10))))) $$;
select pg_temp.produto('arroz'), pg_temp.produto('feijao');
create function pg_temp.conta(c text, t text, n numeric, r int) returns jsonb language sql as $$
 select funcionario_conferencia_contar(repeat('c',64),pg_temp.u(c),pg_temp.u(t),null,n,r) $$;
create function pg_temp.rodada(t text) returns int language sql as $$
 select (e->>'rodada')::int from jsonb_array_elements(funcionario_conferencia_lista(repeat('c',64))->'produtos') e where (e->>'produto_id')::uuid=pg_temp.u(t) $$;
create function pg_temp.tent(c text) returns jsonb language sql as $$ select tentativas from conferencias where id=pg_temp.u(c) $$;

-- 1. Ontem: arroz contado 8 (sistema 10) e largado na 2ª contagem.
set local role anon;
select pg_temp.ok(pg_temp.conta('c1','arroz',8,1)->>'situacao'='recontar','ontem: 8 pede recontagem');
reset role;
update conferencias set created_at = now() - interval '1 day' where id=pg_temp.u('c1');
-- 2. Mesmo dia continua (feijão começado hoje).
set local role anon;
select pg_temp.conta('c2','feijao',7,1);
select pg_temp.ok(pg_temp.rodada('feijao')=2,'mesmo dia: continua na contagem 2');
-- 3. Dia novo: a lista mostra contagem 1 e a contagem começa do zero (o 8 de ontem não vale).
select pg_temp.ok(pg_temp.rodada('arroz')=1,'outro dia: lista mostra contagem 1');
select pg_temp.ok(pg_temp.conta('c1','arroz',9,1)->>'situacao'='recontar','hoje: 9 pede recontagem');
reset role;
select pg_temp.ok(pg_temp.tent('c1')='[9]'::jsonb,'tentativas de ontem apagadas');
select pg_temp.ok((select (created_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date from conferencias where id=pg_temp.u('c1')),'início da contagem passa a ser hoje');
set local role anon;
select pg_temp.ok(pg_temp.conta('c1','arroz',9,1)->>'situacao'='recontar','reenvio da 1ª de hoje não muda nada');
select pg_temp.ok(pg_temp.rodada('arroz')=2,'depois do reenvio: contagem 2');
select pg_temp.ok(pg_temp.conta('c1','arroz',9,2)->>'situacao'='aguardando_dono','9 repetido hoje: espera o dono');
reset role;
select pg_temp.ok(pg_temp.tent('c1')='[9, 9]'::jsonb,'só contagens de hoje');
select pg_temp.ok((select diferenca_id is not null and situacao='inconsistente' from conferencias where id=pg_temp.u('c1')),'diferença para o dono');
select pg_temp.ok((select sum(quantidade) from saldos where produto_id=pg_temp.u('arroz') and area='deposito')=10,'estoque igual até o dono decidir');
rollback;
