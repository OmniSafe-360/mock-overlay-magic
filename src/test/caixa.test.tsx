import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CaixaCelular, type ApiCaixa } from "@/components/CaixaCelular";
import { AppFuncionario } from "@/components/AppFuncionario";
import { aceitarLeitura } from "@/components/LeitorContinuo";
import type { EstadoCaixa, InicioFuncionario, TurnoCaixa } from "@/lib/banco";
import {
  acharPorCodigo, adicionar, atalhosDinheiro, enviarFila, erroCaixa, notaNaoAceitas, erroPinDono, filaCaixa, textoDiferencaCaixa, centavosDigitados, itemDoProduto, lerQuantidade, montarVenda, situacaoPagamento, totalCarrinho, variantesCodigo,
  type ProdutoCaixa,
} from "@/lib/caixa";

vi.mock("@/components/LeitorContinuo", async (orig) => ({
  ...(await orig<typeof import("@/components/LeitorContinuo")>()),
  LeitorContinuo: ({ onCode }: { onCode: (c: string) => void }) => (
    <div>
      <button type="button" onClick={() => onCode("7896263503203")}>ler tiss</button>
      <button type="button" onClick={() => onCode("2900000000018")}>ler fardo</button>
      <button type="button" onClick={() => onCode("7891234567895")}>ler desconhecido</button>
      <button type="button" onClick={() => onCode("2000000000015")}>ler queijo</button>
    </div>
  ),
}));

const CH = "c".repeat(64);
const tiss: ProdutoCaixa = { id: "p-tiss", nome: "Refrigerante Tiss", unidade: "Unidade", fracionado: false, preco: 349,
  codigos: [{ codigo: "7896263503203", variacaoId: null, embalagemId: null }], variacoes: [], embalagens: [] };
const cerveja: ProdutoCaixa = { id: "p-cerv", nome: "Cerveja", unidade: "Unidade", fracionado: false, preco: 490,
  codigos: [{ codigo: "0012345678905", variacaoId: null, embalagemId: null }, { codigo: "2900000000018", variacaoId: null, embalagemId: "e-fardo" }],
  variacoes: [], embalagens: [{ id: "e-fardo", tipo: "Fardo", quantidade: 12 }] };
const queijo: ProdutoCaixa = { id: "p-queijo", nome: "Queijo mussarela", unidade: "Kg", fracionado: true, preco: 3990,
  codigos: [{ codigo: "2000000000015", variacaoId: null, embalagemId: null }], variacoes: [], embalagens: [] };
const PRODUTOS = [tiss, cerveja, queijo].map((p) => ({ ...p, estoques: [{ variacaoId: null, quantidade: 100 }] }));

