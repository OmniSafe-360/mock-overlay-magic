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
const loja = (i: number): StoreData => ({ id: `c${i}`, tipo: "mercado", nome: `Mercado ${i}`, cidade: "Bauru", uf: "SP", rua: "R", numero: "1", bairro: "C" });
const lojas = (n: number) => Array.from({ length: n }, (_, i) => loja(i + 1));

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]); banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]); banco.carregarPendentesVenda.mockResolvedValue([]);
  banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] }); banco.carregarLimiteFaltas.mockResolvedValue(20000);
  banco.carregarContagensAntifurto.mockResolvedValue([]); banco.carregarCaixas.mockResolvedValue([]); banco.carregarFuncionarios.mockResolvedValue([]);
  banco.carregarProdutos.mockResolvedValue({ produtos: [p], locais: { deposito: [], venda: [] } });
});

const regiao = async () => within(await screen.findByRole("region", { name: "Resumo geral" }));
const kpi = async (nome: RegExp) => (await regiao()).getByRole("button", { name: nome });

describe("M04-B — unidades e alcance dos indicadores", () => {
  it("zero comércios: sem indicadores nem soma", () => {
    render(<OwnerApp userId="u1" owner="M" initial={[]} />);
    expect(screen.queryByTestId("soma-todos")).toBeNull();
    expect(screen.queryByTestId("unidade-kpi")).toBeNull();
  });
  it("um comércio: singular para 1, plural para 0, sem 'Soma de todos'", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={lojas(1)} />);
    await waitFor(async () => expect((await kpi(/Para repor/)).textContent).toMatch(/^1 produtoPara repor/));
    expect((await kpi(/Para comprar/)).textContent).toMatch(/^0 produtosPara comprar/);
    expect((await kpi(/Para resolver agora/)).textContent).toMatch(/^0 pendênciasPara resolver/);
    expect(screen.queryByTestId("soma-todos")).toBeNull();
  });
  it("dois comércios completos: plural e 'Soma de todos os comércios'", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await waitFor(async () => expect((await kpi(/Para repor/)).textContent).toMatch(/^2 produtos/));
    await waitFor(() => expect(screen.getByTestId("soma-todos")).toHaveTextContent("Soma de todos os comércios"));
  });
  it("seis comércios completos: soma 6 e destino do botão preservado", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={lojas(6)} />);
    await waitFor(async () => expect((await kpi(/Para repor/)).textContent).toMatch(/^6 produtos/));
    expect(screen.getByTestId("soma-todos")).toBeTruthy();
    fireEvent.click(await kpi(/Para repor/));
    expect(await screen.findAllByText(/Repor/)).toBeTruthy();
  });
  it("consulta parcial: mantém subtotal e não afirma soma de todos", async () => {
    banco.carregarProdutos.mockImplementation(async (id: string) => { if (id === "c2") throw new TypeError("x"); return { produtos: [p], locais: { deposito: [], venda: [] } }; });
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await waitFor(async () => expect((await kpi(/Para repor/)).textContent).toMatch(/^1 produto.*Subtotal: 1 de 2 comércios/));
    expect(screen.queryByTestId("soma-todos")).toBeNull();
  });
  it("só Resolver indisponível (vendas falharam): sem 'Soma de todos'", async () => {
    banco.carregarVendas.mockImplementation(async (id: string) => { if (id === "c2") throw new TypeError("x"); return []; });
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await waitFor(async () => expect((await kpi(/Para resolver agora/)).textContent).toMatch(/Subtotal: 1 de 2/));
    expect(screen.queryByTestId("soma-todos")).toBeNull();
  });
  it("carregamento inicial: sem unidade e sem soma", async () => {
    banco.carregarProdutos.mockReturnValue(new Promise(() => {}));
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    expect(await screen.findByTestId("conferindo-pendencias")).toBeTruthy();
    expect(screen.queryByTestId("unidade-kpi")).toBeNull();
    expect(screen.queryByTestId("soma-todos")).toBeNull();
  });
  it("atualização interna: soma some enquanto consulta e volta depois", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await waitFor(() => expect(screen.getByTestId("soma-todos")).toBeTruthy());
    let soltar: (v: unknown) => void = () => {};
    banco.carregarProdutos.mockReturnValue(new Promise((r) => { soltar = r; }));
    fireEvent(window, new Event("online"));
    await waitFor(() => expect(screen.queryByTestId("soma-todos")).toBeNull());
    soltar({ produtos: [p], locais: { deposito: [], venda: [] } });
    await waitFor(() => expect(screen.getByTestId("soma-todos")).toBeTruthy());
  });
  it("antifurto: subtotal mostra X de Y comércios que entram no valor", async () => {
    banco.carregarDiferencas.mockImplementation(async (id: string) => { if (id === "c2") throw new TypeError("x"); return { diferencas: [], perdas: [] }; });
    render(<OwnerApp userId="u1" owner="M" initial={lojas(3)} />);
    await waitFor(() => expect(screen.getByTestId("cartao-faltou")).toHaveTextContent("Subtotal: 2 de 3 comércios"));
    expect(screen.getByTestId("cartao-faltou")).toHaveTextContent("Faltou este mês");
    expect(screen.queryByText("Subtotal disponível")).toBeNull();
  });
});
