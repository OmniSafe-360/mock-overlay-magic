import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReceberMercadoria, type ApiReceber } from "@/components/ReceberMercadoria";
import type { ProdutoFunc } from "@/lib/recebimento";
import type { RespostaRecebimento } from "@/lib/banco";

const chave = "m".repeat(64);
const produto: ProdutoFunc = { produtoId: "arroz", variacaoId: null, embalagemId: null, nome: "Arroz", unidade: "Unidade", codigo: "789", variacao: null, controlaValidade: false, pedeLote: false, embalagens: [] };
const TXT_VENCIDO = "Este produto está vencido. Se veio vencido, marque em 'Veio quebrado ou vencido'. Ele não entra como produto bom.";

function api(resposta: RespostaRecebimento, rodadaAbrir = 0): ApiReceber {
  return {
    entregas: vi.fn(async () => ({ pedidos: [{ id: "pedido", numero: 2, fornecedor: "Distribuidora Sol", produtos: 1, previsaoEntrega: null, emContagem: false }], fornecedores: [] })),
    abrir: vi.fn(async () => ({ id: "entrega", pedidoId: "pedido", numero: 2, fornecedor: "Distribuidora Sol", situacao: "contando" as const, rodada: rodadaAbrir,
      produtos: [produto], itens: rodadaAbrir ? [{ produtoId: "arroz", variacaoId: null, situacao: "recontar" as const }] : [] })) as unknown as ApiReceber["abrir"],
    buscar: vi.fn(async () => [produto]),
    enviar: vi.fn(async () => resposta),
  };
}
async function contarEEnviar(a: ApiReceber) {
  render(<ReceberMercadoria chave={chave} api={a} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Arroz:/ }));
  const dlg = within(await screen.findByRole("dialog", { name: "Arroz" }));
  fireEvent.change(dlg.getByLabelText("Quantidade (unidades)"), { target: { value: "5" } });
  fireEvent.click(dlg.getByRole("button", { name: "Salvar contagem" }));
  fireEvent.click(await screen.findByRole("button", { name: /concluir entrega/i }));
  await screen.findByRole("button", { name: /Arroz: conte de novo/i });
}
const recontar = (extra: object): RespostaRecebimento => ({ situacao: "recontar", rodada: 1, recontar: [{ produtoId: "arroz", variacaoId: null, ...extra }], faltam: [] });

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

it("mostra o motivo 'vencido' na lista e na janela de contagem", async () => {
  await contarEEnviar(api(recontar({ motivo: "vencido" })));
  expect(screen.getByText(TXT_VENCIDO)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Arroz: conte de novo/i }));
  const dlg = within(await screen.findByRole("dialog", { name: "Arroz" }));
  expect(dlg.getByText(TXT_VENCIDO)).toBeTruthy();
});

it("lote com outra data mostra o lote e a data em dd/mm/aaaa", async () => {
  await contarEEnviar(api(recontar({ motivo: "lote_outra_data", lote: "AB12", loteData: "2027-03-05" })));
  expect(screen.getByText(/O lote AB12 já está registrado com validade 05\/03\/2027/)).toBeTruthy();
});

it("sem motivo continua com a tela antiga", async () => {
  await contarEEnviar(api(recontar({})));
  expect(screen.queryByText(/vencido|Falta o lote|já está registrado/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Arroz: conte de novo/i }));
  const dlg = within(await screen.findByRole("dialog", { name: "Arroz" }));
  expect(dlg.getByText("Conte de novo, com calma, tudo o que chegou deste produto.")).toBeTruthy();
});

it("o motivo continua depois de fechar e reabrir o app", async () => {
  await contarEEnviar(api(recontar({ motivo: "vencido" })));
  cleanup();
  render(<ReceberMercadoria chave={chave} api={api(recontar({}), 1)} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
  await screen.findByRole("button", { name: /Arroz: conte de novo/i });
  expect(screen.getByText(TXT_VENCIDO)).toBeTruthy();
});
