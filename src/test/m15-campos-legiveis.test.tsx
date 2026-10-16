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
  it("Escanear tem 48 px sem crescer a linha do rótulo", () => {
    abrir();
    click("Digitar código");
    const b = screen.getByRole("button", { name: /Escanear/ });
    expect(b.className).toContain("min-h-12");
    expect(b.className).toContain("-my-1");
  });

  it("Remover validade tem 48 px", () => {
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
    expect(rem.className).toContain("h-12");
    expect(rem.className).toContain("w-12");
    expect(rem.className).toContain("shrink-0");
  });

  it("nenhum texto de 11 px nem botão de 36 px no cadastro", () => {
    const src = readFileSync("src/components/ProductArea.tsx", "utf8");
    expect(src).not.toMatch(/text-\[11px\]/);
    expect(src).not.toMatch(/\bmin-h-9\b|\bh-9 w-9\b/);
  });
});

describe("M15 — campos legíveis (bloco B, preço e unidade)", () => {
  it("% de lucro com 44 px; unidade e categoria com rótulo e ajuda iguais aos outros campos", () => {
    const submit = abrir();
    click("Digitar código"); typeIn("Código do produto", "7890001"); typeIn("Nome do produto", "Produto"); submit();
    expect(screen.getByLabelText(/Lucro sobre o custo/).className).toContain("h-11");
    const rotuloUn = screen.getByText("Unidade de medida");
    expect(rotuloUn.className).toContain("short:text-xs");
    expect(screen.getByText("Como você vende este produto.").className).toContain("field-hint");
    expect(screen.getByText("Categoria").className).toContain("short:text-xs");
    expect(screen.getByText("Ajuda a organizar a lista.").className).toContain("field-hint");
  });
});

describe("M15 — campos legíveis (bloco C, depósito e área de venda nas roupas)", () => {
  it("quantidade do cadastro com a unidade; limites e aviso no mesmo tamanho dos outros tipos", () => {
    const p = { id: 1, codigo: "789", nome: "Camiseta", compra: 1000, venda: 1500, unidade: "Peça", categoria: "Camisetas", detalhes: {}, fornecedor: null,
      variacoes: [{ tam: "M", cor: "Azul", codigo: "222", qtd: 2, uid: "a" }] } as never;
    render(<ProductWizard store={{ id: "s", nome: "Loja", tipo: "roupas" } as never} products={[p]} initial={p} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={() => {}} />);
    const submit = () => fireEvent.submit(document.querySelector("form")!);
    for (let i = 0; i < 4; i++) submit();
    click("Definir depois"); submit();
    click(/^Não, vou contar o (depósito|estoque)$/);
    expect(screen.getByText("Quantidade informada no cadastro: 2 peças")).toBeTruthy();
    typeIn(/Quantidade confirmada no (depósito|estoque)/, "9"); submit();
    fireEvent.change(document.querySelector('input[name="dmax-a"]')!, { target: { value: "5" } });
    expect(screen.getByText(/^Máximo 5 · Sem mínimo/).className).toContain("text-sm");
    expect(screen.getByText(/Você tem mais que o desejado/).className).toContain("text-sm");
  });
});

describe("M15 — campos legíveis (bloco D, validade)", () => {
  it("distribuído e falta distribuir com a unidade", () => {
    const submit = abrir();
    click("Digitar código"); typeIn("Código do produto", "7890001"); typeIn("Nome do produto", "Produto"); submit();
    typeIn("Preço de compra", "1000"); typeIn("Preço de venda", "1500"); click("Pacote"); typeIn("Categoria", "Mercearia"); submit();
    submit(); click("Definir depois"); submit();
    click(/^Novo local$/); typeIn("Nome do local", "Estante A"); click("Usar este local"); submit();
    typeIn(/Quanto você contou/, "5"); submit(); submit();
    click(/Novo local de venda/); typeIn("Nome do local de venda", "Balcão"); click("Usar este local de venda"); submit();
    typeIn(/Quanto deste produto já está neste local/, "0"); submit(); submit();
    click("Sim"); submit(); submit();
    expect(screen.getByText(/Distribuído: \d+ pacotes? · Falta distribuir: \d+ pacotes?/)).toBeTruthy();
  });
  it("Desfazer com 48 px e explicação da pendência em letra de 14 px", () => {
    const src = readFileSync("src/components/ProductArea.tsx", "utf8");
    expect(src).toMatch(/className="-my-2 inline-flex min-h-12 items-center px-1 font-semibold text-primary underline">Desfazer</);
    expect(src).toMatch(/p-2\.5 text-sm">\s*<p>\{PEND_CONF\}<\/p>/);
  });
});
