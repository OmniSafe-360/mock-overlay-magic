import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PainelVendas, type ApiVendas } from "@/components/PainelVendas";
import type { Product } from "@/components/ProductArea";
import {
  codigoCaixaTexto, formaPagamento, proximoNomeCaixa, resumoVendas, situacaoCaixa, textoCaixa, textoItemVenda, type Caixa, type ItemVenda, type Venda,
} from "@/lib/vendas";

const AGORA = Date.parse("2026-10-10T15:00:00-03:00");
const min = (m: number) => new Date(AGORA - m * 60_000).toISOString();
const caixa = (x: Partial<Caixa> = {}): Caixa => ({
  id: "cx1", nome: "Caixa 1", codigo: null, codigoGeradoEm: min(600), ligadoEm: min(500), desligadoEm: null, ultimoContatoEm: min(2), ultimaVendaEm: min(5), aparelho: "Windows", ...x,
});
const item = (x: Partial<ItemVenda> = {}): ItemVenda => ({
  id: "i1", n: 1, codigoPdv: "101", codigoBarras: "7893464100065", descricao: "ARROZ 5KG", qtdNota: 3, unidadeNota: "UN", valor: 3000,
  produtoId: "p-arroz", qtdUnidades: 3, qtdBaixada: 3, qtdFaltou: 0, situacao: "baixado", motivo: null, ...x,
});
const venda = (x: Partial<Venda> = {}): Venda => ({
  id: "v1", caixaId: "cx1", chave: "1".repeat(44), numero: 123, emitidaEm: min(5), recebidaEm: min(5), total: 4590, situacao: "finalizada", canceladaEm: null,
  pagamentos: [{ forma: "17", valor: 4590 }], itens: [item()], ...x,
});

describe("regras das vendas", () => {
  it("situação do caixa pela hora do último contato e do código", () => {
    expect(situacaoCaixa(caixa(), AGORA)).toBe("ligado");
    expect(situacaoCaixa(caixa({ ultimoContatoEm: min(40) }), AGORA)).toBe("parado");
    expect(situacaoCaixa(caixa({ ligadoEm: null, codigo: "12345678", codigoGeradoEm: min(30) }), AGORA)).toBe("aguardando");
    expect(situacaoCaixa(caixa({ ligadoEm: null, codigo: "12345678", codigoGeradoEm: min(25 * 60) }), AGORA)).toBe("codigo_vencido");
    expect(situacaoCaixa(caixa({ desligadoEm: min(1) }), AGORA)).toBe("desligado");
    expect(textoCaixa(caixa(), AGORA)).toEqual({ nivel: "ok", titulo: "Ligado", detalhe: "Última venda há 5 min" });
    expect(textoCaixa(caixa({ ligadoEm: null, codigo: "12345678", codigoGeradoEm: min(30) }), AGORA).detalhe).toBe("Código 1234 5678");
  });
  it("textos", () => {
    expect(codigoCaixaTexto("12345678")).toBe("1234 5678");
    expect(proximoNomeCaixa([{ nome: "Caixa 1" }, { nome: "caixa 3" }])).toBe("Caixa 2");
    expect(formaPagamento("17")).toBe("Pix");
    expect(formaPagamento("3")).toBe("Cartão de crédito");
    expect(textoItemVenda(item(), "Unidade").texto).toBe("Saiu da gôndola: 3 unidades");
    expect(textoItemVenda(item({ qtdBaixada: 7, qtdFaltou: 13 }), "Unidade", "área de venda").texto).toBe("Saiu da área de venda: 7 unidades. Faltou 13 unidades (o sistema não tinha)");
    expect(textoItemVenda(item({ situacao: "sem_cadastro", produtoId: null }))).toEqual({ nivel: "urgente", texto: "Vendido sem cadastro: diga qual produto é" });
  });
  it("resumo do dia: canceladas fora do total, por caixa, pendentes e faltas", () => {
    const vs = [
      venda(),
      venda({ id: "v2", caixaId: "cx2", total: 1000, itens: [item({ situacao: "sem_cadastro" }), item({ id: "i3", qtdFaltou: 2 })] }),
      venda({ id: "v3", situacao: "cancelada", total: 999 }),
      venda({ id: "v4", emitidaEm: new Date(AGORA - 86_400_000).toISOString() }),
    ];
    const r = resumoVendas(vs, "2026-10-10");
    expect(r).toMatchObject({ n: 2, total: 5590, canceladas: 1, pendentes: 1, faltou: 1 });
    expect(r.porCaixa.map((c) => c.caixaId)).toEqual(["cx1", "cx2"]);
  });
});

