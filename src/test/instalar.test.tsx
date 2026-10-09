import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AppFuncionario } from "@/components/AppFuncionario";
import { tipoAparelho } from "@/lib/instalar";

const CHAVE = "c".repeat(64);
const api = () => ({
  conferir: vi.fn(async () => "pin" as const), entrar: vi.fn(async () => CHAVE), sair: vi.fn(async () => {}),
  inicio: vi.fn(async () => ({ nome: "Maria Souza", funcao: "ambos" as const, comercio: { nome: "Mercado Bom Preço", tipo: "mercado" }, avisos: { entregas: 0, entregasHoje: 0, repor: 0 } })),
});

describe("instalar o Omni Operação", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem("omni.funcionario.chave", CHAVE); });
  afterEach(() => localStorage.clear());
  it("aparelho pelo navegador", () => {
    expect(tipoAparelho("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("iphone");
    expect(tipoAparelho("Mozilla/5.0 (Linux; Android 14) Mobile")).toBe("android");
  });
  it("depois do acesso oferece instalar; sem o aviso do navegador, mostra o passo a passo", async () => {
    render(<AppFuncionario api={api()} />);
    const card = within(await screen.findByRole("region", { name: "Instalar o app" }));
    fireEvent.click(card.getByRole("button", { name: /Instalar o app/ }));
    const dlg = within(screen.getByRole("dialog", { name: "Instalar o Omni Operação" }));
    expect(dlg.getByText(/Instalar app/)).toBeTruthy();
    expect(dlg.getByText(/abrir pelo ícone/)).toBeTruthy();
  });
  it("com o aviso do navegador, instala com um toque", async () => {
    const prompt = vi.fn(async () => {});
    const ev = Object.assign(new Event("beforeinstallprompt"), { prompt, userChoice: Promise.resolve({ outcome: "accepted" as const }) });
    act(() => { window.dispatchEvent(ev); });
    render(<AppFuncionario api={api()} />);
    fireEvent.click(within(await screen.findByRole("region", { name: "Instalar o app" })).getByRole("button", { name: /Instalar o app/ }));
    await waitFor(() => expect(prompt).toHaveBeenCalled());
    expect(await screen.findByText(/está na tela inicial do seu celular/)).toBeTruthy();
  });
  it("Agora não esconde e lembra", async () => {
    const { unmount } = render(<AppFuncionario api={api()} />);
    fireEvent.click(within(await screen.findByRole("region", { name: "Instalar o app" })).getByRole("button", { name: "Agora não" }));
    expect(screen.queryByRole("region", { name: "Instalar o app" })).toBeNull();
    unmount();
    render(<AppFuncionario api={api()} />);
    expect(await screen.findByText("Olá, Maria!")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Instalar o app" })).toBeNull();
  });
});
