-- A1 (F02): lote vencido sai por último. Dados fictícios; usar com 015_base_caixa_estoque.sql entre begin e rollback.
-- Cenário: gôndola do produto 'g' com 5 unidades de um lote vencido e 10 de um lote bom (e o depósito intacto).
update produtos set controla_validade=true where id=pg_temp.u('g');
create function pg_temp.poe(t text,q numeric) returns void language plpgsql as $$
begin
  update saldos set quantidade=q where produto_id=pg_temp.u('g') and area='venda' and lote_id=pg_temp.u(t) and not pendente;
  if not found then insert into saldos(comercio_id,produto_id,area,lote_id,quantidade) values(pg_temp.u('com'),pg_temp.u('g'),'venda',pg_temp.u(t),q); end if;
end $$;
create function pg_temp.prepara() returns void language plpgsql as $$
begin
  update saldos set quantidade=0 where produto_id=pg_temp.u('g') and area='venda';
  insert into lotes(id,comercio_id,produto_id,numero,vencimento) values
   (pg_temp.u('lote-venc'),pg_temp.u('com'),pg_temp.u('g'),'VENC1',(now() at time zone 'America/Sao_Paulo')::date-5),
   (pg_temp.u('lote-bom'),pg_temp.u('com'),pg_temp.u('g'),'BOM1',(now() at time zone 'America/Sao_Paulo')::date+30),
   (pg_temp.u('lote-hoje'),pg_temp.u('com'),pg_temp.u('g'),'HOJE1',(now() at time zone 'America/Sao_Paulo')::date)
  on conflict (id) do nothing;
  -- Saldo não pode ser apagado (histórico imutável): zera e reaproveita a linha de cada lote.
  perform pg_temp.poe('lote-venc',5); perform pg_temp.poe('lote-bom',10);
end $$;
create function pg_temp.lote(t text) returns numeric language sql as $$
  select coalesce(sum(quantidade),0) from saldos where produto_id=pg_temp.u('g') and area='venda' and lote_id=pg_temp.u(t) $$;
create function pg_temp.op(t text) returns uuid language plpgsql as $$
begin
  insert into operacoes(id,user_id,comercio_id,produto_id,tipo,hash) values(pg_temp.u(t),pg_temp.u('dono'),pg_temp.u('com'),pg_temp.u('g'),'teste',t);
  return pg_temp.u(t);
end $$;

-- 1. Baixa comum (venda/ajuste): o bom sai primeiro, o vencido continua no sistema.
select pg_temp.prepara();
select _tirar_saldo(pg_temp.u('com'),pg_temp.u('g'),null,'venda',3,pg_temp.op('a1-baixa'),pg_temp.u('dono'),null,'ajuste',null);
select pg_temp.ok(pg_temp.lote('lote-bom')=7 and pg_temp.lote('lote-venc')=5,'baixa de 3 sai do lote bom; vencido intacto');
-- 2. Só depois do bom acabar é que o vencido sai.
select _tirar_saldo(pg_temp.u('com'),pg_temp.u('g'),null,'venda',9,pg_temp.op('a1-baixa2'),pg_temp.u('dono'),null,'ajuste',null);
select pg_temp.ok(pg_temp.lote('lote-bom')=0 and pg_temp.lote('lote-venc')=3,'9: 7 do bom e só 2 do vencido');

-- 3. Vence hoje ainda é válido: sai antes do vencido e antes do bom (validade mais próxima).
select pg_temp.prepara();
select pg_temp.poe('lote-hoje',2);
select _tirar_saldo(pg_temp.u('com'),pg_temp.u('g'),null,'venda',3,pg_temp.op('a1-hoje'),pg_temp.u('dono'),null,'ajuste',null);
select pg_temp.ok(pg_temp.lote('lote-hoje')=0 and pg_temp.lote('lote-bom')=9 and pg_temp.lote('lote-venc')=5,'vence hoje sai primeiro; vencido intacto');
select pg_temp.poe('lote-hoje',0);

-- 4. Perda "quebrou": sai do bom. Perda "venceu": sai do vencido.
select pg_temp.prepara();
select _lancar_perda(pg_temp.u('a1-perda-q'),pg_temp.u('com'),pg_temp.u('g'),null,'venda',2,'quebrou',null,pg_temp.u('func'),null);
select pg_temp.ok(pg_temp.lote('lote-bom')=8 and pg_temp.lote('lote-venc')=5,'perda quebrou sai do lote bom');
select _lancar_perda(pg_temp.u('a1-perda-v'),pg_temp.u('com'),pg_temp.u('g'),null,'venda',4,'venceu',null,pg_temp.u('func'),null);
select pg_temp.ok(pg_temp.lote('lote-bom')=8 and pg_temp.lote('lote-venc')=1,'perda venceu sai do lote vencido');
-- Repetir a mesma perda não baixa de novo.
select _lancar_perda(pg_temp.u('a1-perda-v'),pg_temp.u('com'),pg_temp.u('g'),null,'venda',4,'venceu',null,pg_temp.u('func'),null);
select pg_temp.ok(pg_temp.lote('lote-venc')=1,'perda repetida não baixa de novo');

-- 5. Acerto de contagem para menos: tira do bom, o vencido continua aparecendo.
select pg_temp.prepara();
select _acertar_area(pg_temp.u('com'),pg_temp.u('g'),null,'venda',12,pg_temp.op('a1-acerto'),pg_temp.u('dono'),null);
select pg_temp.ok(pg_temp.lote('lote-bom')=7 and pg_temp.lote('lote-venc')=5,'contagem 12 de 15 tira 3 do bom');

-- 6. Venda pelo caixa do celular: sai do bom.
select pg_temp.prepara();
update funcionarios set caixa=true where id=pg_temp.u('func');
set local role anon;
select caixa_abrir(repeat('f',64),pg_temp.u('turno-a1'),0);
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),jsonb_build_object('id',pg_temp.u('a1-venda'),'turno_id',pg_temp.u('turno-a1'),'feita_em',now(),
  'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('g'),'qtd',3,'preco',4)),
  'pagamentos',jsonb_build_array(jsonb_build_object('forma','dinheiro','valor',12))))->>'situacao') is distinct from 'bloqueada','venda de 3 aceita');
reset role;
select pg_temp.ok(pg_temp.lote('lote-bom')=7 and pg_temp.lote('lote-venc')=5,'venda do caixa sai do lote bom');
-- Cancelar devolve exatamente ao mesmo lote.
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select cancelar_venda_celular(pg_temp.u('a1-venda'),'teste');
reset role;
select pg_temp.ok(pg_temp.lote('lote-bom')=10 and pg_temp.lote('lote-venc')=5,'cancelar devolve ao lote bom');

-- 7. A função nova não pode ser chamada de fora.
select pg_temp.ok(not has_function_privilege('anon','public._tirar_saldo_ordem(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid,tipo_movimento,uuid,boolean)','execute')
  and not has_function_privilege('authenticated','public._tirar_saldo_ordem(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid,tipo_movimento,uuid,boolean)','execute')
  and not has_function_privilege('anon','public._tirar_saldo(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid,tipo_movimento,uuid)','execute'),'funções internas fechadas');
select 'OK A1: vencido sai por último' as resultado;
