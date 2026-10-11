import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReceberMercadoria, type ApiReceber } from "@/components/ReceberMercadoria";
import { escopoAcesso, operacaoLocal } from "@/lib/operacaoLocal";
import { chaveRascunho, guardarRascunho, lerRascunho, novaContagem, type ProdutoFunc, type Rascunho } from "@/lib/recebimento";

const chave = "r".repeat(64);
const produto: ProdutoFunc = { produtoId: "arroz", variacaoId: null, embalagemId: null, nome: "Arroz", unidade: "Unidade", codigo: "789", variacao: null, controlaValidade: false, pedeLote: false, embalagens: [] };
const rascunho: Rascunho = { id: "entrega", pedidoId: "pedido", fornecedorId: null, rodada: 0,
  contagens: { "arroz:_": { ...novaContagem(produto), soltas: "12" } }, estados: { "arroz:_": "contado" } };
const apiReceber = (): ApiReceber => ({
  entregas: vi.fn(async () => ({ pedidos: [{ id: "pedido", numero: 2, fornecedor: "Distribuidora Sol", produtos: 1, previsaoEntrega: null, emContagem: false }], fornecedores: [{ id: "sol", nome: "Distribuidora Sol" }] })),
  abrir: vi.fn(async (_chave, id, pedidoId, fornecedorId) => ({ id: pedidoId ? "entrega" : id, pedidoId, numero: pedidoId ? 2 : null, fornecedor: fornecedorId === null && !pedidoId ? null : "Distribuidora Sol", situacao: "contando" as const, rodada: 0, produtos: pedidoId ? [produto] : [], itens: [] })),
  buscar: vi.fn(async () => [produto]),
  enviar: vi.fn(async () => ({ situacao: "concluido" as const, rodada: 1, produtos: 1, avisos: false })),
});
async function kr(pedidoId: string | null = "pedido", fornecedorId: string | null = null, acesso = chave) {
  return chaveRascunho(pedidoId, await escopoAcesso(acesso), fornecedorId);
}
async function abrirPedido(api = apiReceber()) {
  const view = render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
  await screen.findByRole("button", { name: /Arroz:/ });
  return { view, api };
}
async function contar(qtd: string) {
  fireEvent.click(screen.getByRole("button", { name: /Arroz:/ }));
  const dlg = within(await screen.findByRole("dialog", { name: "Arroz" }));
  fireEvent.change(dlg.getByLabelText("Quantidade (unidades)"), { target: { value: qtd } });
  fireEvent.click(dlg.getByRole("button", { name: "Salvar contagem" }));
}
const gravar = Storage.prototype.setItem;
function falharGravacao() {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key.startsWith("omni.recebimento.")) throw new DOMException("cheio", "QuotaExceededError");
    gravar.call(this, key, value);
  });
}
beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it("avisa que a contagem só está na tela quando o armazenamento enche", async () => {
  await abrirPedido();
  falharGravacao();
  await contar("7");
  expect(screen.getByRole("alert", { name: "Contagem não guardada" })).toHaveTextContent(/últimas alterações podem se perder/);
  expect(screen.getByText(/Contagem pronta para enviar · 7 unidades/)).toBeTruthy();
});

it("não trata um rascunho ilegível como uma entrega nova nem sobrescreve os dados", async () => {
  const key = "omni.recebimento." + await kr();
  localStorage.setItem(key, "{incompleto");
  const api = apiReceber();
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/contagem guardada.*não pôde ser recuperada/i);
  expect(api.abrir).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBe("{incompleto");
});

it("não confunde armazenamento inacessível com ausência de rascunho", async () => {
  const api = apiReceber();
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("bloqueado", "SecurityError"); });
  fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível ler a contagem guardada/);
  expect(api.abrir).not.toHaveBeenCalled();
});

it("nova tentativa guarda os números atuais, e reabrir recupera a última gravação confirmada", async () => {
  const key = await kr();
  guardarRascunho(key, rascunho);
  const { view, api } = await abrirPedido();
  const falha = falharGravacao();
  await contar("7");
  fireEvent.click(screen.getByRole("button", { name: "Tentar guardar de novo" }));
  expect(screen.getByRole("alert", { name: "Contagem não guardada" })).toBeTruthy();
  expect(lerRascunho(key)).toEqual(rascunho);
  falha.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Tentar guardar de novo" }));
  expect(screen.queryByRole("alert", { name: "Contagem não guardada" })).toBeNull();
  expect(lerRascunho(key)?.contagens["arroz:_"]?.soltas).toBe("7");
  expect(api.enviar).not.toHaveBeenCalled();
  view.unmount();
  await abrirPedido();
  expect(screen.getByText(/Contagem pronta para enviar · 7 unidades/)).toBeTruthy();
});

