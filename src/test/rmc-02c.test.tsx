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
    await waitFor(() => expect(h.getByText("1 comércio cadastrado · 1 com resumo completo")).toBeTruthy());
  });
  it("vários comércios com vendas falhando em um: não conta como completo e mantém o aviso", async () => {
    banco.carregarVendas.mockImplementation(async (id: string) => { if (id === "c2") throw new TypeError("Failed to fetch"); return []; });
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/números podem estar incompletos/);
    expect(screen.getByText("2 comércios cadastrados · 1 com resumo completo")).toBeTruthy();
  });
  it("seis indicadores mantêm títulos, valores e ações, com explicações", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    const r = within(await screen.findByRole("region", { name: "Resumo geral" }));
    await waitFor(() => expect(r.getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^1/));
    for (const t of ["Vendas finalizadas hoje. Não é lucro nem saldo do caixa.", "Faltas nas diferenças do estoque, ao preço de compra. O valor não identifica a causa.", "Pendências urgentes de vários tipos, não só produtos",
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

describe("RMC-02C / C2 — subtotais dos quatro indicadores", () => {
  const repor = async () => within(await screen.findByRole("region", { name: "Resumo geral" })).getByRole("button", { name: /Para repor/ });
  const resolver = async () => within(await screen.findByRole("region", { name: "Resumo geral" })).getByRole("button", { name: /Para resolver agora/ });
  it("um comércio atualizado: total sem marca de subtotal", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await waitFor(async () => expect((await repor()).textContent).toMatch(/^1/));
    expect(screen.queryByText(/Subtotal:/)).toBeNull();
  });
  it("zero verdadeiro aparece como 0", async () => {
    banco.carregarProdutos.mockResolvedValue({ produtos: [], locais: { deposito: [], venda: [] } });
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    expect(await screen.findByText(/Tudo certo!/)).toBeTruthy();
  });
  it("falha de produtos em um comércio: subtotal só do válido", async () => {
    banco.carregarProdutos.mockImplementation(async (id: string) => { if (id === "c2") throw new TypeError("x"); return { produtos: [p], locais: { deposito: [], venda: [] } }; });
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await waitFor(async () => expect((await repor()).textContent).toMatch(/^1.*Subtotal: 1 de 2 comércios/));
  });
  it("números antigos do comércio que falhou não entram no subtotal; Tentar de novo recupera", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await waitFor(async () => expect((await repor()).textContent).toMatch(/^2/));
    banco.carregarProdutos.mockImplementation(async (id: string) => { if (id === "c2") throw new TypeError("x"); return { produtos: [p], locais: { deposito: [], venda: [] } }; });
    fireEvent(window, new Event("online"));
    await waitFor(async () => expect((await repor()).textContent).toMatch(/^1.*Subtotal: 1 de 2/));
    banco.carregarProdutos.mockResolvedValue({ produtos: [p], locais: { deposito: [], venda: [] } });
    fireEvent.click(await screen.findByRole("button", { name: /Tentar de novo/ }));
    await waitFor(async () => expect((await repor()).textContent).toMatch(/^2/));
    expect(screen.queryByText(/Subtotal:/)).toBeNull();
  });
  it("falha só em vendas ou só em diferenças afeta só Resolver agora", async () => {
    banco.carregarVendas.mockImplementation(async (id: string) => { if (id === "c2") throw new TypeError("x"); return []; });
    banco.carregarDiferencas.mockImplementation(async (id: string) => { if (id === "c1") throw new TypeError("x"); return { diferencas: [], perdas: [] }; });
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await waitFor(async () => expect((await repor()).textContent).toMatch(/^2/));
    expect((await resolver()).textContent).toMatch(/^—.*Consulta incompleta/);
    expect(screen.queryByText(/Tudo certo!/)).toBeNull();
  });
  it("falha só em fornecedores não invalida os indicadores", async () => {
    banco.carregarFornecedores.mockRejectedValue(new TypeError("x"));
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await waitFor(async () => expect((await repor()).textContent).toMatch(/^1/));
    expect(screen.queryByText(/Subtotal:|Consulta incompleta/)).toBeNull();
  });
  it("todos indisponíveis: — e Consulta incompleta, nunca zero; carregando mostra …", async () => {
    let soltar!: () => void;
    banco.carregarProdutos.mockImplementation(() => new Promise((_, rej) => { soltar = () => rej(new TypeError("x")); }));
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await waitFor(async () => expect((await repor()).textContent).toMatch(/^…/));
    soltar();
    await waitFor(async () => expect((await repor()).textContent).toMatch(/^—.*Consulta incompleta/));
    expect(screen.queryByText(/Tudo certo!/)).toBeNull();
  });
  it("resposta antiga depois da mais recente não substitui os números", async () => {
    const r1: Array<(v: unknown) => void> = [];
    banco.carregarProdutos.mockImplementationOnce(() => new Promise((res) => r1.push(res)));
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    fireEvent(window, new Event("online"));
    await waitFor(async () => expect((await repor()).textContent).toMatch(/^1/));
    r1[0]!({ produtos: [p, { ...p, id: "p2", db: { id: "p2", contadas: ["deposito:_", "venda:_"] } }], locais: { deposito: [], venda: [] } });
    await new Promise((r) => setTimeout(r, 20));
    expect((await repor()).textContent).toMatch(/^1/);
  });
  it("clique nos indicadores abre Alertas", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    fireEvent.click(await resolver());
    expect(await screen.findByText("Assunto: Para resolver agora")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Alertas" })).toBeTruthy();
  });
});

import { etiquetaHoje, etiquetaMes } from "@/components/OwnerHome";
describe("RMC-02C / C3 — organização visual", () => {
  it("etiquetas dinâmicas a partir da data de referência", () => {
    expect(etiquetaHoje("2026-10-13")).toBe("Hoje · 13/10");
    expect(etiquetaMes("2026-10-13")).toBe("Mês de outubro");
    expect(etiquetaHoje("2026-11-01")).toBe("Hoje · 01/11");
    expect(etiquetaMes("2026-01-31")).toBe("Mês de janeiro");
    expect(etiquetaHoje(undefined)).toBe("Hoje");
  });
  it("ordem C4-A dos grupos, nomes acessíveis e ações preservadas", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    const reg = await screen.findByRole("region", { name: "Resumo geral" });
    const r = within(reg);
    const hs = r.getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
    expect(hs[0]).toMatch(/^Vendas de hoje.*Hoje · \d{2}\/\d{2}/);
    expect(hs[1]).toBe("Pendências que precisam de atenção");
    expect(hs[2]).toMatch(/^Faltas no estoque neste mês.*Mês de /);
    const txt = reg.textContent ?? "";
    expect(txt.indexOf("Vendas hoje")).toBeLessThan(txt.indexOf("Pendências que precisam"));
    expect(txt.indexOf("Pendências que precisam")).toBeLessThan(txt.indexOf("Faltou este mês"));
    for (const n of [/^Vendas hoje/, /^Faltou este mês/]) expect(r.getByRole("button", { name: n })).toBeTruthy();
    await waitFor(() => expect(r.getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^1/));
    for (const n of [/Para resolver agora/, /Para comprar/, /Vencem? em breve/]) expect(r.getByRole("button", { name: n })).toBeTruthy();
  });
  it("subtotal e consulta incompleta continuam após a reorganização", async () => {
    banco.carregarProdutos.mockImplementation(async (id: string) => { if (id === "c2") throw new TypeError("x"); return { produtos: [p], locais: { deposito: [], venda: [] } }; });
    banco.carregarVendas.mockRejectedValue(new TypeError("x"));
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    const r = within(await screen.findByRole("region", { name: "Resumo geral" }));
    await waitFor(() => expect(r.getByRole("button", { name: /Para repor/ }).textContent).toMatch(/Subtotal: 1 de 2 comércios/));
    expect(r.getByRole("button", { name: /Para resolver agora/ }).textContent).toMatch(/Consulta incompleta/);
  });
});
