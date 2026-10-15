import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { CaixaCelular, type ApiCaixa } from "@/components/CaixaCelular";
import { AppFuncionario } from "@/components/AppFuncionario";
import { limiteCarrinho, itemDoProduto, montarVenda, filaCaixa, type ProdutoCaixa } from "@/lib/caixa";
import { escopoAcesso } from "@/lib/operacaoLocal";
import type { EstadoCaixa, ResultadoCaixa } from "@/lib/banco";
import { ehFalta } from "@/lib/antifurto";
import { resumoDiferencas, type Diferenca } from "@/lib/diferencas";
vi.mock("@/components/LeitorContinuo", () => ({ LeitorContinuo: ({ onCode }: { onCode: (c: string) => void }) => <button onClick={() => onCode("789")}>ler bala</button> }));
const chave = "a".repeat(64);
const produto: ProdutoCaixa = { id: "produto-c6", nome: "Bala de banana", unidade: "Unidade", fracionado: false, preco: 399,
 codigos: [{ codigo: "789", variacaoId: null, embalagemId: null }], variacoes: [], embalagens: [{ id: "e6", tipo: "Caixa", quantidade: 6 }], estoques: [{ variacaoId: null, quantidade: 5 }] };
const estado: EstadoCaixa = { nome: "Monica", comercio: { nome: "Mercado fictício", tipo: "mercado", endereco: null, telefone: null }, donoTemPin: true, vendas: [],
 turno: { id: "turno-c6", abertoEm: new Date().toISOString(), trocoInicial: 0, vendas: 0, canceladas: 0, total: 0, porForma: { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 }, trocoDado: 0, sangrias: 0, dinheiroEsperado: 0 } };
