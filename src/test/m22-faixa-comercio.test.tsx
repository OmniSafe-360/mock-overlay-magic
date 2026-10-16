/* M22 (subetapa 2): os botões da faixa do comércio crescem com a letra (largura em rem) e o nome quebra em vez de cortar. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { StoreSpace } from "@/components/StoreSpace";
import type { StoreData } from "@/components/StoreSetup";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));
const loja: StoreData = { id: "c1", tipo: "farmacia", nome: "Farmavida", cidade: "Bauru", uf: "SP", rua: "r", numero: "1", bairro: "b" };
const f = () => vi.fn(async () => undefined as never);
const props = {
  store: loja, products: [], suppliers: [], saved: false, onSalvarPedido: f(), onPedidoEnviado: f(), onCancelarPedido: f(), onNovoLinkPedido: f(), onPagamentoPedido: f(),
  onAddSupplier: f(), onUpdateSupplier: f(), onBack: vi.fn(), onNew: vi.fn(), onEdit: vi.fn(), onDismissSaved: vi.fn(),
};

describe("M22 — faixa do comércio com letra grande", () => {
  it("largura em rem e nome sem corte; as 8 partes continuam e trocam de parte igual", () => {
    render(<StoreSpace {...props} />);
    const nav = screen.getByRole("navigation", { name: "Partes do comércio" });
    const botoes = within(nav).getAllByRole("button");
    expect(botoes).toHaveLength(8);
    for (const b of botoes) {
      expect(b.className).toContain("w-[5.75rem]");
      expect(b.className).not.toContain("w-[92px]");
      const nome = b.querySelector("span")!;
      expect(nome.className).not.toContain("truncate");
      expect(nome.className).toContain("break-words");
    }
    fireEvent.click(within(nav).getByRole("button", { name: /^Fornecedores/ }));
    expect(within(nav).getByRole("button", { name: /^Fornecedores/ }).getAttribute("aria-current")).toBe("page");
  });
});
