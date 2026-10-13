import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerApp } from "@/components/OwnerHome";
import type { Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";
import type { Pedido } from "@/lib/pedido";
import { hojeEm } from "@/lib/validade";

const banco = vi.hoisted(() => ({
  carregarFornecedores: vi.fn(), carregarProdutos: vi.fn(), carregarPedidos: vi.fn(), conferirEnvio: vi.fn(),
  carregarVendas: vi.fn(), carregarPendentesVenda: vi.fn(), carregarDiferencas: vi.fn(),
  carregarLimiteFaltas: vi.fn(), carregarContagensAntifurto: vi.fn(), carregarCaixas: vi.fn(), carregarFuncionarios: vi.fn(),
}));
vi.mock("@/lib/banco", async (original) => ({ ...await original<object>(), ...banco }));
vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const produto = (id: string, nome: string, dep: number, ven: number): Product => ({
  id, db: { id, contadas: ["deposito:_", "venda:_"] }, nome, codigo: `789${id}`,
  unidade: "Unidade", categoria: "Mercearia", compra: 1000, venda: 1500, fornecedor: null, detalhes: {}, variacoes: [],
  deposito: { local: "A", qtd: dep, min: 5, max: 40 },
  areaVenda: { local: "G", qtd: ven, min: 3, max: 12 },
}) as Product;
const repor = produto("p1", "Feijão", 20, 2);
const comprar = produto("p2", "Açúcar", 2, 10);
const acabou = produto("p3", "Café", 0, 0);
const emDia = produto("p4", "Arroz", 20, 10);
const vencimentoProximo = () => {
  const data = new Date(`${hojeEm()}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + 10);
  return { ...produto("p5", "Leite", 20, 10), validade: {
    controla: true, avisos: [30], dep: {}, ven: { _: [{ id: "l1", qtd: 10, data: data.toISOString().slice(0, 10), lote: "A1" }] },
  } } as Product;
};
const a: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado Alfa", cidade: "Bauru", uf: "SP", rua: "R", numero: "1", bairro: "C" };
const b: StoreData = { ...a, id: "c2", nome: "Farmácia Beta", tipo: "farmacia" };
const produtos = (id: string): Product[] => id === "c1" ? [repor, comprar, acabou, vencimentoProximo()] : [emDia];
const abrirAssunto = async (nome: RegExp) => {
  const resumo = within(await screen.findByRole("region", { name: "Resumo geral" }));
  const botao = resumo.getByRole("button", { name: nome });
  await waitFor(() => expect(botao.textContent).not.toMatch(/^…|^—/));
  fireEvent.click(botao);
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]);
  banco.carregarProdutos.mockImplementation(async (id: string) => ({ produtos: produtos(id), locais: { deposito: [], venda: [] } }));
  banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]);
  banco.carregarPendentesVenda.mockResolvedValue([]);
  banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] });
  banco.carregarLimiteFaltas.mockResolvedValue(20000);
  banco.carregarContagensAntifurto.mockResolvedValue([]);
  banco.carregarCaixas.mockResolvedValue([]);
  banco.carregarFuncionarios.mockResolvedValue([]);
});

describe("RMC-04 / C4-B — Alertas por assunto, com dados confirmados", () => {
  it("Repor mostra apenas a loja pertinente e o grupo certo, com produto e retorno preservados", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await abrirAssunto(/Para repor/);
    expect(screen.getByRole("heading", { name: "Alertas" })).toBeTruthy();
    expect(screen.getByText("Assunto: Para repor")).toBeTruthy();
    const sec = within(await screen.findByRole("region", { name: "Mercado Alfa" }));
    expect(screen.queryByRole("region", { name: "Farmácia Beta" })).toBeNull();
    expect(sec.getByRole("button", { name: /Repor a gôndola/ })).toBeTruthy();
    expect(sec.queryByRole("button", { name: /^Comprar$/ })).toBeNull();
    expect(sec.queryByRole("button", { name: /Acabaram/ })).toBeNull();
    fireEvent.click(sec.getByRole("button", { name: /Feijão/ }));
    expect(await screen.findByRole("heading", { name: "Feijão" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Produtos" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByText("Assunto: Para repor")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver todos os alertas" }));
    expect(screen.queryByText("Assunto: Para repor")).toBeNull();
    expect(screen.getByRole("heading", { name: "Alertas" })).toBeTruthy();
  });

  it("Comprar exclui produtos que já constam de pedido aberto", async () => {
    const pedido = { situacao: "enviado", itens: [{ produtoId: "p2" }] } as unknown as Pedido;
    banco.carregarPedidos.mockResolvedValue([pedido]);
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await abrirAssunto(/Para comprar/);
    expect(screen.getByText("Assunto: Para comprar")).toBeTruthy();
    expect(screen.getByText(/Nenhuma pendência deste assunto/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Mercado Alfa" })).toBeNull();
    expect(screen.queryByText(/Tudo certo!/)).toBeNull();
  });

  it("Validade mostra apenas produtos próximos do vencimento, não os outros alertas", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await abrirAssunto(/Vence(m)? em breve/);
    expect(screen.getByText("Assunto: Vencem em breve")).toBeTruthy();
    const sec = within(screen.getByRole("region", { name: "Mercado Alfa" }));
    const detalhes = within(sec.getByRole("region", { name: "Atenção hoje" }));
    expect(detalhes.getByRole("button", { name: /Vencem em breve/ })).toBeTruthy();
    expect(sec.getByRole("button", { name: /Leite/ })).toBeTruthy();
    expect(sec.queryByRole("button", { name: /Repor a/ })).toBeNull();
    expect(sec.queryByRole("button", { name: /Comprar/ })).toBeNull();
  });

  it("Resolver mostra urgentes, sem cadastro e diferenças, nunca os grupos de repor", async () => {
    banco.carregarPendentesVenda.mockImplementation(async (id: string) => id === "c1" ? [{
      id: "i1", codigoPdv: "999", codigoBarras: null, descricao: "SACOLA", qtdNota: 1,
      unidadeNota: "UN", valor: 10, situacao: "sem_cadastro", motivo: null, produtoId: null, vendidoEm: null,
    }] : []);
    banco.carregarDiferencas.mockImplementation(async (id: string) => id === "c1" ? { diferencas: [{
      id: "d1", produtoId: "p1", variacaoId: null, area: "venda", origem: "reposicao", esperado: 10,
      contado: 8, diferenca: -2, valor: -1000, funcionario: null, situacao: "aberta", motivo: null,
      observacao: null, tentativas: [], resolvida: false, motivoInformado: null, criadaEm: new Date().toISOString(),
    }], perdas: [] } : { diferencas: [], perdas: [] });
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await abrirAssunto(/Para resolver agora/);
    expect(screen.getByText("Assunto: Para resolver agora")).toBeTruthy();
    const sec = within(await screen.findByRole("region", { name: "Mercado Alfa" }));
    expect(sec.getByRole("button", { name: /Acabaram/ })).toBeTruthy();
    expect(sec.getByRole("button", { name: /Vendido sem cadastro/ })).toBeTruthy();
    expect(sec.getByRole("button", { name: /Perda ou diferença/ })).toBeTruthy();
    expect(sec.queryByRole("button", { name: /Repor a/ })).toBeNull();
    expect(sec.queryByRole("button", { name: /^Comprar$/ })).toBeNull();
    fireEvent.click(sec.getByRole("button", { name: /Vendido sem cadastro/ }));
    expect(await screen.findByRole("region", { name: "Vendas do dia" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Voltar/ }));
    expect(await screen.findByText("Assunto: Para resolver agora")).toBeTruthy();
  });

  it("falha em uma loja após sucesso: não reutiliza contagem antiga e avisa subtotal", async () => {
    banco.carregarProdutos.mockImplementation(async () => ({ produtos: [repor], locais: { deposito: [], venda: [] } }));
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    const resumo = within(await screen.findByRole("region", { name: "Resumo geral" }));
    await waitFor(() => expect(resumo.getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^2/));
    banco.carregarProdutos.mockImplementation(async (id: string) => {
      if (id === "c2") throw new TypeError("offline");
      return { produtos: [repor], locais: { deposito: [], venda: [] } };
    });
    fireEvent(window, new Event("online"));
    await waitFor(() => expect(resumo.getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^1.*Subtotal: 1 de 2/));
    await abrirAssunto(/Para repor/);
    expect(screen.getByText(/Entre os 1 de 2 comércios conferidos/)).toBeTruthy();
    expect(screen.getByText(/Sem confirmação nesta consulta: Farmácia Beta/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Farmácia Beta" })).toBeNull();
    expect(screen.getByRole("region", { name: "Mercado Alfa" })).toBeTruthy();
  });

  it("vendas ou diferenças incompletas impedem classificação Resolver, mas não Repor", async () => {
    banco.carregarVendas.mockRejectedValue(new TypeError("offline"));
    banco.carregarDiferencas.mockRejectedValue(new TypeError("offline"));
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    const resumo = within(await screen.findByRole("region", { name: "Resumo geral" }));
    await waitFor(() => expect(resumo.getByRole("button", { name: /Para resolver agora/ }).textContent).toMatch(/^—.*Consulta incompleta/));
    fireEvent.click(resumo.getByRole("button", { name: /Para resolver agora/ }));
    expect(screen.getByText(/Entre os 0 de 1 comércios conferidos/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Mercado Alfa" })).toBeNull();
    expect(screen.queryByText(/Tudo certo!/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver todos os alertas" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Início" })[0]!);
    await abrirAssunto(/Para repor/);
    expect(screen.getByRole("region", { name: "Mercado Alfa" })).toBeTruthy();
  });

  it("falha apenas dos fornecedores aceita os indicadores de produtos confirmados", async () => {
    banco.carregarFornecedores.mockRejectedValue(new TypeError("offline"));
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await abrirAssunto(/Para repor/);
    expect(screen.getByRole("region", { name: "Mercado Alfa" })).toBeTruthy();
    expect(screen.queryByText(/Entre os 0 de 1/)).toBeNull();
  });

  it("menu e sino abrem todos os alertas e não retêm o filtro anterior", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await abrirAssunto(/Para comprar/);
    expect(screen.getByText("Assunto: Para comprar")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Alertas" })[0]!);
    expect(screen.queryByText("Assunto: Para comprar")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Início" })[0]!);
    await abrirAssunto(/Para repor/);
    const sino = screen.getByRole("button", { name: /^Alertas: \d+ para resolver agora$/ });
    fireEvent.click(sino);
    expect(screen.queryByText("Assunto: Para repor")).toBeNull();
  });
});
