-- Fixture exclusiva do PostgreSQL descartável, não entra nas migrações.
insert into auth.users values(md5('sim-dono')::uuid,'sim@teste.local');
insert into user_roles(user_id,role) values(md5('sim-dono')::uuid,'dono');
insert into comercios(id,dono_id,tipo,nome) values(md5('sim-mercado')::uuid,md5('sim-dono')::uuid,'mercado','Mercado simultâneo');
create function public.t_cadastro_codigos(_tag text,_codigo text) returns jsonb language sql as $$
select jsonb_build_object('operacao_id',md5(_tag||'-op')::uuid,'produto_pedido',jsonb_build_object(
 'operacao_id',md5(_tag||'-prod-op')::uuid,'produto',jsonb_build_object('id',md5(_tag)::uuid,'comercio_id',md5('sim-mercado')::uuid,
 'nome',_tag,'codigo_barras',_codigo,'unidade','Unidade','categoria','Mercearia','preco_compra',1,'preco_venda',2,
 'detalhes','{}'::jsonb,'controla_validade',false),'variacoes','[]'::jsonb,'areas','[]'::jsonb,'embalagens','[]'::jsonb),'pendencias','[]'::jsonb)
$$;
