"""Etapa 3: duas conexões reais. A abre e altera a embalagem sem confirmar; B cria pedido com ela.
B espera A; se A confirma o novo fator, B é recusado (embalagem_mudou) — nunca grava com o fator antigo.
Ordem inversa: B grava o pedido primeiro; A tenta mudar e é recusado (embalagem_em_uso)."""
import subprocess, sys, threading, time
psql = sys.argv[1:]
def run(sql, ok=True):
    r = subprocess.run(psql + ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-At", "-c", sql], capture_output=True, text=True)
    if ok and r.returncode: raise SystemExit("FALHOU: " + r.stderr)
    return r
U = "md5('cega-20261012-'||{})::uuid".format
COM, CC, DONO, F2 = U("'com'"), U("'cc'"), U("'dono'"), U("'forn2'")
run(f"""insert into fornecedores(id,dono_id,nome) values({U("'forn2'")},{U("'dono'")},'F');
insert into produtos(id,comercio_id,nome,unidade,preco_compra,preco_venda) values({U("'cc'")},{U("'com'")},'Conc','Unidade',1,2);
insert into produto_embalagens(id,comercio_id,produto_id,tipo,quantidade) values({U("'ccx'")},{U("'com'")},{U("'cc'")},'Caixa',6),({U("'ccy'")},{U("'com'")},{U("'cc'")},'Fardo',6);""")
def pedido(pid, emb, q):
    return f"insert into pedido_itens(pedido_id,comercio_id,produto_id,embalagem_id,qtd_embalagens,qtd_unidades) values({U(repr(pid))},{COM},{CC},{U(repr(emb))},9,{q})"
def criar_ped(pid):
    run(f"insert into pedidos_compra(id,comercio_id,fornecedor_id,numero,criado_por) values({U(repr(pid))},{COM},{F2},(select coalesce(max(numero),0)+1 from pedidos_compra),{DONO})")
criar_ped('p1'); criar_ped('p2')
# Caso 1: A altera primeiro e segura a transação; B (calculou 54 com o fator antigo) espera e é recusado.
res = {}
def a():
    res['a'] = run(f"begin; update produto_embalagens set quantidade=12 where id={U("'ccx'")}; select pg_sleep(1.5); commit;", ok=False)
t = threading.Thread(target=a); t.start(); time.sleep(0.5)
t0 = time.time(); rb = run(pedido('p1', 'ccx', 54), ok=False); esperou = time.time() - t0; t.join()
assert res['a'].returncode == 0, res['a'].stderr
assert rb.returncode != 0 and 'embalagem_mudou' in rb.stderr, rb.stderr
assert esperou > 0.7, f"B não esperou A ({esperou:.2f}s)"
# Caso 2: B grava o pedido e segura; A tenta mudar, espera e é recusado.
def b():
    res['b'] = run(f"begin; {pedido('p2', 'ccy', 54)}; select pg_sleep(1.5); commit;", ok=False)
t = threading.Thread(target=b); t.start(); time.sleep(0.5)
ra = run(f"update produto_embalagens set quantidade=12 where id={U("'ccy'")}", ok=False); t.join()
assert res['b'].returncode == 0, res['b'].stderr
assert ra.returncode != 0 and 'embalagem_em_uso' in ra.stderr, ra.stderr
q = run(f"select quantidade from produto_embalagens where id={U("'ccy'")}").stdout.strip()
assert q in ('6', '6.000', '6.0'), q
print("OK: 017 concorrência (2 cenários, conexões reais)")
