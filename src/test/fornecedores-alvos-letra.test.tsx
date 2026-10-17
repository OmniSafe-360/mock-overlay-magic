/* Fornecedores: botões com pelo menos 48 px (regra do projeto) e cartão que não espreme o nome
   nem sobrepõe os contatos com letra grande (menos de 12 rem de espaço, só com letra grande). */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { PainelFornecedores } from "@/components/PainelFornecedores";
import type { Product, Supplier } from "@/components/ProductArea";

const sol: Supplier = { id: 1, nome: "Distribuidora Sol", tel: "11988887777", email: "vendas@sol.com.br", dbId: "a" };
const arroz: Product = { id: 9, codigo: "9", nome: "Arroz", compra: 100, venda: 200, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: 1,
  deposito: { local: "A", qtd: 6, min: 10, max: null }, areaVenda: { local: "G", qtd: 12, min: 5, max: null } };

describe("Fornecedores — alvos e letra grande", () => {
  it("nenhum botão abaixo de 48 px", () => {
    const src = readFileSync("src/components/PainelFornecedores.tsx", "utf8");
    const botoes = src.split("<button").slice(1).map((b) => b.split(">")[0]!);
    expect(botoes.filter((b) => /\b(min-)?h-(6|7|8|9|10|11)\b/.test(b))).toEqual([]);
  });
  it("cartão mede o próprio espaço: nome em linha inteira, contatos um embaixo do outro, mesmas ações", () => {
    const onUpdate = vi.fn(async () => {});
    render(<PainelFornecedores products={[arroz]} tipo="mercado" suppliers={[sol]} onOpen={() => {}} onAdd={async () => 2} onUpdate={onUpdate} />);
    const cartao = screen.getByRole("region", { name: "Distribuidora Sol" });
    expect(cartao.className).toContain("@container");
    const c = within(cartao);
    expect(c.getByRole("heading", { name: "Distribuidora Sol" }).parentElement!.className).toContain("@max-[12rem]:basis-full");
    const wa = c.getByRole("link", { name: /WhatsApp/ });
    expect(wa.parentElement!.className).toContain("@max-[12rem]:grid-cols-1");
    expect(wa.className).toContain("@max-[12rem]:flex-row");
    expect(wa.getAttribute("href")).toBe("https://wa.me/5511988887777");
    const editar = c.getByRole("button", { name: "Editar Distribuidora Sol" });
    expect(editar.className).toContain("h-12");
    fireEvent.click(c.getByRole("button", { name: /1 produto neste comércio/ }));
    expect(c.getByRole("button", { name: /Arroz/ }).className).toContain("min-h-12");
    fireEvent.click(editar);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
