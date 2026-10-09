import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ReporGondola, type ApiRepor } from "@/components/ReporGondola";
import type { ItemReposicao, RespostaContagemPrateleira } from "@/lib/banco";

vi.mock("@/components/Scanner", () => ({
  Scanner: ({ onCode }: { onCode: (c: string) => void }) => <button type="button" onClick={() => onCode("7891000432687")}>leitor falso</button>,
}));

const base: ItemReposicao = { produtoId: "p-arroz", variacaoId: null, embalagemId: null, nome: "Arroz 5 kg", unidade: "Unidade", codigo: "789", variacao: null,
  controlaValidade: false, pedeLote: false, embalagens: [], local: "Gôndola 10", localDeposito: "Prateleira 2", depositoVazio: false };
const itens: ItemReposicao[] = [base, { ...base, produtoId: "p-tiss", nome: "Tiss", local: "Gôndola 3", depositoVazio: true }];
const resp = (x: Partial<RespostaContagemPrateleira> = {}): RespostaContagemPrateleira => ({ sugerido: 43, cheio: false, depositoVazio: false, localDeposito: "Prateleira 2", situacao: "contado", ...x });
function api(over: Partial<ApiRepor> = {}, tipo = "mercado") {
  return {
    lista: vi.fn(async () => ({ tipo, produtos: itens })),
    contar: vi.fn(async () => resp()),
    concluir: vi.fn(async () => {}),
    buscar: vi.fn(async () => [{ ...base, produtoId: "p-cerv", nome: "Cerveja" }]),
    ...over,
  } satisfies ApiRepor;
}
const CH = "c".repeat(64);

describe("Repor gôndola (funcionário)", () => {
  it("lista em ordem de caminho, avisa quando acabou no depósito", async () => {
    render(<ReporGondola chave={CH} api={api()} onVoltar={() => {}} />);
    const botoes = await screen.findAllByRole("button", { name: /Gôndola \d+/ });
    expect(botoes.map((b) => b.textContent)).toEqual([expect.stringMatching(/^Tiss.*Gôndola 3.*Acabou no depósito/), expect.stringMatching(/^Arroz 5 kg.*Gôndola 10/)]);
  });
  it("farmácia fala área de venda e estoque", async () => {
    render(<ReporGondola chave={CH} api={api({}, "farmacia")} onVoltar={() => {}} />);
    expect(await screen.findByText("Repor área de venda")).toBeTruthy();
    expect(screen.getByText("Acabou no estoque")).toBeTruthy();
  });
  it("vai até o lugar, conta às cegas, busca no depósito e coloca", async () => {
    const a = api();
    render(<ReporGondola chave={CH} api={a} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Arroz 5 kg/ }));
    expect(screen.getByText("Gôndola 10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Estou na prateleira/ }));
    expect(screen.getByText("Quanto tem na gôndola agora?")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Confirmar contagem/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Na gôndola (unidades)"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar contagem/ }));
    await waitFor(() => expect(a.contar).toHaveBeenCalledWith(CH, expect.any(String), "p-arroz", null, 7));
    expect(await screen.findByText("43 unidades")).toBeTruthy();
    expect(screen.getByText("Busque no depósito")).toBeTruthy();
    const campo = screen.getByLabelText("Coloquei (unidades)") as HTMLInputElement;
    expect(campo.value).toBe("43");
    fireEvent.change(campo, { target: { value: "50" } });
    expect(screen.getByRole("alert").textContent).toMatch(/No máximo 43 unidades/);
    fireEvent.change(campo, { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: /Coloquei na gôndola/ }));
    await waitFor(() => expect(a.concluir).toHaveBeenCalledWith(CH, vi.mocked(a.contar).mock.calls[0]![1], 40));
    expect(await screen.findByText(/Pronto! Arroz 5 kg: 40 unidades na gôndola/)).toBeTruthy();
    expect(a.lista).toHaveBeenCalledTimes(2);
  });
  it("prateleira cheia: não precisa repor; prateleira vazia manda zero", async () => {
    const a = api({ contar: vi.fn(async () => resp({ sugerido: 0, cheio: true })) });
    render(<ReporGondola chave={CH} api={a} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Tiss/ }));
    fireEvent.click(screen.getByRole("button", { name: /Estou na prateleira/ }));
    fireEvent.click(screen.getByRole("button", { name: /Está vazia/ }));
    await waitFor(() => expect(a.contar).toHaveBeenCalledWith(CH, expect.any(String), "p-tiss", null, 0));
    expect(await screen.findByText("A gôndola está cheia")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    await waitFor(() => expect(a.concluir).toHaveBeenCalledWith(CH, expect.any(String), 0));
  });
  it("bipar na prateleira confere se é o produto certo", async () => {
    render(<ReporGondola chave={CH} api={api()} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Arroz 5 kg/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bipar o produto/ }));
    fireEvent.click(screen.getByRole("button", { name: "leitor falso" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/outro produto \(Cerveja\)/);
  });
  it("repor outro produto pelo nome", async () => {
    const a = api();
    render(<ReporGondola chave={CH} api={a} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Repor outro produto/ }));
    const dlg = within(screen.getByRole("dialog"));
    fireEvent.change(dlg.getByPlaceholderText("Código de barras ou nome"), { target: { value: "cerv" } });
    fireEvent.click(dlg.getByRole("button", { name: "Procurar" }));
    expect(await screen.findByText("Cerveja")).toBeTruthy();
    expect(screen.getByText("a gôndola deste produto")).toBeTruthy();
  });
});
