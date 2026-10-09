import { describe, expect, it } from "vitest";
import type { Product } from "@/components/ProductArea";
import { escolhasDoUltimo } from "@/lib/ultimaEscolha";

const validas = { unidades: ["Unidade", "Kg"], categorias: ["Bebidas", "Mercearia"], fornecedores: [1, 2] };
const tiss: Product = {
  id: 1, codigo: "7896263503203", nome: "Refrigerante Tiss", compra: 249, venda: 349, unidade: "Unidade", categoria: "Bebidas",
  detalhes: { marca: "Tiss" }, variacoes: [], fornecedor: 2,
  deposito: { local: "Prateleira 2", qtd: 40, min: 10, max: 100 },
  areaVenda: { local: "Gôndola 1 lado direito", qtd: 40, min: 10, max: 120 },
  validade: { controla: true, avisos: [30, 90], dep: {}, ven: {} },
};

describe("lembrar a última escolha", () => {
  it("traz unidade, categoria, fornecedor, locais e validade do último produto", () => {
    expect(escolhasDoUltimo(tiss, validas)).toEqual({
      unidade: "Unidade", categoria: "Bebidas", fornecedor: 2,
      localDeposito: "Prateleira 2", localVenda: "Gôndola 1 lado direito",
      validade: { controla: true, avisos: [30, 90] },
    });
  });
  it("nunca traz código, nome, preços, detalhes ou quantidades", () => {
    const e = escolhasDoUltimo(tiss, validas) as Record<string, unknown>;
    for (const k of ["codigo", "nome", "compra", "venda", "detalhes", "qtd", "min", "max"]) expect(e).not.toHaveProperty(k);
  });
  it("primeiro produto do comércio começa vazio", () => {
    expect(escolhasDoUltimo(undefined, validas)).toEqual({});
  });
  it("ignora o que não vale mais (unidade/categoria de outro tipo, fornecedor que sumiu, local 'definir depois')", () => {
    const velho: Product = { ...tiss, unidade: "Peça", categoria: "Camisetas", fornecedor: 9,
      deposito: { local: null, qtd: 1, min: null, max: null }, areaVenda: undefined, validade: undefined };
    expect(escolhasDoUltimo(velho, validas)).toEqual({});
  });
  it("fornecedor 'definir depois' não é escolhido sozinho", () => {
    expect(escolhasDoUltimo({ ...tiss, fornecedor: null }, validas)).not.toHaveProperty("fornecedor");
  });
});
