-- Asserções transacionais da regra aprovada em 12/10/2026. Usar com 014_base_contagem_cega.sql,
-- sempre entre begin e rollback; dados fictícios, nenhum saldo real é alterado.
set local role anon;
select pg_temp.ok((funcionario_reposicao_contar(repeat('f',64),pg_temp.u('rg'),pg_temp.u('g'),null,3,1)->>'situacao')='recontar','gôndola pede segunda contagem');
select pg_temp.ok((funcionario_reposicao_contar(repeat('f',64),pg_temp.u('rg'),pg_temp.u('g'),null,3,1)->>'rodada')='2','reenvio mantém segunda rodada');
select pg_temp.recusa($q$select funcionario_reposicao_contar(repeat('f',64),pg_temp.u('rg'),pg_temp.u('g'),null,4,1)$q$,'operacao_repetida_com_outros_dados');
select pg_temp.recusa($q$select funcionario_reposicao_contar(repeat('f',64),pg_temp.u('rg'),pg_temp.u('g'),null,3,3)$q$,'rodada_desatualizada');
select pg_temp.ok((funcionario_reposicao_contar(repeat('f',64),pg_temp.u('rg'),pg_temp.u('g'),null,3,2)->>'situacao')='aguardando_dono','duas iguais com diferença aguardam dono');
select pg_temp.ok((funcionario_reposicao_contar(repeat('f',64),pg_temp.u('rg-novo'),pg_temp.u('g'),null,0,1)->>'situacao')='aguardando_dono','ID novo não contorna pendência');
select pg_temp.ok((funcionario_reposicao_contar(repeat('f',64),pg_temp.u('rg'),pg_temp.u('g'),null,3,2)->>'situacao')='aguardando_dono','reenvio não cria outra diferença');
select pg_temp.recusa($q$select funcionario_reposicao_contar(repeat('f',64),pg_temp.u('antigo'),pg_temp.u('ok'),null,0)$q$,'contagem_exige_atualizacao');
select pg_temp.ok(not jsonb_path_exists(funcionario_reposicao_lista(repeat('f',64)),'$.**.esperado'),'lista não revela quantidade esperada');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('g'),null,'venda')=0 and saldo_chave(pg_temp.u('g'),null,'deposito')=1000,'gôndola/depósito não mudam durante pendência');
select pg_temp.ok((select count(*) from conferencias where produto_id=pg_temp.u('g'))=1 and (select count(*) from diferencas where produto_id=pg_temp.u('g'))=1,'uma conferência e uma diferença');
select pg_temp.ok((select (detalhes->>'contagem_confirmada')::boolean and diferenca=3 and valor=6 from diferencas where produto_id=pg_temp.u('g')),'dono recebe +3 e custo, ainda sem acerto');
select pg_temp.ok((select count(*) from operacoes where produto_id=pg_temp.u('g'))=2,'pendência não gera ajuste de estoque');
select set_config('cega.diferenca',(select id::text from diferencas where produto_id=pg_temp.u('g')),true);
select set_config('request.jwt.claim.sub',pg_temp.u('outro')::text,true);
set local role authenticated;
select pg_temp.recusa($q$select resolver_conferencia(current_setting('cega.diferenca')::uuid,3)$q$,'sem_permissao');
reset role;
-- O outro dono conhece o ID, mas o resolvedor continua recusando sua decisão.
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select pg_temp.recusa($q$select resolver_conferencia(current_setting('cega.diferenca')::uuid,99)$q$,'contagem_invalida');
select resolver_conferencia((select id from diferencas where produto_id=pg_temp.u('g')),3);
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('g'),null,'venda')=3 and (select count(*) from operacoes where produto_id=pg_temp.u('g'))=3,'só decisão do dono acerta +3 com operação');
set local role authenticated;
select pg_temp.recusa($q$select resolver_conferencia((select id from diferencas where produto_id=pg_temp.u('g')),3)$q$,'contagem_ja_resolvida');
set local role anon;
select pg_temp.ok((funcionario_reposicao_contar(repeat('f',64),pg_temp.u('rg'),pg_temp.u('g'),null,3,2)->>'situacao')='concluido','tela antiga não inicia transferência após decisão');
select pg_temp.ok((funcionario_reposicao_contar(repeat('f',64),pg_temp.u('rg2'),pg_temp.u('g'),null,3,1)->>'situacao')='contado','nova contagem correta libera buscar');
select funcionario_reposicao_concluir(repeat('f',64),pg_temp.u('rg2'),5);
select funcionario_reposicao_concluir(repeat('f',64),pg_temp.u('rg2'),5);
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('g'),null,'deposito')=995 and saldo_chave(pg_temp.u('g'),null,'venda')=8,'transferência só uma vez, 5 saem/entram');
select pg_temp.ok((select sum(quantidade) from movimentos where produto_id=pg_temp.u('g') and tipo='transferencia')=0,'transferência conserva total');
set local role anon;
select pg_temp.ok((funcionario_conferencia_contar(repeat('f',64),pg_temp.u('cd'),pg_temp.u('d'),null,3,1)->>'situacao')='recontar','depósito reconta');
select pg_temp.ok((funcionario_conferencia_contar(repeat('f',64),pg_temp.u('cd'),pg_temp.u('d'),null,3,2)->>'situacao')='aguardando_dono','depósito não aceita diferença automaticamente');
select pg_temp.ok((funcionario_conferencia_contar(repeat('f',64),pg_temp.u('cd-nova'),pg_temp.u('d'),null,0,1)->>'situacao')='aguardando_dono','depósito não contorna com ID novo');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('d'),null,'deposito')=0,'depósito conservado antes da decisão');
set local role authenticated;
select resolver_conferencia((select id from diferencas where produto_id=pg_temp.u('d')),0);
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('d'),null,'deposito')=0 and (select situacao='explicada' from diferencas where produto_id=pg_temp.u('d')),'dono mantém zero e encerra pendência');
set local role anon;
select funcionario_conferencia_contar(repeat('f',64),pg_temp.u('ct'),pg_temp.u('tres'),null,1,1);
select funcionario_conferencia_contar(repeat('f',64),pg_temp.u('ct'),pg_temp.u('tres'),null,2,2);
select pg_temp.ok((funcionario_conferencia_contar(repeat('f',64),pg_temp.u('ct'),pg_temp.u('tres'),null,3,3)->>'situacao')='inconsistente','três diferentes ficam bloqueadas');
reset role;
update conferencias set created_at=now()-interval '8 days' where id=pg_temp.u('ct');
set local role anon;
select pg_temp.ok((funcionario_conferencia_contar(repeat('f',64),pg_temp.u('ct-nova'),pg_temp.u('tres'),null,0,1)->>'situacao')='aguardando_dono','novo dia não libera pendência');
select pg_temp.ok(jsonb_path_exists(funcionario_conferencia_lista(repeat('f',64)),'$.produtos[*] ? (@.aguardando_dono == true)'),'lista mantém bloqueio após oito dias');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('tres'),null,'deposito')=0,'três diferentes não mudam saldo');
-- Movimento legítimo posterior continua valendo quando o dono resolve a fotografia anterior.
insert into operacoes(id,user_id,comercio_id,produto_id,tipo,hash) values(pg_temp.u('entrada'),pg_temp.u('dono'),pg_temp.u('com'),pg_temp.u('tres'),'recebimento','simulado');
select _por_saldo(pg_temp.u('com'),pg_temp.u('tres'),null,'deposito',null,false,false,4,pg_temp.u('entrada'),pg_temp.u('dono'),null,'entrada',null);
set local role authenticated;
select resolver_conferencia((select id from diferencas where produto_id=pg_temp.u('tres')),2);
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('tres'),null,'deposito')=6,'decisão preserva entrada posterior de 4');
-- Reposição legada em andamento exige nova contagem, sem alterar históricos concluídos.
insert into reposicoes(id,comercio_id,produto_id,funcionario_id,contado,esperado,sugerido)
 values(pg_temp.u('legado'),pg_temp.u('com'),pg_temp.u('concorre'),pg_temp.u('func'),7,0,10);
