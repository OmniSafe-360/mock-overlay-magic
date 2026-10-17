import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { carregarPedidos, carregarRecebimentos } from "@/lib/banco";
import { PainelPedidos } from "@/components/PainelPedidos";
import type { Product, Supplier } from "@/lib/produto";

const mock = vi.hoisted(() => ({ tabelas: {} as Record<string, Record<string, unknown>[]>, erro: null as object | null }));
// Executa os filtros contra as linhas: um mock que devolvesse tudo esconderia o bug original.
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (tabela: string) => {
  const filtros: ((r: Record<string, unknown>) => boolean)[] = [];
  const q = {
    select: () => q, order: () => q,
    eq: (c: string, v: unknown) => { filtros.push((r) => r[c] === v); return q; },
    is: (c: string, v: unknown) => { filtros.push((r) => r[c] === v); return q; },
    not: (c: string, _op: string, v: unknown) => { filtros.push((r) => r[c] !== v); return q; },
    in: (c: string, vs: unknown[]) => { filtros.push((r) => vs.includes(r[c])); return q; },
    range: async (de: number, ate: number) => ({
      data: (mock.tabelas[tabela] ?? []).filter((r) => filtros.every((f) => f(r))).slice(de, ate + 1),
      error: tabela === "recebimentos" ? mock.erro : null,
    }),
  };
  return q;
} } }));

const fornecedor: Supplier = { id: "f1", dbId: "f1", nome: "Distribuidora", tel: "14999998888", email: "" };
const produto: Product = { id: "p1", db: { id: "p1", contadas: [] }, nome: "Arroz", codigo: "789", unidade: "Pacote", categoria: "Mercearia", compra: 100, venda: 200, fornecedor: "f1", detalhes: {}, variacoes: [] };
const props = { products: [produto], suppliers: [fornecedor],
  store: { id: "c1", tipo: "mercado", nome: "Mercado", cidade: "Jacarezinho", uf: "PR", rua: "Rua A", numero: "1", bairro: "Centro" },
  onSalvar: vi.fn(), onEnviado: vi.fn(), onCancelar: vi.fn(), onNovoLink: vi.fn(), onPagamento: vi.fn(), onOpenProduto: vi.fn(), onResolverRecebimento: vi.fn(),
};
const recebimento = { id: "r1", comercio_id: "c1", pedido_id: "pedido1", fornecedor_id: "f1", funcionario_id: "func1", situacao: "contando", iniciado_em: "2026-10-11T10:00:00Z", concluido_em: null };
const item = { id: "ri1", comercio_id: "c1", recebimento_id: "r1", produto_id: "p1", variacao_id: null, no_pedido: false, esperado: null, situacao: "fora_do_pedido", quantidade_aceita: null, avaria: 0, entrou_estoque: 0, tentativas: [{ total: 5, avaria: 0, partes: [] }] };
beforeEach(() => {
  vi.clearAllMocks(); mock.erro = null;
  mock.tabelas = {
    pedidos_compra: [{ id: "pedido1", comercio_id: "c1", numero: 1, fornecedor_id: "f1", situacao: "aceito", canal: "whatsapp", enviado_em: "2026-10-10T10:00:00Z", created_at: "2026-10-10T09:00:00Z", token: "a".repeat(64) }],
    pedido_itens: [{ id: "pi1", comercio_id: "c1", pedido_id: "pedido1", produto_id: "p1", variacao_id: null, qtd_embalagens: 10, qtd_unidades: 10, preco_estimado: 1 }],
    recebimentos: [{ ...recebimento }], recebimento_itens: [], funcionarios: [{ id: "func1", comercio_id: "c1", nome: "Maria Souza" }],
  };
});


// A2 (checklist funcional 3): o item que voltou 2 vezes por validade/lote fica "inconsistente".
// O dono precisa conseguir devolver; aceitar daria lote_com_datas_diferentes de novo.
const tentativas = [
  { total: 3, avaria: 0, partes: [{ quantidade: 3, vencimento: "2026-11-16", lote: "AB1" }], validade_recontar: true, motivo: "lote_outra_data", lote: "AB1", lote_data: "2026-12-16" },
  { total: 3, avaria: 0, partes: [{ quantidade: 3, vencimento: "2026-11-16", lote: "AB1" }], validade_recontar: true, motivo: "lote_outra_data", lote: "AB1", lote_data: "2026-12-16" },
];
async function abrir() {
  mock.tabelas["recebimentos"] = [{ ...recebimento, situacao: "concluido", concluido_em: "2026-10-17T10:00:00Z" }];
  mock.tabelas["recebimento_itens"] = [{ ...item, no_pedido: true, esperado: 3, situacao: "inconsistente", tentativas }];
  const pedidos = await carregarPedidos("c1");
  render(<PainelPedidos {...props} pedidos={pedidos} />);
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 1/ }));
  return screen.getByRole("region", { name: "Recebimento" });
}

it("lote com outra data: o dono vê o motivo e pode devolver", async () => {
  const r = await abrir();
  expect(r).toHaveTextContent("A validade ou o lote não confere com o cadastro");
  expect(r).toHaveTextContent("O lote AB1 já está no estoque com validade 16/12/2026");
  expect(r).not.toHaveTextContent("A contagem não fechou");
  // Escolher contagem daria o mesmo erro: não aparece.
  expect(screen.queryByRole("button", { name: /Confirmar/ })).toBeNull();
  props.onResolverRecebimento.mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: /Devolver/ }));
  expect(props.onResolverRecebimento).toHaveBeenCalledWith("ri1", "recusar", null);
});

it("erro do banco ao devolver aparece em português, não o código", async () => {
  await abrir();
  props.onResolverRecebimento.mockRejectedValue(new Error("item_ja_resolvido"));
  fireEvent.click(screen.getByRole("button", { name: /Devolver/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Este item já foi resolvido. Atualize a página.");
});

it("contagem que não bateu continua igual (escolher a contagem certa)", async () => {
  mock.tabelas["recebimentos"] = [{ ...recebimento, situacao: "concluido", concluido_em: "2026-10-17T10:00:00Z" }];
  mock.tabelas["recebimento_itens"] = [{ ...item, no_pedido: true, esperado: 3, situacao: "inconsistente", tentativas: [{ total: 2, avaria: 0, partes: [] }, { total: 4, avaria: 0, partes: [] }, { total: 5, avaria: 0, partes: [] }] }];
  const pedidos = await carregarPedidos("c1");
  render(<PainelPedidos {...props} pedidos={pedidos} />);
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 1/ }));
  expect(screen.getByRole("region", { name: "Recebimento" })).toHaveTextContent("A contagem não fechou");
  expect(screen.queryByRole("button", { name: /Devolver/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "4 pacotes" }));
  expect(screen.getByRole("button", { name: /Confirmar 4 pacotes/ })).toBeTruthy();
});