it("fechar sem conseguir guardar não promete recuperar as alterações que ficaram na tela", async () => {
  const key = await kr();
  guardarRascunho(key, rascunho);
  const { view } = await abrirPedido();
  const falha = falharGravacao();
  await contar("7");
  expect(screen.getByRole("alert", { name: "Contagem não guardada" })).toHaveTextContent(/se você sair ou fechar o app/);
  view.unmount(); falha.mockRestore();
  await abrirPedido();
  expect(screen.getByText(/Contagem pronta para enviar · 12 unidades/)).toBeTruthy();
  expect(screen.queryByText(/7 unidades/)).toBeNull();
});

it("mostra o aviso também dentro da ficha do produto", async () => {
  falharGravacao();
  await abrirPedido();
  fireEvent.click(screen.getByRole("button", { name: /Arroz:/ }));
  expect(within(screen.getByRole("dialog", { name: "Arroz" })).getByRole("alert")).toHaveTextContent(/Não foi possível guardar a contagem/);
});

it("detecta gravação sem erro que não conserva os dados", async () => {
  await abrirPedido();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (!key.startsWith("omni.recebimento.")) gravar.call(this, key, value);
  });
  await contar("7");
  expect(screen.getByRole("alert", { name: "Contagem não guardada" })).toHaveTextContent(/Não foi possível guardar a contagem/);
});

it.each(["null", "{}", JSON.stringify({ ...rascunho, contagens: { "arroz:_": { p: produto } } }), JSON.stringify({ ...rascunho, estados: { "arroz:_": "desconhecido" } })])(
  "recusa rascunho estruturalmente inválido sem apagá-lo: %s", async (texto) => {
    const key = "omni.recebimento." + await kr();
    localStorage.setItem(key, texto);
    expect(() => lerRascunho(key.slice("omni.recebimento.".length))).toThrow(/não pôde ser recuperada/);
    expect(localStorage.getItem(key)).toBe(texto);
  },
);

it.each(["Distribuidora Sol", "Não sei"])("não abre entrega sem pedido sem conseguir guardar o id: %s", async (nome) => {
  falharGravacao();
  const api = apiReceber();
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Chegou sem pedido" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: nome }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível guardar a contagem/);
  expect(api.abrir).not.toHaveBeenCalled();
});

it("rascunho ilegível mantém intacto o envio anterior sem resposta", async () => {
  const key = await kr(null, "sol");
  const envio = { rodada: 0, itens: [{ produto_id: "arroz", variacao_id: null, total: 12, avaria: 0, partes: [] }], chaves: ["arroz:_"] };
  const validar = (p: unknown): p is typeof envio => !!p && Array.isArray((p as typeof envio).itens);
  await expect(operacaoLocal(key, "receber:entrega", validar).enviar(() => envio, async () => { throw new TypeError("Failed to fetch"); })).rejects.toThrow();
  localStorage.setItem("omni.recebimento." + key, "{ilegivel");
  const antes = { ...localStorage };
  const api = apiReceber();
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Chegou sem pedido" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Distribuidora Sol" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Nenhum rascunho ou envio pendente foi descartado/);
  expect({ ...localStorage }).toEqual(antes);
  expect(operacaoLocal(key, "receber:entrega", validar).pendente()).toEqual(envio);
  expect(api.abrir).not.toHaveBeenCalled();
  expect(api.enviar).not.toHaveBeenCalled();
});

it("falha ao guardar não altera o reenvio original depois de fechar a tela", async () => {
  const key = await kr();
  guardarRascunho(key, rascunho);
  const api = apiReceber();
  vi.mocked(api.enviar).mockRejectedValueOnce(new TypeError("Failed to fetch"));
  const { view } = await abrirPedido(api);
  falharGravacao();
  fireEvent.click(screen.getByRole("button", { name: "Conferir e concluir entrega" }));
  await screen.findByRole("button", { name: "Confirmar envio anterior" });
  await contar("7");
  expect(screen.getByRole("alert", { name: "Contagem não guardada" })).toBeTruthy();
  view.unmount();
  await abrirPedido(api);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envio anterior" }));
  await screen.findByText("Pronto!");
  expect(vi.mocked(api.enviar).mock.calls[1]).toEqual(vi.mocked(api.enviar).mock.calls[0]);
  expect(vi.mocked(api.enviar).mock.calls[1]?.[3][0]?.total).toBe(12);
});

