import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PainelDiferencas } from "@/components/PainelDiferencas";
import { RelatorioAntifurto, type ApiRelatorio } from "@/components/RelatorioAntifurto";
import type { Product } from "@/components/ProductArea";
import { contagemAnterior, intervaloFalta, limitesPeriodo, relatorioAntifurto, type Contagem } from "@/lib/antifurto";
import type { Diferenca, Perda } from "@/lib/diferencas";

const AGORA = new Date("2026-10-10T15:00:00-03:00");
const prod = (id: string, nome: string, dep: string, ven: string, compra = 1000): Product => ({
  id, db: { id, contadas: [] }, nome, codigo: `789${id}`, unidade: "Unidade", categoria: "Mercearia", compra, venda: 1500,
  fornecedor: null, detalhes: {}, variacoes: [], deposito: { local: dep, qtd: 10, min: 1, max: 20 }, areaVenda: { local: ven, qtd: 5, min: 1, max: 10 },
});
const products = [prod("arroz", "Arroz", "Estante A", "Gôndola 3"), prod("cafe", "Café", "Estante A", "Gôndola 3", 2000), prod("sab", "Sabonete", "Estante B", "Gôndola 7", 300)];
let n = 0;
const dif = (x: Partial<Diferenca> = {}): Diferenca => ({
  id: `d${++n}`, produtoId: "arroz", variacaoId: null, area: "venda", origem: "reposicao", esperado: 10, contado: 8, diferenca: -2, valor: -2000,
  funcionario: "Maria", situacao: "explicada", motivo: "sumiu", observacao: null, tentativas: [], resolvida: false, motivoInformado: null,
  criadaEm: "2026-10-07T15:00:00-03:00", ...x,
});
const perda = (x: Partial<Perda> = {}): Perda => ({
  id: `p${++n}`, produtoId: "sab", variacaoId: null, area: "venda", quantidade: 4, baixado: 4, motivo: "quebrou", observacao: null,
  funcionario: "João", peloDono: false, situacao: "confirmada", criadaEm: "2026-10-05T10:00:00-03:00", ...x,
});
const difs = [
  dif(), dif({ criadaEm: "2026-10-08T15:00:00-03:00" }), dif({ criadaEm: "2026-10-09T15:00:00-03:00", situacao: "aberta", motivo: null }),
  dif({ produtoId: "cafe", diferenca: -1, valor: -2000, motivo: "quebra", criadaEm: "2026-10-06T09:00:00-03:00" }),
  dif({ produtoId: "sab", area: "deposito", origem: "conferencia", diferenca: -5, valor: -1500, criadaEm: "2026-10-02T09:00:00-03:00", funcionario: "João" }),
  dif({ produtoId: "cafe", motivo: "erro_contagem", valor: -4000 }),
  dif({ produtoId: "cafe", origem: "conferencia_inconsistente", situacao: "aberta", motivo: null, area: "deposito" }),
  dif({ criadaEm: "2026-09-20T15:00:00-03:00" }),
];
const perdas = [perda(), perda({ situacao: "recusada" }), perda({ peloDono: true, funcionario: null, motivo: "consumo", baixado: 1 })];
const contagens: Contagem[] = [
  { produtoId: "arroz", variacaoId: null, area: "venda", em: "2026-10-06T10:00:00-03:00" },
  { produtoId: "arroz", variacaoId: null, area: "venda", em: "2026-10-07T15:00:00-03:00" },
  { produtoId: "arroz", variacaoId: null, area: "deposito", em: "2026-10-07T08:00:00-03:00" },
];
const info = {
  nome: (id: string) => products.find((p) => p.id === id)!.nome,
  local: (id: string, a: "deposito" | "venda") => { const p = products.find((x) => x.id === id)!; return (a === "deposito" ? p.deposito?.local : p.areaVenda?.local) ?? null; },
  compra: (id: string) => products.find((p) => p.id === id)!.compra,
};
const nomeArea = (a: "deposito" | "venda") => (a === "deposito" ? "Depósito" : "Gôndola");

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(AGORA); });
afterEach(() => vi.useRealTimers());

