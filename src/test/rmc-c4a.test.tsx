import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerApp } from "@/components/OwnerHome";
import type { Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";

const banco = vi.hoisted(() => ({
  carregarFornecedores: vi.fn(), carregarProdutos: vi.fn(), carregarPedidos: vi.fn(), conferirEnvio: vi.fn(),
  carregarVendas: vi.fn(), carregarPendentesVenda: vi.fn(), carregarDiferencas: vi.fn(), carregarLimiteFaltas: vi.fn(),
  carregarContagensAntifurto: vi.fn(), carregarCaixas: vi.fn(), carregarFuncionarios: vi.fn(),
}));
vi.mock("@/lib/banco", async (original) => ({ ...await original<object>(), ...banco }));
vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const produto: Product = {
  id: "p1", db: { id: "p1", contadas: ["deposito:_", "venda:_"] },
  nome: "Feijão", codigo: "7891", unidade: "Unidade", categoria: "Mercearia",
  compra: 1000, venda: 1500, fornecedor: null, detalhes: {}, variacoes: [],
  deposito: { local: "A", qtd: 20, min: 5, max: 40 },
  areaVenda: { local: "G", qtd: 2, min: 3, max: 12 },
} as Product;
const mercado: StoreData = {
  id: "c1", tipo: "mercado", nome: "Mercado A", cidade: "Bauru", uf: "SP",
  rua: "R", numero: "1", bairro: "C",
};
const mercadoB: StoreData = { ...mercado, id: "c2", nome: "Mercado B" };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]);
  banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]);
  banco.carregarPendentesVenda.mockResolvedValue([]);
  banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] });
  banco.carregarLimiteFaltas.mockResolvedValue(20000);
  banco.carregarContagensAntifurto.mockResolvedValue([]);
  banco.carregarCaixas.mockResolvedValue([]);
  banco.carregarFuncionarios.mockResolvedValue([]);
  banco.carregarProdutos.mockResolvedValue({ produtos: [produto], locais: { deposito: [], venda: [] } });
});

describe("RMC-04 / C4-A — hierarquia e clareza da situação global", () => {
  it("mostra Vendas, depois Pendências, depois Faltou este mês, sem mudar nomes ou valores", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[mercado]} />);
    const regiao = within(await screen.findByRole("region", { name: "Resumo geral" }));
    expect(regiao.getByRole("heading", { level: 2 }).textContent).toBe("Situação dos comércios");
    const grupos = regiao.getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
    expect(grupos[0]).toMatch(/^Resultado de hoje/);
    expect(grupos[1]).toBe("Pendências que precisam de atenção");
    expect(grupos[2]).toMatch(/^Resultado deste mês/);
    const conteudo = regiao.getByRole("button", { name: /^Faltou este mês:/ }).textContent ?? "";
    expect(conteudo).toContain("Valor das faltas identificadas nas diferenças do estoque neste mês");
    expect(conteudo).not.toContain("Faltas e perdas de mercadoria registradas no mês");
    await waitFor(() => expect(regiao.getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^1/));
    expect(regiao.getByRole("button", { name: /^Vendas hoje:/ }).textContent).toContain("R$");
    expect(regiao.getByRole("button", { name: /^Faltou este mês:/ }).textContent).toContain("R$");
  });

  it("mantém subtotal e acesso a Alertas quando um comércio falha", async () => {
    banco.carregarProdutos.mockImplementation(async (id: string) => {
      if (id === "c2") throw new TypeError("falha de consulta");
      return { produtos: [produto], locais: { deposito: [], venda: [] } };
    });
    render(<OwnerApp userId="u1" owner="M" initial={[mercado, mercadoB]} />);
    const regiao = within(await screen.findByRole("region", { name: "Resumo geral" }));
    const repor = regiao.getByRole("button", { name: /Para repor/ });
    await waitFor(() => expect(repor.textContent).toContain("Subtotal: 1 de 2 comércios"));
    expect(regiao.getByRole("button", { name: /^Faltou este mês:/ }).textContent).toContain("Ver antifurto");
    fireEvent.click(repor);
    expect(await screen.findByRole("heading", { name: "Alertas" })).toBeTruthy();
  });
});
