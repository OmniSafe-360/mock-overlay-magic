import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";
import { AUTOPECAS_VARS_MSG, POSICAO_MSG } from "@/lib/variations";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const store = { id: "a1", nome: "Auto", tipo: "autopecas" } as never;
const ok: Product = { id: 8, codigo: "7890001", nome: "Amortecedor", compra: 10000, venda: 15000, unidade: "Par", categoria: "Suspensão",
  detalhes: { referencia: "KYB-334", marca: "KYB", aplicacao: "Uno 2015", posicao: "Dianteira" }, variacoes: [], fornecedor: null };

function setup(initial: Product) {
  const onSave = vi.fn();
  render(<ProductWizard store={store} products={[initial]} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  return { onSave, submit: () => fireEvent.submit(document.querySelector("form")!) };
}
const run = (submit: () => void, n = 8) => { for (let i = 0; i < n; i++) submit(); };

describe("opções de Autopeças", () => {
  it("produto válido salva e mantém códigos separados", () => {
    const t = setup(ok); run(t.submit, 7);
    const p = t.onSave.mock.calls[0]![0];
    expect(p.codigo).toBe("7890001");
    expect(p.detalhes.referencia).toBe("KYB-334");
  });
  it("produto sem detalhes salva (Pular)", () => { const t = setup({ ...ok, detalhes: {} }); run(t.submit, 7); expect(t.onSave).toHaveBeenCalledTimes(1); });

  it.each(["Unidade", "Par", "Jogo", "Kit"])("aceita a unidade %s", (u) => {
    const t = setup({ ...ok, unidade: u }); run(t.submit, 7); expect(t.onSave.mock.calls[0]![0].unidade).toBe(u);
  });
  it.each(["Dianteira", "Traseira", "Esquerda", "Direita", "Não se aplica", ""])("aceita a posição '%s'", (pos) => {
    const t = setup({ ...ok, detalhes: { marca: "X", posicao: pos } }); run(t.submit, 7); expect(t.onSave).toHaveBeenCalledTimes(1);
  });
  it("posição ausente é aceita", () => {
    const t = setup({ ...ok, detalhes: { marca: "X" } }); run(t.submit, 7); expect(t.onSave).toHaveBeenCalledTimes(1);
  });

  it("unidade Peça impede salvar", () => {
    const t = setup({ ...ok, unidade: "Peça" }); run(t.submit); expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Unidade incompatível/)).toBeTruthy();
  });
  it("categoria Camisetas impede salvar", () => {
    const t = setup({ ...ok, categoria: "Camisetas" }); run(t.submit); expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Categoria incompatível/)).toBeTruthy();
  });

  it("posição Central é recusada; escolher opção válida libera", () => {
    const t = setup({ ...ok, detalhes: { posicao: "Central" } }); run(t.submit);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(POSICAO_MSG)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Traseira" }));
    expect(screen.queryByText(POSICAO_MSG)).toBeNull();
    run(t.submit, 5);
    expect(t.onSave.mock.calls[0]![0].detalhes.posicao).toBe("Traseira");
  });

  it("variações impedem salvar, mesmo sem detalhes e com Pular, sem apagar dados", () => {
    const v = [{ tam: "M", cor: "Azul", codigo: "1", qtd: 1 }];
    const t = setup({ ...ok, detalhes: {}, variacoes: v }); run(t.submit);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(AUTOPECAS_VARS_MSG)).toBeTruthy();
    expect(v).toHaveLength(1);
  });

  it("corrigir unidade e categoria remove avisos e permite concluir", () => {
    const t = setup({ ...ok, unidade: "Peça", categoria: "Camisetas" }); t.submit();
    fireEvent.click(screen.getByRole("button", { name: "Jogo" }));
    expect(screen.getByText(/Categoria incompatível/)).toBeTruthy();
    fireEvent.change(document.getElementById("cat")!, { target: { value: "Freios" } });
    expect(screen.queryByText(/incompatível/)).toBeNull();
    run(t.submit, 6);
    expect(t.onSave.mock.calls[0]![0]).toMatchObject({ unidade: "Jogo", categoria: "Freios" });
  });

  it("editar pelo resumo não contorna as validações", () => {
    const t = setup(ok); run(t.submit, 6);
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    const edits = screen.getAllByRole("button").filter((b) => /editar/i.test(b.textContent ?? "") || /editar/i.test(b.getAttribute("aria-label") ?? ""));
    fireEvent.click(edits[1]!);
    fireEvent.change(document.getElementById("cat")!, { target: { value: "" } });
    run(t.submit, 8);
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.queryByText("Salvar produto")).toBeNull();
  });
});