describe("regras do antifurto", () => {
  it("períodos", () => {
    expect(limitesPeriodo("mes", "2026-10-10")).toEqual({ de: "2026-10-01", ate: "2026-11-01" });
    expect(limitesPeriodo("mesPassado", "2026-01-15")).toEqual({ de: "2025-12-01", ate: "2026-01-01" });
    expect(limitesPeriodo("tres", "2026-02-15")).toEqual({ de: "2025-12-01", ate: "2026-03-01" });
  });
  it("contagem anterior: mesmo produto e lugar, mais de 1 minuto antes", () => {
    expect(contagemAnterior(dif(), contagens)).toBe(new Date("2026-10-06T10:00:00-03:00").toISOString());
    expect(contagemAnterior(dif({ criadaEm: "2026-10-08T15:00:00-03:00" }), contagens)).toBe(new Date("2026-10-07T15:00:00-03:00").toISOString());
    expect(contagemAnterior(dif({ produtoId: "cafe" }), contagens)).toBeNull();
  });
  it("relatório do mês: faltas, motivos, produtos, lugares, dias e pessoas", () => {
    const r = relatorioAntifurto(difs, perdas, contagens, "mes", "2026-10-10", info, nomeArea);
    expect(r.faltas).toHaveLength(5);
    expect(r.faltouTotal).toBe(2000 * 3 + 2000 + 1500);
    expect(r.erros).toEqual({ vezes: 1, valor: 4000 });
    expect(r.porMotivo).toEqual([
      { motivo: "sumiu", vezes: 3, valor: 5500 }, { motivo: "aberta", vezes: 1, valor: 2000 }, { motivo: "quebra", vezes: 1, valor: 2000 },
    ].sort((a, b) => b.valor - a.valor));
    expect(r.produtos.map((p) => [p.titulo, p.vezes, p.qtd, p.valor])).toEqual([["Arroz", 3, 6, 6000], ["Café", 1, 1, 2000], ["Sabonete", 1, 5, 1500]]);
    expect(r.lugares.map((l) => [l.titulo, l.sub, l.vezes, l.produtos])).toEqual([["Gôndola 3", "Gôndola", 4, 2], ["Estante B", "Depósito", 1, 1]]);
    expect(r.perdas).toMatchObject({ total: 1200 + 300, vezes: 2 });
    expect(r.diasSemana[3]).toEqual({ dia: 3, vezes: 1, valor: 2000 }); // quarta 07/10
    expect(r.pessoas).toEqual([
      { nome: "Maria", contagensComFalta: 4, valorFaltas: 8000, perdas: 0, valorPerdas: 0 },
      { nome: "João", contagensComFalta: 1, valorFaltas: 1500, perdas: 1, valorPerdas: 1200 },
    ]);
    expect(relatorioAntifurto(difs, perdas, contagens, "mesPassado", "2026-10-10", info, nomeArea).faltas).toHaveLength(1);
  });
  it("texto do intervalo", () => {
    const r = relatorioAntifurto(difs, perdas, contagens, "mes", "2026-10-10", info, nomeArea);
    const f = r.faltas.find((x) => x.criadaEm.startsWith("2026-10-07"))!;
    expect(intervaloFalta(f)).toBe("Entre a contagem de terça 06/10, 10:00 e a de quarta 07/10, 15:00");
    expect(intervaloFalta(r.faltas.find((x) => x.produtoId === "cafe")!)).toMatch(/^Descoberta na contagem de terça 06\/10, 09:00/);
  });
});

describe("tela do relatório", () => {
  const api = (): ApiRelatorio => ({ carregar: vi.fn(async () => ({ diferencas: difs, perdas })), contagens: vi.fn(async () => contagens) });
  it("mostra total, produtos (abre o intervalo), lugares e equipe; troca o período", async () => {
    render(<RelatorioAntifurto comercioId="c1" tipo="mercado" products={products} api={api()} />);
    expect(await screen.findByText(/R\$\s95,00/)).toBeTruthy();
    expect(screen.getByText("5 faltas")).toBeTruthy();
    const prods = within(screen.getByRole("region", { name: "Produtos que mais somem" }));
    const arroz = prods.getByRole("button", { name: /Arroz/ });
    expect(arroz.textContent).toMatch(/3 vezes · 6 unidades/);
    fireEvent.click(arroz);
    expect(prods.getByText(/Entre a contagem de terça 06\/10, 10:00 e a de quarta 07\/10, 15:00 · contou: Maria/)).toBeTruthy();
    expect(prods.getAllByText(/sem explicação/)).toHaveLength(1);
    expect(within(screen.getByRole("region", { name: "Lugares com mais faltas" })).getByText(/Gôndola · 4 faltas · 2 produtos/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Equipe" })).getByText(/Registrou 1 perda/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mês passado" }));
    expect(screen.getByText("1 falta")).toBeTruthy();
  });
  it("aba Diferenças tem Para resolver e Relatório", async () => {
    const apiD = { carregar: vi.fn(async () => ({ diferencas: [], perdas: [] })), decidirPerda: vi.fn(), explicar: vi.fn(), resolver: vi.fn(), registrarPerda: vi.fn() };
    render(<PainelDiferencas comercioId="c1" tipo="farmacia" products={products} api={apiD} apiRelatorio={api()} />);
    expect(await screen.findByText(/Tudo certo! Nenhuma perda/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Relatório" }));
    expect(await screen.findByText("Faltou no estoque")).toBeTruthy();
    expect(screen.getByText(/O estoque é conferido todo dia/)).toBeTruthy();
  });
});
