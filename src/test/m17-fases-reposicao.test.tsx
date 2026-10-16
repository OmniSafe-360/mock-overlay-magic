/* M17: a reposição mostra as três fases que já existem (Conte → Busque → Confirme o que levou)
   e qual está acontecendo agora. Sem fase nova, sem mostrar o número do sistema. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ReporGondola, type ApiRepor } from "@/components/ReporGondola";
import type { ItemReposicao, RespostaContagemPrateleira } from "@/lib/banco";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const base: ItemReposicao = { produtoId: "p-arroz", variacaoId: null, embalagemId: null, nome: "Arroz 5 kg", unidade: "Unidade", codigo: "789", variacao: null,
  controlaValidade: false, pedeLote: false, embalagens: [], local: "Gôndola 10", localDeposito: "Prateleira 2", depositoVazio: false };
const resp = (x: Partial<RespostaContagemPrateleira> = {}): RespostaContagemPrateleira => ({ sugerido: 43, cheio: false, depositoVazio: false, localDeposito: "Prateleira 2", situacao: "contado", ...x });
const api = (over: Partial<ApiRepor> = {}) => ({
  lista: vi.fn(async () => ({ tipo: "mercado", produtos: [base] })),
  contar: vi.fn(async () => resp()), concluir: vi.fn(async () => {}), buscar: vi.fn(async () => []), ...over,
}) satisfies ApiRepor;
const CH = "c".repeat(64);
const atual = () => within(screen.getByRole("list", { name: "Fases da reposição" })).getAllByRole("listitem")
  .filter((li) => li.getAttribute("aria-current") === "step").map((li) => li.textContent);

describe("M17 — fases da reposição", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  it("Conte na ida e na contagem; Busque e Confirme o que levou na tela do depósito", async () => {
    const a = api();
    render(<ReporGondola chave={CH} api={a} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Arroz 5 kg/ }));
    expect(atual()).toEqual(["1. Conte"]);
    fireEvent.click(screen.getByRole("button", { name: /Estou na prateleira/ }));
    expect(atual()).toEqual(["1. Conte"]);
    fireEvent.click(screen.getByRole("button", { name: /Está vazia/ }));
    await screen.findByLabelText("Coloquei (unidades)");
    expect(atual()).toEqual(["→2. Busque", "→3. Confirme o que levou"]);
    expect(screen.getByText("Prateleira 2").className).toContain("text-base");
    fireEvent.change(screen.getByLabelText("Coloquei (unidades)"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: /Coloquei na gôndola/ }));
    await vi.waitFor(() => expect(a.concluir).toHaveBeenCalledWith(CH, expect.any(String), 40));
  });
  it("prateleira cheia: sem faixa de fases (não há o que buscar)", async () => {
    render(<ReporGondola chave={CH} api={api({ contar: vi.fn(async () => resp({ sugerido: 0, cheio: true })) })} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Arroz 5 kg/ }));
    fireEvent.click(screen.getByRole("button", { name: /Estou na prateleira/ }));
    fireEvent.click(screen.getByRole("button", { name: /Está vazia/ }));
    expect(await screen.findByText(/está cheia/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Fases da reposição" })).toBeNull();
  });
});
