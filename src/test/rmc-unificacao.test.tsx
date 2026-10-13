import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerApp } from "@/components/OwnerHome";
import type { Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";

const banco = vi.hoisted(() => ({ carregarFornecedores: vi.fn(), carregarProdutos: vi.fn(), carregarPedidos: vi.fn(), conferirEnvio: vi.fn(), carregarVendas: vi.fn(), carregarPendentesVenda: vi.fn(), carregarDiferencas: vi.fn(), carregarLimiteFaltas: vi.fn(), carregarContagensAntifurto: vi.fn(), carregarCaixas: vi.fn(), carregarFuncionarios: vi.fn() }));
vi.mock("@/lib/banco", async (original) => ({ ...await original<object>(), ...banco }));
vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const HOJE = "2026-10-10";
const prod = (id: string, nome: string, dep: number, ven: number, over: Partial<Product> = {}): Product => ({
  id, db: { id, contadas: ["deposito:_", "venda:_"] }, nome, codigo: `789${id}`, unidade: "Unidade", categoria: "Mercearia", compra: 1000, venda: 1500,
  fornecedor: null, detalhes: {}, variacoes: [], deposito: { local: "Estante A", qtd: dep, min: 5, max: 40 }, areaVenda: { local: "Gôndola 1", qtd: ven, min: 3, max: 12 }, ...over,
});
const tudoCerto = prod("p1", "Arroz", 20, 10);
const repor = prod("p2", "Feijão", 20, 2);
const comprar = prod("p3", "Açúcar", 4, 10);
const acabou = prod("p4", "Café", 0, 0);

const lojaA: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado Bom Preço", cidade: "Bauru", uf: "SP", rua: "Rua A", numero: "1", bairro: "Centro" };
const lojaB: StoreData = { ...lojaA, id: "c2", nome: "Farmácia Vida", tipo: "farmacia" };
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]);
  banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]); banco.carregarPendentesVenda.mockResolvedValue([]); banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] }); banco.carregarLimiteFaltas.mockResolvedValue(20000); banco.carregarContagensAntifurto.mockResolvedValue([]); banco.carregarCaixas.mockResolvedValue([]); banco.carregarFuncionarios.mockResolvedValue([]);
  banco.carregarProdutos.mockImplementation(async (id: string) => ({
    produtos: id === "c1" ? [tudoCerto, repor, comprar, acabou] : [prod("f1", "Dipirona", 20, 10)],
    locais: { deposito: ["Estante A"], venda: ["Gôndola 1"] },
  }));
});

const atual = () => [...document.querySelectorAll('[aria-current="page"]')].map((e) => e.textContent).join("|");

