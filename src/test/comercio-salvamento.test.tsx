import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StoreSetup } from "@/components/StoreSetup";

const banco = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), insert: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: banco.getUser }, from: banco.from } }));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  banco.getUser.mockResolvedValue({ data: { user: { id: "dono-a" } }, error: null });
  banco.from.mockReturnValue({ insert: banco.insert }); banco.insert.mockReturnValue({ select: banco.select }); banco.select.mockReturnValue({ single: banco.single });
  banco.single.mockResolvedValue({ data: { id }, error: null });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP" }) })));
});
afterEach(() => vi.unstubAllGlobals());
function pendente<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
async function conferir(mode: "first" | "add" = "add") {
  const onFinish = vi.fn(), onCancel = vi.fn(); const tela = render(<StoreSetup mode={mode} userId="dono-a" onFinish={onFinish} onCancel={onCancel} />);
  fireEvent.click(screen.getByRole("button", { name: "Mercado" })); fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Nome do comércio"), { target: { value: "Mercado Conferido" } });
  fireEvent.click(screen.getByRole("radio", { name: "CPF" })); fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "52998224725" } });
  fireEvent.change(screen.getByLabelText("Telefone do comércio"), { target: { value: "11999998888" } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" })); fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001000" } });
  await screen.findByText(/Praça da Sé, Sé, São Paulo - SP/);
  fireEvent.change(screen.getByLabelText("Número"), { target: { value: "10" } }); fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByText("Confira os dados")).toBeInTheDocument();
  const enviar = () => fireEvent.submit(screen.getByRole("button", { name: "Cadastrar meu comércio" }).closest("form")!);
  return { ...tela, onFinish, onCancel, enviar };
}

