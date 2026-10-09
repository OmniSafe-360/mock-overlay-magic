import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const typeIn = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const arroz: Product = { id: 1, codigo: "7896263503203", nome: "Arroz", compra: 1290, venda: 1500, unidade: "Unidade", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: null };

function abrir(initial?: Product) {
  render(<ProductWizard store={{ id: "s", nome: "Mercado", tipo: "mercado" } as never} products={initial ? [initial] : []} initial={initial}
    suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={vi.fn()} />);
  return () => fireEvent.submit(document.querySelector("form")!);
}

describe("aviso de código que parece digitado errado (na tela)", () => {
  it("código do produto com 16 números avisa, mas deixa continuar", () => {
    const submit = abrir();
    click("Digitar código"); typeIn("Código do produto", "7893548845554554"); typeIn("Nome do produto", "Arroz");
    expect(screen.getByText(/tem 16 números/)).toBeTruthy();
    submit();
    expect(screen.getByText("Preço e unidade")).toBeTruthy();
  });

  it("código certo não mostra aviso", () => {
    abrir();
    click("Digitar código"); typeIn("Código do produto", "7896263503203");
    expect(screen.queryByText(/Confira se foi digitado certo/)).toBeNull();
  });

  it("o código do arroz que está no banco (7893464100065) tem o último número errado", () => {
    abrir();
    click("Digitar código"); typeIn("Código do produto", "7893464100065");
    expect(screen.getByText(/último número do código não confere/)).toBeTruthy();
  });

  it("código da embalagem com 16 números avisa", () => {
    const submit = abrir(arroz);
    submit(); submit(); submit();
    click(/Em caixa, fardo ou pacote/);
    typeIn(/Código de barras da embalagem/, "7893548845554554");
    expect(screen.getByText(/tem 16 números/)).toBeTruthy();
  });
});
