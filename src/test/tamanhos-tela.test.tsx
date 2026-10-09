import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const store = { id: "r1", nome: "Loja", tipo: "roupas" } as never;
const base: Product = { id: 9, codigo: "111", nome: "Peça", compra: 1000, venda: 2000, unidade: "Peça", categoria: "Camisetas",
  detalhes: {}, variacoes: [{ tam: "M", cor: "Azul", codigo: "222", qtd: 2 }], fornecedor: null };

function abrirNova(initial: Product) {
  const onSave = vi.fn();
  render(<ProductWizard store={store} products={[initial]} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  submit(); submit();
  fireEvent.click(screen.getByRole("button", { name: "Adicionar variação" }));
  return { onSave, submit, dlg: within(screen.getByRole("dialog")) };
}
const pressed = (d: ReturnType<typeof within>, n: string) => d.getByRole("button", { name: n }).getAttribute("aria-pressed");

describe("tamanhos em grupos", () => {
  it("abre em Letras e mostra só os tamanhos do grupo", () => {
    const { dlg } = abrirNova(base);
    expect(pressed(dlg, "Letras")).toBe("true");
    expect(dlg.getByRole("button", { name: "XXG" })).toBeTruthy();
    expect(dlg.queryByRole("button", { name: "38" })).toBeNull();
  });
  it("trocar para Números mostra 34 a 56", () => {
    const { dlg } = abrirNova(base);
    fireEvent.click(dlg.getByRole("button", { name: "Números" }));
    expect(dlg.getByRole("button", { name: "56" })).toBeTruthy();
    expect(dlg.queryByRole("button", { name: "XG" })).toBeNull();
  });
  it("produto da categoria Calçados abre em Calçados", () => {
    const { dlg } = abrirNova({ ...base, categoria: "Calçados", variacoes: [{ tam: "38", cor: "Preto", codigo: "222", qtd: 1 }] });
    expect(pressed(dlg, "Calçados")).toBe("true");
    expect(dlg.getByRole("button", { name: "17" })).toBeTruthy();
  });
  it("tamanho único: um toque e salva a variação como Único", () => {
    const { dlg, submit, onSave } = abrirNova(base);
    fireEvent.click(dlg.getByRole("button", { name: "Tamanho único" }));
    expect(dlg.getByText((_, el) => el?.tagName === "P" && /Esta peça fica com tamanho único/.test(el.textContent ?? ""))).toBeTruthy();
    fireEvent.change(document.getElementById("vcor")!, { target: { value: "Preto" } });
    fireEvent.change(document.getElementById("vcod")!, { target: { value: "333" } });
    fireEvent.change(document.getElementById("vqtd")!, { target: { value: "4" } });
    fireEvent.click(dlg.getByRole("button", { name: "Adicionar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    for (let i = 0; i < 8; i++) submit();
    expect(onSave.mock.calls[0]![0].variacoes.map((v: { tam: string }) => v.tam)).toEqual(["M", "Único"]);
  });
  it("nova variação segue o grupo da última (36 → Números)", () => {
    const t = abrirNova({ ...base, variacoes: [{ tam: "36", cor: "Azul", codigo: "222", qtd: 2 }] });
    expect(pressed(t.dlg, "Números")).toBe("true");
  });
});
