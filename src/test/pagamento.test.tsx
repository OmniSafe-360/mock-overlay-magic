import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Product, Supplier } from "@/components/ProductArea";
import { PainelPedidos } from "@/components/PainelPedidos";
import { AtencaoHoje } from "@/components/AtencaoHoje";
import { diasEntre, estadoPagamento, resumoPagamentos, somaDias, textoPagamento, valorConta } from "@/lib/pagamento";
import { hojeEm } from "@/lib/validade";
import type { Pedido } from "@/lib/pedido";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const HOJE = "2026-10-09";
const base: Pedido = {
  id: "p1", numero: 1, fornecedorId: "f-sol", situacao: "aceito", canal: "whatsapp", enviadoEm: "2026-10-01T12:00:00Z", observacao: "", token: "t".repeat(64), criadoEm: "2026-10-01T11:00:00Z",
  itens: [{ produtoId: "p-1", variacaoId: null, embalagemId: null, qtdEmbalagens: 10, qtdUnidades: 10, precoEstimado: 500, qtdConfirmada: 10, qtdRecebida: null }],
};
const conta = (id: string, situacao: "a_pagar" | "pago", vencimento: string | null, valor: number | null, pagoEm: string | null = null): Pedido =>
  ({ ...base, id, numero: Number(id.replace(/\D/g, "")) || 1, pagamento: { situacao, vencimento, pagoEm, valor } });

describe("regras do pagamento", () => {
  it("datas", () => {
    expect(diasEntre("2026-10-09", "2026-10-12")).toBe(3);
    expect(diasEntre("2026-10-09", "2026-10-01")).toBe(-8);
    expect(somaDias("2026-10-30", 3)).toBe("2026-11-02");
  });
  it("estado e texto", () => {
    expect(estadoPagamento(base, HOJE)).toBeNull();
    expect(textoPagamento(conta("a", "a_pagar", "2026-10-06", 1), HOJE)).toBe("Atrasado há 3 dias (venceu 06/10)");
    expect(textoPagamento(conta("a", "a_pagar", "2026-10-08", 1), HOJE)).toBe("Atrasado há 1 dia (venceu 08/10)");
    expect(textoPagamento(conta("a", "a_pagar", HOJE, 1), HOJE)).toBe("Vence hoje");
    expect(textoPagamento(conta("a", "a_pagar", "2026-10-10", 1), HOJE)).toBe("Vence amanhã");
    expect(textoPagamento(conta("a", "a_pagar", "2026-10-14", 1), HOJE)).toBe("Vence em 5 dias (14/10)");
    expect(textoPagamento(conta("a", "a_pagar", "2026-11-20", 1), HOJE)).toBe("Vence em 20/11");
    expect(textoPagamento(conta("a", "pago", "2026-10-06", 1, "2026-10-05"), HOJE)).toBe("Pago em 05/10");
  });
  it("valor: o informado; sem ele, o estimado", () => {
    expect(valorConta(conta("a", "a_pagar", HOJE, 12000))).toEqual({ valor: 12000, estimado: false });
    expect(valorConta(conta("a", "a_pagar", HOJE, null))).toEqual({ valor: 5000, estimado: true });
  });
  it("resumo: atrasados, hoje, próximos 7 dias, este mês e pago este mês", () => {
    const r = resumoPagamentos([
      conta("1", "a_pagar", "2026-10-01", 1000), conta("2", "a_pagar", HOJE, 2000), conta("3", "a_pagar", "2026-10-12", 3000),
      conta("4", "a_pagar", "2026-11-15", 4000), conta("5", "pago", "2026-10-02", 5000, "2026-10-02"), conta("6", "pago", "2026-09-02", 6000, "2026-09-02"), base,
    ], HOJE);
    expect(r.aPagar).toEqual({ n: 4, total: 10000 });
    expect(r.atrasados).toEqual({ n: 1, total: 1000 });
    expect(r.hoje).toEqual({ n: 1, total: 2000 });
    expect(r.semana).toEqual({ n: 1, total: 3000 });
    expect(r.esteMes).toEqual({ n: 3, total: 6000 });
    expect(r.pagoEsteMes).toEqual({ n: 1, total: 5000 });
  });
});

const sol: Supplier = { id: 1, nome: "Distribuidora Sol", tel: "11988887777", email: "", dbId: "f-sol" };
const cafe: Product = { id: 1, codigo: "1", nome: "Café Pilão", compra: 500, venda: 800, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: 1,
  db: { id: "p-1", contadas: [] }, deposito: { local: "A", qtd: 40, min: 10, max: 60 } };
const comercio = { id: "c1", tipo: "mercado", nome: "Mercado Bom Preço", cidade: "Ourinhos", uf: "SP", rua: "Rua X", numero: "123", bairro: "Centro" };
const hoje = hojeEm();

function abrir(pedidos: Pedido[], extra = {}) {
  const props = { products: [cafe], store: comercio, suppliers: [sol], pedidos, onSalvar: vi.fn(async () => ({ id: "x", numero: 1 })), onEnviado: vi.fn(async () => {}),
    onCancelar: vi.fn(async () => {}), onNovoLink: vi.fn(async () => "b"), onPagamento: vi.fn(async (_id: string, _d: unknown) => {}), onOpenProduto: vi.fn(), ...extra };
  render(<PainelPedidos {...props} />);
  return props;
}

