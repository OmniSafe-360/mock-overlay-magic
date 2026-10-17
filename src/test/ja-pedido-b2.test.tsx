/* B2 (checklist funcional 3): produto já num pedido em andamento não aparece como "Comprar"
   na lista de Produtos nem na aba Fornecedores — mostra "Já pedido", como o "Atenção hoje". */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Product, Supplier } from "@/components/ProductArea";
import { ListaProdutos } from "@/components/ListaProdutos";
import { PainelFornecedores } from "@/components/PainelFornecedores";
import { situacaoProduto } from "@/lib/situacao";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const sol: Supplier = { id: 1, nome: "Distribuidora Sol", tel: "11988887777", email: "", dbId: "a" };
const b = (id: number, nome: string, dep: number, ven: number): Product => ({
  id, codigo: String(id), nome, compra: 100, venda: 200, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: 1,
  deposito: { local: "A", qtd: dep, min: 10, max: null }, areaVenda: { local: "G", qtd: ven, min: 5, max: null }, db: { id: `p${id}` },
} as unknown as Product);
const arroz = b(1, "Arroz", 6, 12);   // hora de comprar
const feijao = b(2, "Feijão", 0, 0);  // acabou
const cafe = b(3, "Café", 40, 12);    // tudo certo
const pedidos = new Set(["p1", "p2"]);

describe("B2 — já pedido não aparece como Comprar", () => {
  it("situacaoProduto tira comprar/acabou e guarda o motivo", () => {
    const s = situacaoProduto(arroz, "mercado", "2026-10-17", { jaPedido: true });
    expect(s.alertas.some((a) => a.tipo === "comprar")).toBe(false);
    expect(s.aguardando).toBeTruthy();
    expect(["urgente", "atencao"]).not.toContain(s.nivel);
    expect(situacaoProduto(arroz, "mercado", "2026-10-17").alertas.some((a) => a.tipo === "comprar")).toBe(true);
  });
  it("lista de Produtos: 'Já pedido' e fora de Precisam de atenção", () => {
    render(<ListaProdutos products={[arroz, feijao, cafe]} tipo="mercado" suppliers={[sol]} jaPedidos={pedidos} onNew={() => {}} onOpen={() => {}} />);
    expect(screen.getAllByText("Já pedido · aguardando a entrega")).toHaveLength(2);
    expect(screen.queryByText(/hora de comprar/i)).toBeNull();
    const atencao = screen.getByRole("button", { name: /Precisam de atenção/ });
    expect(within(atencao).getByText("0")).toBeTruthy();
    fireEvent.click(atencao);
    expect(screen.queryByText("Arroz")).toBeNull();
  });
  it("sem pedido continua igual", () => {
    render(<ListaProdutos products={[arroz]} tipo="mercado" suppliers={[sol]} onNew={() => {}} onOpen={() => {}} />);
    expect(screen.queryByText("Já pedido · aguardando a entrega")).toBeNull();
  });
  it("Fornecedores: 'Já pedido' em vez de Comprar/Acabou e fora do 'para comprar'", () => {
    render(<PainelFornecedores products={[arroz, feijao, cafe]} tipo="mercado" suppliers={[sol]} jaPedidos={pedidos} onOpen={vi.fn()} onAdd={vi.fn(async () => 2)} onUpdate={vi.fn(async () => {})} />);
    const s = within(screen.getByRole("region", { name: "Distribuidora Sol" }));
    expect(s.queryByText(/para comprar/)).toBeNull();
    fireEvent.click(s.getByRole("button", { name: /produtos neste comércio/ }));
    expect(s.getAllByText("Já pedido")).toHaveLength(2);
    expect(s.queryByText("Comprar")).toBeNull();
    expect(s.queryByText("Acabou")).toBeNull();
  });
});