it("falha em um pedido não altera outro pedido, fornecedor ou acesso", async () => {
  const outros = [await kr("outro"), await kr(null, "sol"), await kr(null, null), await kr("pedido", null, "outro-acesso")];
  for (const key of outros) guardarRascunho(key, rascunho);
  await abrirPedido(); falharGravacao(); await contar("7");
  await waitFor(() => expect(screen.getByRole("alert", { name: "Contagem não guardada" })).toBeTruthy());
  for (const key of outros) expect(lerRascunho(key)).toEqual(rascunho);
});

it("avisa perda de leitura durante a contagem sem derrubar a tela nem apagar dados", async () => {
  const key = await kr();
  guardarRascunho(key, rascunho);
  const { api } = await abrirPedido();
  const ler = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
    if (key.startsWith("omni.recebimento.")) throw new DOMException("bloqueado", "SecurityError");
    return ler.call(this, key);
  });
  await contar("7");
  expect(screen.getByRole("alert", { name: "Contagem não guardada" })).toHaveTextContent(/últimas alterações podem se perder/);
  expect(screen.getByRole("alert", { name: "Contagem não guardada" })).toHaveTextContent(/Não foi possível ler/);
  expect(api.enviar).not.toHaveBeenCalled();
});

it("nenhum envio novo sai se o armazenamento da fila também estiver cheio", async () => {
  const { api } = await abrirPedido();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("cheio", "QuotaExceededError"); });
  await contar("7");
  fireEvent.click(screen.getByRole("button", { name: "Conferir e concluir entrega" }));
  expect(await screen.findByText(/Nenhum novo envio será feito/)).toBeTruthy();
  expect(screen.getByRole("alert", { name: "Contagem não guardada" })).toHaveTextContent(/últimas alterações podem se perder/);
  expect(api.enviar).not.toHaveBeenCalled();
});

it("falha de leitura ao enviar entrega avulsa aparece sem apagar o rascunho", async () => {
  const key = await kr(null, "sol");
  const avulso = { ...rascunho, pedidoId: null, fornecedorId: "sol" };
  guardarRascunho(key, avulso);
  const api = apiReceber();
  render(<ReceberMercadoria chave={chave} api={api} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Chegou sem pedido" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Distribuidora Sol" }));
  fireEvent.click(await screen.findByRole("button", { name: "Continuar contagem" }));
  const ler = Storage.prototype.getItem;
  const falha = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
    if (key.startsWith("omni.recebimento.")) throw new DOMException("bloqueado", "SecurityError");
    return ler.call(this, key);
  });
  fireEvent.click(screen.getByRole("button", { name: "Conferir e concluir entrega" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível ler a contagem guardada/);
  expect(api.enviar).not.toHaveBeenCalled();
  falha.mockRestore();
  expect(lerRascunho(key)).toEqual(avulso);
});

it("leitura inicial falha após abrir no servidor não substitui dados que a tela não recuperou", async () => {
  const key = await kr();
  guardarRascunho(key, rascunho);
  const api = apiReceber();
  const abrir = api.abrir;
  const ler = Storage.prototype.getItem;
  let falha: ReturnType<typeof vi.spyOn>;
  api.abrir = vi.fn(async (...args: Parameters<ApiReceber["abrir"]>) => {
    const resposta = await abrir(...args);
    falha = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
      if (key.startsWith("omni.recebimento.")) throw new DOMException("bloqueado", "SecurityError");
      return ler.call(this, key);
    });
    return resposta;
  });
  await abrirPedido(api);
  expect(screen.getByRole("alert", { name: "Contagem não guardada" })).toHaveTextContent(/Não foi possível ler/);
  falha!.mockRestore();
  await contar("7");
  expect(lerRascunho(key)).toEqual(rascunho);
  expect(screen.getByRole("button", { name: "Conferir e concluir entrega" })).toBeDisabled();
  expect(api.enviar).not.toHaveBeenCalled();
});