describe("regras do caixa", () => {
  it("fila de vendas guardadas: não duplica, para sem internet e separa a venda recusada", async () => {
    const mem = new Map<string, string>();
    const arm = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const f = filaCaixa("esc", arm);
    const g = (id: string) => ({ venda: montarVenda(id, "t1", [itemDoProduto("i", acharPorCodigo(PRODUTOS, "7896263503203")!, null)], [{ forma: "pix" as const, valor: 349 }], null), total: 349, troco: 0, formas: "Pix" });
    f.por(g("a")); f.por(g("a")); f.por(g("b")); f.por(g("c"));
    expect(f.ler().map((x) => x.venda.id)).toEqual(["a", "b", "c"]);
    const enviados: string[] = [];
    await expect(enviarFila(f, async (v) => { if (v.venda.id === "b") throw new Error("pagamento_menor_que_total"); if (v.venda.id === "c") throw new TypeError("Failed to fetch"); enviados.push(v.venda.id); })).rejects.toThrow();
    expect(enviados).toEqual(["a"]);
    expect(f.ler().map((x) => [x.venda.id, !!x.problema])).toEqual([["b", true], ["c", false]]);
    await enviarFila(f, async (v) => { enviados.push(v.venda.id); });
    expect(enviados).toEqual(["a", "c"]);
    expect(f.ler().map((x) => x.venda.id)).toEqual(["b"]);
    // "Tentar enviar de novo": a recusada volta para a fila e sobe se o banco aceitar.
    expect(notaNaoAceitas(f.ler()).replace(/\s/g, " ")).toBe("1 venda não aceita pelo Omni: R$ 3,49.");
    f.tentarDeNovo("b");
    expect(f.ler()[0]!.problema).toBeUndefined();
    await enviarFila(f, async (v) => { enviados.push(v.venda.id); });
    expect(f.ler()).toEqual([]);
  });
  it("anotação das vendas não aceitas conta o dinheiro que ficou na gaveta", () => {
    const v = (id: string, pags: { forma: "dinheiro" | "pix"; valor: number }[], total: number, troco: number) =>
      ({ venda: montarVenda(id, "t1", [itemDoProduto("i", acharPorCodigo(PRODUTOS, "7896263503203")!, null)], pags, null), total, troco, formas: "", problema: "x" });
    expect(notaNaoAceitas([v("a", [{ forma: "dinheiro", valor: 2000 }], 1500, 500), v("b", [{ forma: "pix", valor: 349 }], 349, 0)]).replace(/\s/g, " "))
      .toBe("2 vendas não aceitas pelo Omni: R$ 18,49 (R$ 15,00 em dinheiro na gaveta).");
    expect(notaNaoAceitas([])).toBe("");
  });
  it("textos do fechamento e do PIN do dono", () => {
    expect(textoDiferencaCaixa(0).texto).toBe("Bateu certinho");
    expect(textoDiferencaCaixa(-628).texto.replace(/\s/g, " ")).toBe("Faltaram R$ 6,28");
    expect(textoDiferencaCaixa(200).nivel).toBe("sobra");
    expect(erroPinDono(new Error("pin_errado:1"))).toMatch(/Falta 1 tentativa/);
    expect(erroPinDono(new Error("muitas_tentativas:15"))).toMatch(/Espere 15 minutos/);
    expect(erroPinDono(new Error("dono_sem_pin"))).toMatch(/ainda não criou o PIN/);
    // Sem internet: a mensagem diz o que não aconteceu (não fala em venda ao abrir, tirar dinheiro ou fechar).
    const rede = new TypeError("Failed to fetch");
    expect(erroCaixa(rede)).toBe("Sem internet. A venda não foi enviada: confira a conexão e toque em tentar de novo.");
    expect(erroCaixa(rede, "O caixa não foi aberto")).toBe("Sem internet. O caixa não foi aberto: confira a conexão e toque em tentar de novo.");
    expect(erroPinDono(rede, "O caixa não foi fechado")).toMatch(/^Sem internet. O caixa não foi fechado:/);
    expect(erroPinDono(rede, "O dinheiro tirado não foi registrado")).not.toMatch(/venda/);
    // Recusas definitivas (venda guardada que o Omni não aceitou) dizem o que fazer, sem "tente de novo".
    for (const c of ["item_invalido", "venda_invalida", "venda_sem_itens", "data_invalida", "produto_de_outro_comercio", "variacao_invalida", "embalagem_invalida",
      "turno_invalido", "turno_ja_fechado", "cliente_invalido", "fiado_sem_cliente", "pagamento_invalido", "troco_invalido", "id_obrigatorio"])
      expect(erroCaixa(new Error(c)), c).not.toMatch(/Tente de novo/i);
    expect(erroCaixa(new Error("turno_invalido"))).toBe("Este caixa já foi fechado. Volte ao início e abra o caixa de novo.");
  });
  it("acha o produto pelo código, também com UPC de 12 números e pela embalagem", () => {
    expect(variantesCodigo("012345678905")).toContain("0012345678905");
    expect(acharPorCodigo(PRODUTOS, "012345678905")?.produto.id).toBe("p-cerv");
    expect(acharPorCodigo(PRODUTOS, "2900000000018")?.embalagemId).toBe("e-fardo");
    expect(acharPorCodigo(PRODUTOS, "123")).toBeNull();
  });
  it("bipar de novo soma na mesma linha; fardo vale 12 unidades; pesado é linha nova", () => {
    const a = acharPorCodigo(PRODUTOS, "7896263503203")!;
    let c = adicionar([], itemDoProduto("1", a, "7896263503203"));
    c = adicionar(c, itemDoProduto("2", a, "7896263503203"));
    expect(c).toHaveLength(1);
    expect(c[0]!.qtd).toBe(2);
    c = adicionar(c, itemDoProduto("3", acharPorCodigo(PRODUTOS, "2900000000018")!, "2900000000018"));
    expect(c[1]!.preco).toBe(5880);
    expect(c[1]!.detalhe).toBe("Fardo com 12");
    const q = { produto: queijo, variacaoId: null, embalagemId: null };
    c = adicionar(adicionar(c, itemDoProduto("4", q, null, 0.35)), itemDoProduto("5", q, null, 0.2));
    expect(c).toHaveLength(4);
    expect(totalCarrinho(c)).toBe(698 + 5880 + 1397 + 798);
  });
  it("pagamento: só o dinheiro tem troco; Pix acima do total não fecha", () => {
    expect(situacaoPagamento(6578, [{ forma: "dinheiro", valor: 10000 }])).toMatchObject({ pago: 10000, falta: 0, troco: 3422, pronto: true });
    expect(situacaoPagamento(6578, [{ forma: "pix", valor: 7000 }]).pronto).toBe(false);
    expect(situacaoPagamento(6578, [{ forma: "dinheiro", valor: 2000 }]).falta).toBe(4578);
    expect(situacaoPagamento(0, []).pronto).toBe(false);
  });
  it("centavo de produto pesado arredonda igual ao banco", async () => {
    const { subtotal } = await import("@/lib/caixa");
    expect(subtotal({ qtd: 0.335, preco: 1999 })).toBe(670); // 669,665 → 670
    expect(subtotal({ qtd: 1.25, preco: 699 })).toBe(874); // 873,75
    expect(subtotal({ qtd: 0.5, preco: 1 })).toBe(1); // meio centavo sobe
  });
  it("atalhos de dinheiro, valor digitado e peso", () => {
    expect(atalhosDinheiro(6578)).toEqual([6578, 10000, 20000]);
    expect(atalhosDinheiro(1250)).toEqual([1250, 2000, 5000, 10000]);
    expect(centavosDigitados("R$ 12,50")).toBe(1250);
    expect(lerQuantidade("0,350")).toBe(0.35);
    expect(lerQuantidade("0,3505")).toBeNull();
    expect(lerQuantidade("0")).toBeNull();
  });
  it("a venda vai para o banco em reais, com o id gerado no celular", () => {
    const c = [itemDoProduto("1", acharPorCodigo(PRODUTOS, "7896263503203")!, "7896263503203", 2)];
    const v = montarVenda("v1", "t1", c, [{ forma: "dinheiro", valor: 1000 }], null, "2026-10-10T12:00:00Z");
    expect(v).toEqual({ id: "v1", turno_id: "t1", feita_em: "2026-10-10T12:00:00Z",
      itens: [{ produto_id: "p-tiss", variacao_id: null, embalagem_id: null, codigo: "7896263503203", descricao: null, qtd: 2, preco: 3.49 }],
      pagamentos: [{ forma: "dinheiro", valor: 10 }] });
  });
  it("a câmera não soma o mesmo código enquanto ele continua na frente", () => {
    expect(aceitarLeitura(null, "1", 0)).toBe(true);
    expect(aceitarLeitura({ codigo: "1", em: 0 }, "1", 800)).toBe(false);
    expect(aceitarLeitura({ codigo: "1", em: 0 }, "1", 1600)).toBe(true);
    expect(aceitarLeitura({ codigo: "1", em: 0 }, "2", 300)).toBe(false);
    expect(aceitarLeitura({ codigo: "1", em: 0 }, "2", 600)).toBe(true);
  });
});

