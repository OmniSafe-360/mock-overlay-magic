import { describe, expect, it } from "vitest";
import { descricaoEmbalagem, errosEmbalagem, lerQtdEmbalagem, perguntaQtd, precoUnidade, rotuloFechadas, rotuloSoltas, totalContado, type Embalagem } from "@/lib/embalagem";

const cx: Embalagem = { uid: "a", tipo: "Caixa", qtd: 12, codigo: "17896263503200", preco: 3000 };

describe("embalagens", () => {
  it("descreve a embalagem do jeito que o comerciante fala", () => {
    expect(descricaoEmbalagem(cx, "Unidade")).toBe("Caixa com 12");
    expect(descricaoEmbalagem({ tipo: "Saco", qtd: 25.5 }, "Kg")).toBe("Saco com 25,5 Kg");
    expect(perguntaQtd("Unidade")).toBe("Quantas unidades vêm dentro?");
    expect(perguntaQtd("Kg")).toBe("Quanto vem dentro? (em Kg)");
  });
  it("calcula o preço de compra da unidade: R$ 30,00 ÷ 12 = R$ 2,50", () => {
    expect(precoUnidade(3000, 12)).toBe(250);
    expect(precoUnidade(1000, 3)).toBe(333);
    expect(precoUnidade(0, 12)).toBe(0);
  });
  it("lê a quantidade conforme a unidade", () => {
    expect(lerQtdEmbalagem("12", "Unidade")).toEqual({ v: 12, err: "" });
    expect(lerQtdEmbalagem("25,5", "Kg")).toEqual({ v: 25.5, err: "" });
    expect(lerQtdEmbalagem("1,5", "Unidade").err).toMatch(/inteiro/);
    expect(lerQtdEmbalagem("", "Unidade").err).toBe("Informe quanto vem dentro.");
    expect(lerQtdEmbalagem("0", "Unidade").err).toMatch(/maior que zero/);
    expect(lerQtdEmbalagem("1", "Unidade").err).toMatch(/Por unidade/);
    expect(lerQtdEmbalagem("1", "Kg")).toEqual({ v: 1, err: "" });
  });
  it("não deixa repetir embalagem nem código", () => {
    const usados = new Set(["7891000100103"]);
    expect(errosEmbalagem({ tipo: "Caixa", qtd: 12, codigo: "" }, -1, [cx], "789", usados).repetida).toBeTruthy();
    expect(errosEmbalagem({ tipo: "Caixa", qtd: 12, codigo: "" }, 0, [cx], "789", usados)).toEqual({});
    expect(errosEmbalagem({ tipo: "Fardo", qtd: 72, codigo: "789" }, -1, [cx], "789", usados).codigo).toMatch(/diferente do código do produto/);
    expect(errosEmbalagem({ tipo: "Fardo", qtd: 72, codigo: cx.codigo }, -1, [cx], "789", usados).codigo).toMatch(/Outra embalagem/);
    expect(errosEmbalagem({ tipo: "Fardo", qtd: 72, codigo: "7891000100103" }, -1, [cx], "789", usados).codigo).toBe("Este código já está cadastrado");
  });
});


describe("contar por embalagem no depósito", () => {
  const cx = { qtd: 12 }, fd = { qtd: 72 };
  it("5 caixas de 12 + 3 soltas = 63", () => {
    expect(totalContado([{ e: cx, fechadas: "5" }], "3", "Unidade")).toEqual({ total: 63, err: "" });
  });
  it("soma caixas e fardos; campo vazio conta zero", () => {
    expect(totalContado([{ e: cx, fechadas: "2" }, { e: fd, fechadas: "1" }], "", "Unidade")).toEqual({ total: 96, err: "" });
    expect(totalContado([{ e: cx, fechadas: "" }], "7", "Unidade")).toEqual({ total: 7, err: "" });
    expect(totalContado([{ e: cx, fechadas: "0" }], "0", "Unidade")).toEqual({ total: 0, err: "" });
  });
  it("tudo vazio = ainda não contou", () => {
    expect(totalContado([{ e: cx, fechadas: "" }], "", "Unidade")).toEqual({ total: null, err: "" });
  });
  it("produto por Kg: 2 sacos de 25,5 + 3,25 soltos = 54,25", () => {
    expect(totalContado([{ e: { qtd: 25.5 }, fechadas: "2" }], "3,25", "Kg")).toEqual({ total: 54.25, err: "" });
  });
  it("recusa caixa quebrada e soltas inválidas", () => {
    expect(totalContado([{ e: cx, fechadas: "1,5" }], "", "Unidade").err).toMatch(/inteiro/);
    expect(totalContado([{ e: cx, fechadas: "1" }], "2,5", "Unidade").err).toMatch(/inteiro/);
    expect(totalContado([{ e: cx, fechadas: "-1" }], "", "Unidade").err).toMatch(/inteiro/);
  });
  it("rótulos", () => {
    expect(rotuloFechadas({ tipo: "Caixa", qtd: 12 }, "Unidade")).toBe("Caixas com 12 fechadas");
    expect(rotuloFechadas({ tipo: "Fardo", qtd: 72 }, "Unidade")).toBe("Fardos com 72 fechados");
    expect(rotuloFechadas({ tipo: "Saco", qtd: 25.5 }, "Kg")).toBe("Sacos com 25,5 Kg fechados");
    expect(rotuloSoltas("Unidade")).toBe("Unidades soltas");
    expect(rotuloSoltas("Kg")).toBe("Soltos (em Kg)");
  });
});
