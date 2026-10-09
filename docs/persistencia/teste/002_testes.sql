-- Testes executáveis da proposta (PostgreSQL local, separado de produção).
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = warning;

-- ---------- Auxiliares ----------
create function public.u(t text) returns uuid language sql immutable as $$ select md5(t)::uuid $$;
create sequence public.t_cont_erro; create sequence public.t_cont_ok;
grant usage on sequence public.t_cont_erro, public.t_cont_ok to authenticated, anon;
-- SQLSTATE esperado de cada recusa (extraído da proposta). Token com "_" inicial = sufixo.
create table public.t_estado (token text, estado text, primary key (token, estado));
insert into public.t_estado values ('_invalido','23514'),
  ('categoria_incompativel','23514'),
  ('codigo_da_variacao_obrigatorio','23514'),
  ('codigo_em_uso','23505'),
  ('codigo_igual_ao_principal','23514'),
  ('combinacao_repetida','23514'),
  ('confirmar_vencimento_do_lote','23514'),
  ('contagem_ja_registrada','23505'),
  ('cor_obrigatoria','23514'),
  ('datas_diferentes_para_o_mesmo_lote','23514'),
  ('desligar_validade_bloqueado','23514'),
  ('farmacia_exige_validade','23514'),
  ('fornecedor_de_outro_dono','23514'),
  ('fornecedor_de_outro_dono','42501'),
  ('historico_imutavel','42501'),
  ('local_de_outro_comercio_ou_area','42501'),
  ('lote_com_datas_diferentes','23514'),
  ('lote_conhecido_alterado','23514'),
  ('mais_de_tres_casas','22023'),
  ('maximo_menor_que_minimo','23514'),
  ('nao_autenticado','28000'),
  ('nao_e_pendencia_aberta','23514'),
  ('operacao_reutilizada_com_conteudo_diferente','23505'),
  ('partes_em_area_sem_estoque','23514'),
  ('pedido_incompleto','22023'),
  ('pendencia_de_outro_produto','42501'),
  ('pendencia_sem_confirmacao','23514'),
  ('produto_de_outro_comercio','42501'),
  ('produto_nao_muda_de_comercio','23514'),
  ('quantidade_informada_obrigatoria','23514'),
  ('quantidade_negativa','22023'),
  ('quantidade_vazia','22023'),
  ('quantidade_zero','22023'),
  ('remocao_bloqueada','23514'),
  ('roupas_exige_variacao','23514'),
  ('sem_acesso_ao_comercio','42501'),
  ('sem_partes','22023'),
  ('soma_das_partes_diferente_da_pendencia','23514'),
  ('soma_diferente_da_contagem','23514'),
  ('tamanho_invalido','23514'),
  ('tipo_sem_variacoes','23514'),
  ('troca_de_local_exige_transferencia','23514'),
  ('unidade_exige_inteiro','22023'),
  ('unidade_incompativel','23514'),
  ('unidade_travada','23514'),
  ('variacao_de_outro_produto','42501'),
  ('variacao_invalida','23514'),
  ('variacao_removida','23514'),
  ('vencimento_conhecido_alterado','23514'),
  ('vinculo_incompativel','23514'),
  ('permission denied','42501');
grant select on public.t_estado to authenticated, anon;

