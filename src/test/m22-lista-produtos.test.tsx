/* M22 (lista de produtos): nada cortado no cartão — o preço não some com categoria longa,
   a frase da situação quebra a linha — e filtros com 48 px. Mesmos dados e filtros. */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ListaProdutos } from "@/components/ListaProdutos";

const v = { controla: false, avisos: [], dep: {}, ven: {} };
const p = { id: 1, codigo: "1", nome: "Sabão", compra: 500, venda: 123456789, unidade: "Unidade", categoria: "Limpeza e produtos de higiene doméstica para casa",
  detalhes: {}, variacoes: [], fornecedor: null, validade: v, deposito: { local: "P2", qtd: 40, min: 10, max: 100 }, areaVenda: { local: "G3", qtd: 3, min: 5, max: 30 } };

describe("M22 — lista de produtos sem cortes", () => {
  it("categoria longa não esconde o preço; a frase da situação quebra a linha", () => {
    render(<ListaProdutos products={[p] as never} tipo="mercado" suppliers={[]} onNew={() => {}} onOpen={() => {}} />);
    const preco = screen.getByText("R$ 1.234.567,89");
    const linha = preco.parentElement!;
    expect(linha.className).not.toContain("truncate");
    expect(linha.className).toContain("break-words");
    expect(preco.className).toContain("whitespace-nowrap");
    expect(screen.getByText("Repor a gôndola").className).toContain("break-words");
  });
  it("filtros com 48 px, que não passam da largura, e funcionando igual", () => {
    render(<ListaProdutos products={[p] as never} tipo="mercado" suppliers={[]} onNew={() => {}} onOpen={() => {}} />);
    const atencao = screen.getByRole("button", { name: /Precisam de atenção/ });
    expect(atencao.className).toContain("min-h-12");
    expect(atencao.className).toContain("max-w-full");
    fireEvent.click(atencao);
    expect(atencao.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Sabão")).toBeTruthy();
  });
});
