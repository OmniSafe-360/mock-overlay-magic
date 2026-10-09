import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const base: Product = { id: 1, codigo: "7896263503203", nome: "Arroz", compra: 1290, venda: 1270, unidade: "Unidade", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: null };

function ateResumo(p: Product) {
  const onSave = vi.fn();
  render(<ProductWizard store={{ id: "s", nome: "Mercado", tipo: "mercado" } as never} products={[p]} initial={p} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  for (let i = 0; i < 7; i++) submit();
  expect(screen.getByText("Salvar produto")).toBeTruthy();
  return { onSave, submit };
}
const caixa = () => screen.getByRole("checkbox", { name: /Vender com prejuízo/ });

describe("vender com prejuízo pede confirmação ao salvar", () => {
  it("sem confirmar não salva e explica", () => {
    const t = ateResumo(base);
    expect(caixa().closest("label")!.textContent).toMatch(/Você perde R\$\s0,20 em cada unidade/);
    expect(screen.getByText(/prejuízo de 1,6% sobre a compra/)).toBeTruthy();
    t.submit();
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Confirme o prejuízo para salvar/)).toBeTruthy();
  });

  it("confirmando, salva", () => {
    const t = ateResumo(base);
    fireEvent.click(caixa());
    t.submit();
    expect(t.onSave).toHaveBeenCalledTimes(1);
  });

  it("mudar o preço depois de confirmar pede de novo", () => {
    const t = ateResumo(base);
    fireEvent.click(caixa());
    fireEvent.click(screen.getAllByRole("button", { name: /Editar/ })[1]!); // Preços
    fireEvent.change(screen.getByLabelText("Preço de venda"), { target: { value: "1200" } });
    t.submit();
    expect((caixa() as HTMLInputElement).checked).toBe(false);
    t.submit();
    expect(t.onSave).not.toHaveBeenCalled();
  });

  it("produto com lucro não mostra nada e salva direto", () => {
    const t = ateResumo({ ...base, venda: 1590 });
    expect(screen.queryByRole("checkbox", { name: /Vender com prejuízo/ })).toBeNull();
    t.submit();
    expect(t.onSave).toHaveBeenCalledTimes(1);
  });
});
