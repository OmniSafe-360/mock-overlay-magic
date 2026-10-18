-- Dados fictícios. Usar com 015_base_caixa_estoque.sql, entre begin e rollback.
create function pg_temp.preparar(v numeric,e numeric) returns void language plpgsql as $$
begin
 update produtos set controla_validade=true where id=pg_temp.u('g');
 update saldos set quantidade=0 where produto_id=pg_temp.u('g') and area='venda';
 insert into lotes(id,comercio_id,produto_id,numero,vencimento) values
 (pg_temp.u('v-venc'),pg_temp.u('com'),pg_temp.u('g'),'TESTE-VENC',(now() at time zone 'America/Sao_Paulo')::date-1),
 (pg_temp.u('v-bom'),pg_temp.u('com'),pg_temp.u('g'),'TESTE-BOM',(now() at time zone 'America/Sao_Paulo')::date+10)
 on conflict(id) do nothing;
 update saldos set quantidade=e where produto_id=pg_temp.u('g') and area='venda' and lote_id=pg_temp.u('v-venc') and not pendente;
 if not found then insert into saldos(comercio_id,produto_id,area,lote_id,quantidade) values(pg_temp.u('com'),pg_temp.u('g'),'venda',pg_temp.u('v-venc'),e); end if;
 update saldos set quantidade=v where produto_id=pg_temp.u('g') and area='venda' and lote_id=pg_temp.u('v-bom') and not pendente;
 if not found then insert into saldos(comercio_id,produto_id,area,lote_id,quantidade) values(pg_temp.u('com'),pg_temp.u('g'),'venda',pg_temp.u('v-bom'),v); end if;
end $$;
create function pg_temp.pedido(t text,q numeric,acao text default 'vender',emb uuid default null) returns jsonb language sql as $$
 select jsonb_build_object('id',pg_temp.u(t),'turno_id',pg_temp.u('v-turno'),'acao',acao,'feita_em',now(),
 'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('g'),'embalagem_id',emb,'qtd',q,'preco',4)),
 'pagamentos',jsonb_build_array(jsonb_build_object('forma','pix','valor',q*4))) $$;
create function pg_temp.q(t text) returns numeric language sql as $$
 select coalesce(sum(quantidade),0) from saldos where produto_id=pg_temp.u('g') and area='venda' and lote_id=pg_temp.u(t) $$;

select pg_temp.preparar(3,2);
update funcionarios set caixa=true where id=pg_temp.u('func');
set local role anon;
select caixa_abrir(repeat('f',64),pg_temp.u('v-turno'),0);
select pg_temp.ok((select (x#>>'{estoques,0,quantidade}')::numeric=3 from jsonb_array_elements(caixa_produtos(repeat('f',64))) x where x->>'id'=pg_temp.u('g')::text),'lista usa 3 vendáveis, não 5 físicas');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-excesso',4,'conferir'))->>'situacao')='bloqueada','pré-conferência recusa 4 sobre 3 válidas');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-excesso',4))->>'situacao')='bloqueada','finalização direta também recusa excesso');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-excesso',4))#>>'{bloqueios,0,motivo}')='estoque_vencido','recusa explica vencimento, sem inventar falta física');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('g'),null,'venda')=5 and (select count(*) from vendas)=0,'recusa mantém estoque físico e nenhuma venda');
select pg_temp.ok((select count(*) from conferencias where produto_id=pg_temp.u('g') and area='venda')=1,'contagem solicitada e deduplicada como antes');
set local role anon;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-certa',3))->>'situacao')='registrada','permite exatamente 3 válidas');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-certa',3))->>'situacao')='repetida','repetição reconhece a venda já gravada');
reset role;
select pg_temp.ok(pg_temp.q('v-bom')=0 and pg_temp.q('v-venc')=2,'vencidos não baixam');
select pg_temp.ok((select count(*)=1 from movimentos where produto_id=pg_temp.u('g') and tipo='venda'),'uma baixa por intenção');
set local role authenticated;
select cancelar_venda_celular(pg_temp.u('v-certa'),'Simulação de teste');
select cancelar_venda_celular(pg_temp.u('v-certa'),'Simulação de teste');
reset role;
select pg_temp.ok(pg_temp.q('v-bom')=3 and pg_temp.q('v-venc')=2,'cancelar devolve uma vez ao lote bom original');

