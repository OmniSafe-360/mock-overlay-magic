import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ReporGondola, type ApiRepor } from "@/components/ReporGondola";
import type { ItemReposicao, RespostaContagemPrateleira } from "@/lib/banco";
import { escopoAcesso } from "@/lib/operacaoLocal";

vi.mock("@/components/Scanner", () => ({ Scanner: ({ onCode }: { onCode: (codigo: string) => void }) => <button onClick={() => onCode("789")}>leitor retomada</button> }));

const CH = "r".repeat(64);
const item: ItemReposicao = { produtoId: "11111111-1111-4111-8111-111111111111", variacaoId: null, embalagemId: null,
  nome: "Arroz retomado", unidade: "Unidade", codigo: "789", variacao: null, controlaValidade: false, pedeLote: false,
  embalagens: [], local: "Gôndola 3", localDeposito: "Prateleira 2", depositoVazio: false };
const resposta: RespostaContagemPrateleira = { sugerido: 10, cheio: false, depositoVazio: false, localDeposito: "Prateleira 2", situacao: "contado" };
function api(over: Partial<ApiRepor> = {}): ApiRepor {
  return { lista: vi.fn(async () => ({ tipo: "mercado", produtos: [item] })), contar: vi.fn(async () => resposta),
    concluir: vi.fn(async () => {}), buscar: vi.fn(async () => [item]), ...over };
}
const abrir = (a: ApiRepor, chave = CH) => render(<ReporGondola chave={chave} api={a} onVoltar={() => {}} />);
async function ateContar(a: ApiRepor) {
  const tela = abrir(a);
  fireEvent.click(await screen.findByRole("button", { name: /Arroz retomado/ }));
  fireEvent.click(screen.getByRole("button", { name: /Estou na prateleira/ }));
  return tela;
}
async function ateBuscar(a: ApiRepor) {
  const tela = await ateContar(a);
  fireEvent.change(screen.getByLabelText("Na gôndola (unidades)"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar contagem" }));
  await screen.findByText("Busque no depósito");
  return tela;
}

describe("R01 — retomar reposição no mesmo aparelho", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it("fecha antes de chegar e retoma o mesmo produto sem iniciar outra operação", async () => {
    const a = api();
    const tela = abrir(a);
    fireEvent.click(await screen.findByRole("button", { name: /Arroz retomado/ }));
    tela.unmount(); abrir(a);
    expect(await screen.findByText("Vá até")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Estou na prateleira/ }));
    fireEvent.click(screen.getByRole("button", { name: /Está vazia/ }));
    await screen.findByText("Busque no depósito");
    expect(a.contar).toHaveBeenCalledTimes(1);
  });

  it("recupera a contagem digitada, ainda sem enviar", async () => {
    const a = api(); const tela = await ateContar(a);
    fireEvent.change(screen.getByLabelText("Na gôndola (unidades)"), { target: { value: "7" } });
    tela.unmount(); abrir(a);
    expect(await screen.findByLabelText("Na gôndola (unidades)")).toHaveValue("7");
    expect(a.contar).not.toHaveBeenCalled();
  });

  it("depois de contar e levar, recupera a quantidade e conclui usando o ID original", async () => {
    const a = api(); const tela = await ateBuscar(a);
    const id = vi.mocked(a.contar).mock.calls[0]![1];
    fireEvent.change(screen.getByLabelText("Coloquei (unidades)"), { target: { value: "5" } });
    tela.unmount(); abrir(a);
    expect(await screen.findByLabelText("Coloquei (unidades)")).toHaveValue("5");
    fireEvent.click(screen.getByRole("button", { name: "Coloquei na gôndola" }));
    expect(await screen.findByText(/Reposição concluída/)).toBeTruthy();
    expect(a.contar).toHaveBeenCalledTimes(1);
    expect(a.concluir).toHaveBeenCalledWith(CH, id, 5);
  });

  it("contagem sem resposta mantém exatamente o número original, mesmo ao fechar e tentar trocar", async () => {
    const contar = vi.fn<ApiRepor["contar"]>().mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValue(resposta);
    const a = api({ contar }); const tela = await ateContar(a);
    fireEvent.change(screen.getByLabelText("Na gôndola (unidades)"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar contagem" }));
    await screen.findByRole("button", { name: "Confirmar envio anterior" });
    const original = contar.mock.calls[0]!;
    tela.unmount(); abrir(a);
    const campo = await screen.findByLabelText("Na gôndola (unidades)");
    expect(campo).toHaveValue("7"); expect(campo).toBeDisabled();
    expect(screen.getByRole("button", { name: /Está vazia/ })).toBeDisabled();
    fireEvent.change(campo, { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar envio anterior" }));
    await screen.findByText("Busque no depósito");
    expect(contar.mock.calls).toEqual([original, original]);
  });

  it("conclusão já gravada mas sem resposta retoma o envio e transfere uma única vez", async () => {
    const vistos = new Map<string, number>(); let deposito = 20; let gondola = 7; let operacoes = 0;
    const concluir = vi.fn<ApiRepor["concluir"]>(async (_chave, id, q) => {
      if (!vistos.has(id)) { vistos.set(id, q); deposito -= q; gondola += q; operacoes++; throw new Error("Failed to fetch"); }
      expect(vistos.get(id)).toBe(q);
    });
    const a = api({ concluir }); const tela = await ateBuscar(a);
    fireEvent.change(screen.getByLabelText("Coloquei (unidades)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Coloquei na gôndola" }));
    await screen.findByRole("button", { name: "Confirmar envio anterior" });
    const original = concluir.mock.calls[0]!;
    tela.unmount(); abrir(a);
    const campo = await screen.findByLabelText("Coloquei (unidades)");
    expect(campo).toHaveValue("5"); expect(campo).toBeDisabled();
    fireEvent.change(campo, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar envio anterior" }));
    await screen.findByText(/Reposição concluída.*5 unidades/);
    expect(concluir.mock.calls).toEqual([original, original]);
    expect({ deposito, gondola, operacoes }).toEqual({ deposito: 15, gondola: 12, operacoes: 1 });
    expect(localStorage.length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: /Arroz retomado/ }));
    fireEvent.click(screen.getByRole("button", { name: /Estou na prateleira/ }));
    fireEvent.click(screen.getByRole("button", { name: /Está vazia/ }));
    await screen.findByText("Busque no depósito");
    expect(vi.mocked(a.contar).mock.calls[1]![1]).not.toBe(original[1]);
  });

  it("ao fechar durante o pedido, grava os dados antes da rede e retoma mesmo sem a resposta", async () => {
    let responder!: (r: RespostaContagemPrateleira) => void;
    const contar = vi.fn<ApiRepor["contar"]>().mockImplementationOnce(() => new Promise((resolve) => { responder = resolve; })).mockResolvedValue(resposta);
    const a = api({ contar }); const tela = await ateContar(a);
    fireEvent.click(screen.getByRole("button", { name: /Está vazia/ }));
    await waitFor(() => expect(contar).toHaveBeenCalledTimes(1));
    tela.unmount(); const nova = abrir(a);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar envio anterior" }));
    await screen.findByText("Busque no depósito");
    const antes = localStorage.getItem(localStorage.key(0)!);
    await act(async () => responder(resposta));
    expect(localStorage.getItem(localStorage.key(0)!)).toBe(antes);
    expect(within(nova.container).getByText("Busque no depósito")).toBeTruthy();
    expect(contar.mock.calls[0]).toEqual(contar.mock.calls[1]);
  });

  it("dois toques não enviam duas conclusões enquanto aguarda resposta", async () => {
    let confirmar!: () => void;
    const concluir = vi.fn<ApiRepor["concluir"]>(() => new Promise((resolve) => { confirmar = resolve; }));
    const a = api({ concluir }); await ateBuscar(a);
    const botao = screen.getByRole("button", { name: "Coloquei na gôndola" });
    fireEvent.click(botao); fireEvent.click(botao);
    await waitFor(() => expect(concluir).toHaveBeenCalledTimes(1));
    await act(async () => confirmar());
    await screen.findByText(/Reposição concluída/);
  });

  it("outra aba não sobrescreve quantidade nem conclui uma cópia antiga da reposição", async () => {
    const a = api(); const primeira = await ateBuscar(a);
    const segunda = abrir(a); const q1 = within(primeira.container); const q2 = within(segunda.container);
    await q2.findByLabelText("Coloquei (unidades)");
    fireEvent.change(q1.getByLabelText("Coloquei (unidades)"), { target: { value: "5" } });
    fireEvent.click(q2.getByRole("button", { name: "Coloquei na gôndola" }));
    expect((await q2.findByRole("alert")).textContent).toMatch(/outra aba/);
    expect(a.concluir).not.toHaveBeenCalled();
    fireEvent.click(q1.getByRole("button", { name: "Coloquei na gôndola" }));
    await q1.findByText(/Reposição concluída/);
    fireEvent.click(q2.getByRole("button", { name: "Coloquei na gôndola" }));
    await waitFor(() => expect(a.concluir).toHaveBeenCalledTimes(1));
    expect(a.concluir).toHaveBeenCalledWith(CH, expect.any(String), 5);
    expect(localStorage.length).toBe(0);
  });

  it("segunda lista antiga não inicia outra reposição por cima da primeira", async () => {
    const a = api(); const primeira = abrir(a); const q1 = within(primeira.container);
    await q1.findByRole("button", { name: /Arroz retomado/ });
    const segunda = abrir(a); const q2 = within(segunda.container);
    await q2.findByRole("button", { name: /Arroz retomado/ });
    fireEvent.click(q1.getByRole("button", { name: /Arroz retomado/ }));
    const guardado = localStorage.getItem(localStorage.key(0)!);
    fireEvent.click(q2.getByRole("button", { name: /Arroz retomado/ }));
    expect((await q2.findByRole("alert")).textContent).toMatch(/outra aba/);
    expect(localStorage.getItem(localStorage.key(0)!)).toBe(guardado);
    expect(a.contar).not.toHaveBeenCalled();
  });

  it("recusa definitiva permite corrigir a quantidade e preserva o ID", async () => {
    const concluir = vi.fn<ApiRepor["concluir"]>().mockRejectedValueOnce({ message: "deposito_reponivel_insuficiente", code: "23514" }).mockResolvedValue(undefined);
    const a = api({ concluir }); await ateBuscar(a);
    fireEvent.click(screen.getByRole("button", { name: "Coloquei na gôndola" }));
    await screen.findByText(/Não há essa quantidade conferida/);
    expect(screen.getByLabelText("Coloquei (unidades)")).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("Coloquei (unidades)"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Coloquei na gôndola" }));
    await screen.findByText(/Reposição concluída.*3 unidades/);
    expect(concluir.mock.calls.map((c) => c.slice(1))).toEqual([[expect.any(String), 10], [concluir.mock.calls[0]![1], 3]]);
  });

  it("falha de armazenamento impede novo envio e mantém a etapa anterior", async () => {
    const a = api(); const tela = await ateContar(a);
    fireEvent.change(screen.getByLabelText("Na gôndola (unidades)"), { target: { value: "7" } });
    const guardar = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("QuotaExceededError"); });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar contagem" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Nenhum novo envio será feito/);
    expect(a.contar).not.toHaveBeenCalled();
    guardar.mockRestore(); tela.unmount(); abrir(a);
    expect(await screen.findByLabelText("Na gôndola (unidades)")).toHaveValue("7");
  });

  it("rascunho ilegível não é apagado nem substituído por uma nova operação", async () => {
    const escopo = await escopoAcesso(CH); const chave = `omni.operacao.v1:${escopo}:reposicao`;
    localStorage.setItem(chave, "{ilegivel"); const a = api(); abrir(a);
    expect((await screen.findByRole("alert")).textContent).toMatch(/guardar ou ler/);
    expect(localStorage.getItem(chave)).toBe("{ilegivel");
    expect(screen.queryByRole("button", { name: /Arroz retomado/ })).toBeNull();
    expect(a.contar).not.toHaveBeenCalled();
  });

  it("conclusão confirmada com falha ao limpar o registro mantém o mesmo envio para recuperar", async () => {
    const vistos = new Set<string>(); let operacoes = 0;
    const concluir = vi.fn<ApiRepor["concluir"]>(async (_chave, id) => { if (!vistos.has(id)) { vistos.add(id); operacoes++; } });
    const a = api({ concluir }); const tela = await ateBuscar(a);
    fireEvent.change(screen.getByLabelText("Coloquei (unidades)"), { target: { value: "5" } });
    const limpar = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new DOMException("SecurityError"); });
    fireEvent.click(screen.getByRole("button", { name: "Coloquei na gôndola" }));
    await screen.findByRole("alert");
    expect(screen.queryByText(/Reposição concluída/)).toBeNull();
    expect(screen.getByLabelText("Coloquei (unidades)")).toBeDisabled();
    const original = concluir.mock.calls[0]!;
    limpar.mockRestore(); tela.unmount(); abrir(a);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar envio anterior" }));
    await screen.findByText(/Reposição concluída.*5 unidades/);
    expect(concluir.mock.calls).toEqual([original, original]);
    expect(operacoes).toBe(1); expect(localStorage.length).toBe(0);
  });

  it("troca de acesso não mostra o rascunho antigo, e nenhum registro copia a chave", async () => {
    const a = api(); const tela = await ateBuscar(a);
    fireEvent.change(screen.getByLabelText("Coloquei (unidades)"), { target: { value: "5" } });
    const guardado = localStorage.getItem(localStorage.key(0)!);
    expect(guardado).not.toContain(CH); expect(guardado).not.toContain("esperado");
    tela.rerender(<ReporGondola chave={"s".repeat(64)} api={a} onVoltar={() => {}} />);
    await screen.findByRole("button", { name: /Arroz retomado/ });
    expect(screen.queryByLabelText("Coloquei (unidades)")).toBeNull();
    expect(localStorage.getItem(localStorage.key(0)!)).toBe(guardado);
    tela.rerender(<ReporGondola chave={CH} api={a} onVoltar={() => {}} />);
    expect(await screen.findByLabelText("Coloquei (unidades)")).toHaveValue("5");
  });

  it("lista indisponível ao retomar não troca os nomes da farmácia pelos do mercado", async () => {
    const a = api({ lista: vi.fn(async () => ({ tipo: "farmacia", produtos: [item] })) });
    const tela = abrir(a);
    fireEvent.click(await screen.findByRole("button", { name: /Arroz retomado/ }));
    fireEvent.click(screen.getByRole("button", { name: /Estou na prateleira/ }));
    fireEvent.change(screen.getByLabelText("Na área de venda (unidades)"), { target: { value: "7" } });
    tela.unmount(); abrir(api({ lista: vi.fn(async () => { throw new Error("Failed to fetch"); }) }));
    expect(await screen.findByLabelText("Na área de venda (unidades)")).toHaveValue("7");
    expect(screen.queryByText("Quanto tem na gôndola agora?")).toBeNull();
  });

  it("bipagem antiga que responde atrasada não volta a etapa depois da contagem", async () => {
    let respostaBusca!: (itens: ItemReposicao[]) => void;
    const a = api({ buscar: vi.fn<ApiRepor["buscar"]>(() => new Promise((resolve) => { respostaBusca = resolve; })) });
    abrir(a); fireEvent.click(await screen.findByRole("button", { name: /Arroz retomado/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bipar o produto/ }));
    fireEvent.click(screen.getByRole("button", { name: "leitor retomada" }));
    fireEvent.click(screen.getByRole("button", { name: /Estou na prateleira/ }));
    fireEvent.click(screen.getByRole("button", { name: /Está vazia/ }));
    await screen.findByText("Busque no depósito");
    const guardado = localStorage.getItem(localStorage.key(0)!);
    await act(async () => respostaBusca([item]));
    expect(screen.getByText("Busque no depósito")).toBeTruthy();
    expect(localStorage.getItem(localStorage.key(0)!)).toBe(guardado);
  });

  it("sem reposição disponível, fechar preserva Entendi e registra zero sem falso sucesso", async () => {
    const a = api({ contar: vi.fn<ApiRepor["contar"]>(async () => ({ ...resposta, sugerido: 0, depositoVazio: true, motivoSemReposicao: "deposito_sem_estoque" })) });
    const tela = await ateContar(a);
    fireEvent.click(screen.getByRole("button", { name: /Está vazia/ }));
    await screen.findByRole("button", { name: "Entendi" });
    const id = vi.mocked(a.contar).mock.calls[0]![1];
    tela.unmount(); abrir(a);
    fireEvent.click(await screen.findByRole("button", { name: "Entendi" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/contagem registrada. Reposição não realizada/);
    expect(a.concluir).toHaveBeenCalledWith(CH, id, 0);
  });

  it("resposta de contagem já concluída não pede nova transferência", async () => {
    const a = api({ contar: vi.fn<ApiRepor["contar"]>(async () => ({ ...resposta, situacao: "concluido" })) });
    await ateContar(a); fireEvent.click(screen.getByRole("button", { name: /Está vazia/ }));
    expect((await screen.findByRole("status")).textContent).toMatch(/já foi encerrada/);
    expect(screen.queryByText("Busque no depósito")).toBeNull();
    expect(a.concluir).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0);
  });
});
