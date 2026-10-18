import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { carregarPedidos, carregarRecebimentos } from "@/lib/banco";
import { PainelPedidos } from "@/components/PainelPedidos";
import type { Product, Supplier } from "@/lib/produto";
import { entregasParaDecidir } from "@/lib/resumoGeral";
import { esperaResto, produtosAindaPedidos } from "@/lib/pedido";

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
  onSalvar: vi.fn(), onEnviado: vi.fn(), onCancelar: vi.fn(), onNovoLink: vi.fn(), onPagamento: vi.fn(), onOpenProduto: vi.fn(), onResolverRecebimento: vi.fn(), onEncerrarEntrega: vi.fn(),
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


// A4: entrega em duas vezes. O pedido espera o resto e o dono pode encerrar.
const concluido = (id: string, quando: string) => ({ ...recebimento, id, situacao: "concluido", concluido_em: quando });
function parcial(encerrada: string | null) {
  mock.tabelas["pedidos_compra"] = [{ ...mock.tabelas["pedidos_compra"]![0], situacao: "recebido_parcial", entrega_encerrada_em: encerrada }];
  mock.tabelas["pedido_itens"] = [{ ...mock.tabelas["pedido_itens"]![0], qtd_recebida: 4 }];
  mock.tabelas["recebimentos"] = [concluido("r1", "2026-10-11T10:00:00Z")];
  mock.tabelas["recebimento_itens"] = [{ ...item, recebimento_id: "r1", no_pedido: true, esperado: 10, situacao: "aceito", quantidade_aceita: 4, tentativas: [{ total: 4, avaria: 0, partes: [] }, { total: 4, avaria: 0, partes: [] }] }];
}

it("chegou só parte: o dono vê o que falta e pode dizer que não vem mais nada", async () => {
  parcial(null);
  const pedidos = await carregarPedidos("c1");
  expect(esperaResto(pedidos[0]!)).toBe(true);
  render(<PainelPedidos {...props} pedidos={pedidos} />);
  expect(screen.getByRole("button", { name: /Pedido nº 1/ })).toHaveTextContent("falta chegar o resto");
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 1/ }));
  const falta = screen.getByRole("region", { name: "Falta chegar" });
  expect(falta).toHaveTextContent("A equipe vai receber o resto neste mesmo pedido");
  fireEvent.click(screen.getByRole("button", { name: "Não vem mais nada" }));
  expect(props.onEncerrarEntrega).not.toHaveBeenCalled();
  props.onEncerrarEntrega.mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar: não vem mais nada" }));
  expect(props.onEncerrarEntrega).toHaveBeenCalledWith("pedido1");
});

it("encerrado pelo dono: não espera mais nada", async () => {
  parcial("2026-10-12T10:00:00Z");
  const pedidos = await carregarPedidos("c1");
  expect(esperaResto(pedidos[0]!)).toBe(false);
  render(<PainelPedidos {...props} pedidos={pedidos} />);
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 1/ }));
  expect(screen.queryByRole("region", { name: "Falta chegar" })).toBeNull();
});

it("duas entregas aparecem no pedido e as decisões das duas contam no Atenção hoje", async () => {
  parcial(null);
  mock.tabelas["recebimentos"] = [concluido("r1", "2026-10-11T10:00:00Z"), concluido("r2", "2026-10-12T10:00:00Z")];
  mock.tabelas["recebimento_itens"]!.push({ ...item, id: "ri2", recebimento_id: "r2", situacao: "fora_do_pedido", quantidade_aceita: 2 });
  mock.tabelas["recebimento_itens"]!.push({ ...item, id: "ri3", recebimento_id: "r1", produto_id: "p9", situacao: "fora_do_pedido", quantidade_aceita: 1 });
  const pedidos = await carregarPedidos("c1");
  expect(pedidos[0]!.recebimentos!.map((r) => r.id)).toEqual(["r1", "r2"]);
  expect(entregasParaDecidir(pedidos)).toBe(2);
  render(<PainelPedidos {...props} pedidos={pedidos} />);
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 1/ }));
  expect(screen.getByRole("region", { name: "Recebimento · Entrega 1 de 2" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Recebimento · Entrega 2 de 2" })).toBeTruthy();
});

it("produto que já chegou todo deixa de contar como já pedido; o que falta continua (Codex #191)", async () => {
  parcial(null);
  mock.tabelas["pedido_itens"]!.push({ id: "pi2", comercio_id: "c1", pedido_id: "pedido1", produto_id: "p2", variacao_id: null, qtd_embalagens: 3, qtd_unidades: 3, preco_estimado: 1, qtd_recebida: 3 });
  const pedidos = await carregarPedidos("c1");
  expect([...produtosAindaPedidos(pedidos)]).toEqual(["p1"]);
  mock.tabelas["pedidos_compra"]![0]!["entrega_encerrada_em"] = "2026-10-12T10:00:00Z";
  expect([...produtosAindaPedidos(await carregarPedidos("c1"))]).toEqual([]);
});

it("C4: encerrar a entrega sem internet não fala em formulário", async () => {
  parcial(null);
  const pedidos = await carregarPedidos("c1");
  render(<PainelPedidos {...props} pedidos={pedidos} />);
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 1/ }));
  fireEvent.click(screen.getByRole("button", { name: "Não vem mais nada" }));
  props.onEncerrarEntrega.mockRejectedValue(new Error("Failed to fetch"));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar: não vem mais nada" }));
  expect(await screen.findByText("Sem conexão. Tente de novo.")).toBeInTheDocument();
  expect(screen.queryByText(/formulário/)).toBeNull();
});
