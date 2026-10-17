import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReporGondola, type ApiRepor } from "@/components/ReporGondola";
import { ConferirDeposito, type ApiConferir } from "@/components/ConferirDeposito";
import { PainelDiferencas, type ApiDiferencas } from "@/components/PainelDiferencas";
import { textoDiferenca, origemTexto, precisaEscolher, type Diferenca } from "@/lib/diferencas";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));
const produto = { produtoId: "p-cega", variacaoId: null, embalagemId: null, nome: "Produto cego", unidade: "Unidade", codigo: "789", variacao: null,
  controlaValidade: false, pedeLote: false, embalagens: [], local: "Gôndola 1", localDeposito: "Depósito 1", depositoVazio: false };
const resposta = (situacao: string, rodada?: number) => ({ situacao, sugerido: 0, cheio: false, depositoVazio: true, localDeposito: "Depósito 1", ...(rodada ? { rodada } : {}) });
const chave = "f".repeat(64);
function apiRepor(contar: ReturnType<typeof vi.fn>, extra = {}) {
  return { lista: vi.fn(async () => ({ tipo: "mercado", produtos: [{ ...produto, ...extra }] })), contar, concluir: vi.fn(async () => {}), buscar: vi.fn(async () => [produto]) } as unknown as ApiRepor;
}
async function abrirRepor(api: ApiRepor) {
  const tela = render(<ReporGondola chave={chave} api={api} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /Produto cego/ }));
  fireEvent.click(screen.getByRole("button", { name: /Estou na prateleira/ })); return tela;
}
const contarGondola = (n: string) => { fireEvent.change(screen.getByLabelText("Na gôndola (unidades)"), { target: { value: n } }); fireEvent.click(screen.getByRole("button", { name: "Confirmar contagem" })); };
beforeEach(() => localStorage.clear());
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

it("gôndola reconta em branco com o mesmo ID e a próxima rodada, sem mostrar quanto buscar", async () => {
  const contar = vi.fn().mockResolvedValueOnce(resposta("recontar", 2)).mockResolvedValueOnce(resposta("aguardando_dono"));
  const api = apiRepor(contar); await abrirRepor(api); contarGondola("3");
  expect(await screen.findByText(/Contagem 2 de 3/)).toBeInTheDocument();
  expect(screen.getByLabelText("Na gôndola (unidades)")).toHaveValue("");
  expect(screen.queryByText("Busque no depósito")).not.toBeInTheDocument();
  contarGondola("3"); expect(await screen.findByRole("status")).toHaveTextContent(/aguardando o dono/i);
  expect(contar.mock.calls[1]![1]).toBe(contar.mock.calls[0]![1]); expect(contar.mock.calls[1]![5]).toBe(2);
  expect(api.concluir).not.toHaveBeenCalled();
});

it("lista da gôndola mostra pendência do dono sem permitir abrir outra contagem", async () => {
  const api = apiRepor(vi.fn(), { aguardandoDono: true, conferenciaId: "cf-cega" });
  render(<ReporGondola chave={chave} api={api} onVoltar={() => {}} />);
  const botao = await screen.findByRole("button", { name: /Produto cego/ });
  expect(botao).toBeDisabled(); expect(botao).toHaveTextContent(/Aguardando o dono/);
  fireEvent.click(botao); expect(api.contar).not.toHaveBeenCalled();
});

it("depósito com contagem confirmada diferente fica pendente, sem agradecer como concluída", async () => {
  const api = { lista: vi.fn(async () => ({ tipo: "mercado", feitosHoje: 0, meta: 5, produtos: [{ ...produto, conferenciaId: null }] })),
    contar: vi.fn(async () => ({ situacao: "aguardando_dono" })), buscar: vi.fn(async () => [produto]) } as unknown as ApiConferir;
  render(<ConferirDeposito chave={chave} api={api} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /Produto cego/ }));
  fireEvent.click(screen.getByRole("button", { name: /Não tem nenhum/ }));
  expect(await screen.findByRole("status")).toHaveTextContent(/Contagem bloqueada. Aguarde a decisão do dono./i);
  expect(screen.queryByText(/conferido. Obrigado/)).not.toBeInTheDocument();
});

it("gôndola passa pela terceira contagem diferente e não conclui reposição", async () => {
  const contar = vi.fn().mockResolvedValueOnce(resposta("recontar", 2)).mockResolvedValueOnce(resposta("recontar", 3)).mockResolvedValueOnce(resposta("inconsistente"));
  const api = apiRepor(contar); await abrirRepor(api); contarGondola("1");
  await screen.findByText(/Contagem 2 de 3/); contarGondola("2");
  await screen.findByText(/Contagem 3 de 3/); expect(screen.getByLabelText("Na gôndola (unidades)")).toHaveValue(""); contarGondola("3");
  expect(await screen.findByRole("status")).toHaveTextContent(/bloqueada, aguardando o dono/i);
  expect(contar.mock.calls[2]![5]).toBe(3); expect(api.concluir).not.toHaveBeenCalled();
});

