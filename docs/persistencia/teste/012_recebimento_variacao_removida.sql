-- Somente banco local descartável; toda a simulação é desfeita.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('item9-'||t)::uuid $$;
create function pg_temp.recusa(s text, msg text, estado text) returns text language plpgsql as $$
declare st text; m text;
begin
  begin execute s; raise exception 'sucesso_inesperado' using errcode='T0K00';
  exception when others then get stacked diagnostics st=returned_sqlstate,m=message_text; end;
  if st is distinct from estado or m <> msg then raise exception 'FALHOU: esperado % [%], veio % [%]',msg,estado,m,st; end if;
  return 'OK recusou '||msg;
end $$;
create function pg_temp.ok(b boolean, t text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', t; end if; return 'OK: '||t; end $$;
insert into auth.users values(pg_temp.u('dono'),'item9@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('dono'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('loja'),pg_temp.u('dono'),'loja_roupas','Roupas simuladas');
insert into fornecedores(id,dono_id,nome) values(pg_temp.u('forn'),pg_temp.u('dono'),'Fornecedor simulado');
insert into produtos(id,comercio_id,nome,categoria,unidade,preco_compra,preco_venda)
 values(pg_temp.u('camisa'),pg_temp.u('loja'),'Camisa simulada','Camisetas','Peça',10,20);
insert into produto_variacoes(id,produto_id,comercio_id,tamanho,cor) values
 (pg_temp.u('P'),pg_temp.u('camisa'),pg_temp.u('loja'),'P','Azul'),
 (pg_temp.u('M'),pg_temp.u('camisa'),pg_temp.u('loja'),'M','Azul');
update produto_variacoes set codigo_barras='ITEM9-P' where id=pg_temp.u('P');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por)
 values(pg_temp.u('func'),pg_temp.u('loja'),'Equipe simulada','receber','910011',pg_temp.u('dono'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate)
 values(pg_temp.u('func'),pg_temp.u('loja'),encode(extensions.digest(repeat('a',64),'sha256'),'hex'),now()+interval '1 hour');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select salvar_pedido(jsonb_build_object('id',pg_temp.u('pedido'),'comercio_id',pg_temp.u('loja'),'fornecedor_id',pg_temp.u('forn'),
 'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('P'),'qtd_embalagens',5),
 jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('M'),'qtd_embalagens',5))));
select marcar_pedido_enviado(pg_temp.u('pedido'),'copiado');
reset role;
-- Estado histórico permitido pelo cadastro atual: removida sem saldo, apesar de constar no pedido.
update produto_variacoes set removida_em=now() where id=pg_temp.u('P');

-- Outra variação removida, do mesmo produto, não pertence ao pedido.
insert into produto_variacoes(id,produto_id,comercio_id,tamanho,cor,removida_em)
 values(pg_temp.u('G'),pg_temp.u('camisa'),pg_temp.u('loja'),'G','Azul',now());
set local role anon;
select pg_temp.ok(jsonb_array_length(funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('rec'),pg_temp.u('pedido'),null)->'produtos')=2,
 'abrir conserva o tamanho e a cor do pedido sem mostrar quantidades');
select pg_temp.recusa($q$select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec'),0,
 jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('G'),'total',5)))$q$,'variacao_invalida','23514');
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec'),0,
 jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('P'),'total',5,'avaria',1)))->'itens')->0->>'situacao'='inconsistente',
 'mesmo batendo com o pedido, variação removida fica para o dono decidir');
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec'),1,
 jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('M'),'total',5)))->>'situacao')='concluido',
 'entrega termina com a variação removida separada');
select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec'),1,
 jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('M'),'total',5)));
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('camisa'),pg_temp.u('P'),'deposito')=0
 and saldo_chave(pg_temp.u('camisa'),pg_temp.u('M'),'deposito')=5,
 'nenhuma peça removida entra automaticamente; ativa entra uma vez');
select pg_temp.ok((select removida_em is not null from produto_variacoes where id=pg_temp.u('P'))
 and (select tentativas->0->>'variacao' from recebimento_itens where variacao_id=pg_temp.u('P'))='P · Azul',
 'histórico identifica a roupa; funcionário não restaura o cadastro');
select pg_temp.ok((select ultimo_resultado::text from recebimentos where id=pg_temp.u('rec')) !~ 'esperado|quantidade_aceita|tentativas',
 'resposta da equipe não revela quantidades esperadas');
select pg_temp.recusa($q$select _entrar_no_deposito((select id from recebimento_itens where variacao_id=pg_temp.u('P')),
 jsonb_build_object('total',5,'avaria',1),pg_temp.u('dono'),null)$q$,'variacao_removida_recebimento','23514');
