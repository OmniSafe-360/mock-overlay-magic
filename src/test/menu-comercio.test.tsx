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

describe("barra de navegação do comércio", () => {
  it("4 partes principais + Mais, com avisos; Mais abre as outras e passa a mostrar a escolhida", () => {
    render(<StoreSpace {...props} vendidoSemCadastro={2} diferencasDecidir={1} onAtualizar={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(loja.nome);
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeTruthy();
    const barra = within(screen.getByRole("navigation", { name: "Partes do comércio" }));
    expect(barra.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Produtos", "Estoque", "À venda", "Pedidos", "Mais (3 avisos)"]);
    expect(barra.getByRole("button", { name: "Produtos" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(barra.getByRole("button", { name: "Estoque" }));
    expect(barra.getByRole("button", { name: "Estoque" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(barra.getByRole("button", { name: /^Mais/ }));
    const mais = within(screen.getByRole("list", { name: "Mais partes do comércio" }));
    expect(mais.getAllByRole("button")).toHaveLength(4);
    expect(mais.getByRole("button", { name: /^Vendas/ }).textContent).toMatch(/2$/);
    expect(mais.getByRole("button", { name: /^Diferenças/ }).textContent).toMatch(/1$/);
    fireEvent.click(mais.getByRole("button", { name: /^Fornecedores/ }));
    expect(screen.queryByRole("list", { name: "Mais partes do comércio" })).toBeNull();
    const quinto = barra.getAllByRole("button")[4]!;
    expect(quinto.getAttribute("aria-label")).toBe("Fornecedores (3 avisos)");
    expect(quinto.getAttribute("aria-current")).toBe("page");
  });
});
