import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
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
const loja = (n: number): StoreData => ({ id: `c${n}`, tipo: "mercado", nome: `Loja ${n}`, cidade: "B", uf: "SP", rua: "R", numero: "1", bairro: "C" });
const lojas = (n: number) => Array.from({ length: n }, (_, i) => loja(i + 1));

const VERDE = "Tudo certo! Nenhum comércio precisa de atenção agora.";
const ANTERIOR = "Tudo certo na última consulta · atualizando…";
const NEUTRO = "Conferindo pendências…";
const atualizar = () => fireEvent.click(screen.getByRole("button", { name: "Atualizar painel" }));
const pendente = <T,>() => { let r!: (v: T) => void; const p = new Promise<T>((res) => { r = res; }); return { p, r }; };

/** Na primeira leitura, nada pode parecer resultado confirmado ou falha. */
function semResultadoFalso() {
  expect(screen.queryByText(VERDE)).toBeNull();
  expect(screen.queryByTestId("grade-pendencias")).toBeNull();
  expect(screen.queryByText(/R\$\s?0,00/)).toBeNull();
  expect(screen.queryByText("Consulta incompleta")).toBeNull();
  expect(screen.queryByText("—")).toBeNull();
  expect(screen.queryByText(/0 com resumo completo/)).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
}

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

