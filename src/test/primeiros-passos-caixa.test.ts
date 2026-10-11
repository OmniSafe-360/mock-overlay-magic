import { describe, it, expect } from "vitest";
import { caixaLigado } from "@/lib/primeirosPassos";
describe("C1 — Ligar o caixa só conta caixa ligado", () => {
  it("só código gerado não conta", () => expect(caixaLigado({ ligadoEm: null, desligadoEm: null })).toBe(false));
  it("desligado pelo dono não conta", () => expect(caixaLigado({ ligadoEm: "2026-10-10", desligadoEm: "2026-10-11" })).toBe(false));
  it("computador ligado conta", () => expect(caixaLigado({ ligadoEm: "2026-10-10", desligadoEm: null })).toBe(true));
  it("caixa do celular conta", () => expect(caixaLigado({ tipo: "celular", ligadoEm: null, desligadoEm: null })).toBe(true));
});
