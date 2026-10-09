import { beforeEach, expect, it, vi } from "vitest";
import { carregarProdutos } from "@/lib/banco";

const mock = vi.hoisted(() => ({ revisoes: [] as (number | null)[], leituras: 0, erro: null as object | null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (tabela: string) => {
  let head = false;
  const q = {
    select: (_: string, op?: { head: boolean }) => { head = !!op?.head; return q; },
    eq: () => q, is: () => q, gt: () => q, order: () => q,
    then: (ok: (v: object) => void, erro: (e: unknown) => void) => {
      if (!head || tabela !== "operacoes") throw new Error("consulta inesperada");
      return Promise.resolve({ count: mock.revisoes.shift(), error: mock.erro }).then(ok, erro);
    },
    range: async () => {
      if (tabela === "produtos") mock.leituras++;
      const dados: Record<string, object[]> = {
        produtos: [{ id: "p1", nome: "Arroz", unidade: "Kg", preco_compra: 10, preco_venda: 15 }],
        produto_areas: [{ produto_id: "p1", area: "deposito" }],
        contagens: [{ produto_id: "p1", area: "deposito", quantidade: 100 }],
        saldos: [{ id: "s1", produto_id: "p1", area: "deposito", quantidade: mock.leituras === 1 ? 90 : 3 }],
      };
      return { data: dados[tabela] ?? [], error: null };
    },
  };
  return q;
} } }));
beforeEach(() => { mock.leituras = 0; mock.revisoes = []; mock.erro = null; });

it("descarta leitura atravessada por uma operação e publica apenas o conjunto estável", async () => {
  mock.revisoes = [1, 2, 2, 2];
  const r = await carregarProdutos("c1", []);
  expect(r.produtos[0]!.deposito?.qtd).toBe(3);
  expect(mock.leituras).toBe(2);
});
it("três leituras atravessadas por alterações geram erro, nunca estoque parcial", async () => {
  mock.revisoes = [1, 2, 2, 3, 3, 4];
  await expect(carregarProdutos("c1", [])).rejects.toThrow("dados_em_atualizacao");
  expect(mock.leituras).toBe(3);
});
it("revisão indisponível não é tratada como zero operações", async () => {
  mock.revisoes = [null];
  await expect(carregarProdutos("c1", [])).rejects.toThrow("revisao_do_estoque_indisponivel");
  expect(mock.leituras).toBe(0);
});
it("falha de acesso ao registro das operações interrompe a leitura", async () => {
  mock.erro = { message: "permission denied", code: "42501" };
  await expect(carregarProdutos("c1", [])).rejects.toMatchObject({ code: "42501" });
  expect(mock.leituras).toBe(0);
});
