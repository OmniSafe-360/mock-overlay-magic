-- Teste em banco descartável montado com TODAS as migrações. Nunca usar produção.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5(t)::uuid $$;
create function pg_temp.ok(b boolean, nome text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', nome; end if; return 'OK ' || nome; end $$;
create function pg_temp.recusa(s text, msg text, estado text) returns text language plpgsql as $$
declare sucesso boolean := false; st text; m text;
begin
  begin execute s; sucesso := true; raise exception 'sucesso_inesperado' using errcode='T0K00';
  exception when others then get stacked diagnostics st=returned_sqlstate, m=message_text; end;
  if sucesso or st is distinct from estado or m <> msg then raise exception 'FALHOU: esperado % [%], veio % [%]', msg, estado, m, st; end if;
  return 'OK recusou ' || msg;
end $$;
insert into auth.users values (pg_temp.u('aud-dono'), 'dono@teste.local'), (pg_temp.u('aud-outro'), 'outro@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('aud-dono'),'dono'),(pg_temp.u('aud-outro'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('aud-loja'),pg_temp.u('aud-dono'),'mercado','Loja teste');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por) values(pg_temp.u('aud-func'),pg_temp.u('aud-loja'),'Funcionário teste','ambos','654321',pg_temp.u('aud-dono'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate) values(pg_temp.u('aud-func'),pg_temp.u('aud-loja'),encode(extensions.digest(repeat('a',64),'sha256'),'hex'),now()+interval '12 hours');
select set_config('request.jwt.claim.sub',pg_temp.u('aud-dono')::text,true);
select salvar_produto(jsonb_build_object('operacao_id',pg_temp.u('aud-inicial'),'produto',jsonb_build_object(
 'id',pg_temp.u('aud-prod'),'comercio_id',pg_temp.u('aud-loja'),'nome','Produto auditado','unidade','Unidade','categoria','Mercearia',
 'preco_compra',1,'preco_venda',2,'detalhes','{}'::jsonb,'controla_validade',true,'avisos_dias','[30]'::jsonb),
 'variacoes','[]'::jsonb,'areas',jsonb_build_array(
 jsonb_build_object('area','deposito','minimo',2,'maximo',20,'contagem',jsonb_build_object('quantidade',14,'partes',jsonb_build_array(
 jsonb_build_object('quantidade',5,'vencimento',(now() at time zone 'America/Sao_Paulo')::date-1,'numero','VENCIDO'),
 jsonb_build_object('quantidade',4,'vencimento',(now() at time zone 'America/Sao_Paulo')::date,'numero','HOJE'),
 jsonb_build_object('quantidade',3,'vencimento',(now() at time zone 'America/Sao_Paulo')::date+30,'numero','DEPOIS'),
 jsonb_build_object('quantidade',2)))),
 jsonb_build_object('area','venda','minimo',3,'maximo',10,'contagem',jsonb_build_object('quantidade',2,'partes',jsonb_build_array(
 jsonb_build_object('quantidade',2,'vencimento',(now() at time zone 'America/Sao_Paulo')::date+30,'numero','DEPOIS')))))));
select pg_temp.ok(_saldo_reponivel(pg_temp.u('aud-prod'),null)=7,'saldo reponível exclui vencidos e pendências; hoje vale');
set local role anon;
select pg_temp.ok((funcionario_reposicao_contar(repeat('a',64),pg_temp.u('aud-repor'),pg_temp.u('aud-prod'),null,2)->>'sugerido')::numeric=7,'sugestão considera apenas estoque elegível');
select pg_temp.recusa($q$select funcionario_reposicao_concluir(repeat('a',64),pg_temp.u('aud-repor'),8)$q$,'reposicao_acima_sugerido','23514');
select pg_temp.recusa($q$select funcionario_reposicao_contar(repeat('a',64),pg_temp.u('aud-repor'),pg_temp.u('aud-prod'),null,3)$q$,'operacao_repetida_com_outros_dados','23514');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('aud-prod'),null,'deposito')=14,'recusa preserva estoque e não cria operação');
update produto_areas set maximo=5 where produto_id=pg_temp.u('aud-prod') and area='venda';
set local role anon;
select pg_temp.recusa($q$select funcionario_reposicao_concluir(repeat('a',64),pg_temp.u('aud-repor'),4)$q$,'reposicao_acima_maximo','23514');
reset role;
update produto_areas set maximo=10 where produto_id=pg_temp.u('aud-prod') and area='venda';
set local role anon;
select funcionario_reposicao_concluir(repeat('a',64),pg_temp.u('aud-repor'),7);
select funcionario_reposicao_concluir(repeat('a',64),pg_temp.u('aud-repor'),7);
select pg_temp.recusa($q$select funcionario_reposicao_concluir(repeat('a',64),pg_temp.u('aud-repor'),6)$q$,'operacao_repetida_com_outros_dados','23514');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('aud-prod'),null,'deposito')=7 and saldo_chave(pg_temp.u('aud-prod'),null,'venda')=9,'transferência não altera o total físico');
select pg_temp.ok((select count(*) from operacoes where produto_id=pg_temp.u('aud-prod'))=2,'repetir conclusão não duplica operação');
select pg_temp.ok((select sum(s.quantidade) from saldos s join lotes l on l.id=s.lote_id where s.produto_id=pg_temp.u('aud-prod') and l.numero='VENCIDO' and s.area='deposito')=5,'vencidos continuam no depósito');
select pg_temp.ok((select sum(quantidade) from movimentos where produto_id=pg_temp.u('aud-prod'))=16,'histórico fecha com o estoque total');
set local role anon;
select funcionario_registrar_perda(repeat('a',64),pg_temp.u('aud-perda'),pg_temp.u('aud-prod'),null,'deposito',5,'venceu','Retirado');
select funcionario_registrar_perda(repeat('a',64),pg_temp.u('aud-perda'),pg_temp.u('aud-prod'),null,'deposito',5,'venceu','Retirado');
select pg_temp.recusa($q$select funcionario_registrar_perda(repeat('a',64),pg_temp.u('aud-perda'),pg_temp.u('aud-prod'),null,'deposito',4,'venceu','Retirado')$q$,'operacao_repetida_com_outros_dados','23514');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('aud-prod'),null,'deposito')=2 and _saldo_reponivel(pg_temp.u('aud-prod'),null)=0,'perda ainda pode retirar vencidos sem tocar nas pendências');
set local role anon;
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('aud-receber'),null,null);
select pg_temp.recusa($q$select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('aud-receber'),0,jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('aud-prod'),'total',2,'avaria',0,'partes',jsonb_build_array(jsonb_build_object('quantidade',2,'vencimento',(now() at time zone 'America/Sao_Paulo')::date-1)))))$q$,'recebimento_vencido_como_bom','23514');
select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('aud-receber'),0,jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('aud-prod'),'total',2,'avaria',2,'partes','[]'::jsonb)));
select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('aud-receber'),0,jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('aud-prod'),'total',2,'avaria',2,'partes','[]'::jsonb)));
select pg_temp.recusa($q$select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('aud-receber'),0,jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('aud-prod'),'total',3,'avaria',3,'partes','[]'::jsonb)))$q$,'operacao_repetida_com_outros_dados','23514');
select pg_temp.recusa($q$select funcionario_reposicao_concluir(repeat('b',64),pg_temp.u('aud-repor'),7)$q$,'acesso_encerrado','42501');
reset role;
select pg_temp.ok(not has_function_privilege('anon','public._saldo_reponivel(uuid,uuid)','EXECUTE') and not has_function_privilege('authenticated','public._tirar_saldo_reposicao(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid,tipo_movimento,uuid)','EXECUTE'),'helpers internos não ficam públicos');
select pg_temp.ok(not has_table_privilege('authenticated','public.saldos','INSERT'),'escrita direta no estoque continua bloqueada');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.u('aud-outro')::text,true);
select pg_temp.ok(not exists(select 1 from saldos where comercio_id=pg_temp.u('aud-loja')),'outro dono não lê saldos');
reset role;
rollback;