-- t_erro: executa a operação num bloco próprio. Captura SOMENTE o que a operação lançar.
-- Se ela terminar sem erro, lança um sinal interno (SQLSTATE T0K00) para desfazer o que
-- foi gravado, e a falha do teste é lançada FORA do bloco de captura.
create function public.t_erro(_sql text, _esperado text, _estado text default null) returns void language plpgsql as $$
declare v_ok boolean := false; v_st text; v_msg text; v_estados text[];
begin
  begin
    execute _sql;
    v_ok := true;  -- variáveis não voltam no rollback do bloco
    raise exception 't_erro_sucesso_inesperado' using errcode = 'T0K00';
  exception when others then
    get stacked diagnostics v_st = returned_sqlstate, v_msg = message_text;
  end;
  if v_ok or v_st = 'T0K00' then
    raise exception 'FALHOU: operacao aceita, esperava erro "%"', _esperado; end if;
  if not (v_msg = _esperado or v_msg like _esperado || ':%' or v_msg like _esperado || ' %') then
    raise exception 'FALHOU: veio "%" (%) em vez de "%"', v_msg, v_st, _esperado; end if;
  v_estados := case when _estado is not null then array[_estado] else
    (select array_agg(estado) from public.t_estado where token = split_part(_esperado, ':', 1)
       or (left(token, 1) = '_' and split_part(_esperado, ':', 1) like '%' || token)) end;
  if v_estados is null then
    raise exception 'FALHOU: SQLSTATE esperado desconhecido para "%"', _esperado; end if;
  if not (v_st = any (v_estados)) then
    raise exception 'FALHOU: "%" veio com SQLSTATE % em vez de %', _esperado, v_st, v_estados; end if;
  perform nextval('public.t_cont_erro');
end $$;
-- t_falha: prova que t_erro reprova. Passa só se t_erro lançar "FALHOU..." com o texto indicado.
create function public.t_falha(_sql text, _esperado text, _motivo text) returns text language plpgsql as $$
declare v_msg text; v_ok boolean := false;
begin
  begin perform public.t_erro(_sql, _esperado); v_ok := true;
  exception when others then get stacked diagnostics v_msg = message_text; end;
  if v_ok then raise exception 'FALHOU: verificador aprovou "%"', _sql; end if;
  if v_msg not like 'FALHOU: ' || _motivo || '%' then
    raise exception 'FALHOU: verificador reprovou por motivo errado: %', v_msg; end if;
  return 'OK verificador reprova: ' || _motivo;
end $$;
create function public.t_ok(_cond boolean, _nome text) returns text language plpgsql as $$
begin if _cond is not true then raise exception 'FALHOU: %', _nome; end if; perform nextval('public.t_cont_ok'); return 'OK ' || _nome; end $$;
create function public.t_p(op text, prod text, com text, un text, ctrl boolean, areas text,
  vars text default '[]', cod text default null, forn uuid default null, preco numeric default 2,
  cat text default null, det text default '{}') returns jsonb
language sql immutable as $$
  select jsonb_build_object('operacao_id', u(op), 'produto', jsonb_build_object(
    'id', u(prod), 'comercio_id', u(com), 'nome', 'Produto ' || prod, 'unidade', un,
    'preco_compra', 1, 'preco_venda', preco, 'detalhes', det::jsonb,
    'categoria', coalesce(cat, case left(com, 2) when 'cf' then 'Medicamentos' when 'cr' then 'Camisetas' when 'cc' then 'Básico'
      when 'cp' then 'Ração' when 'ca' then 'Motor' else 'Mercearia' end), 'controla_validade', ctrl, 'codigo_barras', cod,
    'fornecedor_id', forn, 'avisos_dias', '[30,60]'::jsonb), 'variacoes', vars::jsonb, 'areas', areas::jsonb) $$;
grant execute on function public.u(text), public.t_erro(text, text, text), public.t_falha(text, text, text), public.t_ok(boolean, text),
  public.t_p(text, text, text, text, boolean, text, text, text, uuid, numeric, text, text) to authenticated, anon;

-- ---------- Dados ----------
insert into auth.users values (u('A'), 'a@x'), (u('B'), 'b@x');
insert into public.user_roles (user_id, role) values (u('A'), 'dono'), (u('B'), 'dono'), (u('B'), 'gerente');
insert into public.comercios (id, dono_id, tipo, nome) values
  (u('cm1'), u('A'), 'mercado', 'Mercado A'), (u('cm2'), u('A'), 'mercado', 'Mercado A2'),
  (u('cf1'), u('A'), 'farmacia', 'Farmácia A'), (u('cr1'), u('A'), 'loja_roupas', 'Roupas A'),
  (u('cc1'), u('A'), 'material_construcao', 'Construção A'), (u('cp1'), u('A'), 'pet_shop', 'Pet A'),
  (u('ca1'), u('A'), 'autopecas', 'Autopeças A'), (u('cb1'), u('B'), 'mercado', 'Mercado B');
