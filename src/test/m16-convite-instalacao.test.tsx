/* M16: o convite "Instale o app no celular" ocupa menos espaço (cerca de 35% menos no celular),
   com o mesmo texto, os mesmos dois botões e a mesma regra de quando aparece. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AppFuncionario } from "@/components/AppFuncionario";

const CHAVE = "c".repeat(64);
const api = () => ({
  conferir: vi.fn(async () => "pin" as const), entrar: vi.fn(async () => CHAVE), sair: vi.fn(async () => {}), desbloquear: vi.fn(async () => {}),
  inicio: vi.fn(async () => ({ nome: "Maria Souza", funcao: "ambos" as const, comercio: { nome: "Mercado Bom Preço", tipo: "mercado" }, avisos: { entregas: 0, entregasHoje: 0, repor: 0 } })),
});

describe("M16 — convite de instalação compacto", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem("omni.funcionario.chave", CHAVE); });
  afterEach(() => localStorage.clear());
  it("mesmo texto e botões, em cartão menor; a outra entrada do rodapé continua", async () => {
    render(<AppFuncionario api={api()} />);
    await screen.findByText("Digite seu PIN");
    for (const d of "2580") fireEvent.click(screen.getByRole("button", { name: d }));
    const regiao = await screen.findByRole("region", { name: "Instalar o app" });
    expect(regiao.className).toContain("p-3");
    expect(regiao.className).not.toContain("p-4");
    const card = within(regiao);
    expect(card.getByText("Instale o app no celular")).toBeTruthy();
    expect(card.getByText(/Ele fica na tela inicial, abre direto aqui e funciona como um aplicativo\./)).toBeTruthy();
    const instalar = card.getByRole("button", { name: /Instalar o app/ });
    const agoraNao = card.getByRole("button", { name: "Agora não" });
    expect(instalar.className).toContain("min-h-11");
    expect(agoraNao.className).toContain("min-h-11");
    expect(instalar.parentElement!.className).toContain("flex-wrap");
    expect(screen.getByRole("button", { name: /Instalar o app no celular/ })).toBeTruthy();
  });
});
