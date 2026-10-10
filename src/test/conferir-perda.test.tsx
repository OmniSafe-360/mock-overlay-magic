import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConferirDeposito, totalConferido, type ApiConferir } from "@/components/ConferirDeposito";
import { RegistrarPerda, type ApiPerda } from "@/components/RegistrarPerda";
import { AppFuncionario } from "@/components/AppFuncionario";
import type { InicioFuncionario, ItemConferencia } from "@/lib/banco";
import type { ProdutoFunc } from "@/lib/recebimento";

vi.mock("@/components/Scanner", () => ({
  Scanner: ({ onCode }: { onCode: (c: string) => void }) => <button type="button" onClick={() => onCode("789")}>leitor falso</button>,
}));

const CH = "c".repeat(64);
const prod: ProdutoFunc = { produtoId: "p-arroz", variacaoId: null, embalagemId: null, nome: "Arroz 5 kg", unidade: "Unidade", codigo: "789", variacao: null,
  controlaValidade: false, pedeLote: false, embalagens: [] };
const itens: ItemConferencia[] = [
  { ...prod, embalagens: [{ id: "e1", tipo: "Fardo", quantidade: 6 }], local: "Prateleira 10", conferenciaId: null },
  { ...prod, produtoId: "p-tiss", nome: "Tiss", local: "Prateleira 2", conferenciaId: null },
];
function apiC(over: Partial<ApiConferir> = {}, tipo = "mercado", feitosHoje = 1) {
  return {
    lista: vi.fn(async () => ({ tipo, feitosHoje, meta: 5, produtos: itens })),
    contar: vi.fn(async () => ({ situacao: "concluida" as const })),
    buscar: vi.fn(async () => [prod]),
    ...over,
  } satisfies ApiConferir;
}

describe("Conferir depósito (funcionário)", () => {
  it("soma embalagens fechadas e soltas", () => {
    expect(totalConferido({ e1: "5" }, "3", [{ id: "e1", quantidade: 12 }], "Unidade")).toBe(63);
    expect(totalConferido({}, "1,5", [], "Kg")).toBe(1.5);
  });
  it("mostra o progresso do dia e a lista em ordem de lugar", async () => {
    render(<ConferirDeposito chave={CH} api={apiC()} onVoltar={() => {}} />);
    expect(await screen.findByText("1 de 5 conferidos hoje")).toBeTruthy();
    const botoes = screen.getAllByRole("button", { name: /Prateleira/ });
    expect(botoes.map((b) => b.textContent)).toEqual([expect.stringMatching(/^Tiss/), expect.stringMatching(/^Arroz/)]);
  });
  it("farmácia fala estoque", async () => {
    render(<ConferirDeposito chave={CH} api={apiC({}, "farmacia")} onVoltar={() => {}} />);
    expect(await screen.findByText("Conferir estoque")).toBeTruthy();
  });
  it("contagem cega: recontar começa do zero e depois conclui", async () => {
    const contar = vi.fn()
      .mockResolvedValueOnce({ situacao: "recontar", rodada: 2 })
      .mockResolvedValueOnce({ situacao: "concluida" });
    const a = apiC({ contar });
    render(<ConferirDeposito chave={CH} api={a} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Arroz 5 kg/ }));
    expect(screen.getByText("Quanto tem no depósito?")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Confirmar contagem/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Fardos fechados com 6"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Sem embalagem (unidades)"), { target: { value: "3" } });
    expect(screen.getByText("Total: 33 unidades")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar contagem/ }));
    await waitFor(() => expect(contar).toHaveBeenCalledWith(CH, expect.any(String), "p-arroz", null, 33));
    expect(await screen.findByText(/Contagem 2 de 3/)).toBeTruthy();
    expect((screen.getByLabelText("Sem embalagem (unidades)") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Sem embalagem (unidades)"), { target: { value: "33" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar contagem/ }));
    await waitFor(() => expect(contar).toHaveBeenCalledTimes(2));
    expect(contar.mock.calls[1]![1]).toBe(contar.mock.calls[0]![1]);
    expect(await screen.findByText(/Arroz 5 kg: conferido/)).toBeTruthy();
    expect(a.lista).toHaveBeenCalledTimes(2);
  });
  it("não tem nenhum manda zero; inconsistente avisa que o dono confere", async () => {
    const a = apiC({ contar: vi.fn(async () => ({ situacao: "inconsistente" as const })) });
    render(<ConferirDeposito chave={CH} api={a} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Tiss/ }));
    fireEvent.click(screen.getByRole("button", { name: /Não tem nenhum no depósito/ }));
    await waitFor(() => expect(a.contar).toHaveBeenCalledWith(CH, expect.any(String), "p-tiss", null, 0));
    expect(await screen.findByText(/não bateram. O dono vai conferir/)).toBeTruthy();
  });
  it("lista vazia depois de conferir tudo", async () => {
    render(<ConferirDeposito chave={CH} api={apiC({ lista: vi.fn(async () => ({ tipo: "mercado", feitosHoje: 5, meta: 5, produtos: [] })) })} onVoltar={() => {}} />);
    expect(await screen.findByText("Conferência de hoje feita!")).toBeTruthy();
  });
});

