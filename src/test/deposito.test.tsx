import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";
import { FichaProduto } from "@/components/FichaProduto";
import { LOCAL_DUP, LOCAL_PENDENTE, MAX_MENOR, NEGATIVO, QTD_VAZIA, REMOCAO_BLOQUEADA, SEM_CONFIG, ACIMA_MAX, locaisDoComercio, parseNum } from "@/lib/deposito";

import { textoDoTipo } from "@/lib/exemplos";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const base = (tipo: string, unidade: string, categoria: string, extra: Partial<Product> = {}): Product => ({
  id: 1, codigo: "789", nome: "Item", compra: 1000, venda: 1500, unidade, categoria, detalhes: {}, variacoes: [], fornecedor: null, ...extra,
});
const roupa = (extra: Partial<Product> = {}) => base("roupas", "Peça", "Camisetas", { variacoes: [{ tam: "M", cor: "Azul", codigo: "222", qtd: 2, uid: "a" }], ...extra });

function setup(tipo: string, initial: Product, products: Product[] = [initial]) {
  const onSave = vi.fn();
  render(<ProductWizard store={{ id: "s", nome: "Loja", tipo } as never} products={products} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  /* Estes testes cobrem Depósito/Área de venda: produtos antigos passam pela Validade mantendo "sem configurar". */
  const submit = () => { fireEvent.submit(document.querySelector("form")!); if (screen.queryByText("Controle de validade") && screen.queryByRole("button", { name: /Manter sem configurar/, pressed: true })) fireEvent.submit(document.querySelector("form")!); };
  const toDeposito = () => { for (let i = 0; i < 4; i++) submit(); };
  return { onSave, submit, toDeposito };
}
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const novoLocal = (nome: string) => { click(/Novo local/); fireEvent.change(screen.getByLabelText("Nome do local"), { target: { value: nome } }); click("Usar este local"); };
const typeIn = (label: RegExp, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const saved = (onSave: ReturnType<typeof vi.fn>) => onSave.mock.calls[0]![0] as Product;

describe("passo Depósito — fluxo completo nos seis tipos", () => {
  const casos: [string, string, string][] = [
    ["mercado", "Pacote", "Mercearia"], ["farmacia", "Caixa", "Medicamentos"], ["construcao", "Saco", "Básico"],
    ["pet", "Unidade", "Ração"], ["autopecas", "Kit", "Motor"],
  ];
  it.each(casos)("%s salva local, quantidade e limites", (tipo, u, c) => {
    const t = setup(tipo, base(tipo, u, c)); t.toDeposito();
    novoLocal("Estante A · Prateleira 2"); t.submit();
    typeIn(/Quanto você contou/, "40"); t.submit();
    typeIn(/^Mínimo/, "10"); typeIn(/^Máximo desejado/, "60"); t.submit();
    t.submit(); expect(screen.getByText("Salvar produto")).toBeTruthy(); t.submit();
    expect(saved(t.onSave).deposito).toEqual({ local: "Estante A · Prateleira 2", qtd: 40, min: 10, max: 60 });
  });
  it("roupas salva com confirmação e um local para todas as variações", () => {
    const t = setup("roupas", roupa()); t.toDeposito();
    novoLocal("Arara 1"); t.submit();
    click(/^Sim, estão no (depósito|estoque)$/); t.submit(); t.submit(); t.submit(); t.submit();
    expect(saved(t.onSave).deposito).toEqual({ local: "Arara 1", qtd: null, min: null, max: null, vars: { a: { qtd: 2, min: null, max: null } } });
  });
});

describe("quantidade", () => {
  it("vazia bloqueia e zero é aceito", () => {
    const t = setup("mercado", base("mercado", "Pacote", "Mercearia")); t.toDeposito();
    click("Definir depois"); t.submit(); t.submit();
    expect(screen.getByText(QTD_VAZIA)).toBeTruthy();
    typeIn(/Quanto você contou/, "0"); t.submit(); t.submit(); t.submit(); t.submit();
    expect(saved(t.onSave).deposito).toMatchObject({ local: null, qtd: 0 });
  });
  it.each(["Kg", "Metro", "m²", "Litro"])("aceita fração em %s", (u) => {
    expect(parseNum("1,5", u, false)).toEqual({ v: 1.5, err: "" });
    expect(parseNum("1.5", u, false).err).toMatch(/vírgula/);
  });
  it.each(["Unidade", "Peça", "Par", "Pacote", "Caixa", "Cartela", "Frasco", "Saco", "Lata", "Jogo", "Kit"])("recusa fração em %s (sem virar 15)", (u) => {
    const r = parseNum("1,5", u, false);
    expect(r.v).toBeNull(); expect(r.err).toBe(`Use um número inteiro para ${u}.`);
  });
  it("no formulário, 1,5 em Caixa bloqueia e em Kg salva 1,5", () => {
    const a = setup("mercado", base("mercado", "Caixa", "Mercearia")); a.toDeposito();
    click("Definir depois"); a.submit(); typeIn(/Quanto você contou/, "1,5"); a.submit();
    expect(screen.getByText("Use um número inteiro para Caixa.")).toBeTruthy();
    expect(screen.getByText(/^Quanto há no (depósito|estoque)\?$/)).toBeTruthy();
  });
  it("Kg salva fração", () => {
    const t = setup("mercado", base("mercado", "Kg", "Mercearia")); t.toDeposito();
    click("Definir depois"); t.submit(); typeIn(/Quanto você contou/, "12,5"); t.submit(); t.submit(); t.submit(); t.submit();
    expect(saved(t.onSave).deposito?.qtd).toBe(12.5);
  });
});

describe("limites", () => {
  const ate = () => { const t = setup("mercado", base("mercado", "Pacote", "Mercearia")); t.toDeposito(); click("Definir depois"); t.submit(); typeIn(/Quanto você contou/, "80"); t.submit(); return t; };
  it("são opcionais", () => { const t = ate(); expect(screen.getByText("Alertas de estoque não configurados")).toBeTruthy(); t.submit(); t.submit(); t.submit(); expect(saved(t.onSave).deposito).toMatchObject({ min: null, max: null }); });
  it("negativo é recusado", () => { const t = ate(); typeIn(/^Mínimo/, "-1"); expect(screen.getByText(NEGATIVO)).toBeTruthy(); t.submit(); t.submit(); expect(t.onSave).not.toHaveBeenCalled(); });
  it("máximo menor que mínimo bloqueia", () => { const t = ate(); typeIn(/^Mínimo/, "10"); typeIn(/^Máximo desejado/, "5"); expect(screen.getByText(MAX_MENOR)).toBeTruthy(); t.submit(); t.submit(); expect(t.onSave).not.toHaveBeenCalled(); });
  it("só mínimo / só máximo mostram a situação", () => {
    ate(); typeIn(/^Mínimo/, "10"); expect(screen.getByText("Mínimo 10 · Sem máximo definido")).toBeTruthy();
    typeIn(/^Mínimo/, ""); typeIn(/^Máximo desejado/, "50"); expect(screen.getByText("Máximo 50 · Sem mínimo definido. Sem aviso de compra configurado")).toBeTruthy();
  });
  it("quantidade acima do máximo avisa sem bloquear", () => {
    const t = ate(); typeIn(/^Máximo desejado/, "50"); expect(screen.getByText(ACIMA_MAX)).toBeTruthy(); t.submit(); t.submit(); t.submit();
    expect(saved(t.onSave).deposito).toMatchObject({ qtd: 80, max: 50 });
  });
});

describe("roupas", () => {
  it("contagem separada aceita zero e não soma com a quantidade do cadastro", () => {
    const t = setup("roupas", roupa()); t.toDeposito(); click("Definir depois"); t.submit();
    click(/^Não, vou contar o (depósito|estoque)$/); t.submit();
    expect(screen.getByText(QTD_VAZIA)).toBeTruthy();
    typeIn(/Quantidade confirmada no (depósito|estoque)/, "0"); t.submit(); t.submit(); t.submit(); t.submit();
    const p = saved(t.onSave); expect(p.deposito?.vars?.["a"]?.qtd).toBe(0); expect(p.variacoes[0]!.qtd).toBe(2);
  });
  it("editar a quantidade do cadastro não altera o depósito confirmado", () => {
    const p = roupa({ deposito: { local: "Arara", qtd: null, min: null, max: null, vars: { a: { qtd: 2, min: null, max: null } } } });
    const t = setup("roupas", p); t.submit(); t.submit();
    click("Editar variação"); typeIn(/^Quantidade$/, "9"); click("Salvar variação");
    for (let i = 0; i < 6; i++) t.submit(); t.submit();
    const s = saved(t.onSave); expect(s.variacoes[0]!.qtd).toBe(9); expect(s.deposito?.vars?.["a"]?.qtd).toBe(2);
  });
  it("associação por variação preservada e remoção com quantidade positiva bloqueada", () => {
    const vars = [{ tam: "M", cor: "Azul", codigo: "222", qtd: 5, uid: "a" }, { tam: "G", cor: "Preto", codigo: "333", qtd: 1, uid: "b" }];
    const p = roupa({ variacoes: vars, deposito: { local: "Arara", qtd: null, min: null, max: null, vars: { a: { qtd: 5, min: 1, max: 9 }, b: { qtd: 0, min: null, max: null } } } });
    const t = setup("roupas", p); t.submit(); t.submit();
    const rem = screen.getAllByRole("button", { name: "Remover variação" });
    fireEvent.click(rem[0]!); expect(screen.getByText(textoDoTipo("roupas")(REMOCAO_BLOQUEADA))).toBeTruthy();
    fireEvent.click(rem[1]!);
    for (let i = 0; i < 6; i++) t.submit(); t.submit();
    const s = saved(t.onSave); expect(s.variacoes.map((v) => v.uid)).toEqual(["a"]); expect(s.deposito?.vars).toEqual({ a: { qtd: 5, min: 1, max: 9 } });
  });
  it("nova variação exige confirmação própria", () => {
    const p = roupa({ variacoes: [{ tam: "M", cor: "Azul", codigo: "222", qtd: 2, uid: "a" }, { tam: "P", cor: "Azul", codigo: "444", qtd: 3, uid: "n" }],
      deposito: { local: "Arara", qtd: null, min: null, max: null, vars: { a: { qtd: 2, min: null, max: null } } } });
    const t = setup("roupas", p); t.toDeposito(); t.submit();
    expect(screen.getByText(/^Essas quantidades estão no (depósito|estoque)\?$/)).toBeTruthy();
    expect(screen.getByText(/P · Azul · Quantidade informada no cadastro: 3/)).toBeTruthy();
    t.submit(); expect(screen.getByText(/^Quanto há no (depósito|estoque)\?$/)).toBeTruthy();
  });
  it("usar os mesmos limites para todas", () => {
    const p = roupa({ variacoes: [{ tam: "M", cor: "Azul", codigo: "222", qtd: 2, uid: "a" }, { tam: "G", cor: "Azul", codigo: "333", qtd: 1, uid: "b" }] });
    const t = setup("roupas", p); t.toDeposito(); click("Definir depois"); t.submit(); click(/^Sim, estão no (depósito|estoque)$/); t.submit();
    fireEvent.change(document.querySelector('input[name="dmin-a"]')!, { target: { value: "1" } });
    fireEvent.change(document.querySelector('input[name="dmax-a"]')!, { target: { value: "5" } });
    click("Usar os mesmos limites para todas"); t.submit(); t.submit(); t.submit();
    expect(saved(t.onSave).deposito?.vars?.["b"]).toEqual({ qtd: 1, min: 1, max: 5 });
  });
});

describe("locais, resumo e produtos antigos", () => {
  it("locais são do comércio aberto e não duplicam", () => {
    const outro = base("mercado", "Pacote", "Mercearia", { id: 2, codigo: "1", deposito: { local: "Estante A", qtd: 1, min: null, max: null } });
    expect(locaisDoComercio([outro])).toEqual(["Estante A"]);
    const p = base("mercado", "Pacote", "Mercearia");
    const t = setup("mercado", p, [p, outro]); t.toDeposito();
    expect(screen.getByRole("button", { name: "Estante A" })).toBeTruthy();
    click(/Novo local/); fireEvent.change(screen.getByLabelText("Nome do local"), { target: { value: "  estante a " } });
    expect(screen.getByText(LOCAL_DUP)).toBeTruthy();
  });
  it("outro comércio sem produtos não vê os locais", () => {
    const p = base("mercado", "Pacote", "Mercearia"); const t = setup("mercado", p, [p]); t.toDeposito();
    expect(screen.queryByRole("button", { name: "Estante A" })).toBeNull();
  });
  it("produto antigo sem configuração mantém 'Depósito não configurado'", () => {
    const p = base("mercado", "Pacote", "Mercearia"); const t = setup("mercado", p); t.toDeposito();
    expect(screen.getByRole("button", { name: /Manter sem configurar/ }).getAttribute("aria-pressed")).toBe("true");
    t.submit(); t.submit(); expect(screen.getByText(SEM_CONFIG)).toBeTruthy(); t.submit();
    expect(saved(t.onSave).deposito).toBeUndefined();
    render(<FichaProduto p={p} tipo="mercado" onBack={() => {}} onEdit={() => {}} />);
    expect(screen.getAllByText("Depósito não configurado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Não configurado").length).toBeGreaterThan(0);
  });
  it("detalhe mostra local pendente separado dos limites", () => {
    render(<FichaProduto p={base("mercado", "Pacote", "Mercearia", { deposito: { local: null, qtd: 3, min: null, max: null } })} tipo="mercado" onBack={() => {}} onEdit={() => {}} />);
    expect(screen.getByText("Local no depósito não definido")).toBeTruthy(); expect(screen.getByText("Local não definido")).toBeTruthy();
  });
  it("editar Limites pelo resumo volta ao resumo quando válido", () => {
    const p = base("mercado", "Pacote", "Mercearia", { deposito: { local: "A", qtd: 4, min: null, max: null } });
    const t = setup("mercado", p); for (let i = 0; i < 8; i++) t.submit();
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Editar/ })[7]!); // +1: linha "Como chega" no resumo
    expect(screen.getByText("Limites de estoque")).toBeTruthy();
    typeIn(/^Mínimo/, "2"); t.submit();
    expect(screen.getByText("Salvar produto")).toBeTruthy(); t.submit();
    expect(saved(t.onSave).deposito).toEqual({ local: "A", qtd: 4, min: 2, max: null });
  });
  it("com quantidade positiva, trocar local ou 'Definir depois' é bloqueado; com zero, permitido", () => {
    const p = base("mercado", "Pacote", "Mercearia", { deposito: { local: "A", qtd: 4, min: null, max: null } });
    const t = setup("mercado", p); t.toDeposito(); click("Definir depois");
    expect(screen.getByText(/exigirá uma transferência/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "A" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("com quantidade zero, pode trocar o local", () => {
    const p = base("mercado", "Pacote", "Mercearia", { deposito: { local: "A", qtd: 0, min: null, max: null } });
    const t = setup("mercado", p); t.toDeposito(); click("Definir depois");
    expect(screen.queryByText(/exigirá uma transferência/)).toBeNull();
    t.submit(); t.submit(); t.submit(); t.submit(); t.submit();
    expect(saved(t.onSave).deposito?.local).toBeNull();
  });
  it("mudar a unidade de produto com depósito é bloqueado", () => {
    const p = base("mercado", "Pacote", "Mercearia", { deposito: { local: "A", qtd: 4, min: null, max: null } });
    const t = setup("mercado", p); t.submit(); click("Kg");
    expect(screen.getByText(/a unidade não pode ser alterada/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pacote" }).getAttribute("aria-pressed")).toBe("true");
  });
});
