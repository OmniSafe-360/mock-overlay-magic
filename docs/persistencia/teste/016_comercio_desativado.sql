-- Dados fictícios. Usar com 015_base_caixa_estoque.sql + 016_comercio_desativado.sql, entre begin e rollback.
-- Comércio A (dono, chave 'f'x64) e comércio B (outro dono, chave 'b'x64).
update funcionarios set caixa=true, pin_hash=extensions.crypt('1357',extensions.gen_salt('bf',4)) where id=pg_temp.u('func');
insert into comercios(id,dono_id,tipo,nome,documento_tipo,documento,telefone,cep,rua,numero,bairro,cidade,uf)
 values(pg_temp.u('comB'),pg_temp.u('outro'),'mercado','Comércio B fictício','cpf','11144477735','11999997777','01001000','Rua B','2','Teste','São Paulo','SP');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por,caixa) values(pg_temp.u('funcB'),pg_temp.u('comB'),'Equipe B','ambos','624813',pg_temp.u('outro'),true);
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate) values(pg_temp.u('funcB'),pg_temp.u('comB'),encode(extensions.digest(repeat('b',64),'sha256'),'hex'),now()+interval '1 hour');
-- Funcionário A2 ainda sem PIN (primeiro acesso por código).
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por) values(pg_temp.u('func2'),pg_temp.u('com'),'Equipe A2','ambos','583920',pg_temp.u('dono'));
-- PIN do dono A (cancelar venda / sangria).
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select definir_pin_dono('2580');
reset role;

create function pg_temp.venda(t text,q numeric) returns jsonb language sql as $$
 select jsonb_build_object('id',pg_temp.u(t),'acao','vender','turno_id',pg_temp.u('turno-a'),'feita_em',now(),
 'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('g'),'qtd',q,'preco',4)),
 'pagamentos',jsonb_build_array(jsonb_build_object('forma','dinheiro','valor',q*4))) $$;
create function pg_temp.saldo(p text,a text) returns numeric language sql as $$
 select coalesce(sum(quantidade),0) from saldos where produto_id=pg_temp.u(p) and area::text=a $$;

-- ===== 1. Comércio ATIVO: tudo funciona como hoje =====
set local role anon;
select pg_temp.ok(conferir_codigo_funcionario('583920')='novo','ativo: código confere');
select pg_temp.ok((entrar_funcionario('583920','2468','teste')->>'chave') is not null,'ativo: entra com código + PIN');
select pg_temp.ok((funcionario_inicio(repeat('f',64))->>'nome')='Equipe simulada','ativo: tela inicial');
select pg_temp.ok((caixa_abrir(repeat('f',64),pg_temp.u('turno-a'),50)) is not null,'ativo: abre caixa');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.venda('v-ativa',1))->>'situacao')='registrada','ativo: venda');
select pg_temp.ok((caixa_cancelar_venda(repeat('f',64),pg_temp.u('v-ativa'),'2580','teste')) is not null,'ativo: cancela venda com PIN do dono');
select pg_temp.ok((caixa_sangria(repeat('f',64),pg_temp.u('sangria-a'),pg_temp.u('turno-a'),10,'teste','2580')) is not null,'ativo: sangria');
select pg_temp.ok(jsonb_typeof(caixa_produtos(repeat('f',64))) is not null,'ativo: produtos do caixa');
select pg_temp.ok(funcionario_reposicao_lista(repeat('f',64)) is not null,'ativo: lista de reposição');
select pg_temp.ok(funcionario_entregas(repeat('f',64)) is not null,'ativo: entregas');
select pg_temp.ok((funcionario_registrar_perda(repeat('f',64),pg_temp.u('perda-a'),pg_temp.u('ok'),null,'deposito',1,'quebrou',null)) is not null,'ativo: perda');
select pg_temp.ok((caixa_estado(repeat('b',64))) is not null,'B ativo: caixa_estado');
reset role;
select pg_temp.ok(funcionario_desbloquear(repeat('f',64),'0000') ? 'erro','ativo: desbloquear responde (PIN errado conta)');

-- ===== 2. Desativar A (sessão já aberta, PIN válido por 12 h) =====
update comercios set ativo=false where id=pg_temp.u('com');
create temp table antes as select pg_temp.saldo('g','venda') g, pg_temp.saldo('ok','deposito') ok,
 (select count(*) from vendas where comercio_id=pg_temp.u('com')) vendas, (select count(*) from perdas where comercio_id=pg_temp.u('com')) perdas,
 (select count(*) from operacoes where comercio_id=pg_temp.u('com')) ops;
