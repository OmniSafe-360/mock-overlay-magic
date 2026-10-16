/* O sino perdia a bolinha de uma pendência já confirmada enquanto o painel atualizava (limitação anotada na H3). */
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

const sino = () => { const b = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Alertas"]')); expect(b).toHaveLength(1); return b[0]!; };
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

describe("sino durante o Atualizar", () => {
  it("pendência vermelha já confirmada continua no sino enquanto atualiza e sai quando a nova leitura resolve", async () => {
    banco.carregarProdutos.mockResolvedValue(urgente);
    render(<OwnerApp userId="u1" owner="M" initial={lojas(1)} />);
    await waitFor(() => expect(cor()).toBe("vermelha"));
    const { p, r } = pendente<typeof emDia>(); banco.carregarProdutos.mockReturnValue(p);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar painel" }));
    await waitFor(() => expect(sino()).toHaveAccessibleName(/atualizando/));
    expect(cor()).toBe("vermelha");
    r(emDia); await screen.findByText(VERDE);
    expect(bolinha()).toBeNull();
  });

  it("amarela já confirmada continua amarela enquanto atualiza", async () => {
    banco.carregarProdutos.mockResolvedValue(atencao);
    render(<OwnerApp userId="u1" owner="M" initial={lojas(2)} />);
    await waitFor(() => expect(cor()).toBe("amarela"));
    const { p, r } = pendente<typeof atencao>(); banco.carregarProdutos.mockReturnValue(p);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar painel" }));
    await waitFor(() => expect(sino()).toHaveAccessibleName(/atualizando/));
    expect(cor()).toBe("amarela");
    r(atencao);
    await waitFor(() => expect(sino()).not.toHaveAccessibleName(/atualizando/));
    expect(cor()).toBe("amarela");
  });
});
