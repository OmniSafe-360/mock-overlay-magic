import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaixaCelular, type ApiCaixa } from "@/components/CaixaCelular";
import type { EstadoCaixa } from "@/lib/banco";
import { acharForaEstoque, buscarForaEstoque, itemForaEstoque, limiteCarrinho, montarVenda, type ProdutoCaixa } from "@/lib/caixa";

// B10: item que o dono marcou "não controlar" (sacola, serviço) é vendido no caixa do celular, sem tirar do estoque.
vi.mock("@/components/LeitorContinuo", () => ({ LeitorContinuo: ({ onCode }: { onCode: (c: string) => void }) => <button onClick={() => onCode("7890000000017")}>ler sacola</button> }));

const chave = "c".repeat(64);
const produto: ProdutoCaixa = { id: "p-b10", nome: "Bala fictícia", unidade: "Unidade", fracionado: false, preco: 250,
  codigos: [{ codigo: "111", variacaoId: null, embalagemId: null }], variacoes: [], embalagens: [], estoques: [{ variacaoId: null, quantidade: 2 }] };
const estado: EstadoCaixa = { nome: "Ana", comercio: { nome: "Mercado fictício", tipo: "mercado", endereco: null, telefone: null }, donoTemPin: true, vendas: [],
  turno: { id: "t-b10", abertoEm: new Date().toISOString(), trocoInicial: 0, vendas: 0, canceladas: 0, total: 0, porForma: { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 }, trocoDado: 0, sangrias: 0, dinheiroEsperado: 0 } };
function api(extra: Partial<ApiCaixa> = {}): ApiCaixa {
  return { estado: vi.fn(async () => estado), produtos: vi.fn(async () => [produto]), clientes: vi.fn(async () => []), abrir: vi.fn(async () => estado.turno!),
    registrar: vi.fn(async () => ({ situacao: "registrada" as const, numero: 1, troco: 0, semCadastro: 0 })), conferir: vi.fn(async () => ({ situacao: "aprovada" as const })), ...extra };
}
const sacola = { codigo: "7890000000017", nome: "Sacola" };

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("B10 — regras", () => {
  it("acha pelo código (com ou sem zero na frente) e pelo nome", () => {
    expect(acharForaEstoque([sacola], "07890000000017")).toEqual(sacola);
    expect(acharForaEstoque([sacola], "999")).toBeNull();
    expect(buscarForaEstoque([sacola, { codigo: null, nome: "Embrulho para presente" }], "presen")).toEqual([{ codigo: null, nome: "Embrulho para presente" }]);
  });
  it("não conta no limite da gôndola e vai para o banco com o código marcado e o nome", () => {
    const i = itemForaEstoque("i1", sacola, 50);
    expect(limiteCarrinho([i], [produto])).toBeNull();
    expect(limiteCarrinho([{ ...i, foraEstoque: false }], [produto])?.motivo).toMatch(/sem cadastro/);
    const v = montarVenda("v1", "t-b10", [i], [{ forma: "dinheiro", valor: 50 }], null);
    expect(v.itens[0]).toMatchObject({ produto_id: null, codigo: "7890000000017", descricao: "Sacola", qtd: 1, preco: 0.5 });
    const avulso = montarVenda("v2", "t-b10", [itemForaEstoque("i2", { codigo: null, nome: "Embrulho" }, 100)], [{ forma: "dinheiro", valor: 100 }], null);
    expect(avulso.itens[0]).toMatchObject({ codigo: null, descricao: "Embrulho" });
  });
});

describe("B10 — caixa", () => {
  it("bipar a sacola pede o preço e põe na venda, sem aviso de estoque", async () => {
    const a = api({ foraEstoque: vi.fn(async () => [sacola]) });
    render(<CaixaCelular chave={chave} api={a} onSair={() => {}} mercado />);
    await screen.findByRole("button", { name: "ler sacola" });
    await waitFor(() => expect(a.foraEstoque).toHaveBeenCalledWith(chave));
    fireEvent.click(screen.getByRole("button", { name: "ler sacola" }));
    expect(await screen.findByText(/não sai do estoque/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Preço do item"), { target: { value: "0,50" } });
    fireEvent.click(screen.getByRole("button", { name: "Incluir" }));
    expect(await screen.findByLabelText("Quantidade de Sacola")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Receber R\$\s?0,50/ })).toBeEnabled();
    expect(screen.queryByRole("alert", { name: "Aviso de estoque" })).toBeNull();
    expect(screen.queryByText("Produto não encontrado", { selector: "h2" })).toBeNull();
  });
  it("código que não está marcado continua \"Produto não encontrado\"", async () => {
    const a = api({ foraEstoque: vi.fn(async () => []) });
    render(<CaixaCelular chave={chave} api={a} onSair={() => {}} mercado />);
    await screen.findByRole("button", { name: "ler sacola" });
    fireEvent.click(screen.getByRole("button", { name: "ler sacola" }));
    expect(await screen.findByText(/não foi encontrado no caixa/)).toBeInTheDocument();
  });
});
