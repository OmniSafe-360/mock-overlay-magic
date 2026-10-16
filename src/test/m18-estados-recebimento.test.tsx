/* M18: a lista do recebimento fica separada pelos estados que já existem:
   "Para contar", "Pronto para enviar" e "Já enviado". Mesma contagem cega, mesmo envio. */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReceberMercadoria, type ApiReceber } from "@/components/ReceberMercadoria";
import type { ProdutoFunc } from "@/lib/recebimento";
import type { RespostaRecebimento } from "@/lib/banco";

const chave = "m".repeat(64);
const arroz: ProdutoFunc = { produtoId: "arroz", variacaoId: null, embalagemId: null, nome: "Arroz", unidade: "Unidade", codigo: "789", variacao: null, controlaValidade: false, pedeLote: false, embalagens: [] };
const feijao: ProdutoFunc = { ...arroz, produtoId: "feijao", nome: "Feijão", codigo: "790" };

function api(resposta: RespostaRecebimento): ApiReceber {
  return {
    entregas: vi.fn(async () => ({ pedidos: [{ id: "pedido", numero: 2, fornecedor: "Distribuidora Sol", produtos: 2, previsaoEntrega: null, emContagem: false }], fornecedores: [] })),
    abrir: vi.fn(async () => ({ id: "entrega", pedidoId: "pedido", numero: 2, fornecedor: "Distribuidora Sol", situacao: "contando" as const, rodada: 0,
      produtos: [arroz, feijao], itens: [] })) as unknown as ApiReceber["abrir"],
    buscar: vi.fn(async () => [arroz]),
    enviar: vi.fn(async () => resposta),
  };
}
const grupo = (nome: string) => screen.queryByRole("region", { name: nome });
const nomes = (nome: string) => within(grupo(nome)!).getAllByRole("button").map((b) => b.getAttribute("aria-label")?.split(":")[0]);

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

it("separa Para contar, Pronto para enviar e Já enviado, com o número de cada grupo", async () => {
  const a = api({ situacao: "recontar", rodada: 1, recontar: [], faltam: [{ produtoId: "feijao", variacaoId: null }], itens: [{ produtoId: "arroz", variacaoId: null, situacao: "aceito" }] } as RespostaRecebimento);
  render(<ReceberMercadoria chave={chave} api={a} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
  await screen.findByRole("button", { name: /Arroz:/ });
  expect(nomes("Para contar")).toEqual(["Arroz", "Feijão"]);
  expect(grupo("Pronto para enviar")).toBeNull();
  expect(grupo("Já enviado")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: /Arroz:/ }));
  const dlg = within(await screen.findByRole("dialog", { name: "Arroz" }));
  fireEvent.change(dlg.getByLabelText("Quantidade (unidades)"), { target: { value: "5" } });
  fireEvent.click(dlg.getByRole("button", { name: "Salvar contagem" }));
  expect(nomes("Para contar")).toEqual(["Feijão"]);
  expect(nomes("Pronto para enviar")).toEqual(["Arroz"]);
  expect(within(grupo("Pronto para enviar")!).getByText("Ainda não foi enviado: use o botão no fim da tela.")).toBeTruthy();
  expect(within(grupo("Para contar")!).getByRole("heading").textContent).toBe("Para contar1");

  fireEvent.click(screen.getByRole("button", { name: /Enviar contagens/ }));
  await screen.findByRole("region", { name: "Já enviado" });
  expect(nomes("Já enviado")).toEqual(["Arroz"]);
  expect(within(grupo("Já enviado")!).getByText("O que for aceito só entra no depósito quando a entrega for concluída.")).toBeTruthy();
  expect(nomes("Para contar")).toEqual(["Feijão"]);
  expect(grupo("Pronto para enviar")).toBeNull();
  expect(screen.queryByText(/\b5 unidades esperad|esperado/i)).toBeNull();
});
