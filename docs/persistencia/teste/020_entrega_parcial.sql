-- A4: entrega em duas vezes. O pedido espera o resto; o dono pode encerrar ("Não vem mais nada").
-- Banco descartável, dados simulados e transação desfeita. Nunca usar produção.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('a4-parcial-'||t)::uuid $$;
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
insert into auth.users values(pg_temp.u('dono'),'a4@teste.local'),(pg_temp.u('outro'),'a4-outro@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('dono'),'dono'),(pg_temp.u('outro'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('loja'),pg_temp.u('dono'),'mercado','Mercado simulado');
insert into fornecedores(id,dono_id,nome) values(pg_temp.u('forn'),pg_temp.u('dono'),'Distribuidora simulada');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por) values(pg_temp.u('func'),pg_temp.u('loja'),'Equipe simulada','ambos','765400',pg_temp.u('dono'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate)
 values(pg_temp.u('func'),pg_temp.u('loja'),encode(extensions.digest(repeat('a',64),'sha256'),'hex'),now()+interval '12 hours');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
create function pg_temp.produto(t text, nome text) returns jsonb language sql as $$
 select salvar_produto(jsonb_build_object('operacao_id',pg_temp.u('cad-'||t),'produto',jsonb_build_object(
  'id',pg_temp.u(t),'comercio_id',pg_temp.u('loja'),'nome',nome,'unidade','Unidade','categoria','Mercearia',
  'preco_compra',1,'preco_venda',2,'detalhes','{}'::jsonb,'controla_validade',false),
  'variacoes','[]'::jsonb,'areas',jsonb_build_array(
  jsonb_build_object('area','deposito','minimo',2,'maximo',50,'contagem',jsonb_build_object('quantidade',0)),
  jsonb_build_object('area','venda','minimo',2,'maximo',20,'contagem',jsonb_build_object('quantidade',0))))) $$;
select pg_temp.produto('arroz','Arroz simulado'), pg_temp.produto('feijao','Feijão simulado');
create function pg_temp.pedido(t text, arroz int, feijao int) returns void language plpgsql as $$
begin
  perform salvar_pedido(jsonb_build_object('id',pg_temp.u(t),'comercio_id',pg_temp.u('loja'),'fornecedor_id',pg_temp.u('forn'),
    'itens',(select jsonb_agg(x) from (
      select jsonb_build_object('produto_id',pg_temp.u('arroz'),'qtd_embalagens',arroz,'preco_estimado',1) x where arroz > 0
      union all select jsonb_build_object('produto_id',pg_temp.u('feijao'),'qtd_embalagens',feijao,'preco_estimado',1) where feijao > 0) y)));
  perform marcar_pedido_enviado(pg_temp.u(t),'copiado');
end $$;
create function pg_temp.conta(t text, n numeric) returns jsonb language sql as $$
 select jsonb_build_object('produto_id',pg_temp.u(t),'total',n,'avaria',0,'partes','[]'::jsonb) $$;
create function pg_temp.dep(t text) returns numeric language sql as $$
 select coalesce(sum(quantidade),0) from saldos where produto_id=pg_temp.u(t) and area='deposito' $$;
create function pg_temp.sit(t text) returns text language sql as $$ select situacao from pedidos_compra where id=pg_temp.u(t) $$;
create function pg_temp.na_lista(t text) returns boolean language sql as $$
 select exists (select 1 from jsonb_array_elements(funcionario_entregas(repeat('a',64))->'pedidos') e where (e->>'id')::uuid = pg_temp.u(t)) $$;
create function pg_temp.envia(rec text, rodada int, itens jsonb) returns text language sql as $$
 select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u(rec),rodada,itens)->>'situacao' $$;
select pg_temp.pedido('p1',10,6), pg_temp.pedido('p2',5,0), pg_temp.pedido('p3',5,0), pg_temp.pedido('p4',4,0);

