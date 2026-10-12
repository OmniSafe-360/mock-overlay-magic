import { describe, expect, it } from "vitest";
import { linkFiadoCliente, mensagemFiadoCompleta } from "@/lib/fiado";

describe("P3 — mensagem completa do fiado", () => {
  const movs = [
    { tipo: "compra" as const, valor: 2350, forma: null, vendaNumero: 41, criadoEm: "2026-10-10T21:42:00Z" },
    { tipo: "pagamento" as const, valor: 2000, forma: "pix" as const, vendaNumero: null, criadoEm: "2026-10-11T12:10:00Z" },
  ];
  it("traz total, data e hora, e o link", () => {
    const t = mensagemFiadoCompleta({ nome: "João Silva", deve: 8000, desde: "2026-09-01T12:00:00Z" }, "Mercado X", movs, "https://x/fiado/abc");
    expect(t).toContain("Olá, João!");
    expect(t).toContain("R$ 80,00");
    expect(t).toContain("Devendo desde 01/09/2026");
    expect(t).toContain("10/10 às 18:42 — Compra nº 41: + R$ 23,50");
    expect(t).toContain("Pagamento (pix): − R$ 20,00");
    expect(t).toContain("https://x/fiado/abc");
    expect(t.indexOf("Pagamento")).toBeLessThan(t.indexOf("Compra nº 41"));
  });
  it("conta em dia não fala em dívida", () => {
    expect(mensagemFiadoCompleta({ nome: "Ana", deve: 0, desde: null }, "M", [], "L")).toContain("está em dia");
  });
  it("link da página do cliente", () => {
    expect(linkFiadoCliente("tok", "https://app")).toBe("https://app/fiado/tok");
  });
});
