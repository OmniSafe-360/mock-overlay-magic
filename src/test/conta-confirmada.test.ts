import { describe, it, expect } from "vitest";
import { valorConta } from "@/lib/pagamento";
const item = (o: any) => ({ qtdEmbalagens: 2, qtdUnidades: 24, precoEstimado: 1, qtdConfirmada: null, qtdRecebida: null, ...o });
const ped = (itens: any[], resposta: any = null) => ({ itens, resposta, pagamento: null } as any);
describe("B6 conta estimada", () => {
  it("item que o fornecedor não tem não entra", () => {
    expect(valorConta(ped([item({ qtdConfirmada: 2 }), item({ qtdConfirmada: 0 })], { valorTotal: null })).valor).toBe(24);
  });
  it("quantidade ajustada entra proporcional", () => {
    expect(valorConta(ped([item({ qtdConfirmada: 1 })], { valorTotal: null })).valor).toBe(12);
  });
  it("sem resposta soma tudo", () => {
    expect(valorConta(ped([item({}), item({})])).valor).toBe(48);
  });
});