const produtos = [{ id: "p-arroz", db: { id: "p-arroz", contadas: [] }, nome: "Arroz Tio João 5 kg", unidade: "Unidade" }] as unknown as Product[];
function api(over: Partial<ApiVendas> = {}) {
  return {
    caixas: vi.fn(async () => [caixa()]),
    vendas: vi.fn(async () => [venda()]),
    criar: vi.fn(async () => ({ id: "cx2", codigo: "87654321" })),
    renomear: vi.fn(async () => {}),
    novoCodigo: vi.fn(async () => "11112222"),
    desligar: vi.fn(async () => {}),
    ...over,
  } satisfies ApiVendas;
}

describe("aba Vendas", () => {
  // Só o relógio é fixo (10/10/2026 15:00 em São Paulo); os temporizadores continuam normais.
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(AGORA); });
  afterEach(() => { vi.useRealTimers(); });
  it("sem caixas: explica e liga o primeiro com código e passo a passo", async () => {
    const a = api({ caixas: vi.fn(async () => []), vendas: vi.fn(async () => []) });
    render(<PainelVendas comercioId="c1" tipo="mercado" products={[]} api={a} />);
    expect(await screen.findByText("Ligue os caixas do comércio")).toBeTruthy();
    expect(screen.getByText("Nenhuma venda")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Ligar um caixa/ }));
    const dlg = within(screen.getByRole("dialog", { name: "Ligar um caixa" }));
    expect((dlg.getByRole("textbox") as HTMLInputElement).value).toBe("Caixa 1");
    vi.mocked(a.caixas).mockResolvedValue([caixa({ id: "cx2", ligadoEm: null, codigo: "87654321", codigoGeradoEm: min(0), ultimoContatoEm: null, ultimaVendaEm: null })]);
    fireEvent.click(dlg.getByRole("button", { name: "Gerar o código" }));
    await waitFor(() => expect(a.criar).toHaveBeenCalledWith("c1", "Caixa 1"));
    const det = within(await screen.findByRole("dialog", { name: "Caixa 1" }));
    expect(det.getByLabelText("Código 8765 4321")).toBeTruthy();
    expect(det.getByText(/\/conector$/)).toBeTruthy();
    expect(det.getByText("Aguardando ligar")).toBeTruthy();
  });
  it("caixa ligado com a venda do dia; tocar na venda mostra os itens e o que saiu da gôndola", async () => {
    render(<PainelVendas comercioId="c1" tipo="mercado" products={produtos} api={api()} />);
    const cx = await screen.findByRole("button", { name: "Caixa 1: Ligado" });
    expect(cx.textContent).toMatch(/R\$\s?45,90/);
    fireEvent.click(screen.getByRole("button", { name: /Nota 123/ }));
    const dlg = within(screen.getByRole("dialog"));
    expect(dlg.getByText("Arroz Tio João 5 kg")).toBeTruthy();
    expect(dlg.getByText("No caixa: ARROZ 5KG")).toBeTruthy();
    expect(dlg.getByText("Saiu da gôndola: 3 unidades")).toBeTruthy();
    expect(dlg.getByText(/Pix/)).toBeTruthy();
  });
  it("farmácia fala área de venda; avisa sem cadastro e falta", async () => {
    const a = api({ vendas: vi.fn(async () => [venda({ itens: [item({ situacao: "sem_cadastro", produtoId: null }), item({ id: "i2", qtdBaixada: 1, qtdFaltou: 2 })] })]) });
    render(<PainelVendas comercioId="c1" tipo="farmacia" products={produtos} api={a} />);
    expect(await screen.findByText(/1 item vendido sem cadastro no Omni/)).toBeTruthy();
    expect(screen.getByText(/além do que o sistema tinha na área de venda/)).toBeTruthy();
  });
  it("caixa parado avisa; desligar pede confirmação", async () => {
    const a = api({ caixas: vi.fn(async () => [caixa({ ultimoContatoEm: min(180) })]) });
    render(<PainelVendas comercioId="c1" tipo="mercado" products={[]} api={a} />);
    fireEvent.click(await screen.findByRole("button", { name: "Caixa 1: Sem contato" }));
    const dlg = within(screen.getByRole("dialog", { name: "Caixa 1" }));
    expect(dlg.getByText(/Venda que não chega vira "furto falso"/)).toBeTruthy();
    fireEvent.click(dlg.getByRole("button", { name: /Desligar este caixa/ }));
    expect(a.desligar).not.toHaveBeenCalled();
    fireEvent.click(dlg.getByRole("button", { name: "Sim, desligar" }));
    await waitFor(() => expect(a.desligar).toHaveBeenCalledWith("cx1"));
  });
  it("erro ao carregar deixa tentar de novo", async () => {
    const a = api({ caixas: vi.fn(async () => { throw new Error("Failed to fetch"); }) });
    render(<PainelVendas comercioId="c1" tipo="mercado" products={[]} api={a} />);
    expect(await screen.findByText(/Não foi possível carregar as vendas/)).toBeTruthy();
    vi.mocked(a.caixas).mockResolvedValue([caixa()]);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("button", { name: "Caixa 1: Ligado" })).toBeTruthy();
  });
});