set local role anon;
select pg_temp.recusa($q$select funcionario_reposicao_concluir(repeat('f',64),pg_temp.u('legado'),0)$q$,'contagem_exige_recontagem');
select funcionario_reposicao_contar(repeat('f',64),pg_temp.u('legado'),pg_temp.u('concorre'),null,0,1);
select funcionario_reposicao_concluir(repeat('f',64),pg_temp.u('legado'),2);
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('concorre'),null,'deposito')=8 and saldo_chave(pg_temp.u('concorre'),null,'venda')=2,'legado retoma só depois da nova contagem');
select pg_temp.ok((select bool_and(relrowsecurity) from pg_class where oid in ('saldos'::regclass,'conferencias'::regclass,'reposicoes'::regclass,'diferencas'::regclass)),'RLS permanece ligada');
select pg_temp.ok(not has_table_privilege('anon','saldos','INSERT') and not has_table_privilege('authenticated','saldos','INSERT'),'escrita direta de saldo recusada');
select pg_temp.ok(not has_function_privilege('anon','resolver_conferencia(uuid,numeric)','EXECUTE'),'equipe não decide contagem');

-- Retomada da conferência aberta ontem mantém o ID (ID novo não a substitui) e, desde a B9 do checklist 3, recomeça na contagem 1.
set local role anon;
select funcionario_conferencia_contar(repeat('f',64),pg_temp.u('ontem'),pg_temp.u('ok'),null,99,1);
reset role;
update conferencias set created_at=now()-interval '2 days' where id=pg_temp.u('ontem');
set local role anon;
select pg_temp.ok(jsonb_path_exists(funcionario_conferencia_lista(repeat('f',64)),format('$.produtos[*] ? (@.conferencia_id == "%s" && @.rodada == 1)',pg_temp.u('ontem'))::jsonpath),'contagem aberta de ontem continua recuperável, do zero');
select pg_temp.recusa($q$select funcionario_conferencia_contar(repeat('f',64),pg_temp.u('ontem-nova'),pg_temp.u('ok'),null,20,1)$q$,'contagem_em_andamento');
select funcionario_conferencia_contar(repeat('f',64),pg_temp.u('ontem'),pg_temp.u('ok'),null,20,1);
-- Venda/perda registrada no meio da reposição não é devolvida ao saldo.
select funcionario_reposicao_contar(repeat('f',64),pg_temp.u('meio'),pg_temp.u('g'),null,8,1);
reset role;
insert into operacoes(id,user_id,comercio_id,produto_id,tipo,hash) values(pg_temp.u('saida'),pg_temp.u('dono'),pg_temp.u('com'),pg_temp.u('g'),'perda','simulado');
select _tirar_saldo(pg_temp.u('com'),pg_temp.u('g'),null,'venda',2,pg_temp.u('saida'),pg_temp.u('dono'),null,'perda',null);
set local role anon;
select funcionario_reposicao_concluir(repeat('f',64),pg_temp.u('meio'),5);
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('g'),null,'venda')=11 and saldo_chave(pg_temp.u('g'),null,'deposito')=990,'reposição preserva saída posterior de 2');
-- Produto desativado não recebe ajuste novo; dono ainda pode manter o número anterior.
set local role anon;
select funcionario_conferencia_contar(repeat('f',64),pg_temp.u('inativo'),pg_temp.u('d'),null,7,1);
select funcionario_conferencia_contar(repeat('f',64),pg_temp.u('inativo'),pg_temp.u('d'),null,7,2);
reset role;
update produtos set ativo=false where id=pg_temp.u('d');
set local role authenticated;
select pg_temp.recusa($q$select resolver_conferencia((select id from diferencas where referencia_id=pg_temp.u('inativo')),7)$q$,'produto_inativo');
select resolver_conferencia((select id from diferencas where referencia_id=pg_temp.u('inativo')),0);
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('d'),null,'deposito')=0,'manter número anterior encerra pendência sem reativar produto');
