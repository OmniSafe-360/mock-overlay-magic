import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, brl2, type Product } from "@/components/ProductArea";
import { opcoesEtiqueta } from "@/components/Etiqueta";
import { montarPedido, montarProdutos } from "@/lib/persistencia";
import { EMB_VAZIA } from "@/lib/embalagem";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const typeIn = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const tiss: Product = { id: 1, codigo: "7896263503203", nome: "Refrigerante Tiss", compra: 249, venda: 349, unidade: "Unidade", categoria: "Bebidas",
  detalhes: {}, variacoes: [], fornecedor: null };

function editar(p: Product, tipo = "mercado") {
  const onSave = vi.fn();
  render(<ProductWizard store={{ id: "s", nome: "Loja", tipo } as never} products={[p]} initial={p} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  submit(); submit(); submit(); // até "Quem é o fornecedor?"
  return { onSave, submit, salvo: () => onSave.mock.calls[0]![0] as Product };
}
const salvarSheet = () => fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

describe("como chega do fornecedor (embalagens)", () => {
  it("por unidade vem marcado e passa direto", () => {
    const t = editar(tiss);
    expect(screen.getByRole("button", { name: /Por unidade/ }).getAttribute("aria-pressed")).toBe("true");
    for (let i = 0; i < 5; i++) t.submit();
    expect(t.salvo().embalagens).toEqual([]);
  });

  it("caixa com 12 a R$ 30,00: calcula R$ 2,50 a unidade, usa como compra e salva a caixa", () => {
    const t = editar(tiss);
    click(/Em caixa, fardo ou pacote/); // já abre a janela
    typeIn("Quantas unidades vêm dentro?", "12");
    typeIn(/Código de barras da embalagem/, "17896263503200");
    typeIn(/Preço da caixa/, "3000");
    expect(screen.getByRole("dialog").textContent).toContain(`Cada unidade sai por ${brl2(250)}`);
    expect(screen.getByRole("button", { name: /Usar .* como preço de compra/ }).getAttribute("aria-pressed")).toBe("true");
    salvarSheet();
    expect(screen.getByText("Caixa com 12")).toBeTruthy();
    for (let i = 0; i < 5; i++) t.submit();
    const p = t.salvo();
    expect(p.compra).toBe(250);
    expect(p.embalagens).toMatchObject([{ tipo: "Caixa", qtd: 12, codigo: "17896263503200", preco: 3000 }]);
  });

  it("não usar o preço calculado mantém o preço de compra", () => {
    const t = editar(tiss);
    click(/Em caixa, fardo ou pacote/);
    typeIn("Quantas unidades vêm dentro?", "12"); typeIn(/Preço da caixa/, "3000");
    click(/Usar .* como preço de compra/);
    salvarSheet();
    for (let i = 0; i < 5; i++) t.submit();
    expect(t.salvo().compra).toBe(249);
  });

  it("escolher caixa sem adicionar nenhuma não deixa continuar", () => {
    editar(tiss);
    click(/Em caixa, fardo ou pacote/);
    fireEvent.click(screen.getAllByRole("button", { name: "Fechar" })[0]!); // fundo escuro da janela
    expect(screen.getByText(EMB_VAZIA)).toBeTruthy();
    fireEvent.submit(document.querySelector("form")!);
    expect(screen.getByText("Quem é o fornecedor?")).toBeTruthy();
  });

  it("não aceita código igual ao do produto nem quantidade quebrada em Unidade", () => {
    editar(tiss);
    click(/Em caixa, fardo ou pacote/);
    typeIn("Quantas unidades vêm dentro?", "1,5");
    typeIn(/Código de barras da embalagem/, tiss.codigo);
    salvarSheet();
    expect(screen.getByText(/inteiro/)).toBeTruthy();
    expect(screen.getByText(/diferente do código do produto/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("produto que já tem caixa: voltar para 'Por unidade' remove ao salvar", () => {
    const t = editar({ ...tiss, embalagens: [{ uid: "e1", tipo: "Caixa", qtd: 12, codigo: "", preco: 0 }] });
    expect(screen.getByText("Caixa com 12")).toBeTruthy();
    click(/Por unidade/);
    for (let i = 0; i < 5; i++) t.submit();
    expect(t.salvo().embalagens).toEqual([]);
  });

  it("loja de roupas não mostra a pergunta", () => {
    editar({ ...tiss, unidade: "Peça", categoria: "Camisetas", variacoes: [{ tam: "M", cor: "Azul", codigo: "123", qtd: 1, uid: "v1" }] }, "roupas");
    expect(screen.queryByText("Como chega do fornecedor?")).toBeNull();
  });
});

describe("embalagens no banco e na etiqueta", () => {
  it("pedido leva a lista em reais; roupas não leva", () => {
    const p: Product = { ...tiss, db: { id: "p1", contadas: [] }, embalagens: [{ uid: "e1", tipo: "Caixa", qtd: 12, codigo: " 1789 ", preco: 3000 }, { uid: "e2", tipo: "Fardo", qtd: 72, codigo: "", preco: 0 }] };
    expect(montarPedido(p, "op", "c", []).embalagens).toEqual([
      { id: "e1", tipo: "Caixa", quantidade: 12, codigo_barras: "1789", preco_compra: 30 },
      { id: "e2", tipo: "Fardo", quantidade: 72, codigo_barras: null, preco_compra: null },
    ]);
    const roupa = { ...p, variacoes: [{ tam: "M", cor: "Azul", codigo: "1", qtd: 1, uid: "v" }] };
    expect("embalagens" in montarPedido(roupa, "op", "c", [])).toBe(false);
  });
  it("ao carregar, volta em centavos e na ordem de cadastro", () => {
    const [p] = montarProdutos({
      produtos: [{ id: "p1", nome: "Tiss", codigo_barras: "789", preco_compra: "2.49", preco_venda: "3.49", unidade: "Unidade", categoria: "Bebidas", detalhes: {}, controla_validade: null }],
      variacoes: [], areas: [], locais: [], contagens: [], saldos: [], lotes: [],
      embalagens: [
        { id: "e2", produto_id: "p1", tipo: "Fardo", quantidade: "72.000", codigo_barras: null, preco_compra: null, created_at: "2026-10-09T11:00:00Z" },
        { id: "e1", produto_id: "p1", tipo: "Caixa", quantidade: "12.000", codigo_barras: "1789", preco_compra: "30.00", created_at: "2026-10-09T10:00:00Z" },
      ],
    }, []);
    expect(p!.embalagens).toEqual([
      { uid: "e1", tipo: "Caixa", qtd: 12, codigo: "1789", preco: 3000 },
      { uid: "e2", tipo: "Fardo", qtd: 72, codigo: "", preco: 0 },
    ]);
  });
  it("etiqueta da caixa usa o código da caixa e sai sem preço", () => {
    const ops = opcoesEtiqueta({ ...tiss, embalagens: [{ tipo: "Caixa", qtd: 12, codigo: "17896263503200" }, { tipo: "Fardo", qtd: 72, codigo: "" }] });
    expect(ops.map((o) => [o.rotulo, o.codigo, !!o.semPreco])).toEqual([["Produto", tiss.codigo, false], ["Caixa com 12", "17896263503200", true]]);
  });
});
