import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReceberMercadoria, type ApiReceber } from "@/components/ReceberMercadoria";
import type { RecebimentoAberto } from "@/lib/banco";
import { escopoAcesso, operacaoLocal } from "@/lib/operacaoLocal";
import { chaveRascunho, guardarRascunho, lerRascunho, novaContagem, type ProdutoFunc, type Rascunho } from "@/lib/recebimento";

const chave = "c".repeat(64);
const produto: ProdutoFunc = { produtoId: "arroz", variacaoId: null, embalagemId: null, nome: "Arroz", unidade: "Unidade", codigo: "789", variacao: null, controlaValidade: false, pedeLote: false, embalagens: [] };
const rascunho: Rascunho = { id: "entrega-antiga", pedidoId: null, fornecedorId: "sol", rodada: 0,
  contagens: { "arroz:_": { ...novaContagem(produto), soltas: "12" } }, estados: { "arroz:_": "contado" } };
const aberto = (id: string, fornecedorId: string | null): RecebimentoAberto => ({ id, rodada: 0, situacao: "contando", pedidoId: null, numero: null,
  fornecedor: fornecedorId === "sol" ? "Distribuidora Sol" : fornecedorId === "lua" ? "Distribuidora Lua" : null, produtos: [], itens: [] });
const apiReceber = (): ApiReceber => ({
  entregas: vi.fn(async () => ({ pedidos: [], fornecedores: [{ id: "sol", nome: "Distribuidora Sol" }, { id: "lua", nome: "Distribuidora Lua" }] })),
  abrir: vi.fn(async (_chave, id, _pedido, fornecedorId) => aberto(id, fornecedorId)),
  buscar: vi.fn(async () => [produto]),
  enviar: vi.fn(async () => ({ situacao: "concluido" as const, rodada: 1, produtos: 1, avisos: false })),
});
async function escolherFornecedor(nome = "Distribuidora Sol") {
  fireEvent.click(await screen.findByRole("button", { name: "Chegou sem pedido" }));
  fireEvent.click(await screen.findByRole("button", { name: nome }));
}
async function contar(qtd: string) {
  fireEvent.click(screen.getByRole("button", { name: "Digitar código ou nome" }));
  const busca = within(screen.getByRole("dialog"));
  fireEvent.change(busca.getByPlaceholderText("Código de barras ou nome"), { target: { value: "arroz" } });
  fireEvent.click(busca.getByRole("button", { name: "Procurar" }));
  fireEvent.click(await busca.findByRole("button", { name: /Arroz/ }));
  const dlg = within(await screen.findByRole("dialog", { name: "Arroz" }));
  fireEvent.change(dlg.getByLabelText("Quantidade (unidades)"), { target: { value: qtd } });
  fireEvent.click(dlg.getByRole("button", { name: "Salvar contagem" }));
}
async function guardar(antigo = false, r = rascunho) {
  const escopo = await escopoAcesso(chave);
  const kr = antigo ? chaveRascunho(null, escopo) : chaveRascunho(null, escopo, r.fornecedorId);
  guardarRascunho(kr, r);
  return kr;
}
async function guardarEnvio(kr: string) {
  const envio = { rodada: 0, itens: [{ produto_id: "arroz", variacao_id: null, total: 12, avaria: 0, partes: [] }], chaves: ["arroz:_"] };
  const registro = operacaoLocal(kr, `receber:${rascunho.id}`, (p: unknown): p is typeof envio => !!p && Array.isArray((p as typeof envio).itens));
  await expect(registro.enviar(() => envio, async () => { throw new TypeError("Failed to fetch"); })).rejects.toThrow();
  return envio;
}
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

it.each(["Distribuidora Lua", "Não sei"])("não retoma a entrega antiga de outro fornecedor ao escolher %s", async (nome) => {
  const kr = await guardar(true);
  const api = apiReceber();
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  await escolherFornecedor(nome);
  await screen.findByText("Sem pedido · bipe cada produto e conte o que chegou.");
  expect(api.abrir).toHaveBeenCalledWith(chave, expect.not.stringMatching(/^entrega-antiga$/), null, nome === "Não sei" ? null : "lua");
  expect(screen.queryByText(/12 unidades/)).toBeNull();
  expect(lerRascunho(kr)).toEqual(rascunho);
  fireEvent.click(screen.getByRole("button", { name: "Entregas" }));
  await escolherFornecedor();
  await screen.findByRole("dialog", { name: "Contagem em andamento" });
  fireEvent.click(screen.getByRole("button", { name: "Continuar contagem" }));
  expect(await screen.findByText(/Contagem pronta para enviar · 12 unidades/)).toBeTruthy();
  expect(api.abrir).toHaveBeenLastCalledWith(chave, "entrega-antiga", null, "sol");
});

