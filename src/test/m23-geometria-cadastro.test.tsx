/* M23: geometria do primeiro cadastro do comércio no celular.
   Antes, com letra grande em celular pequeno, os campos sumiam, "Sair da conta" ficava por cima de
   Continuar/Voltar e Continuar saía pela direita; CNPJ/CPF, Editar e Sair tinham menos de 48 px. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { StoreSetup } from "@/components/StoreSetup";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: vi.fn() }, from: vi.fn() } }));

describe("M23 — geometria do primeiro cadastro", () => {
  it("nenhum botão abaixo de 48 px", () => {
    const src = readFileSync("src/components/StoreSetup.tsx", "utf8");
    const botoes = src.split("<button").slice(1).map((b) => b.split(">")[0]!);
    expect(botoes.filter((b) => /\b(min-)?h-(6|7|8|9|10|11)\b/.test(b))).toEqual([]);
    expect(botoes.filter((b) => /\bpy-1\b/.test(b) && !/min-h-1[2-9]/.test(b))).toEqual([]);
  });
  it("tela rola quando falta altura; Sair fica no bloco dos botões; Voltar e Continuar se ajustam com letra grande", () => {
    const sair = vi.fn(async () => {});
    render(<StoreSetup mode="first" userId="dono" onFinish={() => {}} onExit={sair} />);
    expect(document.querySelector("main")!.className).toContain("overflow-y-auto");
    expect(document.querySelector("[data-kb-scroll]")!.className).toContain("min-h-[5rem]");
    const sairBtn = screen.getByRole("button", { name: /Sair da conta/ });
    expect(sairBtn.closest("form")).toBeTruthy();
    expect(sairBtn.className).toContain("min-h-12");
    fireEvent.click(screen.getByRole("button", { name: "Mercado" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    const voltar = screen.getByRole("button", { name: "Voltar" });
    expect(voltar.querySelector("span.\\@max-\\[15rem\\]\\:sr-only")!.textContent).toBe("Voltar");
    expect(voltar.parentElement!.parentElement!.className).toContain("@container");
    expect(screen.getByRole("button", { name: "Continuar" }).className).toContain("min-w-0");
    for (const r of screen.getAllByRole("radio")) expect(r.className).toContain("min-h-12");
    // Achado do Codex: margem negativa fazia o atalho e a escolha CNPJ/CPF invadirem o campo do documento.
    expect(screen.getByRole("radiogroup").className).not.toMatch(/-my-/);
    const atalho = screen.getByRole("button", { name: "Ainda não tenho CNPJ" });
    expect(atalho.className).toContain("min-h-12");
    expect(atalho.className).not.toMatch(/-my-/);
    expect(screen.getByText("Dados do comércio").className).not.toContain("truncate");
    fireEvent.click(sairBtn);
    expect(sair).toHaveBeenCalledTimes(1);
  });
});
