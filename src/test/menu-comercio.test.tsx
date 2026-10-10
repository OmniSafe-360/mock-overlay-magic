import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { StoreSpace } from "@/components/StoreSpace";
import type { StoreData } from "@/components/StoreSetup";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));
const loja: StoreData = { id: "c1", tipo: "farmacia", nome: "Farmácia Vida Nova do Centro de Jacarezinho", cidade: "Jacarezinho", uf: "PR", rua: "r", numero: "1", bairro: "b" };
const f = () => vi.fn(async () => undefined as never);
const props = {
  store: loja, products: [], suppliers: [], saved: false, onSalvarPedido: f(), onPedidoEnviado: f(), onCancelarPedido: f(), onNovoLinkPedido: f(), onPagamentoPedido: f(),
  onAddSupplier: f(), onUpdateSupplier: f(), onBack: vi.fn(), onNew: vi.fn(), onEdit: vi.fn(), onDismissSaved: vi.fn(),
};

describe("menu ☰ do comércio", () => {
  it("mostra a parte atual, abre o menu com todas as partes e troca", () => {
    render(<StoreSpace {...props} vendidoSemCadastro={2} diferencasDecidir={1} onAtualizar={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(loja.nome);
    expect(screen.getAllByRole("heading", { level: 2 })[0]!.textContent).toBe("Produtos");
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu (3 avisos)" }));
    const menu = within(screen.getByRole("navigation", { name: "Partes do comércio" }));
    expect(menu.getAllByRole("button")).toHaveLength(8);
    expect(menu.getByRole("button", { name: /^Estoque/ })).toBeTruthy();
    expect(menu.getByRole("button", { name: /^Área de venda/ })).toBeTruthy();
    expect(menu.getByRole("button", { name: /^Produtos/ }).getAttribute("aria-current")).toBe("page");
    expect(menu.getByRole("button", { name: /^Vendas/ }).textContent).toMatch(/2$/);
    expect(menu.getByRole("button", { name: /^Diferenças/ }).textContent).toMatch(/1$/);
    fireEvent.click(menu.getByRole("button", { name: /^Fornecedores/ }));
    expect(screen.queryByRole("navigation", { name: "Partes do comércio" })).toBeNull();
    expect(screen.getAllByRole("heading", { level: 2 })[0]!.textContent).toBe("Fornecedores");
  });
});
