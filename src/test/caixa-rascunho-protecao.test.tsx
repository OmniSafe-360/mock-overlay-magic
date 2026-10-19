import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CaixaCelular, type ApiCaixa } from "@/components/CaixaCelular";
import { itemDoProduto, type ProdutoCaixa } from "@/lib/caixa";
import { escopoAcesso } from "@/lib/operacaoLocal";
import type { EstadoCaixa } from "@/lib/banco";
vi.mock("@/components/LeitorContinuo", () => ({ LeitorContinuo: ({ onCode }: { onCode: (c: string) => void }) => <button onClick={() => onCode("789")}>ler produto fictício</button> }));
const chave = "e".repeat(64);
const produto: ProdutoCaixa = { id: "p-rascunho", nome: "Produto fictício", unidade: "Unidade", fracionado: false, preco: 500,
  codigos: [{ codigo: "789", variacaoId: null, embalagemId: null }], variacoes: [], embalagens: [], estoques: [{ variacaoId: null, quantidade: 10 }] };
const estado: EstadoCaixa = { nome: "Ana", comercio: { nome: "Mercado fictício", tipo: "mercado", endereco: null, telefone: null }, donoTemPin: true, vendas: [],
  turno: { id: "t-rascunho", abertoEm: new Date().toISOString(), trocoInicial: 0, vendas: 0, canceladas: 0, total: 0, porForma: { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 }, trocoDado: 0, sangrias: 0, dinheiroEsperado: 0 } };
function api(): ApiCaixa { return { estado: vi.fn(async () => estado), produtos: vi.fn(async () => [produto]), clientes: vi.fn(async () => []), foraEstoque: vi.fn(async () => []),
  abrir: vi.fn(async () => estado.turno!), conferir: vi.fn(async () => ({ situacao: "aprovada" as const })),
  registrar: vi.fn(async () => ({ situacao: "registrada" as const, numero: 1, troco: 0, semCadastro: 0 })) }; }