-- 1. Primeira entrega: chegou o arroz; o feijão não veio. O pedido espera o resto e continua na lista da equipe.
set local role anon;
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r1a'),pg_temp.u('p1'),null);
select pg_temp.ok(pg_temp.envia('r1a',0,jsonb_build_array(pg_temp.conta('arroz',10),pg_temp.conta('feijao',0)))='recontar','feijão 0 de 6 pede recontagem');
select pg_temp.ok(pg_temp.envia('r1a',1,jsonb_build_array(pg_temp.conta('feijao',0)))='concluido','0 repetido: entrega conclui');
reset role;
select pg_temp.ok(pg_temp.sit('p1')='recebido_parcial','faltou feijão: pedido recebido em parte');
select pg_temp.ok(pg_temp.dep('arroz')=10 and pg_temp.dep('feijao')=0,'só o arroz entrou no depósito');
set local role anon;
select pg_temp.ok(pg_temp.na_lista('p1'),'pedido continua na lista da equipe');
-- 2. Segunda entrega: abre de novo (antes: pedido_ja_recebido) e só o feijão precisa ser contado.
select pg_temp.ok((select jsonb_agg(e->>'produto_id') from jsonb_array_elements(
  funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r1b'),pg_temp.u('p1'),null)->'produtos') e)
  = jsonb_build_array(pg_temp.u('feijao')::text),'segunda entrega confere só o que falta');
select pg_temp.ok(pg_temp.envia('r1b',0,jsonb_build_array(pg_temp.conta('feijao',6)))='concluido','feijão 6 bate com o que faltava e conclui');
select pg_temp.ok(not pg_temp.na_lista('p1'),'chegou tudo: sai da lista');
reset role;
select pg_temp.ok(pg_temp.sit('p1')='recebido','chegou tudo: pedido recebido');
select pg_temp.ok(pg_temp.dep('arroz')=10 and pg_temp.dep('feijao')=6,'feijão entrou sem duplicar o arroz');
select pg_temp.ok((select sum(qtd_recebida) from pedido_itens where pedido_id=pg_temp.u('p1'))=16,'pedido registra 16 recebidos');
select pg_temp.ok((select count(*) from recebimentos where pedido_id=pg_temp.u('p1') and situacao='concluido')=2,'duas entregas guardadas');

-- 3. Chegou menos e não vem mais nada: o dono encerra.
set local role anon;
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r2a'),pg_temp.u('p2'),null);
select pg_temp.envia('r2a',0,jsonb_build_array(pg_temp.conta('arroz',3)));
select pg_temp.ok(pg_temp.envia('r2a',1,jsonb_build_array(pg_temp.conta('arroz',3)))='concluido','3 de 5 repetido conclui');
select pg_temp.recusa($q$select encerrar_entrega_pedido(pg_temp.u('p2'))$q$,'permission denied for function encerrar_entrega_pedido');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.u('outro')::text,true);
select pg_temp.recusa($q$select encerrar_entrega_pedido(pg_temp.u('p2'))$q$,'sem_acesso_ao_comercio');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
select encerrar_entrega_pedido(pg_temp.u('p2'));
select pg_temp.ok(pg_temp.sit('p2')='recebido','encerrado: pedido recebido');
select pg_temp.ok((select entrega_encerrada_em is not null from pedidos_compra where id=pg_temp.u('p2')),'encerramento guardado');
select pg_temp.recusa($q$select encerrar_entrega_pedido(pg_temp.u('p2'))$q$,'pedido_nao_espera_entrega');
select pg_temp.recusa($q$select encerrar_entrega_pedido(pg_temp.u('p1'))$q$,'pedido_nao_espera_entrega');
set local role anon;
select pg_temp.ok(not pg_temp.na_lista('p2'),'encerrado sai da lista da equipe');
select pg_temp.recusa($q$select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r2b'),pg_temp.u('p2'),null)$q$,'pedido_fechado');
reset role;

-- 4. Contagem que não bateu: enquanto o dono não decide, a equipe não abre outra entrega (não conta em dobro).
set local role anon;
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r3a'),pg_temp.u('p3'),null);
select pg_temp.envia('r3a',0,jsonb_build_array(pg_temp.conta('arroz',1)));
select pg_temp.envia('r3a',1,jsonb_build_array(pg_temp.conta('arroz',2)));
select pg_temp.ok(pg_temp.envia('r3a',2,jsonb_build_array(pg_temp.conta('arroz',4)))='concluido','1, 2 e 4: entrega conclui com produto separado');
select pg_temp.ok(not pg_temp.na_lista('p3'),'produto separado: fora da lista da equipe');
select pg_temp.recusa($q$select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r3b'),pg_temp.u('p3'),null)$q$,'pedido_ja_recebido');
reset role;
select resolver_item_recebimento((select id from recebimento_itens where recebimento_id=pg_temp.u('r3a')),'aceitar',1);
select pg_temp.ok(pg_temp.sit('p3')='recebido_parcial','dono aceitou 2 de 5: espera o resto');
set local role anon;
select pg_temp.ok(pg_temp.na_lista('p3'),'depois da decisão, volta para a lista');
reset role;

-- 5. Encerrar com a equipe contando é recusado.
set local role anon;
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r4a'),pg_temp.u('p4'),null);
select pg_temp.envia('r4a',0,jsonb_build_array(pg_temp.conta('arroz',1)));
select pg_temp.envia('r4a',1,jsonb_build_array(pg_temp.conta('arroz',1)));
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r4b'),pg_temp.u('p4'),null);
reset role;
select pg_temp.recusa($q$select encerrar_entrega_pedido(pg_temp.u('p4'))$q$,'recebimento_em_contagem');

-- 6. Funções internas fechadas.
select pg_temp.ok(not has_function_privilege('anon','public._pedido_recebe_resto(uuid)','execute')
  and not has_function_privilege('authenticated','public._pedido_resto(uuid,uuid,uuid)','execute')
  and not has_function_privilege('anon','public.encerrar_entrega_pedido(uuid)','execute'),'funções internas fechadas; encerrar só para quem entrou');
select 'OK A4: entrega em duas vezes' as resultado;
rollback;