-- Simula o código original ocupado por outro produto: aceitar deve desfazer tudo.
savepoint conflito_codigo;
insert into produtos(id,comercio_id,nome,categoria,unidade,codigo_barras,preco_compra,preco_venda)
 values(pg_temp.u('outro-prod'),pg_temp.u('loja'),'Outra camisa','Camisetas','Peça','ITEM9-P',10,20);
set local role authenticated;
select pg_temp.recusa($q$select resolver_item_recebimento((select id from recebimento_itens where variacao_id=pg_temp.u('P')),'aceitar',0)$q$,
 'codigo_em_uso: ITEM9-P','23505');
reset role;
select pg_temp.ok((select removida_em is not null from produto_variacoes where id=pg_temp.u('P'))
 and saldo_chave(pg_temp.u('camisa'),pg_temp.u('P'),'deposito')=0,'conflito não restaura nem deixa estoque parcial');
rollback to conflito_codigo;
savepoint conflito_combinacao;
insert into produto_variacoes(id,produto_id,comercio_id,tamanho,cor)
 values(pg_temp.u('P-nova'),pg_temp.u('camisa'),pg_temp.u('loja'),'p',' azul ');
set local role authenticated;
select pg_temp.recusa($q$select resolver_item_recebimento((select id from recebimento_itens where variacao_id=pg_temp.u('P')),'aceitar',0)$q$,
 'variacao_igual_ativa_recebimento','23514');
reset role;
rollback to conflito_combinacao;
-- Aceitar pelo dono restaura e entra somente a quantidade boa, com operação permanente.
set local role authenticated;
select resolver_item_recebimento((select id from recebimento_itens where variacao_id=pg_temp.u('P')),'aceitar',0);
reset role;
select pg_temp.ok((select removida_em is null from produto_variacoes where id=pg_temp.u('P'))
 and exists(select 1 from codigos_barras where codigo='ITEM9-P' and variacao_id=pg_temp.u('P'))
 and saldo_chave(pg_temp.u('camisa'),pg_temp.u('P'),'deposito')=4,'aceite restaura tamanho/cor/código e entra apenas peças boas');
select pg_temp.ok((select count(*) from operacoes where tipo='recebimento' and produto_id=pg_temp.u('camisa'))=2
 and (select sum(quantidade) from movimentos where produto_id=pg_temp.u('camisa'))=9,'duas entradas com operação e histórico fechando');
set local role authenticated;
select pg_temp.recusa($q$select resolver_item_recebimento((select id from recebimento_itens where variacao_id=pg_temp.u('P')),'aceitar',0)$q$,
 'item_ja_resolvido','23514');
reset role;
-- Novo pedido de uma variação histórica que não chegou; mantém as duas contagens iguais de zero.
insert into pedidos_compra(id,comercio_id,fornecedor_id,numero,situacao,criado_por)
 values(pg_temp.u('ped-nao-veio'),pg_temp.u('loja'),pg_temp.u('forn'),2,'enviado',pg_temp.u('dono'));
insert into pedido_itens(pedido_id,comercio_id,produto_id,variacao_id,qtd_embalagens,qtd_unidades)
 values(pg_temp.u('ped-nao-veio'),pg_temp.u('loja'),pg_temp.u('camisa'),pg_temp.u('G'),5,5);
set local role anon;
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('rec-nao-veio'),pg_temp.u('ped-nao-veio'),null);
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec-nao-veio'),0,
 jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('G'),'total',0)))->>'situacao')='recontar',
 'Não veio segue a conferência, sem aceitação automática');
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec-nao-veio'),1,
 jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('G'),'total',0)))->>'situacao')='concluido',
 'Não veio pode concluir após a confirmação normal');
reset role;
select pg_temp.ok((select removida_em is not null from produto_variacoes where id=pg_temp.u('G'))
 and saldo_chave(pg_temp.u('camisa'),pg_temp.u('G'),'deposito')=0,'zero não restaura variação nem cria entrada');
-- Remoção feita entre duas contagens parciais, quando ainda não entrou estoque.
insert into produto_variacoes(id,produto_id,comercio_id,tamanho,cor)
 values(pg_temp.u('GG'),pg_temp.u('camisa'),pg_temp.u('loja'),'GG','Azul');
insert into pedidos_compra(id,comercio_id,fornecedor_id,numero,situacao,criado_por)
 values(pg_temp.u('ped-tardia'),pg_temp.u('loja'),pg_temp.u('forn'),3,'enviado',pg_temp.u('dono'));
