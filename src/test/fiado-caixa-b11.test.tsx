import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaixaCelular, type ApiCaixa } from "@/components/CaixaCelular";
import * as banco from "@/lib/banco";
import { erroCaixa } from "@/lib/caixa";
import type { EstadoCaixa } from "@/lib/banco";

// B11: receber pagamento do fiado no caixa. Erros em português; o mesmo id só repete o mesmo pagamento.
vi.mock("@/lib/banco", async (orig) => ({ ...(await orig<typeof import("@/lib/banco")>()), caixaReceberFiado: vi.fn(), caixaClienteFiadoHistorico: vi.fn(async () => []) }));
vi.mock("@/components/LeitorContinuo", () => ({ LeitorContinuo: () => null }));

const chave = "d".repeat(64);
const estado: EstadoCaixa = { nome: "Ana", comercio: { nome: "Mercado fictício", tipo: "mercado", endereco: null, telefone: null }, donoTemPin: true, vendas: [],
  turno: { id: "t-b11", abertoEm: new Date().toISOString(), trocoInicial: 0, vendas: 0, canceladas: 0, total: 0, porForma: { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 }, trocoDado: 0, sangrias: 0, dinheiroEsperado: 0 } };
const cliente = { id: "cli-b11", nome: "Maria Fictícia", telefone: null, deve: 1000, desde: new Date().toISOString(), limite: null, bloqueado: false };
const api = (): ApiCaixa => ({ estado: vi.fn(async () => estado), produtos: vi.fn(async () => []), clientes: vi.fn(async () => [cliente]), abrir: vi.fn(async () => estado.turno!),
  registrar: vi.fn(), conferir: vi.fn(async () => ({ situacao: "aprovada" as const })), foraEstoque: vi.fn(async () => []) });
const receber = vi.mocked(banco.caixaReceberFiado);
const erro = (message: string, code: string) => Object.assign(new Error(message), { code });

async function abrirConta() {
  render(<CaixaCelular chave={chave} api={api()} onSair={() => {}} mercado />);
  fireEvent.click(await screen.findByRole("button", { name: "Menu do caixa" }));
  fireEvent.click(await screen.findByRole("button", { name: /Clientes do fiado/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Maria Fictícia/ }));
}
beforeEach(() => { localStorage.clear(); receber.mockReset(); });
afterEach(() => { cleanup(); localStorage.clear(); });

describe("B11 — mensagens", () => {
  it("as recusas do recebimento vêm em português", () => {
    expect(erroCaixa(erro("valor_maior_que_a_conta", "23514"))).toMatch(/passa do que o cliente deve/);
    expect(erroCaixa(erro("cliente_nao_encontrado", "P0001"))).toMatch(/Cliente do fiado não encontrado/);
    expect(erroCaixa(erro("operacao_repetida_com_outros_dados", "P0001"))).toMatch(/já tinha sido enviado com outro valor/);
    expect(erroCaixa(erro("forma_invalida", "22023"))).toBe("Escolha Dinheiro, Pix ou Cartão.");
    expect(erroCaixa(erro("valor_invalido", "22023"))).toBe("Confira o valor.");
  });
});

describe("B11 — caixa", () => {
  it("sem internet: valor e forma travados; tentar de novo repete o mesmo pagamento", async () => {
    receber.mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce({ situacao: "registrado", deve: 0 });
    await abrirConta();
    fireEvent.click(await screen.findByRole("button", { name: "Recebeu pagamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    expect(await screen.findByText(/não registra duas vezes/)).toBeInTheDocument();
    expect(screen.getByLabelText("Valor pago")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByText("Conta em dia");
    expect(receber).toHaveBeenCalledTimes(2);
    expect(receber.mock.calls[1]).toEqual(receber.mock.calls[0]);
    expect(localStorage.getItem("omni.caixa.fiado.pendente.v1:cli-b11")).toBeNull();
  });
  it("recusa do banco: mensagem em português, campo liberado e o próximo envio usa outro id", async () => {
    receber.mockRejectedValueOnce(erro("valor_maior_que_a_conta", "23514")).mockResolvedValueOnce({ situacao: "registrado", deve: 500 });
    await abrirConta();
    fireEvent.click(await screen.findByRole("button", { name: "Recebeu pagamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    expect(await screen.findByText(/passa do que o cliente deve/)).toBeInTheDocument();
    const campo = screen.getByLabelText("Valor pago");
    expect(campo).toBeEnabled();
    fireEvent.change(campo, { target: { value: "5,00" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    await screen.findByText(/Pagamento de R\$\s?5,00 registrado/);
    expect(receber.mock.calls[1]![1]).not.toBe(receber.mock.calls[0]![1]);
    expect(receber.mock.calls[1]![4]).toBe(500);
  });
  it("pagamento sem resposta continua guardado ao fechar e abrir o caixa", async () => {
    receber.mockRejectedValueOnce(new Error("Failed to fetch"));
    await abrirConta();
    fireEvent.click(await screen.findByRole("button", { name: "Recebeu pagamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    await screen.findByText(/não registra duas vezes/);
    const id = receber.mock.calls[0]![1];
    cleanup();
    receber.mockResolvedValueOnce({ situacao: "repetida", deve: 0 });
    await abrirConta();
    expect(await screen.findByLabelText("Valor pago")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByText("Conta em dia");
    await waitFor(() => expect(receber.mock.calls[1]![1]).toBe(id));
  });
});
