import { describe, expect, it, vi } from "vitest";

// B12: cancelamento que chegou sem a venda não aparece como venda; cancelamento de nota antiga explicado no Conector.
const linhas: Record<string, any[]> = {
  vendas: [
    { id: "v1", caixa_id: "c1", chave_nota: "1", numero: 10, emitida_em: "2026-10-17T10:00:00Z", recebida_em: "2026-10-17T10:00:05Z", total: 20, situacao: "cancelada", cancelada_em: "2026-10-17T11:00:00Z", pagamentos: [], origem: "conector" },
    { id: "v2", caixa_id: "c1", chave_nota: "2", numero: null, emitida_em: null, recebida_em: "2026-10-17T12:00:00Z", total: 0, situacao: "cancelada", cancelada_em: "2026-10-17T12:00:00Z", pagamentos: [], origem: "conector" },
    { id: "v3", caixa_id: "c1", chave_nota: "3", numero: 11, emitida_em: "2026-10-17T13:00:00Z", recebida_em: "2026-10-17T13:00:05Z", total: 5, situacao: "finalizada", cancelada_em: null, pagamentos: [], origem: "conector" },
  ],
  venda_itens: [
    { id: "i1", venda_id: "v1", n_item: 1, codigo_pdv: "A", descricao: "Arroz", qtd_nota: 1, valor: 20, situacao: "cancelado" },
    { id: "i3", venda_id: "v3", n_item: 1, codigo_pdv: "B", descricao: "Bala", qtd_nota: 1, valor: 5, situacao: "baixado" },
  ],
};
function consulta(tabela: string) {
  const q: any = { select: () => q, eq: () => q, gte: () => q, in: () => q, order: () => q, range: async () => ({ data: linhas[tabela] ?? [], error: null }) };
  return q;
}
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => consulta(t), rpc: vi.fn() } }));

import { carregarVendas } from "@/lib/banco";
import { processarArquivo, type ApiConector } from "@/lib/conector";

describe("B12 — vendas do Conector", () => {
  it("cancelamento sem a venda (sem itens, sem data) não entra na lista; cancelada de verdade continua", async () => {
    const vs = await carregarVendas("com", "2026-10-17T00:00:00Z");
    expect(vs.map((v) => v.id).sort()).toEqual(["v1", "v3"]);
  });
  it("Conector explica o cancelamento de nota de antes de ligar o caixa", async () => {
    const CH = "35261052998224725000650010000000041000000040".slice(0, 44);
    const xml = `<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe"><evento><infEvento Id="ID110111${CH}01"><chNFe>${CH}</chNFe><dhEvento>2026-10-10T14:40:00-03:00</dhEvento><tpEvento>110111</tpEvento></infEvento></evento><retEvento><infEvento><cStat>135</cStat></infEvento></retEvento></procEventoNFe>`;
    const api: ApiConector = { enviar: vi.fn(), cancelar: vi.fn(async () => ({ situacao: "anterior" })) };
    const r = await processarArquivo(xml, "k", api);
    expect(r).toMatchObject({ ok: true, texto: "Cancelamento de venda de antes de ligar o caixa (não conta)" });
  });
});