describe("H2 — estabilidade na abertura do Início", () => {
  it("primeira renderização, antes dos efeitos: estado neutro, sem zero, sem falha e sem os quatro cartões", () => {
    const html = renderToStaticMarkup(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    expect(html).toContain(NEUTRO);
    expect(html).toContain("conferindo resumo…");
    expect(html).not.toContain("grade-pendencias");
    expect(html).not.toContain("com resumo completo");
    expect(html).not.toContain("Consulta incompleta");
    expect(html).not.toMatch(/R\$\s?0,00/);
    expect(html).toContain("Atualizando…");
    expect(html).toContain("Vendas hoje: consultando");
    expect(html).toContain("Faltou este mês: consultando");
  });

  it.each([1, 2, 6])("consulta lenta com %i comércio(s): neutro até terminar; depois Tudo certo", async (n) => {
    const { p, r } = pendente<typeof emDia>(); banco.carregarProdutos.mockReturnValue(p);
    render(<OwnerApp userId="u1" owner="M" initial={lojas(n)} />);
    expect(await screen.findByText(NEUTRO)).toBeTruthy();
    expect(screen.getByText(/conferindo resumo…/)).toBeTruthy();
    expect(screen.getAllByText("Consultando…").length).toBe(2);
    semResultadoFalso();
    expect(screen.getByRole("status")).toHaveTextContent(NEUTRO);
    r(emDia);
    expect(await screen.findByText(VERDE)).toBeTruthy();
    expect(screen.queryByText(NEUTRO)).toBeNull();
    expect(screen.getByText(new RegExp(`${n} com resumo completo`))).toBeTruthy();
    expect(screen.getByRole("button", { name: "Atualizar painel" })).not.toBeDisabled();
  });

  it("consulta com pendência real mostra os quatro cartões depois do neutro", async () => {
    banco.carregarProdutos.mockResolvedValue(comPendencia);
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    expect(await screen.findByTestId("grade-pendencias")).toBeTruthy();
    expect(screen.queryByText(NEUTRO)).toBeNull();
    expect(screen.queryByText(VERDE)).toBeNull();
  });

  it("carregamento misto: um comércio pronto com pendência sai do neutro e mostra subtotal", async () => {
    const { p } = pendente<typeof emDia>();
    banco.carregarProdutos.mockImplementation(async (id: string) => (id === "c1" ? comPendencia : p));
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    expect(await screen.findByTestId("grade-pendencias")).toBeTruthy();
    expect(screen.queryByText(NEUTRO)).toBeNull();
    expect(screen.getAllByText("Subtotal: 1 de 2 comércios").length).toBeGreaterThan(0);
    expect(screen.queryByText(VERDE)).toBeNull();
  });

  it("falha na primeira consulta: aviso e Consulta incompleta; nova tentativa mostra o neutro e, se falhar, o aviso volta", async () => {
    banco.carregarProdutos.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/números podem estar incompletos/);
    expect(screen.queryByText(NEUTRO)).toBeNull();
    expect(screen.getAllByText("Consulta incompleta").length).toBeGreaterThan(0);
    const { p, r } = pendente<typeof emDia>();
    banco.carregarProdutos.mockReturnValue(p.then(() => { throw new TypeError("Failed to fetch"); }));
    atualizar();
    expect(await screen.findByText(NEUTRO)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    r(emDia);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(NEUTRO)).toBeNull();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });

  it("consulta parcial (vendas indisponíveis) não vira Tudo certo nem fica no neutro", async () => {
    banco.carregarVendas.mockImplementation(async (id: string) => { if (id === "c2") throw new Error("x"); return []; });
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(NEUTRO)).toBeNull();
    expect(screen.queryByText(VERDE)).toBeNull();
    expect(screen.getByText(/1 com resumo completo/)).toBeTruthy();
  });

  it("recarga completa (novo app montado) repete o neutro, sem reaproveitar o resultado anterior", async () => {
    const primeiro = render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await screen.findByText(VERDE);
    primeiro.unmount();
    const { p } = pendente<typeof emDia>(); banco.carregarProdutos.mockReturnValue(p);
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    expect(await screen.findByText(NEUTRO)).toBeTruthy();
    expect(screen.queryByText(ANTERIOR)).toBeNull();
    semResultadoFalso();
  });

  it("atualização interna depois de Tudo certo mantém o quadro da H1, não o neutro", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await screen.findByText(VERDE);
    const { p, r } = pendente<typeof emDia>(); banco.carregarProdutos.mockReturnValue(p);
    atualizar();
    expect(await screen.findByText(ANTERIOR)).toBeTruthy();
    expect(screen.queryByText(NEUTRO)).toBeNull();
    r(emDia);
    expect(await screen.findByText(VERDE)).toBeTruthy();
  });

  it("atualização interna depois de pendência mantém os cartões, não o neutro", async () => {
    banco.carregarProdutos.mockResolvedValue(comPendencia);
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await screen.findByTestId("grade-pendencias");
    const { p } = pendente<typeof emDia>(); banco.carregarProdutos.mockReturnValue(p);
    atualizar();
    await waitFor(() => expect(screen.getByRole("button", { name: "Atualizar painel" })).toBeDisabled());
    expect(screen.getByTestId("grade-pendencias")).toBeTruthy();
    expect(screen.queryByText(NEUTRO)).toBeNull();
  });

  it("sem comércio: mensagem de sempre, sem estado neutro e sem botão travado", () => {
    render(<OwnerApp userId="u1" owner="M" initial={[]} />);
    expect(screen.getByText("Você ainda não tem comércio cadastrado.")).toBeTruthy();
    expect(screen.queryByText(NEUTRO)).toBeNull();
  });

  it("comércio sem ID válido: não fica preso no neutro nem com o botão bloqueado", () => {
    render(<OwnerApp userId="u1" owner="M" initial={[{ ...loja(1), id: "" }]} />);
    expect(screen.queryByText(NEUTRO)).toBeNull();
    expect(screen.getByRole("button", { name: "Atualizar painel" })).not.toBeDisabled();
  });

  it("carregamento misto: primeiro comércio falha e o segundo ainda espera — aviso visível na espera, sem neutro nem Tudo certo; depois o aviso final", async () => {
    const { p, r } = pendente<typeof emDia>();
    banco.carregarProdutos.mockImplementation(async (id: string) => { if (id === "c1") throw new TypeError("Failed to fetch"); return p; });
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("Não foi possível atualizar 1 comércio");
    expect(aviso).toHaveTextContent("Ainda consultando 1 comércio");
    expect(screen.queryByText(NEUTRO)).toBeNull();
    expect(screen.queryByText(VERDE)).toBeNull();
    r(emDia);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/números podem estar incompletos/));
    expect(screen.queryByText(/Ainda consultando/)).toBeNull();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
    expect(screen.queryByText(VERDE)).toBeNull();
    expect(screen.queryByText(NEUTRO)).toBeNull();
  });
});
