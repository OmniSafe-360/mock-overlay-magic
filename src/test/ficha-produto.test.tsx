import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Product } from "@/components/ProductArea";
import { FichaProduto } from "@/components/FichaProduto";
import { situacaoProduto, quandoVence } from "@/lib/situacao";
import { vencidoAVendaMsg } from "@/lib/validade";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const HOJE = "2026-10-09";
const prod = (extra: Partial<Product> = {}): Product => ({
  id: 1, codigo: "7891234567895", nome: "Arroz Camil 5 kg", compra: 2000, venda: 2790, unidade: "Pacote", categoria: "Mercearia",
  detalhes: { marca: "Camil" }, variacoes: [], fornecedor: 1,
  deposito: { local: "Estante A", qtd: 40, min: 10, max: 60 }, areaVenda: { local: "Gôndola 3", qtd: 12, min: 5, max: 20 }, ...extra,
});
const titulos = (p: Product, tipo = "mercado", f?: string) => situacaoProduto(p, tipo, HOJE, { fornecedor: f }).alertas.map((a) => `${a.nivel}: ${a.titulo}`);

describe("situação do produto", () => {
  it("tudo configurado e acima do mínimo: tudo certo", () => {
    const s = situacaoProduto(prod({ validade: { controla: false, avisos: [], dep: {}, ven: {} } }), "mercado", HOJE);
    expect(s.nivel).toBe("ok");
    expect(s.qtd).toMatchObject({ dep: 40, ven: 12, total: 52, depMin: 10, venMin: 5 });
  });
  it("gôndola no mínimo pede reposição e diz quanto há no depósito", () => {
    const s = situacaoProduto(prod({ areaVenda: { local: "Gôndola 3", qtd: 5, min: 5, max: 20 } }), "mercado", HOJE);
    expect(s.nivel).toBe("atencao");
    expect(s.alertas[0]).toMatchObject({ titulo: "Repor a gôndola", detalhe: "Tem 5 pacotes; o mínimo é 5 pacotes. Há 40 pacotes no depósito para repor." });
  });
  it("depósito no mínimo: hora de comprar, com o fornecedor", () => {
    expect(situacaoProduto(prod({ deposito: { local: "A", qtd: 8, min: 10, max: null } }), "mercado", HOJE, { fornecedor: "Distribuidora Sol" }).alertas[0])
      .toMatchObject({ titulo: "Hora de comprar", detalhe: "O depósito tem 8 pacotes; o mínimo é 10 pacotes. Fornecedor: Distribuidora Sol." });
  });
  it("zerado nas duas áreas é urgente", () => {
    const s = situacaoProduto(prod({ deposito: { local: "A", qtd: 0, min: 10, max: null }, areaVenda: { local: "G", qtd: 0, min: 5, max: null } }), "mercado", HOJE);
    expect(s.nivel).toBe("urgente");
    expect(s.alertas.filter((a) => a.nivel !== "info").map((a) => a.titulo)).toEqual(["Acabou"]);
    expect(s.alertas[0]!.detalhe).toBe("Acabou no depósito e na gôndola. Hora de comprar.");
  });
  it("farmácia usa 'Estoque' e acusa vencido à venda", () => {
    const p = prod({ unidade: "Frasco", validade: { controla: true, avisos: [30], dep: { _: [{ id: "a", qtd: 40, data: "2026-10-30", lote: "L1" }] },
      ven: { _: [{ id: "b", qtd: 12, data: "2026-10-05", lote: "L2" }] } } });
    const s = situacaoProduto(p, "farmacia", HOJE);
    expect(s.nomes).toEqual({ dep: "Estoque", ven: "Área de venda" });
    expect(s.nivel).toBe("urgente");
    expect(titulos(p, "farmacia")).toEqual(expect.arrayContaining(["urgente: Vencido à venda: 12 frascos", "atencao: Vence em 21 dias: 40 frascos"]));
    expect(s.lotes.map((l) => l.data)).toEqual(["2026-10-05", "2026-10-30"]);
  });
  it("contado sem validade distribuída avisa", () => {
    expect(titulos(prod({ validade: { controla: true, avisos: [], dep: { _: [{ id: "a", qtd: 30, data: "2027-05-01", lote: null }] }, ven: {} } })))
      .toContain("atencao: Validade não informada: 22 pacotes");
  });
  it("prejuízo e PMC são urgentes; tarja vermelha na gôndola também", () => {
    expect(titulos(prod({ venda: 1500 }))).toContain("urgente: Vendendo com prejuízo");
    const f = prod({ detalhes: { tarja: "Tarja vermelha", pmc: "R$ 25,00" }, venda: 2790, areaVenda: { local: "Gôndola 1", qtd: 12, min: null, max: null } });
    expect(titulos(f, "farmacia")).toEqual(expect.arrayContaining(["urgente: Preço acima do máximo (PMC)", "urgente: Remédio no lugar errado"]));
  });
  it("cadastro incompleto aparece como 'falta completar'", () => {
    const s = situacaoProduto(prod({ deposito: undefined, areaVenda: { local: null, qtd: 3, min: null, max: null }, fornecedor: null }), "mercado", HOJE);
    expect(s.nivel).toBe("info");
    expect(s.alertas.map((a) => a.titulo)).toEqual(["Depósito não configurado", "Local na gôndola não definido", "Validade não configurada", "Fornecedor não definido"]);
  });
  it("roupas soma as variações e avisa por variação", () => {
    const p = prod({ unidade: "Peça", variacoes: [{ tam: "M", cor: "Azul", qtd: 1, uid: "a" }, { tam: "G", cor: "Preto", qtd: 1, uid: "b" }],
      deposito: { local: "Estoque", qtd: null, min: null, max: null, vars: { a: { qtd: 4, min: 5, max: null }, b: { qtd: 6, min: null, max: null } } },
      areaVenda: { local: "Arara", qtd: null, min: null, max: null, vars: { a: { qtd: 2, min: null, max: null }, b: { qtd: 1, min: null, max: null } } } });
    const s = situacaoProduto(p, "roupas", HOJE);
    expect(s.qtd).toMatchObject({ dep: 10, ven: 3, total: 13 });
    expect(s.variacoes.map((v) => [v.nome, v.total])).toEqual([["M · Azul", 6], ["G · Preto", 7]]);
    expect(s.alertas.map((a) => a.titulo)).toContain("M · Azul: hora de comprar");
    expect(s.alertas.some((a) => a.titulo.startsWith("Validade"))).toBe(false); // roupa não tem validade
  });
  it("frases de vencimento", () => {
    expect([quandoVence(0), quandoVence(1), quandoVence(21), quandoVence(-1), quandoVence(-4)]).toEqual(["vence hoje", "vence amanhã", "vence em 21 dias", "venceu ontem", "venceu há 4 dias"]);
  });
});