insert into public.fornecedores (id, dono_id, nome) values (u('fa'), u('A'), 'Forn A'), (u('fb'), u('B'), 'Forn B');

-- ---------- Prova do verificador t_erro ----------
create table public.t_sonda (x int);
select t_falha($$insert into public.t_sonda values (1)$$, 'qualquer_erro', 'operacao aceita');
select t_ok(not exists (select 1 from public.t_sonda), 'sucesso inesperado foi desfeito');
select t_falha($$select 1/0$$, 'quantidade_vazia', 'veio');
select t_falha($q$do $x$ begin raise exception 'quantidade_vazia' using errcode = '23514'; end $x$$q$, 'quantidade_vazia', '"quantidade_vazia" veio com SQLSTATE');
select t_falha($q$do $x$ begin raise exception 'quantidade_vazia_extra' using errcode = '22023'; end $x$$q$, 'quantidade_vazia', 'veio');
select t_falha($$select 1/0$$, 'division by zero', 'SQLSTATE esperado desconhecido');
do $x$ begin perform t_erro($q$do $y$ begin raise exception 'quantidade_vazia' using errcode = '22023'; end $y$$q$, 'quantidade_vazia'); end $x$;
do $x$ begin perform t_erro($q$do $y$ begin insert into public.t_sonda values (1); perform 1/0; end $y$$q$, 'division by zero', '22012'); end $x$;
select t_ok(not exists (select 1 from public.t_sonda), 'erro correto passa e desfaz o que a operacao gravou');
select 'OK verificador aprova erro correto';

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
select t_erro($$select salvar_produto(t_p('op6','R1','cr1','Peça',null,
  '[{"area":"deposito","variacao_id":"'||u('v1')||'","contagem":{"quantidade":5}}]',
  '[{"id":"'||u('v1')||'","tamanho":"M","cor":"Azul","codigo_barras":"555"}]','555'))$$, 'codigo_igual_ao_principal');
reset role;
select t_ok(not exists (select 1 from produtos where id = u('R1')) and not exists (select 1 from codigos_barras where codigo = '555')
  and not exists (select 1 from operacoes where id = u('op6')), 'falha no meio desfaz tudo (produto, codigo, operacao)');
set role authenticated;

