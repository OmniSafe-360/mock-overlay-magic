import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerApp } from "@/components/OwnerHome";
import type { Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";
import type { Pedido } from "@/lib/pedido";
import { fraseComercio, resumoComercio, somaResumos } from "@/lib/resumoGeral";

const banco = vi.hoisted(() => ({ carregarFornecedores: vi.fn(), carregarProdutos: vi.fn(), carregarPedidos: vi.fn(), conferirEnvio: vi.fn(), carregarVendas: vi.fn(), carregarPendentesVenda: vi.fn(), contarDiferencasParaDecidir: vi.fn(), carregarCaixas: vi.fn() }));
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

describe("resumo de um comércio", () => {
  it("conta cada assunto pela mesma regra do Atenção hoje", () => {
    const r = resumoComercio([tudoCerto, repor, comprar, acabou], "mercado", HOJE, []);
    expect(r).toMatchObject({ produtos: 4, urgentes: 1, repor: 1, comprar: 1, vencendo: 0, contasAtrasadas: 0, entregasDecidir: 0 });
    expect(fraseComercio(r)).toEqual({ nivel: "urgente", texto: "1 para resolver agora", extra: "1 para repor · 1 para comprar" });
  });
  it("produto já pedido sai de Comprar e de Acabaram", () => {
    const pedido = { situacao: "enviado", itens: [{ produtoId: "p3" }, { produtoId: "p4" }] } as unknown as Pedido;
    const r = resumoComercio([comprar, acabou], "mercado", HOJE, [pedido]);
    expect(r.comprar).toBe(0);
    expect(r.urgentes).toBe(0);
  });
  it("frase amarela, verde e sem produtos; soma de vários comércios", () => {
    const a = resumoComercio([repor, comprar], "mercado", HOJE, []);
    expect(fraseComercio(a)).toEqual({ nivel: "atencao", texto: "1 para repor · 1 para comprar" });
    const b = resumoComercio([tudoCerto], "mercado", HOJE, []);
    expect(fraseComercio(b)).toEqual({ nivel: "ok", texto: "Tudo certo" });
    expect(fraseComercio(resumoComercio([], "mercado", HOJE, [])).texto).toBe("Nenhum produto cadastrado ainda");
    expect(somaResumos([a, b])).toMatchObject({ produtos: 3, repor: 1, comprar: 1 });
  });
});

const lojaA: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado Bom Preço", cidade: "Bauru", uf: "SP", rua: "Rua A", numero: "1", bairro: "Centro" };
const lojaB: StoreData = { ...lojaA, id: "c2", nome: "Farmácia Vida", tipo: "farmacia" };
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]);
  banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]); banco.carregarPendentesVenda.mockResolvedValue([]); banco.contarDiferencasParaDecidir.mockResolvedValue({ perdas: 0, diferencas: 0 }); banco.carregarCaixas.mockResolvedValue([]);
  banco.carregarProdutos.mockImplementation(async (id: string) => ({
    produtos: id === "c1" ? [tudoCerto, repor, comprar, acabou] : [prod("f1", "Dipirona", 20, 10)],
    locais: { deposito: ["Estante A"], venda: ["Gôndola 1"] },
  }));
});