it("salvando impede voltar, editar e cancelar para não perder ou trocar os dados enviados", async () => {
  const espera = pendente<unknown>(); banco.single.mockReturnValue(espera.promise);
  const tela = await conferir(); tela.enviar();
  await waitFor(() => expect(banco.insert).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  for (const b of screen.getAllByRole("button", { name: "Editar" })) { expect(b).toBeDisabled(); fireEvent.click(b); }
  expect(screen.getByText("Confira os dados")).toBeInTheDocument();
  const cancelar = screen.getByRole("button", { name: "Cancelar" }); expect(cancelar).toBeDisabled(); fireEvent.click(cancelar);
  expect(tela.onCancel).not.toHaveBeenCalled(); expect(tela.onFinish).not.toHaveBeenCalled();
  await act(async () => espera.resolve({ data: { id }, error: null }));
  expect(tela.onFinish).toHaveBeenCalledWith(expect.objectContaining({ id, nome: "Mercado Conferido", rua: "Praça da Sé" }));
});

it("dois submits no mesmo evento não iniciam duas inserções", async () => {
  const espera = pendente<unknown>(); banco.single.mockReturnValue(espera.promise);
  const tela = await conferir(); act(() => { tela.enviar(); tela.enviar(); });
  await waitFor(() => expect(banco.insert).toHaveBeenCalled());
  expect(banco.insert).toHaveBeenCalledTimes(1);
  await act(async () => espera.resolve({ data: { id }, error: null }));
  expect(tela.onFinish).toHaveBeenCalledTimes(1);
});

it("cadastro confirmado do primeiro comércio não diz que está em demonstração", async () => {
  const tela = await conferir("first"); tela.enviar();
  await screen.findByText("Tudo certo! Seu comércio está pronto");
  expect(screen.queryByText(/nenhum dado foi salvo|Modo de demonstração/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ir para meu painel" }));
  expect(tela.onFinish).toHaveBeenCalledWith(expect.objectContaining({ id, nome: "Mercado Conferido" }));
});

it("resposta sem id confirmado não anuncia comércio cadastrado", async () => {
  banco.single.mockResolvedValue({ data: { id: null }, error: null });
  const tela = await conferir(); tela.enviar();
  await waitFor(() => expect(banco.single).toHaveBeenCalled());
  expect(tela.onFinish).not.toHaveBeenCalled(); expect(await screen.findByRole("alert")).toBeInTheDocument();
});

it("desmontar enquanto confere a sessão não começa gravação atrasada", async () => {
  const espera = pendente<unknown>(); banco.getUser.mockReturnValue(espera.promise);
  const tela = await conferir(); tela.enviar(); tela.unmount();
  await act(async () => espera.resolve({ data: { user: { id: "dono-a" } }, error: null }));
  expect(banco.insert).not.toHaveBeenCalled(); expect(tela.onFinish).not.toHaveBeenCalled();
});

it("sessão de outro dono recusa o envio e mantém o cadastro preenchido", async () => {
  banco.getUser.mockResolvedValue({ data: { user: { id: "dono-b" } }, error: null });
  const tela = await conferir(); tela.enviar();
  expect(await screen.findByRole("alert")).toHaveTextContent("Sua sessão mudou");
  expect(banco.insert).not.toHaveBeenCalled(); expect(tela.onFinish).not.toHaveBeenCalled();
  expect(screen.getByText(/Mercado Conferido/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Voltar" })).toBeEnabled();
});

it("ausência de sessão não grava comércio nem anuncia sucesso", async () => {
  banco.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const tela = await conferir("first"); tela.enviar();
  expect(await screen.findByRole("alert")).toHaveTextContent("Entre novamente");
  expect(banco.insert).not.toHaveBeenCalled(); expect(tela.onFinish).not.toHaveBeenCalled();
  expect(screen.queryByText("Tudo certo! Seu comércio está pronto")).not.toBeInTheDocument();
});

it("erro ao conferir a sessão impede inserção mesmo se vier um usuário junto", async () => {
  banco.getUser.mockResolvedValue({ data: { user: { id: "dono-a" } }, error: new Error("Failed to fetch") });
  const tela = await conferir(); tela.enviar();
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar");
  expect(banco.insert).not.toHaveBeenCalled(); expect(tela.onFinish).not.toHaveBeenCalled();
});

it("erro de documento repetido libera os controles sem descartar dados", async () => {
  banco.single.mockResolvedValue({ data: null, error: { code: "23505" } });
  const tela = await conferir(); tela.enviar();
  expect(await screen.findByRole("alert")).toHaveTextContent("Você já cadastrou um comércio com este CPF.");
  expect(tela.onFinish).not.toHaveBeenCalled();
  for (const b of screen.getAllByRole("button", { name: "Editar" })) expect(b).toBeEnabled();
  expect(screen.getByRole("button", { name: "Voltar" })).toBeEnabled();
  fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[1]!);
  expect(screen.getByLabelText("Nome do comércio")).toHaveValue("Mercado Conferido");
  expect(screen.getByLabelText("Documento")).toHaveValue("529.982.247-25");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" })); expect(tela.onCancel).toHaveBeenCalledTimes(1);
});

it("falha de inserção não confirma e libera a navegação para sair", async () => {
  banco.single.mockRejectedValue(new TypeError("Failed to fetch"));
  const tela = await conferir(); tela.enviar();
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar");
  expect(tela.onFinish).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Cadastrar meu comércio" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(screen.getByLabelText("Número")).toHaveValue("10");
});

it("editar na revisão antes de enviar salva e mostra os mesmos dados normalizados", async () => {
  const tela = await conferir("first");
  fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[1]!);
  fireEvent.change(screen.getByLabelText("Nome do comércio"), { target: { value: "  Mercado Revisado  " } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[2]!);
  fireEvent.change(screen.getByLabelText("Número"), { target: { value: "  20  " } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" })); tela.enviar();
  await screen.findByText("Cadastro salvo na sua conta.");
  expect(screen.getByText("Mercado Revisado")).toBeInTheDocument();
  expect(banco.insert).toHaveBeenCalledWith(expect.objectContaining({ dono_id: "dono-a", nome: "Mercado Revisado", numero: "20", rua: "Praça da Sé" }));
  fireEvent.click(screen.getByRole("button", { name: "Ir para meu painel" }));
  expect(tela.onFinish).toHaveBeenCalledWith(expect.objectContaining({ id, nome: "Mercado Revisado", numero: "20", rua: "Praça da Sé" }));
});

it("resultado que chega após desmontar não chama a tela antiga", async () => {
  const espera = pendente<unknown>(); banco.single.mockReturnValue(espera.promise);
  const tela = await conferir(); tela.enviar(); await waitFor(() => expect(banco.insert).toHaveBeenCalledTimes(1)); tela.unmount();
  await act(async () => espera.resolve({ data: { id }, error: null }));
  expect(tela.onFinish).not.toHaveBeenCalled();
});

it("id vazio e dados ausentes não passam pela confirmação do primeiro comércio", async () => {
  banco.single.mockResolvedValue({ data: { id: " " }, error: null });
  const tela = await conferir("first"); tela.enviar();
  await screen.findByRole("alert"); expect(screen.queryByText("Cadastro salvo na sua conta.")).not.toBeInTheDocument();
  banco.single.mockResolvedValue({ data: null, error: null }); tela.enviar();
  await waitFor(() => expect(screen.getByRole("button", { name: "Cadastrar meu comércio" })).toBeEnabled());
  expect(tela.onFinish).not.toHaveBeenCalled(); expect(screen.queryByText("Tudo certo! Seu comércio está pronto")).not.toBeInTheDocument();
});