select pg_temp.preparar(0,2);
set local role anon;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-so-vencidos',1))->>'situacao')='bloqueada','somente vencidos não libera venda');
reset role;
select pg_temp.ok(pg_temp.q('v-venc')=2,'recusa não remove vencido ou esconde alerta');
select pg_temp.preparar(0,2);
insert into lotes(id,comercio_id,produto_id,numero,vencimento) values(pg_temp.u('v-hoje'),pg_temp.u('com'),pg_temp.u('g'),'TESTE-HOJE',(now() at time zone 'America/Sao_Paulo')::date);
insert into saldos(comercio_id,produto_id,area,lote_id,quantidade) values(pg_temp.u('com'),pg_temp.u('g'),'venda',pg_temp.u('v-hoje'),1);
set local role anon;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-hoje',1))->>'situacao')='registrada','vence hoje ainda vale na regra de São Paulo');
reset role;
select pg_temp.ok(pg_temp.q('v-venc')=2,'venda de hoje não mexe no vencido');

select pg_temp.preparar(3,2);
set local role anon;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-virou',3,'conferir'))->>'situacao')='aprovada','pré-conferência válida');
reset role;
select _lancar_perda(pg_temp.u('v-perda-meio'),pg_temp.u('com'),pg_temp.u('g'),null,'venda',2,'quebrou',null,pg_temp.u('func'),null);
set local role anon;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-virou',3))->>'situacao')='bloqueada','finalização relê disponibilidade após pré-conferência antiga');
reset role;
select pg_temp.ok(pg_temp.q('v-bom')=1 and pg_temp.q('v-venc')=2,'recusa posterior preserva a perda legítima de 2 e não duplica');

select pg_temp.preparar(3,2);
insert into produto_embalagens(id,comercio_id,produto_id,tipo,quantidade) values(pg_temp.u('v-cx2'),pg_temp.u('com'),pg_temp.u('g'),'Caixa',2);
set local role anon;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-duas-cx',2,'vender',pg_temp.u('v-cx2')))->>'situacao')='bloqueada','embalagem 2×2 não passa em 3 válidas');
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-uma-cx',1,'vender',pg_temp.u('v-cx2')))->>'situacao')='registrada','uma embalagem de 2 passa');
reset role;
select pg_temp.ok(pg_temp.q('v-bom')=1 and pg_temp.q('v-venc')=2,'conversão preservada');

-- Casos históricos sem data/pedência mantêm sua regra; só o vencido conhecido é excluído.
select pg_temp.preparar(3,2);
update saldos set quantidade=0 where lote_id=pg_temp.u('v-bom');
update saldos set quantidade=3 where produto_id=pg_temp.u('g') and area='venda' and lote_id is null;
set local role anon;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-sem-data',3))->>'situacao')='registrada','não muda silenciosamente a política de saldo sem data');
reset role;
select pg_temp.preparar(0,2);
insert into saldos(comercio_id,produto_id,area,lote_id,pendente,quantidade) values(pg_temp.u('com'),pg_temp.u('g'),'venda',pg_temp.u('v-bom'),true,3);
set local role anon;
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),pg_temp.pedido('v-valido-pendente',3))->>'situacao')='registrada','válido não perde prioridade para vencido não pendente');
reset role;
select pg_temp.ok(pg_temp.q('v-venc')=2,'alocador não recorre ao vencido');

select pg_temp.ok(not has_function_privilege('anon','public._saldo_vendavel_caixa(uuid,uuid)','EXECUTE') and not has_function_privilege('authenticated','public._saldo_vendavel_caixa(uuid,uuid)','EXECUTE'),'consulta interna não é endpoint aberto');
select pg_temp.ok(not has_function_privilege('anon','public._baixar_item_venda_caixa(uuid)','EXECUTE') and not has_function_privilege('authenticated','public._baixar_item_venda_caixa(uuid)','EXECUTE'),'baixa interna fechada');
select pg_temp.ok(not has_table_privilege('anon','saldos','INSERT') and not has_table_privilege('authenticated','saldos','INSERT'),'gravação direta segue negada');
select pg_temp.ok((select bool_and(relrowsecurity) from pg_class where oid in ('saldos'::regclass,'vendas'::regclass,'operacoes'::regclass)),'RLS continua ligada');
select 'OK: limite vendável, alocação, repetição, cancelamento, hoje, releitura, embalagens e permissões' as resultado;