it("descarta somente o rascunho escolhido; uma nova entrega envia apenas a nova quantidade", async () => {
  const kr = await guardar();
  const outra = { ...rascunho, id: "entrega-lua", fornecedorId: "lua" };
  const krOutra = await guardar(false, outra);
  const api = apiReceber();
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  await escolherFornecedor();
  fireEvent.click(await screen.findByRole("button", { name: "Descartar contagem e começar outra" }));
  await screen.findByText("Sem pedido · bipe cada produto e conte o que chegou.");
  const novaId = vi.mocked(api.abrir).mock.calls.at(-1)![1];
  expect(novaId).not.toBe(rascunho.id);
  expect(lerRascunho(kr)).toMatchObject({ id: novaId, contagens: {}, fornecedorId: "sol" });
  expect(lerRascunho(krOutra)).toEqual(outra);
  expect(screen.queryByText(/12 unidades/)).toBeNull();
  await contar("7");
  fireEvent.click(screen.getByRole("button", { name: "Conferir e concluir entrega" }));
  await screen.findByText("Pronto!");
  expect(api.enviar).toHaveBeenCalledWith(chave, novaId, 0, [{ produto_id: "arroz", variacao_id: null, total: 7, avaria: 0, partes: [] }]);
  expect(lerRascunho(kr)).toBeNull();
  expect(lerRascunho(krOutra)).toEqual(outra);
});

it("fechar a escolha mantém a contagem para continuar depois", async () => {
  const kr = await guardar();
  const api = apiReceber();
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  await escolherFornecedor();
  const dlg = within(await screen.findByRole("dialog", { name: "Contagem em andamento" }));
  fireEvent.click(dlg.getByRole("button", { name: "Fechar" }));
  await screen.findByRole("button", { name: "Chegou sem pedido" });
  expect(lerRascunho(kr)).toEqual(rascunho);
  expect(api.abrir).toHaveBeenCalledTimes(1);
  await escolherFornecedor();
  fireEvent.click(await screen.findByRole("button", { name: "Continuar contagem" }));
  await screen.findByText(/Contagem pronta para enviar · 12 unidades/);
});

it("o envio sem resposta na chave antiga bloqueia descarte e repete os dados originais mesmo já concluído no banco", async () => {
  const kr = await guardar(true);
  const envio = await guardarEnvio(kr);
  const api = apiReceber();
  vi.mocked(api.abrir).mockImplementation(async (_chave, id, _pedido, fornecedorId) => ({ ...aberto(id, fornecedorId), situacao: "concluido", rodada: 1 }));
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  await escolherFornecedor();
  await screen.findByText(/Há um envio sem resposta/);
  expect(screen.queryByRole("button", { name: "Descartar contagem e começar outra" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continuar contagem" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar envio anterior" }));
  await screen.findByText("Pronto!");
  expect(api.enviar).toHaveBeenCalledWith(chave, rascunho.id, envio.rodada, envio.itens);
  expect(lerRascunho(kr)).toBeNull();
  expect(operacaoLocal(kr, `receber:${rascunho.id}`, (p: unknown): p is typeof envio => !!p).pendente()).toBeNull();
});

it("não descarta se outra aba iniciou um envio depois de abrir a escolha", async () => {
  const kr = await guardar();
  const api = apiReceber();
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  await escolherFornecedor();
  const descarte = await screen.findByRole("button", { name: "Descartar contagem e começar outra" });
  await guardarEnvio(kr);
  fireEvent.click(descarte);
  expect(await screen.findByRole("alert")).toHaveTextContent("Há um envio sem confirmação");
  expect(api.abrir).toHaveBeenCalledTimes(1);
  expect(lerRascunho(kr)).toEqual(rascunho);
});

it("não descarta se as contagens do rascunho mudaram em outra aba", async () => {
  const kr = await guardar();
  const api = apiReceber();
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  await escolherFornecedor();
  const descarte = await screen.findByRole("button", { name: "Descartar contagem e começar outra" });
  const atual = { ...rascunho, contagens: { "arroz:_": { ...novaContagem(produto), soltas: "15" } } };
  guardarRascunho(kr, atual);
  fireEvent.click(descarte);
  expect(await screen.findByRole("alert")).toHaveTextContent("Esta contagem mudou em outra tela");
  expect(api.abrir).toHaveBeenCalledTimes(1);
  expect(lerRascunho(kr)).toEqual(atual);
});

