-- Somente instância descartável. Conferência das RPCs reais, com rollback ao final.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5(t)::uuid $$;
create function pg_temp.ok(b boolean,nome text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %',nome; end if; return 'OK '||nome; end $$;
create function pg_temp.recusa(s text,msg text,estado text) returns text language plpgsql as $$
declare sucesso boolean:=false; st text; m text;
begin
  begin execute s; sucesso:=true; raise exception 'sucesso_inesperado' using errcode='T0K00';
  exception when others then get stacked diagnostics st=returned_sqlstate,m=message_text; end;
  if sucesso or st is distinct from estado or m<>msg then raise exception 'FALHOU: esperado % [%], veio % [%]',msg,estado,m,st; end if;
  return 'OK recusou '||msg;
end $$;
create function pg_temp.pedido(tag text,com text,codigo text,emb jsonb default '[]'::jsonb) returns jsonb language sql as $$
select jsonb_build_object('operacao_id',pg_temp.u(tag||'-op'),'produto_pedido',jsonb_build_object('operacao_id',pg_temp.u(tag||'-produto-op'),'produto',jsonb_build_object(
 'id',pg_temp.u(tag),'comercio_id',pg_temp.u(com),'codigo_barras',codigo,'nome',tag,'unidade','Unidade','categoria','Mercearia',
 'preco_compra',1,'preco_venda',2,'detalhes','{}'::jsonb,'controla_validade',false,'avisos_dias','[]'::jsonb),
 'variacoes','[]'::jsonb,'areas',case when tag='cb-prod' then '[{"area":"deposito","contagem":{"quantidade":10,"partes":[]}}]'::jsonb else '[]'::jsonb end,
 'embalagens',emb),'pendencias','[]'::jsonb)
$$;
insert into auth.users values(pg_temp.u('cb-dono'),'cb@teste.local'),(pg_temp.u('cb-outro'),'outro@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('cb-dono'),'dono'),(pg_temp.u('cb-outro'),'dono');
insert into comercios(id,dono_id,tipo,nome) values
 (pg_temp.u('cb-mercado'),pg_temp.u('cb-dono'),'mercado','Mercado códigos'),
 (pg_temp.u('cb-outro-mercado'),pg_temp.u('cb-outro'),'mercado','Outro Mercado'),
 (pg_temp.u('cb-farmacia'),pg_temp.u('cb-dono'),'farmacia','Farmácia códigos');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por) values
 (pg_temp.u('cb-func'),pg_temp.u('cb-mercado'),'Conferente','ambos','654322',pg_temp.u('cb-dono')),
 (pg_temp.u('cb-outro-func'),pg_temp.u('cb-outro-mercado'),'Outro conferente','ambos','654323',pg_temp.u('cb-outro'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate) values
 (pg_temp.u('cb-func'),pg_temp.u('cb-mercado'),encode(extensions.digest(repeat('b',64),'sha256'),'hex'),now()+interval '12 hours'),
 (pg_temp.u('cb-outro-func'),pg_temp.u('cb-outro-mercado'),encode(extensions.digest(repeat('c',64),'sha256'),'hex'),now()+interval '12 hours');

select pg_temp.ok(ean_upc_mercado('036000291452')='0036000291452' and ean_upc_mercado('0036000291452')='0036000291452','UPC e EAN equivalentes');
select pg_temp.ok(ean_upc_mercado('036000291453') is null and ean_upc_mercado('0036000291453') is null,'verificador errado não vira equivalente');
select pg_temp.ok(ean_upc_mercado('17896263503200') is null and ean_upc_mercado('96385074') is null and ean_upc_mercado('789') is null,'ITF, EAN8 e código curto mantêm identidade');
select set_config('request.jwt.claim.sub',pg_temp.u('cb-dono')::text,true);
set local role authenticated;
select salvar_cadastro(pg_temp.pedido('cb-prod','cb-mercado','0036000291452'));
select pg_temp.recusa($q$select salvar_cadastro(pg_temp.pedido('cb-duplicado','cb-mercado','036000291452'))$q$,'codigo_em_uso: 036000291452','23505');
select salvar_cadastro(pg_temp.pedido('cb-caixa-prod','cb-mercado','7896263503203',jsonb_build_array(
 jsonb_build_object('id',pg_temp.u('cb-caixa'),'tipo','Caixa','quantidade',12,'codigo_barras','17896263503200'))));
select pg_temp.recusa($q$select salvar_cadastro(pg_temp.pedido('cb-caixa-proibida','cb-mercado','7891000100103',jsonb_build_array(
 jsonb_build_object('id',pg_temp.u('cb-caixa-dup'),'tipo','Caixa','quantidade',12,'codigo_barras','036000291452'))))$q$,'codigo_em_uso: 036000291452','23505');
-- Repetir a operação usa o pedido exato e continua devolvendo o resultado original.
select salvar_cadastro(pg_temp.pedido('cb-prod','cb-mercado','0036000291452'));
reset role;
select pg_temp.ok((select codigo_barras from produtos where id=pg_temp.u('cb-prod'))='0036000291452','código salvo não perde o zero');
select pg_temp.ok(not exists(select 1 from produtos where id in (pg_temp.u('cb-duplicado'),pg_temp.u('cb-caixa-proibida')))
 and not exists(select 1 from operacoes where id in (pg_temp.u('cb-duplicado-op'),pg_temp.u('cb-caixa-proibida-op'))),'recusa desfaz produto e operação');
select pg_temp.ok((select count(*) from operacoes where id=pg_temp.u('cb-prod-op'))=1,'reenvio não duplica operação');
select pg_temp.ok(saldo_chave(pg_temp.u('cb-prod'),null,'deposito')=10 and (select count(*) from contagens where produto_id=pg_temp.u('cb-prod'))=1,'contagem inicial não duplica');

set local role anon;
select pg_temp.ok(funcionario_buscar_produto(repeat('b',64),'036000291452')->0->>'produto_id'=pg_temp.u('cb-prod')::text,'conferente encontra EAN pelo UPC');
select pg_temp.ok(funcionario_buscar_produto(repeat('b',64),'0036000291452')->0->>'codigo'='0036000291452','leitura exata devolve código original');
select pg_temp.ok(funcionario_buscar_produto(repeat('b',64),'17896263503200')->0->>'embalagem_id'=pg_temp.u('cb-caixa')::text,'código ITF encontra a caixa correta');
select pg_temp.ok(funcionario_buscar_produto(repeat('c',64),'036000291452')='[]'::jsonb,'outro comércio não recebe produto');
select pg_temp.recusa($q$select funcionario_buscar_produto(repeat('d',64),'036000291452')$q$,'acesso_encerrado','42501');
select pg_temp.recusa($q$select public.ean_upc_mercado('036000291452')$q$,'permission denied for function ean_upc_mercado','42501');
reset role;
select pg_temp.ok((select produto_id from _achar_item_venda(pg_temp.u('cb-mercado'),'caixa-1','036000291452'))=pg_temp.u('cb-prod'),'EAN da nota usa a equivalência');
select pg_temp.ok((select produto_id from _achar_item_venda(pg_temp.u('cb-mercado'),'036000291452',null))=pg_temp.u('cb-prod'),'código do caixa usa a equivalência');
insert into codigos_pdv(comercio_id,codigo,produto_id,criado_por) values(pg_temp.u('cb-mercado'),'036000291452',pg_temp.u('cb-caixa-prod'),pg_temp.u('cb-dono'));
select pg_temp.ok((select produto_id from _achar_item_venda(pg_temp.u('cb-mercado'),'036000291452','036000291452'))=pg_temp.u('cb-caixa-prod'),'vínculo explícito do caixa mantém prioridade');
select pg_temp.ok((select produto_id from _achar_item_venda(pg_temp.u('cb-outro-mercado'),'036000291452',null)) is null,'venda não mistura comércios');

-- Os outros tipos não recebem a equivalência. Não altera suas regras nem códigos.
insert into produtos(id,comercio_id,codigo_barras,nome,unidade,categoria,preco_compra,preco_venda) values
 (pg_temp.u('cb-farm-p1'),pg_temp.u('cb-farmacia'),'0036000291452','Produto farmácia 1','Unidade','Medicamentos',1,2),
 (pg_temp.u('cb-farm-p2'),pg_temp.u('cb-farmacia'),'036000291452','Produto farmácia 2','Unidade','Medicamentos',1,2);
select pg_temp.ok((select count(*) from codigos_barras where comercio_id=pg_temp.u('cb-farmacia') and ean_upc_mercado is not null)=0,'Farmácia mantém comparação exata');
select pg_temp.ok((select produto_id from _achar_item_venda(pg_temp.u('cb-farmacia'),'036000291452',null))=pg_temp.u('cb-farm-p2'),'busca fora do Mercado continua exata');

-- Mesmo código em outro comércio segue permitido pelo isolamento.
select set_config('request.jwt.claim.sub',pg_temp.u('cb-outro')::text,true);
set local role authenticated;
select salvar_cadastro(pg_temp.pedido('cb-outro-prod','cb-outro-mercado','036000291452'));
select pg_temp.recusa($q$select salvar_cadastro(pg_temp.pedido('cb-invasao','cb-mercado','7891000100103'))$q$,'sem_acesso_ao_comercio','42501');
select pg_temp.recusa($q$insert into codigos_barras(comercio_id,codigo,produto_id) values(pg_temp.u('cb-mercado'),'123',pg_temp.u('cb-prod'))$q$,'permission denied for table codigos_barras','42501');
reset role;
select pg_temp.ok((select count(*) from codigos_barras where ean_upc_mercado='0036000291452')=2,'equivalente permitido em comércios diferentes');
-- Edição no mesmo produto com operação nova; não reenvia a contagem inicial.
select set_config('request.jwt.claim.sub',pg_temp.u('cb-dono')::text,true);
set local role authenticated;
select salvar_cadastro(jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.pedido('cb-prod','cb-mercado','0036000291452'),
 '{operacao_id}',to_jsonb(pg_temp.u('cb-edit-op'))),'{produto_pedido,operacao_id}',to_jsonb(pg_temp.u('cb-edit-prod-op'))),
 '{produto_pedido,produto,nome}','"Nome editado"'),'{produto_pedido,areas}','[{"area":"deposito"}]'));
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('cb-prod'),null,'deposito')=10 and (select count(*) from contagens where produto_id=pg_temp.u('cb-prod'))=1
 and (select count(*) from movimentos where produto_id=pg_temp.u('cb-prod'))=1,'edição e buscas preservam estoque e histórico');
select pg_temp.ok((select codigo_barras from produtos where id=pg_temp.u('cb-prod'))='0036000291452','edição mantém código original');
rollback;
