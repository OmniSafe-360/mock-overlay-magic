/* B4 (checklist funcional 3): "Novo pedido" sugere os mesmos produtos dos quadros "Comprar" e "Acabaram"
   do "Atenção hoje", nos dois sentidos. */
import { describe, expect, it } from "vitest";
import type { Product, Supplier } from "@/components/ProductArea";
import { sugerirPedido } from "@/lib/pedido";
import { atencaoHoje } from "@/lib/situacao";

const sol: Supplier = { id: 1, nome: "Sol", tel: "", email: "", dbId: "f" };
let n = 0;
const b = (nome: string, extra: Partial<Product>): Product => ({
  id: ++n, codigo: String(n), nome, compra: 100, venda: 200, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: 1,
  db: { id: `p${n}`, contadas: [] }, deposito: { local: "A", qtd: 40, min: 10, max: 60 }, areaVenda: { local: "G", qtd: 12, min: 5, max: 20 }, ...extra,
} as Product);

// depósito vazio sem mínimo, gôndola com 12: não é "Comprar" nem "Acabaram"
const semMinimo = b("Depósito vazio sem mínimo", { deposito: { local: "A", qtd: 0, min: null, max: null } });
// sem área de depósito e acabou: está em "Acabaram"
const soGondola = b("Só gôndola acabou", { deposito: undefined, areaVenda: { local: "G", qtd: 0, min: 5, max: 20 } });
// no mínimo do depósito: "Comprar"
const comprar = b("No mínimo", { deposito: { local: "A", qtd: 8, min: 10, max: 60 } });
// tudo zerado: "Acabaram"
const acabou = b("Acabou", { deposito: { local: "A", qtd: 0, min: 5, max: 30 }, areaVenda: { local: "G", qtd: 0, min: 2, max: 10 } });
const ok = b("Tudo certo", {});
const todos = [semMinimo, soGondola, comprar, acabou, ok];

describe("B4 — Novo pedido = Comprar + Acabaram", () => {
  it("os mesmos produtos nos dois lugares", () => {
    const s = sugerirPedido(todos, [sol], new Set());
    const sugeridos = new Set((s.porFornecedor.get(1) ?? []).map((l) => l.p.nome));
    const grupos = atencaoHoje(todos, "mercado", "2026-10-17");
    const noQuadro = new Set(grupos.filter((g) => g.tipo === "comprar" || g.tipo === "acabou").flatMap((g) => g.itens.map((i) => i.p.nome)));
    expect([...sugeridos].sort()).toEqual([...noQuadro].sort());
    expect([...sugeridos].sort()).toEqual(["Acabou", "No mínimo", "Só gôndola acabou"]);
  });
  it("sem área de depósito, a quantidade vem da área de venda", () => {
    const l = sugerirPedido([soGondola], [sol], new Set()).porFornecedor.get(1)![0]!;
    expect(l.qtd).toBe(20);
  });
});
