import { beforeEach, expect, it, vi } from "vitest";
import { salvarPedido, conferirEnvio } from "@/lib/banco";
import { registroEnvio } from "@/lib/envios";
import type { Product } from "@/components/ProductArea";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));
beforeEach(() => { mock.rpc.mockReset(); localStorage.clear(); });
const p: Product = { id: "p1", db: { id: "p1", contadas: [] }, nome: "Arroz", codigo: "789", unidade: "Pacote", categoria: "Mercearia", compra: 1000, venda: 1500, fornecedor: "f1", detalhes: {}, variacoes: [] };
const dados = { id: "pedido1", comercioId: "c1", fornecedorId: "f1", observacao: "Primeiro pedido", linhas: [{ chave: "p1", p, variacao: null, embalagem: null, qtd: 5 }] };

it("pedido salvo sem resposta é recuperado após recarregar, com o mesmo UUID e conteúdo", async () => {
  const pedidos = new Map<string, object>();
  mock.rpc.mockImplementation(async (nome: string, { p: req }: { p: typeof dados & { id: string } }) => {
    expect(nome).toBe("salvar_pedido");
    expect(registroEnvio("u1", "c1", "pedido").ler()?.pedido).toEqual(req);
    pedidos.set(req.id, req);
    if (mock.rpc.mock.calls.length === 1) throw new TypeError("Failed to fetch");
    return { data: { id: req.id, numero: 12 }, error: null };
  });
  const s = registroEnvio("u1", "c1", "pedido").sessao(dados.id);
  await expect(salvarPedido(dados, s)).rejects.toThrow("Failed to fetch");
  const depois = registroEnvio("u1", "c1", "pedido").sessao("pedido-novo");
  const r = await salvarPedido({ ...dados, id: depois.dbId, observacao: "Alterado", linhas: [{ ...dados.linhas[0]!, qtd: 9 }] }, depois);
  expect(r).toEqual({ id: "pedido1", numero: 12, recuperado: true });
  expect(mock.rpc.mock.calls[1]![1]).toEqual(mock.rpc.mock.calls[0]![1]);
  expect(pedidos.size).toBe(1); expect(registroEnvio("u1", "c1", "pedido").ler()).toBeNull();
});
it("recuperar um cadastro não envia um pedido de compra nem monta dados novos", async () => {
  const req = { operacao_id: "op", produto_pedido: { produto: { id: "p1", comercio_id: "c1" } } };
  registroEnvio("u1", "c1", "produto").sessao("p1").guardar!({ pedido: req });
  mock.rpc.mockResolvedValue({ error: null });
  await conferirEnvio(registroEnvio("u1", "c1", "produto").sessao("novo"), "produto");
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("salvar_cadastro", { p: req });
  expect(registroEnvio("u1", "c1", "produto").ler()).toBeNull();
});
it("conferência com timeout mantém o envio para repetir; recusa confirmada libera nova tentativa", async () => {
  const reg = registroEnvio("u1", "c1", "pedido");
  reg.sessao("pedido1").guardar!({ pedido: { id: "pedido1", comercio_id: "c1" } });
  mock.rpc.mockResolvedValueOnce({ error: { message: "timeout" } }).mockResolvedValueOnce({ error: { code: "23514", message: "pedido_sem_itens" } });
  await expect(conferirEnvio(reg.sessao("novo"), "pedido")).rejects.toBeTruthy(); expect(reg.ler()).not.toBeNull();
  await expect(conferirEnvio(reg.sessao("novo"), "pedido")).rejects.toMatchObject({ message: "pedido_sem_itens" }); expect(reg.ler()).toBeNull();
});
