-- G1.2: usar com a base 015, sempre entre begin e rollback em banco privado.
create function pg_temp.g12_ok(b boolean,t text) returns void language plpgsql as $$
begin
 if b is not true then raise exception 'FALHOU G1.2: %',t; end if;
 perform set_config('g12.total',(coalesce(nullif(current_setting('g12.total',true),''),'0')::int+1)::text,true);
end $$;
create function pg_temp.g12_recusa(q text,m text) returns void language plpgsql as $$
declare msg text; codigo text;
begin
 begin execute q; exception when others then get stacked diagnostics msg=message_text,codigo=returned_sqlstate; end;
 perform pg_temp.g12_ok(msg=m and codigo='42501', 'recusa '||m||': '||q);
end $$;
-- Segunda loja do mesmo dono deve continuar funcionando.
insert into comercios(id,dono_id,tipo,nome,documento_tipo,documento,telefone,cep,rua,numero,bairro,cidade,uf)
 values(pg_temp.u('g12-com2'),pg_temp.u('dono'),'mercado','Segunda loja ficticia','cpf','52998224725','11999998888','01001000','Rua ficticia','1','Teste','Sao Paulo','SP');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por)
 values(pg_temp.u('g12-f2'),pg_temp.u('g12-com2'),'Equipe segunda loja','ambos','934812',pg_temp.u('dono')),
       (pg_temp.u('g12-novo'),pg_temp.u('com'),'Ainda sem PIN','ambos','934813',pg_temp.u('dono'));
update funcionarios set caixa=true where id=pg_temp.u('func');
set local role anon;
select pg_temp.g12_ok(conferir_codigo_funcionario('937421')='novo','primeiro acesso ativo cria PIN');
select set_config('g12.chave',entrar_funcionario('937421','7391','Aparelho ficticio')->>'chave',true);
select pg_temp.g12_ok(conferir_codigo_funcionario('937421')='pin','codigo existente pede PIN');
select pg_temp.g12_ok(funcionario_inicio(current_setting('g12.chave'))->>'nome'='Equipe simulada','entrada ativa permanece');
select pg_temp.g12_ok(jsonb_array_length(caixa_produtos(current_setting('g12.chave')))=5,'caixa ativo consulta produtos');
select pg_temp.g12_ok((funcionario_desbloquear(current_setting('g12.chave'),'7391')->>'ok')::boolean,'PIN correto destrava');
select pg_temp.g12_ok(funcionario_desbloquear(current_setting('g12.chave'),'8642')->>'erro'='pin_errado:4','PIN errado mantem contagem');
select pg_temp.g12_ok((funcionario_desbloquear(current_setting('g12.chave'),'7391')->>'ok')::boolean,'PIN correto zera erros');
reset role;
select pg_temp.g12_ok((select pin_tentativas=0 and travado_ate is null from funcionarios where id=pg_temp.u('func')),'tentativas zeradas');
select pg_temp.g12_ok((select desbloqueado_ate=now()+interval '12 hours' from funcionario_aparelhos where chave_hash=encode(extensions.digest(current_setting('g12.chave'),'sha256'),'hex')),'janela 12 horas preservada');
-- Fotografia da trilha: recusas nao alteram saldo, movimentos, operacoes ou financeiro.
select set_config('g12.trilha',jsonb_build_object(
 'saldos',(select jsonb_agg(to_jsonb(t) order by id) from saldos t),
 'movimentos',(select jsonb_agg(to_jsonb(t) order by id) from movimentos t),
 'operacoes',(select jsonb_agg(to_jsonb(t) order by id) from operacoes t),
 'vendas',(select jsonb_agg(to_jsonb(t) order by id) from vendas t),
 'fiado',(select jsonb_agg(to_jsonb(t) order by id) from fiado_movimentos t))::text,true);
