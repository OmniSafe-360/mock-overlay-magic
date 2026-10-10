"""Regressão HTTP: PostgREST real + PostgreSQL descartável, sem mocks de RPC."""
import json
import sys
import time
import urllib.error
import urllib.request
from uuid import UUID
from hashlib import md5

base, fase = sys.argv[1:]
assert base.startswith("http://127.0.0.1:"), "Somente a API local descartável"


def uid(tag):
    return str(UUID(md5(tag.encode()).hexdigest()))


def rpc(nome, chave="c", **params):
    req = urllib.request.Request(
        base + "/rpc/" + nome,
        data=json.dumps({"_chave": chave * 64, **params}).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


if fase == "antes":
    assert rpc("funcionario_inicio")[1]["caixa"] is True
    assert rpc("caixa_estado")[1]["turno"] is None
    for nome in ("caixa_produtos", "caixa_clientes_fiado"):
        status, erro = rpc(nome)
        assert status == 405 and erro["code"] == "25006", (nome, status, erro)
    print("OK: início e estado carregam; as duas consultas STABLE reproduzem 25006 pela API real.")
    sys.exit(0)

# NOTIFY recarrega o cache de esquema de forma assíncrona.
for _ in range(100):
    status, produtos = rpc("caixa_produtos")
    if status == 200:
        break
    assert produtos.get("code") == "25006", (status, produtos)
    time.sleep(0.1)
assert status == 200, produtos
assert {p["nome"] for p in produtos} == {"Nescau", "Queijo"}, produtos
nescau = next(p for p in produtos if p["nome"] == "Nescau")
queijo = next(p for p in produtos if p["nome"] == "Queijo")
assert nescau["preco"] == 10 and nescau["fracionado"] is False
assert queijo["preco"] == 20 and queijo["fracionado"] is True
assert {c["codigo"] for c in nescau["codigos"]} == {"7891000412855", "2900000000018", "sku-nescau"}
assert nescau["embalagens"] == [{"id": uid("cx-fardo"), "tipo": "Fardo", "quantidade": 12}]
assert rpc("caixa_estado")[1]["turno"] is None
assert rpc("caixa_clientes_fiado")[1] == [{"id": uid("cx-cliente"), "nome": "Cliente do mercado", "telefone": "11999999999"}]

# Outro comércio recebe apenas os seus produtos, variações e clientes.
status, roupas = rpc("caixa_produtos", "b")
assert status == 200 and len(roupas) == 1 and roupas[0]["nome"] == "Camiseta"
assert roupas[0]["variacoes"] == [{"id": uid("cx-var"), "nome": "M · Azul"}]
assert any(c["codigo"] == "cx-m-azul" and c["variacao_id"] == uid("cx-var") for c in roupas[0]["codigos"])
assert rpc("caixa_clientes_fiado", "b")[1][0]["nome"] == "Cliente da roupa"
# Sem produtos/clientes ainda: carrega listas vazias, sem erro e sem inventar dados.
assert rpc("caixa_produtos", "7") == (200, [])
assert rpc("caixa_clientes_fiado", "7") == (200, [])

# Chave, função Caixa, PIN e revogação continuam obrigatórios nas duas funções.
for chave, motivo in (("0", "acesso_encerrado"), ("d", "funcao_nao_permite_caixa"),
                      ("e", "pin_necessario"), ("f", "acesso_encerrado"), ("a", "acesso_encerrado")):
    for nome in ("caixa_produtos", "caixa_clientes_fiado"):
        status, erro = rpc(nome, chave)
        assert status in (401, 403) and erro["code"] == "42501" and erro["message"] == motivo, (nome, chave, status, erro)

# Abrir e retomar o mesmo turno não criam venda nem contagem de estoque.
status, aberto = rpc("caixa_abrir", _id=uid("cx-turno"), _troco=100)
assert status == 200 and aberto["situacao"] == "aberto" and aberto["turno"]["troco_inicial"] == 100
status, repetido = rpc("caixa_abrir", _id=uid("cx-outro-turno"), _troco=0)
assert status == 200 and repetido["situacao"] == "ja_aberto" and repetido["turno"]["id"] == uid("cx-turno")
assert rpc("caixa_estado")[1]["turno"]["id"] == uid("cx-turno")
assert rpc("caixa_estado")[1]["vendas"] == []
print("OK: carga, preços, frações, embalagens, códigos, variações, listas vazias, isolamento, 10 recusas de acesso e retomada do turno pela API real.")
