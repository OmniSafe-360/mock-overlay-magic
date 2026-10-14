import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerApp } from "@/components/OwnerHome";
import type { Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";

const banco = vi.hoisted(() => ({
  carregarFornecedores: vi.fn(), carregarProdutos: vi.fn(), carregarPedidos: vi.fn(), conferirEnvio: vi.fn(),
  carregarVendas: vi.fn(), carregarPendentesVenda: vi.fn(), carregarDiferencas: vi.fn(),
  carregarLimiteFaltas: vi.fn(), carregarContagensAntifurto: vi.fn(),
  carregarCaixas: vi.fn(), carregarFuncionarios: vi.fn(),
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
const a: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado Alfa", cidade: "Bauru", uf: "SP", rua: "Rua", numero: "1", bairro: "Centro" };
const b: StoreData = { ...a, id: "c2", nome: "Farmácia Beta", tipo: "farmacia" };
const resumo = () => within(screen.getByRole("region", { name: "Resumo geral" }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]);
  banco.carregarProdutos.mockResolvedValue({ produtos: [produto], locais: { deposito: [], venda: [] } });
  banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]);
  banco.carregarPendentesVenda.mockResolvedValue([]);
  banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] });
  banco.carregarLimiteFaltas.mockResolvedValue(20000);
  banco.carregarContagensAntifurto.mockResolvedValue([]);
  banco.carregarCaixas.mockResolvedValue([]);
  banco.carregarFuncionarios.mockResolvedValue([]);
});

