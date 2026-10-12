create function pg_temp.u(t text) returns uuid language sql immutable as $$ select md5('cega-20261012-'||t)::uuid $$;
create function pg_temp.ok(b boolean,t text) returns void language plpgsql as $$ begin if b is not true then raise exception 'FALHOU: %',t; end if; end $$;
create function pg_temp.recusa(q text,m text) returns void language plpgsql as $$
declare msg text;
begin begin execute q; exception when others then get stacked diagnostics msg=message_text; end;
 if msg is distinct from m then raise exception 'FALHOU: esperado %, veio %',m,coalesce(msg,'sucesso'); end if;
end $$;
insert into auth.users(id,email) values(pg_temp.u('dono'),'cega-dono@example.invalid'),(pg_temp.u('outro'),'cega-outro@example.invalid');
insert into user_roles(user_id,role) values(pg_temp.u('dono'),'dono'),(pg_temp.u('outro'),'dono') on conflict do nothing;
insert into comercios(id,dono_id,tipo,nome,documento_tipo,documento,telefone,cep,rua,numero,bairro,cidade,uf)
 values(pg_temp.u('com'),pg_temp.u('dono'),'mercado','Teste transacional de contagem','cpf','52998224725','11999998888','01001000','Rua fictícia','1','Teste','São Paulo','SP');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por) values(pg_temp.u('func'),pg_temp.u('com'),'Equipe simulada','ambos','937421',pg_temp.u('dono'));
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate) values(pg_temp.u('func'),pg_temp.u('com'),encode(extensions.digest(repeat('f',64),'sha256'),'hex'),now()+interval '1 hour');
select set_config('request.jwt.claim.sub',pg_temp.u('dono')::text,true);
set local role authenticated;
select salvar_cadastro(jsonb_build_object('operacao_id',pg_temp.u('op-'||tag),'pendencias','[]'::jsonb,
 'produto_pedido',jsonb_build_object('operacao_id',pg_temp.u('op-prod-'||tag),
 'produto',jsonb_build_object('id',pg_temp.u(tag),'comercio_id',pg_temp.u('com'),'nome','Produto de teste '||tag,'categoria','Mercearia','unidade','Unidade','preco_compra',2,'preco_venda',4,'controla_validade',false,'avisos_dias','[]'::jsonb,'detalhes','{}'::jsonb),
 'variacoes','[]'::jsonb,'embalagens','[]'::jsonb,
 'areas',jsonb_build_array(jsonb_build_object('area','deposito','minimo',10,'maximo',1000,'contagem',jsonb_build_object('quantidade',q,'partes','[]'::jsonb)),
                         jsonb_build_object('area','venda','minimo',10,'maximo',100,'contagem',jsonb_build_object('quantidade',0,'partes','[]'::jsonb))))))
from (values('g',1000),('d',0),('tres',0),('ok',20),('concorre',10)) x(tag,q);
reset role;
