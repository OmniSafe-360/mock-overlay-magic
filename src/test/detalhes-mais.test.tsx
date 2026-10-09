import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const base: Product = { id: 9, codigo: "789", nome: "Item", compra: 1000, venda: 1500, unidade: "Unidade", categoria: "", detalhes: {}, variacoes: [], fornecedor: null };
const casos = [
  { tipo: "farmacia", categoria: "Medicamentos", extra: "registro", rotulo: /Registro/ },
  { tipo: "construcao", categoria: "Elétrica", extra: "cor", rotulo: /^Cor/ },
  { tipo: "autopecas", categoria: "Freios", extra: "oem", rotulo: /Código original da montadora/ },
] as const;

function setup(tipo: string, initial: Product) {
  const onSave = vi.fn();
  render(<ProductWizard store={{ id: "s", nome: "Loja", tipo } as never} products={[initial]} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  return { onSave, submit };
}
const irDetalhes = (submit: () => void) => { submit(); submit(); };

describe("Mais detalhes (opcional)", () => {
  it.each(casos)("$tipo: campo opcional fica fechado e abre no botão", ({ tipo, categoria, extra, rotulo }) => {
    const t = setup(tipo, { ...base, categoria });
    irDetalhes(t.submit);
    expect(document.getElementById(`d-${extra}`)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Mais detalhes/ }));
    expect(document.getElementById(`d-${extra}`)).toBeTruthy();
    expect(screen.getAllByText(rotulo).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Mais detalhes/ })).toBeNull();
  });

  it.each(casos)("$tipo: já vem aberto quando o produto tem o campo preenchido", ({ tipo, categoria, extra }) => {
    const t = setup(tipo, { ...base, categoria, detalhes: { [extra]: "ABC" } });
    irDetalhes(t.submit);
    expect((document.getElementById(`d-${extra}`) as HTMLInputElement).value).toBe("ABC");
    expect(screen.queryByRole("button", { name: /Mais detalhes/ })).toBeNull();
  });

  it("autopeças: tipo de veículo e código original são salvos", () => {
    const t = setup("autopecas", { ...base, categoria: "Freios" });
    irDetalhes(t.submit);
    fireEvent.click(screen.getByRole("button", { name: "Moto" }));
    fireEvent.click(screen.getByRole("button", { name: /Mais detalhes/ }));
    fireEvent.change(document.getElementById("d-oem")!, { target: { value: "12345-ABC" } });
    for (let i = 0; i < 6; i++) t.submit();
    expect(t.onSave).toHaveBeenCalledTimes(1);
    expect(t.onSave.mock.calls[0]![0].detalhes).toMatchObject({ veiculo: "Moto", oem: "12345-ABC" });
  });

  it("construção: voltagem fora da lista impede salvar", () => {
    const t = setup("construcao", { ...base, categoria: "Elétrica", detalhes: { voltagem: "380 V" } });
    for (let i = 0; i < 9; i++) t.submit();
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Escolha uma das opções da lista em "Voltagem"/)).toBeTruthy();
  });

  it("roupas: público da lista é salvo", () => {
    const t = setup("roupas", { ...base, unidade: "Peça", categoria: "Camisetas", detalhes: { publico: "Infantil" },
      variacoes: [{ tam: "M", cor: "Azul", codigo: "222", qtd: 2 }] });
    for (let i = 0; i < 8; i++) t.submit();
    expect(t.onSave.mock.calls[0]![0].detalhes.publico).toBe("Infantil");
  });
});
