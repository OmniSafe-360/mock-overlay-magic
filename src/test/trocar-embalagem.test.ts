import { describe, it, expect } from "vitest";
import { trocarEmbalagem, type LinhaPedido } from "@/lib/pedido";
const cx = { uid: "c", tipo: "Caixa", qtd: 12 } as any;
const fd = { uid: "f", tipo: "Fardo", qtd: 5 } as any;
const base = { chave: "k", p: { unidade: "Unidade", compra: 100 } as any, variacao: null } as const;
describe("B5 trocar embalagem", () => {
  it("2 caixas de 12 viram 24 unidades", () => {
    const r = trocarEmbalagem({ ...base, embalagem: cx, qtd: 2 } as LinhaPedido, null);
    expect(r.linha.qtd).toBe(24); expect(r.mudou).toBe(false);
  });
  it("24 unidades viram 2 caixas", () => {
    expect(trocarEmbalagem({ ...base, embalagem: null, qtd: 24 } as LinhaPedido, cx).linha.qtd).toBe(2);
  });
  it("avisa quando precisa arredondar", () => {
    const r = trocarEmbalagem({ ...base, embalagem: cx, qtd: 2 } as LinhaPedido, fd);
    expect(r.linha.qtd).toBe(5); expect(r.depois).toBe(25); expect(r.mudou).toBe(true);
  });
});
