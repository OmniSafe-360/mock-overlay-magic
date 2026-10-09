import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, ValidadeInfo, validadeLinhas, type Product } from "@/components/ProductArea";
import {
  ACIMA, AGUARDANDO, AVISOS_NAO, DESLIGAR_BLOQ, PEND_CONF, SEM_ESTOQUE, VAL_FARM_INCOMPLETA, VAL_SEM_CONFIG, analisarLotes, conferencia,
  conferirSoma, faixa, faltaMsg, hojeEm, parseData, proximoVencimento, type Validade,
} from "@/lib/validade";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const typeIn = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const typeAll = (label: RegExp, vals: string[]) => screen.getAllByLabelText(label).forEach((el, i) => vals[i] !== undefined && fireEvent.change(el, { target: { value: vals[i] } }));
const saved = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0]![0] as Product;

function setup(tipo: string, initial?: Product) {
  const onSave = vi.fn();
  render(<ProductWizard store={{ id: "s", nome: "Loja", tipo } as never} products={initial ? [initial] : []} initial={initial} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  return { onSave, submit: () => fireEvent.submit(document.querySelector("form")!) };
}

/** Produto realmente novo, do formulário vazio até "Este produto tem validade?". */
function novoAteValidade(tipo: string, unidade: string, categoria: string, dep = "40", ven = "20") {
  const t = setup(tipo);
  click("Digitar código"); typeIn("Código do produto", "7890001"); typeIn("Nome do produto", "Produto novo"); t.submit();
  typeIn("Preço de compra", "1000"); typeIn("Preço de venda", "1500"); click(unidade); typeIn("Categoria", categoria); t.submit();
  t.submit(); click("Definir depois"); t.submit();
  click(/^Novo local$/); typeIn("Nome do local", "Estante A"); click("Usar este local"); t.submit();
  typeIn(/Quanto você contou/, dep); t.submit(); t.submit();
  click(/Novo local de venda/); typeIn("Nome do local de venda", "Gôndola 1"); click("Usar este local de venda"); t.submit();
  typeIn(/Quanto deste produto já está neste local/, ven); t.submit(); t.submit();
  expect(screen.getByText("Controle de validade")).toBeTruthy();
  return t;
}

describe("regras de data e faixas", () => {
  it("valida datas reais, inclusive bissextos", () => {
    expect(parseData("29/02/2024").v).toBe("2024-02-29");
    expect(parseData("29/02/2025").v).toBeNull();
    expect(parseData("31/04/2026").v).toBeNull();
    expect(parseData("2026-12-10").v).toBeNull();
    expect(parseData("10/12/2026").v).toBe("2026-12-10");
  });
  it("'hoje' usa America/Sao_Paulo, sem deslocar o dia", () => {
    expect(hojeEm("America/Sao_Paulo", new Date("2026-10-09T02:30:00Z"))).toBe("2026-10-08");
    expect(hojeEm("America/Sao_Paulo", new Date("2026-10-09T03:30:00Z"))).toBe("2026-10-09");
  });
  it("vencido só a partir do dia seguinte; limites das faixas", () => {
    const h = "2026-10-09";
    expect(faixa("2026-10-08", h)).toBe("vencido");
    expect(faixa("2026-10-09", h)).toBe("hoje");
    expect(faixa("2026-10-10", h)).toBe("ate30");
    expect(faixa("2026-11-08", h)).toBe("ate30"); // 30 dias
    expect(faixa("2026-11-09", h)).toBe("ate60"); // 31
    expect(faixa("2026-12-08", h)).toBe("ate60"); // 60
    expect(faixa("2026-12-09", h)).toBe("ate90"); // 61
    expect(faixa("2027-01-07", h)).toBe("ate90"); // 90
    expect(faixa("2027-01-08", h)).toBe("mais90"); // 91
    expect(faixa(null, h)).toBe("desconhecida");
  });
});

describe("somas em milésimos", () => {
  it("frações somam exatamente", () => {
    expect(conferirSoma(12.5, [7.25, 5.25]).err).toBe("");
    expect(conferirSoma(0.3, [0.1, 0.2]).err).toBe("");
    expect(conferirSoma(1.001, [1]).err).toBe(faltaMsg("0,001"));
    expect(conferirSoma(40, [25, 16]).err).toBe(ACIMA);
  });
  it("lote pendente não é uma quarta parcela; vencidos continuam no total físico", () => {
    const c = conferencia([
      { id: "a", qtd: 25, data: "2026-12-10", lote: null }, { id: "b", qtd: 10, data: "2026-01-01", lote: "X" }, { id: "c", qtd: 5, data: null, lote: null },
    ], "2026-10-09", true);
    expect(c).toEqual({ fisica: 40, conhecida: 25, vencida: 10, semData: 5, lotePend: 30 });
  });
  it("próximo vencimento ignora vencidos", () => {
    expect(proximoVencimento([{ id: "a", qtd: 3, data: "2026-01-01", lote: null }, { id: "b", qtd: 4, data: "2027-01-20", lote: null }], "2026-10-09"))
      .toEqual({ data: "2027-01-20", qtd: 4 });
  });
  it("lotes: mesmo número com datas diferentes é conflito; lotes diferentes com a mesma data ficam separados", () => {
    expect(analisarLotes([{ id: "1", lote: "A12", data: "2026-12-10" }, { id: "2", lote: "a12 ", data: "2026-12-11" }]).conflitos).toHaveLength(1);
    expect(analisarLotes([{ id: "1", lote: "A12", data: "2026-12-10" }, { id: "2", lote: "B7", data: "2026-12-10" }]).conflitos).toHaveLength(0);
    expect(analisarLotes([{ id: "1", lote: "A12", data: "2026-12-10" }, { id: "2", lote: "A12", data: null }]).sugestoes[0]).toMatchObject({ data: "2026-12-10", ids: ["2"] });
  });
});

describe("produto novo com validade", () => {
  it("duas validades no depósito sem duplicar estoque: total continua 60", () => {
    const t = novoAteValidade("mercado", "Unidade", "Mercearia");
    t.submit(); expect(screen.getByText("Controle de validade")).toBeTruthy(); // escolha explícita obrigatória
    click("Sim"); t.submit();
    expect(screen.getByText(AVISOS_NAO)).toBeTruthy(); t.submit(); // nenhum aviso é permitido
    expect(screen.getByText(/Contado:/).textContent).toContain("40");
    typeIn(/^Quantidade \(/, "25"); typeIn("Vence em", "10/12/2026");
    click(/Adicionar outra validade/);
    typeAll(/^Quantidade \(/, ["25", "15"]); typeAll(/^Vence em/, ["10/12/2026", "20/01/2027"]);
    t.submit();
    typeIn(/^Quantidade \(/, "20"); typeIn("Vence em", "10/12/2026"); t.submit();
    expect(screen.getByText("Salvar produto")).toBeTruthy(); t.submit();
    const p = saved(t.onSave);
    expect(p.deposito?.qtd).toBe(40); expect(p.areaVenda?.qtd).toBe(20);
    expect(p.validade!.dep["_"]!.map((l) => [l.qtd, l.data])).toEqual([[25, "2026-12-10"], [15, "2027-01-20"]]);
    expect(p.validade!.ven["_"]!.map((l) => l.qtd)).toEqual([20]);
    const total = [...p.validade!.dep["_"]!, ...p.validade!.ven["_"]!].reduce((a, l) => a + l.qtd, 0);
    expect(total).toBe(60);
  });

  it("soma acima ou abaixo bloqueia; validade desconhecida completa a distribuição", () => {
    const t = novoAteValidade("mercado", "Unidade", "Mercearia");
    click("Sim"); t.submit(); click("30 dias"); click("90 dias"); t.submit();
    typeIn(/^Quantidade \(/, "41"); typeIn("Vence em", "10/12/2026");
    expect(screen.getByText(ACIMA)).toBeTruthy();
    t.submit(); expect(screen.getByText(/^Validades no (depósito|estoque)$/)).toBeTruthy();
    typeIn(/^Quantidade \(/, "30"); t.submit();
    expect(screen.getByText(faltaMsg("10"))).toBeTruthy();
    click(/Adicionar outra validade/);
    typeAll(/^Quantidade \(/, ["30", "10"]);
    fireEvent.click(screen.getAllByLabelText("Validade desconhecida")[1]!);
    t.submit(); expect(screen.getByText("Validades na área de venda")).toBeTruthy();
    typeIn(/^Quantidade \(/, "20"); typeIn("Vence em", "10/12/2026"); t.submit(); t.submit();
    const v = saved(t.onSave).validade!;
    expect(v.avisos).toEqual([30, 90]);
    expect(v.dep["_"]!.map((l) => l.data)).toEqual(["2026-12-10", null]);
  });

  it("frações: Kg aceita 7,25 + 5,25 = 12,5", () => {
    const t = novoAteValidade("mercado", "Kg", "Mercearia", "12,5", "0");
    click("Sim"); t.submit(); t.submit();
    click(/Adicionar outra validade/);
    typeAll(/^Quantidade \(/, ["7,25", "5,25"]); typeAll(/^Vence em/, ["10/12/2026", "11/12/2026"]); t.submit();
    expect(screen.getByText(SEM_ESTOQUE)).toBeTruthy(); // contagem zero: nenhuma linha fictícia
    t.submit(); t.submit();
    const v = saved(t.onSave).validade!;
    expect(v.dep["_"]!.map((l) => l.qtd)).toEqual([7.25, 5.25]);
    expect(v.ven).toEqual({});
  });

  it("lote compartilhado entre áreas com datas conflitantes bloqueia", () => {
    const t = novoAteValidade("mercado", "Unidade", "Mercearia");
    click("Sim"); t.submit(); t.submit();
    typeIn(/^Quantidade \(/, "40"); typeIn("Vence em", "10/12/2026"); typeIn(/^Lote/, "A12"); t.submit();
    typeIn(/^Quantidade \(/, "20"); typeIn("Vence em", "11/12/2026"); typeIn(/^Lote/, "a12");
    expect(screen.getAllByText(/O lote .* aparece com vencimentos diferentes/).length).toBeGreaterThan(0);
    t.submit(); expect(t.onSave).not.toHaveBeenCalled(); expect(screen.getByText("Validades na área de venda")).toBeTruthy();
    typeIn("Vence em", "10/12/2026"); t.submit(); t.submit();
    const v = saved(t.onSave).validade!;
    expect(v.dep["_"]![0]!.lote).toBe("A12"); expect(v.ven["_"]![0]!.data).toBe("2026-12-10");
  });

  it("Não leva direto ao resumo e não guarda linhas", () => {
    const t = novoAteValidade("pet", "Unidade", "Ração");
    click("Não"); t.submit();
    expect(screen.getByText("Salvar produto")).toBeTruthy(); t.submit();
    expect(saved(t.onSave).validade).toEqual({ controla: false, avisos: [], dep: {}, ven: {} });
  });
});

describe("Farmácia", () => {
  it("Sim fixo; lote ausente exige confirmação de pendência; data conhecida + lote pendente sem dupla contagem", () => {
    const t = novoAteValidade("farmacia", "Caixa", "Medicamentos", "10", "0");
    expect(screen.queryByRole("button", { name: "Não" })).toBeNull();
    expect(screen.getByText("Na farmácia o controle de validade é obrigatório.")).toBeTruthy();
    t.submit(); t.submit();
    click(/Adicionar outra validade/);
    typeAll(/^Quantidade \(/, ["4", "6"]); typeAll(/^Vence em/, ["05/03/2027", "05/03/2027"]);
    typeAll(/^Lote/, ["F33"]);
    expect(screen.getByText(PEND_CONF)).toBeTruthy();
    t.submit(); expect(t.onSave).not.toHaveBeenCalled();
    click("Registrar como pendente de conferência");
    t.submit(); t.submit(); t.submit();
    const v = saved(t.onSave).validade!;
    expect(v.controla).toBe(true);
    expect(v.dep["_"]![1]).toMatchObject({ qtd: 6, data: "2027-03-05", lote: null, pendConf: true });
    const c = conferencia(v.dep["_"]!, "2026-10-09", true);
    expect(c.fisica).toBe(10); expect(c.lotePend).toBe(6);
  });
  it("produto antigo sem configuração fica explicitamente incompleto", () => {
    expect(validadeLinhas(undefined, true, "Caixa", () => "", "2026-10-09")).toEqual([VAL_FARM_INCOMPLETA]);
    expect(validadeLinhas(undefined, false, "Caixa", () => "", "2026-10-09")).toEqual([VAL_SEM_CONFIG]);
  });
});

describe("edição", () => {
  const base = (extra: Partial<Product>): Product => ({ id: 1, codigo: "789", nome: "Item", compra: 1000, venda: 1500, unidade: "Unidade", categoria: "Mercearia",
    detalhes: {}, variacoes: [], fornecedor: null, deposito: { local: "A", qtd: 10, min: null, max: null }, ...extra });
  const toValidade = (t: { submit: () => void }) => { for (let i = 0; i < 8; i++) t.submit(); expect(screen.getByText("Controle de validade")).toBeTruthy(); };

  it("área sem contagem mostra 'Aguardando contagem' e não cria linhas", () => {
    const t = setup("mercado", base({}));
    toValidade(t); click("Sim"); t.submit(); t.submit();
    typeIn(/^Quantidade \(/, "10"); typeIn("Vence em", "10/12/2026"); t.submit();
    expect(screen.getByText(AGUARDANDO)).toBeTruthy();
    expect(screen.queryByLabelText(/^Quantidade \(/)).toBeNull();
    t.submit(); t.submit();
    expect(saved(t.onSave).validade!.ven).toEqual({});
  });

  it("linhas confirmadas ficam só para consulta e não dá para desligar o controle", () => {
    const val: Validade = { controla: true, avisos: [60], dep: { _: [{ id: "l1", qtd: 10, data: "2026-12-10", lote: "A1" }] }, ven: {} };
    const t = setup("mercado", base({ validade: val, areaVenda: undefined }));
    for (let i = 0; i < 7; i++) t.submit();
    t.submit(); expect(screen.getByText("Controle de validade")).toBeTruthy();
    click("Não"); expect(screen.getByText(DESLIGAR_BLOQ)).toBeTruthy();
    t.submit(); t.submit();
    expect(screen.getByText(/Registro confirmado: somente consulta/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Quantidade \(/)).toBeNull();
    t.submit(); t.submit(); t.submit();
    expect(saved(t.onSave).validade).toEqual(val);
  });

  it("dividir uma pendência preserva a quantidade física e a data já conhecida", () => {
    const val: Validade = { controla: true, avisos: [], dep: { _: [{ id: "p1", qtd: 10, data: "2027-04-12", lote: null, pendConf: true }] }, ven: {} };
    const t = setup("farmacia", { ...base({ validade: val }), unidade: "Caixa", categoria: "Medicamentos" });
    for (let i = 0; i < 8; i++) t.submit();
    t.submit(); t.submit();
    expect(screen.getByText(/^Validades no (depósito|estoque)$/)).toBeTruthy();
    click("Dividir esta pendência");
    typeAll(/^Quantidade \(/, ["4", "6"]); typeAll(/^Lote/, ["F40", "F41"]);
    t.submit(); t.submit(); t.submit();
    const ls = saved(t.onSave).validade!.dep["_"]!;
    expect(ls.map((l) => [l.qtd, l.data, l.lote])).toEqual([[4, "2027-04-12", "F40"], [6, "2027-04-12", "F41"]]);
  });

  it("produto antigo sem validade mantém 'sem configurar' pré-marcado", () => {
    const t = setup("mercado", base({}));
    toValidade(t);
    expect(screen.getByRole("button", { name: /Manter sem configurar/, pressed: true })).toBeTruthy();
    t.submit(); t.submit();
    expect(saved(t.onSave).validade).toBeUndefined();
  });
});

/* ---------- regressão: pendências registradas preservam a própria origem ---------- */
describe("pendências registradas: proteção por origem", () => {
  const farmBase = (validade: Validade, extra: Partial<Product> = {}): Product => ({ id: 1, codigo: "789", nome: "Remédio", compra: 1000, venda: 1500,
    unidade: "Caixa", categoria: "Medicamentos", detalhes: {}, variacoes: [], fornecedor: null,
    deposito: { local: "A", qtd: 20, min: null, max: null }, areaVenda: { local: "G", qtd: 0, min: null, max: null }, validade, ...extra });
  const duas: Validade = { controla: true, avisos: [], ven: {}, dep: { _: [
    { id: "p1", qtd: 10, data: "2027-04-12", lote: null, pendConf: true }, { id: "p2", qtd: 10, data: "2027-05-12", lote: null, pendConf: true },
  ] } };
  const msg1 = /A pendência registrada de 10 caixas \(vence 12\/04\/2027\) agora soma 15 caixas/;
  const irDep = (t: { submit: () => void }) => { for (let i = 0; i < 12; i++) t.submit(); expect(screen.getByText(/^Validades no (depósito|estoque)$/)).toBeTruthy(); };

  it("duas pendências de 10 não podem virar 15 e 5, mesmo com o total da área correto", () => {
    const t = setup("farmacia", farmBase(duas));
    irDep(t);
    typeAll(/^Quantidade \(/, ["15", "5"]);
    t.submit();
    expect(screen.getByText(msg1)).toBeTruthy();
    expect(screen.getByText(/^Validades no (depósito|estoque)$/)).toBeTruthy();
    for (let i = 0; i < 4; i++) t.submit();
    expect(t.onSave).not.toHaveBeenCalled();
    typeAll(/^Quantidade \(/, ["10", "10"]);
    expect(screen.queryByText(msg1)).toBeNull(); // some quando corrigido
    t.submit(); t.submit(); t.submit();
    expect(saved(t.onSave).validade).toEqual(duas); // nada redistribuído
  });

  it("uma pendência de 10 vira 4 e 6 com a data conhecida; a outra e a contagem física não mudam", () => {
    const t = setup("farmacia", farmBase(duas));
    irDep(t);
    fireEvent.click(screen.getAllByRole("button", { name: "Dividir esta pendência" })[0]!); // divide p1
    // ordem dos campos: p1, p2, parte nova de p1
    typeAll(/^Quantidade \(/, ["4", "10", "6"]);
    t.submit(); t.submit(); t.submit();
    const p = saved(t.onSave); const ls = p.validade!.dep["_"]!;
    expect(p.deposito?.qtd).toBe(20);
    expect(ls.map((l) => [l.qtd, l.data, l.origem ?? l.id])).toEqual([[4, "2027-04-12", "p1"], [10, "2027-05-12", "p2"], [6, "2027-04-12", "p1"]]);
  });

  it("parte nova de p1 não pode receber quantidade de p2", () => {
    const t = setup("farmacia", farmBase(duas));
    irDep(t);
    fireEvent.click(screen.getAllByRole("button", { name: "Dividir esta pendência" })[0]!);
    typeAll(/^Quantidade \(/, ["10", "5", "5"]); // total 20, mas p1 = 15 e p2 = 5
    t.submit();
    expect(screen.getByText(msg1)).toBeTruthy();
    expect(t.onSave).not.toHaveBeenCalled();
  });

  it("parte com zero é recusada", () => {
    const t = setup("farmacia", farmBase(duas));
    irDep(t);
    fireEvent.click(screen.getAllByRole("button", { name: "Dividir esta pendência" })[0]!);
    typeAll(/^Quantidade \(/, ["10", "10", "0"]);
    t.submit();
    expect(screen.getByText("A quantidade precisa ser maior que zero.")).toBeTruthy();
    expect(screen.getByText(/^Validades no (depósito|estoque)$/)).toBeTruthy();
  });

  it("editar pelo resumo não contorna a proteção", () => {
    const t = setup("farmacia", farmBase(duas));
    for (let i = 0; i < 14; i++) t.submit();
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    const sec = screen.getByText("Validades por área").closest("div")!.parentElement!;
    fireEvent.click(sec.querySelector("button")!);
    expect(screen.getByText(/^Validades no (depósito|estoque)$/)).toBeTruthy();
    typeAll(/^Quantidade \(/, ["15", "5"]);
    t.submit(); t.submit(); t.submit();
    expect(t.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(msg1)).toBeTruthy();
  });
});

describe("cadastro realmente novo com validade nos seis tipos", () => {
  const casos: [string, string, string][] = [
    ["mercado", "Pacote", "Mercearia"], ["farmacia", "Caixa", "Medicamentos"], ["construcao", "Saco", "Básico"],
    ["pet", "Unidade", "Ração"], ["autopecas", "Kit", "Motor"],
  ];
  it.each(casos)("%s salva validades nas duas áreas", (tipo, u, c) => {
    const t = novoAteValidade(tipo, u, c, "40", "20");
    if (tipo !== "farmacia") click("Sim");
    t.submit(); t.submit();
    typeIn(/^Quantidade \(/, "40"); typeIn("Vence em", "10/12/2026"); typeIn(/^Lote/, "A12"); t.submit();
    typeIn(/^Quantidade \(/, "20"); typeIn("Vence em", "10/12/2026"); typeIn(/^Lote/, "A12"); t.submit();
    expect(screen.getByText("Salvar produto")).toBeTruthy(); t.submit();
    const v = saved(t.onSave).validade!;
    expect(v.dep["_"]![0]).toMatchObject({ qtd: 40, lote: "A12" }); expect(v.ven["_"]![0]).toMatchObject({ qtd: 20, lote: "A12" });
  });

  it("roupas não pergunta validade: vai do passo de venda direto ao resumo e salva sem controle", () => {
    const t = setup("roupas");
    click("Digitar código"); typeIn("Código do produto", "7890001"); typeIn("Nome do produto", "Camiseta"); t.submit();
    typeIn("Preço de compra", "1000"); typeIn("Preço de venda", "1500"); click("Peça"); typeIn("Categoria", "Camisetas"); t.submit();
    click(/Adicionar variação/); click("M"); typeIn("Cor", "Azul"); typeIn("Código de barras", "5550001"); typeIn(/^Quantidade$/, "2"); click("Adicionar");
    t.submit(); click("Definir depois"); t.submit();
    click(/^Novo local$/); typeIn("Nome do local", "Estante A"); click("Usar este local"); t.submit();
    click(/^Não, vou contar o (depósito|estoque)$/); typeIn(/Quantidade confirmada no (depósito|estoque)/, "5"); t.submit(); t.submit();
    click(/Novo local de venda/); typeIn("Nome do local de venda", "Arara"); click("Usar este local de venda"); t.submit();
    typeIn(/Quanto desta variação já está neste local/, "0"); t.submit(); t.submit();
    expect(screen.queryByText("Controle de validade")).toBeNull();
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    expect(screen.getByText(/Passo 7 de 7/)).toBeTruthy();
    t.submit();
    expect(saved(t.onSave).validade).toMatchObject({ controla: false });
  });
});

describe("variações e lotes não se misturam", () => {
  const vA = { tam: "M", cor: "Azul", codigo: "1", qtd: 1, uid: "uA" }, vB = { tam: "G", cor: "Preto", codigo: "2", qtd: 1, uid: "uB" };
  const val: Validade = { controla: true, avisos: [], ven: {}, dep: {
    uA: [{ id: "a1", qtd: 3, data: "2026-12-10", lote: "L1" }], uB: [{ id: "b1", qtd: 4, data: "2027-02-01", lote: "L1" }] } };
  const roupa = (variacoes: typeof vA[]): Product => ({ id: 9, codigo: "9", nome: "Camiseta", compra: 1000, venda: 1500, unidade: "Peça", categoria: "Camisetas",
    detalhes: {}, variacoes, fornecedor: null, validade: val,
    deposito: { local: "A", qtd: null, min: null, max: null, vars: { uA: { qtd: 3, min: null, max: null }, uB: { qtd: 4, min: null, max: null } } } });

  it("mudar a ordem das variações mantém as validades no uid certo; mesmo lote em variações diferentes não é conflito", () => {
    const t = setup("roupas", roupa([vB, vA]));
    for (let i = 0; i < 13; i++) t.submit();
    expect(t.onSave).toHaveBeenCalledTimes(1);
    const v = saved(t.onSave).validade!;
    expect(v.dep["uA"]![0]!.data).toBe("2026-12-10");
    expect(v.dep["uB"]![0]!.data).toBe("2027-02-01");
  });

  it("mesmo número de lote em outro produto não mistura os registros", () => {
    const outro: Product = { ...roupa([{ ...vA, codigo: "77" }]), id: 10, codigo: "10", validade: { ...val, dep: { uA: [{ id: "z", qtd: 3, data: "2030-01-01", lote: "L1" }] } } };
    const onSave = vi.fn();
    render(<ProductWizard store={{ id: "s", nome: "Loja", tipo: "roupas" } as never} products={[roupa([vA, vB]), outro]} initial={roupa([vA, vB])}
      suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
    for (let i = 0; i < 13; i++) fireEvent.submit(document.querySelector("form")!);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(saved(onSave).validade).toEqual(val);
  });
});

describe("resumo e detalhe: não contada, zero e configuração pendente", () => {
  const v: Validade = { controla: true, avisos: [], dep: {}, ven: {} };
  it("distingue as três situações e marca a conferência como incompleta", () => {
    const cont = (a: "dep" | "ven", k: string) => (a === "dep" ? (k === "uA" ? null : 0) : 7);
    const out = validadeLinhas(v, false, "Peça", (k) => k, "2026-10-09", ["uA", "uB"], cont);
    expect(out).toContain("Depósito · uA: Aguardando contagem");
    expect(out).toContain("Depósito · uB: Sem estoque nesta área");
    expect(out.some((l) => l.startsWith("Área de venda · uA: Há quantidade contada, mas a validade"))).toBe(true);
    expect(out.some((l) => l.startsWith("Conferência incompleta"))).toBe(true);
    expect(out.some((l) => l.startsWith("Física contada"))).toBe(false);
  });
  it("tudo contado e distribuído mostra a física completa", () => {
    const ok: Validade = { ...v, dep: { _: [{ id: "x", qtd: 5, data: "2026-12-10", lote: null }] } };
    const out = validadeLinhas(ok, false, "Un", (k) => k, "2026-10-09", ["_"], (a) => (a === "dep" ? 5 : 0));
    expect(out.some((l) => l.startsWith("Física contada 5"))).toBe(true);
  });
  it("detalhe do produto usa as contagens reais", () => {
    const p: Product = { id: 1, codigo: "1", nome: "X", compra: 1, venda: 2, unidade: "Un", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: null,
      deposito: { local: "A", qtd: 5, min: null, max: null }, validade: v };
    render(<ValidadeInfo p={p} tipo="mercado" />);
    expect(screen.getByText(/Depósito: Há quantidade contada/)).toBeTruthy();
    expect(screen.getByText("Área de venda: Aguardando contagem")).toBeTruthy();
    expect(screen.getByText(/^Conferência incompleta/)).toBeTruthy();
  });
});
