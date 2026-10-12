-- Dados fictícios, usar com 015_base_caixa_estoque.sql entre begin e rollback.
update funcionarios set caixa=true where id=pg_temp.u('func');
set local role anon;
select caixa_abrir(repeat('f',64),pg_temp.u('turno-c6'),0);
create function pg_temp.venda(t text,q numeric,acao text default 'vender') returns jsonb language sql as $$
 select jsonb_build_object('id',pg_temp.u(t),'acao',acao,'turno_id',pg_temp.u('turno-c6'),'feita_em',now(),
 'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('g'),'qtd',q,'preco',4)),
 'pagamentos',jsonb_build_array(jsonb_build_object('forma','dinheiro','valor',q*4))) $$;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.venda('c6-excesso',7,'conferir'))->>'situacao')='bloqueada','conferência recusa 7 sobre 5');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.venda('c6-excesso',7))->>'situacao')='bloqueada','venda recusa 7 sobre 5');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.venda('c6-outro-caixa',7))->>'situacao')='bloqueada','outra solicitação reaproveita contagem');
-- Linhas do mesmo produto somam; embalagem usa unidades reais do cadastro.
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),jsonb_set(pg_temp.venda('c6-duas-linhas',3),'{itens}',jsonb_build_array(
 jsonb_build_object('produto_id',pg_temp.u('g'),'qtd',3,'preco',4),jsonb_build_object('produto_id',pg_temp.u('g'),'qtd',3,'preco',4)))||jsonb_build_object('pagamentos',jsonb_build_array(jsonb_build_object('forma','pix','valor',24))))->>'situacao')='bloqueada','duas linhas de 3 não vendem sobre 5');
select pg_temp.recusa($q$select caixa_registrar_venda(repeat('f',64),pg_temp.venda('c6-malformada',1)||jsonb_build_object('itens',null))$q$,'venda_sem_itens');
select pg_temp.recusa($q$select caixa_registrar_venda(repeat('f',64),pg_temp.venda('c6-sem-pagamento',1)||jsonb_build_object('pagamentos',null))$q$,'pagamento_invalido');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),jsonb_set(pg_temp.venda('c6-sem-cadastro',1),'{itens}',jsonb_build_array(jsonb_build_object('descricao','Sem cadastro','qtd',1,'preco',4))))->>'situacao')='bloqueada','sem cadastro não finge estoque disponível');
reset role;
select pg_temp.ok((select count(*) from conferencias where produto_id=pg_temp.u('g'))=1,'contagem solicitada uma única vez');
select pg_temp.ok((select count(*) from vendas where comercio_id=pg_temp.u('com'))=0,'nenhuma venda registrada');
select pg_temp.ok(saldo_chave(pg_temp.u('g'),null,'venda')=5 and saldo_chave(pg_temp.u('g'),null,'deposito')=1000,'nenhum estoque alterado');
select set_config('c6.cf',(select id::text from conferencias where produto_id=pg_temp.u('g')),true);
set local role anon;
select pg_temp.ok((funcionario_reposicao_contar(repeat('f',64),current_setting('c6.cf')::uuid,pg_temp.u('g'),null,7,1)->>'situacao')='recontar','gôndola cega reconta');
select pg_temp.ok((funcionario_reposicao_contar(repeat('f',64),current_setting('c6.cf')::uuid,pg_temp.u('g'),null,7,2)->>'situacao')='aguardando_dono','diferença confirmada espera dono');
reset role;
select pg_temp.ok((select count(*) from conferencias where produto_id=pg_temp.u('g') and area='deposito' and situacao='contando')=1,'depósito solicitado após diferença confirmada');
set local role authenticated;
select pg_temp.ok((resolver_conferencia((select id from diferencas where referencia_id=current_setting('c6.cf')::uuid),7)->>'situacao')='aguardando_deposito','dono aguarda conferir depósito antes de alterar gôndola');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('g'),null,'venda')=5,'pedido de depósito não acerta gôndola');
select set_config('c6.dp',(select id::text from conferencias where produto_id=pg_temp.u('g') and area='deposito'),true);
set local role anon;
select funcionario_conferencia_contar(repeat('f',64),current_setting('c6.dp')::uuid,pg_temp.u('g'),null,998,1);
select funcionario_conferencia_contar(repeat('f',64),current_setting('c6.dp')::uuid,pg_temp.u('g'),null,998,2);
reset role;
set local role authenticated;
select resolver_conferencia((select id from diferencas where referencia_id=current_setting('c6.dp')::uuid),998);
select resolver_conferencia((select id from diferencas where referencia_id=current_setting('c6.cf')::uuid),7);
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('g'),null,'venda')=7 and saldo_chave(pg_temp.u('g'),null,'deposito')=998,'dono confirma dois locais, total físico preservado');
select pg_temp.ok((select bool_and((detalhes->>'saldo_total_preservado')::boolean and not (detalhes->>'revisao_caixa_pendente')::boolean) from diferencas where produto_id=pg_temp.u('g')),'localização divergente não vira falta total');
set local role anon;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.venda('c6-venda',7))->>'situacao')='registrada','saldo confirmado permite vender 7');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.venda('c6-venda',7))->>'situacao')='repetida','reenvio reconhecido após estoque já baixado');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('g'),null,'venda')=0 and (select count(*) from vendas where comercio_id=pg_temp.u('com'))=1,'uma venda, uma baixa');

