-- A5: devolução ao cliente do fiado, ao cancelar no caixa, sai da gaveta e o fechamento desconta.
-- Dados fictícios; usar com 015_base_caixa_estoque.sql entre begin e rollback.
update funcionarios set caixa=true where id=pg_temp.u('func');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
select definir_pin_dono('5826');
create function pg_temp.venda_fiado(t text, valor numeric) returns jsonb language sql as $$
 select caixa_registrar_venda(repeat('f',64),jsonb_build_object('id',pg_temp.u(t),'turno_id',pg_temp.u('turno-a5'),'feita_em',now(),
  'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('g'),'qtd',1,'preco',valor)),
  'pagamentos',jsonb_build_array(jsonb_build_object('forma','fiado','valor',valor)),
  'cliente',jsonb_build_object('id',pg_temp.u('cli'),'nome','Cliente simulado'))) $$;
create function pg_temp.esperado() returns numeric language sql as $$
 select (public._resumo_turno(pg_temp.u('turno-a5'))->>'dinheiro_esperado')::numeric $$;
create function pg_temp.tirado() returns numeric language sql as $$
 select coalesce(sum(valor),0) from caixa_sangrias where turno_id=pg_temp.u('turno-a5') $$;

set local role anon;
select caixa_abrir(repeat('f',64),pg_temp.u('turno-a5'),50);
select pg_temp.ok((pg_temp.venda_fiado('a5-v1',10)->>'situacao') is distinct from 'bloqueada','venda de R$ 10 no fiado');
select pg_temp.ok((pg_temp.venda_fiado('a5-v2',8)->>'situacao') is distinct from 'bloqueada','venda de R$ 8 no fiado');
reset role;
-- O cliente pagou a primeira toda (R$ 10) e R$ 3 da segunda, ao dono (fora da gaveta deste caixa).
select receber_fiado(pg_temp.u('a5-p1'),pg_temp.u('cli'),13,'dinheiro',null);
select pg_temp.ok(pg_temp.esperado()=50,'antes do cancelamento a gaveta deve ter 50');

-- 1. Cancelar a primeira: o cliente devia 18 e pagou 13 (deve 5); sai 5 da conta e os outros 5 voltam para ele.
--    Esses 5 saem da gaveta e são descontados do esperado.
set local role anon;
select set_config('a5.c1',caixa_cancelar_venda(repeat('f',64),pg_temp.u('a5-v1'),'5826','teste')::text,true);
reset role;
select pg_temp.ok((current_setting('a5.c1')::jsonb->>'devolver')::numeric=5 and (current_setting('a5.c1')::jsonb->>'gaveta')::boolean,'devolve 5 e registra que saiu da gaveta');
select pg_temp.ok(pg_temp.tirado()=5 and pg_temp.esperado()=45,'esperado 50 − 5 devolvidos = 45');
select pg_temp.ok((select motivo from caixa_sangrias where turno_id=pg_temp.u('turno-a5')) like 'Devolvido ao cliente do fiado (venda nº %','motivo explica a saída');
-- 2. Repetir o cancelamento não registra de novo.
set local role anon;
select set_config('a5.r1',caixa_cancelar_venda(repeat('f',64),pg_temp.u('a5-v1'),'5826','teste')::text,true);
select pg_temp.ok(current_setting('a5.r1')::jsonb->>'situacao'='repetida','repetir volta repetida');
-- Resposta perdida e reenvio: o caixa recebe de novo quanto devolver e que saiu da gaveta (Codex #192).
select pg_temp.ok((current_setting('a5.r1')::jsonb->>'devolver')::numeric=5 and (current_setting('a5.r1')::jsonb->>'gaveta')::boolean,'repetida traz devolver 5 e gaveta');
reset role;
select pg_temp.ok(pg_temp.tirado()=5,'repetir não tira de novo');
-- 3. Cancelar a segunda: o cliente não deve mais nada; os 8 já pagos voltam para ele (total devolvido 13 = o que pagou).
set local role anon;
select set_config('a5.c2',caixa_cancelar_venda(repeat('f',64),pg_temp.u('a5-v2'),'5826',null)::text,true);
reset role;
select pg_temp.ok((current_setting('a5.c2')::jsonb->>'devolver')::numeric=8 and pg_temp.tirado()=13 and pg_temp.esperado()=37,'devolve 8, total 13, esperado 37');
-- 4. Fechar contando o que ficou na gaveta: sem falta falsa.
set local role anon;
select caixa_fechar(repeat('f',64),pg_temp.u('turno-a5'),37,null);
reset role;
select pg_temp.ok((select diferenca from caixa_turnos where id=pg_temp.u('turno-a5'))=0,'fechamento bate: diferença 0');
select pg_temp.ok((select coalesce(sum(case tipo when 'compra' then valor else -valor end),0) from fiado_movimentos where cliente_id=pg_temp.u('cli'))=0,'cliente não deve nem tem crédito');
select 'OK A5: devolução do fiado sai da gaveta' as resultado;
