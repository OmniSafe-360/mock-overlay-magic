import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";
import { CONSTRUCAO_VARS_MSG } from "@/lib/variations";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const store = { id: "c1", nome: "Depósito", tipo: "construcao" } as never;
const ok: Product = { id: 5, codigo: "321", nome: "Cimento", compra: 2500, venda: 3500, unidade: "Saco", categoria: "Básico",
  detalhes: { marca: "Votoran", medida: "50 kg" }, variacoes: [], fornecedor: null };

function setup(initial: Product) {
  const onSave = vi.fn();
  render(<ProductWizard store={store} products={[initial]} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  return { onSave, submit: () => fireEvent.submit(document.querySelector("form")!) };
}
const run = (submit: () => void, n = 8) => { for (let i = 0; i < n; i++) submit(); };

describe("opções de Material de construção", () => {
  it("produto válido salva", () => { const t = setup(ok); run(t.submit, 7); expect(t.onSave).toHaveBeenCalledTimes(1); });

  it("produto sem detalhes salva (Pular)", () => {
    const t = setup({ ...ok, detalhes: {} }); run(t.submit, 7); expect(t.onSave).toHaveBeenCalledTimes(1);
  });

  it.each(["Unidade", "Metro", "m²", "Kg", "Saco", "Caixa", "Lata"])("aceita a unidade %s", (u) => {
    const t = setup({ ...ok, unidade: u }); run(t.submit, 7);
    expect(t.onSave.mock.calls[0]![0].unidade).toBe(u);
  });

  it("unidade Peça impede salvar", () => {
    const t = setup({ ...ok, unidade: "Peça" }); run(t.submit);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Unidade incompatível/)).toBeTruthy();
  });

  it("categoria Camisetas impede salvar", () => {
    const t = setup({ ...ok, categoria: "Camisetas" }); run(t.submit);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Categoria incompatível/)).toBeTruthy();
  });

  it("variações impedem salvar, mesmo sem detalhes e com Pular, sem apagar dados", () => {
    const v = [{ tam: "M", cor: "Azul", codigo: "1", qtd: 1 }];
    const t = setup({ ...ok, detalhes: {}, variacoes: v }); run(t.submit);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(CONSTRUCAO_VARS_MSG)).toBeTruthy();
    expect(v).toHaveLength(1);
  });

  it("corrigir unidade e categoria remove avisos e permite concluir", () => {
    const t = setup({ ...ok, unidade: "Peça", categoria: "Camisetas" }); t.submit();
    fireEvent.click(screen.getByRole("button", { name: "m²" }));
    expect(screen.queryByText(/Unidade incompatível/)).toBeNull();
    expect(screen.getByText(/Categoria incompatível/)).toBeTruthy();
    fireEvent.change(document.getElementById("cat")!, { target: { value: "Pintura" } });
    expect(screen.queryByText(/incompatível/)).toBeNull();
    run(t.submit, 6);
    expect(t.onSave.mock.calls[0]![0]).toMatchObject({ unidade: "m²", categoria: "Pintura" });
  });

  it("editar pelo resumo não contorna as validações", () => {
    const t = setup(ok); run(t.submit, 6);
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    const edits = screen.getAllByRole("button").filter((b) => /editar/i.test(b.textContent ?? "") || /editar/i.test(b.getAttribute("aria-label") ?? ""));
    fireEvent.click(edits[1]!); // Preços
    fireEvent.change(document.getElementById("cat")!, { target: { value: "" } });
    run(t.submit, 8);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.queryByText("Salvar produto")).toBeNull();
  });
});