set local role anon;
select pg_temp.recusa($q$select conferir_codigo_funcionario('937421')$q$,'comercio_desativado');
select pg_temp.recusa($q$select entrar_funcionario('583920','2468','teste')$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_desbloquear(repeat('f',64),'1357')$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_inicio(repeat('f',64))$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_estado(repeat('f',64))$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_produtos(repeat('f',64))$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_clientes_fiado(repeat('f',64))$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_cliente_fiado_historico(repeat('f',64),pg_temp.u('cli'))$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_fiado_cliente_link(repeat('f',64),pg_temp.u('cli'))$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_salvar_cliente_fiado(repeat('f',64),pg_temp.u('cli'),'Cliente','11999990000')$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_receber_fiado(repeat('f',64),pg_temp.u('rec'),pg_temp.u('turno-a'),pg_temp.u('cli'),5,'dinheiro')$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_abrir(repeat('f',64),pg_temp.u('turno-novo'),0)$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_registrar_venda(repeat('f',64),pg_temp.venda('v-offline',1))$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_cancelar_venda(repeat('f',64),pg_temp.u('v-ativa'),'2580','x')$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_sangria(repeat('f',64),pg_temp.u('sangria-b'),pg_temp.u('turno-a'),5,'x','2580')$q$,'comercio_desativado');
select pg_temp.recusa($q$select caixa_fechar(repeat('f',64),pg_temp.u('turno-a'),40,null)$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_buscar_produto(repeat('f',64),'Produto')$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_conferencia_lista(repeat('f',64))$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_conferencia_contar(repeat('f',64),pg_temp.u('conf'),pg_temp.u('ok'),null,3,1)$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_entregas(repeat('f',64))$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_abrir_recebimento(repeat('f',64),pg_temp.u('rcb'),null,null)$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_enviar_recebimento(repeat('f',64),pg_temp.u('rcb'),1,'[]'::jsonb)$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_registrar_perda(repeat('f',64),pg_temp.u('perda-b'),pg_temp.u('ok'),null,'deposito',1,'quebrou',null)$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_reposicao_lista(repeat('f',64))$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_reposicao_contar(repeat('f',64),pg_temp.u('rep'),pg_temp.u('g'),null,3,1)$q$,'comercio_desativado');
select pg_temp.recusa($q$select funcionario_reposicao_concluir(repeat('f',64),pg_temp.u('rep'),1)$q$,'comercio_desativado');
reset role;
-- Nada mudou no estoque, vendas, perdas ou operações de A.
select pg_temp.ok((select g from antes)=pg_temp.saldo('g','venda') and (select ok from antes)=pg_temp.saldo('ok','deposito'),'desativado: estoque intacto');
select pg_temp.ok((select vendas from antes)=(select count(*) from vendas where comercio_id=pg_temp.u('com')),'desativado: nenhuma venda nova');
select pg_temp.ok((select perdas from antes)=(select count(*) from perdas where comercio_id=pg_temp.u('com')),'desativado: nenhuma perda nova');
select pg_temp.ok((select ops from antes)=(select count(*) from operacoes where comercio_id=pg_temp.u('com')),'desativado: nenhuma operação nova');
set local role anon;
-- Isolamento: B continua funcionando.
select pg_temp.ok((caixa_estado(repeat('b',64))) is not null,'B continua: caixa_estado');
select pg_temp.ok((funcionario_inicio(repeat('b',64))->>'nome')='Equipe B','B continua: tela inicial');
select pg_temp.ok(conferir_codigo_funcionario('624813')='novo','B continua: código');
reset role;
-- Chave do celular A não foi encerrada (vendas guardadas continuam ligadas a ela).
select pg_temp.ok((select encerrado_em is null from funcionario_aparelhos where chave_hash=encode(extensions.digest(repeat('f',64),'sha256'),'hex')),'chave A preservada');

-- ===== 3. Dono continua vendo e administrando =====
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select pg_temp.ok((select count(*) from comercios where id=pg_temp.u('com'))=1,'dono vê comércio desativado');
select pg_temp.ok((select count(*) from vendas where comercio_id=pg_temp.u('com'))>=1,'dono vê vendas');
select pg_temp.ok((select count(*) from funcionarios where comercio_id=pg_temp.u('com'))=2,'dono vê equipe');
select pg_temp.ok((select count(*) from comercios where id=pg_temp.u('comB'))=0,'dono A não vê B');
update comercios set ativo=true where id=pg_temp.u('com');
select pg_temp.ok((select ativo from comercios where id=pg_temp.u('com')),'dono reativa');
reset role;

-- ===== 4. Venda guardada sem internet sobe depois da reativação, sem duplicar =====
set local role anon;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.venda('v-offline',1))->>'situacao')='registrada','reativado: venda guardada aceita');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.venda('v-offline',1))->>'situacao')='repetida','reativado: reenvio não duplica');
select pg_temp.ok((caixa_fechar(repeat('f',64),pg_temp.u('turno-a'),40,null)) is not null,'reativado: fecha caixa');
reset role;
select pg_temp.ok((select count(*) from vendas where id=pg_temp.u('v-offline'))=1,'venda guardada registrada uma vez');
select 'OK 016: comércio desativado bloqueia equipe/caixa; ativo, dono, isolamento e venda guardada preservados';
