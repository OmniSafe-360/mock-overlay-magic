-- A6: o dono cancela venda do caixa aberto; o caixa é avisado e devolve da gaveta; o fechamento bate.
-- Dados fictícios; usar com 015_base_caixa_estoque.sql entre begin e rollback.
update funcionarios set caixa=true where id=pg_temp.u('func');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
select definir_pin_dono('5826');
create function pg_temp.venda(t text, total numeric, pag jsonb) returns jsonb language sql as $$
 select caixa_registrar_venda(repeat('f',64),jsonb_build_object('id',pg_temp.u(t),'turno_id',pg_temp.u('turno-a6'),'feita_em',now(),
  'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('g'),'qtd',1,'preco',total)),
  'pagamentos',pag,'cliente',jsonb_build_object('id',pg_temp.u('cli6'),'nome','Cliente simulado'))) $$;
create function pg_temp.esperado() returns numeric language sql as $$
 select (public._resumo_turno(pg_temp.u('turno-a6'))->>'dinheiro_esperado')::numeric $$;
create function pg_temp.tirado() returns numeric language sql as $$
 select coalesce(sum(valor),0) from caixa_sangrias where turno_id=pg_temp.u('turno-a6') $$;
create function pg_temp.na_tela(t text) returns jsonb language sql as $$
 select e from jsonb_array_elements(caixa_estado(repeat('f',64))->'vendas') e where (e->>'id')::uuid=pg_temp.u(t) $$;

set local role anon;
select caixa_abrir(repeat('f',64),pg_temp.u('turno-a6'),50);
-- Venda de 20 paga com 30 em dinheiro (troco 10); venda de 8 no fiado; venda de 5 em dinheiro.
select pg_temp.ok((pg_temp.venda('a6-v1',20,jsonb_build_array(jsonb_build_object('forma','dinheiro','valor',30)))->>'situacao') is distinct from 'bloqueada','venda 1');
select pg_temp.ok((pg_temp.venda('a6-v2',8,jsonb_build_array(jsonb_build_object('forma','fiado','valor',8)))->>'situacao') is distinct from 'bloqueada','venda 2 fiado');
select pg_temp.ok((pg_temp.venda('a6-v3',5,jsonb_build_array(jsonb_build_object('forma','dinheiro','valor',5)))->>'situacao') is distinct from 'bloqueada','venda 3');
reset role;
select receber_fiado(pg_temp.u('a6-p'),pg_temp.u('cli6'),8,'pix',null);
select pg_temp.ok(pg_temp.esperado()=75,'antes: 50 + 30 − 10 + 5 = 75');

-- 1. Dono cancela a venda 1 com o caixa aberto: o caixa é avisado para devolver 20 da gaveta.
select set_config('a6.c1',cancelar_venda_celular(pg_temp.u('a6-v1'),'teste')::text,true);
select pg_temp.ok((current_setting('a6.c1')::jsonb->>'caixa_aberto')::boolean and (current_setting('a6.c1')::jsonb->>'devolver_gaveta')::numeric=20,'dono: caixa avisado, devolver 20');
set local role anon;
select pg_temp.ok(pg_temp.na_tela('a6-v1')->>'cancelada_por'='dono' and (pg_temp.na_tela('a6-v1')->>'devolver_gaveta')::numeric=20,'caixa vê: cancelada pelo dono, devolver 20');
reset role;
select pg_temp.ok(pg_temp.esperado()=55 and pg_temp.tirado()=0,'o dinheiro da venda sai da conta (55); nada registrado como tirado');
-- 2. Dono cancela a venda 2 (fiado já pago em Pix): o caixa devolve 8 da gaveta, registrado como tirado.
select set_config('a6.c2',cancelar_venda_celular(pg_temp.u('a6-v2'),null)::text,true);
select pg_temp.ok((current_setting('a6.c2')::jsonb->>'devolver')::numeric=8 and (current_setting('a6.c2')::jsonb->>'devolver_gaveta')::numeric=8,'fiado pago: devolver 8 da gaveta');
select pg_temp.ok(pg_temp.tirado()=8 and pg_temp.esperado()=47,'8 tirados: esperado 47');
select pg_temp.ok((select motivo from caixa_sangrias where turno_id=pg_temp.u('turno-a6')) like '%cancelada pelo dono)','motivo diz que foi o dono');
-- 3. Repetir não tira de novo e devolve os mesmos números.
select set_config('a6.r2',cancelar_venda_celular(pg_temp.u('a6-v2'),null)::text,true);
select pg_temp.ok(current_setting('a6.r2')::jsonb->>'situacao'='repetida' and (current_setting('a6.r2')::jsonb->>'devolver_gaveta')::numeric=8 and pg_temp.tirado()=8,'repetida: mesmos números, sem tirar de novo');
-- 4. O caixa devolveu 20 + 8 e fecha contando 47: bate.
set local role anon;
select caixa_fechar(repeat('f',64),pg_temp.u('turno-a6'),47,null);
reset role;
select pg_temp.ok((select diferenca from caixa_turnos where id=pg_temp.u('turno-a6'))=0,'fechamento bate');
-- 5. Caixa já fechado: cancelar não avisa o caixa nem tira da gaveta.
select set_config('a6.c3',cancelar_venda_celular(pg_temp.u('a6-v3'),null)::text,true);
select pg_temp.ok(not (current_setting('a6.c3')::jsonb->>'caixa_aberto')::boolean and (current_setting('a6.c3')::jsonb->>'devolver_gaveta')::numeric=0 and pg_temp.tirado()=8,'caixa fechado: nada muda na gaveta');
select pg_temp.ok((select diferenca from caixa_turnos where id=pg_temp.u('turno-a6'))=0,'fechamento antigo continua igual');
-- 6. Função interna fechada.
select pg_temp.ok(not has_function_privilege('anon','public._devolver_gaveta_venda(uuid)','execute')
  and not has_function_privilege('authenticated','public._devolver_gaveta_venda(uuid)','execute'),'função interna fechada');
select 'OK A6: cancelamento pelo dono com o caixa aberto' as resultado;
