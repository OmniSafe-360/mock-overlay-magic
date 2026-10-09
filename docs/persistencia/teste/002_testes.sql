-- Testes executáveis da proposta (PostgreSQL local, separado de produção).
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = warning;

-- ---------- Auxiliares ----------
create function public.u(t text) returns uuid language sql immutable as $$ select md5(t)::uuid $$;
create function public.t_erro(_sql text, _esperado text) returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'FALHOU: esperava erro "%"', _esperado;
exception when others then
  if sqlerrm not like '%' || _esperado || '%' then
    raise exception 'FALHOU: veio "%" em vez de "%"', sqlerrm, _esperado; end if;
end $$;
create function public.t_ok(_cond boolean, _nome text) returns text language plpgsql as $$
begin if _cond is not true then raise exception 'FALHOU: %', _nome; end if; return 'OK ' || _nome; end $$;
create function public.t_p(op text, prod text, com text, un text, ctrl boolean, areas text,
  vars text default '[]', cod text default null, forn uuid default null, preco numeric default 2) returns jsonb
language sql immutable as $$
  select jsonb_build_object('operacao_id', u(op), 'produto', jsonb_build_object(
    'id', u(prod), 'comercio_id', u(com), 'nome', 'Produto ' || prod, 'unidade', un,
    'preco_compra', 1, 'preco_venda', preco, 'controla_validade', ctrl, 'codigo_barras', cod,
    'fornecedor_id', forn, 'avisos_dias', '[30,60]'::jsonb), 'variacoes', vars::jsonb, 'areas', areas::jsonb) $$;
grant execute on function public.u(text), public.t_erro(text, text), public.t_ok(boolean, text),
  public.t_p(text, text, text, text, boolean, text, text, text, uuid, numeric) to authenticated, anon;

-- ---------- Dados ----------
insert into auth.users values (u('A'), 'a@x'), (u('B'), 'b@x');
insert into public.user_roles (user_id, role) values (u('A'), 'dono'), (u('B'), 'dono'), (u('B'), 'gerente');
insert into public.comercios (id, dono_id, tipo, nome) values
  (u('cm1'), u('A'), 'mercado', 'Mercado A'), (u('cm2'), u('A'), 'mercado', 'Mercado A2'),
  (u('cf1'), u('A'), 'farmacia', 'Farmácia A'), (u('cr1'), u('A'), 'loja_roupas', 'Roupas A'),
  (u('cb1'), u('B'), 'mercado', 'Mercado B');
insert into public.fornecedores (id, dono_id, nome) values (u('fa'), u('A'), 'Forn A'), (u('fb'), u('B'), 'Forn B');

-- ---------- Permissões e autenticação ----------
set role anon;
select t_erro($$select salvar_produto('{}')$$, 'permission denied');
select 'OK anonimo nao executa salvamento';
set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
select t_erro($$select salvar_produto(t_p('x','P1','cm1','Pacote',null,'[]'))$$, 'nao_autenticado');
select 'OK sem login recusado';
select set_config('request.jwt.claim.sub', u('B')::text, false);
select t_erro($$select salvar_produto(t_p('x','P1','cm1','Pacote',null,'[]'))$$, 'sem_acesso_ao_comercio');
select 'OK papel global (gerente) nao abre comercio de outro dono';
select set_config('request.jwt.claim.sub', u('A')::text, false);
select t_erro($$insert into produtos (comercio_id, nome, unidade, preco_compra, preco_venda) values (u('cm1'),'x','Pacote',1,1)$$, 'permission denied');
select t_erro($$insert into saldos (comercio_id, produto_id, area, quantidade) values (u('cm1'),u('P1'),'deposito',1)$$, 'permission denied');
select 'OK escrita direta bloqueada';

