-- F03: somente PostgreSQL descartável, dentro de BEGIN/ROLLBACK, após 015_base_caixa_estoque.sql.
select pg_temp.ok(not has_function_privilege('anon','resolver_conferencia_com_motivo(uuid,numeric,text,text)','EXECUTE'),'anon sem execução');
select pg_temp.ok(has_function_privilege('authenticated','resolver_conferencia_com_motivo(uuid,numeric,text,text)','EXECUTE'),'dono autenticado executa');
select pg_temp.ok((select not prosecdef from pg_proc where oid='resolver_conferencia_com_motivo(uuid,numeric,text,text)'::regprocedure),'sem segurança elevada');
insert into conferencias(id,comercio_id,produto_id,area,funcionario_id,situacao,esperado,contado,tentativas)
values(pg_temp.u('f03-cf'),pg_temp.u('com'),pg_temp.u('ok'),'deposito',pg_temp.u('func'),'inconsistente',20,18,'[17,19,18]'::jsonb);
insert into diferencas(id,comercio_id,produto_id,area,origem,esperado,contado,diferenca,valor,funcionario_id,referencia_id,detalhes)
values(pg_temp.u('f03-dif'),pg_temp.u('com'),pg_temp.u('ok'),'deposito','conferencia_inconsistente',20,18,-2,-4,pg_temp.u('func'),pg_temp.u('f03-cf'),'{"tentativas":[17,19,18],"aguardando_dono":true}'::jsonb);
select pg_temp.ok(saldo_chave(pg_temp.u('ok'),null,'deposito')=20,'saldo inicial é vinte');
select set_config('request.jwt.claim.sub',pg_temp.u('outro')::text,true);
set local role authenticated;
select pg_temp.recusa($q$select resolver_conferencia_com_motivo(md5('cega-20261012-f03-dif')::uuid,17,'sumiu','')$q$,'sem_permissao');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select pg_temp.recusa($q$select resolver_conferencia_com_motivo(md5('cega-20261012-f03-dif')::uuid,17,'outro','x')$q$,'observacao_obrigatoria');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('ok'),null,'deposito')=20 and not (select detalhes?'resolvida' from diferencas where id=pg_temp.u('f03-dif')),'erro de motivo não altera saldo');
-- Simula ERRO na segunda ação, depois da baixa efetuada pela função interna.
create function pg_temp.f03_falhar_motivo() returns trigger language plpgsql as $$
begin
 if old.id=md5('cega-20261012-f03-dif')::uuid and old.situacao='aberta' and new.situacao='explicada'
  and old.diferenca<>0 then raise exception 'falha_motivo_simulada'; end if;
 return new;
