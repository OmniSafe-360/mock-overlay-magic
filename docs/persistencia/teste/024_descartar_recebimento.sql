-- A10: o dono encerra a contagem de recebimento largada no meio; nada entra no estoque e o pedido volta a esperar.
-- Banco descartável, dados simulados e transação desfeita. Nunca usar produção.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('a10-descarte-'||t)::uuid $$;
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
insert into auth.users values(pg_temp.u('dono'),'a10@teste.local'),(pg_temp.u('outro'),'a10-outro@teste.local');
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
create function pg_temp.recebida(t text) returns numeric language sql as $$
 select coalesce(sum(qtd_recebida),0) from pedido_itens where pedido_id=pg_temp.u('p1') and produto_id=pg_temp.u(t) $$;
select pg_temp.pedido('p1',10,6);

-- 1. A equipe começa a contar e larga no meio: arroz bateu, feijão pediu recontagem. Nada entrou no estoque.
set local role anon;
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r1'),pg_temp.u('p1'),null);
select pg_temp.ok(pg_temp.envia('r1',0,jsonb_build_array(pg_temp.conta('arroz',10),pg_temp.conta('feijao',3)))='recontar','feijão pede recontagem; contagem fica aberta');
reset role;
select pg_temp.ok(pg_temp.dep('arroz')=0 and pg_temp.dep('feijao')=0,'contagem aberta não mexe no estoque');

-- 2. Outro dono e visitante não encerram.
select set_config('request.jwt.claim.sub',pg_temp.u('outro')::text,true);
select pg_temp.recusa($q$select descartar_recebimento(pg_temp.u('r1'))$q$,'sem_permissao');
set local role anon;
select pg_temp.recusa($q$select descartar_recebimento(pg_temp.u('r1'))$q$,'permission denied for function descartar_recebimento');
reset role;

-- 3. O dono encerra. Repetir não muda nada. Estoque igual.
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
select pg_temp.ok(descartar_recebimento(pg_temp.u('r1'))->>'situacao'='descartado','dono encerrou a contagem');
select pg_temp.ok(descartar_recebimento(pg_temp.u('r1'))->>'situacao'='repetida','repetir: repetida');
select pg_temp.ok((select situacao='descartado' and descartado_em is not null from recebimentos where id=pg_temp.u('r1')),'situação descartado');
select pg_temp.ok(pg_temp.dep('arroz')=0 and pg_temp.dep('feijao')=0,'estoque continua igual');

-- 3b. Produto separado para o dono numa contagem encerrada não trava a reposição (ajuste do Codex, PR #197).
select pg_temp.pedido('p2',5,2);
set local role anon;
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r3'),pg_temp.u('p2'),null);
select pg_temp.envia('r3',0,jsonb_build_array(pg_temp.conta('arroz',1)));
select pg_temp.envia('r3',1,jsonb_build_array(pg_temp.conta('arroz',2)));
select pg_temp.envia('r3',2,jsonb_build_array(pg_temp.conta('arroz',3)));
reset role;
select pg_temp.ok((select situacao from recebimentos where id=pg_temp.u('r3'))='contando','feijão não contado: contagem continua aberta');
select pg_temp.ok((select situacao from recebimento_itens where recebimento_id=pg_temp.u('r3') and produto_id=pg_temp.u('arroz'))='inconsistente','arroz separado para o dono');
select pg_temp.ok(public._motivo_sem_reposicao(pg_temp.u('arroz'),null)='estoque_nao_liberado','antes: reposição travada');
select pg_temp.ok(descartar_recebimento(pg_temp.u('r3'))->>'situacao'='descartado','dono encerrou a contagem do p2');
select pg_temp.ok(public._motivo_sem_reposicao(pg_temp.u('arroz'),null) is distinct from 'estoque_nao_liberado','depois: a contagem encerrada não trava a reposição');

-- 4. O celular com a contagem antiga é avisado; a equipe começa outra e conclui. Só a contagem nova vale.
set local role anon;
select pg_temp.recusa($q$select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r1'),pg_temp.u('p1'),null)$q$,'recebimento_descartado');
select pg_temp.recusa($q$select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('r1'),1,jsonb_build_array(pg_temp.conta('feijao',6)))$q$,'recebimento_descartado');
select pg_temp.ok(pg_temp.na_lista('p1'),'pedido continua na lista da equipe');
select pg_temp.ok((funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('r2'),pg_temp.u('p1'),null)->>'id')::uuid=pg_temp.u('r2'),'nova contagem abre com outro id');
select pg_temp.ok(pg_temp.envia('r2',0,jsonb_build_array(pg_temp.conta('arroz',10),pg_temp.conta('feijao',6)))='concluido','nova contagem conclui');
reset role;
select pg_temp.ok(pg_temp.dep('arroz')=10 and pg_temp.dep('feijao')=6,'estoque só da contagem nova');
select pg_temp.ok(pg_temp.recebida('arroz')=10 and pg_temp.recebida('feijao')=6,'recebido no pedido sem somar a contagem encerrada');
select pg_temp.ok(pg_temp.sit('p1')='recebido','pedido recebido');

-- 5. Contagem concluída não pode ser encerrada.
select pg_temp.recusa($q$select descartar_recebimento(pg_temp.u('r2'))$q$,'recebimento_ja_concluido');
select 'OK A10' as resultado;
rollback;
