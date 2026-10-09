import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AreaVendaInfo, ProductWizard, TotalInfo, type Product } from "@/components/ProductArea";
import { REMOCAO_BLOQUEADA, MAX_MENOR, NEGATIVO, QTD_VAZIA } from "@/lib/deposito";
import { TOTAL_INDISPONIVEL, VEN_ACIMA_MAX, VEN_LOCAL_DUP, VEN_LOCAL_PENDENTE, VEN_SEM_CONFIG, locaisVendaDoComercio, totalTexto } from "@/lib/areaVenda";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const base = (unidade: string, categoria: string, extra: Partial<Product> = {}): Product => ({
  id: 1, codigo: "789", nome: "Item", compra: 1000, venda: 1500, unidade, categoria, detalhes: {}, variacoes: [], fornecedor: null, ...extra,
});
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const typeIn = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const saved = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0]![0] as Product;

function setup(tipo: string, initial?: Product, products: Product[] = initial ? [initial] : []) {
  const onSave = vi.fn();
  render(<ProductWizard store={{ id: "s", nome: "Loja", tipo } as never} products={products} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  return { onSave, submit };
}
const novoLocalVenda = (nome: string) => { click(/Novo local de venda/); typeIn("Nome do local de venda", nome); click("Usar este local de venda"); };

/** Preenche um produto realmente novo, do formulário vazio até o passo Área de venda. */
function novoAteVenda(tipo: string, unidade: string, categoria: string) {
  const t = setup(tipo);
  click("Digitar código"); typeIn("Código do produto", "7890001"); typeIn("Nome do produto", "Produto novo"); t.submit();
  typeIn("Preço de compra", "1000"); typeIn("Preço de venda", "1500"); click(unidade); typeIn("Categoria", categoria); t.submit();
  if (tipo === "roupas") {
    click(/Adicionar variação/); click("M"); typeIn("Cor", "Azul"); typeIn("Código de barras", "5550001"); typeIn(/^Quantidade$/, "2"); click("Adicionar");
  }
  t.submit(); // detalhes (Pular) ou grade
  click("Definir depois"); t.submit(); // fornecedor
  // depósito
  click(/^Novo local$/); typeIn("Nome do local", "Estante A"); click("Usar este local"); t.submit();
  if (tipo === "roupas") { click("Não, vou contar o depósito"); typeIn(/Quantidade confirmada no depósito/, "5"); }
  else typeIn(/Quanto você contou/, "40");
  t.submit(); t.submit();
  expect(screen.getByText("Área de venda: onde fica?")).toBeTruthy();
  return t;
}

describe("produto novo, do formulário vazio até salvar, nos seis tipos", () => {
  const casos: [string, string, string][] = [
    ["mercado", "Pacote", "Mercearia"], ["farmacia", "Caixa", "Medicamentos"], ["construcao", "Saco", "Básico"],
    ["pet", "Unidade", "Ração"], ["autopecas", "Kit", "Motor"],
  ];
  it.each(casos)("%s salva área de venda separada do depósito e mostra o total", (tipo, u, c) => {
    const t = novoAteVenda(tipo, u, c);
    expect(screen.queryByRole("button", { name: /Manter sem configurar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Estante A" })).toBeNull(); // locais do depósito não aparecem aqui
    novoLocalVenda("Estante A"); t.submit(); // mesmo nome é permitido: conjunto diferente
    typeIn(/Quanto deste produto já está neste local/, "8");
    expect(screen.getByText(`Depósito 40 + Área de venda 8 = 48 ${u} no total`)).toBeTruthy();
    t.submit();
    typeIn(/^Mínimo/, "4"); typeIn(/^Máximo que cabe/, "12"); t.submit();
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    t.submit();
    const p = saved(t.onSave);
    expect(p.areaVenda).toEqual({ local: "Estante A", qtd: 8, min: 4, max: 12 });
    expect(p.deposito).toMatchObject({ local: "Estante A", qtd: 40 });
  });
  it("roupas conta por variação sem copiar o cadastro nem o depósito", () => {
    const t = novoAteVenda("roupas", "Peça", "Camisetas");
    novoLocalVenda("Arara 2"); t.submit();
    const campo = screen.getByLabelText(/Quanto desta variação já está neste local/) as HTMLInputElement;
    expect(campo.value).toBe("");
    t.submit(); expect(screen.getByText(QTD_VAZIA)).toBeTruthy();
    fireEvent.change(campo, { target: { value: "3" } });
    expect(screen.getByText("M · Azul: Depósito 5 + Área de venda 3 = 8 Peça no total")).toBeTruthy();
    t.submit(); t.submit(); t.submit();
    const p = saved(t.onSave); const uid = p.variacoes[0]!.uid!;
    expect(p.areaVenda).toEqual({ local: "Arara 2", qtd: null, min: null, max: null, vars: { [uid]: { qtd: 3, min: null, max: null } } });
    expect(p.variacoes[0]!.qtd).toBe(2);
  });
  it("produto novo não pula a área de venda em silêncio", () => {
    const t = novoAteVenda("mercado", "Pacote", "Mercearia");
    t.submit(); expect(screen.getByText("Área de venda: onde fica?")).toBeTruthy();
    click("Definir depois"); expect(screen.getByText(VEN_LOCAL_PENDENTE)).toBeTruthy();
    t.submit(); expect(screen.getByText("Área de venda: quantidade")).toBeTruthy();
  });
});

describe("quantidade e limites", () => {
  const ateQtd = (u = "Pacote") => { const t = setup("mercado", base(u, "Mercearia")); for (let i = 0; i < 5; i++) t.submit(); click("Definir depois"); t.submit(); return t; };
  it("vazio bloqueia, zero é aceito", () => {
    const t = ateQtd(); t.submit(); expect(screen.getByText(QTD_VAZIA)).toBeTruthy();
    typeIn(/Quanto deste produto/, "0"); t.submit(); t.submit(); t.submit();
    expect(saved(t.onSave).areaVenda).toEqual({ local: null, qtd: 0, min: null, max: null });
  });
  it("negativo é recusado", () => { const t = ateQtd(); typeIn(/Quanto deste produto/, "-2"); t.submit(); expect(screen.getByText(NEGATIVO)).toBeTruthy(); });
  it("Caixa recusa 1,5 e Kg aceita 1,5", () => {
    const a = ateQtd("Caixa"); typeIn(/Quanto deste produto/, "1,5"); a.submit();
    expect(screen.getByText("Use um número inteiro para Caixa.")).toBeTruthy();
  });
  it("Kg salva fração", () => {
    const t = ateQtd("Kg"); typeIn(/Quanto deste produto/, "1,5"); t.submit(); t.submit(); t.submit();
    expect(saved(t.onSave).areaVenda?.qtd).toBe(1.5);
  });
  it("limites opcionais, máximo menor bloqueia, acima do máximo só avisa", () => {
    const t = ateQtd(); typeIn(/Quanto deste produto/, "20"); t.submit();
    expect(screen.getByText("Alertas de reposição não configurados")).toBeTruthy();
    typeIn(/^Mínimo/, "4"); expect(screen.getByText(/Sem máximo: será possível identificar/)).toBeTruthy();
    typeIn(/^Máximo que cabe/, "2"); expect(screen.getByText(MAX_MENOR)).toBeTruthy();
    t.submit(); t.submit(); expect(t.onSave).not.toHaveBeenCalled();
    typeIn(/^Máximo que cabe/, "12"); expect(screen.getByText(VEN_ACIMA_MAX)).toBeTruthy();
    t.submit(); t.submit();
    expect(saved(t.onSave).areaVenda).toMatchObject({ qtd: 20, min: 4, max: 12 });
  });
});

describe("total para conferência", () => {
  it("só soma contagens confirmadas", () => {
    expect(totalTexto(40, 8, "Pacote")).toBe("Depósito 40 + Área de venda 8 = 48 Pacote no total");
    expect(totalTexto(null, 8, "Pacote")).toBe(TOTAL_INDISPONIVEL);
    expect(totalTexto(1.2, 0.1, "Kg")).toBe("Depósito 1,2 + Área de venda 0,1 = 1,3 Kg no total");
  });
  it("roupas por variação, sem usar a quantidade do cadastro", () => {
    const p = base("Peça", "Camisetas", { variacoes: [{ tam: "M", cor: "Azul", qtd: 99, uid: "a" }, { tam: "G", cor: "Azul", qtd: 99, uid: "b" }],
      deposito: { local: "X", qtd: null, min: null, max: null, vars: { a: { qtd: 2, min: null, max: null }, b: { qtd: 1, min: null, max: null } } },
      areaVenda: { local: "Arara", qtd: null, min: null, max: null, vars: { a: { qtd: 3, min: null, max: null } } } });
    render(<TotalInfo p={p} />);
    expect(screen.getByText("M · Azul: Depósito 2 + Área de venda 3 = 5 Peça no total")).toBeTruthy();
    expect(screen.getByText(`G · Azul: ${TOTAL_INDISPONIVEL}`)).toBeTruthy();
  });
});

describe("produtos antigos, bloqueios e variações", () => {
  it("antigo sem configuração mantém 'Área de venda não configurada'", () => {
    const p = base("Pacote", "Mercearia"); const t = setup("mercado", p);
    for (let i = 0; i < 5; i++) t.submit();
    expect(screen.getByRole("button", { name: /Manter sem configurar/ }).getAttribute("aria-pressed")).toBe("true");
    t.submit(); expect(screen.getByText(VEN_SEM_CONFIG)).toBeTruthy(); expect(screen.getAllByText(TOTAL_INDISPONIVEL).length).toBeGreaterThan(0);
    t.submit(); expect(saved(t.onSave).areaVenda).toBeUndefined();
    render(<AreaVendaInfo p={p} />); expect(screen.getAllByText(VEN_SEM_CONFIG).length).toBeGreaterThan(0);
  });
  it("com saldo, trocar local é bloqueado e a quantidade fica só para consulta", () => {
    const p = base("Pacote", "Mercearia", { areaVenda: { local: "G1", qtd: 4, min: null, max: null } });
    const t = setup("mercado", p); for (let i = 0; i < 5; i++) t.submit();
    click("Definir depois"); expect(screen.getByText(/exigirá uma transferência/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "G1" }).getAttribute("aria-pressed")).toBe("true");
    t.submit(); expect(screen.getByText(/Quantidade confirmada na área de venda/)).toBeTruthy();
    expect(screen.queryByLabelText(/Quanto deste produto/)).toBeNull();
  });
  it("com zero, pode trocar; local pendente pode ser definido", () => {
    const p = base("Pacote", "Mercearia", { areaVenda: { local: null, qtd: 0, min: null, max: null } });
    const t = setup("mercado", p); for (let i = 0; i < 5; i++) t.submit();
    novoLocalVenda("G9"); t.submit(); t.submit(); t.submit(); t.submit();
    expect(saved(t.onSave).areaVenda).toEqual({ local: "G9", qtd: 0, min: null, max: null });
  });
  it("unidade bloqueada só com área de venda configurada", () => {
    const t = setup("mercado", base("Pacote", "Mercearia", { areaVenda: { local: "G1", qtd: 0, min: null, max: null } }));
    t.submit(); click("Kg"); expect(screen.getByText(/a unidade não pode ser alterada/)).toBeTruthy();
  });
  it("remoção bloqueada com saldo na área de venda; uid preservado ao reordenar", () => {
    const vars = [{ tam: "G", cor: "Preto", codigo: "333", qtd: 1, uid: "b" }, { tam: "M", cor: "Azul", codigo: "222", qtd: 5, uid: "a" }];
    const p = base("Peça", "Camisetas", { variacoes: vars, areaVenda: { local: "Arara", qtd: null, min: null, max: null, vars: { a: { qtd: 2, min: 1, max: 4 }, b: { qtd: 0, min: null, max: null } } } });
    const t = setup("roupas", p); t.submit(); t.submit();
    const rem = screen.getAllByRole("button", { name: "Remover variação" });
    fireEvent.click(rem[1]!); expect(screen.getByText(REMOCAO_BLOQUEADA)).toBeTruthy();
    fireEvent.click(rem[0]!);
    for (let i = 0; i < 6; i++) t.submit(); t.submit();
    const s = saved(t.onSave); expect(s.variacoes.map((v) => v.uid)).toEqual(["a"]); expect(s.areaVenda?.vars).toEqual({ a: { qtd: 2, min: 1, max: 4 } });
  });
  it("nova variação exige contagem própria", () => {
    const p = base("Peça", "Camisetas", { variacoes: [{ tam: "M", cor: "Azul", codigo: "222", qtd: 2, uid: "a" }, { tam: "P", cor: "Azul", codigo: "444", qtd: 3, uid: "n" }],
      areaVenda: { local: "Arara", qtd: null, min: null, max: null, vars: { a: { qtd: 2, min: null, max: null } } } });
    const t = setup("roupas", p); for (let i = 0; i < 5; i++) t.submit(); t.submit();
    expect(screen.getAllByLabelText(/Quanto desta variação/)).toHaveLength(1);
    t.submit(); expect(screen.getByText(QTD_VAZIA)).toBeTruthy();
  });
  it("usar os mesmos limites para todas", () => {
    const p = base("Peça", "Camisetas", { variacoes: [{ tam: "M", cor: "Azul", codigo: "222", qtd: 2, uid: "a" }, { tam: "G", cor: "Azul", codigo: "333", qtd: 1, uid: "b" }] });
    const t = setup("roupas", p); for (let i = 0; i < 5; i++) t.submit();
    click("Definir depois"); t.submit();
    fireEvent.change(document.querySelector('input[name="vq-a"]')!, { target: { value: "1" } });
    fireEvent.change(document.querySelector('input[name="vq-b"]')!, { target: { value: "0" } });
    t.submit();
    fireEvent.change(document.querySelector('input[name="vmin-a"]')!, { target: { value: "1" } });
    fireEvent.change(document.querySelector('input[name="vmax-a"]')!, { target: { value: "6" } });
    click("Usar os mesmos limites para todas"); t.submit(); t.submit();
    expect(saved(t.onSave).areaVenda?.vars?.["b"]).toEqual({ qtd: 0, min: 1, max: 6 });
  });
});

describe("locais e navegação", () => {
  it("locais de venda são do comércio e separados do depósito", () => {
    const outro = base("Pacote", "Mercearia", { id: 2, codigo: "1", deposito: { local: "Estante A", qtd: 1, min: null, max: null }, areaVenda: { local: "Gôndola 3", qtd: 1, min: null, max: null } });
    expect(locaisVendaDoComercio([outro])).toEqual(["Gôndola 3"]);
    const p = base("Pacote", "Mercearia"); const t = setup("mercado", p, [p, outro]); for (let i = 0; i < 5; i++) t.submit();
    expect(screen.getByRole("button", { name: "Gôndola 3" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Estante A" })).toBeNull();
    click(/Novo local de venda/); typeIn("Nome do local de venda", "  gôndola 3 "); expect(screen.getByText(VEN_LOCAL_DUP)).toBeTruthy();
  });
  it("Voltar percorre os subpassos e de Local volta ao Depósito", () => {
    const p = base("Pacote", "Mercearia", { deposito: { local: "A", qtd: 1, min: null, max: null }, areaVenda: { local: "G", qtd: 1, min: null, max: null } });
    setup("mercado", p);
    const t = { submit: () => fireEvent.submit(document.querySelector("form")!) };
    for (let i = 0; i < 10; i++) t.submit();
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    click(/Voltar/); expect(screen.getByText("Área de venda: limites")).toBeTruthy();
    click(/Voltar/); click(/Voltar/); expect(screen.getByText("Área de venda: onde fica?")).toBeTruthy();
    click(/Voltar/); expect(screen.getByText("Limites de estoque")).toBeTruthy();
  });
  it("Editar pelo resumo leva ao subpasso e volta quando válido", () => {
    const p = base("Pacote", "Mercearia", { deposito: { local: "A", qtd: 1, min: null, max: null }, areaVenda: { local: "G", qtd: 5, min: null, max: null } });
    const t = setup("mercado", p); for (let i = 0; i < 10; i++) t.submit();
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Editar/ })[9]!);
    expect(screen.getByText("Área de venda: limites")).toBeTruthy();
    typeIn(/^Máximo que cabe/, "3"); typeIn(/^Mínimo/, "5"); t.submit();
    expect(screen.getByText("Área de venda: limites")).toBeTruthy(); // inválido não volta
    typeIn(/^Máximo que cabe/, "8"); t.submit();
    expect(screen.getByText("Salvar produto")).toBeTruthy(); t.submit();
    expect(saved(t.onSave).areaVenda).toEqual({ local: "G", qtd: 5, min: 5, max: 8 });
  });
});
