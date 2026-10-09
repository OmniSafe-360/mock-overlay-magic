import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";
import { ESPECIE_MSG, PET_VARS_MSG } from "@/lib/variations";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const store = { id: "p1", nome: "Pet", tipo: "pet" } as never;
const ok: Product = { id: 6, codigo: "654", nome: "Ração", compra: 5000, venda: 8000, unidade: "Pacote", categoria: "Ração",
  detalhes: { marca: "Golden", especie: "Cão", peso: "15 kg" }, variacoes: [], fornecedor: null };

function setup(initial: Product) {
  const onSave = vi.fn();
  render(<ProductWizard store={store} products={[initial]} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  return { onSave, submit: () => fireEvent.submit(document.querySelector("form")!) };
}
const run = (submit: () => void, n = 7) => { for (let i = 0; i < n; i++) submit(); };

describe("opções do Pet shop", () => {
  it("produto válido salva", () => { const t = setup(ok); run(t.submit, 6); expect(t.onSave).toHaveBeenCalledTimes(1); });
  it("produto sem detalhes salva (Pular)", () => { const t = setup({ ...ok, detalhes: {} }); run(t.submit, 6); expect(t.onSave).toHaveBeenCalledTimes(1); });

  it.each(["Unidade", "Kg", "Litro", "Pacote", "Caixa"])("aceita a unidade %s", (u) => {
    const t = setup({ ...ok, unidade: u }); run(t.submit, 6); expect(t.onSave.mock.calls[0]![0].unidade).toBe(u);
  });
  it.each(["Cão", "Gato", "Outros", ""])("aceita a espécie '%s'", (e) => {
    const t = setup({ ...ok, detalhes: { marca: "X", especie: e } }); run(t.submit, 6); expect(t.onSave).toHaveBeenCalledTimes(1);
  });
  it("espécie ausente é aceita", () => {
    const t = setup({ ...ok, detalhes: { marca: "X" } }); run(t.submit, 6); expect(t.onSave).toHaveBeenCalledTimes(1);
  });

  it("unidade Peça impede salvar", () => {
    const t = setup({ ...ok, unidade: "Peça" }); run(t.submit); expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Unidade incompatível/)).toBeTruthy();
  });
  it("categoria Camisetas impede salvar", () => {
    const t = setup({ ...ok, categoria: "Camisetas" }); run(t.submit); expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Categoria incompatível/)).toBeTruthy();
  });

  it("espécie Peixe é recusada; escolher Outros libera", () => {
    const t = setup({ ...ok, detalhes: { especie: "Peixe" } }); run(t.submit);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(ESPECIE_MSG)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Outros" }));
    expect(screen.queryByText(ESPECIE_MSG)).toBeNull();
    run(t.submit, 4);
    expect(t.onSave.mock.calls[0]![0].detalhes.especie).toBe("Outros");
  });

  it("variações impedem salvar, mesmo sem detalhes e com Pular, sem apagar dados", () => {
    const v = [{ tam: "M", cor: "Azul", codigo: "1", qtd: 1 }];
    const t = setup({ ...ok, detalhes: {}, variacoes: v }); run(t.submit);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(PET_VARS_MSG)).toBeTruthy();
    expect(v).toHaveLength(1);
  });

  it("corrigir unidade e categoria remove avisos e permite concluir", () => {
    const t = setup({ ...ok, unidade: "Peça", categoria: "Camisetas" }); t.submit();
    fireEvent.click(screen.getByRole("button", { name: "Kg" }));
    expect(screen.getByText(/Categoria incompatível/)).toBeTruthy();
    fireEvent.change(document.getElementById("cat")!, { target: { value: "Petiscos" } });
    expect(screen.queryByText(/incompatível/)).toBeNull();
    run(t.submit, 5);
    expect(t.onSave.mock.calls[0]![0]).toMatchObject({ unidade: "Kg", categoria: "Petiscos" });
  });

  it("editar pelo resumo não contorna as validações", () => {
    const t = setup(ok); run(t.submit, 5);
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    const edits = screen.getAllByRole("button").filter((b) => /editar/i.test(b.textContent ?? "") || /editar/i.test(b.getAttribute("aria-label") ?? ""));
    fireEvent.click(edits[1]!);
    fireEvent.change(document.getElementById("cat")!, { target: { value: "" } });
    run(t.submit, 7);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.queryByText("Salvar produto")).toBeNull();
  });
});
