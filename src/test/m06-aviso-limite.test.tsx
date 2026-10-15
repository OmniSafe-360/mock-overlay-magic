import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaixaCelular, type ApiCaixa } from "@/components/CaixaCelular";
import { textoBloqueioCaixa, type EstadoCaixa } from "@/lib/banco";
import type { ProdutoCaixa } from "@/lib/caixa";

vi.mock("@/components/LeitorContinuo", () => ({ LeitorContinuo: ({ onCode }: { onCode: (c: string) => void }) => <button onClick={() => onCode("789")}>ler bala</button> }));

const chave = "b".repeat(64);
const produto: ProdutoCaixa = { id: "p-m06", nome: "Bala fictícia", unidade: "Unidade", fracionado: false, preco: 250,
  codigos: [{ codigo: "789", variacaoId: null, embalagemId: null }], variacoes: [], embalagens: [], estoques: [{ variacaoId: null, quantidade: 2 }] };
const estado: EstadoCaixa = { nome: "Ana", comercio: { nome: "Mercado fictício", tipo: "mercado", endereco: null, telefone: null }, donoTemPin: true, vendas: [],
  turno: { id: "t-m06", abertoEm: new Date().toISOString(), trocoInicial: 0, vendas: 0, canceladas: 0, total: 0, porForma: { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 }, trocoDado: 0, sangrias: 0, dinheiroEsperado: 0 } };
const bloqueio = (contagemSolicitada: boolean, disponivel: number | null = 2) => ({ situacao: "bloqueada" as const,
  bloqueios: [{ nome: "Bala fictícia", motivo: "estoque_insuficiente", contagemSolicitada, produtoId: produto.id, disponivel }] });
function api(extra: Partial<ApiCaixa> = {}): ApiCaixa {
  return { estado: vi.fn(async () => estado), produtos: vi.fn(async () => [produto]), clientes: vi.fn(async () => []), abrir: vi.fn(async () => estado.turno!),
    registrar: vi.fn(async () => ({ situacao: "registrada" as const, numero: 1, troco: 0, semCadastro: 0 })), conferir: vi.fn(async () => ({ situacao: "aprovada" as const })), ...extra };
}
async function abrir(a: ApiCaixa) { render(<CaixaCelular chave={chave} api={a} onSair={() => {}} mercado />); await screen.findByRole("button", { name: "ler bala" }); }
const bip = (n = 1) => { for (let i = 0; i < n; i++) fireEvent.click(screen.getByRole("button", { name: "ler bala" })); };
const qtd = () => screen.getByLabelText("Quantidade de Bala fictícia");
const PROIBIDO = /já foi avisada|equipe foi avisada|notifica|Estoque insuficiente|Limite de quantidade|A quantidade extra/;

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("M06 — textos do servidor", () => {
  it("contagem solicitada e não solicitada, com quantidade informada", () => {
    expect(textoBloqueioCaixa(bloqueio(true), [produto])).toBe("Bala fictícia: o sistema registra 2 unidades na área de venda. Contagem solicitada. Para vender mais, aguarde a conferência ou a reposição.");
    expect(textoBloqueioCaixa(bloqueio(false), [produto])).toBe("Bala fictícia: o sistema registra 2 unidades na área de venda. Confira a quantidade da venda. Se necessário, aguarde a conferência ou a reposição na área de venda.");
  });
  it("preserva sem cadastro, sem área e gôndola não contada; nunca afirma aviso entregue", () => {
    const r = { situacao: "bloqueada" as const, bloqueios: [
      { nome: "Sacola", motivo: "produto_sem_cadastro", contagemSolicitada: false },
      { nome: "Gelo", motivo: "produto_sem_area_venda", contagemSolicitada: false },
      { nome: "Café", motivo: "gondola_nao_contada", contagemSolicitada: true, disponivel: null } ] };
    const t = textoBloqueioCaixa(r);
    expect(t).toContain("Sacola: peça ao dono para cadastrar o produto antes de vender.");
    expect(t).toContain("Gelo: peça ao dono para configurar a área de venda.");
    expect(t).toContain("Café: a quantidade na área de venda ainda precisa ser conferida. Contagem solicitada.");
    expect(t).not.toMatch(PROIBIDO);
  });
});

