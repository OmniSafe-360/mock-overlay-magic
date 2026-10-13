import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

describe("RMC-02C / C1 — clareza da visão global", () => {
  it("um comércio: cabeçalho global e contagem", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    const h = within(screen.getByRole("banner", { name: "Visão geral" }));
    expect(h.getByText("Visão geral dos seus comércios")).toBeTruthy();
    await waitFor(() => expect(h.getByText("1 comércio cadastrado · 1 com dados completos")).toBeTruthy());
  });
  it("vários comércios com vendas falhando em um: não conta como completo e mantém o aviso", async () => {
    banco.carregarVendas.mockImplementation(async (id: string) => { if (id === "c2") throw new TypeError("Failed to fetch"); return []; });
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/números podem estar incompletos/);
    expect(screen.getByText("2 comércios cadastrados · 1 com dados completos")).toBeTruthy();
  });
  it("seis indicadores mantêm títulos, valores e ações, com explicações", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    const r = within(await screen.findByRole("region", { name: "Resumo geral" }));
    await waitFor(() => expect(r.getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^1/));
    for (const t of ["Valor das vendas finalizadas hoje", "Faltas e perdas de mercadoria registradas no mês", "Pendências urgentes de vários tipos, não só produtos",
      "Produtos para repor na área de venda", "Produtos para comprar, fora os já pedidos", "Produtos com validade perto do fim"]) expect(r.getByText(t)).toBeTruthy();
    expect(screen.queryByText(/furto/i, { selector: "p" })).toBeNull();
    fireEvent.click(r.getByRole("button", { name: /Para repor/ }));
    expect(await screen.findAllByText(/Repor/)).toBeTruthy();
  });
  it("zero comércios: estado vazio e acesso à aba Comércios, sem cabeçalho global", () => {
    render(<OwnerApp userId="u1" owner="M" initial={[]} />);
    expect(screen.queryByText("Visão geral dos seus comércios")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ir para Comércios" }));
    expect(screen.getByRole("button", { name: /Adicionar comércio/ })).toBeTruthy();
  });
});
