-- Testes de salvar_cadastro (roda depois de 002_testes.sql, no mesmo banco descartável).
set role authenticated;
select set_config('request.jwt.claim.sub', u('A')::text, false);

-- Produto novo com duas pendências (10 + 10) num único envio.
select salvar_cadastro(jsonb_build_object('operacao_id', u('k1'),
  'produto_pedido', t_p('k1p','QK1','cm1','Caixa',true,'[{"area":"deposito","contagem":{"quantidade":20,"partes":[{"quantidade":10},{"quantidade":10}]}}]'),
  'pendencias', '[]'::jsonb));
reset role;
select set_config('local.k1', (select id::text from saldos where produto_id = u('QK1') order by id limit 1), false);
select set_config('local.k2', (select id::text from saldos where produto_id = u('QK1') order by id offset 1 limit 1), false);
set role authenticated;

-- 1) Edição (novo nome) + pendência 1 correta + pendência 2 com soma errada: nada é gravado.
select t_erro(format($$select salvar_cadastro(jsonb_build_object('operacao_id', u('k2'),
  'produto_pedido', jsonb_set(t_p('k2p','QK1','cm1','Caixa',true,'[{"area":"deposito"}]'), '{produto,nome}', '"Nome editado"'),
  'pendencias', jsonb_build_array(
     jsonb_build_object('operacao_id', u('k2a'), 'origem_id', '%s', 'partes', '[{"vencimento":"2027-01-01","quantidade":10}]'::jsonb),
     jsonb_build_object('operacao_id', u('k2b'), 'origem_id', '%s', 'partes', '[{"vencimento":"2027-01-01","quantidade":7}]'::jsonb))))$$,
  current_setting('local.k1'), current_setting('local.k2')), 'soma_das_partes_diferente_da_pendencia');
reset role;
select t_ok((select nome from produtos where id = u('QK1')) <> 'Nome editado'
  and (select quantidade from saldos where id = current_setting('local.k1')::uuid) = 10
  and not exists (select 1 from saldos where origem_id in (current_setting('local.k1')::uuid, current_setting('local.k2')::uuid))
  and not exists (select 1 from operacoes where id in (u('k2'), u('k2p'), u('k2a'), u('k2b')))
  and (select count(*) from movimentos where produto_id = u('QK1')) = 2,
  'falha numa pendencia desfaz a edicao e a outra pendencia');
set role authenticated;

-- 2) Correção com NOVA operação grava edição e as duas pendências juntas.
select salvar_cadastro(jsonb_build_object('operacao_id', u('k3'),
  'produto_pedido', jsonb_set(t_p('k3p','QK1','cm1','Caixa',true,'[{"area":"deposito"}]'), '{produto,nome}', '"Nome editado"'),
  'pendencias', jsonb_build_array(
     jsonb_build_object('operacao_id', u('k3a'), 'origem_id', current_setting('local.k1'), 'partes', '[{"vencimento":"2027-01-01","quantidade":10}]'::jsonb),
     jsonb_build_object('operacao_id', u('k3b'), 'origem_id', current_setting('local.k2'), 'partes', '[{"vencimento":"2027-02-01","quantidade":4},{"quantidade":6}]'::jsonb))));
-- 3) Repetir o mesmo envio (resposta perdida) devolve o resultado guardado, sem gravar de novo.
select salvar_cadastro(jsonb_build_object('operacao_id', u('k3'),
  'produto_pedido', jsonb_set(t_p('k3p','QK1','cm1','Caixa',true,'[{"area":"deposito"}]'), '{produto,nome}', '"Nome editado"'),
  'pendencias', jsonb_build_array(
     jsonb_build_object('operacao_id', u('k3a'), 'origem_id', current_setting('local.k1'), 'partes', '[{"vencimento":"2027-01-01","quantidade":10}]'::jsonb),
     jsonb_build_object('operacao_id', u('k3b'), 'origem_id', current_setting('local.k2'), 'partes', '[{"vencimento":"2027-02-01","quantidade":4},{"quantidade":6}]'::jsonb))));