describe("pagamento na aba Pedidos", () => {
  const atrasado = conta("ped-7", "a_pagar", somaDias(hoje, -2), 12000);
  const futuro = conta("ped-8", "a_pagar", somaDias(hoje, 40), 30000);
  const pago = conta("ped-9", "pago", somaDias(hoje, -5), 9000, hoje);
  it("resumo das contas, cartões e filtro Só a pagar", () => {
    abrir([pago, futuro, atrasado]);
    const r = within(screen.getByRole("region", { name: "Contas a pagar" }));
    expect(r.getByText(/R\$\s420,00/)).toBeTruthy();
    expect(r.getByText(/1 atrasado · R\$\s120,00/)).toBeTruthy();
    expect(r.getByText(/Pago este mês: R\$\s90,00/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Pedido nº 7/ }).textContent).toMatch(/A pagar R\$\s120,00 · Atrasado há 2 dias/);
    expect(screen.getByRole("button", { name: /Pedido nº 9/ }).textContent).toMatch(/Pago em/);
    fireEvent.click(r.getByRole("button", { name: "Só a pagar (2)" }));
    const nomes = screen.getAllByRole("button", { name: /Pedido nº/ }).map((b) => b.textContent!.match(/Pedido nº (\d+)/)![1]);
    expect(nomes).toEqual(["7", "8"]);
  });
  it("abrir já em Só a pagar (vindo do Atenção hoje)", () => {
    abrir([pago, atrasado], { soAPagar: true });
    expect(screen.queryByRole("button", { name: /Pedido nº 9/ })).toBeNull();
  });
  it("marcar como pago com a data", async () => {
    const t = abrir([atrasado]);
    fireEvent.click(screen.getByRole("button", { name: /Pedido nº 7/ }));
    const sec = within(screen.getByRole("region", { name: "Pagamento" }));
    expect(sec.getByText(/Atrasado há 2 dias/)).toBeTruthy();
    fireEvent.click(sec.getByRole("button", { name: /Marcar como pago/ }));
    const dlg = within(screen.getByRole("dialog"));
    fireEvent.click(dlg.getByRole("button", { name: "Ontem" }));
    fireEvent.click(dlg.getByRole("button", { name: /Confirmar pagamento/ }));
    await waitFor(() => expect(t.onPagamento).toHaveBeenCalledWith("ped-7", { situacao: "pago", pagoEm: somaDias(hoje, -1) }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("corrigir vencimento e valor", async () => {
    const t = abrir([futuro]);
    fireEvent.click(screen.getByRole("button", { name: /Pedido nº 8/ }));
    fireEvent.click(screen.getByRole("button", { name: /Corrigir vencimento ou valor/ }));
    const dlg = within(screen.getByRole("dialog"));
    fireEvent.click(dlg.getByRole("button", { name: "Em 7 dias" }));
    fireEvent.change(dlg.getByLabelText("Valor da conta"), { target: { value: "28550" } });
    fireEvent.click(dlg.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(t.onPagamento).toHaveBeenCalledWith("ped-8", { situacao: "a_pagar", vencimento: somaDias(hoje, 7), valor: 28550 }));
  });
  it("erro aparece dentro da janela", async () => {
    abrir([futuro], { onPagamento: vi.fn(async () => { throw new Error("A data do pagamento não pode ser no futuro."); }) });
    fireEvent.click(screen.getByRole("button", { name: /Pedido nº 8/ }));
    fireEvent.click(screen.getByRole("button", { name: /Marcar como pago/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Confirmar pagamento/ }));
    expect((await within(screen.getByRole("dialog")).findByRole("alert")).textContent).toMatch(/não pode ser no futuro/);
  });
  it("desfazer pagamento pede confirmação", async () => {
    const t = abrir([pago]);
    fireEvent.click(screen.getByRole("button", { name: /Pedido nº 9/ }));
    fireEvent.click(screen.getByRole("button", { name: /desfazer pagamento/ }));
    expect(t.onPagamento).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar: ainda não foi pago/ }));
    await waitFor(() => expect(t.onPagamento).toHaveBeenCalledWith("ped-9", { situacao: "a_pagar" }));
  });
  it("pedido enviado sem resposta: registrar conta; rascunho não mostra pagamento", async () => {
    const t = abrir([{ ...base, id: "ped-3", numero: 3, situacao: "enviado" }, { ...base, id: "ped-4", numero: 4, situacao: "rascunho", enviadoEm: null }]);
    fireEvent.click(screen.getByRole("button", { name: /Pedido nº 3/ }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar conta a pagar" }));
    const dlg = within(screen.getByRole("dialog"));
    expect(dlg.getByRole("button", { name: /Salvar/ }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(dlg.getByRole("button", { name: "Hoje" }));
    fireEvent.click(dlg.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(t.onPagamento).toHaveBeenCalledWith("ped-3", { situacao: "a_pagar", vencimento: hoje, valor: null }));
  });
});

describe("contas no Atenção hoje", () => {
  it("quadros de contas abrem a aba Pedidos", () => {
    const onVerContas = vi.fn();
    const contas = resumoPagamentos([conta("1", "a_pagar", somaDias(hoje, -1), 1000), conta("2", "a_pagar", hoje, 2000)], hoje);
    render(<AtencaoHoje products={[]} tipo="mercado" suppliers={[]} onOpen={() => {}} contas={contas} onVerContas={onVerContas} />);
    expect(screen.queryByText(/Tudo certo/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Conta atrasada/ }));
    expect(screen.getByRole("button", { name: /Conta vence hoje/ }).textContent).toMatch(/R\$\s20,00/);
    expect(onVerContas).toHaveBeenCalled();
  });
  it("sem produtos e sem contas, não aparece", () => {
    const { container } = render(<AtencaoHoje products={[]} tipo="mercado" suppliers={[]} onOpen={() => {}} contas={resumoPagamentos([], hoje)} />);
    expect(container.textContent).toBe("");
  });
});
