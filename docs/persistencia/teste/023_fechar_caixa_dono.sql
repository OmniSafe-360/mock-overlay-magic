-- A8: o dono fecha o caixa que ficou aberto quando o funcionário perdeu a função Caixa ou foi bloqueado.
-- Dados fictícios; usar com 015_base_caixa_estoque.sql entre begin e rollback.
update funcionarios set caixa=true where id=pg_temp.u('func');
create function pg_temp.tenta(sqltxt text) returns text language plpgsql as $$
begin execute sqltxt; return 'ok'; exception when others then return sqlerrm; end $$;

set local role anon;
select caixa_abrir(repeat('f',64),pg_temp.u('turno-a8'),50);
select pg_temp.ok((caixa_registrar_venda(repeat('f',64),jsonb_build_object('id',pg_temp.u('a8-v1'),'turno_id',pg_temp.u('turno-a8'),'feita_em',now(),
  'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('g'),'qtd',1,'preco',20)),
  'pagamentos',jsonb_build_array(jsonb_build_object('forma','dinheiro','valor',20))))->>'situacao') is distinct from 'bloqueada','venda de 20');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
-- 1. Funcionário ainda tem o Caixa: o dono não fecha no lugar dele.
select pg_temp.ok(pg_temp.tenta($q$select fechar_caixa_dono(pg_temp.u('turno-a8'),70,null)$q$) like '%caixa_ainda_com_funcionario%','com o Caixa ligado, o dono não fecha');
reset role;
-- 2. O dono desliga o Caixa: o funcionário não consegue mais fechar.
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select definir_caixa_funcionario(pg_temp.u('func'),false);
reset role;
set local role anon;
select pg_temp.ok(pg_temp.tenta($q$select caixa_fechar(repeat('f',64),pg_temp.u('turno-a8'),70,null)$q$) <> 'ok','funcionário sem o Caixa não fecha');
reset role;
-- 3. Outro dono e visitante recusados.
select set_config('request.jwt.claim.sub',pg_temp.u('outro')::text,true);
set local role authenticated;
select pg_temp.ok(pg_temp.tenta($q$select fechar_caixa_dono(pg_temp.u('turno-a8'),70,null)$q$) like '%sem_permissao%','outro dono recusado');
reset role;
set local role anon;
select pg_temp.ok(pg_temp.tenta($q$select fechar_caixa_dono(pg_temp.u('turno-a8'),70,null)$q$) like '%permission denied%','visitante recusado');
reset role;
-- 4. Valor inválido recusado; o dono fecha com 65 contados (esperado 70): falta de 5, com o recado.
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select pg_temp.ok(pg_temp.tenta($q$select fechar_caixa_dono(pg_temp.u('turno-a8'),-1,null)$q$) like '%valor_invalido%','valor negativo recusado');
select pg_temp.ok(fechar_caixa_dono(pg_temp.u('turno-a8'),65,'  gaveta conferida  ')->>'situacao'='fechado','dono fechou');
reset role;
select pg_temp.ok((select situacao='fechado' and dinheiro_esperado=70 and dinheiro_contado=65 and diferenca=-5 and conferido_em is null
  and observacao='Fechado pelo dono: gaveta conferida' from caixa_turnos where id=pg_temp.u('turno-a8')),'esperado 70, contado 65, falta 5, recado');
-- 5. Repetir não muda nada; venda nova no turno fechado é recusada.
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select pg_temp.ok(fechar_caixa_dono(pg_temp.u('turno-a8'),99,null)->>'situacao'='repetida','repetir devolve repetida');
reset role;
select pg_temp.ok((select dinheiro_contado=65 from caixa_turnos where id=pg_temp.u('turno-a8')),'repetir não mudou o contado');
update funcionarios set caixa=true where id=pg_temp.u('func');
set local role anon;
select pg_temp.ok(pg_temp.tenta($q$select caixa_registrar_venda(repeat('f',64),jsonb_build_object('id',pg_temp.u('a8-v2'),'turno_id',pg_temp.u('turno-a8'),'feita_em',now(),
  'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('g'),'qtd',1,'preco',5)),
  'pagamentos',jsonb_build_array(jsonb_build_object('forma','dinheiro','valor',5))))$q$) like '%turno_fechado%','venda em turno fechado recusada');
reset role;
-- 6. Funcionário bloqueado com o caixa aberto: o dono também fecha (bateu certinho → já conferido).
set local role anon;
select caixa_abrir(repeat('f',64),pg_temp.u('turno-a8b'),30);
reset role;
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select bloquear_funcionario(pg_temp.u('func'),true);
select pg_temp.ok(fechar_caixa_dono(pg_temp.u('turno-a8b'),30,null)->>'situacao'='fechado','bloqueado: dono fechou');
reset role;
select pg_temp.ok((select diferenca=0 and conferido_em is not null and observacao='Fechado pelo dono' from caixa_turnos where id=pg_temp.u('turno-a8b')),'bateu: já conferido');
select 'A8 ok';
