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

const produto = (id: string, dep: number, ven: number): Product => ({
  id, db: { id, contadas: ["deposito:_", "venda:_"] }, nome: `P${id}`, codigo: `789${id}`,
  unidade: "Unidade", categoria: "Mercearia", compra: 1000, venda: 1500, fornecedor: null, detalhes: {}, variacoes: [],
  deposito: { local: "A", qtd: dep, min: 5, max: 40 }, areaVenda: { local: "G", qtd: ven, min: 3, max: 12 },
}) as Product;
const emDia = { produtos: [produto("1", 20, 10)], locais: { deposito: [], venda: [] } };
const comPendencia = { produtos: [produto("2", 20, 1)], locais: { deposito: [], venda: [] } };
const a: StoreData = { id: "c1", tipo: "mercado", nome: "Alfa", cidade: "B", uf: "SP", rua: "R", numero: "1", bairro: "C" };
const b: StoreData = { ...a, id: "c2", nome: "Beta" };
const c: StoreData = { ...a, id: "c3", nome: "Gama" };

const VERDE = "Tudo certo! Nenhum comércio precisa de atenção agora.";
const ANTERIOR = "Tudo certo na última consulta · atualizando…";
const atualizar = () => fireEvent.click(screen.getByRole("button", { name: "Atualizar painel" }));
const pendente = () => { let r!: (v: unknown) => void; const p = new Promise((res) => { r = res; }); return { p, r }; };

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]);
  banco.carregarProdutos.mockResolvedValue(emDia);
  banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]);
  banco.carregarPendentesVenda.mockResolvedValue([]);
  banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] });
  banco.carregarLimiteFaltas.mockResolvedValue(20000);
  banco.carregarContagensAntifurto.mockResolvedValue([]);
  banco.carregarCaixas.mockResolvedValue([]);
  banco.carregarFuncionarios.mockResolvedValue([]);
});

describe("H1 — estabilidade ao atualizar o Início", () => {
  it("primeira abertura nunca mostra o resultado anterior", async () => {
    const { p, r } = pendente(); banco.carregarProdutos.mockReturnValue(p);
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    expect(screen.queryByText(ANTERIOR)).toBeNull();
    expect(screen.queryByText(VERDE)).toBeNull();
    r(emDia); expect(await screen.findByText(VERDE)).toBeTruthy();
  });

  it("após Tudo certo, Atualizar mantém o quadro verde marcado como anterior e depois confirma", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await screen.findByText(VERDE);
    const { p, r } = pendente(); banco.carregarProdutos.mockReturnValue(p);
    atualizar();
    expect(await screen.findByText(ANTERIOR)).toBeTruthy();
    expect(screen.queryByText(VERDE)).toBeNull();
    expect(screen.queryByTestId("grade-pendencias")).toBeNull();
    r(emDia);
    expect(await screen.findByText(VERDE)).toBeTruthy();
    expect(screen.queryByText(ANTERIOR)).toBeNull();
  });

  it("atualização que encontra pendência mostra os cartões", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await screen.findByText(VERDE);
    banco.carregarProdutos.mockResolvedValue(comPendencia);
    atualizar();
    expect(await screen.findByTestId("grade-pendencias")).toBeTruthy();
    expect(screen.queryByText(VERDE)).toBeNull();
    expect(screen.queryByText(ANTERIOR)).toBeNull();
  });

  it("pendência já confirmada num comércio durante a leitura derruba o quadro anterior", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await screen.findByText(VERDE);
    const { p } = pendente();
    banco.carregarProdutos.mockImplementation(async (id: string) => (id === "c1" ? comPendencia : p));
    atualizar();
    const grade = await screen.findByTestId("grade-pendencias");
    expect(within(grade).getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.queryByText(ANTERIOR)).toBeNull();
  });

  it("sem Tudo certo antes, Atualizar não mostra o quadro anterior", async () => {
    banco.carregarProdutos.mockResolvedValue(comPendencia);
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await screen.findByTestId("grade-pendencias");
    const { p } = pendente(); banco.carregarProdutos.mockReturnValue(p);
    atualizar();
    await waitFor(() => expect(screen.getByRole("button", { name: "Atualizar painel" })).toBeDisabled());
    expect(screen.queryByText(ANTERIOR)).toBeNull();
  });

  it("falha de rede: mostra o aviso e não mantém o resultado anterior; a próxima atualização também não", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await screen.findByText(VERDE);
    banco.carregarProdutos.mockRejectedValue(new TypeError("Failed to fetch"));
    atualizar();
    expect(await screen.findByRole("alert")).toHaveTextContent(/números podem estar incompletos/);
    expect(screen.queryByText(VERDE)).toBeNull();
    expect(screen.queryByText(ANTERIOR)).toBeNull();
    const { p } = pendente(); banco.carregarProdutos.mockReturnValue(p);
    atualizar();
    await waitFor(() => expect(screen.getByRole("button", { name: "Atualizar painel" })).toBeDisabled());
    expect(screen.queryByText(ANTERIOR)).toBeNull();
  });

  it("consulta parcial (vendas indisponíveis) não vale como completa", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await screen.findByText(VERDE);
    banco.carregarVendas.mockImplementation(async (id: string) => { if (id === "c2") throw new Error("x"); return []; });
    atualizar();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(VERDE)).toBeNull();
    banco.carregarVendas.mockResolvedValue([]);
    const { p } = pendente(); banco.carregarProdutos.mockReturnValue(p);
    atualizar();
    await waitFor(() => expect(screen.getByRole("button", { name: "Atualizar painel" })).toBeDisabled());
    expect(screen.queryByText(ANTERIOR)).toBeNull();
  });

  it("atualizações consecutivas mantêm o quadro anterior até a última terminar", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await screen.findByText(VERDE);
    const um = pendente(); banco.carregarProdutos.mockReturnValue(um.p);
    atualizar();
    expect(await screen.findByText(ANTERIOR)).toBeTruthy();
    um.r(emDia); await screen.findByText(VERDE);
    const dois = pendente(); banco.carregarProdutos.mockReturnValue(dois.p);
    atualizar();
    expect(await screen.findByText(ANTERIOR)).toBeTruthy();
    dois.r(emDia); expect(await screen.findByText(VERDE)).toBeTruthy();
  });

  it("mudança na lista de comércios invalida o resultado anterior", async () => {
    const { rerender } = render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await screen.findByText(VERDE);
    const { p } = pendente(); banco.carregarProdutos.mockReturnValue(p);
    rerender(<OwnerApp key="lista-nova" userId="u1" owner="M" initial={[a, b, c]} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Atualizar painel" })).toBeDisabled());
    expect(screen.queryByText(ANTERIOR)).toBeNull();
    expect(screen.queryByText(VERDE)).toBeNull();
  });
});
