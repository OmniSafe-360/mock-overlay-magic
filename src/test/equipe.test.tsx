import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PainelEquipe, type ApiEquipe } from "@/components/PainelEquipe";
import { AppFuncionario, type ApiFuncionario } from "@/components/AppFuncionario";
import {
  codigoTexto, linkAcesso, lerChave, mensagemEntrada, nomeAparelho, pinFacil, quandoTexto, situacaoFuncionario, validadeCodigoTexto, type Funcionario,
} from "@/lib/funcionario";
import type { InicioFuncionario } from "@/lib/banco";

const agora = new Date("2026-10-09T15:00:00-03:00");
const func = (extra: Partial<Funcionario> = {}): Funcionario => ({
  id: "f1", nome: "Maria Souza", funcao: "ambos", codigo: "255392", codigoGeradoEm: new Date(agora.getTime() - 3600_000).toISOString(),
  primeiroAcessoEm: null, bloqueadoEm: null, ultimoAcesso: null, travadoAte: null, celulares: 0, ...extra,
});

describe("regras da equipe", () => {
  it("situação do funcionário", () => {
    expect(situacaoFuncionario(func(), agora.getTime())).toBe("aguardando");
    expect(situacaoFuncionario(func({ codigoGeradoEm: new Date(agora.getTime() - 49 * 3600_000).toISOString() }), agora.getTime())).toBe("expirado");
    expect(situacaoFuncionario(func({ primeiroAcessoEm: agora.toISOString() }), agora.getTime())).toBe("ativo");
    expect(situacaoFuncionario(func({ bloqueadoEm: agora.toISOString(), primeiroAcessoEm: agora.toISOString() }), agora.getTime())).toBe("bloqueado");
  });
  it("textos", () => {
    expect(codigoTexto("255392")).toBe("255 392");
    expect(linkAcesso("255392", "https://loja.app")).toBe("https://loja.app/funcionario?codigo=255392");
    expect(pinFacil("1111")).toBe(true);
    expect(pinFacil("1234")).toBe(true);
    expect(pinFacil("2580")).toBe(false);
    expect(quandoTexto(new Date(agora.getTime() - 30_000).toISOString(), agora)).toBe("agora há pouco");
    expect(quandoTexto(new Date(agora.getTime() - 5 * 60_000).toISOString(), agora)).toBe("há 5 min");
    expect(quandoTexto(new Date(agora.getTime() - 3 * 3600_000).toISOString(), agora)).toMatch(/^hoje às \d\d:\d\d$/);
    expect(validadeCodigoTexto({ codigoGeradoEm: new Date(agora.getTime() - 3600_000).toISOString() }, agora)).toMatch(/^até 11\/10 às \d\d:\d\d$/);
    expect(validadeCodigoTexto({ codigoGeradoEm: new Date(agora.getTime() - 30 * 3600_000).toISOString() }, agora)).toMatch(/^até amanhã às \d\d:\d\d$/);
    expect(nomeAparelho("Mozilla/5.0 (Linux; Android 14) Mobile")).toBe("Celular Android");
    expect(nomeAparelho("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("iPhone");
  });
  it("mensagens da entrada", () => {
    expect(mensagemEntrada(new Error("pin_errado:3"))).toBe("PIN errado. Você ainda tem 3 tentativas.");
    expect(mensagemEntrada(new Error("pin_errado:1"))).toMatch(/Falta 1 tentativa/);
    expect(mensagemEntrada(new Error("muitas_tentativas:15"))).toBe("Muitas tentativas erradas. Espere 15 minutos e tente de novo.");
    expect(mensagemEntrada(new Error("codigo_expirado"))).toMatch(/venceu/);
    expect(mensagemEntrada(new Error("Failed to fetch"))).toMatch(/Sem internet/);
  });
});

/* ---------- aba Equipe ---------- */
function apiEquipe(inicial: Funcionario[]) {
  let lista = [...inicial];
  const api = {
    carregar: vi.fn(async () => lista),
    criar: vi.fn(async (_c: string, nome: string, funcao: Funcionario["funcao"]) => { lista = [...lista, func({ id: "f9", nome, funcao, codigo: "481516", codigoGeradoEm: new Date().toISOString() })]; return { id: "f9", codigo: "481516" }; }),
    atualizar: vi.fn(async (id: string, nome: string, funcao: Funcionario["funcao"]) => { lista = lista.map((f) => (f.id === id ? { ...f, nome, funcao } : f)); }),
    bloquear: vi.fn(async (id: string, b: boolean) => { lista = lista.map((f) => (f.id === id ? { ...f, bloqueadoEm: b ? new Date().toISOString() : null, ...(b ? {} : { primeiroAcessoEm: null, codigo: "777001", codigoGeradoEm: new Date().toISOString() }) } : f)); return b ? null : "777001"; }),
    novoAcesso: vi.fn(async (id: string) => { lista = lista.map((f) => (f.id === id ? { ...f, primeiroAcessoEm: null, codigo: "990011", codigoGeradoEm: new Date().toISOString() } : f)); return "990011"; }),
  } satisfies ApiEquipe;
  render(<PainelEquipe comercioId="c1" comercioNome="Mercado Bom Preço" api={api} />);
  return api;
}

describe("aba Equipe (dono)", () => {
  it("vazia convida a adicionar; adicionar mostra o QR Code e o código", async () => {
    const api = apiEquipe([]);
    expect(await screen.findByText("Nenhum funcionário ainda")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar funcionário/ }));
    const dlg = within(screen.getByRole("dialog"));
    expect((dlg.getByRole("button", { name: /Adicionar e mostrar/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(dlg.getByPlaceholderText("Ex.: Maria Souza"), { target: { value: "João Lima" } });
    fireEvent.click(dlg.getByRole("button", { name: "Repõe gôndola" }));
    fireEvent.click(dlg.getByRole("button", { name: /Adicionar e mostrar/ }));
    await waitFor(() => expect(api.criar).toHaveBeenCalledWith("c1", "João Lima", "repor"));
    const det = within(await screen.findByRole("dialog", { name: "João Lima" }));
    expect(det.getByRole("img", { name: /QR Code de acesso de João Lima/ })).toBeTruthy();
    expect(det.getByText("481 516")).toBeTruthy();
    expect(det.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toMatch(/funcionario%3Fcodigo%3D481516/);
  });
  it("ativo: novo acesso e bloqueio pedem confirmação", async () => {
    const api = apiEquipe([func({ primeiroAcessoEm: new Date().toISOString(), ultimoAcesso: new Date().toISOString(), celulares: 1 })]);
    fireEvent.click(await screen.findByRole("button", { name: /Maria Souza, Ativo/ }));
    const det = within(screen.getByRole("dialog"));
    expect(det.getByText(/1 celular ligado/)).toBeTruthy();
    expect(det.queryByRole("img")).toBeNull();
    fireEvent.click(det.getByRole("button", { name: /trocou de celular/ }));
    fireEvent.click(det.getByRole("button", { name: "Confirmar novo acesso" }));
    await waitFor(() => expect(api.novoAcesso).toHaveBeenCalledWith("f1"));
    expect(await within(screen.getByRole("dialog")).findByText("990 011")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Bloquear" }));
    expect(api.bloquear).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar bloqueio" }));
    await waitFor(() => expect(api.bloquear).toHaveBeenCalledWith("f1", true));
    expect(await within(screen.getByRole("dialog")).findByText(/Ele não consegue entrar no app/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Desbloquear e gerar código/ }));
    await waitFor(() => expect(api.bloquear).toHaveBeenCalledWith("f1", false));
    expect(await within(screen.getByRole("dialog")).findByText("777 001")).toBeTruthy();
  });
  it("código vencido: gerar código novo", async () => {
    const api = apiEquipe([func({ codigoGeradoEm: new Date(Date.now() - 50 * 3600_000).toISOString() })]);
    fireEvent.click(await screen.findByRole("button", { name: /Código venceu/ }));
    fireEvent.click(screen.getByRole("button", { name: /Gerar código novo/ }));
    await waitFor(() => expect(api.novoAcesso).toHaveBeenCalledWith("f1"));
  });
  it("editar nome e função", async () => {
    const api = apiEquipe([func()]);
    fireEvent.click(await screen.findByRole("button", { name: /Maria Souza/ }));
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    const dlg = within(screen.getByRole("dialog"));
    fireEvent.change(dlg.getByDisplayValue("Maria Souza"), { target: { value: "Maria S. Lima" } });
    fireEvent.click(dlg.getByRole("button", { name: "Recebe mercadoria" }));
    fireEvent.click(dlg.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.atualizar).toHaveBeenCalledWith("f1", "Maria S. Lima", "receber"));
  });
});

/* ---------- app do funcionário ---------- */
const CHAVE = "c".repeat(64);
const inicio = (extra: Partial<InicioFuncionario> = {}): InicioFuncionario => ({
  nome: "Maria Souza", funcao: "ambos", comercio: { nome: "Mercado Bom Preço", tipo: "mercado" }, avisos: { entregas: 2, entregasHoje: 1, repor: 5 }, ...extra,
});
function apiFunc(over: Partial<ApiFuncionario> = {}) {
  return {
    conferir: vi.fn(async (_c: string): Promise<"novo" | "pin" | "expirado" | null> => "novo"),
    entrar: vi.fn(async (_c: string, _p: string, _a: string) => CHAVE),
    inicio: vi.fn(async (_c: string): Promise<InicioFuncionario | null> => inicio()),
    sair: vi.fn(async (_c: string) => {}),
    desbloquear: vi.fn(async (_c: string, _p: string) => {}),
    repor: { lista: vi.fn(async () => ({ tipo: "mercado", produtos: [] })), contar: vi.fn(), concluir: vi.fn(), buscar: vi.fn() },
    ...over,
  };
}
const digitar = (pin: string) => { for (const d of pin) fireEvent.click(screen.getByRole("button", { name: d })); };

describe("app do funcionário (Omni Operação)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  it("primeiro acesso pelo QR Code: cria o PIN (recusa fácil e diferente) e abre a tela inicial", async () => {
    const api = apiFunc();
    render(<AppFuncionario codigoInicial="255392" api={api} />);
    expect(await screen.findByText("Agora crie seu PIN")).toBeTruthy();
    expect(api.conferir).toHaveBeenCalledWith("255392");
    digitar("1111");
    expect(screen.getByRole("alert").textContent).toMatch(/fácil de adivinhar/);
    digitar("2580");
    expect(screen.getByText("Digite o PIN de novo para confirmar")).toBeTruthy();
    digitar("2581");
    expect(screen.getByRole("alert").textContent).toMatch(/não são iguais/);
    digitar("2580"); digitar("2580");
    await waitFor(() => expect(api.entrar).toHaveBeenCalledWith("255392", "2580", expect.any(String)));
    expect(await screen.findByText("Olá, Maria!")).toBeTruthy();
    expect(lerChave()).toBe(CHAVE);
    expect(screen.getByRole("button", { name: /Receber mercadoria/ }).textContent).toMatch(/1 entrega prevista para hoje/);
    expect(screen.getByRole("button", { name: /Repor gôndola/ }).textContent).toMatch(/5 produtos pedindo reposição/);
    fireEvent.click(screen.getByRole("button", { name: /Repor gôndola/ }));
    expect(await screen.findByText("Tudo abastecido!")).toBeTruthy();
  });
  it("digitar o código; PIN errado mostra quantas tentativas faltam", async () => {
    const api = apiFunc({ conferir: vi.fn(async () => "pin" as const), entrar: vi.fn(async () => { throw new Error("pin_errado:3"); }) });
    render(<AppFuncionario api={api} />);
    fireEvent.change(await screen.findByLabelText(/Digite o código/), { target: { value: "255 392" } });
    expect(await screen.findByText("Digite seu PIN")).toBeTruthy();
    digitar("2580");
    expect(await screen.findByText("PIN errado. Você ainda tem 3 tentativas.")).toBeTruthy();
    expect(lerChave()).toBeNull();
  });
  it("código não encontrado e código vencido", async () => {
    const api = apiFunc({ conferir: vi.fn(async (c: string) => (c === "111222" ? ("expirado" as const) : null)) });
    render(<AppFuncionario api={api} />);
    const campo = await screen.findByLabelText(/Digite o código/);
    fireEvent.change(campo, { target: { value: "999888" } });
    expect(await screen.findByText(/Código não encontrado/)).toBeTruthy();
    fireEvent.change(campo, { target: { value: "111222" } });
    expect(await screen.findByText(/Este código venceu/)).toBeTruthy();
  });
  it("celular já ligado pede o PIN ao abrir; só o botão da função dele", async () => {
    localStorage.setItem("omni.funcionario.chave", CHAVE);
    const api = apiFunc({ inicio: vi.fn(async () => inicio({ funcao: "repor", comercio: { nome: "Farmácia Vida", tipo: "farmacia" }, avisos: { entregas: 0, entregasHoje: 0, repor: 0 } })) });
    render(<AppFuncionario api={api} />);
    expect(await screen.findByText("Digite seu PIN")).toBeTruthy();
    expect(screen.getByText("Olá, Maria!")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Repor área de venda/ })).toBeNull();
    digitar("2580");
    await waitFor(() => expect(api.desbloquear).toHaveBeenCalledWith(CHAVE, "2580"));
    expect(await screen.findByRole("button", { name: /Repor área de venda/ })).toBeTruthy();
    expect(screen.getByText("Farmácia Vida")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Receber mercadoria/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Repor área de venda/ }).textContent).toMatch(/Tudo abastecido/);
  });
  it("PIN errado não abre; esqueci o PIN explica o que pedir ao dono", async () => {
    localStorage.setItem("omni.funcionario.chave", CHAVE);
    const api = apiFunc({ desbloquear: vi.fn(async () => { throw new Error("pin_errado:4"); }) });
    render(<AppFuncionario api={api} />);
    await screen.findByText("Digite seu PIN");
    digitar("9112");
    expect(await screen.findByText("PIN errado. Você ainda tem 4 tentativas.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Receber mercadoria/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Esqueci meu PIN" }));
    expect(screen.getByRole("status").textContent).toMatch(/Esqueceu o PIN ou trocou de celular/);
  });
  it("o banco pedindo o PIN (12 horas depois) também trava", async () => {
    localStorage.setItem("omni.funcionario.chave", CHAVE);
    const api = apiFunc({ inicio: vi.fn(async () => inicio({ pinNecessario: true })) });
    render(<AppFuncionario api={api} />);
    await screen.findByText("Digite seu PIN");
    vi.mocked(api.inicio).mockImplementation(async () => inicio());
    digitar("2580");
    expect(await screen.findByRole("button", { name: /Receber mercadoria/ })).toBeTruthy();
  });
  it("fora da tela por 5 minutos pede o PIN de novo", async () => {
    const api = apiFunc();
    render(<AppFuncionario codigoInicial="255392" api={api} />);
    await screen.findByText("Agora crie seu PIN");
    digitar("2580"); digitar("2580");
    expect(await screen.findByRole("button", { name: /Receber mercadoria/ })).toBeTruthy();
    const agora = Date.now();
    const visivel = (v: "hidden" | "visible") => { Object.defineProperty(document, "visibilityState", { value: v, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); };
    const spy = vi.spyOn(Date, "now");
    try {
      spy.mockReturnValue(agora); visivel("hidden");
      spy.mockReturnValue(agora + 60_000); visivel("visible");
      expect(screen.getByRole("button", { name: /Receber mercadoria/ })).toBeTruthy();
      spy.mockReturnValue(agora + 2 * 60_000); visivel("hidden");
      spy.mockReturnValue(agora + 8 * 60_000); visivel("visible");
      expect(await screen.findByText("Digite seu PIN")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Receber mercadoria/ })).toBeNull();
    } finally { spy.mockRestore(); Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); }
  });
  it("celular desligado pelo dono volta para o código com aviso", async () => {
    localStorage.setItem("omni.funcionario.chave", CHAVE);
    render(<AppFuncionario api={apiFunc({ inicio: vi.fn(async () => null) })} />);
    expect(await screen.findByText(/Este celular saiu do app/)).toBeTruthy();
    expect(lerChave()).toBeNull();
  });
  it("sair deste celular pede confirmação", async () => {
    localStorage.setItem("omni.funcionario.chave", CHAVE);
    const api = apiFunc();
    render(<AppFuncionario api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: /sair deste celular/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, sair" }));
    await waitFor(() => expect(api.sair).toHaveBeenCalledWith(CHAVE));
    expect(lerChave()).toBeNull();
    expect(await screen.findByLabelText(/Digite o código/)).toBeTruthy();
  });
});
