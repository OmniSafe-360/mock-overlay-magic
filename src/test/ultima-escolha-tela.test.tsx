import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product, type Supplier } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const tiss: Product = {
  id: 1, codigo: "7896263503203", nome: "Refrigerante Tiss", compra: 249, venda: 349, unidade: "Unidade", categoria: "Bebidas",
  detalhes: { marca: "Tiss" }, variacoes: [], fornecedor: 2,
  deposito: { local: "Prateleira 2", qtd: 40, min: 10, max: 100 },
  areaVenda: { local: "Gôndola 1", qtd: 40, min: 10, max: 120 },
  db: { id: "p1", contadas: ["deposito:_", "venda:_"] },
};
const fornecedores: Supplier[] = [{ id: 1, nome: "Sol", tel: "", email: "" }, { id: 2, nome: "Jane", tel: "", email: "" }];
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const typeIn = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

function abrir(initial?: Product) {
  render(<ProductWizard store={{ id: "s", nome: "Mercado", tipo: "mercado" } as never} products={[tiss]} initial={initial}
    suppliers={fornecedores} onAddSupplier={() => 1} onCancel={() => {}} onSave={vi.fn()} />);
  return () => fireEvent.submit(document.querySelector("form")!);
}

describe("produto novo lembra a última escolha", () => {
  it("vem com categoria, unidade, fornecedor e local do último produto, sem copiar código, nome nem preço", () => {
    const submit = abrir();
    click("Digitar código");
    expect((screen.getByLabelText("Código do produto") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Nome do produto") as HTMLInputElement).value).toBe("");
    typeIn("Código do produto", "7891000100103"); typeIn("Nome do produto", "Guaraná 2L"); submit();

    expect((screen.getByLabelText("Preço de compra") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Categoria") as HTMLSelectElement).value).toBe("Bebidas");
    expect(screen.getByText("Igual ao último produto. Pode trocar.")).toBeTruthy();
    expect(pressed("Unidade")).toBe("true");
    typeIn("Preço de compra", "300"); typeIn("Preço de venda", "450"); submit();

    submit(); // detalhes
    expect(pressed("Jane")).toBe("true");
    expect(screen.getByText("Mesmo fornecedor do último produto. Pode trocar.")).toBeTruthy();
    submit();

    expect(pressed("Prateleira 2")).toBe("true");
  });

  it("trocar a categoria tira o aviso de 'igual ao último'", () => {
    const submit = abrir();
    click("Digitar código"); typeIn("Código do produto", "7891000100103"); typeIn("Nome do produto", "Arroz"); submit();
    typeIn("Categoria", "Mercearia");
    expect(screen.queryByText("Igual ao último produto. Pode trocar.")).toBeNull();
  });

  it("editar um produto não mistura nada do último", () => {
    const outro: Product = { ...tiss, id: 2, codigo: "789", nome: "Sabão", categoria: "Limpeza", fornecedor: 1, deposito: undefined, areaVenda: undefined, db: { id: "p2", contadas: [] } };
    const submit = abrir(outro);
    submit();
    expect((screen.getByLabelText("Categoria") as HTMLSelectElement).value).toBe("Limpeza");
    expect(screen.queryByText("Igual ao último produto. Pode trocar.")).toBeNull();
  });
});
