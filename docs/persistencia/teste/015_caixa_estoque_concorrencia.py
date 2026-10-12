"""Disputas entre conexões reais, somente no banco descartável do roteiro 014."""
import concurrent.futures, hashlib, json, os, subprocess, threading

def u(tag):
    x=hashlib.md5(('cega-20261012-'+tag).encode()).hexdigest()
    return f"'{x[:8]}-{x[8:12]}-{x[12:16]}-{x[16:20]}-{x[20:]}'::uuid"

def sql(q, aceito=True):
    r=subprocess.run(['psql','-X','-At','-v','ON_ERROR_STOP=1','-c',q],text=True,capture_output=True)
    if aceito and r.returncode: raise AssertionError(r.stderr)
    return r

def equipe(q): return 'begin; set local role anon; '+q+'; commit;'
def dono(q): return f"begin; select set_config('request.jwt.claim.sub',{u('dono')}::text,true); set local role authenticated; {q}; commit;"
def contar(tag,prod,n,round=1):return f"select funcionario_reposicao_contar(repeat('f',64),{u(tag)},{u(prod)},null,{n},{round})"
def concluir(tag,n):return f"select funcionario_reposicao_concluir(repeat('f',64),{u(tag)},{n})"
def verificar(q): assert sql('select '+q).stdout.strip()=='t',q

def disputa(a,b):
    barreira=threading.Barrier(2)
    def enviar(q): barreira.wait();return sql(q,False)
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        resultados=list(pool.map(enviar,[a,b]))
    # Travas não podem se transformar em espera indefinida ou deadlock.
    assert all('deadlock' not in r.stderr for r in resultados)
    return resultados


# Dois caixas autorizados, saldo compartilhado da mesma gôndola.
sql(f"update funcionarios set caixa=true where id={u('func')}")
sql(f"insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por,caixa) values({u('func2')},{u('com')},'Outro caixa fictício','ambos','937423',{u('dono')},true)")
sql(f"insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate) values({u('func2')},{u('com')},encode(extensions.digest(repeat('e',64),'sha256'),'hex'),now()+interval '1 hour')")
for chave,turno in [('f','turno1'),('e','turno2')]:sql(equipe(f"select caixa_abrir(repeat('{chave}',64),{u(turno)},0)"))
def vender(tag,prod,qtd,chave='f',turno='turno1',acao='vender'):
 return f"select caixa_registrar_venda(repeat('{chave}',64),jsonb_build_object('id',{u(tag)},'turno_id',{u(turno)},'acao','{acao}','feita_em',now(),'itens',jsonb_build_array(jsonb_build_object('produto_id',{u(prod)},'qtd',{qtd},'preco',4)),'pagamentos',jsonb_build_array(jsonb_build_object('forma','pix','valor',{qtd}*4))))"
# Dois caixas vendem 4 cada sobre saldo 5. Uma venda confirma, a outra é recusada.
a=disputa(equipe(vender('v-a','g',4)),equipe(vender('v-b','g',4,'e','turno2')))
assert all(x.returncode==0 for x in a)
assert sum('registrada' in x.stdout for x in a)==1 and sum('bloqueada' in x.stdout for x in a)==1
verificar(f"saldo_chave({u('g')},null,'venda')=1 and (select count(*)=1 from vendas)")
# Mesmo ID simultâneo registra uma vez, inclusive após a baixa alterar o saldo.
q=equipe(vender('v-reenvio','ok',2));a=disputa(q,q)
assert all(x.returncode==0 for x in a)
assert sum('registrada' in x.stdout for x in a)==1 and sum('repetida' in x.stdout for x in a)==1
verificar(f"saldo_chave({u('ok')},null,'venda')=3 and (select count(*)=3 from operacoes where produto_id={u('ok')})")
# Pedidos de contagem por dois caixas compartilham a conferência.
a=disputa(equipe(vender('ped-a','d',7,acao='conferir')),equipe(vender('ped-b','d',7,'e','turno2','conferir')))
assert all(x.returncode==0 and 'bloqueada' in x.stdout for x in a)
verificar(f"saldo_chave({u('d')},null,'venda')=5 and (select count(*)=1 from conferencias where produto_id={u('d')})")
# Confirmação de divergência solicita depósito enquanto outra venda válida é registrada.
sql(equipe(vender('pedido-corr','concorre',7,acao='conferir')))
cf=sql(f"select id from conferencias where produto_id={u('concorre')} and area='venda'").stdout.strip()
sql(equipe(f"select funcionario_reposicao_contar(repeat('f',64),'{cf}',{u('concorre')},null,7,1)"))
a=disputa(equipe(f"select funcionario_reposicao_contar(repeat('f',64),'{cf}',{u('concorre')},null,7,2)"),equipe(vender('v-durante','concorre',2,'e','turno2')))
assert all(x.returncode==0 for x in a)
verificar(f"saldo_chave({u('concorre')},null,'venda')=3 and (select count(*)=1 from conferencias where produto_id={u('concorre')} and area='deposito')")
print('OK: quatro disputas entre conexões reais: dois caixas, mesmo envio, solicitação repetida e venda durante conferência; sem duplicação/deadlock.')
