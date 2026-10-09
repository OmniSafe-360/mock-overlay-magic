import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ProductWizard, brl2, type Product } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const store = { id: "m1", nome: "Mercado", tipo: "mercado" } as never;
const prod: Product = { id: 3, codigo: "789", nome: "Arroz", compra: 1000, venda: 1500, unidade: "Kg", categoria: "Mercearia",
  detalhes: {}, variacoes: [], fornecedor: null };

function abrirPrecos() {
  const onSave = vi.fn();
  render(<ProductWizard store={store} products={[prod]} initial={prod} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  submit(); // passo 1 -> passo 2 (preços)
  const campo = (id: string) => document.getElementById(id) as HTMLInputElement;
  return { onSave, submit, campo };
}

describe("preço pela margem (ganho sobre a compra)", () => {
  it("mostra o ganho atual: compra R$ 10,00 e venda R$ 15,00 = 50%", () => {
    const { campo } = abrirPrecos();
    expect(campo("ganho").value).toBe("50");
  });

  it("digitar 30% calcula a venda: R$ 10,00 vira R$ 13,00", () => {
    const { campo } = abrirPrecos();
    fireEvent.change(campo("ganho"), { target: { value: "30" } });
    expect(campo("venda").value).toBe(brl2(1300));
  });

  it("com o % digitado, mudar a compra recalcula a venda", () => {
    const { campo } = abrirPrecos();
    fireEvent.change(campo("ganho"), { target: { value: "30" } });
    fireEvent.change(campo("compra"), { target: { value: "R$ 20,00" } });
    expect(campo("venda").value).toBe(brl2(2600));
    expect(campo("ganho").value).toBe("30");
  });

  it("digitar a venda direto atualiza o %", () => {
    const { campo } = abrirPrecos();
    fireEvent.change(campo("ganho"), { target: { value: "30" } });
    fireEvent.change(campo("venda"), { target: { value: "R$ 12,50" } });
    expect(campo("ganho").value).toBe("25");
    fireEvent.change(campo("compra"), { target: { value: "R$ 11,00" } });
    expect(campo("venda").value).toBe(brl2(1250)); // a venda digitada não muda sozinha
  });

  it("sem preço de compra o campo de % fica bloqueado", () => {
    const { campo } = abrirPrecos();
    fireEvent.change(campo("compra"), { target: { value: "" } });
    expect(campo("ganho").disabled).toBe(true);
  });

  it("salva a venda calculada", () => {
    const { campo, submit, onSave } = abrirPrecos();
    fireEvent.change(campo("ganho"), { target: { value: "30" } });
    for (let i = 0; i < 7; i++) submit(); // já está no passo 2; mais 7 chegam ao salvar
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0]).toMatchObject({ compra: 1000, venda: 1300 });
  });
});
