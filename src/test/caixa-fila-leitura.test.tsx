import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CaixaCelular, type ApiCaixa } from "@/components/CaixaCelular";
import { ErroLeituraFilaCaixa, enviarFila, filaCaixa, itemDoProduto, montarVenda, type ProdutoCaixa, type VendaGuardada } from "@/lib/caixa";
import { escopoAcesso } from "@/lib/operacaoLocal";
import type { EstadoCaixa, ResultadoCaixa } from "@/lib/banco";

vi.mock("@/components/LeitorContinuo", () => ({ LeitorContinuo: ({ onCode }: { onCode: (c: string) => void }) => <button onClick={() => onCode("789")}>ler produto fictício</button> }));
const chave = "d".repeat(64);
const produto: ProdutoCaixa = { id: "p-fila", nome: "Produto fictício", unidade: "Unidade", fracionado: false, preco: 500,
  codigos: [{ codigo: "789", variacaoId: null, embalagemId: null }], variacoes: [], embalagens: [], estoques: [{ variacaoId: null, quantidade: 10 }] };
const estado: EstadoCaixa = { nome: "Ana", comercio: { nome: "Mercado fictício", tipo: "mercado", endereco: null, telefone: null }, donoTemPin: true, vendas: [],
  turno: { id: "t-fila", abertoEm: new Date().toISOString(), trocoInicial: 0, vendas: 0, canceladas: 0, total: 0, porForma: { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 }, trocoDado: 0, sangrias: 0, dinheiroEsperado: 0 } };
const item = itemDoProduto("i-fila", { produto, variacaoId: null, embalagemId: null }, "789");
function guardada(id = "v-fila"): VendaGuardada {
  return { venda: montarVenda(id, estado.turno!.id, [item], [{ forma: "pix", valor: 500 }], null, "2026-10-19T12:00:00Z"), total: 500, troco: 0, formas: "Pix" };
}
function api(extra: Partial<ApiCaixa> = {}): ApiCaixa {
  return { estado: vi.fn(async () => estado), produtos: vi.fn(async () => [produto]), clientes: vi.fn(async () => []), foraEstoque: vi.fn(async () => []),
    abrir: vi.fn(async () => estado.turno!), conferir: vi.fn(async () => ({ situacao: "aprovada" as const })),
    registrar: vi.fn(async () => ({ situacao: "registrada" as const, numero: 1, troco: 0, semCadastro: 0 })), ...extra };
}
const mensagem = /Não foi possível ler as vendas guardadas neste celular/;
async function key() { return `omni.caixa.fila.v1:${await escopoAcesso(chave)}`; }
const tela = (a: ApiCaixa, sair = vi.fn()) => render(<CaixaCelular chave={chave} api={a} onSair={sair} mercado />);
beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("fila: leitura sem descarte silencioso", () => {
  it.each(["", "{", "null", "{}", "[null]", JSON.stringify([guardada(), { total: "ilegível" }])])("bloqueia todos os escritores se o conteúdo é inválido: %s", (original) => {
    const arm = { getItem: vi.fn(() => original), setItem: vi.fn(), removeItem: vi.fn() };
    const f = filaCaixa("isolado", arm);
    for (const acao of [() => f.ler(), () => f.por(guardada("nova")), () => f.tirar("v-fila"), () => f.tentarDeNovo("v-fila"), () => f.marcarProblema("v-fila", "recusa")]) expect(acao).toThrow(ErroLeituraFilaCaixa);
    expect(arm.setItem).not.toHaveBeenCalled(); expect(arm.removeItem).not.toHaveBeenCalled(); expect(arm.getItem()).toBe(original);
  });
  it("falha de acesso preserva a fila; voltar a ler recupera os mesmos IDs", () => {
    const original = JSON.stringify([guardada()]); let falha = true;
    const arm = { getItem: vi.fn(() => { if (falha) throw new DOMException("negado", "SecurityError"); return original; }), setItem: vi.fn(), removeItem: vi.fn() };
    const f = filaCaixa("isolado", arm); expect(() => f.por(guardada("nova"))).toThrow(ErroLeituraFilaCaixa);
    expect(arm.setItem).not.toHaveBeenCalled(); expect(arm.removeItem).not.toHaveBeenCalled();
    falha = false; expect(f.ler()).toEqual([guardada()]); expect(f.ler()[0]!.venda.id).toBe("v-fila");
  });
  it("acesso ao próprio localStorage negado também é erro de leitura, sem escrita", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("negado", "SecurityError"); });
    const f = filaCaixa("isolado"); expect(() => f.ler()).toThrow(ErroLeituraFilaCaixa); expect(() => f.por(guardada())).toThrow(ErroLeituraFilaCaixa);
  });
  it("chave ausente é vazia; fila válida antiga, recusada e pendente não é filtrada nem reescrita", () => {
    let raw: string | null = null;
    const arm = { getItem: () => raw, setItem: vi.fn((_k: string, v: string) => { raw = v; }), removeItem: vi.fn(() => { raw = null; }) };
    const f = filaCaixa("isolado", arm); expect(f.ler()).toEqual([]); expect(arm.setItem).not.toHaveBeenCalled();
    const original = [guardada(), { ...guardada("recusada"), problema: "recusa", conciliacaoDono: true }, { ...guardada("pendente"), confirmacaoPendente: true }];
    raw = JSON.stringify(original); expect(f.ler()).toEqual(original); expect(arm.setItem).not.toHaveBeenCalled();
    f.por(guardada()); expect(f.ler()).toEqual(original); expect(arm.setItem).not.toHaveBeenCalled();
  });
  it("o envio não chega à API quando a fila não foi lida", async () => {
    const enviar = vi.fn(); const arm = { getItem: () => "{", setItem: vi.fn(), removeItem: vi.fn() };
    await expect(enviarFila(filaCaixa("isolado", arm), enviar)).rejects.toThrow(ErroLeituraFilaCaixa);
    expect(enviar).not.toHaveBeenCalled(); expect(arm.removeItem).not.toHaveBeenCalled();
  });
});

