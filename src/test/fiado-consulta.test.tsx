import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PainelFiado, type ApiFiado } from "@/components/PainelFiado";

// Isola o painel da consulta real feita pelo controle da página do cliente.
vi.mock("@/lib/fiadoCliente", async (original) => ({
  ...await original<typeof import("@/lib/fiadoCliente")>(),
  acessoInfo: vi.fn().mockResolvedValue({ temLink: false, temPin: false, ultimoAcesso: null }),
}));

const cliente = { id: "cliente-a", nome: "Ana", telefone: null, ativo: true, criadoEm: "2026-10-10T12:00:00Z" };
const compra = { id: "compra", clienteId: cliente.id, tipo: "compra" as const, valor: 10000, vendaNumero: 1, forma: null, observacao: null, criadoEm: "2026-10-11T12:00:00Z" };
const dados = { clientes: [cliente], movimentos: [compra] };
const pago = { ...dados, movimentos: [compra, { ...compra, id: "pagamento", tipo: "pagamento" as const, valor: 2000 }] };
const vazio = { clientes: [], movimentos: [] };
type DadosFiado = Awaited<ReturnType<ApiFiado["carregar"]>>;
function pendente<T>() {
  let resolve!: (valor: T) => void;
  let reject!: (erro: unknown) => void;
  const promise = new Promise<T>((ok, falhou) => { resolve = ok; reject = falhou; });
  return { promise, resolve, reject };
}
function criarApi(): ApiFiado {
  return { carregar: vi.fn().mockResolvedValue(dados), receber: vi.fn().mockResolvedValue(undefined), salvarCliente: vi.fn().mockResolvedValue(undefined) };
}
const painel = (api: ApiFiado, atualizadoEm = 1, comercioId = "loja-a") => <PainelFiado comercioId={comercioId} comercioNome={comercioId} api={api} atualizadoEm={atualizadoEm} />;
const quadro = () => screen.getByRole("button", { name: /Fiado · a receber/ });
async function abrirConta() {
  fireEvent.click(await screen.findByRole("button", { name: /Fiado · a receber/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Ana/ }));
}