function apiP(over: Partial<ApiPerda> = {}) {
  return { buscar: vi.fn(async () => [prod, { ...prod, embalagemId: "e1" }]), registrar: vi.fn(async () => {}), ...over } satisfies ApiPerda;
}

describe("Registrar perda (funcionário)", () => {
  it("pede produto, lugar, motivo e quantidade; envia e recomeça", async () => {
    const a = apiP();
    render(<RegistrarPerda chave={CH} tipo="mercado" api={a} onVoltar={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Bipar produto/ }));
    fireEvent.click(screen.getByRole("button", { name: "leitor falso" }));
    expect(await screen.findByText("Arroz 5 kg")).toBeTruthy();
    const registrar = () => screen.getByRole("button", { name: /Registrar perda/ }) as HTMLButtonElement;
    expect(registrar().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Na gôndola" }));
    fireEvent.click(screen.getByRole("button", { name: /Quebrou ou estragou/ }));
    expect(registrar().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Perdidos (unidades)"), { target: { value: "3" } });
    expect(registrar().disabled).toBe(false);
    fireEvent.click(registrar());
    await waitFor(() => expect(a.registrar).toHaveBeenCalledWith(CH, expect.objectContaining({
      produtoId: "p-arroz", variacaoId: null, area: "venda", quantidade: 3, motivo: "quebrou", observacao: "",
    })));
    expect(await screen.findByText(/Registrado! Arroz 5 kg: 3 unidades \(quebrou ou estragou\)/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Registrar perda/ })).toBeNull();
  });
  it("outro motivo exige escrever o que aconteceu; estoque na farmácia", async () => {
    const a = apiP();
    render(<RegistrarPerda chave={CH} tipo="farmacia" api={a} onVoltar={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Código de barras ou nome"), { target: { value: "arroz" } });
    fireEvent.click(screen.getByRole("button", { name: "Procurar" }));
    await screen.findByText("Arroz 5 kg");
    fireEvent.click(screen.getByRole("button", { name: "No estoque" }));
    fireEvent.click(screen.getByRole("button", { name: /Outro motivo/ }));
    fireEvent.change(screen.getByLabelText("Perdidos (unidades)"), { target: { value: "1" } });
    const btn = screen.getByRole("button", { name: /Registrar perda/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/obrigatório/), { target: { value: "Rato roeu" } });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(a.registrar).toHaveBeenCalledWith(CH, expect.objectContaining({ area: "deposito", motivo: "outro", observacao: "Rato roeu" })));
  });
  it("erro do banco aparece em português", async () => {
    const a = apiP({ registrar: vi.fn(async () => { throw new Error("pin_necessario"); }) });
    render(<RegistrarPerda chave={CH} tipo="mercado" api={a} onVoltar={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Bipar produto/ }));
    fireEvent.click(screen.getByRole("button", { name: "leitor falso" }));
    await screen.findByText("Arroz 5 kg");
    fireEvent.click(screen.getByRole("button", { name: "No depósito" }));
    fireEvent.click(screen.getByRole("button", { name: /Venceu/ }));
    fireEvent.change(screen.getByLabelText("Perdidos (unidades)"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /Registrar perda/ }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/digite seu PIN/);
  });
});

describe("tela inicial do app da equipe", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  it("tem Conferir depósito e Registrar perda para qualquer função", async () => {
    const inicio: InicioFuncionario = { nome: "Maria Souza", funcao: "receber", comercio: { nome: "Farmácia Vida", tipo: "farmacia" }, avisos: { entregas: 0, entregasHoje: 0, repor: 0 } };
    const api = {
      conferir: vi.fn(async () => "novo" as const), entrar: vi.fn(async () => CH), inicio: vi.fn(async () => inicio),
      sair: vi.fn(async () => {}), desbloquear: vi.fn(async () => {}),
      conferirDeposito: apiC({}, "farmacia"), perda: apiP(),
    };
    render(<AppFuncionario codigoInicial="255392" api={api} />);
    await screen.findByText("Agora crie seu PIN");
    for (const p of ["2580", "2580"]) for (const d of p) fireEvent.click(screen.getByRole("button", { name: d }));
    fireEvent.click(await screen.findByRole("button", { name: /Conferir estoque/ }));
    expect(await screen.findByText("1 de 5 conferidos hoje")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Início/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Registrar perda/ }));
    expect(await screen.findByText(/Sai do estoque agora/)).toBeTruthy();
  });
});