end $$;
create trigger f03_falha_teste before update on diferencas for each row execute function pg_temp.f03_falhar_motivo();
set local role authenticated;
select pg_temp.recusa($q$select resolver_conferencia_com_motivo(md5('cega-20261012-f03-dif')::uuid,17,'sumiu','verificar')$q$,'falha_motivo_simulada');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('ok'),null,'deposito')=20,'rollback desfaz baixa de estoque');
select pg_temp.ok((select situacao='aberta' and not (detalhes?'resolvida') and motivo is null from diferencas where id=pg_temp.u('f03-dif')),'rollback desfaz decisão e motivo');
select pg_temp.ok((select count(*) from operacoes where hash=md5(pg_temp.u('f03-dif')::text||':resolver'))=0,'rollback não deixa operação');
drop trigger f03_falha_teste on diferencas;
set local role authenticated;
select pg_temp.ok((resolver_conferencia_com_motivo(pg_temp.u('f03-dif'),17,'sumiu','verificar câmeras')->>'diferenca')::numeric=-3,'retorno correto');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('ok'),null,'deposito')=17,'um ajuste');
select pg_temp.ok((select situacao='explicada' and motivo='sumiu' and observacao='verificar câmeras' and detalhes?'resolvida' from diferencas where id=pg_temp.u('f03-dif')),'motivo gravado junto');
select pg_temp.ok((select count(*) from operacoes where hash=md5(pg_temp.u('f03-dif')::text||':resolver'))=1,'uma operação');
set local role authenticated;
select pg_temp.recusa($q$select resolver_conferencia_com_motivo(md5('cega-20261012-f03-dif')::uuid,17,'sumiu','')$q$,'contagem_ja_resolvida');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('ok'),null,'deposito')=17,'reenvio não ajusta');
-- Escolher quantidade original é permitido sem justificativa.
insert into conferencias(id,comercio_id,produto_id,area,funcionario_id,situacao,esperado,contado,tentativas)
values(pg_temp.u('f03-zero-cf'),pg_temp.u('com'),pg_temp.u('d'),'deposito',pg_temp.u('func'),'inconsistente',0,2,'[0,1,2]'::jsonb);
insert into diferencas(id,comercio_id,produto_id,area,origem,esperado,contado,diferenca,valor,funcionario_id,referencia_id,detalhes)
values(pg_temp.u('f03-zero'),pg_temp.u('com'),pg_temp.u('d'),'deposito','conferencia_inconsistente',0,2,2,4,pg_temp.u('func'),pg_temp.u('f03-zero-cf'),'{"tentativas":[0,1,2]}'::jsonb);
set local role authenticated;
select pg_temp.ok((resolver_conferencia_com_motivo(pg_temp.u('f03-zero'),0,null,'')->>'diferenca')::numeric=0,'zero não pede motivo');
reset role;
select pg_temp.ok((select situacao='explicada' and motivo='erro_contagem' from diferencas where id=pg_temp.u('f03-zero')),'zero encerrado');
-- Gôndola aguarda a conferência do depósito, sem ajuste ou explicação prematuros.
insert into conferencias(id,comercio_id,produto_id,area,funcionario_id,situacao,esperado,contado,tentativas)
values(pg_temp.u('f03-gondola-cf'),pg_temp.u('com'),pg_temp.u('g'),'venda',pg_temp.u('func'),'inconsistente',5,7,'[7,6,7]'::jsonb);
insert into diferencas(id,comercio_id,produto_id,area,origem,esperado,contado,diferenca,valor,funcionario_id,referencia_id,detalhes)
values(pg_temp.u('f03-gondola-dif'),pg_temp.u('com'),pg_temp.u('g'),'venda','conferencia_inconsistente',5,7,2,4,pg_temp.u('func'),pg_temp.u('f03-gondola-cf'),'{"tentativas":[7,6,7]}'::jsonb);
insert into operacoes(id,user_id,comercio_id,produto_id,tipo,hash,funcionario_id,resultado)
values(pg_temp.u('f03-caixa'),pg_temp.u('dono'),pg_temp.u('com'),pg_temp.u('g'),'conferencia',md5('f03-caixa'),pg_temp.u('func'),
jsonb_build_object('solicitacao_caixa',true,'conferencia_id',pg_temp.u('f03-gondola-cf')));
set local role authenticated;
select pg_temp.ok((resolver_conferencia_com_motivo(pg_temp.u('f03-gondola-dif'),7,'sumiu','')->>'situacao')='aguardando_deposito','espera depósito');
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('g'),null,'venda')=5,'estoque da gôndola preservado');
select pg_temp.ok((select situacao='aberta' and motivo is null and not (detalhes?'resolvida') from diferencas where id=pg_temp.u('f03-gondola-dif')),'diferença aguarda depósito');
select pg_temp.ok((select count(*)=1 from conferencias where produto_id=pg_temp.u('g') and area='deposito' and situacao='contando'),'solicitação sem duplicação');
set local role authenticated;
select pg_temp.ok((resolver_conferencia_com_motivo(pg_temp.u('f03-gondola-dif'),7,'sumiu','')->>'situacao')='aguardando_deposito','reenvio da espera é estável');
reset role;
select pg_temp.ok((select count(*)=1 from conferencias where produto_id=pg_temp.u('g') and area='deposito' and situacao='contando'),'repetição não duplica depósito');
