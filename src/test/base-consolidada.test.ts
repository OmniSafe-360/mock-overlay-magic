import { describe, expect, it, vi } from "vitest";
import { enviarCadastro, montarFornecedores, montarPedido, montarProdutos, type Bruto } from "@/lib/persistencia";
import { ERRO_REGISTRO, registroEnvio } from "@/lib/envios";
import { situacaoProduto, porLocal } from "@/lib/situacao";
import { sugerirPedido } from "@/lib/pedido";

const bruto = (): Bruto => ({
  produtos: [{ id: "p1", nome: "Arroz", fornecedor_id: "f1", unidade: "Kg", categoria: "Mercearia", preco_compra: 10, preco_venda: 15, controla_validade: true }],
  variacoes: [], locais: [{ id: "L", nome: "Estante A" }],
  areas: [
    { produto_id: "p1", area: "deposito", local_id: "L", minimo: 2, maximo: 5 },
    { produto_id: "p1", area: "venda", local_id: null },
  ],
  contagens: [{ produto_id: "p1", area: "deposito", quantidade: 40 }, { produto_id: "p1", area: "venda", quantidade: 20 }],
  saldos: [
    { id: "s1", produto_id: "p1", area: "deposito", quantidade: "0.1", lote_id: "l1" },
    { id: "s2", produto_id: "p1", area: "deposito", quantidade: "0.2", lote_id: "l2" },
    { id: "s3", produto_id: "p1", area: "venda", quantidade: "1.5", lote_id: "l1" },
  ],
  lotes: [{ id: "l1", numero: "A", vencimento: "2027-01-01" }, { id: "l2", numero: "B", vencimento: "2027-02-01" }],
});
const fornecedores = () => montarFornecedores([{ id: "f1", nome: "Sol" }, { id: "f2", nome: "Lua" }]);

describe("mesmo produto e saldo em todos os módulos", () => {
  it("IDs e vínculo do fornecedor sobrevivem à reordenação", () => {
    const b = bruto(); const p2 = { ...b.produtos[0], id: "p2", fornecedor_id: "f2" };
    const antes = montarProdutos({ ...b, produtos: [...b.produtos, p2] }, fornecedores());
    const fs = [...fornecedores()].reverse();
    const depois = montarProdutos({ ...b, produtos: [p2, ...b.produtos] }, fs);
    expect(depois.find((p) => p.id === antes[0]!.id)?.fornecedor).toBe("f1");
    expect(depois.find((p) => p.id === "p2")?.fornecedor).toBe("f2");
    expect(montarPedido(depois[1]!, "op", "c1", fs).produto.fornecedor_id).toBe("f1");
  });
  it("ficha, local, validade e sugestão de compra usam o saldo atual, em milésimos", () => {
    const ps = montarProdutos(bruto(), fornecedores()); const p = ps[0]!;
    expect(p.deposito?.qtd).toBe(0.3); // A contagem inicial continua 40 no banco.
    expect(p.areaVenda?.qtd).toBe(1.5);
    expect(situacaoProduto(p, "mercado", "2026-10-09").qtd.total).toBe(1.8);
    expect(porLocal(ps, "dep", "2026-10-09").grupos[0]!.itens[0]!.qtd).toBe(0.3);
    expect(p.validade?.dep["_"]?.reduce((a, l) => a + Math.round(l.qtd * 1000), 0)).toBe(300);
    expect(sugerirPedido(ps, fornecedores(), new Set()).porFornecedor.get("f1")?.[0]?.qtd).toBe(4.7);
    expect(montarPedido(p, "op", "c1", fornecedores()).areas.every((a) => !("contagem" in a))).toBe(true);
  });
  it("saldo esgotado é zero; área ainda não contada continua null", () => {
    const b = bruto(); b.saldos = []; b.contagens = b.contagens.filter((c) => c.area === "deposito");
    const p = montarProdutos(b, fornecedores())[0]!;
    expect(p.deposito?.qtd).toBe(0);
    expect(p.areaVenda?.qtd).toBeNull();
    expect(situacaoProduto(p, "mercado", "2026-10-09").qtd.total).toBeNull();
  });
  it("roupas preserva variação não contada e não publica um total parcial", () => {
    const b = bruto(); b.produtos[0].unidade = "Peça";
    b.variacoes = [{ id: "v1", produto_id: "p1", tamanho: "M", cor: "Azul", qtd_informada: 10 }, { id: "v2", produto_id: "p1", tamanho: "G", cor: "Azul", qtd_informada: 8 }];
    b.areas = b.variacoes.map((v) => ({ produto_id: "p1", variacao_id: v.id, area: "deposito", local_id: "L" }));
    b.contagens = [{ produto_id: "p1", variacao_id: "v1", area: "deposito", quantidade: 10 }];
    b.saldos = [{ id: "s", produto_id: "p1", variacao_id: "v1", area: "deposito", quantidade: 3 }];
    const p = montarProdutos(b, fornecedores())[0]!;
    expect(p.deposito?.vars?.["v1"]?.qtd).toBe(3);
    expect(p.deposito?.vars?.["v2"]?.qtd).toBeNull();
    expect(situacaoProduto(p, "roupas", "2026-10-09").qtd.dep).toBeNull();
    const req = montarPedido(p, "op", "c1", fornecedores());
    expect(req.areas.every((a) => !("contagem" in a))).toBe(true);
  });
  it("fornecedor ausente não é removido silenciosamente do produto", () => {
    const p = montarProdutos(bruto(), fornecedores())[0]!;
    expect(() => montarPedido(p, "op", "c1", [])).toThrow("fornecedor_nao_encontrado");
  });
});

