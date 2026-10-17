-- A2: recebimento não fica preso em "Conte de novo" quando o lote já existe com outra validade.
-- Banco descartável, dados simulados e transação desfeita. Nunca usar produção.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('a2-lote-'||t)::uuid $$;
create function pg_temp.ok(b boolean, nome text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', nome; end if; return 'OK '||nome; end $$;
insert into auth.users values(pg_temp.u('dono'),'a2@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('dono'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('farm'),pg_temp.u('dono'),'farmacia','Farmácia simulada');
insert into fornecedores(id,dono_id,nome) values(pg_temp.u('forn'),pg_temp.u('dono'),'Distribuidora simulada');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por) values(pg_temp.u('func'),pg_temp.u('farm'),'Equipe simulada','ambos','765432',pg_temp.u('dono'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate)
 values(pg_temp.u('func'),pg_temp.u('farm'),encode(extensions.digest(repeat('a',64),'sha256'),'hex'),now()+interval '12 hours');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
create function pg_temp.d(n int) returns text language sql as $$ select ((now() at time zone 'America/Sao_Paulo')::date+n)::text $$;
-- Remédio já tem o lote AB1 no estoque com validade daqui a 60 dias.
select salvar_produto(jsonb_build_object('operacao_id',pg_temp.u('cad-rem'),'produto',jsonb_build_object(
 'id',pg_temp.u('rem'),'comercio_id',pg_temp.u('farm'),'nome','Remédio simulado','unidade','Caixa','categoria','Medicamentos',
 'preco_compra',10,'preco_venda',20,'detalhes','{}'::jsonb,'controla_validade',true,'avisos_dias','[30,60,90]'::jsonb),
 'variacoes','[]'::jsonb,'areas',jsonb_build_array(
 jsonb_build_object('area','deposito','minimo',2,'maximo',50,'contagem',jsonb_build_object('quantidade',5,'partes',jsonb_build_array(
   jsonb_build_object('quantidade',5,'vencimento',pg_temp.d(60),'numero','AB1')))),
 jsonb_build_object('area','venda','minimo',2,'maximo',20,'contagem',jsonb_build_object('quantidade',0)))));
select salvar_produto(jsonb_build_object('operacao_id',pg_temp.u('cad-out'),'produto',jsonb_build_object(
 'id',pg_temp.u('out'),'comercio_id',pg_temp.u('farm'),'nome','Outro remédio simulado','unidade','Caixa','categoria','Medicamentos',
 'preco_compra',5,'preco_venda',9,'detalhes','{}'::jsonb,'controla_validade',true,'avisos_dias','[30,60,90]'::jsonb),
 'variacoes','[]'::jsonb,'areas',jsonb_build_array(
 jsonb_build_object('area','deposito','minimo',2,'maximo',50,'contagem',jsonb_build_object('quantidade',0)),
 jsonb_build_object('area','venda','minimo',2,'maximo',20,'contagem',jsonb_build_object('quantidade',0)))));
create function pg_temp.itens(lote text, venc text) returns jsonb language sql as $$
 select jsonb_build_array(
  jsonb_build_object('produto_id',pg_temp.u('rem'),'total',3,'avaria',0,'partes',jsonb_build_array(jsonb_build_object('quantidade',3,'vencimento',venc,'lote',lote))),
  jsonb_build_object('produto_id',pg_temp.u('out'),'total',4,'avaria',0,'partes',jsonb_build_array(jsonb_build_object('quantidade',4,'vencimento',pg_temp.d(90),'lote','ZZ9')))) $$;
create function pg_temp.dep(t text) returns numeric language sql as $$ select coalesce(sum(quantidade),0) from saldos where produto_id=pg_temp.u(t) and area='deposito' $$;

set local role anon;
-- 1. Lote AB1 chega com validade de 30 dias (o cadastro diz 60): volta uma vez para conferir, com o motivo.
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('rec-1'),null,pg_temp.u('forn'));
select set_config('a2.r0',funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec-1'),0,pg_temp.itens('AB1',pg_temp.d(30)))::text,true);
select pg_temp.ok(current_setting('a2.r0')::jsonb->>'situacao'='recontar'
  and (current_setting('a2.r0')::jsonb->'recontar'->0->>'motivo')='lote_outra_data','1ª vez: volta para conferir com o motivo');
-- 2. A equipe confere e envia de novo os mesmos dados: não volta outra vez; a entrega conclui e o item fica para o dono.
select set_config('a2.r1',funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec-1'),1,pg_temp.itens('AB1',pg_temp.d(30)))::text,true);
select pg_temp.ok(current_setting('a2.r1')::jsonb->>'situacao'='concluido','2ª vez igual: entrega conclui (sem laço)');
reset role;
select pg_temp.ok((select situacao from recebimento_itens where recebimento_id=pg_temp.u('rec-1') and produto_id=pg_temp.u('rem'))='inconsistente','remédio fica separado para o dono');
select pg_temp.ok(pg_temp.dep('rem')=5,'remédio não entrou no estoque (lote AB1 continua com 5)');
select pg_temp.ok(pg_temp.dep('out')=4,'o outro produto da entrega entrou no estoque');
select pg_temp.ok((select vencimento from lotes where produto_id=pg_temp.u('rem') and numero='AB1')=pg_temp.d(60)::date,'validade cadastrada do lote não foi trocada');

set local role anon;
-- 3. Se na segunda vez a equipe corrige a data (era 60 dias), entra normalmente no lote AB1.
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('rec-2'),null,pg_temp.u('forn'));
select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec-2'),0,pg_temp.itens('AB1',pg_temp.d(30)));
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec-2'),1,pg_temp.itens('AB1',pg_temp.d(60)))->>'situacao')='concluido','data corrigida conclui');
reset role;
select pg_temp.ok((select situacao from recebimento_itens where recebimento_id=pg_temp.u('rec-2') and produto_id=pg_temp.u('rem'))='aceito','data corrigida é aceita');
select pg_temp.ok(pg_temp.dep('rem')=8,'data corrigida entrou no lote AB1 (5+3)');

set local role anon;
-- 4. Lote novo (sem conflito) entra direto, sem voltar.
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('rec-3'),null,pg_temp.u('forn'));
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec-3'),0,pg_temp.itens('CD2',pg_temp.d(30)))->>'situacao')='concluido','lote novo conclui de primeira');
-- 5. Reenvio da mesma rodada (internet caiu) devolve a mesma resposta, sem contar de novo.
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec-3'),0,pg_temp.itens('CD2',pg_temp.d(30)))->>'situacao')='concluido','reenvio igual não duplica');
reset role;
select pg_temp.ok(pg_temp.dep('rem')=11 and pg_temp.dep('out')=12,'estoque sem duplicação (rem 5+3+3, out 4+4+4)');
select 'OK A2: lote com outra data não prende a entrega' as resultado;
rollback;
