import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReceberMercadoria, type ApiReceber } from "@/components/ReceberMercadoria";

const CHAVE = "c".repeat(64);
const entrega = { id: "pedido-1", numero: 1, fornecedor: "Monica Kazama", previsaoEntrega: null, produtos: 1, emContagem: false };
const vazio = { pedidos: [], fornecedores: [{ id: "f-1", nome: "Monica Kazama" }] };
const esperado = { ...vazio, pedidos: [entrega] };
function abrir(entregas: ApiReceber["entregas"]) {
  const api: ApiReceber = { entregas, abrir: vi.fn(), buscar: vi.fn(), enviar: vi.fn() };
  const tela = render(<ReceberMercadoria chave={CHAVE} onVoltar={vi.fn()} api={api} />);
  return { ...tela, api };
}
const concluir = async () => { await act(async () => {}); };

describe("atualização das entregas do Omni Operação", () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

  it("mostra um pedido enviado enquanto a lista estava aberta, sem reiniciar o aplicativo", async () => {
    const entregas = vi.fn().mockResolvedValueOnce(vazio).mockResolvedValue(esperado);
    const { api } = abrir(entregas); await concluir();
    expect(screen.getByText("Nenhuma entrega esperada agora.")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByRole("button", { name: /Monica Kazama.*Pedido nº 1/ })).toBeTruthy();
    expect(api.abrir).not.toHaveBeenCalled();
    expect(api.enviar).not.toHaveBeenCalled();
  });

  it.each(["online", "focus"])("busca novamente ao receber o evento %s", async (evento) => {
    const entregas = vi.fn().mockResolvedValueOnce(vazio).mockResolvedValue(esperado);
    abrir(entregas); await concluir();
    await act(async () => { window.dispatchEvent(new Event(evento)); });
    expect(screen.getByRole("button", { name: /Pedido nº 1/ })).toBeTruthy();
    expect(entregas).toHaveBeenCalledTimes(2);
  });

  it("permite atualizar imediatamente pelo botão da lista", async () => {
    const entregas = vi.fn().mockResolvedValueOnce(vazio).mockResolvedValue(esperado);
    abrir(entregas); await concluir();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar entregas" })); await concluir();
    expect(screen.getByRole("button", { name: /Pedido nº 1/ })).toBeTruthy();
  });

  it("não consulta em segundo plano e busca ao voltar para a tela", async () => {
    const entregas = vi.fn().mockResolvedValueOnce(vazio).mockResolvedValue(esperado);
    abrir(entregas); await concluir();
    try {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(entregas).toHaveBeenCalledTimes(1);
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
      expect(screen.getByRole("button", { name: /Pedido nº 1/ })).toBeTruthy();
      expect(entregas).toHaveBeenCalledTimes(2);
    } finally { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); }
  });

  it("não insiste sem internet e volta a consultar quando a conexão retorna", async () => {
    const entregas = vi.fn().mockResolvedValueOnce(vazio).mockResolvedValue(esperado);
    abrir(entregas); await concluir();
    const conectado = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(entregas).toHaveBeenCalledTimes(1);
      conectado.mockReturnValue(true);
      await act(async () => { window.dispatchEvent(new Event("online")); });
      expect(screen.getByRole("button", { name: /Pedido nº 1/ })).toBeTruthy();
    } finally { conectado.mockRestore(); }
  });

  it("preserva a lista anterior quando uma atualização falha e permite tentar de novo", async () => {
    const entregas = vi.fn().mockResolvedValueOnce(esperado).mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(vazio);
    abrir(entregas); await concluir();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar entregas" })); await concluir();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Pedido nº 1/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar entregas" })); await concluir();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: /Pedido nº 1/ })).toBeNull();
    expect(screen.getByText("Nenhuma entrega esperada agora.")).toBeTruthy();
  });

  it("recupera uma falha na consulta inicial pelo botão Atualizar", async () => {
    const entregas = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(esperado);
    abrir(entregas); await concluir();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Nenhuma entrega esperada agora.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar entregas" })); await concluir();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: /Pedido nº 1/ })).toBeTruthy();
  });

  it("não abre consultas simultâneas com botão, relógio e retorno ao app", async () => {
    let terminar!: (dados: typeof esperado) => void;
    const pendente = new Promise<typeof esperado>((resolve) => { terminar = resolve; });
    const entregas = vi.fn().mockResolvedValueOnce(vazio).mockReturnValue(pendente);
    abrir(entregas); await concluir();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar entregas" }));
    expect(screen.getByRole("button", { name: "Atualizar entregas" })).toBeDisabled();
    await act(async () => {
      window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(entregas).toHaveBeenCalledTimes(2);
    await act(async () => { terminar(esperado); });
    expect(screen.getByRole("button", { name: /Pedido nº 1/ })).toBeTruthy();
  });

  it("para as consultas ao sair da lista, inclusive se uma resposta chegar depois", async () => {
    let terminar!: (dados: typeof esperado) => void;
    const entregas = vi.fn(() => new Promise<typeof esperado>((resolve) => { terminar = resolve; }));
    const tela = abrir(entregas);
    tela.unmount();
    await act(async () => {
      terminar(esperado);
      window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(entregas).toHaveBeenCalledTimes(1);
  });

  it("uma resposta atrasada do acesso anterior não entra na lista do novo acesso", async () => {
    let terminar!: (dados: typeof esperado) => void;
    const entregas = vi.fn().mockImplementationOnce(() => new Promise<typeof esperado>((resolve) => { terminar = resolve; })).mockResolvedValue(esperado);
    const tela = abrir(entregas);
    tela.rerender(<ReceberMercadoria chave={"d".repeat(64)} onVoltar={vi.fn()} api={tela.api} />); await concluir();
    await act(async () => { terminar(vazio); });
    expect(screen.getByRole("button", { name: /Pedido nº 1/ })).toBeTruthy();
    expect(entregas.mock.calls.map(([chave]) => chave)).toEqual([CHAVE, "d".repeat(64)]);
  });
});