-- ---------- Cadastro, repetição, edição ----------
select salvar_produto(t_p('op1','P1','cm1','Pacote',null,
  '[{"area":"deposito","local":{"nome":" Estante  A "},"minimo":5,"maximo":60,"contagem":{"quantidade":40}},
    {"area":"venda","local":{"nome":"Gôndola 3"},"contagem":{"quantidade":8}}]', '[]', '789001', u('fa')));
reset role;
select t_ok((select sum(quantidade) from saldos where produto_id = u('P1')) = 48, 'saldo total 40 + 8 = 48');
select t_ok((select sum(quantidade) from movimentos where produto_id = u('P1')) = 48, 'historico soma 48, sem marcador duplicando');
select t_ok((select count(*) from contagens where produto_id = u('P1')) = 2, 'duas areas contadas');
select t_ok((select nome from locais where comercio_id = u('cm1') and area = 'deposito') = 'Estante  A', 'local criado');
set role authenticated;
select t_ok(salvar_produto(t_p('op1','P1','cm1','Pacote',null,
  '[{"area":"deposito","local":{"nome":" Estante  A "},"minimo":5,"maximo":60,"contagem":{"quantidade":40}},
    {"area":"venda","local":{"nome":"Gôndola 3"},"contagem":{"quantidade":8}}]', '[]', '789001', u('fa')))
  = jsonb_build_object('produto_id', u('P1'), 'contagens_registradas', 2), 'repeticao identica devolve resultado original');
select t_erro($$select salvar_produto(t_p('op1','P1','cm1','Pacote',null,'[]','[]','789001',u('fa'),9))$$, 'operacao_reutilizada_com_conteudo_diferente');
select 'OK mesmo id com outro conteudo recusado';
select salvar_produto(t_p('op2','P1','cm1','Pacote',null,
  '[{"area":"deposito","local":{"nome":"estante a"},"minimo":10,"maximo":70},{"area":"venda","local":{"nome":"Gôndola 3"}}]', '[]', '789001', u('fa'), 3));
reset role;
select t_ok((select count(*) from contagens where produto_id = u('P1')) = 2 and (select sum(quantidade) from movimentos where produto_id = u('P1')) = 48
  and (select preco_venda from produtos where id = u('P1')) = 3 and (select count(*) from operacoes) = 2, 'editar preco/limites nao reconta; operacao sem movimento registrada');
set role authenticated;
select t_erro($$select salvar_produto(t_p('op3','P1','cm1','Pacote',null,'[{"area":"deposito","local":{"nome":"Estante A"},"contagem":{"quantidade":41}}]','[]','789001'))$$, 'contagem_ja_registrada');
select t_erro($$select salvar_produto(t_p('op3','P1','cm1','Pacote',null,'[{"area":"deposito","local":{"nome":"Estante B"}}]','[]','789001'))$$, 'troca_de_local_exige_transferencia');
select t_erro($$select salvar_produto(t_p('op3','P1','cm1','Pacote',null,'[{"area":"deposito","local":null}]','[]','789001'))$$, 'troca_de_local_exige_transferencia');
select t_erro($$select salvar_produto(t_p('op3','P1','cm1','Kg',null,'[]','[]','789001'))$$, 'unidade_travada');
select 'OK local, unidade e recontagem protegidos';

-- ---------- Quantidades ----------
select t_erro($$select salvar_produto(t_p('op4','P2','cm1','Pacote',null,'[{"area":"deposito","contagem":{"quantidade":1.5}}]'))$$, 'unidade_exige_inteiro');
select t_erro($$select salvar_produto(t_p('op4','P2','cm1','Kg',null,'[{"area":"deposito","contagem":{"quantidade":1.2345}}]'))$$, 'mais_de_tres_casas');
select t_erro($$select salvar_produto(t_p('op4','P2','cm1','Kg',null,'[{"area":"deposito","contagem":{"quantidade":-1}}]'))$$, 'quantidade_negativa');
select t_erro($$select salvar_produto(t_p('op4','P2','cm1','Kg',null,'[{"area":"deposito","minimo":5,"maximo":2}]'))$$, 'maximo_menor_que_minimo');
select t_erro($$select salvar_produto(t_p('op4','P2','cm1','Kg',null,'[{"area":"deposito","contagem":{}}]'))$$, 'quantidade_vazia');
select salvar_produto(t_p('op4','P2','cm1','Kg',null,'[{"area":"deposito","contagem":{"quantidade":0}}]'));
reset role;
select t_ok((select quantidade from contagens where produto_id = u('P2') and area = 'deposito') = 0
  and not exists (select 1 from contagens where produto_id = u('P2') and area = 'venda')
  and not exists (select 1 from saldos where produto_id = u('P2')), 'zero contado diferente de nao contado');
set role authenticated;

-- ---------- Códigos e rollback ----------
select t_erro($$select salvar_produto(t_p('op5','P3','cm1','Pacote',null,'[]','[]','789001'))$$, 'codigo_em_uso');
select salvar_produto(t_p('op5','P3','cm2','Pacote',null,'[]','[]','789001'));
select 'OK mesmo codigo permitido em outro comercio';
select t_erro($$select salvar_produto(t_p('op6','R1','cr1','Unidade',null,
  '[{"area":"deposito","variacao_id":"'||u('v1')||'","contagem":{"quantidade":5}}]',
  '[{"id":"'||u('v1')||'","tamanho":"M","cor":"Azul","codigo_barras":"555"}]','555'))$$, 'codigo_em_uso');
reset role;
select t_ok(not exists (select 1 from produtos where id = u('R1')) and not exists (select 1 from codigos_barras where codigo = '555')
  and not exists (select 1 from operacoes where id = u('op6')), 'falha no meio desfaz tudo (produto, codigo, operacao)');
set role authenticated;

-- ---------- Isolamento entre donos e comércios ----------
select t_erro($$select salvar_produto(t_p('op7','P1','cm2','Pacote',null,'[]'))$$, 'produto_de_outro_comercio');
select set_config('request.jwt.claim.sub', u('B')::text, false);
select t_erro($$select salvar_produto(t_p('op8','B1','cb1','Pacote',null,'[]','[]',null,u('fa')))$$, 'fornecedor_de_outro_dono');
select t_erro($$select salvar_produto(t_p('op8','B1','cb1','Pacote',null,
  '[{"area":"deposito","local":{"id":"'||(select id from locais limit 0)||'"}}]'))$$, 'local_de_outro');
select t_ok((select count(*) from saldos) = 0 and (select count(*) from produtos) = 0 and (select count(*) from movimentos) = 0, 'dono B nao le dados do dono A');
select salvar_produto(t_p('op8','B1','cb1','Pacote',null,'[]','[]','789001'));
select 'OK dono B usa o mesmo codigo no proprio comercio';
reset role;
select set_config('local.loc', (select id::text from locais where comercio_id = u('cm1') and area = 'deposito'), false);
set role authenticated;
select t_erro(format($$select salvar_produto(t_p('op9','B2','cb1','Pacote',null,'[{"area":"deposito","local":{"id":"%s"}}]'))$$, current_setting('local.loc')), 'local_de_outro_comercio_ou_area');
select set_config('request.jwt.claim.sub', u('A')::text, false);
select t_erro(format($$select salvar_produto(t_p('op9','P6','cm1','Pacote',null,'[{"area":"venda","local":{"id":"%s"}}]'))$$, current_setting('local.loc')), 'local_de_outro_comercio_ou_area');
select 'OK local de outro comercio ou de outra area recusado';

-- ---------- Validade e lotes ----------
select salvar_produto(t_p('op10','P4','cm1','Pacote',true,
  '[{"area":"deposito","local":{"nome":"Estante A"},"contagem":{"quantidade":40,"partes":[{"numero":"A12","vencimento":"2027-04-10","quantidade":25},{"quantidade":15}]}},
    {"area":"venda","contagem":{"quantidade":20,"partes":[{"numero":" a12 ","vencimento":"2027-04-10","quantidade":20}]}}]'));
reset role;
select t_ok((select count(*) from lotes where produto_id = u('P4')) = 1, 'mesmo lote (normalizado) nas duas areas = um lote');
select t_ok((select sum(quantidade) from saldos where produto_id = u('P4')) = 60 and (select sum(quantidade) from movimentos where produto_id = u('P4')) = 60, 'validade divide, total 60 e nao 120');
select t_ok((select count(*) from saldos where produto_id = u('P4') and pendente) = 1, 'parte sem data vira pendencia');
set role authenticated;
select t_erro($$select salvar_produto(t_p('op11','P7','cm1','Pacote',true,'[{"area":"deposito","contagem":{"quantidade":40,"partes":[{"vencimento":"2027-01-01","quantidade":25},{"quantidade":10}]}}]'))$$, 'soma_diferente_da_contagem');
select t_erro($$select salvar_produto(t_p('op11','P7','cm1','Pacote',true,'[{"area":"deposito","contagem":{"quantidade":5,"partes":[{"vencimento":"2027-01-01","quantidade":5},{"quantidade":0}]}}]'))$$, 'quantidade_zero');
select t_erro($$select salvar_produto(t_p('op11','P7','cm1','Pacote',true,
  '[{"area":"deposito","contagem":{"quantidade":5,"partes":[{"numero":"L9","vencimento":"2027-01-01","quantidade":5}]}},
    {"area":"venda","contagem":{"quantidade":2,"partes":[{"numero":"l9","vencimento":"2027-02-01","quantidade":2}]}}]'))$$, 'lote_com_datas_diferentes');
select salvar_produto(t_p('op12','K1','cm1','Kg',true,'[{"area":"deposito","contagem":{"quantidade":12.5,"partes":[{"vencimento":"2027-01-01","quantidade":7.25},{"vencimento":"2027-02-01","quantidade":5.25}]}}]'));
select 'OK 7,25 + 5,25 = 12,5 kg exato';
select t_erro($$select salvar_produto(t_p('op13','P4','cm1','Pacote',false,'[]'))$$, 'desligar_validade_bloqueado');
select t_erro($$select salvar_produto(t_p('op13','F1','cf1','Caixa',false,'[]'))$$, 'farmacia_exige_validade');
select t_erro($$select salvar_produto(t_p('op13','F1','cf1','Caixa',null,'[]'))$$, 'farmacia_exige_validade');
select t_erro($$select salvar_produto(t_p('op13','F1','cf1','Caixa',true,'[{"area":"deposito","contagem":{"quantidade":6,"partes":[{"vencimento":"2027-05-01","quantidade":6}]}}]'))$$, 'pendencia_sem_confirmacao');
select salvar_produto(t_p('op13','F1','cf1','Caixa',true,'[{"area":"deposito","contagem":{"quantidade":10,"partes":[{"vencimento":"2027-05-01","quantidade":6,"confirmada":true},{"numero":"X1","vencimento":"2027-06-01","quantidade":4}]}}]'));
select 'OK farmacia: validade obrigatoria e pendencia so com confirmacao';

-- ---------- Pendências: completar e dividir ----------
select salvar_produto(t_p('op14','P5','cm1','Caixa',true,'[{"area":"deposito","contagem":{"quantidade":20,"partes":[{"quantidade":10},{"quantidade":10}]}}]'));
reset role;
select set_config('local.p1', (select id::text from saldos where produto_id = u('P5') order by id limit 1), false);
select set_config('local.p2', (select id::text from saldos where produto_id = u('P5') order by id offset 1 limit 1), false);
set role authenticated;
select t_erro(format($$select resolver_pendencia(jsonb_build_object('operacao_id',u('r1'),'comercio_id',u('cm1'),'produto_id',u('P5'),'origem_id','%s',
  'partes','[{"vencimento":"2027-01-01","quantidade":15}]'::jsonb))$$, current_setting('local.p1')), 'soma_das_partes_diferente_da_pendencia');
select t_erro(format($$select resolver_pendencia(jsonb_build_object('operacao_id',u('r1'),'comercio_id',u('cm1'),'produto_id',u('P5'),'origem_id','%s',
  'partes','[{"vencimento":"2027-01-01","quantidade":5}]'::jsonb))$$, current_setting('local.p1')), 'soma_das_partes_diferente_da_pendencia');
select 'OK duas pendencias de 10 nao viram 15 e 5';
select resolver_pendencia(jsonb_build_object('operacao_id',u('r2'),'comercio_id',u('cm1'),'produto_id',u('P5'),'origem_id',current_setting('local.p1'),
  'partes','[{"vencimento":"2027-01-01","quantidade":4},{"quantidade":6}]'::jsonb));
reset role;
select t_ok((select sum(quantidade) from saldos where produto_id = u('P5')) = 20
  and (select sum(quantidade) from movimentos where produto_id = u('P5')) = 20
  and (select quantidade from saldos where id = current_setting('local.p2')::uuid) = 10
  and (select count(*) from saldos where origem_id = current_setting('local.p1')::uuid) = 2
  and (select count(*) from movimentos where operacao_id = u('r2') and criado_por = u('A')) = 3, 'dividir 10 em 4 + 6: total 20, outra pendencia intacta, autoria e vinculo gravados');
set role authenticated;
select t_erro(format($$select resolver_pendencia(jsonb_build_object('operacao_id',u('r3'),'comercio_id',u('cm1'),'produto_id',u('P5'),'origem_id','%s','partes','[{"quantidade":10}]'::jsonb))$$,
  current_setting('local.p1')), 'nao_e_pendencia_aberta');
select t_erro(format($$select resolver_pendencia(jsonb_build_object('operacao_id',u('r3'),'comercio_id',u('cm1'),'produto_id',u('P4'),'origem_id','%s','partes','[{"quantidade":10}]'::jsonb))$$,
  current_setting('local.p2')), 'pendencia_de_outro_produto');
reset role;
select set_config('local.pf', (select id::text from saldos where produto_id = u('F1') and pendente), false);
set role authenticated;
select t_erro(format($$select resolver_pendencia(jsonb_build_object('operacao_id',u('r4'),'comercio_id',u('cf1'),'produto_id',u('F1'),'origem_id','%s',
  'partes','[{"numero":"Z1","vencimento":"2027-09-09","quantidade":6}]'::jsonb))$$, current_setting('local.pf')), 'vencimento_conhecido_alterado');
select resolver_pendencia(jsonb_build_object('operacao_id',u('r4'),'comercio_id',u('cf1'),'produto_id',u('F1'),'origem_id',current_setting('local.pf'),
  'partes','[{"numero":"Z1","quantidade":2},{"quantidade":4}]'::jsonb));
reset role;
select t_ok((select count(*) from saldos s join lotes l on l.id = s.lote_id where s.origem_id = current_setting('local.pf')::uuid and l.vencimento = '2027-05-01') = 2,
  'data conhecida preservada nas partes');
select t_ok((select pendente and pendencia_confirmada from saldos where origem_id = current_setting('local.pf')::uuid and lote_id in (select id from lotes where numero is null)), 'parte sem lote segue pendente na farmacia');
set role authenticated;
select set_config('request.jwt.claim.sub', u('B')::text, false);
select t_erro(format($$select resolver_pendencia(jsonb_build_object('operacao_id',u('r5'),'comercio_id',u('cm1'),'produto_id',u('P5'),'origem_id','%s','partes','[{"quantidade":10}]'::jsonb))$$,
  current_setting('local.p2')), 'sem_acesso_ao_comercio');
select set_config('request.jwt.claim.sub', u('A')::text, false);
select 'OK pendencia protegida contra outro dono';

-- ---------- Roupas: variações ----------
select salvar_produto(t_p('op20','R2','cr1','Unidade',null,
  ('[{"area":"deposito","variacao_id":"'||u('w1')||'","local":{"nome":"Estoque"},"contagem":{"quantidade":5}},
     {"area":"deposito","variacao_id":"'||u('w2')||'","local":{"nome":"Estoque"},"contagem":{"quantidade":0}}]'),
  ('[{"id":"'||u('w1')||'","tamanho":"M","cor":"Azul","codigo_barras":"701","qtd_informada":7},
     {"id":"'||u('w2')||'","tamanho":"G","cor":"Azul","codigo_barras":"702","qtd_informada":3}]'), '700'));
reset role;
select t_ok((select qtd_informada from produto_variacoes where id = u('w1')) = 7 and (select sum(quantidade) from saldos where variacao_id = u('w1')) = 5,
  'quantidade informada no cadastro separada da contada');
set role authenticated;
select t_erro($$select salvar_produto(t_p('op21','R2','cr1','Unidade',null,'[]','[{"id":"'||u('w2')||'","tamanho":"G","cor":"Azul","codigo_barras":"702"}]','700'))$$, 'remocao_bloqueada');
select salvar_produto(t_p('op22','R2','cr1','Unidade',null,'[]','[{"id":"'||u('w1')||'","tamanho":"M","cor":"Azul","codigo_barras":"701","qtd_informada":7}]','700'));
reset role;
select t_ok((select removida_em is not null from produto_variacoes where id = u('w2')) and not exists (select 1 from codigos_barras where codigo = '702')
  and exists (select 1 from contagens where variacao_id = u('w2')), 'variacao sem saldo removida sem apagar historico; codigo liberado');
set role authenticated;
select set_config('request.jwt.claim.sub', u('B')::text, false);
select t_erro($$select salvar_produto(t_p('op23','B3','cb1','Unidade',null,'[]','[{"id":"'||u('w1')||'","tamanho":"M","cor":"X"}]'))$$, 'variacao_de_outro_produto');
select set_config('request.jwt.claim.sub', u('A')::text, false);
select t_erro($$select salvar_produto(t_p('op24','R3','cr1','Unidade',null,'[{"area":"deposito","variacao_id":"'||u('w1')||'","contagem":{"quantidade":1}}]','[{"id":"'||u('w9')||'","tamanho":"P","cor":"Preto"}]'))$$, 'variacao_invalida');
select t_erro($$select salvar_produto(t_p('op24','R3','cr1','Unidade',null,'[]'))$$, 'roupas_exige_variacao');
select 'OK variacoes isoladas por produto e por dono';

-- ---------- Integridade direta (como dono do banco) ----------
reset role;
select t_erro($$insert into saldos (comercio_id, produto_id, area, lote_id, quantidade)
  values (u('cm1'), u('P5'), 'deposito', (select id from lotes where produto_id = u('P4')), 1)$$, 'vinculo_incompativel: lote');
select t_erro($$insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, saldo_id, tipo, quantidade, criado_por)
  values (u('op20'), u('cr1'), u('R2'), u('w2'), 'deposito', (select id from saldos where variacao_id = u('w1')), 'ajuste', 1, u('A'))$$, 'vinculo_incompativel: saldo');
select t_erro($$insert into saldos (comercio_id, produto_id, area, origem_id, quantidade)
  values (u('cm1'), u('P4'), 'deposito', current_setting('local.p2')::uuid, 1)$$, 'vinculo_incompativel: origem');
select t_erro($$delete from movimentos$$, 'historico_imutavel');
select t_erro($$update saldos set lote_id = null where produto_id = u('P4')$$, 'historico_imutavel');
select t_erro($$delete from produtos where id = u('P1')$$, 'violates foreign key');
select 'OK vinculos compativeis e historico sem exclusao em cascata';
