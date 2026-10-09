import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";
import { TIPOS } from "@/components/StoreSetup";
import { LOCAIS_SUGERIDOS, textoDoTipo, usaEstoque } from "@/lib/exemplos";
import { EMBALAGENS_POR_TIPO, TIPOS_EMBALAGEM, descricaoEmbalagem, embalagensDoTipo, rotuloComoChega, rotuloFechadas, rotuloPrecoEmbalagem } from "@/lib/embalagem";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

describe("depósito ou estoque", () => {
  it("mercado e pet falam depósito; os outros, estoque", () => {
    expect(usaEstoque("mercado")).toBe(false);
    expect(usaEstoque("pet")).toBe(false);
    for (const t of ["farmacia", "roupas", "construcao", "autopecas"]) expect(usaEstoque(t)).toBe(true);
  });
  it("troca a palavra mantendo o resto da frase", () => {
    expect(textoDoTipo("farmacia")("Quanto há no depósito?")).toBe("Quanto há no estoque?");
    expect(textoDoTipo("farmacia")("Depósito não configurado")).toBe("Estoque não configurado");
    expect(textoDoTipo("mercado")("Quanto há no depósito?")).toBe("Quanto há no depósito?");
    expect(textoDoTipo(undefined)("Depósito")).toBe("Depósito");
  });
  it("farmácia: o passo mostra 'Estoque' no título", () => {
    const p: Product = { id: 1, codigo: "7891234567895", nome: "Xarope", compra: 1000, venda: 1500, unidade: "Frasco", categoria: "Medicamentos", detalhes: {}, variacoes: [], fornecedor: null };
    render(<ProductWizard store={{ id: "s", nome: "F", tipo: "farmacia" } as never} products={[p]} initial={p} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={() => {}} />);
    const submit = () => fireEvent.submit(document.querySelector("form")!);
    for (let i = 0; i < 4; i++) submit();
    expect(screen.getByText("Onde fica no estoque?")).toBeTruthy();
    expect(screen.queryByText(/depósito/i)).toBeNull();
  });
});

describe("locais sugeridos", () => {
  it("todo tipo tem sugestões para os dois lugares", () => {
    for (const t of TIPOS) { expect(LOCAIS_SUGERIDOS[t.id]?.dep.length, t.id).toBeGreaterThan(0); expect(LOCAIS_SUGERIDOS[t.id]?.ven.length, t.id).toBeGreaterThan(0); }
  });
  it("farmácia tem atrás do balcão e armário de controlados", () => {
    expect(LOCAIS_SUGERIDOS["farmacia"]!.ven).toEqual(expect.arrayContaining(["Atrás do balcão", "Armário de controlados"]));
  });
  it("um toque preenche o começo do nome", () => {
    const p: Product = { id: 1, codigo: "7891234567895", nome: "Tinta", compra: 1000, venda: 1500, unidade: "Lata", categoria: "Pintura", detalhes: {}, variacoes: [], fornecedor: null };
    render(<ProductWizard store={{ id: "s", nome: "C", tipo: "construcao" } as never} products={[p]} initial={p} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={() => {}} />);
    const submit = () => fireEvent.submit(document.querySelector("form")!);
    for (let i = 0; i < 4; i++) submit();
    fireEvent.click(screen.getByRole("button", { name: /^Novo local$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pátio" }));
    expect((document.getElementById("dlocal") as HTMLInputElement).value).toBe("Pátio ");
    expect(screen.queryByText("Toque para começar:")).toBeNull();
  });
});

describe("embalagens de cada tipo", () => {
  it("farmácia não tem fardo; construção tem pallet e milheiro", () => {
    expect(embalagensDoTipo("farmacia")).not.toContain("Fardo");
    expect(embalagensDoTipo("construcao")).toEqual(expect.arrayContaining(["Pallet", "Milheiro"]));
    for (const l of Object.values(EMBALAGENS_POR_TIPO)) for (const t of l) expect(TIPOS_EMBALAGEM).toContain(t);
  });
  it("textos dos botões e campos", () => {
    expect(rotuloComoChega("mercado")).toBe("Em caixa, fardo ou pacote");
    expect(rotuloComoChega("farmacia")).toBe("Em caixa, display ou pacote");
    expect(rotuloComoChega("construcao")).toBe("Em saco, pallet ou milheiro");
    expect(rotuloComoChega("pet")).toBe("Em saco, caixa ou fardo");
    expect(rotuloPrecoEmbalagem("Caixa")).toBe("Preço da caixa");
    expect(rotuloPrecoEmbalagem("Fardo")).toBe("Preço do fardo");
    expect(descricaoEmbalagem({ tipo: "Pallet", qtd: 40 }, "Saco")).toBe("Pallet com 40 sacos");
    expect(rotuloFechadas({ tipo: "Milheiro", qtd: 1000 }, "Unidade")).toBe("Milheiros com 1.000 fechados");
  });
  it("a lista do app é a mesma que o banco aceita", () => {
    const pasta = join(process.cwd(), "supabase/migrations");
    const sql = readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort().reverse()
      .map((f) => readFileSync(join(pasta, f), "utf8")).find((t) => t.includes("produto_embalagens_tipo_check"))!;
    const m = sql.match(/check \(tipo in \(([^)]+)\)\)/)!;
    expect(m[1]!.split(",").map((x) => x.trim().replace(/'/g, ""))).toEqual([...TIPOS_EMBALAGEM]);
  });
});