reset role;
select t_ok((select nome from produtos where id = u('QK1')) = 'Nome editado'
  and (select sum(quantidade) from saldos where produto_id = u('QK1')) = 20
  and (select sum(quantidade) from movimentos where produto_id = u('QK1')) = 20
  and (select count(*) from contagens where produto_id = u('QK1')) = 1
  and (select count(*) from saldos where produto_id = u('QK1') and quantidade > 0) = 3
  and (select count(*) from operacoes where id = u('k3')) = 1,
  'correcao com nova operacao grava tudo; repeticao nao duplica');
set role authenticated;

-- 4) Mesmo id com conteúdo diferente é recusado.
select t_erro($$select salvar_cadastro(jsonb_build_object('operacao_id', u('k3'),
  'produto_pedido', t_p('k3p','QK1','cm1','Caixa',true,'[{"area":"deposito"}]'), 'pendencias', '[]'::jsonb))$$, 'operacao_reutilizada_com_conteudo_diferente');

-- 5) Lote com número e sem data: a confirmação não é inventada.
select salvar_cadastro(jsonb_build_object('operacao_id', u('k4'),
  'produto_pedido', t_p('k4p','QK2','cm1','Caixa',true,'[{"area":"deposito","contagem":{"quantidade":5,"partes":[{"numero":"L9","quantidade":5}]}}]'),
  'pendencias', '[]'::jsonb));
reset role;
select set_config('local.k5', (select id::text from saldos where produto_id = u('QK2') and pendente), false);
set role authenticated;
select t_erro(format($$select salvar_cadastro(jsonb_build_object('operacao_id', u('k5'),
  'produto_pedido', t_p('k5p','QK2','cm1','Caixa',true,'[{"area":"deposito"}]'),
  'pendencias', jsonb_build_array(jsonb_build_object('operacao_id', u('k5a'), 'origem_id', '%s',
     'partes', '[{"numero":"L9","vencimento":"2027-03-03","quantidade":5}]'::jsonb, 'confirmar_vencimento', false))))$$,
  current_setting('local.k5')), 'confirmar_vencimento_do_lote');
reset role;
select t_ok((select vencimento from lotes where produto_id = u('QK2')) is null, 'sem confirmacao explicita a data do lote nao e gravada');
set role authenticated;
select salvar_cadastro(jsonb_build_object('operacao_id', u('k6'),
  'produto_pedido', t_p('k6p','QK2','cm1','Caixa',true,'[{"area":"deposito"}]'),
  'pendencias', jsonb_build_array(jsonb_build_object('operacao_id', u('k6a'), 'origem_id', current_setting('local.k5'),
     'partes', '[{"numero":"L9","vencimento":"2027-03-03","quantidade":5}]'::jsonb, 'confirmar_vencimento', true))));
reset role;
select t_ok((select vencimento from lotes where produto_id = u('QK2')) = '2027-03-03', 'com confirmacao explicita a data e gravada');

-- 6) Acesso: outro usuário e visitante não salvam.
set role authenticated;
select set_config('request.jwt.claim.sub', u('B')::text, false);
select t_erro($$select salvar_cadastro(jsonb_build_object('operacao_id', u('k7'),
  'produto_pedido', t_p('k7p','QK3','cm1','Caixa',false,'[]'), 'pendencias', '[]'::jsonb))$$, 'sem_acesso_ao_comercio');
reset role;
select t_ok(not has_function_privilege('anon', 'public.salvar_cadastro(jsonb)', 'execute'), 'visitante nao executa salvar_cadastro');
select 'OK salvar_cadastro: transacao unica, repeticao, nova operacao, confirmacao explicita e acesso';
select 'CONTAGEM cadastro testes_negativos=' || (select last_value from t_cont_erro) || ' t_ok=' || (select last_value from t_cont_ok);
