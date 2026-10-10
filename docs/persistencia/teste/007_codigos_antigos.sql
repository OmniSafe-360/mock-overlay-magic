-- Somente o banco descartável anterior à migração de equivalência.
-- Cria dois cadastros antigos que não podem ser juntados automaticamente.
insert into auth.users values(md5('antigo-dono')::uuid,'antigo@teste.local');
insert into user_roles(user_id,role) values(md5('antigo-dono')::uuid,'dono');
insert into comercios(id,dono_id,tipo,nome) values(md5('antigo-mercado')::uuid,md5('antigo-dono')::uuid,'mercado','Mercado antigo');
select set_config('request.jwt.claim.sub',md5('antigo-dono')::uuid::text,false);
set role authenticated;
select salvar_produto(jsonb_build_object('operacao_id',md5('antigo-op1')::uuid,'produto',jsonb_build_object(
 'id',md5('antigo-prod1')::uuid,'comercio_id',md5('antigo-mercado')::uuid,'nome','Produto antigo EAN','codigo_barras','0036000291452',
 'unidade','Unidade','categoria','Mercearia','preco_compra',1,'preco_venda',2,'detalhes','{}'::jsonb,'controla_validade',false),
 'variacoes','[]'::jsonb,'areas','[{"area":"deposito","contagem":{"quantidade":10,"partes":[]}}]'::jsonb));
select salvar_produto(jsonb_build_object('operacao_id',md5('antigo-op2')::uuid,'produto',jsonb_build_object(
 'id',md5('antigo-prod2')::uuid,'comercio_id',md5('antigo-mercado')::uuid,'nome','Produto antigo UPC','codigo_barras','036000291452',
 'unidade','Unidade','categoria','Mercearia','preco_compra',1,'preco_venda',2,'detalhes','{}'::jsonb,'controla_validade',false),
 'variacoes','[]'::jsonb,'areas','[]'::jsonb));
reset role;
