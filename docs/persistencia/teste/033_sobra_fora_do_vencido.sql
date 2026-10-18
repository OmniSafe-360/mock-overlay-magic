-- C10 (checklist 3): a sobra de uma contagem (contou mais do que o sistema tinha) não entra num lote vencido.
-- Dados fictícios; usar com 015_base_caixa_estoque.sql entre begin e rollback.
update produtos set controla_validade=true where id=pg_temp.u('g');
create function pg_temp.poe(t text,q numeric) returns void language plpgsql as $$
begin
  update saldos set quantidade=q where produto_id=pg_temp.u('g') and area='venda' and lote_id=pg_temp.u(t) and not pendente;
  if not found then insert into saldos(comercio_id,produto_id,area,lote_id,quantidade) values(pg_temp.u('com'),pg_temp.u('g'),'venda',pg_temp.u(t),q); end if;
end $$;
create function pg_temp.lote(t text) returns numeric language sql as $$
  select coalesce(sum(quantidade),0) from saldos where produto_id=pg_temp.u('g') and area='venda' and lote_id=pg_temp.u(t) $$;
create function pg_temp.sem_lote() returns numeric language sql as $$
  select coalesce(sum(quantidade),0) from saldos where produto_id=pg_temp.u('g') and area='venda' and lote_id is null $$;
create function pg_temp.op(t text) returns uuid language plpgsql as $$
begin
  insert into operacoes(id,user_id,comercio_id,produto_id,tipo,hash) values(pg_temp.u(t),pg_temp.u('dono'),pg_temp.u('com'),pg_temp.u('g'),'teste',t);
  return pg_temp.u(t);
end $$;
update saldos set quantidade=0 where produto_id=pg_temp.u('g') and area='venda';
insert into lotes(id,comercio_id,produto_id,numero,vencimento) values
 (pg_temp.u('c10-venc'),pg_temp.u('com'),pg_temp.u('g'),'VENC10',(now() at time zone 'America/Sao_Paulo')::date-3),
 (pg_temp.u('c10-bom'),pg_temp.u('com'),pg_temp.u('g'),'BOM10',(now() at time zone 'America/Sao_Paulo')::date+40);

-- 1. Só o lote vencido tem quantidade: a sobra entra sem lote (a data é desconhecida), não no vencido.
select pg_temp.poe('c10-venc',5);
select _acertar_area(pg_temp.u('com'),pg_temp.u('g'),null,'venda',8,pg_temp.op('c10-a'),pg_temp.u('dono'),null);
select pg_temp.ok(pg_temp.lote('c10-venc')=5,'sobra não entra no lote vencido');
select pg_temp.ok(pg_temp.sem_lote()=3,'sobra fica sem lote');

-- 2. Lote bom zerado e vencido com 5: contar 10 põe as 5 a mais no lote bom.
update saldos set quantidade=0 where produto_id=pg_temp.u('g') and area='venda' and lote_id is null;
select pg_temp.poe('c10-bom',0);
select _acertar_area(pg_temp.u('com'),pg_temp.u('g'),null,'venda',10,pg_temp.op('c10-b'),pg_temp.u('dono'),null);
select pg_temp.ok(pg_temp.lote('c10-bom')=5 and pg_temp.lote('c10-venc')=5,'sobra vai para o lote dentro da validade');

-- 3. A reposição usa a mesma regra para a sobra da prateleira.
select pg_temp.ok(position($t$coalesce(l.vencimento >= (now() at time zone 'America/Sao_Paulo')::date, true)$t$ in pg_get_functiondef('public.funcionario_reposicao_concluir(text,uuid,numeric)'::regprocedure))>0,'reposição não põe sobra no vencido');
select 'OK 033: sobra da contagem não entra em lote vencido' as resultado;
