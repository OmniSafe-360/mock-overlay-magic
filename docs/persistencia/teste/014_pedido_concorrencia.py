"""R02: duas conexões PostgreSQL reais, exclusivamente no socket do banco descartável."""
import os
import hashlib
from pathlib import Path
import subprocess
import sys
import time
import uuid

socket, porta = sys.argv[1:]
assert socket.startswith("/tmp/omni-") and Path(socket, "dados/postmaster.pid").is_file(), "Use o banco descartável do roteiro."
cmd = ["psql", "-h", socket, "-p", porta, "-U", "postgres", "-d", "teste", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"]
base = Path(__file__).with_name("013_pedido_em_conferencia.sql").read_text()
fixture = base.split("select pg_temp.ok((pedido_publico")[0]
prefixo_execucao = "r02c-" + uuid.uuid4().hex


def executar(sql):
    r = subprocess.run(cmd, input=sql, text=True, capture_output=True, timeout=10)
    assert r.returncode == 0, r.stderr
    return r.stdout.strip()


def observar(nome, condicao, processo):
    limite = time.monotonic() + 4
    while time.monotonic() < limite:
        if executar(f"select count(*) from pg_stat_activity where application_name='{nome}' and {condicao};") == "1":
            return
        assert processo.poll() is None, "Conexão terminou antes do ponto esperado."
        time.sleep(0.01)
    raise AssertionError(f"Conexão {nome} não chegou ao ponto esperado: {condicao}")


def disputar(n, primeira, segunda, erro=None, primeiro_rollback=False, preparar_contagem=False):
    prefixo = f"{prefixo_execucao}-{n}-"
    chave = hashlib.sha256(prefixo.encode()).hexdigest()
    # Cada caso usa dados próprios; nunca toca nos comércios do piloto.
    dados = fixture.replace("'r02-'", f"'{prefixo}'").replace("repeat('a',64)", f"'{chave}'")
    codigo = 100000 + int(hashlib.md5(prefixo.encode()).hexdigest()[:8], 16) % 900000
    dados = dados.replace("'920012'", f"'{codigo}'")
    executar(dados + "\ncommit;")
    uid = lambda t: f"md5('{prefixo}{t}')::uuid"
    dono = f"select set_config('request.jwt.claim.sub',{uid('dono')}::text,true); set local role authenticated;"
    anon = "select set_config('request.jwt.claim.sub','',true); set local role anon;"
    abrir = f"select funcionario_abrir_recebimento('{chave}',{uid('rec')},{uid('pedido')},null);"
    concluir = f"select funcionario_enviar_recebimento('{chave}',{uid('rec')},0,jsonb_build_array(jsonb_build_object('produto_id',{uid('arroz')},'total',5)));"
    ajuste = "select responder_pedido(repeat('b',64),jsonb_build_object('aceito',true,'previsao_entrega',current_date,'itens',jsonb_build_array(jsonb_build_object('id',(pedido_publico(repeat('b',64))->'itens')->0->>'id','qtd_confirmada',3))));"
    # Tokens também são separados para cada pedido desta instância.
    token = hashlib.sha256(("token-" + prefixo).encode()).hexdigest()
    executar(f"update pedidos_compra set token='{token}' where id={uid('pedido')};")
    acoes = {
        "abrir": anon + abrir,
        "concluir": anon + concluir,
        "cancelar": dono + f"select cancelar_pedido({uid('pedido')});",
        "reenviar": dono + f"select marcar_pedido_enviado({uid('pedido')},'email');",
        "link": dono + f"select novo_link_pedido({uid('pedido')});",
        "responder": anon + "select responder_pedido(repeat('b',64),'{}'::jsonb);",
        "ajustar": anon + ajuste,
    }
    acoes = {k: v.replace("repeat('b',64)", f"'{token}'") for k, v in acoes.items()}
    if preparar_contagem:
        executar("begin;" + acoes["abrir"] + "commit;")
    nome1, nome2 = f"omni-r02-{n}-1", f"omni-r02-{n}-2"
    transacao = lambda acao, pausa, fim: "\\set VERBOSITY verbose\nbegin; set local statement_timeout='5s';" + acao + pausa + fim
    p1 = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env={**os.environ, "PGAPPNAME": nome1})
    p2 = None
    try:
        p1.stdin.write(transacao(acoes[primeira], "select pg_sleep(2);", "rollback;" if primeiro_rollback else "commit;"))
        p1.stdin.close(); p1.stdin = None
        observar(nome1, "wait_event='PgSleep'", p1)
        p2 = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env={**os.environ, "PGAPPNAME": nome2})
        p2.stdin.write(transacao(acoes[segunda], "", "commit;")); p2.stdin.close(); p2.stdin = None
        observar(nome2, "wait_event_type='Lock'", p2)
        _, err1 = p1.communicate(timeout=8)
        _, err2 = p2.communicate(timeout=8)
        assert p1.returncode == 0, err1
        if erro:
            estado = "42501" if erro == "link_invalido" else "23514"
            assert p2.returncode != 0 and f"{estado}: {erro}" in err2, err2
        else:
            assert p2.returncode == 0, err2
        # Sem efeito parcial: estado final, conta, quantidade e histórico precisam concordar.
        q = f"where id={uid('pedido')}"
        if primeira == "abrir" and not primeiro_rollback:
            assert executar(f"select situacao||':'||canal||':'||pagamento_situacao||':'||(qtd_confirmada::int)::text from pedidos_compra p join pedido_itens i on i.pedido_id=p.id where p.id={uid('pedido')};") == "aceito:copiado:a_pagar:5"
            assert executar(f"select token='{token}' from pedidos_compra {q};") == "t"
        elif primeira == "concluir":
            assert executar(f"select situacao||':'||pagamento_situacao from pedidos_compra {q};") == "recebido:a_pagar"
            assert executar(f"select saldo_chave({uid('arroz')},null,'deposito')::int||':'||(select count(*) from operacoes where comercio_id={uid('loja')})::text;") == "5:1"
        elif primeira in ("cancelar", "responder") or primeiro_rollback:
            esperado = "cancelado" if primeira == "cancelar" or primeiro_rollback else "recusado"
            assert executar(f"select situacao from pedidos_compra {q};") == esperado
            assert executar(f"select count(*) from recebimentos where pedido_id={uid('pedido')};") == "0"
        elif primeira == "ajustar":
            assert executar(f"select qtd_confirmada::int from pedido_itens where pedido_id={uid('pedido')};") == "3"
            resposta = executar("begin;" + anon + f"select funcionario_enviar_recebimento('{chave}',{uid('rec')},0,jsonb_build_array(jsonb_build_object('produto_id',{uid('arroz')},'total',3)))->>'situacao';commit;")
            assert resposta.splitlines()[-1] == "concluido", resposta
            assert executar(f"select saldo_chave({uid('arroz')},null,'deposito')::int;") == "3"
        elif primeira == "link":
            assert executar(f"select token<>'{token}' and situacao='aceito' from pedidos_compra {q};") == "t"
        if primeira != "concluir" and primeira != "ajustar":
            assert executar(f"select count(*) from operacoes where comercio_id={uid('loja')};") == "0"
        print(f"OK concorrência: {primeira} → {segunda}; esperou a transação e {'recusou '+erro if erro else 'prosseguiu com estado atual'}", flush=True)
    finally:
        for p in (p1, p2):
            if p is not None and p.poll() is None:
                p.kill(); p.communicate()


casos = [("abrir", acao, "recebimento_em_contagem", False, False) for acao in ("cancelar", "reenviar", "link", "responder")]
casos += [("concluir", acao, "pedido_fechado", False, True) for acao in ("cancelar", "reenviar", "link", "responder")]
casos += [("cancelar", "abrir", "pedido_fechado", False, False), ("responder", "abrir", "pedido_fechado", False, False),
          ("ajustar", "abrir", None, False, False), ("link", "responder", "link_invalido", False, False),
          ("abrir", "cancelar", None, True, False)]
for n, caso in enumerate(casos, 1):
    disputar(n, *caso)
print(f"OK: {len(casos)} disputas com duas conexões reais; sem deadlock, alteração parcial ou entrada duplicada.")
