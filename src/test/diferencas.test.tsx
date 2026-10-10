import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PainelDiferencas, type ApiDiferencas } from "@/components/PainelDiferencas";
import type { Product } from "@/components/ProductArea";
import { resumoDiferencas, textoDiferenca, valorSinal, type Diferenca, type Perda } from "@/lib/diferencas";

const AGORA = new Date("2026-10-10T15:00:00-03:00");
const prod = (id: string, nome: string, compra = 1290): Product => ({
  id, db: { id, contadas: [] }, nome, codigo: `789${id}`, unidade: "Unidade", categoria: "Mercearia", compra, venda: 1990,
  fornecedor: null, detalhes: {}, variacoes: [],
});
const products = [prod("arroz", "Arroz 5 kg"), prod("cerv", "Cerveja lata", 300), prod("tiss", "Tiss")];
const dif = (x: Partial<Diferenca> = {}): Diferenca => ({
  id: "d1", produtoId: "arroz", variacaoId: null, area: "deposito", origem: "conferencia", esperado: 100, contado: 98, diferenca: -2, valor: -2580,
  funcionario: "Maria", situacao: "aberta", motivo: null, observacao: null, tentativas: [98, 97, 98], resolvida: false, motivoInformado: null,
  criadaEm: "2026-10-10T14:00:00-03:00", ...x,
});
const perda = (x: Partial<Perda> = {}): Perda => ({
  id: "pe1", produtoId: "arroz", variacaoId: null, area: "venda", quantidade: 3, baixado: 3, motivo: "quebrou", observacao: "caiu da prateleira",
  funcionario: "João", peloDono: false, situacao: "aguardando", criadaEm: "2026-10-10T13:00:00-03:00", ...x,
});
const inconsistente = dif({ id: "d2", produtoId: "cerv", origem: "conferencia_inconsistente", esperado: 100, contado: 92, diferenca: -8, valor: -2400, tentativas: [90, 91, 92] });

function api(over: Partial<ApiDiferencas> = {}, dados = { diferencas: [dif(), inconsistente], perdas: [perda()] }) {
  return {
    carregar: vi.fn(async () => dados),
    decidirPerda: vi.fn(async () => {}),
    explicar: vi.fn(async () => {}),
    resolver: vi.fn(async (_id: string, c: number) => ({ diferenca: c - 100 })),
    registrarPerda: vi.fn(async () => {}),
    ...over,
  } satisfies ApiDiferencas;
}

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(AGORA); });
afterEach(() => vi.useRealTimers());

describe("regras das diferenças", () => {
  it("textos e valores", () => {
    expect(textoDiferenca(dif(), "Unidade", "mercado")).toBe("Faltaram 2 unidades no depósito");
    expect(textoDiferenca(dif({ area: "venda", diferenca: 1 }), "Unidade", "farmacia")).toBe("Sobrou 1 unidade na área de venda");
    expect(textoDiferenca(inconsistente, "Unidade", "farmacia")).toBe("As contagens não bateram no estoque");
    expect(valorSinal(-2580)).toMatch(/^−R\$\s25,80$/);
  });
  it("resumo do mês: faltou sem erro de contagem nem contagem a escolher; perdas pelo preço de compra", () => {
    const r = resumoDiferencas(
      [dif(), dif({ id: "x", valor: -1000, motivo: "erro_contagem", situacao: "explicada" }), inconsistente, dif({ id: "y", criadaEm: "2026-09-30T12:00:00-03:00" })],
      [perda(), perda({ id: "p2", situacao: "recusada" }), perda({ id: "p3", situacao: "confirmada", baixado: 2 })], "2026-10-10", () => 1290);
    expect(r).toEqual({ perdas: 1, diferencas: 3, faltouMes: 2580, perdasMes: 5 * 1290 });
  });
});