describe("ficha do produto na tela", () => {
  const abrir = (p: Product, tipo = "mercado") => {
    const onEdit = vi.fn(), onBack = vi.fn();
    render(<FichaProduto p={p} tipo={tipo} fornecedor={{ id: 1, nome: "Distribuidora Sol", tel: "(11) 98888-7777", email: "" }} onBack={onBack} onEdit={onEdit} />);
    return { onEdit, onBack };
  };
  it("mostra as três quantidades grandes e o total", () => {
    abrir(prod({ validade: { controla: false, avisos: [], dep: {}, ven: {} } }));
    const q = within(screen.getByRole("region", { name: "Quanto tem" }));
    expect(q.getByText("40")).toBeTruthy(); expect(q.getByText("12")).toBeTruthy(); expect(q.getByText("52")).toBeTruthy();
    expect(q.getByText("Depósito")).toBeTruthy(); expect(q.getByText("Gôndola")).toBeTruthy();
    expect(screen.getByText("Tudo certo com este produto")).toBeTruthy();
  });
  it("onde fica, preço e fornecedor com telefone", () => {
    abrir(prod());
    expect(screen.getByText("Estante A")).toBeTruthy();
    expect(screen.getByText("mínimo 10 pacotes · máximo 60 pacotes")).toBeTruthy();
    expect(screen.getByText("mínimo 5 pacotes · cabe até 20 pacotes")).toBeTruthy();
    expect(screen.getByText(/ganho de 39,5% sobre a compra/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /98888-7777/ }).getAttribute("href")).toBe("tel:11988887777");
  });
  it("farmácia: estoque, validades em ordem e alerta de vencido à venda", () => {
    abrir(prod({ unidade: "Frasco", detalhes: { tarja: "Sem tarja (venda livre)" }, validade: { controla: true, avisos: [30, 60, 90],
      dep: { _: [{ id: "a", qtd: 40, data: "2099-10-30", lote: "L1" }] }, ven: { _: [{ id: "b", qtd: 12, data: "2020-10-05", lote: "L2" }] } } }), "farmacia");
    expect(within(screen.getByRole("region", { name: "Quanto tem" })).getByText("Estoque")).toBeTruthy();
    expect(screen.getByText(vencidoAVendaMsg(true))).toBeTruthy();
    const lotes = within(screen.getByRole("region", { name: "Validade" })).getAllByRole("listitem");
    expect(lotes[0]!.textContent).toContain("05/10/2020");
    expect(lotes[0]!.textContent).toContain("Lote L2");
    expect(screen.getByText(/Avisar 30, 60, 90 dias antes/)).toBeTruthy();
  });
  it("não contado mostra traço e explica", () => {
    abrir(prod({ deposito: undefined, areaVenda: undefined }));
    expect(screen.getAllByText("—").length).toBe(3);
    expect(screen.getByText(/Ainda não foi contado/)).toBeTruthy();
  });
  it("botões Editar e Voltar", () => {
    const t = abrir(prod());
    fireEvent.click(screen.getByRole("button", { name: /Editar/ })); expect(t.onEdit).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Produtos/ })); expect(t.onBack).toHaveBeenCalled();
  });
});
