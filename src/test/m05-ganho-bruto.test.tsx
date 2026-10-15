import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, brl2, type Product } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const store = { id: "m1", nome: "Mercado", tipo: "mercado" } as never;
const base: Product = { id: 3, codigo: "789", nome: "Arroz", compra: 1000, venda: 1300, unidade: "Unidade", categoria: "Mercearia",
  detalhes: {}, variacoes: [], fornecedor: null };

function abrir(p: Product) {
  render(<ProductWizard store={store} products={[p]} initial={p} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={vi.fn()} />);
  fireEvent.submit(document.querySelector("form")!);
  return (id: string) => document.getElementById(id) as HTMLInputElement;
}
const frase = (un: string) => `Ganho bruto por ${un}, antes de impostos e despesas. A porcentagem é calculada sobre o preço de compra.`;

describe("M05 — explicação do ganho bruto", () => {
  it("aparece na edição com a unidade, sem mudar os valores (R$ 10,00 → R$ 13,00 = R$ 3,00 e 30%)", () => {
    const campo = abrir(base);
    expect(screen.getByTestId("ganho-bruto").textContent).toBe(frase("unidade"));
    expect(screen.getByText("Lucro por unidade")).toBeTruthy();
    expect(screen.getByText("Lucro sobre o custo (%)")).toBeTruthy();
    expect(screen.getByText("Lucro por unidade").nextElementSibling?.textContent).toBe(brl2(300));
    expect(campo("ganho").value).toBe("30");
    expect(screen.getByTestId("ganho-bruto").textContent).not.toMatch(/líquido/i);
  });

  it.each([["Kg", "Kg"], ["Litro", "litro"]])("acompanha a unidade %s", (unidade, esperado) => {
    abrir({ ...base, unidade });
    expect(screen.getByTestId("ganho-bruto").textContent).toBe(frase(esperado));
  });

  it("sem unidade escolhida usa 'unidade'", () => {
    abrir({ ...base, unidade: "" });
    expect(screen.getByTestId("ganho-bruto").textContent).toBe(frase("unidade"));
  });

  it("aparece no cadastro novo", () => {
    render(<ProductWizard store={store} products={[]} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={vi.fn()} />);
    fireEvent.change(document.querySelector('input[name="codigo"]')!, { target: { value: "7891000100103" } });
    fireEvent.change(document.querySelector('input[name="nome"]')!, { target: { value: "Leite" } });
    fireEvent.submit(document.querySelector("form")!);
    expect(screen.getByTestId("ganho-bruto").textContent).toBe(frase("unidade"));
  });

  it("% continua recalculando a venda e o aviso de prejuízo continua", () => {
    const campo = abrir(base);
    fireEvent.change(campo("ganho"), { target: { value: "50" } });
    expect(campo("venda").value).toBe(brl2(1500));
    fireEvent.change(campo("venda"), { target: { value: "R$ 8,00" } });
    expect(screen.getByText(/Você terá prejuízo/)).toBeTruthy();
    expect(screen.getByTestId("ganho-bruto")).toBeTruthy();
  });
});