it("confere novamente no banco antes de descartar e preserva contagens que já foram enviadas", async () => {
  const kr = await guardar();
  const api = apiReceber();
  vi.mocked(api.abrir).mockResolvedValueOnce(aberto(rascunho.id, "sol")).mockResolvedValue({ ...aberto(rascunho.id, "sol"), rodada: 1,
    itens: [{ produtoId: "arroz", variacaoId: null, situacao: "aceito" }] });
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  await escolherFornecedor();
  fireEvent.click(await screen.findByRole("button", { name: "Descartar contagem e começar outra" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("já tem contagens enviadas");
  expect(lerRascunho(kr)).toEqual(rascunho);
  expect(api.abrir).toHaveBeenCalledTimes(2);
});

it("abertura sem resposta guarda o id antes da rede e retoma sem criar outra entrega", async () => {
  const api = apiReceber();
  vi.mocked(api.abrir).mockRejectedValueOnce(new TypeError("Failed to fetch"));
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  await escolherFornecedor();
  await screen.findByRole("alert");
  const id = vi.mocked(api.abrir).mock.calls[0]![1];
  const kr = chaveRascunho(null, await escopoAcesso(chave), "sol");
  expect(lerRascunho(kr)).toMatchObject({ id, fornecedorId: "sol" });
  await escolherFornecedor();
  await screen.findByRole("button", { name: "Continuar contagem" });
  expect(api.abrir).toHaveBeenLastCalledWith(chave, id, null, "sol");
});

it("falha ao abrir após descartar conserva a nova entrega vazia para a próxima tentativa", async () => {
  const kr = await guardar();
  const api = apiReceber();
  vi.mocked(api.abrir).mockResolvedValueOnce(aberto(rascunho.id, "sol")).mockResolvedValueOnce(aberto(rascunho.id, "sol"))
    .mockRejectedValueOnce(new TypeError("Failed to fetch"));
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  await escolherFornecedor();
  fireEvent.click(await screen.findByRole("button", { name: "Descartar contagem e começar outra" }));
  await screen.findByRole("alert");
  const id = vi.mocked(api.abrir).mock.calls.at(-1)![1];
  expect(id).not.toBe(rascunho.id);
  expect(lerRascunho(kr)).toMatchObject({ id, contagens: {} });
  await escolherFornecedor();
  fireEvent.click(await screen.findByRole("button", { name: "Continuar contagem" }));
  await screen.findByText("Sem pedido · bipe cada produto e conte o que chegou.");
  expect(api.abrir).toHaveBeenLastCalledWith(chave, id, null, "sol");
  expect(screen.queryByText(/12 unidades/)).toBeNull();
});

it("uma tela antiga não sobrescreve nem envia a contagem depois que outra aba começou a entrega nova", async () => {
  const kr = await guardar();
  const api = apiReceber();
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  await escolherFornecedor();
  fireEvent.click(await screen.findByRole("button", { name: "Continuar contagem" }));
  await screen.findByText(/Contagem pronta para enviar · 12 unidades/);
  const nova: Rascunho = { ...rascunho, id: "entrega-nova", contagens: {}, estados: {} };
  guardarRascunho(kr, nova);
  fireEvent.click(screen.getByRole("button", { name: "Arroz: contado" }));
  const dlg = within(await screen.findByRole("dialog", { name: "Arroz" }));
  fireEvent.change(dlg.getByLabelText("Quantidade (unidades)"), { target: { value: "15" } });
  fireEvent.click(dlg.getByRole("button", { name: "Salvar contagem" }));
  fireEvent.click(screen.getByRole("button", { name: "Conferir e concluir entrega" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Esta contagem mudou em outra tela");
  expect(api.enviar).not.toHaveBeenCalled();
  expect(lerRascunho(kr)).toEqual(nova);
});

it("rascunho de entrega já concluída não reaproveita os produtos na entrega seguinte", async () => {
  const kr = await guardar();
  const api = apiReceber();
  vi.mocked(api.abrir).mockResolvedValueOnce({ ...aberto(rascunho.id, "sol"), situacao: "concluido", rodada: 1 });
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  await escolherFornecedor();
  await screen.findByText("Sem pedido · bipe cada produto e conte o que chegou.");
  expect(api.abrir).toHaveBeenCalledTimes(2);
  expect(lerRascunho(kr)?.id).not.toBe(rascunho.id);
  expect(screen.queryByText(/12 unidades/)).toBeNull();
  expect(api.enviar).not.toHaveBeenCalled();
});