select set_config('g12.acessos',(select jsonb_agg(to_jsonb(t) order by id)::text from funcionario_aparelhos t),true);
select set_config('g12.equipe',(select jsonb_agg(to_jsonb(t) order by id)::text from funcionarios t),true);
update comercios set ativo=false where id=pg_temp.u('com');
set local role anon;
select pg_temp.g12_ok(conferir_codigo_funcionario('937421') is null,'loja inativa nao aceita codigo com PIN');
select pg_temp.g12_ok(conferir_codigo_funcionario('934813') is null,'loja inativa nao inicia criacao de PIN');
select pg_temp.g12_recusa($q$select entrar_funcionario('937421','7391','Teste')$q$,'codigo_invalido');
select pg_temp.g12_recusa($q$select entrar_funcionario('934813','7391','Teste')$q$,'codigo_invalido');
select pg_temp.g12_recusa($q$select entrar_funcionario('937421','8642','Teste')$q$,'codigo_invalido');
select pg_temp.g12_recusa($q$select funcionario_desbloquear(current_setting('g12.chave'),'7391')$q$,'acesso_encerrado');
select pg_temp.g12_recusa($q$select funcionario_desbloquear(current_setting('g12.chave'),'8642')$q$,'acesso_encerrado');
select pg_temp.g12_ok(funcionario_inicio(current_setting('g12.chave')) is null,'inicio recusa acesso antigo');
select pg_temp.g12_recusa($q$select caixa_produtos(current_setting('g12.chave'))$q$,'acesso_encerrado');
select pg_temp.g12_recusa($q$select caixa_estado(current_setting('g12.chave'))$q$,'acesso_encerrado');
select pg_temp.g12_recusa($q$select funcionario_conferencia_lista(current_setting('g12.chave'))$q$,'acesso_encerrado');
select pg_temp.g12_recusa($q$select funcionario_reposicao_lista(current_setting('g12.chave'))$q$,'acesso_encerrado');
select pg_temp.g12_recusa($q$select funcionario_abrir_recebimento(current_setting('g12.chave'),pg_temp.u('g12-rec'),pg_temp.u('g12-pedido'),null)$q$,'acesso_encerrado');
select pg_temp.g12_recusa($q$select funcionario_registrar_perda(current_setting('g12.chave'),pg_temp.u('g12-perda'),pg_temp.u('g'),null,'venda',1,'outro','Ficticio')$q$,'acesso_encerrado');
select pg_temp.g12_ok(conferir_codigo_funcionario('934812')='novo','outra loja do mesmo dono mantem entrada');
reset role;
select pg_temp.g12_ok(current_setting('g12.acessos')::jsonb=(select jsonb_agg(to_jsonb(t) order by id) from funcionario_aparelhos t),'recusas nao criam nem renovam acessos');
select pg_temp.g12_ok(current_setting('g12.equipe')::jsonb=(select jsonb_agg(to_jsonb(t) order by id) from funcionarios t),'recusas nao alteram PIN ou tentativas');
select pg_temp.g12_ok(current_setting('g12.trilha')::jsonb=jsonb_build_object(
 'saldos',(select jsonb_agg(to_jsonb(t) order by id) from saldos t),
 'movimentos',(select jsonb_agg(to_jsonb(t) order by id) from movimentos t),
 'operacoes',(select jsonb_agg(to_jsonb(t) order by id) from operacoes t),
 'vendas',(select jsonb_agg(to_jsonb(t) order by id) from vendas t),
 'fiado',(select jsonb_agg(to_jsonb(t) order by id) from fiado_movimentos t)),'trilha de estoque e dinheiro intacta');
-- Nem a tela simplificada de PIN vencido deve revelar a loja inativa.
update funcionario_aparelhos set desbloqueado_ate=now()-interval '1 minute' where funcionario_id=pg_temp.u('func');
set local role anon;
select pg_temp.g12_ok(funcionario_inicio(current_setting('g12.chave')) is null,'PIN vencido nao contorna loja inativa');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select pg_temp.g12_ok((select count(*) from produtos where comercio_id=pg_temp.u('com'))=5,'dono ainda consulta produtos historicos');
select pg_temp.g12_ok((select count(*) from movimentos where comercio_id=pg_temp.u('com'))>0,'dono ainda consulta trilha historica');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.u('outro')::text,true);
set local role authenticated;
select pg_temp.g12_ok((select count(*) from produtos where comercio_id=pg_temp.u('com'))=0,'outro dono continua sem leitura');
reset role;
-- Reativar nao revoga acessos automaticamente: logout/bloqueio/novo acesso fazem isso.
update comercios set ativo=true where id=pg_temp.u('com');
set local role anon;
select pg_temp.g12_ok((funcionario_inicio(current_setting('g12.chave'))->>'pin_necessario')::boolean,'reativar ainda exige PIN vencido');
select pg_temp.g12_ok((funcionario_desbloquear(current_setting('g12.chave'),'7391')->>'ok')::boolean,'reativacao permite PIN correto');
select sair_funcionario(current_setting('g12.chave'));
select pg_temp.g12_ok(funcionario_inicio(current_setting('g12.chave')) is null,'logout encerra acesso mesmo apos reativacao');
reset role;
-- Tambem e possivel sair enquanto a loja esta inativa.
update comercios set ativo=false where id=pg_temp.u('com');
set local role anon;
select sair_funcionario(repeat('f',64));
reset role;
select pg_temp.g12_ok((select encerrado_em is not null from funcionario_aparelhos where chave_hash=encode(extensions.digest(repeat('f',64),'sha256'),'hex')),'logout inativo permanece disponivel');
select 'G1.2: '||current_setting('g12.total')||' assercoes aprovadas' as resultado;
