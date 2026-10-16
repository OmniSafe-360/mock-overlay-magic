/* M15 (bloco A): botões pequenos do cadastro de produto passam a ter 44 px para o dedo,
   sem aumentar a linha onde ficam (margem negativa), e a fonte do catálogo deixa de ser 11 px. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ProductWizard } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const typeIn = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });

function abrir() {
  render(<ProductWizard store={{ id: "s", nome: "Loja", tipo: "mercado" } as never} products={[]} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={() => {}} />);
  return () => fireEvent.submit(document.querySelector("form")!);
}

describe("M15 — campos legíveis (bloco A)", () => {
  it("Escanear tem 44 px sem crescer a linha do rótulo", () => {
    abrir();
    click("Digitar código");
    const b = screen.getByRole("button", { name: /Escanear/ });
    expect(b.className).toContain("min-h-11");
    expect(b.className).toContain("-my-1");
  });

  it("Remover validade tem 44 px", () => {
    const submit = abrir();
    click("Digitar código"); typeIn("Código do produto", "7890001"); typeIn("Nome do produto", "Produto"); submit();
    typeIn("Preço de compra", "1000"); typeIn("Preço de venda", "1500"); click("Pacote"); typeIn("Categoria", "Mercearia"); submit();
    submit(); click("Definir depois"); submit();
    click(/^Novo local$/); typeIn("Nome do local", "Estante A"); click("Usar este local"); submit();
    typeIn(/Quanto você contou/, "5"); submit(); submit();
    click(/Novo local de venda/); typeIn("Nome do local de venda", "Balcão"); click("Usar este local de venda"); submit();
    typeIn(/Quanto deste produto já está neste local/, "0"); submit(); submit();
    click("Sim"); submit(); submit();
    expect(screen.getByText("Validades no depósito")).toBeTruthy();
    const add = screen.queryByRole("button", { name: /outra validade/i });
    if (add) fireEvent.click(add);
    const rem = screen.getAllByRole("button", { name: "Remover validade" })[0]!;
    expect(rem.className).toContain("h-11");
    expect(rem.className).toContain("w-11");
    expect(rem.className).toContain("shrink-0");
  });

  it("nenhum texto de 11 px nem botão de 36 px no cadastro", () => {
    const src = readFileSync("src/components/ProductArea.tsx", "utf8");
    expect(src).not.toMatch(/text-\[11px\]/);
    expect(src).not.toMatch(/\bmin-h-9\b|\bh-9 w-9\b/);
  });
});