function armazenamento() {
  const dados = new Map<string, string>();
  return { dados, getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => { dados.set(k, v); }, removeItem: (k: string) => { dados.delete(k); } };
}
const pedido = { operacao_id: "op1", produto_pedido: { produto: { id: "p1", comercio_id: "c1", nome: "Arroz" } } };

describe("envio guardado antes de sair da tela", () => {
  it("grava antes do RPC e repete o pedido original depois de recarregar, sem duplicar", async () => {
    const storage = armazenamento(); const reg = registroEnvio("u1", "c1", "produto", storage);
    const gravados = new Set<string>();
    const rpc = vi.fn(async (p: object) => {
      expect(reg.ler()?.pedido).toEqual(p); // Já foi guardado antes de enviar.
      gravados.add((p as typeof pedido).operacao_id);
      if (rpc.mock.calls.length === 1) throw new TypeError("Failed to fetch");
      return { error: null };
    });
    await expect(enviarCadastro(reg.sessao("p1"), () => pedido, rpc)).rejects.toThrow("Failed to fetch");
    const novaSessao = registroEnvio("u1", "c1", "produto", storage).sessao("outro-produto");
    expect(novaSessao.dbId).toBe("p1");
    const montarNovo = vi.fn(() => ({ ...pedido, operacao_id: "op2" }));
    await expect(enviarCadastro(novaSessao, montarNovo, rpc)).resolves.toBe("anterior_gravado");
    expect(montarNovo).not.toHaveBeenCalled(); expect(gravados.size).toBe(1);
    expect(rpc.mock.calls[1]![0]).toEqual(rpc.mock.calls[0]![0]); expect(reg.ler()).toBeNull();
  });
  it("erro HTTP sem resposta útil mantém o pedido; recusa de negócio permite corrigir", async () => {
    const storage = armazenamento(); const reg = registroEnvio("u1", "c1", "produto", storage);
    await expect(enviarCadastro(reg.sessao("p1"), () => pedido, async () => ({ error: { code: "08006", message: "connection failure" } }))).rejects.toBeTruthy();
    expect(reg.ler()).not.toBeNull();
    const s = reg.sessao("p1");
    const rpc = vi.fn().mockResolvedValueOnce({ error: { code: "23514", message: "categoria_incompativel" } }).mockResolvedValueOnce({ error: null });
    await expect(enviarCadastro(s, () => ({ ...pedido, operacao_id: "op2" }), rpc)).resolves.toBe("gravado");
    expect(rpc.mock.calls[1]![0].operacao_id).toBe("op2"); expect(reg.ler()).toBeNull();
  });
  it("isola usuário, comércio e módulo", () => {
    const storage = armazenamento(); registroEnvio("u1", "c1", "produto", storage).sessao("p1").guardar!({ pedido });
    expect(registroEnvio("u2", "c1", "produto", storage).ler()).toBeNull();
    expect(registroEnvio("u1", "c2", "produto", storage).ler()).toBeNull();
    expect(registroEnvio("u1", "c1", "pedido", storage).ler()).toBeNull();
  });
  it("armazenamento cheio impede o primeiro envio", async () => {
    const storage = armazenamento(); storage.setItem = () => { throw new Error("QuotaExceededError"); };
    const rpc = vi.fn();
    await expect(enviarCadastro(registroEnvio("u1", "c1", "produto", storage).sessao("p1"), () => pedido, rpc)).rejects.toThrow(ERRO_REGISTRO);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("outra aba não sobrescreve nem limpa um pedido pendente", () => {
    const storage = armazenamento(); const reg = registroEnvio("u1", "c1", "produto", storage);
    const a = reg.sessao("p1"), b = reg.sessao("p2");
    a.guardar!({ pedido });
    expect(() => b.guardar!({ pedido: { outro: true } })).toThrow(ERRO_REGISTRO);
    expect(() => b.guardar!(null)).toThrow(ERRO_REGISTRO);
    expect(reg.ler()?.pedido).toEqual(pedido);
  });
  it("registro inválido não é descartado silenciosamente", () => {
    const storage = armazenamento(); const reg = registroEnvio("u1", "c1", "produto", storage);
    reg.sessao("p1").guardar!({ pedido });
    const k = [...storage.dados.keys()][0]!; storage.dados.set(k, "{inválido");
    expect(() => reg.sessao("novo")).toThrow(ERRO_REGISTRO);
    expect(storage.dados.get(k)).toBe("{inválido");
  });
  it("pedido guardado com comércio diferente é bloqueado antes de chegar ao servidor", () => {
    const storage = armazenamento(); const reg = registroEnvio("u1", "c1", "produto", storage);
    reg.sessao("p1").guardar!({ pedido: { ...pedido, produto_pedido: { produto: { id: "p1", comercio_id: "c2" } } } });
    expect(() => reg.ler()).toThrow(ERRO_REGISTRO);
  });
  it("erro genérico não comprova uma recusa e mantém o pedido original", async () => {
    const storage = armazenamento(); const reg = registroEnvio("u1", "c1", "produto", storage);
    await expect(enviarCadastro(reg.sessao("p1"), () => pedido, async () => ({ error: { message: "Unknown error" } }))).rejects.toBeTruthy();
    expect(reg.ler()?.pedido).toEqual(pedido);
  });
  it("sessão expirada conserva o envio até o mesmo usuário entrar novamente", async () => {
    const storage = armazenamento(); const reg = registroEnvio("u1", "c1", "produto", storage);
    await expect(enviarCadastro(reg.sessao("p1"), () => pedido, async () => ({ error: { code: "28000", message: "nao_autenticado" } }))).rejects.toBeTruthy();
    expect(reg.ler()?.pedido).toEqual(pedido);
  });
});