describe("Caixa: erro de fila usa recuperação existente", () => {
  it("não abre operação nem migra registro antigo quando a fila é ilegível; repetir/voltar não apagam", async () => {
    const k = await key(); const original = "{dados ilegíveis"; localStorage.setItem(k, original);
    const legado = `omni.operacao.v1:${encodeURIComponent(await escopoAcesso(chave))}:caixa-venda`;
    localStorage.setItem(legado, JSON.stringify({ pedido: guardada() })); const legadoOriginal = localStorage.getItem(legado);
    const a = api(); const sair = vi.fn(); tela(a, sair);
    await screen.findByText(mensagem); expect(screen.getByText(/Não limpe os dados/)).toBeInTheDocument(); expect(screen.getByText(/Novas vendas estão bloqueadas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" })); await screen.findByText(mensagem);
    expect(a.estado).not.toHaveBeenCalled(); expect(a.registrar).not.toHaveBeenCalled();
    expect(localStorage.getItem(k)).toBe(original); expect(localStorage.getItem(legado)).toBe(legadoOriginal);
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao início" })); expect(sair).toHaveBeenCalledOnce(); expect(localStorage.getItem(k)).toBe(original);
  });
  it("leitura volta a funcionar: Tentar de novo recupera sem limpar armazenamento", async () => {
    const k = await key(); const get = Storage.prototype.getItem; let falha = true;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, ch) { if (ch === k && falha) throw new DOMException("negado", "SecurityError"); return get.call(this, ch); });
    const a = api(); tela(a); await screen.findByText(mensagem); expect(a.registrar).not.toHaveBeenCalled();
    falha = false; fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByRole("button", { name: "ler produto fictício" }); expect(a.estado).toHaveBeenCalledOnce(); expect(a.registrar).not.toHaveBeenCalled();
  });
  it("falha depois de abrir, antes de gravar a intenção: bloqueia sem enviar nem perder carrinho", async () => {
    const k = await key(); const a = api(); tela(a);
    fireEvent.click(await screen.findByRole("button", { name: "ler produto fictício" }));
    fireEvent.click(screen.getByRole("button", { name: /Receber R\$/ })); fireEvent.click(await screen.findByRole("button", { name: /Pix/ }));
    const original = "{fila alterada"; localStorage.setItem(k, original);
    fireEvent.click(screen.getByRole("button", { name: /Finalizar venda/ })); await screen.findByText(mensagem);
    expect(a.registrar).not.toHaveBeenCalled(); expect(localStorage.getItem(k)).toBe(original);
    const rascunho = Object.entries(localStorage).find(([ch]) => ch.startsWith("omni.caixa.rascunho.v1:"));
    expect(JSON.parse(rascunho![1]).carrinho[0].qtd).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" })); await screen.findByText(mensagem); expect(a.registrar).not.toHaveBeenCalled();
  });
  it("resposta do banco seguida de falha na leitura: não anuncia conclusão; recuperação repete o mesmo envio", async () => {
    const k = await key(); let responder!: (r: ResultadoCaixa) => void; const a = api({ registrar: vi.fn(() => new Promise<ResultadoCaixa>(r => { responder = r; })) });
    tela(a); fireEvent.click(await screen.findByRole("button", { name: "ler produto fictício" }));
    fireEvent.click(screen.getByRole("button", { name: /Receber R\$/ })); fireEvent.click(await screen.findByRole("button", { name: /Pix/ }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar venda/ })); await screen.findByText("Confirmando venda…");
    const original = localStorage.getItem(k)!; const enviada = vi.mocked(a.registrar).mock.calls[0]![1];
    const get = Storage.prototype.getItem; let falha = true;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, ch) { if (ch === k && falha) throw new DOMException("negado", "SecurityError"); return get.call(this, ch); });
    responder({ situacao: "registrada", numero: 7, troco: 0, semCadastro: 0 });
    await screen.findByText(mensagem); expect(screen.queryByText("Venda finalizada")).toBeNull(); expect(get.call(localStorage, k)).toBe(original);
    expect(a.registrar).toHaveBeenCalledOnce();
    falha = false; fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Conferir envio" }));
    await waitFor(() => expect(a.registrar).toHaveBeenCalledTimes(2));
    expect(vi.mocked(a.registrar).mock.calls[1]![1]).toEqual(enviada);
    responder({ situacao: "repetida", numero: 7, troco: 0, semCadastro: 0 }); await screen.findByText("Venda finalizada");
    expect(localStorage.getItem(k)).toBeNull(); expect(a.registrar).toHaveBeenCalledTimes(2);
  });
});