describe("RMC — Início compacto, somente apresentação móvel", () => {
  it("mantém os seis indicadores e a ordem original, valores, datas, estados e atalhos", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await waitFor(() => expect(resumo().getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^1/));
    expect(screen.getByText("Visão geral dos seus comércios")).toBeInTheDocument();
    expect(screen.getByText(/1 comércio cadastrado/)).toBeInTheDocument();
    expect(resumo().getByRole("heading", { level: 2 })).toHaveTextContent("Situação dos comércios");
    const grupos = resumo().getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
    expect(grupos[0]).toMatch(/^Resultado de hoje/);
    expect(grupos[1]).toBe("Pendências que precisam de atenção");
    expect(grupos[2]).toMatch(/^Resultado deste mês/);
    expect(resumo().getByRole("button", { name: /^Vendas hoje:/ })).toHaveTextContent(/R\$/);
    expect(resumo().getByRole("button", { name: /^Vendas hoje:/ })).toHaveTextContent("Ver vendas");
    expect(resumo().getByRole("button", { name: /^Faltou este mês:/ })).toHaveTextContent(/R\$/);
    expect(resumo().getByRole("button", { name: /^Faltou este mês:/ })).toHaveTextContent("Ver antifurto");
    for (const label of ["Para resolver agora", "Para repor", "Para comprar", "Vencem em breve"]) {
      expect(resumo().getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(resumo().getByRole("button", { name: "Atualizar painel" })).toBeEnabled();
    expect(banco.conferirEnvio).not.toHaveBeenCalled();
  });

  it("usa classes móveis compactas sem esconder elementos obrigatórios, sem mexer no menu", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await waitFor(() => expect(resumo().getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^1/));
    const main = screen.getByRole("main");
    expect(main.className).toContain("pt-2");
    expect(main.className).toContain("md:pt-5");
    expect(main.className).toContain("pb-[calc(4.5rem+env(safe-area-inset-bottom))]");
    const wrapper = screen.getByRole("region", { name: "Resumo geral" }).parentElement!;
    expect(wrapper.className).toContain("space-y-2.5");
    expect(wrapper.className).toContain("md:space-y-8");
    for (const id of ["cartao-vendas", "cartao-faltou"]) {
      const cartao = resumo().getByTestId(id);
      expect(cartao.className).toContain("p-2.5");
      expect(cartao.className).toContain("md:p-4");
      expect(cartao.className).toContain("flex-wrap");
      expect(cartao.className).toContain("@[26rem]:flex-nowrap");
      expect(cartao.className).not.toMatch(/overflow-hidden|truncate/);
      expect(cartao.parentElement!.className).toContain("@container");
      const status = within(cartao).getByTestId("status-cartao");
      expect(status.className).toContain("w-full");
      expect(status.className).toContain("@[26rem]:w-auto");
      expect(status.className).toContain("justify-between");
    }
    const g = resumo().getByTestId("grade-pendencias");
    expect(g.className).toContain("grid-cols-1");
    expect(g.className).toContain("@[18rem]:grid-cols-2");
    expect(g.className).toContain("@[52rem]:grid-cols-4");
    expect(g.className).toContain("gap-2");
    expect(g.parentElement!.className).toContain("@container");
    for (const button of resumo().getAllByRole("button", { name: /Para resolver agora|Para repor|Para comprar|Vencem em breve/ })) {
      expect(button.className).toContain("p-2.5");
      expect(button.className).toContain("md:p-4");
    }
    expect(screen.getAllByRole("button", { name: "Início" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Comércios" })).toHaveLength(2);
  });

  it("descrições secundárias continuam no DOM e acessíveis, sem truncar moeda, número ou status", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await waitFor(() => expect(resumo().getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^1/));
    const financeiro = resumo().getByTestId("cartao-vendas");
    const mensal = resumo().getByTestId("cartao-faltou");
    const vendaDescricao = within(financeiro).getByText("Valor das vendas finalizadas hoje");
    const mesDescricao = within(mensal).getByText("Valor das faltas identificadas nas diferenças do estoque neste mês");
    expect(vendaDescricao.className).toContain("max-md:sr-only");
    expect(mesDescricao.className).toContain("max-md:sr-only");
    const descricoes = [
      "Pendências urgentes de vários tipos, não só produtos",
      "Produtos para repor na área de venda",
      "Produtos para comprar, fora os já pedidos",
      "Produtos com validade perto do fim",
    ];
    for (const d of descricoes) {
      const el = resumo().getByText(d);
      expect(el.className).toContain("max-md:sr-only");
      expect(el).toBeInTheDocument();
    }
    expect(financeiro).toHaveTextContent("Nenhuma venda ainda");
    expect(financeiro).toHaveTextContent("Ver vendas");
    expect(mensal).toHaveTextContent("Ver antifurto");
  });

  it.each([
    ["Para resolver agora", "Assunto: Para resolver agora"],
    ["Para repor", "Assunto: Para repor"],
    ["Para comprar", "Assunto: Para comprar"],
    ["Vencem em breve", "Assunto: Vencem em breve"],
  ])("mantém destino funcional de %s", async (label, assunto) => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    await waitFor(() => expect(resumo().getByRole("button", { name: /Para repor/ }).textContent).toMatch(/^1/));
    fireEvent.click(resumo().getByRole("button", { name: new RegExp(label) }));
    expect(screen.getByRole("heading", { name: "Alertas" })).toBeInTheDocument();
    expect(screen.getByText(assunto)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver todos os alertas" })).toBeInTheDocument();
  });

  it("comércio e abas diferentes preservam espaçamentos antigos; zero lojas preserva acesso ao cadastro", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={[a]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Comércios" })[0]!);
    expect(screen.getByRole("main").className).toContain("pt-5");
    expect(screen.getByRole("main").className).toContain("pb-[calc(6rem+env(safe-area-inset-bottom))]");
    const comerc = within(screen.getByRole("region", { name: "Mercado Alfa" }));
    expect(comerc.getByRole("button", { name: /Entrar no Mercado Alfa/ })).toBeInTheDocument();
  });

  it("consulta parcial mantém subtotal e botão de tentar, sem falsa informação completa", async () => {
    banco.carregarProdutos.mockImplementation(async (id: string) => {
      if (id === "c2") throw new Error("offline");
      return { produtos: [produto], locais: { deposito: [], venda: [] } };
    });
    render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
    await waitFor(() => expect(resumo().getByRole("button", { name: /Para repor/ }).textContent).toContain("Subtotal: 1 de 2 comércios"));
    expect(resumo().getByRole("button", { name: /Para repor/ })).toHaveTextContent("Subtotal: 1 de 2 comércios");
    expect(resumo().getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(resumo().getByTestId("grade-pendencias").className).toContain("@[18rem]:grid-cols-2");
    expect(resumo().getByRole("button", { name: "Atualizar painel" })).toBeEnabled();
  });

  it("sem lojas mantém aviso e acesso de cadastro sem cartões fictícios", () => {
    render(<OwnerApp userId="u1" owner="M" initial={[]} />);
    expect(screen.getByText("Você ainda não tem comércio cadastrado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para Comércios" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Resumo geral" })).toBeNull();
  });
});
