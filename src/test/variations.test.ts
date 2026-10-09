import { describe, expect, it } from "vitest";
import { mainCodeError, usedCodes, variationErrors } from "@/lib/variations";

const others = [{ id: 1, codigo: "111", variacoes: [{ tam: "P", cor: "Azul", codigo: "222" }] }];

describe("variações da loja de roupas", () => {
  it("exige código de barras", () => {
    expect(variationErrors({ tam: "P", cor: "Azul", codigo: "" }, -1, [], "999", new Set()).codigo).toBeTruthy();
  });
  it("bloqueia tamanho + cor repetidos ignorando maiúsculas e espaços", () => {
    const vars = [{ tam: "M", cor: "Azul", codigo: "1" }];
    expect(variationErrors({ tam: "M", cor: " azul ", codigo: "2" }, -1, vars, "9", new Set()).combo).toBeTruthy();
  });
  it("código diferente do principal", () => {
    expect(variationErrors({ tam: "P", cor: "X", codigo: "9" }, -1, [], "9", new Set()).codigo).toBeTruthy();
  });
  it("bloqueia código repetido entre variações do produto", () => {
    const vars = [{ tam: "P", cor: "A", codigo: "5" }];
    expect(variationErrors({ tam: "M", cor: "A", codigo: "5" }, -1, vars, "9", new Set()).codigo).toBeTruthy();
  });
  it("bloqueia código de outro produto do comércio (principal ou variação)", () => {
    const used = usedCodes(others);
    expect(variationErrors({ tam: "M", cor: "A", codigo: "222" }, -1, [], "9", used).codigo).toBeTruthy();
    expect(mainCodeError("222", used)).toBeTruthy();
  });
  it("na edição permite manter o próprio código", () => {
    const vars = [{ tam: "P", cor: "Azul", codigo: "222" }];
    const used = usedCodes(others, 1);
    expect(variationErrors(vars[0]!, 0, vars, "111", used)).toEqual({});
    expect(mainCodeError("111", used)).toBe("");
  });
  it("outro comércio pode usar o mesmo código", () => {
    expect(variationErrors({ tam: "P", cor: "A", codigo: "222" }, -1, [], "9", usedCodes([])).codigo).toBeUndefined();
  });
});
