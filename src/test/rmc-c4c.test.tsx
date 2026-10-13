import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const produto = (id: string, nome: string, dep: number, ven: number): Product => ({
  id, db: { id, contadas: ["deposito:_", "venda:_"] }, nome, codigo: "789" + id,
  unidade: "Unidade", categoria: "Mercearia", compra: 1000, venda: 1500, fornecedor: null, detalhes: {}, variacoes: [],
  deposito: { local: "A", qtd: dep, min: 5, max: 40 },
  areaVenda: { local: "G", qtd: ven, min: 3, max: 12 },
}) as Product;
const acabado = produto("p1", "Café", 0, 0);
const repor = produto("p2", "Feijão", 20, 2);
const ok = produto("p3", "Arroz", 20, 10);
const a: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado Alfa", cidade: "Bauru", uf: "SP", rua: "R", numero: "1", bairro: "Centro" };
const b: StoreData = { ...a, id: "c2", nome: "Farmácia Beta", tipo: "farmacia" };
const naAba = () => fireEvent.click(screen.getAllByRole("button", { name: "Alertas" })[0]!);
const sininho = () => document.querySelector<HTMLButtonElement>('header.sticky button[aria-label^="Alertas"]')!;
const secao = (nome: string) => within(screen.getByRole("region", { name: nome }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]);
  banco.carregarProdutos.mockImplementation(async (id: string) => ({
    produtos: id === "c1" ? [acabado, repor] : [ok], locais: { deposito: [], venda: [] },
  }));
  banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]);
  banco.carregarPendentesVenda.mockResolvedValue([]);
  banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] });
  banco.carregarLimiteFaltas.mockResolvedValue(20000);
  banco.carregarContagensAntifurto.mockResolvedValue([]);
  banco.carregarCaixas.mockResolvedValue([]);
  banco.carregarFuncionarios.mockResolvedValue([]);
});

