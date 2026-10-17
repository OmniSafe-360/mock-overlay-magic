/* B7 (checklist funcional 3): cadastrar de novo um comércio que já existe não aparece como "adicionado"
   nem entra em dobro na lista. Resposta perdida de um envio novo continua sendo recuperada (B13). */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { StoreSetup } from "@/components/StoreSetup";

const banco = vi.hoisted(() => ({ getUser: vi.fn(), insert: vi.fn(), consulta: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: banco.getUser }, from: () => ({
  insert: (...a: unknown[]) => { banco.insert(...a); return { select: () => ({ single: () => banco.insert.mock.results.at(-1)?.value ?? Promise.resolve({ data: null, error: null }) }) }; },
  select: () => ({ eq: () => ({ eq: () => ({ limit: () => banco.consulta() }) }) }),
}) } }));
beforeEach(() => {
  vi.clearAllMocks();
  banco.getUser.mockResolvedValue({ data: { user: { id: "dono-a" } }, error: null });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP" }) })));
});
async function conferir() {
  const onFinish = vi.fn();
  render(<StoreSetup mode="add" userId="dono-a" onFinish={onFinish} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Mercado" })); fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Nome do comércio"), { target: { value: "Mercado Conferido" } });
  fireEvent.click(screen.getByRole("radio", { name: "CPF" })); fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "52998224725" } });
  fireEvent.change(screen.getByLabelText("Telefone do comércio"), { target: { value: "11999998888" } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" })); fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001000" } });
  await screen.findByText(/Praça da Sé, Sé, São Paulo - SP/);
  fireEvent.change(screen.getByLabelText("Número"), { target: { value: "10" } }); fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Cadastrar meu comércio" }).closest("form")!); });
  return onFinish;
}

it("comércio com o mesmo documento já cadastrado: avisa e não adiciona", async () => {
  banco.consulta.mockResolvedValue({ data: [{ id: "c-antigo", nome: "Mercado Conferido" }], error: null });
  const onFinish = await conferir();
  expect(await screen.findByRole("alert")).toHaveTextContent("Você já cadastrou um comércio com este CPF: Mercado Conferido.");
  expect(banco.insert).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();
});

it("envio novo com a resposta perdida continua sendo confirmado", async () => {
  banco.consulta.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValue({ data: [{ id: "c-novo", nome: "Mercado Conferido" }], error: null });
  banco.insert.mockReturnValue(Promise.resolve({ data: null, error: { code: "08006", message: "rede" } }));
  const onFinish = await conferir();
  await waitFor(() => expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ id: "c-novo" })));
  expect(banco.insert).toHaveBeenCalledTimes(1);
});