it("recontagem da gôndola retoma em branco na mesma rodada depois de fechar", async () => {
  const contar = vi.fn().mockResolvedValueOnce(resposta("recontar", 2)).mockResolvedValueOnce(resposta("aguardando_dono"));
  const api = apiRepor(contar); const tela = await abrirRepor(api); contarGondola("3"); await screen.findByText(/Contagem 2 de 3/); tela.unmount();
  render(<ReporGondola chave={chave} api={api} onVoltar={() => {}} />);
  await screen.findByText(/Contagem 2 de 3/); expect(screen.getByLabelText("Na gôndola (unidades)")).toHaveValue("");
  contarGondola("3"); await screen.findByRole("status"); expect(contar.mock.calls[1]![5]).toBe(2);
});

it("contagem começada em outro celular usa ID e rodada devolvidos pela lista", async () => {
  const contar = vi.fn(async () => resposta("aguardando_dono"));
  await abrirRepor(apiRepor(contar, { conferenciaId: "cf-compartilhada", rodada: 2 }));
  expect(screen.getByText(/Contagem 2 de 3/)).toBeInTheDocument(); contarGondola("3");
  await screen.findByRole("status"); expect(contar).toHaveBeenCalledWith(chave, "cf-compartilhada", produto.produtoId, null, 3, 2);
});

it("reposição legada recusada volta a uma contagem vazia sem perder o ID", async () => {
  const contar = vi.fn(async () => ({ ...resposta("contado"), sugerido: 10, depositoVazio: false }));
  const api = apiRepor(contar); vi.mocked(api.concluir).mockRejectedValue(new Error("contagem_exige_recontagem"));
  await abrirRepor(api); contarGondola("0"); await screen.findByText("Busque no depósito");
  fireEvent.change(screen.getByLabelText("Coloquei (unidades)"), { target: { value: "2" } }); fireEvent.click(screen.getByRole("button", { name: "Coloquei na gôndola" }));
  expect(await screen.findByLabelText("Na gôndola (unidades)")).toHaveValue("");
  expect(screen.getByRole("alert")).toHaveTextContent(/nova contagem/);
  expect(screen.queryByText(/Reposição concluída/)).not.toBeInTheDocument();
});

it("depósito mantém produto bloqueado na lista sem abrir outra contagem", async () => {
  const api = { lista: vi.fn(async () => ({ tipo: "mercado", feitosHoje: 1, meta: 5, produtos: [{ ...produto, conferenciaId: null, aguardandoDono: true }] })), contar: vi.fn(), buscar: vi.fn() } as unknown as ApiConferir;
  render(<ConferirDeposito chave={chave} api={api} onVoltar={() => {}} />);
  const b = await screen.findByRole("button", { name: /Produto cego/ }); expect(b).toBeDisabled(); expect(b).toHaveTextContent(/Aguardando o dono/);
  fireEvent.click(b); expect(api.contar).not.toHaveBeenCalled();
});

it("dono vê duas contagens confirmadas com diferença sem texto falso de três diferentes", async () => {
  const dif: Diferenca = { id: "d-cega", produtoId: "p-cega", variacaoId: null, area: "venda", origem: "conferencia_inconsistente", esperado: 0, contado: 3, diferenca: 3, valor: 600,
    funcionario: "Equipe", situacao: "aberta", motivo: null, observacao: null, tentativas: [3, 3], resolvida: false, contagemConfirmada: true, motivoInformado: null, criadaEm: new Date().toISOString() };
  expect(precisaEscolher(dif)).toBe(true); expect(textoDiferenca(dif,"Unidade","mercado")).toMatch(/Contagem com diferença.*aguardando sua decisão/);
  expect(origemTexto(dif,"mercado")).toBe("Contagem na gôndola (contagem repetida com diferença)");
  const resolver = vi.fn(async () => ({ diferenca: 0, valor: 0 }));
  const api = { carregar: vi.fn(async () => ({ diferencas: [dif], perdas: [] })), resolverComMotivo: resolver, explicar: vi.fn(), decidirPerda: vi.fn(), registrarPerda: vi.fn() } as unknown as ApiDiferencas;
  render(<PainelDiferencas comercioId="com-cega" tipo="mercado" products={[]} api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: /Contagem com diferença/ }));
  const dlg = within(screen.getByRole("dialog"));
  expect(dlg.getByText(/A contagem se repetiu, mas há uma diferença/)).toBeInTheDocument();
  expect(dlg.queryByText(/As 3 contagens não bateram/)).not.toBeInTheDocument();
  expect(dlg.getAllByRole("button", { name: "Contagem da equipe: 3 unidades" })).toHaveLength(1);
  fireEvent.click(dlg.getByRole("button", { name: "Manter o número do sistema: 0 unidades" }));
  fireEvent.click(dlg.getByRole("button", { name: /^Salvar$/ }));
  await waitFor(() => expect(resolver).toHaveBeenCalledWith("d-cega",0,null,"")); expect(api.explicar).not.toHaveBeenCalled();
});
