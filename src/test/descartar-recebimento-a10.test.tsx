import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PainelPedidos } from "@/components/PainelPedidos";
import { ReceberMercadoria, type ApiReceber } from "@/components/ReceberMercadoria";
import type { Pedido } from "@/lib/pedido";
import type { Product, Supplier } from "@/lib/produto";
import type { RecebimentoAberto } from "@/lib/banco";
import { escopoAcesso } from "@/lib/operacaoLocal";
import { chaveRascunho, guardarRascunho, lerRascunho, novaContagem, type ProdutoFunc, type Rascunho } from "@/lib/recebimento";

// A10 (checklist funcional 3): contagem de recebimento largada no meio.
const fornecedor: Supplier = { id: "f1", dbId: "f1", nome: "Distribuidora", tel: "14999998888", email: "" };
const produto: Product = { id: "p1", db: { id: "p1", contadas: [] }, nome: "Arroz", codigo: "789", unidade: "Pacote", categoria: "Mercearia", compra: 100, venda: 200, fornecedor: "f1", detalhes: {}, variacoes: [] };
const store = { id: "c1", tipo: "mercado", nome: "Mercado", cidade: "Jacarezinho", uf: "PR", rua: "Rua A", numero: "1", bairro: "Centro" };
const contando = { id: "r1", pedidoId: "pedido1", fornecedorId: "f1", situacao: "contando" as const, concluidoEm: null, funcionario: "Maria Souza", itens: [] };
const pedido = {
  id: "pedido1", numero: 1, fornecedorId: "f1", situacao: "aceito", canal: "whatsapp", enviadoEm: "2026-10-10T10:00:00Z", observacao: "", token: "a".repeat(64),
  criadoEm: "2026-10-10T09:00:00Z", resposta: null, pagamento: { situacao: null, vencimento: null, pagoEm: null, valor: null },
  itens: [{ produtoId: "p1", variacaoId: null, embalagemId: null, qtdEmbalagens: 10, qtdUnidades: 10, precoEstimado: 1, qtdConfirmada: null, qtdRecebida: null }],
  recebimento: contando, recebimentos: [contando], entregaEncerrada: false,
} as unknown as Pedido;
const props = { products: [produto], suppliers: [fornecedor], store, onSalvar: vi.fn(), onEnviado: vi.fn(), onCancelar: vi.fn(), onNovoLink: vi.fn(),
  onPagamento: vi.fn(), onOpenProduto: vi.fn(), onResolverRecebimento: vi.fn() };

it("o dono encerra a contagem largada, com confirmação", async () => {
  const onDescartarRecebimento = vi.fn(async () => {});
  render(<PainelPedidos {...props} pedidos={[pedido]} onDescartarRecebimento={onDescartarRecebimento} />);
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 1/ }));
  fireEvent.click(screen.getByRole("button", { name: "Encerrar esta contagem" }));
  expect(screen.getByText(/Nada do que Maria contou entra no estoque/)).toBeTruthy();
  expect(onDescartarRecebimento).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar: encerrar a contagem" }));
  await waitFor(() => expect(onDescartarRecebimento).toHaveBeenCalledWith("r1"));
});

it("contagem concluída não tem o botão de encerrar", () => {
  const concluido = { ...contando, situacao: "concluido" as const, concluidoEm: "2026-10-11T10:00:00Z" };
  render(<PainelPedidos {...props} pedidos={[{ ...pedido, situacao: "recebido", recebimento: concluido, recebimentos: [concluido] } as unknown as Pedido]} onDescartarRecebimento={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 1/ }));
  expect(screen.queryByRole("button", { name: "Encerrar esta contagem" })).toBeNull();
});

const chave = "c".repeat(64);
const pf: ProdutoFunc = { produtoId: "arroz", variacaoId: null, embalagemId: null, nome: "Arroz", unidade: "Unidade", codigo: "789", variacao: null, controlaValidade: false, pedeLote: false, embalagens: [] };
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

it("celular com a contagem encerrada pelo dono apaga o guardado e começa outra do zero", async () => {
  const kr = chaveRascunho("pedido1", await escopoAcesso(chave));
  const antigo: Rascunho = { id: "contagem-antiga", pedidoId: "pedido1", fornecedorId: null, rodada: 1,
    contagens: { "arroz:_": { ...novaContagem(pf), soltas: "7" } }, estados: { "arroz:_": "contado" } };
  guardarRascunho(kr, antigo);
  const aberto = (id: string): RecebimentoAberto => ({ id, rodada: 0, situacao: "contando", pedidoId: "pedido1", numero: 1, fornecedor: "Distribuidora", produtos: [pf], itens: [] });
  const api: ApiReceber = {
    entregas: vi.fn(async () => ({ pedidos: [{ id: "pedido1", numero: 1, fornecedor: "Distribuidora", previsao: null, hoje: false, emContagem: false }], fornecedores: [] })) as never,
    abrir: vi.fn(async (_c: string, id: string) => { if (id === "contagem-antiga") throw new Error("recebimento_descartado"); return aberto(id); }),
    buscar: vi.fn(async () => [pf]),
    enviar: vi.fn(async () => ({ situacao: "concluido" as const, rodada: 1, produtos: 1, avisos: false })),
  };
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /Pedido nº 1/ }));
  await waitFor(() => expect(api.abrir).toHaveBeenCalledTimes(2));
  const novo = vi.mocked(api.abrir).mock.calls[1]![1];
  expect(novo).not.toBe("contagem-antiga");
  expect(screen.queryByText(/7 unidades/)).toBeNull();
  expect(lerRascunho(kr)?.id).not.toBe("contagem-antiga");
});
