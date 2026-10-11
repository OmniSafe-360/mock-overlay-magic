import { describe, expect, it } from "vitest";
import type { Product } from "@/components/ProductArea";
import { situacaoProduto } from "@/lib/situacao";

const HOJE = "2026-10-11";
const prod = (extra: Partial<Product> = {}): Product => ({
  id: 1, codigo: "7891234567895", nome: "Arroz", compra: 2000, venda: 2790, unidade: "Pacote", categoria: "Mercearia",
  detalhes: {}, variacoes: [], fornecedor: 1, ...extra,
});

describe("B15: produto usado só numa área", () => {
  it("só gôndola com 0: total 0 e entra em Acabou", () => {
    const s = situacaoProduto(prod({ deposito: undefined, areaVenda: { local: "G", qtd: 0, min: 2, max: null } }), "mercado", HOJE);
    expect(s.qtd.total).toBe(0);
    expect(s.alertas.some((a) => a.tipo === "acabou")).toBe(true);
  });
  it("só depósito com 7: total 7, não 'não contado'", () => {
    const s = situacaoProduto(prod({ deposito: { local: "A", qtd: 7, min: null, max: null }, areaVenda: undefined }), "mercado", HOJE);
    expect(s.qtd.total).toBe(7);
  });
  it("área usada mas sem contagem continua desconhecida", () => {
    const s = situacaoProduto(prod({ deposito: { local: "A", qtd: null, min: null, max: null }, areaVenda: { local: "G", qtd: 0, min: null, max: null } }), "mercado", HOJE);
    expect(s.qtd.total).toBeNull();
    expect(s.alertas.some((a) => a.tipo === "acabou")).toBe(false);
  });
});
