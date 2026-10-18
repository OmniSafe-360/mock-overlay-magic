-- Somente dados fictícios; combinar com a base 015 entre begin e rollback.
-- Este primeiro caso deve falhar no main anterior, onde NaN era aceito.
select pg_temp.recusa($q$select public.qtd_valida('NaN'::numeric,'Unidade',true)$q$,'quantidade_invalida');
do $$
declare u text; n text;
begin
 foreach u in array array['Unidade','Kg','Litro','Pacote','Caixa','Cartela','Frasco','Peça','Par','Metro','m²','Saco','Lata','Jogo','Kit'] loop
  foreach n in array array['NaN','Infinity','-Infinity'] loop
   perform pg_temp.recusa(format('select public.qtd_valida(%L::numeric,%L,true)',n,u),'quantidade_invalida');
   perform pg_temp.recusa(format('select public.qtd_valida(%L::numeric,%L,false)',n,u),'quantidade_invalida');
  end loop;
  perform pg_temp.ok(public.qtd_valida(0,u,true)=0,'zero conhecido permitido: '||u);
  perform pg_temp.ok(public.qtd_valida(12,u,false)=12,'inteiro positivo mantido: '||u);
 end loop;
 foreach u in array array['Kg','Metro','m²','Litro'] loop
  perform pg_temp.ok(public.qtd_valida(1.125,u,false)=1.125,'fracionado sem arredondar: '||u);
 end loop;
end $$;
select pg_temp.recusa($q$select public.qtd_valida(null,'Unidade',true)$q$,'quantidade_vazia');
select pg_temp.recusa($q$select public.qtd_valida(-1,'Kg',true)$q$,'quantidade_negativa');
select pg_temp.recusa($q$select public.qtd_valida(1.2345,'Kg',true)$q$,'mais_de_tres_casas');
select pg_temp.recusa($q$select public.qtd_valida(1.5,'Unidade',true)$q$,'unidade_exige_inteiro: Unidade');
select pg_temp.recusa($q$select public.qtd_valida(0,'Kg',false)$q$,'quantidade_zero');

create function pg_temp.payload(t text,q text,u text default 'Unidade',campo text default 'contagem') returns jsonb language sql as $$
 select jsonb_set(jsonb_build_object('operacao_id',pg_temp.u('op-'||t),'pendencias','[]'::jsonb,
 'produto_pedido',jsonb_build_object('operacao_id',pg_temp.u('op-prod-'||t),
 'produto',jsonb_build_object('id',pg_temp.u(t),'comercio_id',pg_temp.u('com'),'nome','Teste finito '||t,'categoria','Mercearia','unidade',u,'preco_compra',2,'preco_venda',4,'controla_validade',false,'avisos_dias','[]'::jsonb,'detalhes','{}'::jsonb),
 'variacoes','[]'::jsonb,'embalagens','[]'::jsonb,
 'areas',jsonb_build_array(jsonb_build_object('area','deposito','minimo',0,'maximo',1000,'contagem',jsonb_build_object('quantidade',0,'partes','[]'::jsonb)),
 jsonb_build_object('area','venda','minimo',0,'maximo',100,'contagem',jsonb_build_object('quantidade',0,'partes','[]'::jsonb))))),
 case when campo='contagem' then array['produto_pedido','areas','0','contagem','quantidade'] else array['produto_pedido','areas','0',campo] end,to_jsonb(q)) $$;
create function pg_temp.estado() returns jsonb language sql as $$
 select jsonb_build_object(
 'produtos',(select jsonb_agg(to_jsonb(t) order by id) from produtos t),
 'areas',(select jsonb_agg(to_jsonb(t) order by id) from produto_areas t),
 'contagens',(select jsonb_agg(to_jsonb(t) order by id) from contagens t),
 'saldos',(select jsonb_agg(to_jsonb(t) order by id) from saldos t),
 'movimentos',(select jsonb_agg(to_jsonb(t) order by id) from movimentos t),
 'operacoes',(select jsonb_agg(to_jsonb(t) order by id) from operacoes t)) $$;
set local role authenticated;
do $$
declare antes jsonb:=pg_temp.estado();n text;campo text;
begin
 foreach n in array array['NaN','Infinity','-Infinity'] loop
  foreach campo in array array['contagem','minimo','maximo'] loop
   perform pg_temp.recusa(format('select public.salvar_cadastro(%L::jsonb)',pg_temp.payload('invalido-'||n||campo,n,'Unidade',campo)::text),'quantidade_invalida');
   perform pg_temp.ok(pg_temp.estado()=antes,'recusa sem produto, saldo, operação ou movimento parcial: '||n||campo);
  end loop;
 end loop;
end $$;
-- Fluxo real de cadastro continua aceitando zero e peso com três casas.
select salvar_cadastro(pg_temp.payload('q-zero','0'));
select salvar_cadastro(pg_temp.payload('q-peso','1.125','Kg'));
reset role;
select pg_temp.ok(saldo_chave(pg_temp.u('q-zero'),null,'deposito')=0,'cadastro com zero continua conhecido');
select pg_temp.ok(saldo_chave(pg_temp.u('q-peso'),null,'deposito')=1.125,'peso gravado sem mudar o valor');
select pg_temp.ok((select count(*)=1 from operacoes where produto_id=pg_temp.u('q-peso') and tipo='salvar_produto'),'cadastro válido mantém operação permanente');
select pg_temp.ok(not has_function_privilege('anon','public.qtd_valida(numeric,text,boolean)','EXECUTE') and not has_function_privilege('authenticated','public.qtd_valida(numeric,text,boolean)','EXECUTE'),'validação continua interna');
select pg_temp.ok(not has_table_privilege('authenticated','saldos','INSERT') and not has_table_privilege('anon','saldos','INSERT'),'gravação direta continua recusada');
select pg_temp.ok((select bool_and(relrowsecurity) from pg_class where oid in('saldos'::regclass,'contagens'::regclass,'operacoes'::regclass)),'RLS preservada');
select 'OK: especiais recusados; zero, inteiros, fracionados e cadastro atômico preservados' as resultado;
