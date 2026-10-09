import { describe, expect, it } from "vitest";
import { qtdUn } from "@/lib/deposito";
import { MODELOS, folhasA4, modeloPorId, posicaoNaFolha, precoEtiqueta, regraPagina } from "@/lib/etiqueta";

const a4 = modeloPorId("a4-21");

describe("etiquetas", () => {
  it("modelo desconhecido cai na térmica 50 × 30", () => {
    expect(modeloPorId("x").id).toBe("termica-50x30");
    expect(modeloPorId(null).id).toBe("termica-50x30");
  });
  it("as 21 etiquetas cabem dentro da folha A4 (210 × 297 mm)", () => {
    const ultima = posicaoNaFolha(a4, 20);
    expect(ultima.esq + a4.larg).toBeLessThanOrEqual(210);
    expect(ultima.topo + a4.alt).toBeLessThanOrEqual(297);
    expect(posicaoNaFolha(a4, 0)).toEqual({ esq: 7.25, topo: 15.15 });
    expect(posicaoNaFolha(a4, 4)).toEqual({ esq: 7.25 + 66, topo: 15.15 + 38.1 });
  });
  it("divide em folhas e pula as posições já usadas", () => {
    expect(folhasA4(a4, 5, 1)).toEqual([[0, 1, 2, 3, 4]]);
    const f = folhasA4(a4, 3, 20);
    expect(f.length).toBe(2);
    expect(f[0]!.slice(18)).toEqual([null, 0, 1]);
    expect(f[1]).toEqual([2]);
    expect(folhasA4(a4, 42, 1).length).toBe(2);
    expect(folhasA4(a4, 0, 1)).toEqual([]);
    expect(folhasA4(a4, 999, 1).flat().filter((x) => x != null).length).toBe(200);
  });
  it("página do tamanho real do papel", () => {
    expect(regraPagina(a4)).toBe("@page { size: A4 portrait; margin: 0; }");
    expect(regraPagina(MODELOS[1]!)).toBe("@page { size: 50mm 30mm; margin: 0; }");
  });
  it("preço com unidade quando não é por unidade", () => {
    expect(precoEtiqueta(349, "Unidade").replace(/\s/g, " ")).toBe("R$ 3,49");
    expect(precoEtiqueta(650, "Kg").replace(/\s/g, " ")).toBe("R$ 6,50 / Kg");
    expect(precoEtiqueta(5990, "Peça").replace(/\s/g, " ")).toBe("R$ 59,90");
  });
});

describe("quantidade com a unidade no plural", () => {
  it("fala como o comerciante", () => {
    expect(qtdUn(100, "Unidade")).toBe("100 unidades");
    expect(qtdUn(1, "Unidade")).toBe("1 unidade");
    expect(qtdUn(0, "Unidade")).toBe("0 unidades");
    expect(qtdUn(1.5, "Litro")).toBe("1,5 litro");
    expect(qtdUn(2, "Litro")).toBe("2 litros");
    expect(qtdUn(2.5, "Kg")).toBe("2,5 Kg");
    expect(qtdUn(3, "Par")).toBe("3 pares");
    expect(qtdUn(4, "m²")).toBe("4 m²");
    expect(qtdUn(48, "Pacote")).toBe("48 pacotes");
  });
});
