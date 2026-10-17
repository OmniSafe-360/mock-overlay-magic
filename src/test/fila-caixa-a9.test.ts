import { describe, expect, it } from "vitest";
import { enviarFila, erroDefinitivo, filaCaixa, notaNaoAceitas, type VendaGuardada } from "@/lib/caixa";

// A9 (checklist funcional 3): recusas que tentar de novo não resolve não podem travar a fila do caixa.
const memoria = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const venda = (id: string, dinheiro = 0): VendaGuardada => ({
  venda: { id, turno_id: "t1", feita_em: "2026-10-17T12:00:00Z", itens: [{ produto_id: "p", qtd: 1, preco: 10 }],
    pagamentos: [dinheiro ? { forma: "dinheiro", valor: dinheiro } : { forma: "fiado", valor: 10 }] } as never,
  total: 1000, troco: 0, formas: "",
});

describe("A9 — fila do caixa não trava", () => {
  for (const codigo of ["turno_fechado", "cliente_fiado_bloqueado", "limite_fiado_excedido"]) {
    it(`${codigo}: a venda fica separada e as seguintes sobem`, async () => {
      const fila = filaCaixa("a9", memoria());
      fila.por(venda("v1")); fila.por(venda("v2", 10));
      const enviadas: string[] = [];
      await enviarFila(fila, async (v) => { if (v.venda.id === "v1") throw new Error(codigo); enviadas.push(v.venda.id); return null; });
      expect(enviadas).toEqual(["v2"]);
      const sobrou = fila.ler();
      expect(sobrou).toHaveLength(1);
      expect(sobrou[0]!.venda.id).toBe("v1");
      expect(sobrou[0]!.problema).toBeTruthy();
      expect(sobrou[0]!.problema).not.toMatch(/Tente de novo/);
      expect(notaNaoAceitas(sobrou)).toMatch(/1 venda não aceita/);
    });
  }
  it("sem internet e PIN vencido continuam na fila para tentar de novo", () => {
    expect(erroDefinitivo(new Error("Failed to fetch"))).toBe(false);
    expect(erroDefinitivo(new Error("pin_necessario"))).toBe(false);
    expect(erroDefinitivo(new Error("comercio_desativado"))).toBe(false);
  });
});
