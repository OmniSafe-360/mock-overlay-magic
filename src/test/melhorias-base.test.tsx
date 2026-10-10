import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RegistrarPerda } from "@/components/RegistrarPerda";
import { useHoje } from "@/hooks/useHoje";
import { escopoAcesso, operacaoLocal } from "@/lib/operacaoLocal";
import { chaveRascunho, guardarRascunho, lerRascunho, type ProdutoFunc } from "@/lib/recebimento";

const arroz: ProdutoFunc = { produtoId: "p-auditado", variacaoId: null, embalagemId: null, nome: "Arroz auditado", unidade: "Unidade", codigo: "789", variacao: null, controlaValidade: false, pedeLote: false, embalagens: [] };
beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

it("perda sem resposta repete a intenção original após fechar, mesmo se o formulário mudou", async () => {
  const registrar = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(undefined);
  const api = { buscar: vi.fn().mockResolvedValue([arroz]), registrar };
  const tela = render(<RegistrarPerda chave="acesso-a" tipo="mercado" api={api} onVoltar={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText("Código de barras ou nome"), { target: { value: "arroz" } });
  fireEvent.click(screen.getByRole("button", { name: "Procurar" }));
  await screen.findByText("Arroz auditado");
  fireEvent.click(screen.getByRole("button", { name: "Na gôndola" }));
  fireEvent.click(screen.getByRole("button", { name: /Quebrou ou estragou/ }));
  fireEvent.change(screen.getByLabelText("Perdidos (unidades)"), { target: { value: "2" } });
  await waitFor(() => expect(screen.getByRole("button", { name: /Registrar perda/ })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: /Registrar perda/ }));
  await screen.findByRole("alert");
  fireEvent.change(screen.getByLabelText("Perdidos (unidades)"), { target: { value: "3" } });
  tela.unmount();
  render(<RegistrarPerda chave="acesso-a" tipo="mercado" api={api} onVoltar={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar envio pendente" }));
  expect(await screen.findByText(/Registrado! Arroz auditado: 2 unidades/)).toBeTruthy();
  expect(registrar).toHaveBeenCalledTimes(2);
  expect(registrar.mock.calls[1]![1]).toEqual(registrar.mock.calls[0]![1]);
  expect(localStorage.length).toBe(0);
});

it("uma recusa conclusiva libera uma nova intenção com outro id", async () => {
  const registro = operacaoLocal("teste", "perda", (p: unknown): p is { id: string; qtd: number } => !!p && typeof (p as { id?: string }).id === "string");
  await expect(registro.enviar(() => ({ id: "a", qtd: 2 }), async () => { throw { code: "23514", message: "quantidade_invalida" }; })).rejects.toMatchObject({ code: "23514" });
  const r = await registro.enviar(() => ({ id: "b", qtd: 3 }), async () => {});
  expect(r.pedido).toEqual({ id: "b", qtd: 3 });
  expect(r.recuperado).toBe(false);
});

it("rascunhos de recebimento sem pedido ficam separados por acesso, sem guardar a chave", async () => {
  const a = await escopoAcesso("chave-secreta-a"); const b = await escopoAcesso("chave-secreta-b");
  const r = { id: "entrega-a", pedidoId: null, fornecedorId: "fornecedor-a", contagens: {}, estados: {}, rodada: 0 };
  guardarRascunho(chaveRascunho(null, a), r);
  expect(lerRascunho(chaveRascunho(null, a))).toEqual(r);
  expect(lerRascunho(chaveRascunho(null, b))).toBeNull();
  expect(localStorage.key(0)).not.toContain("chave-secreta");
});

it("uma aba não sobrescreve o envio ainda pendente em outra", async () => {
  const validar = (p: unknown): p is { id: string } => !!p && typeof (p as { id?: string }).id === "string";
  const a = operacaoLocal("teste", "concorrencia", validar); const b = operacaoLocal("teste", "concorrencia", validar);
  await expect(a.enviar(() => ({ id: "a" }), async () => { throw new TypeError("Failed to fetch"); })).rejects.toThrow();
  const enviar = vi.fn();
  await expect(b.enviar(() => ({ id: "b" }), enviar)).rejects.toThrow(/armazenamento/);
  expect(enviar).not.toHaveBeenCalled();
});

it("o dia muda na tela aberta e ao voltar do segundo plano, sem mudar datas de validade", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-11T02:59:50Z"));
  function Tela() { return <p>{useHoje()}</p>; }
  render(<Tela />);
  expect(screen.getByText("2026-10-10")).toBeTruthy();
  act(() => { vi.advanceTimersByTime(30_000); });
  expect(screen.getByText("2026-10-11")).toBeTruthy();
  vi.setSystemTime(new Date("2026-10-12T03:00:00Z"));
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(screen.getByText("2026-10-12")).toBeTruthy();
});