insert into pedido_itens(pedido_id,comercio_id,produto_id,variacao_id,qtd_embalagens,qtd_unidades) values
 (pg_temp.u('ped-tardia'),pg_temp.u('loja'),pg_temp.u('camisa'),pg_temp.u('GG'),5,5),
 (pg_temp.u('ped-tardia'),pg_temp.u('loja'),pg_temp.u('camisa'),pg_temp.u('M'),5,5);
set local role anon;
select funcionario_abrir_recebimento(repeat('a',64),pg_temp.u('rec-tardia'),pg_temp.u('ped-tardia'),null);
select funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec-tardia'),0,
 jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('GG'),'total',5)));
reset role;
update produto_variacoes set removida_em=now() where id=pg_temp.u('GG');
set local role anon;
select pg_temp.ok((funcionario_enviar_recebimento(repeat('a',64),pg_temp.u('rec-tardia'),1,
 jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('camisa'),'variacao_id',pg_temp.u('M'),'total',5)))->>'situacao')='concluido',
 'removida depois do envio parcial também deixa a entrega terminar');
reset role;
select pg_temp.ok((select situacao from recebimento_itens where variacao_id=pg_temp.u('GG'))='inconsistente'
 and saldo_chave(pg_temp.u('camisa'),pg_temp.u('GG'),'deposito')=0,'aceito antes da remoção vira pendência do dono, sem estoque escondido');
set local role authenticated;
select resolver_item_recebimento((select id from recebimento_itens where variacao_id=pg_temp.u('GG')),'recusar',null);
reset role;
select pg_temp.ok((select situacao from recebimento_itens where variacao_id=pg_temp.u('GG'))='recusado'
 and (select removida_em is not null from produto_variacoes where id=pg_temp.u('GG'))
 and (select qtd_recebida from pedido_itens where pedido_id=pg_temp.u('ped-tardia') and variacao_id=pg_temp.u('GG'))=0,'devolver conserva a remoção, sem estoque, e registra zero aceito no pedido');
-- Recusas: sem login, outro dono, sem chave e gravação direta. RLS continua ligada.
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select pg_temp.recusa($q$select resolver_item_recebimento(pg_temp.u('inexistente'),'aceitar',0)$q$,'nao_autenticado','28000');
reset role;
insert into auth.users values(pg_temp.u('outro-dono'),'outro-item9@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('outro-dono'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('outra-loja'),pg_temp.u('outro-dono'),'loja_roupas','Outra loja');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por)
 values(pg_temp.u('outro-func'),pg_temp.u('outra-loja'),'Outra equipe','receber','910012',pg_temp.u('outro-dono'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate)
 values(pg_temp.u('outro-func'),pg_temp.u('outra-loja'),encode(extensions.digest(repeat('b',64),'sha256'),'hex'),now()+interval '1 hour');
set local role anon;
select pg_temp.recusa($q$select funcionario_enviar_recebimento(null,pg_temp.u('rec'),1,'[]'::jsonb)$q$,'acesso_encerrado','42501');
select pg_temp.recusa($q$select funcionario_enviar_recebimento(repeat('b',64),pg_temp.u('rec'),1,'[]'::jsonb)$q$,'recebimento_nao_encontrado','42501');
select pg_temp.recusa($q$update saldos set quantidade=quantidade+1$q$,'permission denied for table saldos','42501');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.u('outro-dono')::text,true);
set local role authenticated;
select pg_temp.ok(not exists(select 1 from recebimento_itens where comercio_id=pg_temp.u('loja')),'RLS impede leitura de outro dono');
select pg_temp.recusa($q$update produto_variacoes set removida_em=null$q$,'permission denied for table produto_variacoes','42501');
reset role;
select pg_temp.recusa($q$select resolver_item_recebimento((select id from recebimento_itens where variacao_id=pg_temp.u('GG')),'recusar',null)$q$,
 'sem_acesso_ao_comercio','42501');
select pg_temp.ok(not has_table_privilege('anon','public.recebimento_itens','INSERT')
 and not has_table_privilege('authenticated','public.produto_variacoes','UPDATE')
 and not has_function_privilege('anon','public._entrar_no_deposito(uuid,jsonb,uuid,uuid)','EXECUTE'),'sem gravação direta nem entrada interna pública');
select pg_temp.ok((select bool_and(relrowsecurity) from pg_class where relnamespace='public'::regnamespace
 and relname in ('produto_variacoes','pedido_itens','recebimentos','recebimento_itens','saldos','operacoes')),'RLS continua ligada');
rollback;
