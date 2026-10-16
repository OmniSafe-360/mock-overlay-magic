/* M22 (subetapa 3): com letra grande e pouco espaço, Voltar mostra só a seta (nome mantido para o leitor de tela),
   os botões ficam mais justos e, se ainda faltar espaço, Continuar fica em cima. Medidas em rem: com letra normal nada muda. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

describe("M22 — Continuar do cadastro com letra grande", () => {
  it("Voltar continua com o nome para o leitor de tela; regras só para pouco espaço; mesma navegação", () => {
    render(<ProductWizard store={{ id: "s", nome: "Loja", tipo: "mercado" } as never} products={[]} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Digitar código" }));
    fireEvent.change(screen.getByLabelText("Código do produto"), { target: { value: "7890001" } });
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Arroz" } });
    fireEvent.submit(document.querySelector("form")!);
    const voltar = screen.getByRole("button", { name: "Voltar" });
    const continuar = screen.getByRole("button", { name: "Continuar" });
    expect(voltar.querySelector(".\\@max-\\[15rem\\]\\:sr-only")?.textContent).toBe("Voltar");
    expect(continuar.className).toContain("min-w-0");
    expect(continuar.className).toContain("@max-[15rem]:px-3");
    const linha = continuar.parentElement!;
    expect(linha.className).toContain("@max-[7.5rem]:flex-col-reverse");
    expect(linha.parentElement!.className).toContain("@container");
    // Achado do Codex: com a tela muito baixa, a tela inteira rola (campos com altura mínima) e Voltar continua alcançável.
    expect(document.querySelector("main")!.className).toContain("overflow-y-auto");
    expect(document.querySelector("[data-kb-scroll]")!.className).toContain("min-h-[5rem]");
    fireEvent.click(voltar);
    expect(screen.getByText("Qual é o código do produto?")).toBeTruthy();
  });
});
