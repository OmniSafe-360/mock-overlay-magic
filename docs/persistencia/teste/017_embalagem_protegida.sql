-- Etapa 3: casos da embalagem protegida. Dados fictícios; roda dentro de begin … rollback, após 015_base_caixa_estoque.sql.
create function pg_temp.salva(tag text, embs jsonb) returns jsonb language sql as $$
 select salvar_cadastro(jsonb_build_object('operacao_id',gen_random_uuid(),'pendencias','[]'::jsonb,
  'produto_pedido',jsonb_build_object('operacao_id',gen_random_uuid(),
  'produto',jsonb_build_object('id',pg_temp.u(tag),'comercio_id',pg_temp.u('com'),'nome','Ovos ficticios '||tag,'categoria','Mercearia','unidade','Unidade','preco_compra',2,'preco_venda',4,'controla_validade',false,'avisos_dias','[]'::jsonb,'detalhes','{}'::jsonb),
  'variacoes','[]'::jsonb,'embalagens',embs,'areas','[]'::jsonb))) $$;
create function pg_temp.emb(id text, q numeric, preco numeric default null, cod text default null) returns jsonb language sql as $$
 select jsonb_build_object('id',pg_temp.u(id),'tipo','Caixa','quantidade',q,'preco_compra',preco,'codigo_barras',cod) $$;

insert into fornecedores(id,dono_id,nome) values(pg_temp.u('forn'),pg_temp.u('dono'),'Fornecedor ficticio');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
-- 1) embalagem nova e 2) existente nunca usada: muda quantidade livremente
select pg_temp.salva('ovo', jsonb_build_array(pg_temp.emb('cx6',6), pg_temp.emb('livre',10)));
select pg_temp.salva('ovo', jsonb_build_array(pg_temp.emb('cx6',6), pg_temp.emb('livre',12)));
reset role;
select pg_temp.ok((select quantidade from produto_embalagens where id=pg_temp.u('livre'))=12,'embalagem nunca usada pode mudar');
-- 3) pedido aberto com 9 caixas = 54
set local role authenticated;
select salvar_pedido(jsonb_build_object('id',pg_temp.u('ped'),'comercio_id',pg_temp.u('com'),'fornecedor_id',pg_temp.u('forn'),
  'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('ovo'),'embalagem_id',pg_temp.u('cx6'),'qtd_embalagens',9))));
reset role;
select pg_temp.ok((select qtd_unidades from pedido_itens where pedido_id=pg_temp.u('ped'))=54,'pedido 9x6=54');
-- por função existente: mudar fator recusa, nada muda
set local role authenticated;
select pg_temp.recusa($q$select pg_temp.salva('ovo', jsonb_build_array(pg_temp.emb('cx6',7), pg_temp.emb('livre',12)))$q$,'embalagem_em_uso');
-- edição legítima: preço e código ok
select pg_temp.salva('ovo', jsonb_build_array(pg_temp.emb('cx6',6,30,'17891234567895'), pg_temp.emb('livre',12)));
reset role;
select pg_temp.ok((select preco_compra=30 and codigo_barras='17891234567895' and quantidade=6 from produto_embalagens where id=pg_temp.u('cx6')),'preço/código editáveis');
-- direto no banco (como superusuário, contornando RLS): fator, produto, apagar
select pg_temp.recusa($q$update produto_embalagens set quantidade=12 where id=pg_temp.u('cx6')$q$,'embalagem_em_uso');
-- Apagar embalagem usada continua recusado, agora pela chave estrangeira (NO ACTION), não pelo gatilho.
do $x$ declare st text; begin
  begin execute $q$delete from produto_embalagens where id=pg_temp.u('cx6')$q$; st := 'sucesso';
  exception when others then get stacked diagnostics st = returned_sqlstate; end;
  perform pg_temp.ok(st = '23503', 'apagar embalagem usada recusado pela chave estrangeira (veio ' || st || ')');
end $x$;
-- 4) pedido concluído continua protegido
update pedidos_compra set situacao='recebido' where id=pg_temp.u('ped');
select pg_temp.recusa($q$update produto_embalagens set quantidade=7 where id=pg_temp.u('cx6')$q$,'embalagem_em_uso');
-- remover usada = marcar removida (histórico preservado); voltar de removida recusado
set local role authenticated;
select pg_temp.salva('ovo', jsonb_build_array(pg_temp.emb('livre',12)));
reset role;
select pg_temp.ok((select removida_em is not null and quantidade=6 from produto_embalagens where id=pg_temp.u('cx6')),'removida mantém fator');
select pg_temp.ok((select qtd_unidades=54 and embalagem_id=pg_temp.u('cx6') from pedido_itens where pedido_id=pg_temp.u('ped')),'pedido intacto');
select pg_temp.recusa($q$update produto_embalagens set removida_em=null, quantidade=12 where id=pg_temp.u('cx6')$q$,'embalagem_em_uso');
-- 5) vinculada ao caixa
set local role authenticated;
select pg_temp.salva('ovo', jsonb_build_array(pg_temp.emb('livre',12), pg_temp.emb('pdv',24)));
reset role;
insert into codigos_pdv(comercio_id,codigo,produto_id,embalagem_id,criado_por) values(pg_temp.u('com'),'X99',pg_temp.u('ovo'),pg_temp.u('pdv'),pg_temp.u('dono'));
select pg_temp.recusa($q$update produto_embalagens set quantidade=30 where id=pg_temp.u('pdv')$q$,'embalagem_em_uso');
-- pedido com fator divergente (simula leitura antiga) é recusado
select pg_temp.recusa($q$insert into pedido_itens(pedido_id,comercio_id,produto_id,embalagem_id,qtd_embalagens,qtd_unidades) values(pg_temp.u('ped'),pg_temp.u('com'),pg_temp.u('ovo'),pg_temp.u('livre'),2,20)$q$,'embalagem_mudou');
-- 6) outro acesso: anon/authenticated não chamam as funções internas nem gravam direto
set local role authenticated;
select pg_temp.recusa($q$select public._embalagem_em_uso(pg_temp.u('cx6'))$q$,'permission denied for function _embalagem_em_uso');
select pg_temp.recusa($q$update produto_embalagens set quantidade=1 where id=pg_temp.u('livre')$q$,'permission denied for table produto_embalagens');
-- isolamento: outro dono não salva embalagem do produto alheio
select set_config('request.jwt.claim.sub',pg_temp.u('outro')::text,true);
select pg_temp.recusa($q$select pg_temp.salva('ovo', jsonb_build_array(pg_temp.emb('livre',5)))$q$,'sem_acesso_ao_comercio');
reset role;
select pg_temp.ok((select quantidade from produto_embalagens where id=pg_temp.u('livre'))=12,'outro dono não mudou nada');
select 'OK: 017 embalagem protegida';