describe("RMC-04 / C4-C1 — consistência do sino e Alertas sem filtro", () => {
  it("leitura completa mantém os avisos, os destinos e o número confirmado no sino", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await waitFor(() => expect(sininho()).toHaveAccessibleName("Alertas: 1 para resolver agora"));
    naAba();
    expect(screen.getByRole("heading", { name: "Alertas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Atualizar alertas" })).toBeEnabled();
    expect(secao("Mercado Alfa").getByRole("button", { name: /Acabaram/ })).toBeTruthy();
    expect(secao("Mercado Alfa").getByRole("button", { name: /Repor a gôndola/ })).toBeTruthy();
    expect(screen.getByText("Farmácia Beta")).toBeTruthy();
    fireEvent.click(secao("Mercado Alfa").getByRole("button", { name: /Acabaram/ }));
    fireEvent.click(secao("Mercado Alfa").getByRole("button", { name: /Café/ }));
    expect(await screen.findByRole("heading", { name: "Café" })).toBeTruthy();
  });

  it("falha posterior de produtos nunca classifica os avisos guardados como atuais", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await waitFor(() => expect(sininho()).toHaveAccessibleName("Alertas: 1 para resolver agora"));
    banco.carregarProdutos.mockImplementation(async (id: string) => {
      if (id === "c1") throw new TypeError("Failed to fetch");
      return { produtos: [ok], locais: { deposito: [], venda: [] } };
    });
    fireEvent(window, new Event("online"));
    await waitFor(() => expect(sininho()).toHaveAccessibleName("Alertas: consulta incompleta"));
    naAba();
    expect(screen.getByText(/Consulta incompleta: Mercado Alfa/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Mercado Alfa" })).toBeNull();
    expect(screen.queryByText(/Tudo certo! Nenhum comércio/)).toBeNull();
    expect(screen.getByRole("button", { name: "Atualizar alertas" })).toBeEnabled();
  });

  it("somente vendas falham: produtos confirmados continuam visíveis sem vendas falsas", async () => {
    banco.carregarVendas.mockRejectedValue(new TypeError("offline"));
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await waitFor(() => expect(sininho()).toHaveAccessibleName("Alertas: consulta incompleta"));
    naAba();
    expect(screen.getByText(/Consulta incompleta: Mercado Alfa, Farmácia Beta/)).toBeTruthy();
    expect(secao("Mercado Alfa").getByRole("button", { name: /Acabaram/ })).toBeTruthy();
    expect(secao("Mercado Alfa").getByRole("button", { name: /Repor a gôndola/ })).toBeTruthy();
    expect(secao("Mercado Alfa").getByText(/apenas os avisos de produtos e pedidos estão confirmados/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Vendido sem cadastro/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Perda ou diferença/ })).toBeNull();
    expect(screen.queryByText(/Tudo certo! Nenhum comércio/)).toBeNull();
    expect(screen.queryByText("Farmácia Beta", { selector: "p" })).toBeNull(); // não é listada como totalmente regular
  });

  it("diferenças indisponíveis também não viram zero global nem escondem produto urgente", async () => {
    banco.carregarDiferencas.mockRejectedValue(new TypeError("offline"));
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await waitFor(() => expect(sininho()).toHaveAccessibleName("Alertas: consulta incompleta"));
    naAba();
    expect(secao("Mercado Alfa").getByRole("button", { name: /Acabaram/ })).toBeTruthy();
    expect(secao("Mercado Alfa").getByText(/Consulta incompleta nesta unidade/)).toBeTruthy();
    expect(screen.queryByText(/Tudo certo! Nenhum comércio/)).toBeNull();
  });

  it("produtos regulares com vendas desconhecidas não geram Tudo certo falso", async () => {
    banco.carregarProdutos.mockResolvedValue({ produtos: [ok], locais: { deposito: [], venda: [] } });
    banco.carregarVendas.mockRejectedValue(new TypeError("offline"));
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await waitFor(() => expect(sininho()).toHaveAccessibleName("Alertas: consulta incompleta"));
    naAba();
    expect(screen.getByText(/Consulta incompleta: Mercado Alfa/)).toBeTruthy();
    expect(screen.queryByText(/Tudo certo/)).toBeNull();
    expect(screen.queryByRole("region", { name: "Mercado Alfa" })).toBeNull();
  });

  it("Atualizar alertas usa a leitura existente e recupera a confirmação após falha", async () => {
    banco.carregarProdutos.mockRejectedValue(new TypeError("offline"));
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await waitFor(() => expect(sininho()).toHaveAccessibleName("Alertas: consulta incompleta"));
    naAba();
    expect(screen.queryByRole("region", { name: "Mercado Alfa" })).toBeNull();
    const anterior = banco.carregarProdutos.mock.calls.length;
    banco.carregarProdutos.mockResolvedValue({ produtos: [acabado], locais: { deposito: [], venda: [] } });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar alertas" }));
    await waitFor(() => expect(sininho()).toHaveAccessibleName("Alertas: 1 para resolver agora"));
    expect(banco.carregarProdutos.mock.calls.length).toBeGreaterThan(anterior);
    expect(secao("Mercado Alfa").getByRole("button", { name: /Acabaram/ })).toBeTruthy();
    expect(banco.conferirEnvio).not.toHaveBeenCalled();
  });

  it("falha apenas nos fornecedores não invalida as fontes confirmadas de produtos e pedidos", async () => {
    banco.carregarFornecedores.mockRejectedValue(new TypeError("offline"));
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await waitFor(() => expect(sininho()).toHaveAccessibleName("Alertas: 1 para resolver agora"));
    naAba();
    expect(secao("Mercado Alfa").getByRole("button", { name: /Acabaram/ })).toBeTruthy();
    expect(screen.queryByText(/Consulta incompleta: Mercado Alfa/)).toBeNull();
  });

  it("C4-B continua isolada: filtrar Repor e usar Ver todos sem carregar outros assuntos", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    const r = within(await screen.findByRole("region", { name: "Resumo geral" }));
    await waitFor(() => expect(r.getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^1/));
    fireEvent.click(r.getByRole("button", { name: /Para repor/ }));
    expect(screen.getByText("Assunto: Para repor")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Atualizar alertas" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver todos os alertas" }));
    expect(screen.getByRole("button", { name: "Atualizar alertas" })).toBeEnabled();
    expect(screen.queryByText("Assunto: Para repor")).toBeNull();
    expect(secao("Mercado Alfa").getByRole("button", { name: /Acabaram/ })).toBeTruthy();
  });

  it("sem comércios não inventa pendência, leitura incompleta nem botão de atualização", () => {
    render(<OwnerApp userId="u1" owner="M" initial={[]} />);
    expect(sininho()).toHaveAccessibleName("Alertas");
    naAba();
    expect(screen.getByText(/Cadastre um comércio para ver os alertas aqui/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Atualizar alertas" })).toBeNull();
  });
});
