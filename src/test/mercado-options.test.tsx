import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";
import { firstInvalidStep, MERCADO_VARS_MSG } from "@/lib/variations";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const store = { id: "m1", nome: "Mercado", tipo: "mercado" } as never;
const ok: Product = { id: 3, codigo: "789", nome: "Arroz", compra: 1000, venda: 1500, unidade: "Kg", categoria: "Mercearia",
  detalhes: {}, variacoes: [], fornecedor: null };

function setup(initial: Product) {
  const onSave = vi.fn();
  render(<ProductWizard store={store} products={[initial]} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  return { onSave, submit: () => fireEvent.submit(document.querySelector("form")!) };
}
const rules = { unidades: ["Unidade", "Kg", "Litro", "Pacote", "Caixa"], categorias: ["Mercearia"], semVariacoes: true };

describe("opções do Mercado", () => {
  it("opções válidas continuam salvando", () => {
    const { onSave, submit } = setup(ok);
    for (let i = 0; i < 7; i++) submit();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("unidade de outro tipo (Peça) impede salvar", () => {
    const { onSave, submit } = setup({ ...ok, unidade: "Peça" });
    for (let i = 0; i < 8; i++) submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Unidade incompatível/)).toBeTruthy();
  });

  it("categoria de outro tipo (Camisetas) impede salvar", () => {
    const { onSave, submit } = setup({ ...ok, categoria: "Camisetas" });
    for (let i = 0; i < 8; i++) submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Categoria incompatível/)).toBeTruthy();
  });

  it("com variações impede salvar e não apaga as variações", () => {
    const v = [{ tam: "M", cor: "Azul", codigo: "1", qtd: 1 }];
    const { onSave, submit } = setup({ ...ok, variacoes: v });
    for (let i = 0; i < 8; i++) submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(MERCADO_VARS_MSG)).toBeTruthy();
    expect(v).toHaveLength(1);
  });

  it("corrigir unidade e categoria permite concluir", () => {
    const { onSave, submit } = setup({ ...ok, unidade: "Peça", categoria: "Camisetas" });
    submit(); // etapa Preço e unidade
    fireEvent.click(screen.getByRole("button", { name: "Pacote" }));
    expect(screen.getByText(/Categoria incompatível/)).toBeTruthy();
    fireEvent.change(document.getElementById("cat")!, { target: { value: "Bebidas" } });
    expect(screen.queryByText(/incompatível/)).toBeNull();
    for (let i = 0; i < 6; i++) submit();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0]).toMatchObject({ unidade: "Pacote", categoria: "Bebidas" });
  });

  it("validação final rejeita opções incompatíveis", () => {
    expect(firstInvalidStep({ ...ok, unidade: "Peça" }, false, new Set(), rules)?.step).toBe(1);
    expect(firstInvalidStep({ ...ok, categoria: "Camisetas" }, false, new Set(), rules)?.step).toBe(1);
    expect(firstInvalidStep({ ...ok, variacoes: [{ tam: "M", cor: "A", codigo: "1", qtd: 1 }] }, false, new Set(), rules)?.msg).toBe(MERCADO_VARS_MSG);
    expect(firstInvalidStep(ok, false, new Set(), rules)).toBeNull();
  });
});
