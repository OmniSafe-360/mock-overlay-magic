/* M22, subetapa 5: a faixa "Conte → Busque → Confirme" do Repor não fica alta demais com letra grande.
   Com pouco espaço (menos de 14 rem, só com letra grande), só a fase atual mostra o nome; as outras
   mostram o número, e o nome continua para o leitor de tela. Com letra normal nada muda. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ReporGondola, type ApiRepor } from "@/components/ReporGondola";
import type { ItemReposicao } from "@/lib/banco";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const base: ItemReposicao = { produtoId: "p", variacaoId: null, embalagemId: null, nome: "Arroz 5 kg", unidade: "Unidade", codigo: "789", variacao: null,
  controlaValidade: false, pedeLote: false, embalagens: [], local: "Gôndola 10", localDeposito: "Prateleira 2", depositoVazio: false };
const api = {
  lista: vi.fn(async () => ({ tipo: "mercado", produtos: [base] })),
  contar: vi.fn(async () => ({ sugerido: 43, cheio: false, depositoVazio: false, localDeposito: "Prateleira 2", situacao: "contado" as const })),
  concluir: vi.fn(async () => {}), buscar: vi.fn(async () => []),
} satisfies ApiRepor;

const nomes = () => within(screen.getByRole("list", { name: "Fases da reposição" })).getAllByRole("listitem").map((li) => li.querySelector("span.rounded-full > span"));

describe("M22 — faixa de fases do Repor", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  it("só o nome da fase atual fica visível com pouco espaço; os nomes continuam para o leitor de tela", async () => {
    render(<ReporGondola chave={"c".repeat(64)} api={api} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Arroz 5 kg/ }));
    const lista = screen.getByRole("list", { name: "Fases da reposição" });
    expect(lista.parentElement!.className).toContain("@container");
    expect(nomes().map((s) => s!.className ?? "")).toEqual(["", "@max-[14rem]:sr-only", "@max-[14rem]:sr-only"]);
    fireEvent.click(screen.getByRole("button", { name: /Estou na prateleira/ }));
    fireEvent.click(screen.getByRole("button", { name: /Está vazia/ }));
    await screen.findByLabelText("Coloquei (unidades)");
    expect(nomes().map((s) => s!.className ?? "")).toEqual(["@max-[14rem]:sr-only", "", "@max-[14rem]:sr-only"]);
    expect(within(screen.getByRole("list", { name: "Fases da reposição" })).getAllByRole("listitem").map((li) => li.textContent))
      .toEqual(["1. Conte", "→2. Busque", "→3. Confirme o que levou"]);
  });
});
