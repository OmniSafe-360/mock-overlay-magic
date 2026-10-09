import { describe, expect, it } from "vitest";
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
