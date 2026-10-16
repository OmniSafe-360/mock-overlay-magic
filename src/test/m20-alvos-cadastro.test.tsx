/* M20: botões do cadastro de produto com pelo menos 48 px (regra do projeto).
   Antes: editar/remover variação com 32 px; "Não tem código", "Usar este nome", "Não é este",
   locais sugeridos e "Apagar e deixar sem código" com 44 px. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ProductWizard, type Product } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const roupa: Product = { id: 1, codigo: "789", nome: "Camiseta", compra: 1000, venda: 1500, unidade: "Peça", categoria: "Camisetas", detalhes: {}, fornecedor: null,
  variacoes: [{ tam: "M", cor: "Azul", codigo: "222", qtd: 2, uid: "a" }] };

describe("M20 — alvos de toque do cadastro", () => {
  it("editar e remover variação com 48 px, e as mesmas ações", () => {
    render(<ProductWizard store={{ id: "s", nome: "Loja", tipo: "roupas" } as never} products={[roupa]} initial={roupa} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={() => {}} />);
    const submit = () => fireEvent.submit(document.querySelector("form")!);
    submit(); submit();
    const editar = screen.getByRole("button", { name: "Editar variação" });
    const remover = screen.getByRole("button", { name: "Remover variação" });
    expect(editar.className).toContain("min-h-12");
    expect(remover.className).toContain("h-12");
    expect(remover.className).toContain("w-12");
    fireEvent.click(editar);
    expect(screen.getByRole("button", { name: "Salvar variação" })).toBeTruthy();
  });
  it("nenhum botão do cadastro abaixo de 48 px", () => {
    const src = readFileSync("src/components/ProductArea.tsx", "utf8");
    const botoes = src.split("<button").slice(1).map((b) => b.split("</button>")[0]!);
    const pequenos = botoes.filter((b) => /\b(min-)?h-(6|7|8|9|10|11)\b/.test(b));
    expect(pequenos).toEqual([]);
    expect(src).not.toMatch(/<label className="flex min-h-11/);
  });
});
