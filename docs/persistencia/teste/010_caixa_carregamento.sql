-- Dados fictícios SOMENTE na instância privada criada por rodar_caixa.sh.
-- Nunca aplicar no Supabase. A instância inteira é descartada ao terminar.
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5(t)::uuid $$;
insert into auth.users(id) values (pg_temp.u('cx-dono')), (pg_temp.u('cx-outro-dono'));
insert into comercios(id,dono_id,tipo,nome) values
 (pg_temp.u('cx-mercado'),pg_temp.u('cx-dono'),'mercado','Mercado teste'),
 (pg_temp.u('cx-roupas'),pg_temp.u('cx-outro-dono'),'loja_roupas','Roupas teste'),
 (pg_temp.u('cx-vazio'),pg_temp.u('cx-dono'),'mercado','Mercado vazio');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por,caixa,bloqueado_em) values
 (pg_temp.u('cx-func'),pg_temp.u('cx-mercado'),'Thales','ambos','315847',pg_temp.u('cx-dono'),true,null),
 (pg_temp.u('cx-outro-func'),pg_temp.u('cx-roupas'),'Maria','repor','315848',pg_temp.u('cx-outro-dono'),true,null),
 (pg_temp.u('cx-sem-caixa'),pg_temp.u('cx-mercado'),'Sem caixa','ambos','315849',pg_temp.u('cx-dono'),false,null),
 (pg_temp.u('cx-pin'),pg_temp.u('cx-mercado'),'PIN expirado','ambos','315850',pg_temp.u('cx-dono'),true,null),
 (pg_temp.u('cx-bloqueado'),pg_temp.u('cx-mercado'),'Bloqueado','ambos','315851',pg_temp.u('cx-dono'),true,now()),
 (pg_temp.u('cx-encerrado'),pg_temp.u('cx-mercado'),'Acesso encerrado','ambos','315852',pg_temp.u('cx-dono'),true,null),
 (pg_temp.u('cx-vazio-func'),pg_temp.u('cx-vazio'),'Caixa vazio','ambos','315853',pg_temp.u('cx-dono'),true,null);
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate,encerrado_em,ultimo_uso)
 select id,comercio_id,encode(extensions.digest(repeat(k,64),'sha256'),'hex'),
   case when k='e' then now()-interval '1 hour' else now()+interval '12 hours' end,
   case when k='a' then now() end,now()-interval '2 minutes'
 from (values ('cx-func','c'),('cx-outro-func','b'),('cx-sem-caixa','d'),('cx-pin','e'),
   ('cx-bloqueado','f'),('cx-encerrado','a'),('cx-vazio-func','7')) x(tag,k)
 join funcionarios on id=pg_temp.u(tag);

-- O estoque inicial é criado pela função real, não por um saldo simulado.
select set_config('request.jwt.claim.sub',pg_temp.u('cx-dono')::text,true);
set local role authenticated;
select salvar_cadastro(jsonb_build_object(
 'operacao_id',pg_temp.u('cx-op'),'pendencias','[]'::jsonb,
 'produto_pedido',jsonb_build_object('operacao_id',pg_temp.u('cx-prod-op'),
   'produto',jsonb_build_object('id',pg_temp.u('cx-prod'),'comercio_id',pg_temp.u('cx-mercado'),
     'codigo_barras','7891000412855','nome','Nescau','unidade','Unidade','categoria','Mercearia',
     'preco_compra',5,'preco_venda',10,'detalhes','{}'::jsonb,'controla_validade',false,'avisos_dias','[]'::jsonb),
   'variacoes','[]'::jsonb,'embalagens',jsonb_build_array(jsonb_build_object('id',pg_temp.u('cx-fardo'),
     'tipo','Fardo','quantidade',12,'codigo_barras','2900000000018')),
   'areas','[{"area":"deposito","contagem":{"quantidade":40,"partes":[]}},
             {"area":"venda","contagem":{"quantidade":20,"partes":[]}}]'::jsonb)));
reset role;
insert into produtos(id,comercio_id,codigo_barras,nome,unidade,categoria,preco_compra,preco_venda,ativo) values
 (pg_temp.u('cx-kg'),pg_temp.u('cx-mercado'),'2000000000015','Queijo','Kg','Frios e laticínios',10,20,true),
 (pg_temp.u('cx-inativo'),pg_temp.u('cx-mercado'),'cx-inativo','Inativo','Unidade','Mercearia',1,2,false),
 (pg_temp.u('cx-camiseta'),pg_temp.u('cx-roupas'),'cx-roupa','Camiseta','Peça','Camisetas',10,20,true);
insert into produto_variacoes(id,comercio_id,produto_id,tamanho,cor,codigo_barras,qtd_informada) values
 (pg_temp.u('cx-var'),pg_temp.u('cx-roupas'),pg_temp.u('cx-camiseta'),'M','Azul','cx-m-azul',3);
insert into codigos_pdv(comercio_id,codigo,produto_id,criado_por) values
 (pg_temp.u('cx-mercado'),'sku-nescau',pg_temp.u('cx-prod'),pg_temp.u('cx-dono'));
insert into clientes_fiado(id,comercio_id,nome,telefone,ativo) values
 (pg_temp.u('cx-cliente'),pg_temp.u('cx-mercado'),'Cliente do mercado','11999999999',true),
 (pg_temp.u('cx-cliente-inativo'),pg_temp.u('cx-mercado'),'Cliente inativo',null,false),
 (pg_temp.u('cx-cliente-outro'),pg_temp.u('cx-roupas'),'Cliente da roupa',null,true);
commit;