describe("M06 — cartão do caixa", () => {
  it("estoque suficiente não mostra o cartão", async () => {
    await abrir(api()); bip(2);
    expect(qtd()).toHaveTextContent("2"); expect(screen.queryByRole("alert", { name: "Aviso de estoque" })).toBeNull();
  });

  it("limite ao bipar: conferindo, depois resposta do servidor com título neutro e carrinho mantido", async () => {
    let soltar!: (v: ReturnType<typeof bloqueio>) => void;
    const a = api({ conferir: vi.fn(() => new Promise<ReturnType<typeof bloqueio>>((r) => { soltar = r; })) });
    await abrir(a); bip(3);
    const card = await screen.findByRole("alert", { name: "Aviso de estoque" });
    expect(card).toHaveTextContent("Conferindo a quantidade…"); expect(card).toHaveTextContent("Não foi possível adicionar esta quantidade.");
    expect(screen.getByRole("button", { name: "Fechar aviso de estoque" })).toBeDisabled();
    soltar(bloqueio(true));
    await screen.findByText(/Contagem solicitada\./);
    expect(card).toHaveTextContent("Confira antes de continuar"); expect(card).not.toHaveTextContent("Quantidade não adicionada");
    expect(card).not.toHaveTextContent("Não foi possível adicionar esta quantidade.");
    expect(card).toHaveTextContent("O carrinho foi mantido."); expect(card.textContent).not.toMatch(PROIBIDO);
    expect(qtd()).toHaveTextContent("2");
  });

  it("limite pelo botão + mostra o título local quando não há resposta do servidor", async () => {
    const a = api(); delete (a as { conferir?: unknown }).conferir; await abrir(a); bip(2);
    fireEvent.click(screen.getByRole("button", { name: "Mais Bala fictícia" }));
    const card = await screen.findByRole("alert", { name: "Aviso de estoque" });
    await waitFor(() => expect(card).not.toHaveTextContent("Conferindo"));
    expect(qtd()).toHaveTextContent("2");
    expect(card.textContent?.match(/O carrinho foi mantido\./g)).toHaveLength(1);
  });

  it("fechar o aviso não libera a quantidade e nova tentativa recebe a mesma recusa", async () => {
    const a = api({ conferir: vi.fn(async () => bloqueio(false)) }); await abrir(a); bip(3);
    await screen.findByText(/Confira a quantidade da venda/);
    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso de estoque" }));
    expect(screen.queryByRole("alert", { name: "Aviso de estoque" })).toBeNull(); expect(qtd()).toHaveTextContent("2");
    bip();
    await screen.findByText(/Confira a quantidade da venda/); expect(qtd()).toHaveTextContent("2");
    expect(a.conferir).toHaveBeenCalledTimes(2);
  });

  it("erro na conferência e falta de internet usam o título neutro", async () => {
    const a = api({ conferir: vi.fn(async () => { throw new Error("falha_fictícia"); }) }); await abrir(a); bip(3);
    const card = await screen.findByRole("alert", { name: "Aviso de estoque" });
    await waitFor(() => expect(card).toHaveTextContent("Confira antes de continuar"));
    expect(card).not.toHaveTextContent("Não foi possível adicionar esta quantidade."); expect(qtd()).toHaveTextContent("2");
  });

  it("sem internet ao receber mantém o carrinho e o título neutro", async () => {
    await abrir(api()); bip(1);
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: /Receber R\$/ }));
    const card = await screen.findByRole("alert", { name: "Aviso de estoque" });
    expect(card).toHaveTextContent("Confira antes de continuar"); expect(card).toHaveTextContent(/Conecte à internet/);
    expect(qtd()).toHaveTextContent("1"); spy.mockRestore();
  });
});