-- ---------- Isolamento entre donos e comércios ----------
select t_erro($$select salvar_produto(t_p('op7','P1','cm2','Pacote',null,'[]'))$$, 'produto_de_outro_comercio');
select set_config('request.jwt.claim.sub', u('B')::text, false);
select t_erro($$select salvar_produto(t_p('op8','B1','cb1','Pacote',null,'[]','[]',null,u('fa')))$$, 'fornecedor_de_outro_dono');
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
select salvar_produto(t_p('op20','R2','cr1','Peça',null,
  ('[{"area":"deposito","variacao_id":"'||u('w1')||'","local":{"nome":"Estoque"},"contagem":{"quantidade":5}},
     {"area":"deposito","variacao_id":"'||u('w2')||'","local":{"nome":"Estoque"},"contagem":{"quantidade":0}}]'),
  ('[{"id":"'||u('w1')||'","tamanho":"M","cor":"Azul","codigo_barras":"701","qtd_informada":7},
     {"id":"'||u('w2')||'","tamanho":"G","cor":"Azul","codigo_barras":"702","qtd_informada":3}]'), '700'));
reset role;
select t_ok((select qtd_informada from produto_variacoes where id = u('w1')) = 7 and (select sum(quantidade) from saldos where variacao_id = u('w1')) = 5,
  'quantidade informada no cadastro separada da contada');
set role authenticated;
select t_erro($$select salvar_produto(t_p('op21','R2','cr1','Peça',null,'[]','[{"id":"'||u('w2')||'","tamanho":"G","cor":"Azul","codigo_barras":"702"}]','700'))$$, 'remocao_bloqueada');
select salvar_produto(t_p('op22','R2','cr1','Peça',null,'[]','[{"id":"'||u('w1')||'","tamanho":"M","cor":"Azul","codigo_barras":"701","qtd_informada":7}]','700'));
reset role;
select t_ok((select removida_em is not null from produto_variacoes where id = u('w2')) and not exists (select 1 from codigos_barras where codigo = '702')
  and exists (select 1 from contagens where variacao_id = u('w2')), 'variacao sem saldo removida sem apagar historico; codigo liberado');
set role authenticated;
select set_config('request.jwt.claim.sub', u('B')::text, false);
select t_erro($$select salvar_produto(t_p('op23','B3','cb1','Unidade',null,'[]','[{"id":"'||u('w1')||'","tamanho":"M","cor":"X"}]'))$$, 'variacao_de_outro_produto');
select set_config('request.jwt.claim.sub', u('A')::text, false);
select t_erro($$select salvar_produto(t_p('op24','R3','cr1','Peça',null,'[{"area":"deposito","variacao_id":"'||u('w1')||'","contagem":{"quantidade":1}}]','[{"id":"'||u('w9')||'","tamanho":"P","cor":"Preto","codigo_barras":"709","qtd_informada":1}]'))$$, 'variacao_invalida');
select t_erro($$select salvar_produto(t_p('op24','R3','cr1','Peça',null,'[]'))$$, 'roupas_exige_variacao');
select 'OK variacoes isoladas por produto e por dono';

-- ---------- Reuso de código de variação removida (w2 / 702) ----------
select salvar_produto(t_p('op25','R2','cr1','Peça',null,'[]','[{"id":"'||u('w1')||'","tamanho":"M","cor":"Azul","codigo_barras":"701","qtd_informada":7},
  {"id":"'||u('w3')||'","tamanho":"G","cor":"Azul","codigo_barras":"702","qtd_informada":2}]','700'));
reset role;
select t_ok((select variacao_id from codigos_barras where codigo = '702') = u('w3')
  and (select count(*) from produto_variacoes where codigo_barras = '702') = 2, 'codigo da variacao removida reutilizado por outra variacao');
set role authenticated;
select t_erro($$select salvar_produto(t_p('op26','R4','cr1','Peça',null,'[]','[{"id":"'||u('w4')||'","tamanho":"P","cor":"Azul","codigo_barras":"702","qtd_informada":1}]','704'))$$, 'codigo_em_uso');
select t_erro($$select salvar_produto(t_p('op26','R4','cr1','Peça',null,'[]','[{"id":"'||u('w4')||'","tamanho":"P","cor":"Azul","codigo_barras":"x1","qtd_informada":1}]','700'))$$, 'codigo_em_uso');
-- 701 é de uma variação em cr1; o principal de outro produto no MESMO comércio não pode usá-lo
-- (antes este caso usava cm1, outro comércio, e só "passava" pela falha do verificador)
select t_erro($$select salvar_produto(t_p('op26','R6','cr1','Peça',null,'[]','[{"id":"'||u('w6')||'","tamanho":"P","cor":"Azul","codigo_barras":"706","qtd_informada":1}]','701'))$$, 'codigo_em_uso');
select 'OK codigos ativos seguem unicos entre produtos e variacoes';

-- ---------- Roupas: regras das variações ----------
select t_erro($$select salvar_produto(t_p('op27','R5','cr1','Unidade',null,'[]','[{"id":"'||u('y1')||'","tamanho":"P","cor":"Azul","codigo_barras":"801","qtd_informada":1}]','800'))$$, 'unidade_incompativel');
select t_erro($$select salvar_produto(t_p('op27','R5','cr1','Par',null,'[]','[{"id":"'||u('y1')||'","tamanho":"XL","cor":"Azul","codigo_barras":"801","qtd_informada":1}]','800'))$$, 'tamanho_invalido');
select t_erro($$select salvar_produto(t_p('op27','R5','cr1','Par',null,'[]','[{"id":"'||u('y1')||'","tamanho":"P","cor":" ","codigo_barras":"801","qtd_informada":1}]','800'))$$, 'cor_obrigatoria');
select t_erro($$select salvar_produto(t_p('op27','R5','cr1','Par',null,'[]','[{"id":"'||u('y1')||'","tamanho":"P","cor":"Azul","qtd_informada":1}]','800'))$$, 'codigo_da_variacao_obrigatorio');
select t_erro($$select salvar_produto(t_p('op27','R5','cr1','Par',null,'[]','[{"id":"'||u('y1')||'","tamanho":"P","cor":"Azul","codigo_barras":"800","qtd_informada":1}]','800'))$$, 'codigo_igual_ao_principal');
select t_erro($$select salvar_produto(t_p('op27','R5','cr1','Par',null,'[]','[{"id":"'||u('y1')||'","tamanho":"P","cor":"Azul","codigo_barras":"801"}]','800'))$$, 'quantidade_informada_obrigatoria');
select t_erro($$select salvar_produto(t_p('op27','R5','cr1','Par',null,'[]','[{"id":"'||u('y1')||'","tamanho":"P","cor":"Azul","codigo_barras":"801","qtd_informada":1},
  {"id":"'||u('y2')||'","tamanho":"P","cor":" AZUL ","codigo_barras":"802","qtd_informada":1}]','800'))$$, 'combinacao_repetida');
select salvar_produto(t_p('op27','R5','cr1','Par',null,'[]','[{"id":"'||u('y1')||'","tamanho":"38","cor":"Preto","codigo_barras":"801","qtd_informada":2}]','800', null, 2, 'Calçados'));
select 'OK roupas: tamanho, cor, codigo, quantidade e combinacao conferidos; Par valido';

-- ---------- Seis tipos: unidade, categoria e detalhes fixos ----------
select t_erro($$select salvar_produto(t_p('op30','T1','cm1','Metro',null,'[]'))$$, 'unidade_incompativel');
select t_erro($$select salvar_produto(t_p('op30','T1','cm1','Kg',null,'[]','[]',null,null,2,'Ração'))$$, 'categoria_incompativel');
-- categoria realmente nula e realmente ausente (sem o coalesce de t_p)
select t_ok(jsonb_typeof(jsonb_set(t_p('op30','T1','cm1','Kg',null,'[]'), '{produto,categoria}', 'null')->'produto'->'categoria') = 'null'
  and not (t_p('op30','T1','cm1','Kg',null,'[]') #- '{produto,categoria}')->'produto' ? 'categoria', 'pedido de teste sem categoria montado');
select t_erro($$select salvar_produto(jsonb_set(t_p('op30','T1','cm1','Kg',null,'[]'), '{produto,categoria}', 'null'))$$, 'categoria_incompativel');
select t_erro($$select salvar_produto(t_p('op30','T1','cm1','Kg',null,'[]') #- '{produto,categoria}')$$, 'categoria_incompativel');
select t_erro($$select salvar_produto(jsonb_set(t_p('op30','T1','cm1','Kg',null,'[]'), '{produto,categoria}', '""'))$$, 'categoria_incompativel');
select salvar_produto(t_p('op30','T1','cm1','Litro',null,'[]','[]',null,null,2,'Bebidas'));
select t_erro($$select salvar_produto(t_p('op31','T2','cf1','Kg',true,'[]'))$$, 'unidade_incompativel');
select t_erro($$select salvar_produto(t_p('op31','T2','cf1','Frasco',true,'[]','[]',null,null,2,'Bebidas'))$$, 'categoria_incompativel');
select t_erro($$select salvar_produto(t_p('op31','T2','cf1','Frasco',true,'[]','[]',null,null,2,null,'{"controlado":"Talvez"}'))$$, 'controlado_invalido');
select salvar_produto(t_p('op31','T2','cf1','Frasco',true,'[]','[]',null,null,2,'Genéricos','{"controlado":"Não"}'));
select salvar_produto(t_p('op32','T3','cf1','Cartela',true,'[]','[]',null,null,2,null,'{"controlado":""}'));
select t_erro($$select salvar_produto(t_p('op33','T4','cc1','Pacote',null,'[]'))$$, 'unidade_incompativel');
select t_erro($$select salvar_produto(t_p('op33','T4','cc1','Lata',null,'[]','[]',null,null,2,'Motor'))$$, 'categoria_incompativel');
select salvar_produto(t_p('op33','T4','cc1','m²',null,'[]','[]',null,null,2,'Acabamento'));
select t_erro($$select salvar_produto(t_p('op34','T5','cp1','Saco',null,'[]'))$$, 'unidade_incompativel');
select t_erro($$select salvar_produto(t_p('op34','T5','cp1','Kg',null,'[]','[]',null,null,2,'Freios'))$$, 'categoria_incompativel');
select t_erro($$select salvar_produto(t_p('op34','T5','cp1','Kg',null,'[]','[]',null,null,2,null,'{"especie":"Peixe"}'))$$, 'especie_invalido');
select salvar_produto(t_p('op34','T5','cp1','Kg',null,'[]','[]',null,null,2,'Petiscos','{"especie":"Gato"}'));
select salvar_produto(t_p('op35','T6','cp1','Pacote',null,'[]'));
select t_erro($$select salvar_produto(t_p('op36','T7','ca1','Kg',null,'[]'))$$, 'unidade_incompativel');
select t_erro($$select salvar_produto(t_p('op36','T7','ca1','Kit',null,'[]','[]',null,null,2,'Ração'))$$, 'categoria_incompativel');
select t_erro($$select salvar_produto(t_p('op36','T7','ca1','Kit',null,'[]','[]',null,null,2,null,'{"posicao":"Cima"}'))$$, 'posicao_invalido');
select salvar_produto(t_p('op36','T7','ca1','Jogo',null,'[]','[]',null,null,2,'Freios','{"posicao":"Não se aplica"}'));
select salvar_produto(t_p('op37','T8','ca1','Par',null,'[]'));
select t_erro($$select salvar_produto(t_p('op38','T9','cc1','Saco',null,'[]','[{"id":"'||u('z1')||'","tamanho":"P","cor":"Azul","codigo_barras":"901","qtd_informada":1}]'))$$, 'tipo_sem_variacoes');
select 'OK seis tipos: opcoes invalidas recusadas, validas aceitas, detalhes fixos opcionais';

-- ---------- Local pendente definido depois, com saldo ----------
select salvar_produto(t_p('op40','L1','cm1','Pacote',null,'[{"area":"deposito","local":null,"contagem":{"quantidade":10}}]'));
select salvar_produto(t_p('op41','L1','cm1','Pacote',null,'[{"area":"deposito","local":{"nome":"Estante C"}}]'));
reset role;
select t_ok((select l.nome from produto_areas pa join locais l on l.id = pa.local_id where pa.produto_id = u('L1')) = 'Estante C'
  and (select local_definido_por from produto_areas where produto_id = u('L1')) = u('A')
  and (select count(*) from movimentos where produto_id = u('L1')) = 1
  and (select sum(quantidade) from saldos where produto_id = u('L1')) = 10, 'pendente -> local valido com saldo, sem movimento de estoque');
set role authenticated;
select t_erro($$select salvar_produto(t_p('op42','L1','cm1','Pacote',null,'[{"area":"deposito","local":{"nome":"Estante D"}}]'))$$, 'troca_de_local_exige_transferencia');
select t_erro($$select salvar_produto(t_p('op42','L1','cm1','Pacote',null,'[{"area":"deposito","local":null}]'))$$, 'troca_de_local_exige_transferencia');
select 'OK local definido continua travado com saldo';

-- ---------- Lote com número conhecido e vencimento desconhecido ----------
select salvar_produto(t_p('op50','P8','cm1','Pacote',true,
  '[{"area":"deposito","contagem":{"quantidade":10,"partes":[{"numero":"M5","quantidade":10}]}},
    {"area":"venda","contagem":{"quantidade":4,"partes":[{"numero":" m5 ","quantidade":4}]}}]'));
reset role;
select set_config('local.m5d', (select id::text from saldos where produto_id = u('P8') and area = 'deposito'), false);
select set_config('local.m5v', (select id::text from saldos where produto_id = u('P8') and area = 'venda'), false);
select set_config('local.m5l', (select id::text from lotes where produto_id = u('P8')), false);
set role authenticated;
select t_erro(format($$select resolver_pendencia(jsonb_build_object('operacao_id',u('r50'),'comercio_id',u('cm1'),'produto_id',u('P8'),'origem_id','%s',
  'partes','[{"vencimento":"2027-03-03","quantidade":6},{"quantidade":4}]'::jsonb))$$, current_setting('local.m5d')), 'confirmar_vencimento_do_lote');
select t_erro(format($$select resolver_pendencia(jsonb_build_object('operacao_id',u('r50'),'comercio_id',u('cm1'),'produto_id',u('P8'),'origem_id','%s','confirmar_vencimento',true,
  'partes','[{"vencimento":"2027-03-03","quantidade":6},{"vencimento":"2027-04-04","quantidade":4}]'::jsonb))$$, current_setting('local.m5d')), 'datas_diferentes_para_o_mesmo_lote');
select resolver_pendencia(jsonb_build_object('operacao_id',u('r50'),'comercio_id',u('cm1'),'produto_id',u('P8'),'origem_id',current_setting('local.m5d'),'confirmar_vencimento',true,
  'partes','[{"vencimento":"2027-03-03","quantidade":6},{"quantidade":4}]'::jsonb));
reset role;
select t_ok((select count(*) from lotes where produto_id = u('P8')) = 1
  and (select vencimento from lotes where id = current_setting('local.m5l')::uuid) = '2027-03-03'
  and (select vencimento_definido_por from lotes where id = current_setting('local.m5l')::uuid) = u('A')
  and (select count(*) from saldos where origem_id = current_setting('local.m5d')::uuid and lote_id = current_setting('local.m5l')::uuid and not pendente) = 2
  and (select lote_id from saldos where id = current_setting('local.m5v')::uuid) = current_setting('local.m5l')::uuid
  and (select sum(quantidade) from saldos where produto_id = u('P8')) = 14
  and (select sum(quantidade) from movimentos where produto_id = u('P8')) = 14
  and (select count(*) from movimentos where operacao_id = u('r50') and criado_por = u('A')) = 3,
  'data preenchida com confirmacao e dividida 6 + 4: mesmo lote nas duas areas, total 14, autoria');
set role authenticated;
select resolver_pendencia(jsonb_build_object('operacao_id',u('r51'),'comercio_id',u('cm1'),'produto_id',u('P8'),'origem_id',current_setting('local.m5v'),
  'partes','[{"quantidade":4}]'::jsonb));
reset role;
select t_ok((select count(*) from saldos s join lotes l on l.id = s.lote_id where s.origem_id = current_setting('local.m5v')::uuid
  and l.vencimento = '2027-03-03' and not s.pendente and s.quantidade = 4) = 1
  and (select sum(quantidade) from saldos where produto_id = u('P8')) = 14, 'pendencia da area de venda completada com a data ja conhecida do lote');
select t_erro(format($$update lotes set vencimento = '2028-01-01', vencimento_definido_por = u('A') where id = '%s'$$, current_setting('local.m5l')), 'historico_imutavel');
select 'OK data ja conhecida nunca substituida';
set role authenticated;

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
select t_erro($$delete from produtos where id = u('P1')$$, 'update or delete on table "produtos" violates foreign key constraint', '23503');
select 'OK vinculos compativeis e historico sem exclusao em cascata';

reset role;
select 'CONTAGEM testes_negativos_aprovados=' || (select last_value from t_cont_erro) || ' verificacoes_t_ok=' || (select last_value from t_cont_ok);
