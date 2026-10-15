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
const res = (p: Product[]) => ({ produtos: p, locais: { deposito: [], venda: [] } });
const emDia = res([produto("1", 20, 10)]);
const urgente = res([produto("2", 0, 0)]);   // acabou → vermelho
const atencao = res([produto("3", 20, 1)]);  // repor gôndola → amarelo
const loja = (n: number): StoreData => ({ id: `c${n}`, tipo: "mercado", nome: `Loja ${n}`, cidade: "B", uf: "SP", rua: "R", numero: "1", bairro: "C" });
const lojas = (n: number) => Array.from({ length: n }, (_, i) => loja(i + 1));
const pendente = <T,>() => { let r!: (v: T) => void; const p = new Promise<T>((x) => { r = x; }); return { p, r }; };

const sino = () => screen.getByRole("button", { name: /^Alertas/ }).closest("button")!;
const bolinha = () => sino().querySelector("span.rounded-full");
const cor = () => { const b = bolinha(); return !b ? null : b.className.includes("bg-destructive") ? "vermelha" : "amarela"; };
const VERDE = "Tudo certo! Nenhum comércio precisa de atenção agora.";

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

describe("H3 — bolinha do sino não acende só por consultar", () => {
  it("primeira renderização, antes dos efeitos: sem bolinha, nome 'Alertas; atualizando'", () => {
    const html = renderToStaticMarkup(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    const botao = html.match(/<button[^>]*aria-label="Alertas[^"]*"[^>]*>[\s\S]*?<\/button>/)![0];
    expect(botao).toContain('aria-label="Alertas; atualizando"');
    expect(botao).not.toContain("rounded-full");
  });

  it("primeira consulta lenta: sem bolinha até terminar; sem pendências continua sem bolinha", async () => {
    const { p, r } = pendente<typeof emDia>(); banco.carregarProdutos.mockReturnValue(p);
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await waitFor(() => expect(sino()).toHaveAccessibleName("Alertas; atualizando"));
    expect(bolinha()).toBeNull();
    r(emDia);
    await screen.findByText(VERDE);
    expect(sino()).toHaveAccessibleName("Alertas");
    expect(bolinha()).toBeNull();
  });

  it("Atualizar depois de Tudo certo (e voltar ao app): sem bolinha durante a consulta", async () => {
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await screen.findByText(VERDE);
    const { p, r } = pendente<typeof emDia>(); banco.carregarProdutos.mockReturnValue(p);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar painel" }));
    await waitFor(() => expect(sino()).toHaveAccessibleName("Alertas; atualizando"));
    expect(bolinha()).toBeNull();
    r(emDia); await screen.findByText(VERDE);
    const seg = pendente<typeof emDia>(); banco.carregarProdutos.mockReturnValue(seg.p);
    fireEvent(window, new Event("online"));
    await waitFor(() => expect(sino()).toHaveAccessibleName("Alertas; atualizando"));
    expect(bolinha()).toBeNull();
    seg.r(emDia); await screen.findByText(VERDE);
    expect(bolinha()).toBeNull();
  });

  it("urgência confirmada: vermelha; confirmada numa loja enquanto outra carrega também", async () => {
    const { p, r } = pendente<typeof emDia>();
    banco.carregarProdutos.mockImplementation(async (id: string) => (id === "c1" ? urgente : p));
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await waitFor(() => expect(cor()).toBe("vermelha"));
    expect(sino()).toHaveAccessibleName("Alertas: 1 para resolver agora; atualizando");
    r(emDia);
    await waitFor(() => expect(sino()).toHaveAccessibleName("Alertas: 1 para resolver agora"));
    expect(cor()).toBe("vermelha");
    fireEvent.click(sino());
    expect(await screen.findByRole("heading", { name: "Alertas" })).toBeTruthy();
  });

  it("situação de atenção confirmada: amarela", async () => {
    banco.carregarProdutos.mockResolvedValue(atencao);
    render(<OwnerApp userId="u1" owner="M" initial={lojas(1)} />);
    await waitFor(() => expect(cor()).toBe("amarela"));
    expect(sino()).toHaveAccessibleName("Alertas");
  });

  it("falha de rede: amarela e 'consulta incompleta'", async () => {
    banco.carregarProdutos.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await waitFor(() => expect(sino()).toHaveAccessibleName("Alertas; consulta incompleta"));
    expect(cor()).toBe("amarela");
  });

  it("consulta parcial terminada (vendas indisponíveis): amarela", async () => {
    banco.carregarVendas.mockImplementation(async (id: string) => { if (id === "c2") throw new Error("x"); return []; });
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await waitFor(() => expect(sino()).toHaveAccessibleName("Alertas; consulta incompleta"));
    expect(cor()).toBe("amarela");
  });

  it("falha numa loja enquanto outra carrega: amarela na hora e o nome não esconde a falha", async () => {
    const { p, r } = pendente<typeof emDia>();
    banco.carregarProdutos.mockImplementation(async (id: string) => { if (id === "c1") throw new TypeError("Failed to fetch"); return p; });
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await waitFor(() => expect(sino()).toHaveAccessibleName("Alertas; consulta incompleta; atualizando"));
    expect(cor()).toBe("amarela");
    r(emDia);
    await waitFor(() => expect(sino()).toHaveAccessibleName("Alertas; consulta incompleta"));
    expect(cor()).toBe("amarela");
  });

  it("recuperação após falha: amarela durante a nova tentativa (falha conhecida) e some quando dá certo", async () => {
    banco.carregarProdutos.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await waitFor(() => expect(cor()).toBe("amarela"));
    banco.carregarProdutos.mockResolvedValue(emDia);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByText(VERDE);
    expect(bolinha()).toBeNull();
    expect(sino()).toHaveAccessibleName("Alertas");
  });

  it("sem comércio: sem bolinha; comércio sem ID válido mantém o comportamento anterior", () => {
    const { unmount } = render(<OwnerApp userId="u1" owner="M" initial={[]} />);
    expect(bolinha()).toBeNull(); unmount();
    render(<OwnerApp userId="u1" owner="M" initial={[{ ...loja(1), id: "" }]} />);
    expect(sino()).toHaveAccessibleName("Alertas; consulta incompleta");
  });
});
