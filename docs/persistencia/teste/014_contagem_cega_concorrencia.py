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

# Dois celulares tentam iniciar a mesma contagem com IDs diferentes.
r=disputa(equipe(contar('corr-a','g',3)),equipe(contar('corr-b','g',3)))
assert sorted(x.returncode==0 for x in r)==[False,True]
assert 'contagem_em_andamento' in ''.join(x.stderr for x in r)
id_cf=sql(f"select id from conferencias where produto_id={u('g')} and area='venda'").stdout.strip()
verificar(f"(select count(*)=1 from conferencias where produto_id={u('g')})")
# Reenvios simultâneos da mesma segunda rodada criam uma única pendência.
q=equipe(f"select funcionario_reposicao_contar(repeat('f',64),'{id_cf}',{u('g')},null,3,2)")
r=disputa(q,q);assert all(x.returncode==0 and 'aguardando_dono' in x.stdout for x in r)
verificar(f"saldo_chave({u('g')},null,'venda')=0 and (select count(*)=1 from diferencas where produto_id={u('g')})")
# Dois envios da decisão do dono ajustam o estoque apenas uma vez.
dif=sql(f"select id from diferencas where produto_id={u('g')}").stdout.strip()
q=dono(f"select resolver_conferencia('{dif}',3)")
r=disputa(q,q);assert sum(x.returncode==0 for x in r)==1
assert 'contagem_ja_resolvida' in ''.join(x.stderr for x in r)
verificar(f"saldo_chave({u('g')},null,'venda')=3 and (select count(*)=3 from operacoes where produto_id={u('g')})")
# Dois 'Coloquei' com o mesmo ID transferem apenas uma vez.
sql(equipe(contar('corr-ok','ok',0)))
r=disputa(equipe(concluir('corr-ok',5)),equipe(concluir('corr-ok',5)))
assert all(x.returncode==0 for x in r)
verificar(f"saldo_chave({u('ok')},null,'venda')=5 and saldo_chave({u('ok')},null,'deposito')=15 and (select count(*)=3 from operacoes where produto_id={u('ok')})")
# Duas reposições distintas respeitam o espaço que resta na gôndola.
sql(f"update produto_areas set maximo=5,minimo=1 where produto_id={u('concorre')} and area='venda'")
sql(equipe(contar('cap-a','concorre',0)));sql(equipe(contar('cap-b','concorre',0)))
r=disputa(equipe(concluir('cap-a',5)),equipe(concluir('cap-b',5)))
assert sum(x.returncode==0 for x in r)==1
assert 'reposicao_acima_maximo' in ''.join(x.stderr for x in r)
verificar(f"saldo_chave({u('concorre')},null,'venda')=5 and saldo_chave({u('concorre')},null,'deposito')=5 and (select count(*)=3 from operacoes where produto_id={u('concorre')})")
# Decisão e nova contagem concorrentes: ou recebe bloqueio, ou começa com saldo já decidido.
sql(equipe(contar('decisao','tres',2)));sql(equipe(contar('decisao','tres',2,2)))
dif=sql(f"select id from diferencas where produto_id={u('tres')}").stdout.strip()
r=disputa(dono(f"select resolver_conferencia('{dif}',2)"),equipe(contar('decisao-nova','tres',0)))
assert all(x.returncode==0 for x in r)
assert 'aguardando_dono' in r[1].stdout or 'recontar' in r[1].stdout
verificar(f"saldo_chave({u('tres')},null,'venda')=2 and (select count(*)=1 from diferencas where produto_id={u('tres')})")
print('OK: seis disputas reais entre conexões, sem ajuste/transferência duplicados ou contorno do bloqueio.')
