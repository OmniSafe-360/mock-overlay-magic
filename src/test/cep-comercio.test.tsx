import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StoreSetup } from "@/components/StoreSetup";

const ENDERECOS: Record<string, unknown> = {
  "01001000": { logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP" },
  "99999999": { erro: true },
};
afterEach(() => vi.unstubAllGlobals());

async function ateOEndereco() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const cep = /(\d{8})/.exec(url)?.[1] ?? "";
    if (cep === "88888888") throw new TypeError("Failed to fetch");
    return { ok: true, status: 200, json: async () => ENDERECOS[cep] ?? { erro: true } } as Response;
  }));
  render(<StoreSetup mode="add" />);
  fireEvent.click(screen.getByRole("button", { name: /Mercado/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Nome do comércio"), { target: { value: "Mercado Teste" } });
  fireEvent.click(screen.getByRole("radio", { name: "CPF" }));
  fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "52998224725" } });
  fireEvent.change(screen.getByLabelText("Telefone do comércio"), { target: { value: "11999998888" } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001000" } });
  expect(await screen.findByText(/Praça da Sé, Sé, São Paulo - SP/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Número"), { target: { value: "10" } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Continuar" }) as HTMLButtonElement).disabled).toBe(false));
}

describe("CEP do comércio", () => {
  it("CEP novo que não é encontrado não mantém o endereço do CEP anterior", async () => {
    await ateOEndereco();
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "99999999" } });
    expect(await screen.findByText(/Não encontramos esse CEP/)).toBeTruthy();
    expect(screen.queryByText(/Praça da Sé/)).toBeNull();
    expect((screen.getByRole("button", { name: "Continuar" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("CEP novo sem conseguir buscar pede o endereço vazio, sem a rua anterior", async () => {
    await ateOEndereco();
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "88888888" } });
    expect(await screen.findByText(/Não conseguimos buscar agora/)).toBeTruthy();
    expect((screen.getByLabelText("Rua") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Cidade") as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("button", { name: "Continuar" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
