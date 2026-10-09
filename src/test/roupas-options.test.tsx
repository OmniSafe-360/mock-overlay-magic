import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const store = { id: "r1", nome: "Loja", tipo: "roupas" } as never;
const ok: Product = { id: 9, codigo: "111", nome: "Camiseta", compra: 1000, venda: 2000, unidade: "Peça", categoria: "Camisetas",
  detalhes: {}, variacoes: [{ tam: "M", cor: "Azul", codigo: "222", qtd: 2 }], fornecedor: null };

function setup(initial: Product, products: Product[] = [initial]) {
  const onSave = vi.fn();
  render(<ProductWizard store={store} products={products} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  return { onSave, submit: () => fireEvent.submit(document.querySelector("form")!) };
}
const run = (submit: () => void, n = 9) => { for (let i = 0; i < n; i++) submit(); };

describe("unidade e categoria da Loja de roupas", () => {
  it.each(["Peça", "Par"])("aceita a unidade %s", (u) => {
    const t = setup({ ...ok, unidade: u }); run(t.submit, 8); expect(t.onSave.mock.calls[0]![0].unidade).toBe(u);
  });
  it.each(["Camisetas", "Calças", "Vestidos", "Calçados", "Íntima", "Acessórios"])("aceita a categoria %s", (c) => {
    const t = setup({ ...ok, categoria: c }); run(t.submit, 8); expect(t.onSave.mock.calls[0]![0].categoria).toBe(c);
  });

  it("unidade Kg impede salvar", () => {
    const t = setup({ ...ok, unidade: "Kg" }); run(t.submit); expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Unidade incompatível/)).toBeTruthy();
  });
  it("categoria Mercearia impede salvar", () => {
    const t = setup({ ...ok, categoria: "Mercearia" }); run(t.submit); expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Categoria incompatível/)).toBeTruthy();
  });

  it("corrigir os valores remove os avisos e permite concluir", () => {
    const t = setup({ ...ok, unidade: "Kg", categoria: "Mercearia" }); t.submit();
    fireEvent.click(screen.getByRole("button", { name: "Par" }));
    expect(screen.getByText(/Categoria incompatível/)).toBeTruthy();
    fireEvent.change(document.getElementById("cat")!, { target: { value: "Calçados" } });
    expect(screen.queryByText(/incompatível/)).toBeNull();
    run(t.submit, 7);
    expect(t.onSave.mock.calls[0]![0]).toMatchObject({ unidade: "Par", categoria: "Calçados" });
    expect(t.onSave.mock.calls[0]![0].variacoes).toHaveLength(1);
  });

  it("editar pelo resumo não contorna as validações", () => {
    const t = setup(ok); run(t.submit, 7);
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    const edits = screen.getAllByRole("button").filter((b) => /editar/i.test(b.textContent ?? "") || /editar/i.test(b.getAttribute("aria-label") ?? ""));
    fireEvent.click(edits[1]!);
    fireEvent.change(document.getElementById("cat")!, { target: { value: "" } });
    run(t.submit, 9);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.queryByText("Salvar produto")).toBeNull();
  });

  it("continua exigindo pelo menos uma variação válida", () => {
    const a = setup({ ...ok, variacoes: [] }); run(a.submit); expect(a.onSave).not.toHaveBeenCalled();
  });
  it("variação sem código continua bloqueando", () => {
    const t = setup({ ...ok, variacoes: [{ tam: "M", cor: "Azul", codigo: "", qtd: 1 }] }); run(t.submit);
    expect(t.onSave).not.toHaveBeenCalled();
  });
  it("código de variação usado em outro produto continua bloqueando", () => {
    const other: Product = { ...ok, id: 10, codigo: "999", variacoes: [{ tam: "P", cor: "X", codigo: "222", qtd: 1 }] };
    const t = setup(ok, [ok, other]); run(t.submit);
    expect(t.onSave).not.toHaveBeenCalled();
  });
});
