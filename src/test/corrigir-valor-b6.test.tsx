/* B6 (checklist funcional 3): "Corrigir vencimento ou valor" — o valor que a janela promete para o campo em branco
   é o mesmo que a conta usa (o que o fornecedor informou, senão o estimado só do que ele vai mandar). */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Product, Supplier } from "@/components/ProductArea";
import { PainelPedidos } from "@/components/PainelPedidos";
import { somaDias, valorConta, valorSemCorrecao } from "@/lib/pagamento";
import { hojeEm } from "@/lib/validade";
import type { Pedido } from "@/lib/pedido";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const sol: Supplier = { id: 1, nome: "Distribuidora Sol", tel: "", email: "", dbId: "f-sol" };
const cafe = { id: 1, codigo: "1", nome: "Café", compra: 500, venda: 800, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: 1,
  db: { id: "p-1", contadas: [] }, deposito: { local: "A", qtd: 40, min: 10, max: 60 } } as unknown as Product;
const acucar = { ...cafe, id: 2, codigo: "2", nome: "Açúcar", db: { id: "p-2", contadas: [] } } as unknown as Product;
const comercio = { id: "c1", tipo: "mercado", nome: "Mercado", cidade: "Ourinhos", uf: "SP", rua: "Rua X", numero: "1", bairro: "Centro" };
const hoje = hojeEm();
// 10 cafés a R$ 5 (vai mandar) + 10 açúcares a R$ 5 (o fornecedor não tem): total do pedido R$ 100, do que vem R$ 50.
const base: Pedido = {
  id: "ped-3", numero: 3, fornecedorId: "f-sol", situacao: "aceito_ajustes", canal: "whatsapp", enviadoEm: "2026-10-01T12:00:00Z", observacao: "", token: "t".repeat(64), criadoEm: "2026-10-01T11:00:00Z",
  itens: [
    { produtoId: "p-1", variacaoId: null, embalagemId: null, qtdEmbalagens: 10, qtdUnidades: 10, precoEstimado: 500, qtdConfirmada: 10, qtdRecebida: null },
    { produtoId: "p-2", variacaoId: null, embalagemId: null, qtdEmbalagens: 10, qtdUnidades: 10, precoEstimado: 500, qtdConfirmada: 0, qtdRecebida: null },
  ],
  pagamento: { situacao: "a_pagar", vencimento: somaDias(hoje, 10), pagoEm: null, valor: null },
};
function abrirCorrigir(p: Pedido) {
  render(<PainelPedidos products={[cafe, acucar]} store={comercio} suppliers={[sol]} pedidos={[p]} onSalvar={vi.fn()} onEnviado={vi.fn()}
    onCancelar={vi.fn()} onNovoLink={vi.fn()} onPagamento={vi.fn(async () => {})} onOpenProduto={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /Pedido nº 3/ }));
  fireEvent.click(screen.getByRole("button", { name: /Corrigir vencimento ou valor/ }));
  return within(screen.getByRole("dialog"));
}

describe("B6 — o campo em branco vale o que a janela diz", () => {
  it("sem valor do fornecedor: estimado só do que ele vai mandar (R$ 50), igual à conta", () => {
    expect(valorSemCorrecao(base)).toEqual(valorConta(base));
    const dlg = abrirCorrigir(base);
    expect(dlg.getByText(/Em branco, vale o total estimado do que o fornecedor vai mandar \(R\$\s50,00\)/)).toBeTruthy();
  });
  it("com valor do fornecedor: a janela diz o valor dele, não o estimado", () => {
    const p: Pedido = { ...base, resposta: { em: "2026-10-02T10:00:00Z", previsaoEntrega: somaDias(hoje, 3), valorTotal: 4590, forma: "pix", prazoDias: null, recado: "" } };
    expect(valorSemCorrecao(p)).toEqual({ valor: 4590, estimado: false });
    const dlg = abrirCorrigir(p);
    expect(dlg.getByText(/Em branco, vale o valor que o fornecedor informou \(R\$\s45,90\)/)).toBeTruthy();
  });
});
