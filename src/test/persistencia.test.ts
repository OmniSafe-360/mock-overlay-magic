import { describe, expect, it } from "vitest";
import type { Product } from "@/components/ProductArea";
import { mensagemErro, montarPedido, montarProdutos, pedidosPendencias } from "@/lib/persistencia";

const base = (extra: Partial<Product> = {}): Product => ({
  id: 1, codigo: "789", nome: "Arroz", compra: 1050, venda: 1599, unidade: "Kg", categoria: "Mercearia", detalhes: { marca: "Camil", peso: "" },
  variacoes: [], fornecedor: null, deposito: { local: "Corredor 1", qtd: 1.5, min: 1, max: 9 }, areaVenda: { local: null, qtd: 0, min: null, max: null },
  validade: { controla: true, avisos: [30], dep: { _: [{ id: "l1", qtd: 1.5, data: "2026-12-10", lote: "A1" }] }, ven: {} },
  db: { id: "p1", contadas: [] }, ...extra,
});

describe("pedido de salvamento", () => {
  it("converte centavos e guarda 1,5 como 1.5", () => {
    const r = montarPedido(base(), "op1", "c1", []);
    expect(r.produto.preco_compra).toBe(10.5);
    expect(r.produto.preco_venda).toBe(15.99);
    expect((r.areas[0] as any).contagem.quantidade).toBe(1.5);
    expect((r.areas[0] as any).contagem.partes).toEqual([{ numero: "A1", vencimento: "2026-12-10", quantidade: 1.5, confirmada: false }]);
  });
  it("zero é contagem registrada, sem partes", () => {
    const r = montarPedido(base(), "op1", "c1", []);
    expect((r.areas[1] as any).contagem).toEqual({ quantidade: 0, partes: [] });
  });
  it("editar não envia de novo a contagem inicial", () => {
    const r = montarPedido(base({ db: { id: "p1", contadas: ["deposito:_", "venda:_"] } }), "op2", "c1", []);
    expect(r.areas.every((a) => !("contagem" in a))).toBe(true);
  });
  it("repetir o envio usa a mesma identificação e o mesmo conteúdo", () => {
    expect(montarPedido(base(), "op1", "c1", [])).toEqual(montarPedido(base(), "op1", "c1", []));
  });
  it("Definir depois não cria área", () => {
    const r = montarPedido(base({ areaVenda: undefined }), "op1", "c1", []);
    expect(r.areas.map((a) => a["area"])).toEqual(["deposito"]);
  });
});

describe("pendências", () => {
  const antes = { controla: true, avisos: [], dep: { _: [{ id: "s1", qtd: 10, data: null, lote: null }] }, ven: {} };
  it("dividir envia as partes da pendência de origem", () => {
    const depois = { ...antes, dep: { _: [{ id: "s1", qtd: 6, data: "2026-11-01", lote: null }, { id: "n2", qtd: 4, data: null, lote: null, origem: "s1" }] } };
    expect(pedidosPendencias(antes, depois, false)).toEqual([{ origem: "s1", precisaConfirmar: false, partes: [
      { numero: null, vencimento: "2026-11-01", quantidade: 6, confirmada: false }, { numero: null, vencimento: null, quantidade: 4, confirmada: false }] }]);
  });
  it("sem mudança não envia nada", () => {
    expect(pedidosPendencias(antes, antes, false)).toEqual([]);
  });
});

describe("carregar", () => {
  it("monta o produto só com os dados recebidos, zero diferente de não contado", () => {
    const ps = montarProdutos({
      produtos: [{ id: "p1", codigo_barras: "789", nome: "Arroz", preco_compra: "10.50", preco_venda: 15.99, unidade: "Kg", categoria: "Mercearia", detalhes: {}, controla_validade: null, avisos_dias: [] }],
      variacoes: [], locais: [{ id: "L", nome: "Corredor 1" }],
      areas: [{ produto_id: "p1", area: "deposito", variacao_id: null, local_id: "L", minimo: null, maximo: "9" }, { produto_id: "p1", area: "venda", variacao_id: null, local_id: null, minimo: null, maximo: null }],
      contagens: [{ produto_id: "p1", area: "deposito", variacao_id: null, quantidade: "0" }], saldos: [], lotes: [],
    }, []);
    expect(ps[0]!.compra).toBe(1050);
    expect(ps[0]!.deposito).toEqual({ local: "Corredor 1", qtd: 0, min: null, max: 9 });
    expect(ps[0]!.areaVenda?.qtd).toBeNull();
    expect(ps[0]!.validade).toBeUndefined();
    expect(ps[0]!.db?.contadas).toEqual(["deposito:_"]);
  });
});

it("erros do banco viram mensagens em português", () => {
  expect(mensagemErro({ message: "codigo_em_uso: 789" })).toBe("Este código de barras já está cadastrado neste comércio.");
  expect(mensagemErro(new TypeError("Failed to fetch"))).toMatch(/Sem conexão/);
});
