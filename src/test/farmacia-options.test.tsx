import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";
import { CONTROLADO_MSG, FARMACIA_VARS_MSG } from "@/lib/variations";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const store = { id: "f1", nome: "Farmácia", tipo: "farmacia" } as never;
const ok: Product = { id: 4, codigo: "456", nome: "Dipirona", compra: 500, venda: 900, unidade: "Caixa", categoria: "Medicamentos",
  detalhes: { principio: "Dipirona", controlado: "Não" }, variacoes: [], fornecedor: null };

function setup(initial: Product) {
  const onSave = vi.fn();
  render(<ProductWizard store={store} products={[initial]} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  return { onSave, submit: () => fireEvent.submit(document.querySelector("form")!) };
}
const run = (submit: () => void, n = 9) => { for (let i = 0; i < n; i++) submit(); };

describe("opções da Farmácia", () => {
  it("produto válido salva", () => { const t = setup(ok); run(t.submit, 8); expect(t.onSave).toHaveBeenCalledTimes(1); });

  it("controlado aceita Sim e ausência", () => {
    const a = setup({ ...ok, detalhes: { controlado: "Sim" } }); run(a.submit, 7); expect(a.onSave).toHaveBeenCalledTimes(1);
  });
  it("produto sem detalhes salva (Pular)", () => {
    const t = setup({ ...ok, detalhes: {} }); run(t.submit, 8); expect(t.onSave).toHaveBeenCalledTimes(1);
  });

  it("unidade Peça e categoria Camisetas impedem salvar", () => {
    const a = setup({ ...ok, unidade: "Peça" }); run(a.submit); expect(a.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Unidade incompatível/)).toBeTruthy();
  });
  it("categoria Camisetas impede salvar", () => {
    const a = setup({ ...ok, categoria: "Camisetas" }); run(a.submit); expect(a.onSave).not.toHaveBeenCalled();
  });

  it("variações impedem salvar sem apagar dados, mesmo sem detalhes (Pular)", () => {
    const v = [{ tam: "M", cor: "Azul", codigo: "1", qtd: 1 }];
    const t = setup({ ...ok, detalhes: {}, variacoes: v }); run(t.submit);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(FARMACIA_VARS_MSG)).toBeTruthy();
    expect(v).toHaveLength(1);
  });

  it("controlado inválido impede salvar; corrigir libera", () => {
    const t = setup({ ...ok, detalhes: { controlado: "Talvez" } }); run(t.submit);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(CONTROLADO_MSG)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sim" }));
    expect(screen.queryByText(CONTROLADO_MSG)).toBeNull();
    run(t.submit, 6);
    expect(t.onSave).toHaveBeenCalledTimes(1);
    expect(t.onSave.mock.calls[0]![0].detalhes.controlado).toBe("Sim");
  });

  it("corrigir unidade e categoria remove avisos e permite concluir", () => {
    const t = setup({ ...ok, unidade: "Peça", categoria: "Camisetas" }); t.submit();
    fireEvent.click(screen.getByRole("button", { name: "Frasco" }));
    expect(screen.getByText(/Categoria incompatível/)).toBeTruthy();
    fireEvent.change(document.getElementById("cat")!, { target: { value: "Genéricos" } });
    expect(screen.queryByText(/incompatível/)).toBeNull();
    run(t.submit, 7);
    expect(t.onSave.mock.calls[0]![0]).toMatchObject({ unidade: "Frasco", categoria: "Genéricos" });
  });

  it("editar pelo resumo não contorna as validações", () => {
    const t = setup(ok); run(t.submit, 7);
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    const edits = screen.getAllByRole("button").filter((b) => /editar/i.test(b.textContent ?? "") || /editar/i.test(b.getAttribute("aria-label") ?? ""));
    fireEvent.click(edits[1]!); // Preços
    fireEvent.change(document.getElementById("cat")!, { target: { value: "" } });
    run(t.submit, 9);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.queryByText("Salvar produto")).toBeNull();
  });
});