describe("R03: consulta do fiado", () => {
  it("primeira consulta falha sem inventar zero; nova tentativa confirma ausência de clientes", async () => {
    const api = criarApi();
    vi.mocked(api.carregar).mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce(vazio);
    render(painel(api));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Não foi possível consultar o fiado/);
    expect(screen.queryByRole("button", { name: /Fiado · a receber/ })).toBeNull();
    expect(screen.queryByText("Ninguém devendo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Fiado" })).toBeNull());
    expect(api.carregar).toHaveBeenCalledTimes(2);
    expect(api.receber).not.toHaveBeenCalled();
    expect(api.salvarCliente).not.toHaveBeenCalled();
  });

  it("tentativa pendente informa consulta e bloqueia cliques repetidos; primeiro cliente aparece", async () => {
    const api = criarApi(), consulta = pendente<DadosFiado>();
    vi.mocked(api.carregar).mockRejectedValueOnce(new Error("rede")).mockReturnValueOnce(consulta.promise);
    render(painel(api));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    const tentando = screen.getByRole("button", { name: "Consultando…" });
    expect(tentando).toBeDisabled(); fireEvent.click(tentando);
    expect(api.carregar).toHaveBeenCalledTimes(2);
    await act(async () => consulta.resolve(dados));
    expect(quadro().textContent).toMatch(/100,00/);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("atualização falha avisa na lista e na conta aberta; nova leitura atualiza sem perder o lugar", async () => {
    const api = criarApi();
    const { rerender } = render(painel(api));
    fireEvent.click(await screen.findByRole("button", { name: /Fiado · a receber/ }));
    vi.mocked(api.carregar).mockRejectedValueOnce(new Error("rede"));
    rerender(painel(api, 2));
    const lista = within(screen.getByRole("dialog", { name: "Fiado" }));
    expect((await lista.findByRole("alert")).textContent).toMatch(/última consulta/);
    fireEvent.click(lista.getByRole("button", { name: /Ana/ }));
    const conta = within(screen.getByRole("dialog", { name: "Ana" }));
    expect(conta.getByRole("alert").textContent).toMatch(/última consulta/);
    expect(conta.getByText("R$ 100,00")).toBeTruthy();
    vi.mocked(api.carregar).mockResolvedValueOnce(pago);
    fireEvent.click(conta.getByRole("button", { name: "Tentar de novo" }));
    expect(await conta.findByText("R$ 80,00")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(api.receber).not.toHaveBeenCalled();
  });

  it("resposta antiga não substitui a consulta mais recente", async () => {
    const api = criarApi(), antiga = pendente<DadosFiado>(), atual = pendente<DadosFiado>();
    const { rerender } = render(painel(api));
    await screen.findByRole("button", { name: /Fiado · a receber/ });
    vi.mocked(api.carregar).mockReturnValueOnce(antiga.promise).mockReturnValueOnce(atual.promise);
    rerender(painel(api, 2)); rerender(painel(api, 3));
    await act(async () => atual.resolve(pago));
    expect(quadro().textContent).toMatch(/80,00/);
    await act(async () => antiga.resolve(dados));
    expect(quadro().textContent).toMatch(/80,00/);
  });

  it("falha atrasada não acrescenta aviso depois de uma leitura nova aprovada", async () => {
    const api = criarApi(), antiga = pendente<DadosFiado>();
    const { rerender } = render(painel(api));
    await screen.findByRole("button", { name: /Fiado · a receber/ });
    vi.mocked(api.carregar).mockReturnValueOnce(antiga.promise).mockResolvedValueOnce(pago);
    rerender(painel(api, 2)); rerender(painel(api, 3));
    await waitFor(() => expect(quadro().textContent).toMatch(/80,00/));
    await act(async () => antiga.reject(new Error("rede")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(quadro().textContent).toMatch(/80,00/);
  });

  it("trocar comércio fecha a conta antiga e ignora sua leitura pendente", async () => {
    const api = criarApi(), antiga = pendente<DadosFiado>(), outra = pendente<DadosFiado>();
    const { rerender } = render(painel(api));
    await abrirConta(); fireEvent.click(screen.getByRole("button", { name: "Recebeu" }));
    vi.mocked(api.carregar).mockReturnValueOnce(antiga.promise).mockReturnValueOnce(outra.promise);
    rerender(painel(api, 2)); rerender(painel(api, 3, "loja-b"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: /Fiado · a receber/ })).toBeNull();
    await act(async () => antiga.resolve(dados));
    expect(screen.queryByRole("button", { name: /Fiado · a receber/ })).toBeNull();
    await act(async () => outra.resolve({ ...dados, movimentos: [{ ...compra, valor: 500 }] }));
    expect(quadro().textContent).toMatch(/5,00/);
    expect(api.carregar).toHaveBeenLastCalledWith("loja-b");
    expect(api.receber).not.toHaveBeenCalled();
  });

  it("pagamento salvo com consulta falha mantém confirmação e avisa saldo antigo; tentar ler não repete o pagamento", async () => {
    const api = criarApi(); render(painel(api)); await abrirConta();
    fireEvent.click(screen.getByRole("button", { name: "Recebeu" }));
    fireEvent.change(screen.getByLabelText("Quanto recebeu?"), { target: { value: "2000" } });
    vi.mocked(api.carregar).mockRejectedValueOnce(new Error("rede"));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar R\$\s20,00/ }));
    const conta = within(screen.getByRole("dialog", { name: "Ana" }));
    expect(await conta.findByText(/Recebido R\$\s20,00 de Ana/)).toBeTruthy();
    expect(conta.getByRole("alert").textContent).toMatch(/última consulta/);
    expect(conta.getByText("R$ 100,00")).toBeTruthy();
    vi.mocked(api.carregar).mockResolvedValueOnce(pago);
    fireEvent.click(conta.getByRole("button", { name: "Tentar de novo" }));
    expect(await conta.findByText("R$ 80,00")).toBeTruthy();
    expect(api.receber).toHaveBeenCalledTimes(1);
    expect(api.receber).toHaveBeenCalledWith(expect.any(String), cliente.id, 2000, "dinheiro", "");
    expect(conta.queryByRole("alert")).toBeNull();
  });

  it("cancelamento remove dívida ao atualizar; falha posterior sinaliza dados anteriores", async () => {
    const api = criarApi(); const { rerender } = render(painel(api));
    await screen.findByRole("button", { name: /Fiado · a receber/ });
    vi.mocked(api.carregar).mockResolvedValueOnce({ ...dados, movimentos: [compra, { ...compra, id: "cancelada", tipo: "cancelamento", valor: 10000 }] });
    rerender(painel(api, 2));
    expect(await screen.findByText("Ninguém devendo")).toBeTruthy();
    vi.mocked(api.carregar).mockRejectedValueOnce(new Error("rede")); rerender(painel(api, 3));
    expect((await screen.findByRole("alert")).textContent).toMatch(/última consulta/);
    expect(quadro().textContent).toMatch(/0,00/);
  });
});
