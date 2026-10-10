import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PainelFiado, type ApiFiado } from "@/components/PainelFiado";
import { contasFiado, linkWhats, mensagemCobranca, resumoFiado, textoMovimento, type ClienteFiado, type MovimentoFiado } from "@/lib/fiado";
import { textoComprovante } from "@/lib/caixa";

const AGORA = Date.parse("2026-10-10T15:00:00-03:00");
const dias = (d: number) => new Date(AGORA - d * 86_400_000).toISOString();
const cli = (id: string, nome: string, telefone: string | null = null): ClienteFiado => ({ id, nome, telefone, ativo: true, criadoEm: dias(90) });
const mov = (id: string, clienteId: string, tipo: MovimentoFiado["tipo"], valor: number, d: number, extra: Partial<MovimentoFiado> = {}): MovimentoFiado =>
  ({ id, clienteId, tipo, valor, vendaNumero: null, forma: tipo === "pagamento" ? "pix" : null, observacao: null, criadoEm: dias(d), ...extra });
const CLIENTES = [cli("a", "João da Silva", "43999991234"), cli("b", "Dona Cida"), cli("c", "Pedro")];
const MOVS = [
  mov("1", "a", "compra", 5000, 40, { vendaNumero: 3 }), mov("2", "a", "pagamento", 2000, 20), mov("3", "a", "compra", 1590, 2, { vendaNumero: 15 }),
  mov("4", "b", "compra", 3000, 10), mov("5", "b", "pagamento", 3000, 5, { forma: "dinheiro" }), mov("6", "b", "compra", 800, 1),
  mov("7", "c", "compra", 1200, 3), mov("8", "c", "cancelamento", 1200, 3),
];

describe("regras do fiado", () => {
  it("quanto deve e desde quando (pagar tudo zera; compra nova começa de novo)", () => {
    const cs = contasFiado(CLIENTES, MOVS);
    expect(cs.map((c) => [c.nome, c.deve])).toEqual([["João da Silva", 4590], ["Dona Cida", 800], ["Pedro", 0]]);
    expect(cs[0]!.desde).toBe(dias(40));
    expect(cs[1]!.desde).toBe(dias(1));
    expect(cs[2]!.desde).toBeNull();
    expect(resumoFiado(cs, AGORA)).toEqual({ total: 5390, clientes: 2, antigos: 1 });
    expect(textoMovimento(MOVS[0]!)).toBe("Comprou (venda nº 3)");
    expect(textoMovimento(MOVS[4]!)).toBe("Pagou em dinheiro");
    expect(textoMovimento(MOVS[7]!)).toBe("Venda cancelada");
  });
  it("cobrança pelo WhatsApp", () => {
    const m = mensagemCobranca({ nome: "João da Silva", deve: 4590 }, "Mercado Bom Preço");
    expect(m.replace(/\s/g, " ")).toBe("Olá, João! Tudo bem? Aqui é do Mercado Bom Preço. Sua conta do fiado está em R$ 45,90. Quando puder, passe aqui para acertar. Obrigado!");
    expect(linkWhats("43999991234", "oi")).toBe("https://wa.me/5543999991234?text=oi");
  });
  it("comprovante da venda (não é nota fiscal)", () => {
    const t = textoComprovante({ comercio: { nome: "Mercado Bom Preço", endereco: "Rua A 1, Centro" }, numero: 15, feitaEm: "2026-10-10T17:32:00Z",
      itens: [{ descricao: "Refrigerante Tiss", qtd: 2, valor: 698 }, { descricao: "Queijo", qtd: 0.35, valor: 1397 }],
      total: 2095, pagamentos: [{ forma: "dinheiro", valor: 5000 }], troco: 2905, cliente: null });
    expect(t).toBe(["*Mercado Bom Preço*", "Rua A 1, Centro", "Comprovante de venda nº 15 · 10/10/2026 14:32", "_Não é documento fiscal_", "",
      "2 x Refrigerante Tiss — R$ 6,98", "0,35 x Queijo — R$ 13,97", "", "*Total: R$ 20,95*", "Dinheiro: R$ 50,00", "Troco: R$ 29,05", "", "Obrigado pela preferência!"].join("\n"));
  });
});

describe("Fiado no app do dono", () => {
  it("mostra quem deve, recebe parte e cobra pelo WhatsApp", async () => {
    let movs = [...MOVS];
    const api: ApiFiado = {
      carregar: vi.fn(async () => ({ clientes: CLIENTES, movimentos: movs })),
      receber: vi.fn(async (id: string, c: string, v: number, f: "dinheiro" | "pix" | "cartao") => { movs = [...movs, mov(id, c, "pagamento", v, 0, { forma: f })]; }),
      salvarCliente: vi.fn(async () => {}),
    };
    render(<PainelFiado comercioId="c1" comercioNome="Mercado Bom Preço" api={api} agora={AGORA} />);
    expect((await screen.findByText(/Fiado · a receber/)).closest("button")!.textContent?.replace(/\s/g, " ")).toMatch(/R\$ 53,90.*2 clientes devem.*1 há mais de 30 dias/);
    fireEvent.click(screen.getByRole("button", { name: /Fiado · a receber/ }));
    fireEvent.click(await screen.findByRole("button", { name: /João da Silva/ }));
    expect(screen.getByRole("link", { name: /Cobrar pelo WhatsApp/ }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/5543999991234\?text=Ol/);
    fireEvent.click(screen.getByRole("button", { name: /Recebeu/ }));
    fireEvent.change(screen.getByLabelText("Quanto recebeu?"), { target: { value: "9999" } });
    expect(screen.getByText(/É mais do que ele deve/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Quanto recebeu?"), { target: { value: "2000" } });
    expect(screen.getByText(/Vai continuar devendo R\$\s25,90/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pix" }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar R\$\s20,00/ }));
    await waitFor(() => expect(api.receber).toHaveBeenCalledWith(expect.any(String), "a", 2000, "pix", ""));
    expect(await screen.findByText(/Recebido R\$\s20,00 de João/)).toBeTruthy();
    expect(screen.getAllByText("R$ 25,90").length).toBeGreaterThan(0);
  });
});