const bloqueada = { situacao: "bloqueada" as const, bloqueios: [{ nome: "Bala de banana", motivo: "estoque_insuficiente", contagemSolicitada: true, produtoId: produto.id, disponivel: 5 }] };
function api(extra: Partial<ApiCaixa> = {}): ApiCaixa {
 return { estado: vi.fn(async () => estado), produtos: vi.fn(async () => [produto]), clientes: vi.fn(async () => []), abrir: vi.fn(async () => estado.turno!),
 registrar: vi.fn(async () => ({ situacao: "registrada" as const, numero: 1, troco: 0, semCadastro: 0 })), conferir: vi.fn(async () => ({ situacao: "aprovada" as const })), ...extra };
}
const item = (qtd: number, emb: string | null = null, variacao: string | null = null) => itemDoProduto(`i-${qtd}-${emb}`, { produto, embalagemId: emb, variacaoId: variacao }, "789", qtd);
async function abrir(a: ApiCaixa) { const tela = render(<CaixaCelular chave={chave} api={a} onSair={() => {}} mercado />); await screen.findByRole("button", { name: "ler bala" }); return tela; }
async function pagar() { fireEvent.click(screen.getByRole("button", { name: /Receber R\$/ })); await screen.findByRole("button", { name: /Pix/ }); fireEvent.click(screen.getByRole("button", { name: /Pix/ })); fireEvent.click(screen.getByRole("button", { name: /Finalizar venda/ })); }
beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
it("soma linhas e embalagens; não usa outro produto ou variação como estoque", () => {
 expect(limiteCarrinho([item(5)], [produto])).toBeNull(); expect(limiteCarrinho([item(6)], [produto])).not.toBeNull();
 expect(limiteCarrinho([item(3),item(3)], [produto])).not.toBeNull(); expect(limiteCarrinho([item(1,"e6")], [produto])).not.toBeNull();
 const p = { ...produto, estoques: [{ variacaoId: "azul", quantidade: 5 }, { variacaoId: "verde", quantidade: 2 }] };
 expect(limiteCarrinho([item(3,null,"verde")], [p])).not.toBeNull(); expect(limiteCarrinho([item(5,null,"azul"),item(2,null,"verde")], [p])).toBeNull();
});
it("saldo desconhecido, cadastro e embalagem ausentes não autorizam venda", () => {
 expect(limiteCarrinho([item(1)], [{...produto,estoques:[{variacaoId:null,quantidade:null}]}])?.motivo).toMatch(/contada/);
 expect(limiteCarrinho([{...item(1),produtoId:null}], [produto])?.motivo).toMatch(/sem cadastro/);
 expect(limiteCarrinho([item(1,"removida")], [produto])?.motivo).toMatch(/embalagem/);
});
it("quantidade fracionada compara milésimos sem erro de ponto flutuante", () => {
 const p={...produto,unidade:"Kg",fracionado:true,estoques:[{variacaoId:null,quantidade:0.3}]};
 expect(limiteCarrinho([item(0.1),item(0.2)], [p])).toBeNull(); expect(limiteCarrinho([item(0.301)], [p])).not.toBeNull();
});
it("bip e Mais não passam de 5; excesso solicita contagem com ID estável", async () => {
 const a=api({conferir:vi.fn(async()=>bloqueada)});await abrir(a);
 for(let n=0;n<5;n++)fireEvent.click(screen.getByRole("button",{name:"ler bala"}));
 expect(screen.getByLabelText("Quantidade de Bala de banana")).toHaveTextContent("5");
 fireEvent.click(screen.getByRole("button",{name:"ler bala"})); await screen.findByText(/Contagem solicitada\./);
 expect(screen.getByLabelText("Quantidade de Bala de banana")).toHaveTextContent("5");
 expect(screen.getAllByRole("alert",{name:"Aviso de estoque"})).toHaveLength(1);
 expect(screen.getByRole("alert",{name:"Aviso de estoque"})).toHaveTextContent("5 unidades");
 expect(screen.queryByText(/venda bloqueada|não houve venda ou baixa/i)).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Mais Bala de banana"}));await waitFor(()=>expect(a.conferir).toHaveBeenCalledTimes(2));
 const calls=vi.mocked(a.conferir!).mock.calls;expect(calls[1]![1].id).toBe(calls[0]![1].id);expect(calls[0]![1].itens[0]!.qtd).toBe(6);expect(a.registrar).not.toHaveBeenCalled();
});
it("recusa na conferência antes do pagamento mantém carrinho", async () => {
 const a=api({conferir:vi.fn(async()=>bloqueada)});await abrir(a);fireEvent.click(screen.getByRole("button",{name:"ler bala"}));
 fireEvent.click(screen.getByRole("button",{name:/Receber R\$/}));await screen.findByText(/Contagem solicitada\./);
 expect(screen.queryByRole("button",{name:/Finalizar venda/})).toBeNull();expect(screen.getByLabelText("Quantidade de Bala de banana")).toHaveTextContent("1");expect(a.registrar).not.toHaveBeenCalled();
});
it("conferência pendente impede scanner e alteração de quantidade", async () => {
 let responder!:(r:{situacao:"aprovada"})=>void;
 const a=api({conferir:vi.fn(()=>new Promise<{situacao:"aprovada"}>(r=>responder=r))});await abrir(a);
 fireEvent.click(screen.getByRole("button",{name:"ler bala"}));
 fireEvent.click(screen.getByRole("button",{name:/Receber R\$/}));
 expect(screen.getByRole("button",{name:"Mais Bala de banana"})).toBeDisabled();
 fireEvent.click(screen.getByRole("button",{name:"ler bala"}));
 expect(screen.getByLabelText("Quantidade de Bala de banana")).toHaveTextContent("1");
 responder({situacao:"aprovada"});await screen.findByRole("button",{name:/Pix/});
 expect(a.conferir).toHaveBeenCalledTimes(1);
 expect(vi.mocked(a.conferir!).mock.calls[0]![1].itens[0]!.qtd).toBe(1);
});
it("só anuncia conclusão após confirmação; carrinho fica guardado durante envio", async () => {
 let terminar!:(r:ResultadoCaixa)=>void;const a=api({registrar:vi.fn(()=>new Promise<ResultadoCaixa>(r=>terminar=r))});await abrir(a);
 fireEvent.click(screen.getByRole("button",{name:"ler bala"}));await pagar();await screen.findByText("Confirmando venda…");
 expect(screen.queryByText("Venda finalizada")).toBeNull();expect(screen.getByRole("button",{name:"Conferir envio"})).toBeDisabled();
 const rascunho=Object.entries(localStorage).find(([k])=>k.startsWith("omni.caixa.rascunho"));expect(JSON.parse(rascunho![1]).carrinho[0].qtd).toBe(1);
 terminar({situacao:"registrada",numero:4,troco:0,semCadastro:0});await screen.findByText("Venda finalizada");
 expect(a.registrar).toHaveBeenCalledTimes(1);
});
it("saldo mudou entre conferir e finalizar: recusa sem apagar carrinho/pagamento", async () => {
 const a=api({registrar:vi.fn(async()=>bloqueada)});await abrir(a);fireEvent.click(screen.getByRole("button",{name:"ler bala"}));await pagar();
 await screen.findByText(/Contagem solicitada\./);expect(screen.queryByText("Venda finalizada")).toBeNull();expect(screen.getByRole("button",{name:/Finalizar venda/})).toBeEnabled();
 expect(Object.entries(localStorage).filter(([k])=>k.startsWith("omni.caixa.fila"))).toHaveLength(0);
 fireEvent.click(screen.getByRole("button",{name:"Voltar para a venda"}));expect(screen.getByLabelText("Quantidade de Bala de banana")).toHaveTextContent("1");
});
it("recusa definitiva do fiado libera revisão, sem venda guardada falsa", async () => {
 const a=api({registrar:vi.fn(async()=>{throw {code:"23514",message:"limite_fiado_excedido"};})});await abrir(a);fireEvent.click(screen.getByRole("button",{name:"ler bala"}));await pagar();
 await screen.findByText(/passa do limite de fiado/);expect(screen.queryByText("Venda finalizada")).toBeNull();expect(screen.getByRole("button",{name:/Finalizar venda/})).toBeEnabled();
});
it("sem internet mantém carrinho e não finaliza nova venda", async () => {
 vi.spyOn(navigator,"onLine","get").mockReturnValue(false);const a=api();await abrir(a);fireEvent.click(screen.getByRole("button",{name:"ler bala"}));fireEvent.click(screen.getByRole("button",{name:/Receber R\$/}));
 await screen.findByText(/Conecte à internet/);expect(a.registrar).not.toHaveBeenCalled();expect(a.conferir).not.toHaveBeenCalled();expect(screen.getByLabelText("Quantidade de Bala de banana")).toHaveTextContent("1");
});
it("resposta perdida e recarga conservam ID/conteúdo; repetida confirma uma vez", async () => {
 const a=api({registrar:vi.fn(async()=>{throw new TypeError("Failed to fetch");})});const tela=await abrir(a);fireEvent.click(screen.getByRole("button",{name:"ler bala"}));await pagar();await screen.findByText("Venda sem confirmação");
 const enviado=vi.mocked(a.registrar).mock.calls[0]![1];tela.unmount();
 const b=api({registrar:vi.fn(async()=>({situacao:"repetida" as const,numero:5,troco:0,semCadastro:0}))});render(<CaixaCelular chave={chave} api={b} onSair={()=>{}} />);
 await screen.findByText("Venda sem confirmação");expect(screen.queryByText("Venda finalizada")).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Conferir envio"}));await screen.findByText("Venda finalizada");
 expect(b.registrar).toHaveBeenCalledWith(chave,enviado);
});
it("resposta sem confirmação válida mantém envio incerto na fila", async () => {
 const a=api({registrar:vi.fn(async()=>{throw new Error("resposta_venda_invalida");})});await abrir(a);
 fireEvent.click(screen.getByRole("button",{name:"ler bala"}));await pagar();await screen.findByText("Venda sem confirmação");
 const guardada=filaCaixa(await escopoAcesso(chave)).ler()[0];
 expect(guardada?.confirmacaoPendente).toBe(true);expect(guardada?.problema).toBeUndefined();
 expect(screen.queryByText("Venda finalizada")).toBeNull();
});
it("fila antiga recusada por estoque é preservada para conciliação", async () => {
 const f=filaCaixa(await escopoAcesso(chave));const antiga={venda:montarVenda("v-antiga",estado.turno!.id,[item(7)],[{forma:"pix",valor:2793}],null),total:2793,troco:0,formas:"Pix"};f.por(antiga);
 const a=api({registrar:vi.fn(async()=>bloqueada)});await abrir(a);fireEvent.click(screen.getByRole("button",{name:"Enviar agora"}));
 await waitFor(()=>expect(f.ler()[0]?.problema).toMatch(/Contagem solicitada\./));expect(f.ler()).toHaveLength(1);expect(f.ler()[0]?.venda).toEqual(antiga.venda);expect(f.ler()[0]?.conciliacaoDono).toBe(true);
 f.tentarDeNovo(antiga.venda.id);expect(f.ler()[0]?.problema).toBeTruthy();expect(screen.queryByText("Venda finalizada")).toBeNull();
});
it("o início não retira envio novo antes da tela do caixa confirmar", async () => {
 localStorage.setItem("omni.funcionario.chave",chave);
 const f=filaCaixa(await escopoAcesso(chave));
 const v={venda:montarVenda("v-retomada",estado.turno!.id,[item(1)],[{forma:"pix",valor:399}],null),total:399,troco:0,formas:"Pix",confirmacaoPendente:true,
  comprovante:{comercio:{nome:"Mercado",endereco:null},numero:null,feitaEm:new Date().toISOString(),itens:[{descricao:"Bala",qtd:1,valor:399}],total:399,pagamentos:[{forma:"pix",valor:399}],troco:0,cliente:null}};
 f.por(v);const a=api();const app={inicio:vi.fn(async()=>({nome:"Monica",funcao:"ambos",caixa:true,comercio:{nome:"Mercado",tipo:"mercado"},avisos:{entregas:0,entregasHoje:0,repor:0}})),desbloquear:vi.fn(async()=>{}),caixa:a};
 render(<AppFuncionario api={app as never} />);await screen.findByText("Digite seu PIN");for(const n of "7391")fireEvent.click(screen.getByRole("button",{name:n}));
 fireEvent.click(await screen.findByRole("button",{name:/^Caixa/}));await screen.findByText("Venda sem confirmação");
 expect(a.registrar).not.toHaveBeenCalled();expect(f.ler()).toHaveLength(1);
 fireEvent.click(screen.getByRole("button",{name:"Conferir envio"}));await screen.findByText("Venda finalizada");expect(a.registrar).toHaveBeenCalledTimes(1);expect(f.ler()).toHaveLength(0);
});
it("envio automático do início conserva fila antiga bloqueada para o dono", async () => {
 localStorage.setItem("omni.funcionario.chave",chave);const f=filaCaixa(await escopoAcesso(chave));
 f.por({venda:montarVenda("v-legada-inicio",estado.turno!.id,[item(7)],[{forma:"pix",valor:2793}],null),total:2793,troco:0,formas:"Pix"});
 const a=api({registrar:vi.fn(async()=>bloqueada)});const app={inicio:vi.fn(async()=>({nome:"Monica",funcao:"ambos",caixa:true,comercio:{nome:"Mercado",tipo:"mercado"},avisos:{entregas:0,entregasHoje:0,repor:0}})),desbloquear:vi.fn(async()=>{}),caixa:a};
 render(<AppFuncionario api={app as never} />);await screen.findByText("Digite seu PIN");for(const n of "7391")fireEvent.click(screen.getByRole("button",{name:n}));
 await waitFor(()=>expect(f.ler()[0]?.conciliacaoDono).toBe(true));expect(f.ler()).toHaveLength(1);expect(f.ler()[0]?.problema).toMatch(/Contagem solicitada\./);
});
it("diferenças dos dois locais não viram perda total durante revisão ou com total preservado", () => {
 const d={diferenca:-2,valor:-800,motivo:null,origem:"conferencia_inconsistente",resolvida:true,criadaEm:"2026-10-12T12:00:00Z",situacao:"aberta"} as Diferenca;
 expect(ehFalta(d)).toBe(true);expect(ehFalta({...d,revisaoCaixaPendente:true})).toBe(false);expect(ehFalta({...d,saldoTotalPreservado:true})).toBe(false);
 expect(resumoDiferencas([{...d,saldoTotalPreservado:true}],[],"2026-10-12",()=>0).faltouMes).toBe(0);
});
