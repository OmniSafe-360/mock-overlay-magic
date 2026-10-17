-- B12: Omni Conector. (1) roupa vendida sem tamanho/cor fica para o dono dizer qual saiu, sem "faltou" falso;
-- (2) cancelamento de nota de mês anterior ao caixa no Omni não cria venda cancelada vazia.
-- Banco descartável, dados simulados e transação desfeita. Nunca usar produção.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('b12-'||t)::uuid $$;
create function pg_temp.ok(b boolean, nome text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', nome; end if; return 'OK '||nome; end $$;
-- Chave de nota com 44 números e o último conferido; `aamm` = ano e mês de emissão.
create function pg_temp.chave(aamm text, n int) returns text language plpgsql as $$
declare b text := '35' || aamm || '52998224725000' || '65' || '001' || lpad(n::text, 9, '0') || '1' || lpad(n::text, 8, '0');
  s int := 0; p int := 2; i int; dv int;
begin
  for i in reverse 43..1 loop s := s + substr(b, i, 1)::int * p; p := case when p = 9 then 2 else p + 1 end; end loop;
  dv := 11 - (s % 11); if dv >= 10 then dv := 0; end if;
  return b || dv;
end $$;
insert into auth.users values(pg_temp.u('dono'),'b12@teste.local');
insert into user_roles(user_id,role) values(pg_temp.u('dono'),'dono');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('loja'),pg_temp.u('dono'),'loja_roupas','Roupas simuladas B12');
insert into caixas(id,comercio_id,nome,chave_hash,ligado_em,created_at)
 values(pg_temp.u('cx'),pg_temp.u('loja'),'Caixa 1',encode(extensions.digest(repeat('e',64),'sha256'),'hex'),now(),now() - interval '1 hour');
insert into produtos(id,comercio_id,nome,categoria,unidade,preco_compra,preco_venda)
 values(pg_temp.u('camisa'),pg_temp.u('loja'),'Camisa simulada','Camisetas','Peça',10,20);
insert into produto_variacoes(id,produto_id,comercio_id,tamanho,cor) values
 (pg_temp.u('P'),pg_temp.u('camisa'),pg_temp.u('loja'),'P','Azul'),(pg_temp.u('M'),pg_temp.u('camisa'),pg_temp.u('loja'),'M','Azul');
insert into codigos_pdv(comercio_id,codigo,produto_id,criado_por) values(pg_temp.u('loja'),'CAM',pg_temp.u('camisa'),pg_temp.u('dono'));
insert into codigos_pdv(comercio_id,codigo,produto_id,variacao_id,criado_por) values(pg_temp.u('loja'),'CAM-P',pg_temp.u('camisa'),pg_temp.u('P'),pg_temp.u('dono'));
create function pg_temp.nota(ch text, cod text) returns jsonb language sql as $$
 select conector_enviar_venda(repeat('e',64), jsonb_build_object('chave',ch,'numero',substr(ch,26,9)::int,'serie',1,'emitida_em',now(),'total',20,
  'pagamentos','[]'::jsonb,'itens',jsonb_build_array(jsonb_build_object('n',1,'codigo',cod,'descricao','Camisa','qtd',1,'valor',20)))) $$;
set local role anon;
-- 1. Roupa sem tamanho: fica para o dono escolher, sem "faltou".
select pg_temp.ok(pg_temp.nota(pg_temp.chave(to_char(now(),'YYMM'),1),'CAM')->>'situacao'='registrada','nota da camisa sem tamanho registrada');
reset role;
select pg_temp.ok((select situacao='conferir' and motivo='escolher_variacao' and qtd_faltou=0 and qtd_baixada=0
  from venda_itens where codigo_pdv='CAM' and comercio_id=pg_temp.u('loja')),'fica "diga qual tamanho saiu", sem faltou');
-- 2. Com o tamanho no código, continua tirando da gôndola daquele tamanho.
set local role anon;
select pg_temp.nota(pg_temp.chave(to_char(now(),'YYMM'),2),'CAM-P');
reset role;
select pg_temp.ok((select situacao='baixado' and variacao_id=pg_temp.u('P') from venda_itens where codigo_pdv='CAM-P'),'com tamanho: baixado do tamanho P');
-- 2b. Ajuste da revisão (#209): escolher o tamanho de uma venda vale só para ela.
set local role anon;
select pg_temp.nota(pg_temp.chave(to_char(now(),'YYMM'),5),'CAM');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select pg_temp.ok(resolver_item_venda((select vi.id from venda_itens vi join vendas v on v.id=vi.venda_id where v.numero=1 and vi.codigo_pdv='CAM'),'ligar',pg_temp.u('camisa'),pg_temp.u('P'),null)->>'itens'='1','escolher P resolve só esta venda');
reset role;
select pg_temp.ok((select vi.situacao='baixado' and vi.variacao_id=pg_temp.u('P') from venda_itens vi join vendas v on v.id=vi.venda_id where v.numero=1 and vi.codigo_pdv='CAM'),'venda 1: P');
select pg_temp.ok((select vi.situacao='conferir' and vi.motivo='escolher_variacao' and vi.variacao_id is null from venda_itens vi join vendas v on v.id=vi.venda_id where v.numero=5),'venda 5 continua perguntando');
select pg_temp.ok((select variacao_id is null from codigos_pdv where comercio_id=pg_temp.u('loja') and codigo='CAM'),'código CAM continua sem tamanho');
set local role anon;
select pg_temp.nota(pg_temp.chave(to_char(now(),'YYMM'),6),'CAM');
reset role;
select pg_temp.ok((select vi.situacao='conferir' from venda_itens vi join vendas v on v.id=vi.venda_id where v.numero=6),'próxima venda também pergunta');
-- 3. Cancelamento de nota de um mês antes do caixa: não cria nada.
set local role anon;
select pg_temp.ok(conector_cancelar_venda(repeat('e',64), pg_temp.chave(to_char(now() - interval '2 months','YYMM'),3))->>'situacao'='anterior','cancelamento de nota antiga: anterior');
reset role;
select pg_temp.ok(not exists(select 1 from vendas where chave_nota=pg_temp.chave(to_char(now() - interval '2 months','YYMM'),3)),'sem venda cancelada vazia');
-- 4. Cancelamento que chega antes da venda (mesmo mês) continua guardado, e a venda depois não conta.
set local role anon;
select pg_temp.ok(conector_cancelar_venda(repeat('e',64), pg_temp.chave(to_char(now(),'YYMM'),4))->>'situacao'='cancelada','cancelamento antes da venda: guardado');
select pg_temp.ok(pg_temp.nota(pg_temp.chave(to_char(now(),'YYMM'),4),'CAM-P')->>'situacao'='cancelada','venda que chega depois: já cancelada');
-- 5. Cancelar uma venda registrada continua igual.
select pg_temp.ok(conector_cancelar_venda(repeat('e',64), pg_temp.chave(to_char(now(),'YYMM'),2))->>'situacao'='cancelada','cancelar venda registrada');
reset role;
rollback;
