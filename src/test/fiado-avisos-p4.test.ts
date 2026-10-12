import { describe, expect, it } from "vitest";
import { avisosFiado } from "@/lib/fiadoCliente";

const mov = (tipo: string, valor: number, criadoEm: string) => ({ tipo, valor, forma: null, criadoEm, vendaNumero: null, itens: [] });
const agora = Date.parse("2026-10-12T12:00:00Z");
const n = (s: string) => s.replace(/\u00a0/g, " ");

describe("P4 — avisos da página do cliente", () => {
  it("primeira visita não mostra novidades", () => {
    expect(avisosFiado({ deve: 10, desde: "2026-10-10T00:00:00Z", movimentos: [mov("compra", 10, "2026-10-11T00:00:00Z")] }, null, agora)).toEqual([]);
  });
  it("compras e pagamentos novos desde a última visita", () => {
    const a = avisosFiado({ deve: 50, desde: "2026-10-01T00:00:00Z", movimentos: [
      mov("compra", 30, "2026-10-11T10:00:00Z"), mov("compra", 20, "2026-10-11T11:00:00Z"),
      mov("pagamento", 15, "2026-10-11T12:00:00Z"), mov("compra", 99, "2026-10-05T00:00:00Z"),
    ] }, "2026-10-10T00:00:00Z", agora);
    expect(n(a[0].texto)).toBe("2 compras novas desde a sua última visita: R$ 50,00.");
    expect(n(a[1].texto)).toBe("Pagamento recebido: R$ 15,00. Obrigado!");
    expect(a).toHaveLength(2);
  });
  it("dívida com mais de 30 dias avisa; com 30 ou menos não", () => {
    expect(avisosFiado({ deve: 10, desde: "2026-09-01T12:00:00Z", movimentos: [] }, null, agora)[0].texto).toContain("41 dias");
    expect(avisosFiado({ deve: 10, desde: "2026-09-12T12:00:00Z", movimentos: [] }, null, agora)).toEqual([]);
    expect(avisosFiado({ deve: 0, desde: "2026-01-01T00:00:00Z", movimentos: [] }, null, agora)).toEqual([]);
  });
});
