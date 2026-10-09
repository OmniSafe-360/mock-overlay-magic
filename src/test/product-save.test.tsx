import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";
import { firstInvalidStep, mainCodeError, usedCodes } from "@/lib/variations";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const store = { id: "s1", nome: "Loja", tipo: "roupas" } as never;
const base: Product = { id: 7, codigo: "111", nome: "Camiseta", compra: 1000, venda: 2000, unidade: "Peça", categoria: "Camisetas",
  detalhes: {}, variacoes: [{ tam: "M", cor: "Azul", codigo: "222", qtd: 2 }], fornecedor: null };

function setup(initial: Product) {
  const onSave = vi.fn();
  render(<ProductWizard store={store} products={[initial]} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  return { onSave, submit };
}

describe("validação final do produto", () => {
  it("bloqueia código principal igual ao de uma própria variação", () => {
    expect(mainCodeError("222", new Set(), base.variacoes)).toBe("Este código já pertence a uma variação deste produto.");
  });

  it("edição pelo resumo: trocar o principal para o código da variação não salva", () => {
    const { onSave, submit } = setup(base);
    for (let i = 0; i < 6; i++) submit(); // chega ao resumo
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button").find((b) => /editar/i.test(b.textContent ?? "") || /editar/i.test(b.getAttribute("aria-label") ?? ""))!);
    fireEvent.change(screen.getByPlaceholderText("Ex.: 7891234567890"), { target: { value: "222" } });
    expect(screen.getByText("Este código já pertence a uma variação deste produto.")).toBeTruthy();
    for (let i = 0; i < 7; i++) submit();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("corrigir o código remove a mensagem e permite concluir", () => {
    const { onSave, submit } = setup(base);
    for (let i = 0; i < 6; i++) submit();
    fireEvent.click(screen.getAllByRole("button").find((b) => /editar/i.test(b.textContent ?? "") || /editar/i.test(b.getAttribute("aria-label") ?? ""))!);
    const input = screen.getByPlaceholderText("Ex.: 7891234567890");
    fireEvent.change(input, { target: { value: "222" } });
    submit();
    expect(screen.getByText("Este código já pertence a uma variação deste produto.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "333" } });
    expect(screen.queryByText("Este código já pertence a uma variação deste produto.")).toBeNull();
    submit(); // volta ao resumo
    submit(); // salva
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0].codigo).toBe("333");
  });

  it("variações incompletas não chegam ao onSave", () => {
    const { onSave, submit } = setup({ ...base, variacoes: [{ tam: "M", cor: "Azul", codigo: "", qtd: 2 }] });
    for (let i = 0; i < 8; i++) submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(firstInvalidStep({ ...base, variacoes: [{ tam: "M", cor: "", codigo: "5", qtd: 0 }] }, true, new Set())?.step).toBe(2);
    expect(firstInvalidStep({ ...base, variacoes: [] }, true, new Set())?.step).toBe(2);
  });

  it("edição mantendo os próprios códigos válidos salva", () => {
    const { onSave, submit } = setup(base);
    for (let i = 0; i < 7; i++) submit();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0].codigo).toBe("111");
  });

  it("mesmo código em comércios diferentes continua permitido", () => {
    const usedOutraLoja = usedCodes([]); // produtos de cada comércio são separados
    expect(firstInvalidStep({ ...base, id: 99 } as never, true, usedOutraLoja)).toBeNull();
    expect(firstInvalidStep(base, true, usedCodes([base], 99))?.msg).toBe("Este código já está cadastrado");
  });
});