async function key() { return `omni.caixa.rascunho.v1:${await escopoAcesso(chave)}`; }
const raw = () => JSON.stringify({ carrinho: [itemDoProduto("i", { produto, variacaoId: null, embalagemId: null }, "789")], pags: [], cliente: null, vendaId: "v-preservada" });
const montar = (a = api(), sair = vi.fn()) => ({ a, sair, tela: render(<CaixaCelular chave={chave} api={a} onSair={sair} mercado />) });
const aviso = () => screen.findByRole("heading", { name: "Não foi possível guardar o carrinho" });
beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
describe("rascunho: não perder silenciosamente o trabalho", () => {
  it.each(["{", "null", "{}", ""])('leitura inválida preserva o conteúdo e não abre operação: %s', async (original) => {
    const k = await key(); localStorage.setItem(k, original); const {a, sair} = montar();
    await screen.findByRole("heading", { name: "Não foi possível recuperar o carrinho" });
    expect(a.estado).not.toHaveBeenCalled(); expect(a.registrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Tentar de novo"}));
    await screen.findByRole("heading", { name: "Não foi possível recuperar o carrinho" }); expect(localStorage.getItem(k)).toBe(original);
    fireEvent.click(screen.getByRole("button", {name: "Voltar ao início"})); expect(sair).toHaveBeenCalledOnce(); expect(localStorage.getItem(k)).toBe(original);
  });
  it("leitura negada recupera o carrinho já salvo sem substituí-lo pelo vazio", async () => {
    const k = await key(); localStorage.setItem(k, raw()); const get = Storage.prototype.getItem; let falha = true;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, ch) {if (ch === k && falha) throw new DOMException("negado", "SecurityError"); return get.call(this,ch);});
    montar(); await screen.findByRole("heading", {name: "Não foi possível recuperar o carrinho"}); expect(get.call(localStorage,k)).toBe(raw());
    falha=false; fireEvent.click(screen.getByRole("button",{name:"Tentar de novo"}));
    await screen.findByLabelText("Quantidade de Produto fictício"); expect(JSON.parse(localStorage.getItem(k)!).vendaId).toBe("v-preservada");
  });
  it.each(["quota", "silenciosa"])("falha %s ao gravar: aviso, mesmo carrinho/ID, recuperação sem recarregar", async (modo) => {
    const k = await key(); const set=Storage.prototype.setItem; let falha=true;
    vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this: Storage,ch,v){if(ch===k && falha){if(modo==='quota')throw new DOMException('cheio','QuotaExceededError');return;}set.call(this,ch,v);});
    const {a}=montar(); fireEvent.click(await screen.findByRole("button",{name:"ler produto fictício"})); await aviso();
    expect(a.registrar).not.toHaveBeenCalled(); expect(a.conferir).not.toHaveBeenCalled(); expect(screen.queryByRole('button',{name:/Receber R\$/})).toBeNull();
    const evt=new Event('beforeunload',{cancelable:true});window.dispatchEvent(evt);expect(evt.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Tentar de novo'}));await aviso();expect(a.estado).toHaveBeenCalledOnce();
    falha=false;fireEvent.click(screen.getByRole('button',{name:'Tentar de novo'}));
    await screen.findByLabelText('Quantidade de Produto fictício');expect(screen.getByLabelText('Quantidade de Produto fictício')).toHaveTextContent('1');
    const salvo=JSON.parse(localStorage.getItem(k)!);expect(salvo.carrinho[0].qtd).toBe(1);expect(salvo.carrinho[0].preco).toBe(500);
    expect(a.estado).toHaveBeenCalledOnce();expect(a.registrar).not.toHaveBeenCalled();
    const evt2=new Event('beforeunload',{cancelable:true});window.dispatchEvent(evt2);expect(evt2.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:/Receber R\$/}));fireEvent.click(await screen.findByRole('button',{name:/Pix/}));
    fireEvent.click(screen.getByRole('button',{name:/Finalizar venda/}));await screen.findByText('Venda finalizada');
    expect(vi.mocked(a.registrar).mock.calls[0]![1].id).toBe(salvo.vendaId);expect(a.registrar).toHaveBeenCalledOnce();
  });
  it("tentativa de sair exige confirmação e cancelar mantém o trabalho", async () => {
    const k=await key(); const set=Storage.prototype.setItem;
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,ch,v){if(ch===k)throw new DOMException('cheio','QuotaExceededError');set.call(this,ch,v);});
    const {sair}=montar();fireEvent.click(await screen.findByRole('button',{name:'ler produto fictício'}));await aviso();
    const confirmar=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getByRole('button',{name:'Voltar ao início'}));
    expect(sair).not.toHaveBeenCalled();expect(confirmar).toHaveBeenCalledOnce();expect(screen.getByRole('heading',{name:'Não foi possível guardar o carrinho'})).toBeInTheDocument();
    confirmar.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Voltar ao início'}));expect(sair).toHaveBeenCalledOnce();
  });
  it("falha ao guardar pagamento mantém a forma e o ID após repetir", async () => {
    const k=await key();const {a}=montar();fireEvent.click(await screen.findByRole('button',{name:'ler produto fictício'}));
    const id=JSON.parse(localStorage.getItem(k)!).vendaId;fireEvent.click(screen.getByRole('button',{name:/Receber R\$/}));await screen.findByRole('button',{name:/Pix/});
    const set=Storage.prototype.setItem;let falha=true;
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,ch,v){if(ch===k&&falha)throw new DOMException('cheio','QuotaExceededError');set.call(this,ch,v);});
    fireEvent.click(screen.getByRole('button',{name:/Pix/}));await aviso();expect(a.registrar).not.toHaveBeenCalled();
    falha=false;fireEvent.click(screen.getByRole('button',{name:'Tentar de novo'}));await screen.findByRole('button',{name:/Finalizar venda/});
    const salvo=JSON.parse(localStorage.getItem(k)!);expect(salvo.vendaId).toBe(id);expect(salvo.pags).toEqual([{forma:'pix',valor:500}]);
  });
  it.each(['erro','silenciosa'])("limpeza %s depois de venda confirmada não vira nova venda nem apaga a confirmação",async(modo)=>{
    const k=await key();const {a}=montar();fireEvent.click(await screen.findByRole('button',{name:'ler produto fictício'}));
    fireEvent.click(screen.getByRole('button',{name:/Receber R\$/}));fireEvent.click(await screen.findByRole('button',{name:/Pix/}));
    const original=localStorage.getItem(k);const remove=Storage.prototype.removeItem;let falha=true;
    vi.spyOn(Storage.prototype,'removeItem').mockImplementation(function(this:Storage,ch){if(ch===k&&falha){if(modo==='erro')throw new DOMException('negado','SecurityError');return;}remove.call(this,ch);});
    fireEvent.click(screen.getByRole('button',{name:/Finalizar venda/}));await aviso();await screen.findByText('A última venda foi confirmada. Não a registre novamente.');
    expect(localStorage.getItem(k)).toBe(original);expect(a.registrar).toHaveBeenCalledOnce();
    falha=false;fireEvent.click(screen.getByRole('button',{name:'Tentar de novo'}));await screen.findByText('Venda finalizada');expect(localStorage.getItem(k)).toBeNull();expect(a.registrar).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button',{name:'Próxima venda'}));await screen.findByText('Bipe o primeiro produto');
  });
  it("rascunho normal recupera itens, valor, cliente, pagamento e mesmo ID após remontar", async()=>{
    const k=await key();const cliente={id:'cli',nome:'Cliente fictício',telefone:null,novo:false};
    const original={...JSON.parse(raw()),cliente,pags:[{forma:'pix',valor:500}]};localStorage.setItem(k,JSON.stringify(original));
    const {tela}=montar();await screen.findByLabelText('Quantidade de Produto fictício');expect(JSON.parse(localStorage.getItem(k)!)).toEqual(original);
    tela.unmount();montar();await screen.findByLabelText('Quantidade de Produto fictício');expect(JSON.parse(localStorage.getItem(k)!)).toEqual(original);
  });
});
