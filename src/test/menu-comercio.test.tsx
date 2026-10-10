import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { StoreSpace } from "@/components/StoreSpace";
import type { StoreData } from "@/components/StoreSetup";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));
const loja: StoreData = { id: "c1", tipo: "farmacia", nome: "Farmácia Vida Nova", cidade: "Jacarezinho", uf: "PR", rua: "r", numero: "1", bairro: "b" };
const f = () => vi.fn(async () => undefined as never);
const props = {
  store: loja, products: [], suppliers: [], saved: false, onSalvarPedido: f(), onPedidoEnviado: f(), onCancelarPedido: f(), onNovoLinkPedido: f(), onPagamentoPedido: f(),
  onAddSupplier: f(), onUpdateSupplier: f(), onBack: vi.fn(), onNew: vi.fn(), onEdit: vi.fn(), onDismissSaved: vi.fn(),
};

describe("faixa de navegação do comércio", () => {
  it("todas as 8 partes numa faixa que corre para os lados, com avisos; sem Mais", () => {
    render(<StoreSpace {...props} vendidoSemCadastro={2} diferencasDecidir={1} onAtualizar={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(loja.nome);
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeTruthy();
    const barra = within(screen.getByRole("navigation", { name: "Partes do comércio" }));
    expect(barra.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Produtos", "Estoque", "À venda", "Pedidos", "Fornecedores", "Equipe", "Vendas (2 avisos)", "Diferenças (1 aviso)",
    ]);
    expect(screen.queryByRole("button", { name: /^Mais/ })).toBeNull();
    expect(barra.getByRole("button", { name: "Produtos" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(barra.getByRole("button", { name: "Fornecedores" }));
    expect(barra.getByRole("button", { name: "Fornecedores" }).getAttribute("aria-current")).toBe("page");
    expect(barra.getByRole("button", { name: "Produtos" }).getAttribute("aria-current")).toBeNull();
  });
});

import { formatarCentavos } from "@/lib/formatacao";
describe("dinheiro", () => {
  it("menos zero aparece como R$ 0,00", () => {
    expect(formatarCentavos(-0)).toMatch(/^R\$\s0,00$/);
    expect(formatarCentavos(-150)).toMatch(/^-R\$\s1,50$/);
  });
});