const turno: TurnoCaixa = { id: "t1", abertoEm: "2026-10-10T11:00:00Z", trocoInicial: 10000, vendas: 0, canceladas: 0, total: 0,
  porForma: { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 }, trocoDado: 0, sangrias: 0, dinheiroEsperado: 10000 };
const estado = (aberto = true): EstadoCaixa => ({ nome: "Maria Souza", comercio: { nome: "Mercado São Judas", tipo: "mercado", telefone: null, endereco: null },
  donoTemPin: true, turno: aberto ? turno : null, vendas: [] });
function apiCaixa(over: Partial<ApiCaixa> = {}) {
  return {
    estado: vi.fn(async () => estado()),
    produtos: vi.fn(async () => PRODUTOS),
    clientes: vi.fn(async () => [{ id: "cli-1", nome: "João", telefone: null }]),
    abrir: vi.fn(async () => turno),
    registrar: vi.fn(async (_ch: string, v: ReturnType<typeof montarVenda>) => ({ situacao: "registrada" as const, numero: 7, troco: Math.round((v.pagamentos.reduce((t, p) => t + p.valor, 0) - v.itens.reduce((t, i) => t + Math.round(i.qtd * i.preco * 100) / 100, 0)) * 100), semCadastro: 0 })),
    ...over,
  } satisfies ApiCaixa;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const envios = (f: unknown) => (f as { mock: { calls: any[][] } }).mock.calls;
const carrinho = () => within(screen.getByRole("list", { name: "Produtos da venda" }));

describe("caixa no celular", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("abre o caixa com o troco da gaveta", async () => {
    const api = apiCaixa({ estado: vi.fn(async () => estado(false)) });
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.change(await screen.findByLabelText("Quanto tem de troco na gaveta?"), { target: { value: "15000" } });
    fireEvent.click(screen.getByRole("button", { name: /Abrir caixa/ }));
    await screen.findByText("Caixa aberto");
    expect(api.abrir).toHaveBeenCalledWith(CH, expect.any(String), 15000);
  });

  it("sem internet ao abrir o caixa não fala em venda", async () => {
    const api = apiCaixa({ estado: vi.fn(async () => estado(false)), abrir: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) });
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.change(await screen.findByLabelText("Quanto tem de troco na gaveta?"), { target: { value: "15000" } });
    fireEvent.click(screen.getByRole("button", { name: /Abrir caixa/ }));
    expect(await screen.findByText(/O caixa não foi aberto/)).toBeTruthy();
    expect(screen.queryByText(/A venda não foi enviada/)).toBeNull();
  });

  it("bipa, recebe em dinheiro com troco e finaliza", async () => {
    const api = apiCaixa();
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "ler tiss" }));
    fireEvent.click(screen.getByRole("button", { name: "ler tiss" }));
    fireEvent.click(screen.getByRole("button", { name: "ler fardo" }));
    expect(carrinho().getByLabelText("Quantidade de Refrigerante Tiss").textContent).toBe("2");
    expect(carrinho().getByText(/Fardo com 12/)).toBeTruthy();
    expect(screen.getByLabelText("Total da venda").textContent?.replace(/\s/g, " ")).toBe("R$ 65,78");
    fireEvent.click(screen.getByRole("button", { name: /Receber R\$\s65,78/ }));
    expect((screen.getByRole("button", { name: /Finalizar venda/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Dinheiro/ }));
    fireEvent.change(screen.getByLabelText("Quanto o cliente deu?"), { target: { value: "10000" } });
    expect(screen.getByText("R$ 34,22")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar venda/ }));
    await screen.findByText("Venda finalizada");
    expect(screen.getByText(/Venda nº 7/)).toBeTruthy();
    expect(screen.getAllByText("R$ 34,22").length).toBeGreaterThan(0);
    const venda = envios(api.registrar)[0]![1];
    expect(venda.turno_id).toBe("t1");
    expect(venda.itens).toEqual([
      expect.objectContaining({ produto_id: "p-tiss", qtd: 2, preco: 3.49 }),
      expect.objectContaining({ produto_id: "p-cerv", embalagem_id: "e-fardo", qtd: 1, preco: 58.8 }),
    ]);
    expect(venda.pagamentos).toEqual([{ forma: "dinheiro", valor: 100 }]);
    fireEvent.click(screen.getByRole("button", { name: /Mandar comprovante no WhatsApp/ }));
    fireEvent.change(screen.getByLabelText("WhatsApp do cliente"), { target: { value: "43999991234" } });
    const link = screen.getByRole("link", { name: /Abrir o WhatsApp/ }).getAttribute("href")!;
    expect(link).toMatch(/^https:\/\/wa\.me\/5543999991234\?text=/);
    expect(decodeURIComponent(link)).toMatch(/Comprovante de venda nº 7/);
    expect(decodeURIComponent(link)).toMatch(/Troco: R\$ 34,22/);
    fireEvent.click(screen.getAllByRole("button", { name: "Fechar" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Próxima venda/ }));
    expect(await screen.findByText("Bipe o primeiro produto")).toBeTruthy();
  });

  it("código sem cadastro não entra na venda; produto cadastrado por kg pede o peso", async () => {
    const api = apiCaixa();
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "ler desconhecido" }));
    expect(await screen.findByText(/não foi encontrado no caixa/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Produtos da venda" })).toBeNull();
    expect(screen.getByText(/Peça ao dono para verificar o cadastro/)).toBeTruthy();
    expect(screen.queryByLabelText("Preço de cada um")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    fireEvent.click(screen.getByRole("button", { name: "ler queijo" }));
    fireEvent.change(await screen.findByLabelText("Quanto pesou? (kg)"), { target: { value: "0,350" } });
    expect(screen.getByText("R$ 13,97")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Incluir" }));
    expect(screen.getByLabelText("Total da venda").textContent?.replace(/\s/g, " ")).toBe("R$ 13,97");
    fireEvent.click(screen.getByRole("button", { name: /Receber/ }));
    fireEvent.click(screen.getByRole("button", { name: /Pix/ }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar venda/ }));
    await screen.findByText("Venda finalizada");
    const venda = envios(api.registrar)[0]![1];
    expect(venda.itens).toHaveLength(1);
    expect(venda.itens[0]).toEqual(expect.objectContaining({ produto_id: "p-queijo", qtd: 0.35, preco: 39.9 }));
    expect(venda.pagamentos).toEqual([{ forma: "pix", valor: 13.97 }]);
  });

  it("fiado com cliente novo", async () => {
    const api = apiCaixa();
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "ler tiss" }));
    fireEvent.click(screen.getByRole("button", { name: /Receber/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fiado/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Cliente novo/ }));
    fireEvent.change(screen.getByPlaceholderText("Ex.: João da Silva"), { target: { value: "Ana Lima" } });
    fireEvent.change(screen.getByPlaceholderText("(43) 99999-9999"), { target: { value: "43999991234" } });
    fireEvent.click(screen.getByRole("button", { name: "Anotar no fiado" }));
    expect(screen.getByText(/Fiado · Ana Lima/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Finalizar venda/ }));
    await screen.findByText("Venda finalizada");
    const venda = envios(api.registrar)[0]![1];
    expect(venda.cliente).toEqual({ id: expect.any(String), nome: "Ana Lima", telefone: "43999991234" });
    expect(venda.pagamentos).toEqual([{ forma: "fiado", valor: 3.49 }]);
  });

  it("perda de resposta mantém envio e carrinho sem anunciar conclusão; reenvia o mesmo ID", async () => {
    let falhar = true;
    const api = apiCaixa({ registrar: vi.fn(async () => { if (falhar) throw new TypeError("Failed to fetch"); return { situacao: "registrada" as const, numero: 8, troco: 0, semCadastro: 0 }; }) });
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "ler tiss" }));
    fireEvent.click(screen.getByRole("button", { name: /Receber/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cartão/ }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar venda/ }));
    await screen.findByText("Venda sem confirmação");
    expect(screen.queryByText("Venda finalizada")).toBeNull();
    expect(screen.queryByRole("button", { name: /Próxima venda/ })).toBeNull();
    const registros = Object.entries(localStorage).filter(([k]) => k.includes("omni.caixa.fila"));
    expect(JSON.parse(registros[0]![1])).toHaveLength(1);
    falhar = false;
    fireEvent.click(screen.getByRole("button", { name: "Conferir envio" }));
    await screen.findByText("Venda finalizada");
    const ids = envios(api.registrar).map((c) => c[1].id);
    expect(new Set(ids).size).toBe(1); expect(ids.length).toBe(2);
  });

  it("abre sem internet com o que ficou guardado no celular", async () => {
    const api = apiCaixa();
    const { unmount } = render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    await screen.findByRole("button", { name: "ler tiss" });
    unmount();
    const off = apiCaixa({ estado: vi.fn(async () => { throw new TypeError("Failed to fetch"); }), produtos: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) });
    render(<CaixaCelular chave={CH} api={off} onSair={() => {}} />);
    expect(await screen.findByText(/Sem internet: o carrinho fica guardado/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ler tiss" }));
    expect(screen.getByLabelText("Total da venda").textContent?.replace(/\s/g, " ")).toBe("R$ 3,49");
  });

  it("menu: cancelar venda com o PIN do dono, tirar dinheiro e fechar o caixa", async () => {
    const vendaFeita = { id: "v9", numero: 9, feitaEm: "2026-10-10T12:00:00Z", total: 698, situacao: "finalizada" as const, troco: 0, cliente: null,
      pagamentos: [{ forma: "pix", valor: 698 }], itens: [{ descricao: "Refrigerante Tiss", qtd: 2, valor: 698 }] };
    let pinCerto = false;
    const api = apiCaixa({
      estado: vi.fn(async () => ({ ...estado(), vendas: [vendaFeita] })),
      cancelar: vi.fn(async () => { if (!pinCerto) throw new Error("pin_errado:4"); return { situacao: "cancelada" as const, devolver: 0 }; }),
      sangria: vi.fn(async () => ({ ...turno, sangrias: 3000 })),
      fechar: vi.fn(async () => ({ ...turno, fechado: true, dinheiroEsperado: 13628, dinheiroContado: 13000, diferenca: -628 })),
    });
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Menu do caixa" }));
    fireEvent.click(screen.getByRole("button", { name: /Vendas deste caixa/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Venda nº 9/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar esta venda/ }));
    fireEvent.change(screen.getByLabelText("PIN do dono"), { target: { value: "1357" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/PIN do dono errado. Ainda tem 4 tentativas/);
    pinCerto = true;
    fireEvent.change(screen.getByLabelText("PIN do dono"), { target: { value: "2468" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText(/Venda nº 9 cancelada/)).toBeTruthy();
    expect(screen.queryByText(/Devolva/)).toBeNull(); // nada a devolver
    expect(api.cancelar).toHaveBeenLastCalledWith(CH, "v9", "2468", "");
    fireEvent.click(screen.getAllByRole("button", { name: "Fechar" })[0]!);

    fireEvent.click(screen.getByRole("button", { name: "Menu do caixa" }));
    fireEvent.click(screen.getByRole("button", { name: /Tirar dinheiro da gaveta/ }));
    fireEvent.change(screen.getByLabelText("Quanto vai tirar?"), { target: { value: "3000" } });
    fireEvent.change(screen.getByLabelText("PIN do dono"), { target: { value: "2468" } });
    fireEvent.click(screen.getByRole("button", { name: /Tirar R\$\s30,00/ }));
    expect(await screen.findByText(/Dinheiro tirado da gaveta/)).toBeTruthy();
    expect(api.sangria).toHaveBeenCalledWith(CH, expect.any(String), "t1", 3000, "", "2468");

    fireEvent.click(screen.getByRole("button", { name: "Menu do caixa" }));
    fireEvent.click(screen.getByRole("button", { name: /Fechar o caixa/ }));
    expect(screen.queryByText(/Deveria ter/)).toBeNull(); // conta sem ver o esperado
    fireEvent.change(screen.getByLabelText("Quanto tem na gaveta?"), { target: { value: "13000" } });
    fireEvent.click(screen.getByRole("button", { name: /Fechar o caixa/ }));
    fireEvent.click(screen.getByRole("button", { name: /Sim, fechar o caixa/ }));
    expect(await screen.findByText("Faltaram R$ 6,28")).toBeTruthy();
    expect(screen.getByText("Deveria ter na gaveta")).toBeTruthy();
    expect(api.fechar).toHaveBeenCalledWith(CH, "t1", 13000, "");
  });

  it("A5: cancelar venda fiado já paga avisa quanto devolver ao cliente", async () => {
    const vendaFiado = { id: "v7", numero: 7, feitaEm: "2026-10-10T12:00:00Z", total: 10000, situacao: "finalizada" as const, troco: 0, cliente: "João",
      pagamentos: [{ forma: "fiado", valor: 10000 }], itens: [{ descricao: "Arroz", qtd: 4, valor: 10000 }] };
    const api = apiCaixa({
      estado: vi.fn(async () => ({ ...estado(), vendas: [vendaFiado] })),
      cancelar: vi.fn(async () => ({ situacao: "cancelada" as const, devolver: 6000 })),
    });
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Menu do caixa" }));
    fireEvent.click(screen.getByRole("button", { name: /Vendas deste caixa/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Venda nº 7/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar esta venda/ }));
    fireEvent.change(screen.getByLabelText("PIN do dono"), { target: { value: "2468" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText(/Venda nº 7 cancelada/)).toBeTruthy();
    expect((await screen.findByRole("alert")).textContent?.replace(/\s/g, " ")).toBe("Devolva R$ 60,00 ao cliente: é o que ele já tinha pago desta venda no fiado.");
  });

  it("checklist 3 A5: a devolução sai da gaveta e o caixa diz que já foi descontada", async () => {
    const vendaFiado = { id: "v7", numero: 7, feitaEm: "2026-10-10T12:00:00Z", total: 10000, situacao: "finalizada" as const, troco: 0, cliente: "João",
      pagamentos: [{ forma: "fiado", valor: 10000 }], itens: [{ descricao: "Arroz", qtd: 4, valor: 10000 }] };
    const api = apiCaixa({
      estado: vi.fn(async () => ({ ...estado(), vendas: [vendaFiado] })),
      cancelar: vi.fn(async () => ({ situacao: "cancelada" as const, devolver: 6000, gaveta: true })),
    });
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Menu do caixa" }));
    fireEvent.click(screen.getByRole("button", { name: /Vendas deste caixa/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Venda nº 7/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar esta venda/ }));
    fireEvent.change(screen.getByLabelText("PIN do dono"), { target: { value: "2468" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText(/Venda nº 7 cancelada/)).toBeTruthy();
    expect((await screen.findByRole("alert")).textContent?.replace(/\s/g, " ")).toBe("Tire R$ 60,00 da gaveta e devolva ao cliente: é o que ele já tinha pago desta venda no fiado. Essa saída já foi descontada do caixa.");
  });

  it("o carrinho continua no celular se o app travar no meio da venda", async () => {
    const api = apiCaixa();
    const { unmount } = render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "ler tiss" }));
    unmount();
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText("Total da venda").textContent?.replace(/\s/g, " ")).toBe("R$ 3,49"));
  });
});

describe("tela inicial com o caixa", () => {
  it("Omni Caixa: depois do PIN abre direto no caixa", async () => {
    localStorage.setItem("omni.funcionario.chave", CH);
    const inicio: InicioFuncionario = { nome: "Maria Souza", funcao: "repor", caixa: true, comercio: { nome: "Mercado", tipo: "mercado" }, avisos: { entregas: 0, entregasHoje: 0, repor: 0 } };
    const api = { conferir: vi.fn(), entrar: vi.fn(), inicio: vi.fn(async () => inicio), sair: vi.fn(async () => {}), desbloquear: vi.fn(async () => {}), caixa: apiCaixa() };
    render(<AppFuncionario api={api as never} modoCaixa />);
    await screen.findByText("Digite seu PIN");
    for (const d of "2580") fireEvent.click(screen.getByRole("button", { name: d }));
    expect(await screen.findByText("Bipe o primeiro produto")).toBeTruthy();
  });
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  it("mostra o botão Caixa só para quem o dono liberou", async () => {
    const inicio: InicioFuncionario = { nome: "Maria Souza", funcao: "repor", caixa: true, comercio: { nome: "Mercado", tipo: "mercado" },
      avisos: { entregas: 0, entregasHoje: 0, repor: 0, caixaAberto: true } };
    const api = { conferir: vi.fn(async () => "novo" as const), entrar: vi.fn(async () => CH), inicio: vi.fn(async () => inicio),
      sair: vi.fn(async () => {}), desbloquear: vi.fn(async () => {}), caixa: apiCaixa() };
    render(<AppFuncionario codigoInicial="255392" api={api} />);
    await screen.findByText("Agora crie seu PIN");
    for (const p of ["2580", "2580"]) for (const d of p) fireEvent.click(screen.getByRole("button", { name: d }));
    fireEvent.click(await screen.findByRole("button", { name: /Caixa aberto · toque para vender/ }));
    expect(await screen.findByText("Bipe o primeiro produto")).toBeTruthy();
  });
});

describe("Equipe: ligar o caixa no celular", () => {
  it("o dono liga a função Caixa no detalhe do funcionário", async () => {
    const { PainelEquipe } = await import("@/components/PainelEquipe");
    let lista = [{ id: "f1", nome: "Maria Souza", funcao: "repor" as const, caixa: false, codigo: "255392", codigoGeradoEm: new Date().toISOString(),
      primeiroAcessoEm: new Date().toISOString(), bloqueadoEm: null, ultimoAcesso: null, travadoAte: null, celulares: 1 }];
    const caixa = vi.fn(async (_id: string, ligado: boolean) => { lista = [{ ...lista[0]!, caixa: ligado }]; });
    const api = { carregar: vi.fn(async () => lista), criar: vi.fn(), atualizar: vi.fn(), bloquear: vi.fn(), novoAcesso: vi.fn(), caixa };
    render(<PainelEquipe comercioId="c1" comercioNome="Mercado" api={api as never} />);
    fireEvent.click(await screen.findByRole("button", { name: /Maria Souza/ }));
    const chave = await screen.findByRole("switch", { name: "Caixa no celular" });
    expect(chave.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(chave);
    await waitFor(() => expect(screen.getByRole("switch", { name: "Caixa no celular" }).getAttribute("aria-checked")).toBe("true"));
    expect(caixa).toHaveBeenCalledWith("f1", true);
    expect(screen.getByText(/aparece o botão/)).toBeTruthy();
  });
});

describe("dono: PIN do caixa, fechamentos e cancelar venda do celular", () => {
  it("cria o PIN na Equipe (recusa PIN fácil e PINs diferentes)", async () => {
    const { PainelEquipe } = await import("@/components/PainelEquipe");
    const lista = [{ id: "f1", nome: "Maria Souza", funcao: "repor" as const, caixa: true, codigo: "255392", codigoGeradoEm: new Date().toISOString(),
      primeiroAcessoEm: new Date().toISOString(), bloqueadoEm: null, ultimoAcesso: null, travadoAte: null, celulares: 1 }];
    const definirPin = vi.fn(async () => {});
    const api = { carregar: vi.fn(async () => lista), criar: vi.fn(), atualizar: vi.fn(), bloquear: vi.fn(), novoAcesso: vi.fn(), temPin: vi.fn(async () => false), definirPin };
    render(<PainelEquipe comercioId="c1" comercioNome="Mercado" api={api as never} />);
    expect(await screen.findByText(/sem ele, a equipe não consegue cancelar/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Criar o PIN" }));
    fireEvent.change(screen.getByLabelText("Novo PIN (4 números)"), { target: { value: "1111" } });
    expect(screen.getByRole("alert").textContent).toMatch(/fácil de adivinhar/);
    fireEvent.change(screen.getByLabelText("Novo PIN (4 números)"), { target: { value: "2468" } });
    fireEvent.change(screen.getByLabelText("Digite de novo"), { target: { value: "2467" } });
    expect(screen.getByRole("alert").textContent).toMatch(/não são iguais/);
    fireEvent.change(screen.getByLabelText("Digite de novo"), { target: { value: "2468" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar o PIN" }));
    expect(await screen.findByText(/PIN salvo/)).toBeTruthy();
    expect(definirPin).toHaveBeenCalledWith("2468");
  });

  it("se não der para conferir o PIN, avisa e deixa tentar de novo", async () => {
    const { PainelEquipe } = await import("@/components/PainelEquipe");
    const lista = [{ id: "f1", nome: "Maria Souza", funcao: "repor" as const, caixa: true, codigo: "255392", codigoGeradoEm: new Date().toISOString(),
      primeiroAcessoEm: new Date().toISOString(), bloqueadoEm: null, ultimoAcesso: null, travadoAte: null, celulares: 1 }];
    const temPin = vi.fn().mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce(true);
    const api = { carregar: vi.fn(async () => lista), criar: vi.fn(), atualizar: vi.fn(), bloquear: vi.fn(), novoAcesso: vi.fn(), temPin, definirPin: vi.fn() };
    render(<PainelEquipe comercioId="c1" comercioNome="Mercado" api={api as never} />);
    expect(await screen.findByText(/Não foi possível conferir o seu PIN/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("button", { name: "Trocar o PIN" })).toBeTruthy();
    expect(screen.queryByText(/Não foi possível conferir o seu PIN/)).toBeNull();
  });

  it("Vendas mostra o fechamento com falta e o dono cancela uma venda do celular", async () => {
    const { PainelVendas } = await import("@/components/PainelVendas");
    const hoje = new Date().toISOString();
    const vendas = [{ id: "v1", caixaId: "cx", chave: null, numero: 3, emitidaEm: hoje, recebidaEm: hoje, total: 698, situacao: "finalizada" as const, canceladaEm: null,
      pagamentos: [{ forma: "dinheiro", valor: 1000 }], celular: true, troco: 302, turnoId: "t1", itens: [] }];
    const cancelarCelular = vi.fn(async () => ({ situacao: "cancelada" as const, devolver: 0 }));
    const conferirFechamento = vi.fn(async () => {});
    const api = {
      caixas: vi.fn(async () => [{ id: "cx", nome: "Celular · Maria", tipo: "celular" as const, codigo: null, codigoGeradoEm: null, ligadoEm: hoje, desligadoEm: null, ultimoContatoEm: hoje, ultimaVendaEm: hoje, aparelho: null }]),
      vendas: vi.fn(async () => vendas), criar: vi.fn(), renomear: vi.fn(), novoCodigo: vi.fn(), desligar: vi.fn(), pendentes: vi.fn(async () => []), resolver: vi.fn(),
      fechamentos: vi.fn(async () => [{ id: "t1", caixaId: "cx", funcionario: "Maria", abertoEm: hoje, fechadoEm: hoje, trocoInicial: 10000, esperado: 13628, contado: 13000,
        diferenca: -628, observacao: "faltou troco", conferidoEm: null, sangrias: 3000 }]),
      conferirFechamento, cancelarCelular,
    };
    render(<PainelVendas comercioId="c1" tipo="mercado" products={[]} api={api as never} />);
    expect(await screen.findByText("Faltaram R$ 6,28")).toBeTruthy();
    expect(screen.getByText(/Recado: "faltou troco"/)).toBeTruthy();
    expect(screen.getByText("Caixa no celular")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Já vi, tirar o alerta/ }));
    await waitFor(() => expect(conferirFechamento).toHaveBeenCalledWith("t1"));
    fireEvent.click(screen.getByRole("button", { name: /Venda 3/ }));
    expect(screen.getByText(/troco R\$\s3,02/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar esta venda/ }));
    fireEvent.click(screen.getByRole("button", { name: /Sim, cancelar a venda/ }));
    await waitFor(() => expect(cancelarCelular).toHaveBeenCalledWith("v1", ""));
    expect(await screen.findByText(/Venda nº 3 cancelada/)).toBeTruthy();
    expect(screen.queryByText(/Devolva/)).toBeNull();
  });
  it("A5: o dono cancela venda fiado já paga e vê quanto devolver", async () => {
    const { PainelVendas } = await import("@/components/PainelVendas");
    const hoje = new Date().toISOString();
    const vendas = [{ id: "v2", caixaId: "cx", chave: null, numero: 4, emitidaEm: hoje, recebidaEm: hoje, total: 5000, situacao: "finalizada" as const, canceladaEm: null,
      pagamentos: [{ forma: "fiado", valor: 5000 }], celular: true, troco: 0, turnoId: "t1", itens: [] }];
    const cancelarCelular = vi.fn(async () => ({ situacao: "cancelada" as const, devolver: 2050 }));
    const api = {
      caixas: vi.fn(async () => [{ id: "cx", nome: "Celular · Maria", tipo: "celular" as const, codigo: null, codigoGeradoEm: null, ligadoEm: hoje, desligadoEm: null, ultimoContatoEm: hoje, ultimaVendaEm: hoje, aparelho: null }]),
      vendas: vi.fn(async () => vendas), criar: vi.fn(), renomear: vi.fn(), novoCodigo: vi.fn(), desligar: vi.fn(), pendentes: vi.fn(async () => []), resolver: vi.fn(),
      fechamentos: vi.fn(async () => []), conferirFechamento: vi.fn(async () => {}), cancelarCelular,
    };
    render(<PainelVendas comercioId="c1" tipo="mercado" products={[]} api={api as never} />);
    fireEvent.click(await screen.findByRole("button", { name: /Venda 4/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar esta venda/ }));
    fireEvent.click(screen.getByRole("button", { name: /Sim, cancelar a venda/ }));
    expect((await screen.findByText(/Venda nº 4 cancelada/)).textContent?.replace(/\s/g, " "))
      .toMatch(/Devolva R\$ 20,50 ao cliente: é o que ele já tinha pago desta venda no fiado\./);
  });
  it("checklist 3 A6: o dono cancela com o caixa aberto e vê que o caixa foi avisado", async () => {
    const { PainelVendas } = await import("@/components/PainelVendas");
    const hoje = new Date().toISOString();
    const vendas = [{ id: "v2", caixaId: "cx", chave: null, numero: 4, emitidaEm: hoje, recebidaEm: hoje, total: 5000, situacao: "finalizada" as const, canceladaEm: null,
      pagamentos: [{ forma: "dinheiro", valor: 5000 }], celular: true, troco: 0, turnoId: "t1", itens: [] }];
    const cancelarCelular = vi.fn(async () => ({ situacao: "cancelada" as const, devolver: 0, caixaAberto: true, devolverGaveta: 5000 }));
    const api = {
      caixas: vi.fn(async () => [{ id: "cx", nome: "Celular · Maria", tipo: "celular" as const, codigo: null, codigoGeradoEm: null, ligadoEm: hoje, desligadoEm: null, ultimoContatoEm: hoje, ultimaVendaEm: hoje, aparelho: null }]),
      vendas: vi.fn(async () => vendas), criar: vi.fn(), renomear: vi.fn(), novoCodigo: vi.fn(), desligar: vi.fn(), pendentes: vi.fn(async () => []), resolver: vi.fn(),
      fechamentos: vi.fn(async () => []), conferirFechamento: vi.fn(async () => {}), cancelarCelular,
    };
    render(<PainelVendas comercioId="c1" tipo="mercado" products={[]} api={api as never} />);
    fireEvent.click(await screen.findByRole("button", { name: /Venda 4/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar esta venda/ }));
    fireEvent.click(screen.getByRole("button", { name: /Sim, cancelar a venda/ }));
    expect((await screen.findByText(/Venda nº 4 cancelada/)).textContent?.replace(/\s/g, " "))
      .toMatch(/O caixa foi avisado para tirar R\$ 50,00 da gaveta e devolver ao cliente\./);
  });
  it("checklist 3 A6: o caixa vê a venda cancelada pelo dono e marca que devolveu", async () => {
    localStorage.clear();
    const cancelada = { id: "v9", numero: 9, feitaEm: "2026-10-10T12:00:00Z", total: 2000, situacao: "cancelada" as const, troco: 1000, cliente: null,
      pagamentos: [{ forma: "dinheiro", valor: 3000 }], itens: [], canceladaPor: "dono" as const, devolverGaveta: 2000 };
    const api = apiCaixa({ estado: vi.fn(async () => ({ ...estado(), vendas: [cancelada] })) });
    const tela = render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    const aviso = await screen.findByText("O dono cancelou a venda nº 9. Tire R$ 20,00 da gaveta e devolva ao cliente.");
    expect(aviso).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Já devolvi" }));
    expect(screen.queryByText(/O dono cancelou a venda nº 9/)).toBeNull();
    tela.unmount();
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    await screen.findByRole("button", { name: "Menu do caixa" });
    expect(screen.queryByText(/O dono cancelou a venda nº 9/)).toBeNull();
  });
  it("falta de um fechamento antigo que o dono não viu continua aparecendo, sem total de vendas falso", async () => {
    const { PainelVendas } = await import("@/components/PainelVendas");
    const antigo = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const api = {
      caixas: vi.fn(async () => []), vendas: vi.fn(async () => []), criar: vi.fn(), renomear: vi.fn(), novoCodigo: vi.fn(), desligar: vi.fn(), pendentes: vi.fn(async () => []), resolver: vi.fn(),
      fechamentos: vi.fn(async () => [{ id: "t9", caixaId: "cx", funcionario: "João", abertoEm: antigo, fechadoEm: antigo, trocoInicial: 5000, esperado: 20000, contado: 18000,
        diferenca: -2000, observacao: null, conferidoEm: null, sangrias: 0 }]),
      conferirFechamento: vi.fn(async () => {}), cancelarCelular: vi.fn(),
    };
    render(<PainelVendas comercioId="c1" tipo="mercado" products={[]} api={api as never} />);
    expect(await screen.findByText("Faltaram R$ 20,00")).toBeTruthy();
    const card = screen.getByText("João").closest("li")!;
    expect(card.textContent).not.toMatch(/0 vendas/);
    expect(within(card).getByRole("button", { name: /Já vi, tirar o alerta/ })).toBeTruthy();
  });
});

/* F01: ponto decimal não pode multiplicar o peso por dez ou mil. */
describe("F01 — peso decimal do caixa", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it.each([
    ["1,5", 1.5], ["1.5", 1.5], ["0,350", 0.35], ["0.350", 0.35],
    ["1.000", 1], ["1000", 1000], ["100000", 100000],
  ])("interpreta %s como quantidade decimal %s", (texto, esperado) => {
    expect(lerQuantidade(texto)).toBe(esperado);
  });

  it.each(["", "0", "-1", "1e3", "NaN", "Infinity", "1.2345", "1,2345", "1.234,5", "1,234.5", "1..5", "100001"])
    ("recusa quantidade inválida %s", (texto) => expect(lerQuantidade(texto)).toBeNull());

  it.each(["1.5", "1,5"])("vende %s kg pelo mesmo preço e envia somente 1,5 kg", async (texto) => {
    const api = apiCaixa();
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "ler queijo" }));
    const peso = await screen.findByLabelText("Quanto pesou? (kg)");
    fireEvent.change(peso, { target: { value: texto } });
    expect((peso as HTMLInputElement).value).toBe("1,5");
    expect(screen.getByText("R$ 59,85")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Incluir" }));
    expect(screen.getByLabelText("Total da venda").textContent?.replace(/\s/g, " ")).toBe("R$ 59,85");
    expect(api.registrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Receber/ }));
    fireEvent.click(screen.getByRole("button", { name: /Pix/ }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar venda/ }));
    await screen.findByText("Venda finalizada");
    expect(api.registrar).toHaveBeenCalledTimes(1);
    const venda = envios(api.registrar)[0]![1];
    expect(venda.itens).toEqual([expect.objectContaining({ produto_id: "p-queijo", qtd: 1.5, preco: 39.9 })]);
    expect(venda.pagamentos).toEqual([{ forma: "pix", valor: 59.85 }]);
  });

  it.each(["-1", "1.234,5", "1e3"])("não inclui peso inválido %s no carrinho", async (texto) => {
    const api = apiCaixa();
    render(<CaixaCelular chave={CH} api={api} onSair={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "ler queijo" }));
    fireEvent.change(await screen.findByLabelText("Quanto pesou? (kg)"), { target: { value: texto } });
    const incluir = screen.getByRole("button", { name: "Incluir" });
    expect(incluir).toBeDisabled();
    fireEvent.click(incluir);
    expect(api.registrar).not.toHaveBeenCalled();
    expect(screen.queryByRole("list", { name: "Produtos da venda" })).toBeNull();
  });
});
