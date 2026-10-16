/* O contador "N com resumo completo" do Início caía para 0 enquanto o painel atualizava. */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerApp } from "@/components/OwnerHome";
import type { Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";

const banco = vi.hoisted(() => ({
  carregarFornecedores: vi.fn(), carregarProdutos: vi.fn(), carregarPedidos: vi.fn(), conferirEnvio: vi.fn(),
  carregarVendas: vi.fn(), carregarPendentesVenda: vi.fn(), carregarDiferencas: vi.fn(),
  carregarLimiteFaltas: vi.fn(), carregarContagensAntifurto: vi.fn(), carregarCaixas: vi.fn(), carregarFuncionarios: vi.fn(),
}));
vi.mock("@/lib/banco", async (original) => ({ ...await original<object>(), ...banco }));
vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const arroz = {
  id: "p1", db: { id: "p1", contadas: ["deposito:_", "venda:_"] }, nome: "Arroz", codigo: "7891", unidade: "Unidade", categoria: "Mercearia",
  compra: 1000, venda: 1500, fornecedor: null, detalhes: {}, variacoes: [],
  deposito: { local: "A", qtd: 20, min: 5, max: 40 }, areaVenda: { local: "G", qtd: 10, min: 3, max: 12 },
} as unknown as Product;
const a: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado Alfa", cidade: "Bauru", uf: "SP", rua: "R", numero: "1", bairro: "C" };
const b: StoreData = { ...a, id: "c2", nome: "Mercado Beta" };
const lido = { produtos: [arroz], locais: { deposito: [], venda: [] } };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]);
  banco.carregarProdutos.mockResolvedValue(lido);
  banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]);
  banco.carregarPendentesVenda.mockResolvedValue([]);
  banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] });
  banco.carregarLimiteFaltas.mockResolvedValue(20000);
  banco.carregarContagensAntifurto.mockResolvedValue([]);
  banco.carregarCaixas.mockResolvedValue([]);
  banco.carregarFuncionarios.mockResolvedValue([]);
});

describe("contador do resumo durante o Atualizar", () => {
  it("não mostra '0 com resumo completo' enquanto atualiza e volta ao número certo depois", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await screen.findByText("2 comércios cadastrados · 2 com resumo completo");
    let terminar!: (v: unknown) => void;
    const pendente = new Promise((r) => { terminar = r; });
    banco.carregarProdutos.mockImplementation(() => pendente);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar painel" }));
    await screen.findByText("2 comércios cadastrados · atualizando resumo…");
    expect(screen.queryByText(/0 com resumo completo/)).toBeNull();
    await act(async () => { terminar(lido); });
    await waitFor(() => expect(screen.getByText("2 comércios cadastrados · 2 com resumo completo")).toBeTruthy());
  });
});