describe("RMC-02/02B: Início (resumo) e Comércios (cartões)", () => {
  it("menu com cinco opções (Início | Comércios | Alertas | Equipe | Conta), no celular e no computador", () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    expect(screen.getAllByRole("button", { name: "Alertas" }).length).toBeGreaterThanOrEqual(2);
    for (const nome of ["Início", "Comércios", "Equipe", "Conta"]) expect(screen.getAllByRole("button", { name: nome })).toHaveLength(2);
    const navs = document.querySelectorAll("nav");
    expect(navs).toHaveLength(2);
    navs.forEach((n) => expect([...n.querySelectorAll("button")].map((b) => b.textContent?.trim())).toEqual(["Início", "Comércios", "Alertas", "Equipe", "Conta"]));
    expect(document.querySelector("nav .grid")?.className).toMatch(/\bgrid-cols-5\b/);
  });
  it("cada comércio uma única vez, com produtos e Adicionar comércio", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Comércios" })[0]!);
    expect(screen.getAllByRole("button", { name: "Entrar no Mercado Bom Preço" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Entrar no Farmácia Vida" })).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("region", { name: "Mercado Bom Preço" }).textContent).toMatch(/4 produtos/));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar comércio" }));
    expect(await screen.findByText("Qual é o seu tipo de comércio?")).toBeTruthy();
  });
  it("consulta que falhou não mostra zero produtos", async () => {
    banco.carregarProdutos.mockImplementation(async (id: string) => { if (id === "c2") throw new Error("Failed to fetch"); return { produtos: [tudoCerto], locais: { deposito: [], venda: [] } }; });
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    expect(await screen.findByText(/Não foi possível atualizar algum comércio/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Comércios" })[0]!);
    await screen.findByRole("region", { name: "Farmácia Vida" });
    expect(screen.getByRole("region", { name: "Farmácia Vida" }).textContent).not.toMatch(/\d+ produtos?/);
    expect(screen.getByRole("region", { name: "Farmácia Vida" }).textContent).toMatch(/Não foi possível atualizar/);
  });
  it("Ver vendas com um comércio abre direto a aba Vendas", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA]} />);
    fireEvent.click(await screen.findByRole("button", { name: /Vendas hoje/ }));
    await waitFor(() => expect(atual()).toMatch(/Vendas/));
  });
  it("Ver vendas com vários: pede a escolha e abre Vendas do escolhido; depois, entrada normal em Produtos", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    fireEvent.click(await screen.findByRole("button", { name: /Vendas hoje/ }));
    // RMC-02B: vai para a aba Comércios com a escolha ligada
    expect(await screen.findByText("Escolha o comércio para ver as vendas")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Comércios", current: "page" }).length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(screen.getByText("Escolha o comércio para ver as vendas").parentElement);
    fireEvent.click(screen.getByRole("button", { name: "Entrar no Farmácia Vida" }));
    await waitFor(() => expect(atual()).toMatch(/Vendas/));
    fireEvent.click(screen.getByRole("button", { name: /Voltar/ }));
    // vendas pedidas no Início: o Voltar devolve ao Início
    expect(await screen.findByText("Situação dos comércios")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Comércios" })[0]!);
    await screen.findByRole("region", { name: "Seus comércios" });
    expect(screen.queryByText("Escolha o comércio para ver as vendas")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entrar no Mercado Bom Preço" }));
    expect(await screen.findByRole("button", { name: /Feijão/ })).toBeTruthy();
    expect(atual()).toMatch(/Produtos/);
  });
  it("cancelar ou trocar de menu limpa a escolha sem afetar a próxima entrada", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    fireEvent.click(await screen.findByRole("button", { name: /Vendas hoje/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Escolha o comércio para ver as vendas")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Início" })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: /Vendas hoje/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Alertas" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Comércios" })[0]!);
    expect(screen.queryByText("Escolha o comércio para ver as vendas")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entrar no Mercado Bom Preço" }));
    expect(await screen.findByRole("button", { name: /Feijão/ })).toBeTruthy();
    expect(atual()).toMatch(/Produtos/);
  });
  it("cancelar Adicionar comércio durante a escolha de vendas volta a Comércios sem a escolha", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    fireEvent.click(await screen.findByRole("button", { name: /Vendas hoje/ }));
    expect(screen.getByText("Escolha o comércio para ver as vendas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar comércio" }));
    expect(await screen.findByText("Qual é o seu tipo de comércio?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(await screen.findByRole("region", { name: "Seus comércios" })).toBeTruthy();
    expect(screen.queryByText("Escolha o comércio para ver as vendas")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entrar no Mercado Bom Preço" }));
    expect(await screen.findByRole("button", { name: /Feijão/ })).toBeTruthy();
    expect(atual()).toMatch(/Produtos/);
    expect(atual()).not.toMatch(/Vendas/);
  });
  it("alertas, antifurto e falha de consulta continuam acessíveis", async () => {
    banco.carregarVendas.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/números podem estar incompletos/);
    fireEvent.click(screen.getAllByRole("button", { name: "Alertas" })[0]!);
    expect(await screen.findByRole("heading", { name: "Alertas" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Início" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Faltou este mês/ }));
    expect(await screen.findByRole("heading", { name: /Antifurto/ })).toBeTruthy();
  });
});
