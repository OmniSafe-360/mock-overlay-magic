-- Banco descartável, dados simulados e transação desfeita. Nunca usar produção.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('coerencia-'||t)::uuid $$;
create function pg_temp.ok(b boolean, nome text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', nome; end if; return 'OK '||nome; end $$;
create function pg_temp.recusa(s text, msg text, estado text) returns text language plpgsql as $$
declare st text; m text;
begin
  begin execute s; raise exception 'sucesso_inesperado' using errcode='T0K00';
  exception when others then get stacked diagnostics st=returned_sqlstate,m=message_text; end;
  if st is distinct from estado or m <> msg then raise exception 'FALHOU: esperado % [%], veio % [%]',msg,estado,m,st; end if;
  return 'OK recusou '||msg;
end $$;
insert into auth.users values(pg_temp.u('dono'),'coerencia@teste.local'),(pg_temp.u('outro'),'outro-coerencia@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('dono'),'dono'),(pg_temp.u('outro'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('loja'),pg_temp.u('dono'),'mercado','União simulada'),(pg_temp.u('outra-loja'),pg_temp.u('outro'),'mercado','Outra loja');
insert into fornecedores(id,dono_id,nome) values(pg_temp.u('fornecedor'),pg_temp.u('dono'),'Monica simulada');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por) values
 (pg_temp.u('func'),pg_temp.u('loja'),'Equipe simulada','ambos','654321',pg_temp.u('dono')),
 (pg_temp.u('outro-func'),pg_temp.u('outra-loja'),'Outra equipe','ambos','654322',pg_temp.u('outro'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate) values
 (pg_temp.u('func'),pg_temp.u('loja'),encode(extensions.digest(repeat('a',64),'sha256'),'hex'),now()+interval '12 hours'),
 (pg_temp.u('outro-func'),pg_temp.u('outra-loja'),encode(extensions.digest(repeat('b',64),'sha256'),'hex'),now()+interval '12 hours');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
-- Kapo chega por unidade; 200 ml é o tamanho da embalagem de venda, não um multiplicador.
select salvar_produto(jsonb_build_object('operacao_id',pg_temp.u('cadastro-kapo'),'produto',jsonb_build_object(
 'id',pg_temp.u('kapo'),'comercio_id',pg_temp.u('loja'),'nome','Kapo 200 ml simulado','unidade','Unidade','categoria','Bebidas',
 'preco_compra',2.99,'preco_venda',4.99,'detalhes','{}'::jsonb,'controla_validade',true,'avisos_dias','[30]'::jsonb),
 'variacoes','[]'::jsonb,'areas',jsonb_build_array(
 jsonb_build_object('area','deposito','minimo',5,'maximo',50,'contagem',jsonb_build_object('quantidade',0)),
 jsonb_build_object('area','venda','minimo',10,'maximo',80,'contagem',jsonb_build_object('quantidade',0)))));
select salvar_produto(jsonb_build_object('operacao_id',pg_temp.u('cadastro-bicarbonato'),'produto',jsonb_build_object(
 'id',pg_temp.u('bicarbonato'),'comercio_id',pg_temp.u('loja'),'nome','Bicarbonato simulado','unidade','Unidade','categoria','Mercearia',
 'preco_compra',1,'preco_venda',2,'detalhes','{}'::jsonb,'controla_validade',false),
 'variacoes','[]'::jsonb,'areas',jsonb_build_array(
 jsonb_build_object('area','deposito','minimo',2,'maximo',10,'contagem',jsonb_build_object('quantidade',0)),
 jsonb_build_object('area','venda','minimo',2,'maximo',10,'contagem',jsonb_build_object('quantidade',0)))));
select salvar_produto(jsonb_build_object('operacao_id',pg_temp.u('cadastro-vencido'),'produto',jsonb_build_object(
 'id',pg_temp.u('vencido'),'comercio_id',pg_temp.u('loja'),'nome','Produto vencido simulado','unidade','Unidade','categoria','Mercearia',
 'preco_compra',1,'preco_venda',2,'detalhes','{}'::jsonb,'controla_validade',true,'avisos_dias','[30]'::jsonb),
 'variacoes','[]'::jsonb,'areas',jsonb_build_array(
 jsonb_build_object('area','deposito','minimo',2,'maximo',10,'contagem',jsonb_build_object('quantidade',2,'partes',jsonb_build_array(
 jsonb_build_object('quantidade',2,'vencimento',(now() at time zone 'America/Sao_Paulo')::date-1)))),
 jsonb_build_object('area','venda','minimo',2,'maximo',10,'contagem',jsonb_build_object('quantidade',0)))));
select salvar_produto(jsonb_build_object('operacao_id',pg_temp.u('cadastro-desconhecido'),'produto',jsonb_build_object(
 'id',pg_temp.u('desconhecido'),'comercio_id',pg_temp.u('loja'),'nome','Produto sem contagem','unidade','Unidade','categoria','Mercearia',
 'preco_compra',1,'preco_venda',2,'detalhes','{}'::jsonb,'controla_validade',false),
 'variacoes','[]'::jsonb,'areas',jsonb_build_array(
 jsonb_build_object('area','deposito','minimo',2,'maximo',10),
 jsonb_build_object('area','venda','minimo',2,'maximo',10,'contagem',jsonb_build_object('quantidade',0)))));
create function pg_temp.pedido(t text) returns jsonb language sql as $$
 select salvar_pedido(jsonb_build_object('id',pg_temp.u(t),'comercio_id',pg_temp.u('loja'),'fornecedor_id',pg_temp.u('fornecedor'),
  'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('kapo'),'qtd_embalagens',50,'preco_estimado',2.99),
   jsonb_build_object('produto_id',pg_temp.u('bicarbonato'),'qtd_embalagens',5,'preco_estimado',1))));
$$;
create function pg_temp.contagem(t text,n numeric) returns jsonb language sql as $$
 select jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u(t),'total',n,'avaria',0,'partes',case when t='kapo' and n>0
   then jsonb_build_array(jsonb_build_object('quantidade',n,'vencimento',(now() at time zone 'America/Sao_Paulo')::date+30)) else '[]'::jsonb end));
