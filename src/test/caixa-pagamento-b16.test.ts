import { describe, it, expect } from "vitest";
import { situacaoPagamento } from "@/lib/caixa";
describe("B16 — venda diminuída depois do pagamento", () => {
  it("Pix acima do total não vira troco e não deixa finalizar", () => {
    const s = situacaoPagamento(800, [{ forma: "pix", valor: 1000 }]);
    expect(s.troco).toBe(0); expect(s.passou).toBe(200); expect(s.pronto).toBe(false);
  });
  it("dinheiro acima do total continua dando troco", () => {
    const s = situacaoPagamento(800, [{ forma: "dinheiro", valor: 1000 }]);
    expect(s.troco).toBe(200); expect(s.pronto).toBe(true);
  });
});
