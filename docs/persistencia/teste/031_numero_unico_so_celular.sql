-- 031: número único só para o caixa do celular (migração 20261018113000, aplicada em 18/10/2026).
-- Banco descartável com as migrações; tudo é desfeito. Nunca usar produção.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('b12i-'||t)::uuid $$;
create function pg_temp.ok(b boolean, nome text) returns text language plpgsql as $$
begin if b is not true then raise exception 'FALHOU: %', nome; end if; return 'OK '||nome; end $$;
insert into auth.users values(pg_temp.u('dono'),'b12i@teste.local');
insert into comercios(id,dono_id,tipo,nome) values(pg_temp.u('loja'),pg_temp.u('dono'),'mercado','Mercado simulado 031');
insert into caixas(id,comercio_id,nome) values(pg_temp.u('cx'),pg_temp.u('loja'),'Caixa 1'),(pg_temp.u('cx2'),pg_temp.u('loja'),'Caixa 2');
-- Duas notas do Conector com o mesmo número (dois computadores) e uma venda do celular com o mesmo número: entram.
insert into vendas(comercio_id,caixa_id,chave_nota,numero,origem,situacao) values
 (pg_temp.u('loja'),pg_temp.u('cx'),repeat('1',44),1,'conector','finalizada'),
 (pg_temp.u('loja'),pg_temp.u('cx2'),repeat('2',44),1,'conector','finalizada'),
 (pg_temp.u('loja'),pg_temp.u('cx'),null,1,'celular','finalizada');
select pg_temp.ok((select count(*) from vendas where comercio_id=pg_temp.u('loja') and numero=1)=3,'mesmo número em notas e no celular');
-- No celular, número repetido continua recusado (regra da A6).
do $$ begin
  insert into vendas(comercio_id,caixa_id,numero,origem,situacao) values(md5('b12i-loja')::uuid,md5('b12i-cx')::uuid,1,'celular','finalizada');
  raise exception 'FALHOU: número repetido no celular aceito';
exception when unique_violation then null; end $$;
select 'OK 031: número único só para o caixa do celular' as resultado;
rollback;
