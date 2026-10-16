/* Com letra grande no celular, os quadros do "Atenção hoje" ficavam em 2 colunas estreitas e o texto vazava.
   Medido no Chromium (320 px, letra 200%): 9 quadros com texto para fora antes; 0 depois, 1 por linha.
   No jsdom não há medida de tela: confere as classes que escolhem as colunas pelo espaço do quadro (em rem). */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Product } from "@/components/ProductArea";
import { AtencaoHoje } from "@/components/AtencaoHoje";

const p = { id: 1, codigo: "1", nome: "Feijão", compra: 100, venda: 200, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: 1,
  validade: { controla: false, avisos: [], dep: {}, ven: {} }, deposito: { local: "A", qtd: 40, min: 10, max: null }, areaVenda: { local: "G", qtd: 3, min: 5, max: null } } as unknown as Product;

describe("Atenção hoje com letra grande", () => {
  it("as colunas dependem do espaço do quadro: 1, 2 a partir de 14rem e 3 a partir de 30rem", () => {
    render(<AtencaoHoje products={[p]} tipo="mercado" suppliers={[]} onOpen={() => {}} />);
    const quadro = screen.getByRole("button", { name: /Repor a gôndola/ });
    const grade = quadro.parentElement!;
    expect(grade.className).toMatch(/\bgrid-cols-1\b/);
    expect(grade.className).toContain("@[14rem]:grid-cols-2");
    expect(grade.className).toContain("@[30rem]:grid-cols-3");
    expect(grade.parentElement!.className).toContain("@container");
  });
});
