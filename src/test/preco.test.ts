import { describe, expect, it } from "vitest";
import { ganhoSobreCompra, lerPct, mostrarPct, vendaPorGanho } from "@/lib/preco";

describe("preço pela margem (em cima da compra)", () => {
  it("R$ 10,00 com 30% vira R$ 13,00", () => {
    expect(vendaPorGanho(1000, 30)).toBe(1300);
  });
  it("arredonda para o centavo mais próximo", () => {
    expect(vendaPorGanho(249, 40)).toBe(349); // 3,486 -> 3,49
    expect(vendaPorGanho(333, 33.3)).toBe(444); // 4,4389 -> 4,44
  });
  it("0% mantém o preço de compra", () => {
    expect(vendaPorGanho(1599, 0)).toBe(1599);
  });
  it("calcula o ganho a partir dos dois preços", () => {
    expect(ganhoSobreCompra(1000, 1300)).toBeCloseTo(30);
    expect(mostrarPct(ganhoSobreCompra(249, 349)!)).toBe("40,2");
    expect(ganhoSobreCompra(1000, 900)).toBeCloseTo(-10);
  });
  it("sem preço de compra não calcula", () => {
    expect(ganhoSobreCompra(0, 500)).toBeNull();
  });
  it("lê o % digitado: vírgula, uma casa e no máximo 3 dígitos", () => {
    expect(lerPct("30")).toEqual({ texto: "30", valor: 30 });
    expect(lerPct("33,35")).toEqual({ texto: "33,3", valor: 33.3 });
    expect(lerPct("12,")).toEqual({ texto: "12,", valor: 12 });
    expect(lerPct("1500")).toEqual({ texto: "150", valor: 150 });
    expect(lerPct("abc")).toEqual({ texto: "", valor: null });
    expect(lerPct("4.5%")).toEqual({ texto: "45", valor: 45 });
  });
});