$$;
select pg_temp.pedido('pedido-1');
select marcar_pedido_enviado(pg_temp.u('pedido-1'),'copiado');
select pg_temp.pedido('pedido-2');
select marcar_pedido_enviado(pg_temp.u('pedido-2'),'copiado');
select pg_temp.ok(_motivo_sem_reposicao(pg_temp.u('kapo'),null)='deposito_sem_estoque','zero conhecido é depósito sem estoque');
select pg_temp.ok(_motivo_sem_reposicao(pg_temp.u('vencido'),null)='estoque_nao_liberado','saldo físico vencido não é depósito vazio');
select pg_temp.ok(_motivo_sem_reposicao(pg_temp.u('desconhecido'),null)='deposito_nao_contado','quantidade desconhecida não é zero');
set local role anon;
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('recebimento-1'),pg_temp.u('pedido-1'),null);
select pg_temp.ok((funcionario_reposicao_contar(repeat('a',64),pg_temp.u('repor-antes'),pg_temp.u('kapo'),null,0,1)->>'motivo_sem_reposicao')='recebimento_em_conferencia','entrega aberta não libera estoque');
select funcionario_reposicao_concluir(repeat('a',64),pg_temp.u('repor-antes'),0);
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-1'),0,pg_temp.contagem('kapo',110))->'recontar')->0->>'produto_id'=pg_temp.u('kapo')::text,'110 exige recontagem');
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-1'),1,pg_temp.contagem('bicarbonato',5))->'recontar')->0->>'produto_id'=pg_temp.u('kapo')::text,'enviar somente bicarbonato não ignora recontagem anterior');
-- Reenvio exato da rodada não cria tentativa a mais.
select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-1'),1,pg_temp.contagem('bicarbonato',5));
select pg_temp.recusa($q$select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-1'),1,pg_temp.contagem('bicarbonato',6))$q$,'operacao_repetida_com_outros_dados','23514');
reset role;
select pg_temp.ok((select situacao from recebimentos where id=pg_temp.u('recebimento-1'))='contando'
 and saldo_chave(pg_temp.u('kapo'),null,'deposito')=0 and saldo_chave(pg_temp.u('bicarbonato'),null,'deposito')=0,'produto aceito aguarda entrega; nenhuma entrada parcial');
select pg_temp.ok((select jsonb_array_length(tentativas) from recebimento_itens where recebimento_id=pg_temp.u('recebimento-1') and produto_id=pg_temp.u('bicarbonato'))=1,'reenvio não duplica tentativa');
set local role anon;
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-1'),2,pg_temp.contagem('kapo',0))->>'situacao')='recontar','0 diferente de 110 ainda pede recontagem');
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-1'),3,pg_temp.contagem('kapo',50))->>'situacao')='concluido','110 → 0 → 50: critério atual aceita o esperado sem exigir repetição');
select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-1'),3,pg_temp.contagem('kapo',50));
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('kapo'),null,'deposito')=50 and saldo_chave(pg_temp.u('bicarbonato'),null,'deposito')=5,'conclusão entra uma única vez em unidades de venda');
select pg_temp.ok((select count(*) from operacoes where produto_id=pg_temp.u('kapo') and tipo='recebimento')=1,'repetir conclusão não duplica entrada');
set local role anon;
select pg_temp.ok((funcionario_reposicao_contar(repeat('a',64),pg_temp.u('repor-depois'),pg_temp.u('kapo'),null,0,1)->>'sugerido')::numeric=50,'gôndola comporta 80; depósito limita sugestão a 50');
select funcionario_reposicao_concluir(repeat('a',64),pg_temp.u('repor-depois'),50);
select funcionario_reposicao_concluir(repeat('a',64),pg_temp.u('repor-depois'),50);
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('kapo'),null,'deposito')=0 and saldo_chave(pg_temp.u('kapo'),null,'venda')=50,'reposição transfere 50 sem perder estoque');
select pg_temp.ok((select sum(quantidade) from movimentos where produto_id=pg_temp.u('kapo'))=50,'histórico fecha com depósito + venda');
select pg_temp.ok((select sum(s.quantidade) from saldos s join lotes l on l.id=s.lote_id where s.produto_id=pg_temp.u('kapo') and s.area='venda' and l.vencimento=(now() at time zone 'America/Sao_Paulo')::date+30)=50,'reposição conserva validade');
set local role anon;
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('recebimento-2'),pg_temp.u('pedido-2'),null);
select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-2'),0,pg_temp.contagem('kapo',11));
select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-2'),1,pg_temp.contagem('kapo',12));
-- A terceira quantidade diferente vira decisão do dono, nunca "conferido" na resposta.
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-2'),2,pg_temp.contagem('kapo',13))->'itens')->0->>'situacao'='inconsistente','envio parcial devolve situação aguardando dono');
reset role;
select pg_temp.ok((select ultimo_resultado::text from recebimentos where id=pg_temp.u('recebimento-2')) !~ 'esperado|quantidade_aceita|tentativas','resposta da equipe não expõe quantidade esperada ou tentativas');
select pg_temp.ok(_motivo_sem_reposicao(pg_temp.u('kapo'),null)='estoque_nao_liberado','inconsistência sem entrada aguarda liberação');
set local role anon;
-- Produto que não veio: duas contagens iguais (0), sem validade, preservam o critério existente.
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-2'),3,pg_temp.contagem('bicarbonato',0))->>'situacao')='recontar','Não veio pede conferência quando difere do esperado');
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('recebimento-2'),4,pg_temp.contagem('bicarbonato',0))->>'situacao')='concluido','repetir zero aceita falta sem bloquear decisão do dono');
select pg_temp.recusa($q$select funcionario_enviar_recebimento(repeat('b',64),pg_temp.u('recebimento-2'),4,pg_temp.contagem('bicarbonato',0))$q$,'recebimento_nao_encontrado','42501');
select pg_temp.recusa($q$select funcionario_reposicao_contar(repeat('b',64),pg_temp.u('outro-repor'),pg_temp.u('kapo'),null,0,1)$q$,'produto_de_outro_comercio','42501');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('kapo'),null,'deposito')=0 and saldo_chave(pg_temp.u('kapo'),null,'venda')=50,'inconsistente não entra nem altera estoque anterior');
select pg_temp.ok(not has_function_privilege('anon','public._motivo_sem_reposicao(uuid,uuid)','EXECUTE')
 and not has_function_privilege('authenticated','public._motivo_sem_reposicao(uuid,uuid)','EXECUTE'),'motivo interno não fica público');
select pg_temp.ok(has_function_privilege('anon','public.funcionario_enviar_recebimento(text,uuid,integer,jsonb)','EXECUTE')
 and not has_table_privilege('anon','public.saldos','SELECT'),'equipe usa somente RPC autorizada');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.u('outro')::text,true);
select pg_temp.ok(not exists(select 1 from recebimento_itens where comercio_id=pg_temp.u('loja')),'outro dono não vê recebimento');
reset role;
rollback;
