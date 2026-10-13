import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerApp } from "@/components/OwnerHome";
import type { Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";

const banco = vi.hoisted(() => ({ carregarFornecedores: vi.fn(), carregarProdutos: vi.fn(), carregarPedidos: vi.fn(), conferirEnvio: vi.fn(), carregarVendas: vi.fn(), carregarPendentesVenda: vi.fn(), carregarDiferencas: vi.fn(), carregarLimiteFaltas: vi.fn(), carregarContagensAntifurto: vi.fn(), carregarCaixas: vi.fn(), carregarFuncionarios: vi.fn() }));
vi.mock("@/lib/banco", async (original) => ({ ...await original<object>(), ...banco }));
vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const p: Product = { id: "p1", db: { id: "p1", contadas: ["deposito:_", "venda:_"] }, nome: "Feijão", codigo: "7891", unidade: "Unidade", categoria: "Mercearia", compra: 1000, venda: 1500,
  fornecedor: null, detalhes: {}, variacoes: [], deposito: { local: "A", qtd: 20, min: 5, max: 40 }, areaVenda: { local: "G", qtd: 2, min: 3, max: 12 } } as Product;
const a: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado A", cidade: "Bauru", uf: "SP", rua: "R", numero: "1", bairro: "C" };
const b: StoreData = { ...a, id: "c2", nome: "Mercado B" };

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]); banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]); banco.carregarPendentesVenda.mockResolvedValue([]);
  banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] }); banco.carregarLimiteFaltas.mockResolvedValue(20000);
  banco.carregarContagensAntifurto.mockResolvedValue([]); banco.carregarCaixas.mockResolvedValue([]); banco.carregarFuncionarios.mockResolvedValue([]);
  banco.carregarProdutos.mockResolvedValue({ produtos: [p], locais: { deposito: [], venda: [] } });
});

describe("RMC-02C / C3-B — cartões que se reorganizam pela largura", () => {
  it("cartões financeiros quebram em linhas dentro do próprio contêiner e não cortam o valor", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    const r = within(await screen.findByRole("region", { name: "Resumo geral" }));
    for (const id of ["cartao-vendas", "cartao-faltou"]) {
      const c = r.getByTestId(id);
      expect(c.className).toMatch(/flex-wrap/);
      expect(c.className).toMatch(/@\[26rem\]:flex-nowrap/);
      expect(c.parentElement!.className).toMatch(/@container/);
      expect(c.className).not.toMatch(/truncate|overflow-hidden/);
      const status = within(c).getByTestId("status-cartao");
      expect(status.className).toMatch(/w-full/);
      expect(status.className).toMatch(/@\[26rem\]:w-auto/);
    }
    expect(r.getByRole("button", { name: /^Vendas hoje:/ })).toHaveTextContent(/Ver vendas/);
    expect(r.getByRole("button", { name: /^Faltou este mês:/ })).toHaveTextContent(/Ver antifurto/);
  });
  it("grade das pendências usa o espaço disponível: 1, 2 ou 4 colunas", async () => {
    banco.carregarProdutos.mockImplementation(async (id: string) => { if (id === "c2") throw new TypeError("x"); return { produtos: [p], locais: { deposito: [], venda: [] } }; });
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    const r = within(await screen.findByRole("region", { name: "Resumo geral" }));
    await waitFor(() => expect(r.getByRole("button", { name: /Para repor/ }).textContent).toMatch(/Subtotal: 1 de 2 comércios/));
    const g = r.getByTestId("grade-pendencias");
    expect(g.className).toMatch(/grid-cols-1/);
    expect(g.className).toMatch(/@\[18rem\]:grid-cols-2/);
    expect(g.className).toMatch(/@\[52rem\]:grid-cols-4/);
    expect(g.parentElement!.className).toMatch(/@container/);
    for (const n of ["Para resolver agora", "Para repor", "Para comprar", "Vencem em breve"]) expect(r.getByRole("button", { name: new RegExp(n) }).className).toMatch(/min-w-0/);
  });
});