describe("aba Diferenças", () => {
  it("mostra resumo, perdas para confirmar e diferenças (a de escolher primeiro)", async () => {
    render(<PainelDiferencas comercioId="c1" tipo="mercado" products={products} api={api()} />);
    expect(await screen.findByText("Perdas para confirmar (1)")).toBeTruthy();
    expect(screen.getByText("Diferenças para explicar (2)")).toBeTruthy();
    const lista = within(screen.getByRole("region", { name: "Diferenças para explicar" }));
    const botoes = lista.getAllByRole("button");
    expect(botoes[0]!.textContent).toMatch(/Cerveja lata.*As contagens não bateram.*Escolha a contagem certa/);
    expect(botoes[1]!.textContent).toMatch(/Arroz 5 kg.*Faltaram 2 unidades no depósito.*Maria.*−R\$\s25,80/);
    expect(screen.getByText(/3 unidades · Quebrou ou estragou · na gôndola/)).toBeTruthy();
    expect(screen.getByText('"caiu da prateleira"')).toBeTruthy();
  });
  it("não confirmar a perda vira diferença", async () => {
    const a = api();
    const onMudou = vi.fn();
    render(<PainelDiferencas comercioId="c1" tipo="mercado" products={products} api={a} onMudou={onMudou} />);
    fireEvent.click(await screen.findByRole("button", { name: /Não aconteceu/ }));
    expect(screen.getByText(/vira uma/).textContent).toMatch(/diferença para investigar/);
    fireEvent.click(screen.getByRole("button", { name: "Sim, não confirmo" }));
    await waitFor(() => expect(a.decidirPerda).toHaveBeenCalledWith("pe1", false));
    expect(await screen.findByText(/virou uma diferença para explicar/)).toBeTruthy();
    expect(onMudou).toHaveBeenCalled();
  });
  it("confirmar a perda", async () => {
    const a = api();
    render(<PainelDiferencas comercioId="c1" tipo="mercado" products={products} api={a} />);
    fireEvent.click(await screen.findByRole("button", { name: /Confirmar/ }));
    await waitFor(() => expect(a.decidirPerda).toHaveBeenCalledWith("pe1", true));
    expect(await screen.findByText("Perda confirmada.")).toBeTruthy();
  });
  it("explicar a diferença: motivo obrigatório; outro exige texto", async () => {
    const a = api();
    render(<PainelDiferencas comercioId="c1" tipo="mercado" products={products} api={a} />);
    fireEvent.click(await screen.findByRole("button", { name: /Arroz 5 kg.*Faltaram/ }));
    const dlg = within(screen.getByRole("dialog"));
    expect(dlg.getByText(/O sistema tinha/).textContent).toMatch(/100 unidades.*98 unidades/);
    const salvar = dlg.getByRole("button", { name: "Salvar explicação" }) as HTMLButtonElement;
    expect(salvar.disabled).toBe(true);
    fireEvent.click(dlg.getByRole("button", { name: /Outro motivo/ }));
    expect(salvar.disabled).toBe(true);
    fireEvent.click(dlg.getByRole("button", { name: /Sumiu/ }));
    fireEvent.change(dlg.getByLabelText(/Anotação/), { target: { value: "ver câmera" } });
    fireEvent.click(salvar);
    await waitFor(() => expect(a.explicar).toHaveBeenCalledWith("d1", "sumiu", "ver câmera"));
    expect(await screen.findByText("Explicação salva.")).toBeTruthy();
    expect(a.resolver).not.toHaveBeenCalled();
  });
  it("contagem que não bateu: escolhe o número e o motivo; manter o sistema não pede motivo", async () => {
    const a = api();
    render(<PainelDiferencas comercioId="c1" tipo="mercado" products={products} api={a} />);
    fireEvent.click(await screen.findByRole("button", { name: /Cerveja lata/ }));
    let dlg = within(screen.getByRole("dialog"));
    fireEvent.click(dlg.getByRole("button", { name: "Contagem da equipe: 91 unidades" }));
    expect(dlg.getByText(/Faltam 9 unidades/).textContent).toMatch(/−R\$\s27,00/);
    fireEvent.click(dlg.getByRole("button", { name: /Erro de contagem/ }));
    fireEvent.click(dlg.getByRole("button", { name: "Acertar o estoque e salvar" }));
    await waitFor(() => expect(a.resolver).toHaveBeenCalledWith("d2", 91));
    await waitFor(() => expect(a.explicar).toHaveBeenCalledWith("d2", "erro_contagem", ""));
    fireEvent.click(await screen.findByRole("button", { name: /Cerveja lata/ }));
    dlg = within(screen.getByRole("dialog"));
    fireEvent.click(dlg.getByRole("button", { name: "Manter o número do sistema: 100 unidades" }));
    expect(dlg.getByText("O estoque fica como está.")).toBeTruthy();
    expect(dlg.queryByText("O que aconteceu?")).toBeNull();
    fireEvent.click(dlg.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(a.resolver).toHaveBeenCalledWith("d2", 100));
    expect(a.explicar).toHaveBeenCalledTimes(1);
  });
  it("tudo certo e histórico", async () => {
    const dados = { diferencas: [dif({ situacao: "explicada", motivo: "sumiu" })], perdas: [perda({ situacao: "confirmada" })] };
    render(<PainelDiferencas comercioId="c1" tipo="farmacia" products={products} api={api({}, dados)} />);
    expect(await screen.findByText(/Tudo certo! Nenhuma perda ou diferença/)).toBeTruthy();
    expect(screen.getByText(/Resolvidas nos últimos 30 dias \(2\)/)).toBeTruthy();
    expect(screen.getByText(/Faltaram 2 unidades no estoque · Sumiu/)).toBeTruthy();
  });
  it("o dono registra uma perda", async () => {
    const a = api({}, { diferencas: [], perdas: [] });
    render(<PainelDiferencas comercioId="c1" tipo="mercado" products={products} api={a} />);
    fireEvent.click(await screen.findByRole("button", { name: /Registrar perda/ }));
    const dlg = within(screen.getByRole("dialog"));
    fireEvent.change(dlg.getByLabelText("Procurar produto"), { target: { value: "tiss" } });
    fireEvent.click(dlg.getByRole("button", { name: /Tiss/ }));
    const btn = () => dlg.getAllByRole("button", { name: /Registrar perda/ }).at(-1) as HTMLButtonElement;
    expect(btn().disabled).toBe(true);
    fireEvent.click(dlg.getByRole("button", { name: "Na gôndola" }));
    fireEvent.click(dlg.getByRole("button", { name: "Usado na loja" }));
    fireEvent.change(dlg.getByLabelText("Quantos (unidades)"), { target: { value: "2" } });
    fireEvent.click(btn());
    await waitFor(() => expect(a.registrarPerda).toHaveBeenCalledWith(expect.objectContaining({
      comercioId: "c1", produtoId: "tiss", variacaoId: null, area: "venda", quantidade: 2, motivo: "consumo",
    })));
    expect(await screen.findByText(/Perda registrada: 2 unidades/)).toBeTruthy();
  });
});
