import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { carregarPedidos, carregarRecebimentos } from "@/lib/banco";
import { PainelPedidos } from "@/components/PainelPedidos";
import type { Product, Supplier } from "@/lib/produto";
import { entregasParaDecidir } from "@/lib/resumoGeral";

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

it("a leitura real do pedido mostra a conferência recém-aberta, mesmo sem itens enviados", async () => {
  const pedidos = await carregarPedidos("c1");
  expect(pedidos[0]!.recebimento).toMatchObject({ situacao: "contando", funcionario: "Maria Souza", itens: [], concluidoEm: null });
  render(<PainelPedidos {...props} pedidos={pedidos} />);
  expect(screen.getByRole("button", { name: /Pedido nº 1/ })).toHaveTextContent("Conferência em andamento por Maria");
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 1/ }));
  expect(screen.getByRole("region", { name: "Situação do pedido" })).toHaveTextContent("Aguarde a conclusão da contagem");
  expect(screen.queryByRole("button", { name: "Enviar de novo" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Cancelar pedido" })).toBeNull();
});

it("atualizar um detalhe aberto retira as ações antigas e libera decisões somente após a conclusão", async () => {
  mock.tabelas["recebimentos"] = [];
  const tela = render(<PainelPedidos {...props} pedidos={await carregarPedidos("c1")} />);
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 1/ }));
  expect(screen.getByRole("button", { name: "Enviar de novo" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido" }));
  expect(screen.getByRole("button", { name: "Confirmar cancelamento" })).toBeTruthy();
  mock.tabelas["recebimentos"] = [{ ...recebimento }]; mock.tabelas["recebimento_itens"] = [{ ...item }];
  const contando = await carregarPedidos("c1");
  expect(entregasParaDecidir(contando)).toBe(0);
  tela.rerender(<PainelPedidos {...props} pedidos={contando} />);
  expect(screen.queryByRole("button", { name: "Confirmar cancelamento" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Enviar de novo" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Ficar com ele|Devolver|Confirmar/ })).toBeNull();
  expect(screen.queryByText(/Avise o fornecedor que o pedido foi cancelado/)).toBeNull();
  expect(screen.getByRole("region", { name: "Recebimento" })).not.toHaveTextContent("precisa da sua decisão");
  expect(screen.getByRole("region", { name: "Situação do pedido" })).toHaveTextContent("Aguarde a conclusão");
  mock.tabelas["recebimentos"] = [{ ...recebimento, situacao: "concluido", concluido_em: "2026-10-11T11:00:00Z" }];
  mock.tabelas["pedidos_compra"]![0]!["situacao"] = "recebido_parcial";
  const concluidos = await carregarPedidos("c1");
  expect(entregasParaDecidir(concluidos)).toBe(1);
  tela.rerender(<PainelPedidos {...props} pedidos={concluidos} />);
  expect(screen.getByRole("region", { name: "Recebimento" })).toHaveTextContent("Mercadoria recebida");
  expect(screen.getByRole("region", { name: "Situação do pedido" })).toHaveTextContent("decida sobre os produtos");
  expect(screen.getByRole("button", { name: "Ficar com ele (entra no estoque)" })).toBeTruthy();
  expect(props.onCancelar).not.toHaveBeenCalled(); expect(props.onEnviado).not.toHaveBeenCalled();
  expect(props.onResolverRecebimento).not.toHaveBeenCalled();
});

it("entregas avulsas abertas continuam fora do histórico e a leitura respeita o comércio", async () => {
  mock.tabelas["recebimentos"]!.push(
    { ...recebimento, id: "avulsa-aberta", pedido_id: null },
    { ...recebimento, id: "avulsa-concluida", pedido_id: null, situacao: "concluido", concluido_em: "2026-10-11T11:00:00Z" },
    { ...recebimento, id: "outro-comercio", comercio_id: "c2" },
  );
  expect((await carregarRecebimentos("c1", true)).map((r) => r.id)).toEqual(["r1"]);
  expect((await carregarRecebimentos("c1", false)).map((r) => r.id)).toEqual(["avulsa-concluida"]);
});

it("a janela de reenvio já aberta fecha quando a atualização traz a conferência", async () => {
  mock.tabelas["recebimentos"] = [];
  const tela = render(<PainelPedidos {...props} pedidos={await carregarPedidos("c1")} />);
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 1/ }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar de novo" }));
  expect(screen.getByRole("dialog", { name: "Enviar pedido nº 1" })).toBeTruthy();
  mock.tabelas["recebimentos"] = [{ ...recebimento }];
  tela.rerender(<PainelPedidos {...props} pedidos={await carregarPedidos("c1")} />);
  expect(screen.queryByRole("dialog", { name: "Enviar pedido nº 1" })).toBeNull();
  expect(props.onEnviado).not.toHaveBeenCalled();
});

it("falha ao consultar a conferência não transforma o pedido em disponível para cancelar", async () => {
  mock.erro = { message: "Failed to fetch" };
  await expect(carregarPedidos("c1")).rejects.toMatchObject(mock.erro);
});