-- Roupa sem tamanho/cor e produto de outro comércio não contornam a validação.
set local role anon;
select pg_temp.recusa($q$select caixa_registrar_venda('chave-invalida',pg_temp.venda('c6-chave',1))$q$,'acesso_encerrado');
reset role;
select pg_temp.ok(not has_table_privilege('anon','saldos','INSERT') and not has_table_privilege('authenticated','saldos','INSERT'),'saldo sem escrita direta');
select pg_temp.ok((select bool_and(relrowsecurity) from pg_class where oid in ('saldos'::regclass,'conferencias'::regclass,'operacoes'::regclass,'diferencas'::regclass,'vendas'::regclass)),'RLS ligada');

-- Embalagem, falta de referência e ausência de área não dão permissão fictícia.
insert into produto_embalagens(id,comercio_id,produto_id,tipo,quantidade) values(pg_temp.u('cx6'),pg_temp.u('com'),pg_temp.u('ok'),'Caixa',6);
insert into produtos(id,comercio_id,nome,unidade,preco_compra,preco_venda)
 values(pg_temp.u('desconhecido'),pg_temp.u('com'),'Sem contagem','Unidade',2,4),(pg_temp.u('sem-area'),pg_temp.u('com'),'Sem área','Unidade',2,4);
insert into produto_areas(produto_id,comercio_id,area) values(pg_temp.u('desconhecido'),pg_temp.u('com'),'venda');
set local role anon;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),jsonb_set(pg_temp.venda('c6-emb',1,'conferir'),'{itens}',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('ok'),'embalagem_id',pg_temp.u('cx6'),'qtd',1,'preco',24))))->>'situacao')='bloqueada','caixa de 6 não cabe em saldo 5');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),jsonb_set(pg_temp.venda('c6-desconhecido',1,'conferir'),'{itens}',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('desconhecido'),'qtd',1,'preco',4))))#>>'{bloqueios,0,motivo}')='gondola_nao_contada','área sem contagem exige referência inicial');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),jsonb_set(pg_temp.venda('c6-sem-area',1,'conferir'),'{itens}',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('sem-area'),'qtd',1,'preco',4))))#>>'{bloqueios,0,motivo}')='produto_sem_area_venda','área ausente exige cadastro');
-- Todos os itens são validados antes de qualquer baixa, inclusive quando o primeiro caberia.
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),jsonb_set(pg_temp.venda('c6-mista',1),'{itens}',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('d'),'qtd',1,'preco',4),jsonb_build_object('produto_id',pg_temp.u('g'),'qtd',1,'preco',4)))||jsonb_build_object('pagamentos',jsonb_build_array(jsonb_build_object('forma','pix','valor',8))))->>'situacao')='bloqueada','venda inteira recusada quando segundo item não cabe');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('d'),null,'venda')=5,'recusa do segundo item não baixa o primeiro');
select pg_temp.ok((select count(*) from conferencias where produto_id=pg_temp.u('sem-area'))=0,'não cria contagem sem área');

-- Três números distintos aguardam escolha do dono antes de pedir depósito.
set local role anon;
select caixa_registrar_venda(repeat('f',64),jsonb_set(pg_temp.venda('c6-tres',8,'conferir'),'{itens}',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('tres'),'qtd',8,'preco',4))));
reset role;
select set_config('c6.tres',(select id::text from conferencias where produto_id=pg_temp.u('tres')),true);
set local role anon;
select funcionario_reposicao_contar(repeat('f',64),current_setting('c6.tres')::uuid,pg_temp.u('tres'),null,6,1);
select funcionario_reposicao_contar(repeat('f',64),current_setting('c6.tres')::uuid,pg_temp.u('tres'),null,7,2);
select pg_temp.ok((funcionario_reposicao_contar(repeat('f',64),current_setting('c6.tres')::uuid,pg_temp.u('tres'),null,8,3)->>'situacao')='inconsistente','três diferentes aguardam dono');
reset role;
select pg_temp.ok((select count(*) from conferencias where produto_id=pg_temp.u('tres') and area='deposito')=0,'três diferentes ainda não confirmaram diferença');
select set_config('c6.dif_tres',(select id::text from diferencas where referencia_id=current_setting('c6.tres')::uuid),true);
select set_config('request.jwt.claim.sub',pg_temp.u('outro')::text,true);
set local role authenticated;
select pg_temp.recusa($q$select resolver_conferencia(current_setting('c6.dif_tres')::uuid,7)$q$,'sem_permissao');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select pg_temp.recusa($q$select resolver_conferencia(current_setting('c6.dif_tres')::uuid,7)$q$,'sem_permissao');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select pg_temp.ok((resolver_conferencia(current_setting('c6.dif_tres')::uuid,7)->>'situacao')='aguardando_deposito','escolha divergente do dono pede depósito antes de ajustar');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('tres'),null,'venda')=5 and (select count(*) from conferencias where produto_id=pg_temp.u('tres') and area='deposito')=1,'depósito solicitado e saldo preservado');
-- Sem PIN válido nem sequer gera solicitação no estoque.
update funcionario_aparelhos set desbloqueado_ate=now()-interval '1 minute' where funcionario_id=pg_temp.u('func');
set local role anon;
select pg_temp.recusa($q$select caixa_registrar_venda(repeat('f',64),pg_temp.venda('c6-pin-expirado',7))$q$,'pin_necessario');
reset role;
