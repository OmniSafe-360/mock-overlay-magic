import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ImprimirEtiquetaSheet, opcoesEtiqueta } from "@/components/Etiqueta";

const tiss = { nome: "Refrigerante Tiss", codigo: "7896263503203", venda: 349, unidade: "Unidade", variacoes: [] };
const camiseta = { nome: "Camiseta", codigo: "", venda: 5990, unidade: "Peça",
  variacoes: [{ tam: "M", cor: "Azul", codigo: "2900000000018" }, { tam: "G", cor: "Preta", codigo: "" }, { tam: "P", cor: "Branca", codigo: "7891000100103" }] };

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.getElementById("area-impressao")?.remove(); });

describe("imprimir etiqueta", () => {
  it("uma etiqueta para o produto e uma para cada variação com código", () => {
    expect(opcoesEtiqueta(tiss).map((o) => o.rotulo)).toEqual(["Produto"]);
    const ops = opcoesEtiqueta(camiseta);
    expect(ops.map((o) => [o.rotulo, o.codigo, o.nome])).toEqual([
      ["M · Azul", "2900000000018", "Camiseta · M Azul"],
      ["P · Branca", "7891000100103", "Camiseta · P Branca"],
    ]);
  });

  it("produto sem nenhum código explica como criar um", () => {
    render(<ImprimirEtiquetaSheet produto={{ ...tiss, codigo: "" }} onClose={() => {}} />);
    expect(screen.getByText(/ainda não tem código/)).toBeTruthy();
  });

  it("abre a impressão uma única vez, com o tamanho do papel escolhido", () => {
    vi.useFakeTimers();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<ImprimirEtiquetaSheet produto={tiss} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Térmica 40 × 25 mm/ }));
    fireEvent.change(screen.getByLabelText("Quantidade de etiquetas"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Imprimir 3 etiquetas/ }));
    act(() => { vi.advanceTimersByTime(500); });
    expect(print).toHaveBeenCalledTimes(1);
    const area = document.getElementById("area-impressao")!;
    expect(area.querySelector("style")!.textContent).toContain("@page { size: 40mm 25mm; margin: 0; }");
    expect(area.querySelectorAll("svg[role=img]").length).toBe(3);
    act(() => { window.dispatchEvent(new Event("afterprint")); });
    expect(document.getElementById("area-impressao")).toBeNull();
  });

  it("quantidade zero não deixa imprimir", () => {
    render(<ImprimirEtiquetaSheet produto={tiss} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Quantidade de etiquetas"), { target: { value: "0" } });
    expect((screen.getByRole("button", { name: /Imprimir/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