describe("tela inicial, Comércios e Alertas do dono", () => {
  it("tela inicial mostra números de verdade, sem dados de exemplo", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    const resumo = within(await screen.findByRole("region", { name: "Resumo geral" }));
    await waitFor(() => expect(resumo.getByRole("button", { name: /Para resolver agora/ }).textContent).toMatch(/^1/));
    expect(resumo.getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^1/);
    expect(resumo.getByRole("button", { name: /Para comprar/ }).textContent).toMatch(/^1/);
    expect(screen.queryByText(/Dados de exemplo/)).toBeNull();
    expect(screen.getByRole("button", { name: /Vendas hoje: R\$\s?0,00/ }).textContent).toMatch(/Nenhuma venda ainda/);
    expect(screen.getByRole("button", { name: /Mercado Bom Preço/ }).textContent).toMatch(/1 para resolver agora.*1 para repor · 1 para comprar/);
    expect(screen.getByRole("button", { name: /Farmácia Vida/ }).textContent).toMatch(/Tudo certo/);
    expect(screen.getByRole("button", { name: /Alertas: 1 para resolver agora/ })).toBeTruthy();
  });
  it("Alertas: o comércio com aviso primeiro; tocar no produto abre a ficha dentro do comércio", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaB, lojaA]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Alertas" })[0]!);
    const sec = within(await screen.findByRole("region", { name: "Mercado Bom Preço" }));
    expect(screen.getByText("Farmácia Vida")).toBeTruthy(); // na lista "Tudo certo"
    fireEvent.click(sec.getByRole("button", { name: /Acabaram/ }));
    fireEvent.click(sec.getByRole("button", { name: /Café/ }));
    expect(await screen.findByRole("heading", { name: "Café" })).toBeTruthy();
  });
  it("Comércios lista cada comércio com o tipo e abre ao tocar", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Comércios" })[0]!);
    expect(await screen.findByRole("heading", { name: "Comércios" })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: /Farmácia Vida/ }).textContent).toMatch(/Farmácia · Bauru - SP.*Tudo certo.*1 produto/));
    fireEvent.click(screen.getByRole("button", { name: /Mercado Bom Preço/ }));
    expect(await screen.findByRole("button", { name: /Feijão/ })).toBeTruthy();
  });
  it("comércio que não carregou avisa e deixa tentar de novo", async () => {
    banco.carregarProdutos.mockImplementation(async (id: string) => { if (id === "c2") throw new Error("Failed to fetch"); return { produtos: [tudoCerto], locais: { deposito: [], venda: [] } }; });
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    expect(await screen.findByText(/Não foi possível atualizar algum comércio/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Farmácia Vida/ }).textContent).toMatch(/Não foi possível atualizar/);
    banco.carregarProdutos.mockImplementation(async () => ({ produtos: [tudoCerto], locais: { deposito: [], venda: [] } }));
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText(/Tudo certo! Nenhum comércio precisa de atenção agora/)).toBeTruthy();
  });
  it("vendas de hoje e vendido sem cadastro entram na tela inicial e nos alertas", async () => {
    const venda = { id: "v1", caixaId: "cx", chave: "1", numero: 1, emitidaEm: new Date().toISOString(), recebidaEm: new Date().toISOString(), total: 12345, situacao: "finalizada", canceladaEm: null, pagamentos: [], itens: [] };
    banco.carregarVendas.mockImplementation(async (id: string) => (id === "c1" ? [venda, { ...venda, id: "v2", total: 1000 }, { ...venda, id: "v3", situacao: "cancelada" }] : []));
    banco.carregarPendentesVenda.mockImplementation(async (id: string) => (id === "c2" ? [
      { id: "i1", codigoPdv: "999", codigoBarras: null, descricao: "SACOLA", qtdNota: 1, unidadeNota: "UN", valor: 10, situacao: "sem_cadastro", motivo: null, produtoId: null, vendidoEm: null },
      { id: "i2", codigoPdv: "999", codigoBarras: null, descricao: "SACOLA", qtdNota: 1, unidadeNota: "UN", valor: 10, situacao: "sem_cadastro", motivo: null, produtoId: null, vendidoEm: null },
    ] : []));
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    expect(await screen.findByRole("button", { name: /Vendas hoje: R\$\s?133,45/ })).toBeTruthy();
    expect(screen.getByText("2 vendas")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: /Farmácia Vida/ }).textContent).toMatch(/1 para resolver agora/));
    expect(screen.getByRole("button", { name: /Mercado Bom Preço/ }).textContent).toMatch(/R\$\s?133,45 vendidos hoje/);
    fireEvent.click(screen.getAllByRole("button", { name: "Alertas" })[0]!);
    const sec = within(await screen.findByRole("region", { name: "Farmácia Vida" }));
    expect(sec.getByRole("button", { name: /Vendido sem cadastro/ }).textContent).toMatch(/^1/);
    fireEvent.click(sec.getByRole("button", { name: /Vendido sem cadastro/ }));
    expect(await screen.findByRole("region", { name: "Vendas do dia" })).toBeTruthy();
  });
  it("perdas e diferenças entram em Para resolver agora e abrem a aba Diferenças", async () => {
    banco.contarDiferencasParaDecidir.mockImplementation(async (id: string) => (id === "c2" ? { perdas: 1, diferencas: 2 } : { perdas: 0, diferencas: 0 }));
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Farmácia Vida/ }).textContent).toMatch(/3 para resolver agora/));
    fireEvent.click(screen.getAllByRole("button", { name: "Alertas" })[0]!);
    const sec = within(await screen.findByRole("region", { name: "Farmácia Vida" }));
    expect(sec.getByRole("button", { name: /Perdas e diferenças/ }).textContent).toMatch(/^3/);
  });
});
