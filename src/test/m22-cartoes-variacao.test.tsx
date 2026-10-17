/* M22, subetapa 4: cartões de tamanho/cor da roupa não passam da borda com letra grande.
   Antes o cartão não tinha limite de largura e o texto não quebrava; com pouco espaço
   (medido em rem, então só com letra grande ou tela muito estreita) o remover vai para baixo. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const roupa: Product = { id: 1, codigo: "789", nome: "Camiseta", compra: 1000, venda: 1500, unidade: "Peça", categoria: "Camisetas", detalhes: {}, fornecedor: null,
  variacoes: [{ tam: "GG", cor: "Verde musgo escuro", codigo: "", qtd: 10, uid: "a" }] };

describe("M22 — cartões de variação", () => {
  it("cartão limitado à largura, texto que quebra e remover que desce quando falta espaço", () => {
    render(<ProductWizard store={{ id: "s", nome: "Loja", tipo: "roupas" } as never} products={[roupa]} initial={roupa} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={() => {}} />);
    const submit = () => fireEvent.submit(document.querySelector("form")!);
    submit(); submit();
    const editar = screen.getByRole("button", { name: "Editar variação" });
    const cartao = editar.parentElement!;
    expect(cartao.parentElement!.className).toContain("@container");
    expect(cartao.className).toContain("max-w-full");
    expect(cartao.className).toContain("@max-[16rem]:flex-col");
    expect(editar.querySelector("span")!.className).toContain("break-words");
    expect(editar.textContent).toContain("GG · Verde musgo escuro · sem código · 10");
    expect(screen.getByRole("button", { name: "Remover variação" }).className).toContain("@max-[16rem]:self-end");
    fireEvent.click(editar);
    expect(screen.getByRole("button", { name: "Salvar variação" })).toBeTruthy();
  });
});
