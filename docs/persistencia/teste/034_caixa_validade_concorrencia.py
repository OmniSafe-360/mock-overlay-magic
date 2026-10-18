"""Somente banco privado descartável, com a base 015 e a proposta aplicada."""
import concurrent.futures,hashlib,os,subprocess,threading
assert os.environ.get('PGHOST','').startswith('/tmp/omni-contagem-cega.'),'somente socket descartável'
def u(t):
 s=hashlib.md5(('cega-20261012-'+t).encode()).hexdigest();return f"'{s[:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:]}'::uuid"
def sql(q):
 r=subprocess.run(['psql','-X','-At','-v','ON_ERROR_STOP=1','-c',q],text=True,capture_output=True)
 assert r.returncode==0,r.stderr
 return r.stdout.strip()
def conferir(q): assert sql('select '+q)=='t',q
sql(f"update funcionarios set caixa=true where id={u('func')}; insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por,caixa) values({u('func2')},{u('com')},'Caixa fictício 2','ambos','937423',{u('dono')},true); insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate) values({u('func2')},{u('com')},encode(extensions.digest(repeat('e',64),'sha256'),'hex'),now()+interval '1 hour');")
sql(f"update saldos set quantidade=0 where produto_id={u('g')} and area='venda'; insert into lotes(id,comercio_id,produto_id,numero,vencimento) values({u('conc-bom')},{u('com')},{u('g')},'C-B',(now() at time zone 'America/Sao_Paulo')::date+1),({u('conc-venc')},{u('com')},{u('g')},'C-V',(now() at time zone 'America/Sao_Paulo')::date-1); insert into saldos(comercio_id,produto_id,area,lote_id,quantidade) values({u('com')},{u('g')},'venda',{u('conc-bom')},3),({u('com')},{u('g')},'venda',{u('conc-venc')},2);")
for chave,t in [('f','conc-t1'),('e','conc-t2')]:sql(f"begin;set local role anon;select caixa_abrir(repeat('{chave}',64),{u(t)},0);commit;")
def venda(tag,q,ch='f',t='conc-t1'):
 return f"begin;set local role anon;select caixa_registrar_venda(repeat('{ch}',64),jsonb_build_object('id',{u(tag)},'turno_id',{u(t)},'feita_em',now(),'itens',jsonb_build_array(jsonb_build_object('produto_id',{u('g')},'qtd',{q},'preco',4)),'pagamentos',jsonb_build_array(jsonb_build_object('forma','pix','valor',{q}*4))));commit;"
def disputar(a,b):
 barrier=threading.Barrier(2)
 def enviar(q):barrier.wait();return sql(q)
 with concurrent.futures.ThreadPoolExecutor(2) as pool:return list(pool.map(enviar,[a,b]))
r=disputar(venda('conc-a',2),venda('conc-b',2,'e','conc-t2'))
assert sum('registrada' in x for x in r)==1 and sum('bloqueada' in x for x in r)==1,r
conferir(f"public._saldo_vendavel_caixa({u('g')},null)=1 and public.saldo_chave({u('g')},null,'venda')=3")
conferir(f"(select sum(quantidade)=2 from saldos where lote_id={u('conc-venc')})")
r=disputar(venda('conc-rep',1),venda('conc-rep',1))
assert sum('registrada' in x for x in r)==1 and sum('repetida' in x for x in r)==1,r
conferir(f"public._saldo_vendavel_caixa({u('g')},null)=0 and public.saldo_chave({u('g')},null,'venda')=2 and (select count(*)=2 from vendas)")
print('OK: dois caixas sobre 3 válidas + 2 vencidas; só uma venda de 2 aceita; reenvio simultâneo não duplica; vencidos intactos.')
