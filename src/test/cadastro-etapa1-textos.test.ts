import { describe, expect, it } from "vitest";
import { avisoApresentacao, conversaoEmbalagem, umaUnidade, precoUnidade } from "@/lib/embalagem";

describe("Etapa 1 do cadastro — textos de unidade e conversão", () => {
  it("diz a qual unidade o preço se refere", () => {
    expect(umaUnidade("Unidade")).toBe("1 unidade");
    expect(umaUnidade("Kg")).toBe("1 Kg");
  });
  it("mostra a conversão só com a quantidade digitada", () => {
    expect(conversaoEmbalagem({ tipo: "Caixa", qtd: 6 }, "Unidade")).toBe("1 caixa = 6 unidades de venda");
    expect(conversaoEmbalagem({ tipo: "Saco", qtd: 25 }, "Kg")).toBe("1 saco = 25 Kg");
  });
  it("ovos: avisa quando '6 u' bate com caixa com 6, sem converter nada", () => {
    const embs = [{ tipo: "Caixa", qtd: 6 }];
    const a = avisoApresentacao("6 u", embs, "Unidade");
    expect(a).toMatch(/Confira/);
    expect(a).toMatch(/Por unidade/);
    expect(embs[0]!.qtd).toBe(6); // nada muda
  });
  it("não avisa quando os números diferem, sem texto ou fora de Unidade", () => {
    expect(avisoApresentacao("6 u", [{ tipo: "Caixa", qtd: 12 }], "Unidade")).toBe("");
    expect(avisoApresentacao("395 g", [{ tipo: "Caixa", qtd: 395 }], "Unidade")).toBe("");
    expect(avisoApresentacao(undefined, [{ tipo: "Caixa", qtd: 6 }], "Unidade")).toBe("");
    expect(avisoApresentacao("6 u", [{ tipo: "Caixa", qtd: 6 }], "Kg")).toBe("");
  });
  it("cálculo do custo pela embalagem não mudou", () => {
    expect(precoUnidade(1794, 6)).toBe(299);
  });
});
