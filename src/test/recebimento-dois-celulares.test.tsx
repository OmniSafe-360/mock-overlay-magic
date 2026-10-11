import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReceberMercadoria, type ApiReceber } from "@/components/ReceberMercadoria";
import type { ProdutoFunc } from "@/lib/recebimento";

const chave = "b".repeat(64);
const mk = (id: string, nome: string): ProdutoFunc => ({ produtoId: id, variacaoId: null, embalagemId: null, nome, unidade: "Unidade", codigo: id, variacao: null, controlaValidade: false, pedeLote: false, embalagens: [] });
const arroz = mk("arroz", "Arroz"), feijao = mk("feijao", "Feijão");
function api(rodada: number, itens: { produtoId: string; variacaoId: null; situacao: "recontar" | "aceito" }[]): ApiReceber {
  return {
    entregas: vi.fn(async () => ({ pedidos: [{ id: "pedido", numero: 2, fornecedor: "Distribuidora Sol", produtos: 2, previsaoEntrega: null, emContagem: false }], fornecedores: [] })),
    abrir: vi.fn(async () => ({ id: "entrega", pedidoId: "pedido", numero: 2, fornecedor: "Distribuidora Sol", situacao: "contando" as const, rodada, produtos: [arroz, feijao], itens })) as unknown as ApiReceber["abrir"],
    buscar: vi.fn(async () => [arroz, feijao]),
    enviar: vi.fn(),
  } as unknown as ApiReceber;
}
async function contar(nome: string, q: string) {
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${nome}:`) }));
  const dlg = within(await screen.findByRole("dialog", { name: nome }));
  fireEvent.change(dlg.getByLabelText("Quantidade (unidades)"), { target: { value: q } });
  fireEvent.click(dlg.getByRole("button", { name: "Salvar contagem" }));
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); });

it("B8: outro celular enviou antes — guarda o que só este contou e avisa", async () => {
  render(<ReceberMercadoria chave={chave} api={api(0, [])} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
  await contar("Arroz", "5");
  await contar("Feijão", "7");
  cleanup();
  render(<ReceberMercadoria chave={chave} api={api(1, [{ produtoId: "arroz", variacaoId: null, situacao: "aceito" }])} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
  expect(await screen.findByText(/Outra pessoa enviou contagens desta entrega/)).toBeTruthy();
  expect(screen.getByText(/Guardamos o que só você contou/)).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Feijão:/ }).getAttribute("aria-label") ?? screen.getByRole("button", { name: /^Feijão:/ }).textContent).not.toMatch(/falta contar/i);
});
