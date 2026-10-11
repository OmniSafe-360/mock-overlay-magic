import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerApp } from "@/components/OwnerHome";
import type { Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";
import { primeirosPassos, passosFeitos } from "@/lib/primeirosPassos";

const banco = vi.hoisted(() => ({ carregarFornecedores: vi.fn(), carregarProdutos: vi.fn(), carregarPedidos: vi.fn(), conferirEnvio: vi.fn(), carregarVendas: vi.fn(), carregarPendentesVenda: vi.fn(), carregarDiferencas: vi.fn(), carregarLimiteFaltas: vi.fn(), carregarContagensAntifurto: vi.fn(), carregarCaixas: vi.fn(), carregarFuncionarios: vi.fn() }));
vi.mock("@/lib/banco", async (original) => ({ ...await original<object>(), ...banco }));
vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const loja = { id: "c1", nome: "Supermercado União", tipo: "mercado", cidade: "Cuiabá", uf: "MT" } as StoreData;
const arroz = { id: "p1", db: { id: "p1", contadas: [] }, nome: "Arroz", codigo: "7891", unidade: "Unidade", categoria: "Mercearia", compra: 1000, venda: 1500,
  fornecedor: null, detalhes: {}, variacoes: [], deposito: { local: "Estante A", qtd: 20, min: 5, max: 40 }, areaVenda: { local: "Gôndola 1", qtd: 10, min: 3, max: 12 } } as unknown as Product;

beforeEach(() => {
  localStorage.clear();
  Object.values(banco).forEach((f) => f.mockReset());
  banco.carregarFornecedores.mockResolvedValue([]); banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]); banco.carregarPendentesVenda.mockResolvedValue([]); banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] });
  banco.carregarLimiteFaltas.mockResolvedValue(20000); banco.carregarContagensAntifurto.mockResolvedValue([]); banco.carregarCaixas.mockResolvedValue([]); banco.carregarFuncionarios.mockResolvedValue([]);
  banco.carregarProdutos.mockResolvedValue({ produtos: [], locais: { deposito: [], venda: [] } });
});

describe("primeiros passos", () => {
  it("regra: cada passo pelo que já existe; farmácia diz estoque", () => {
    const base = { produtos: 0, locais: { deposito: [], venda: [] }, produtoComLocal: false, fornecedores: 0, funcionarios: 0, caixas: 0, deposito: "Estoque", venda: "Área de venda" };
    const v = primeirosPassos(base);
    expect(passosFeitos(v)).toBe(1);
    expect(v[2]!.titulo).toBe("Dizer onde fica: estoque e área de venda");
    expect(passosFeitos(primeirosPassos({ ...base, produtos: 1, produtoComLocal: true, fornecedores: 1, funcionarios: 2, caixas: 1 }))).toBe(6);
    expect(primeirosPassos({ ...base, funcionarios: null })[4]!.feito).toBe(false);
  });

  it("comércio novo: quadro no topo, comércio único com botão de entrar, passo leva ao lugar certo", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[loja]} />);
    expect(await screen.findByText("1 de 6 feitos. Siga a ordem e o Omni fica pronto para usar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar no Supermercado União/ })).toBeInTheDocument();
    expect(screen.queryByText(/Seus comércios/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar um funcionário/ }));
    expect(await screen.findByRole("button", { name: /^Equipe/, current: "page" })).toBeInTheDocument();
  });

  it("tudo feito: o quadro some; esconder também some", async () => {
    banco.carregarProdutos.mockResolvedValue({ produtos: [arroz], locais: { deposito: ["Estante A"], venda: ["Gôndola 1"] } });
    banco.carregarFornecedores.mockResolvedValue([{ id: "f1", nome: "Atacadão" }]);
    banco.carregarFuncionarios.mockResolvedValue([{ id: "x" }]); banco.carregarCaixas.mockResolvedValue([{ id: "k" }]);
    const { unmount } = render(<OwnerApp userId="u1" owner="Monica" initial={[loja]} />);
    await waitFor(() => expect(banco.carregarCaixas).toHaveBeenCalled());
    await screen.findByText("Tudo certo");
    expect(screen.queryByText(/Primeiros passos/)).toBeNull();
    unmount();
    banco.carregarCaixas.mockResolvedValue([]);
    render(<OwnerApp userId="u1" owner="Monica" initial={[loja]} />);
    fireEvent.click(await screen.findByText("Esconder os primeiros passos"));
    expect(screen.queryByText(/de 6 feitos/)).toBeNull();
  });
});
