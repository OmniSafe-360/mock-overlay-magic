import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Product, Supplier } from "@/components/ProductArea";
import { PainelPedidos } from "@/components/PainelPedidos";
import { AtencaoHoje } from "@/components/AtencaoHoje";
import { faltaParaMaximo, quantidadeTexto, sugerirPedido, sugerirQuantidade, textoPedido, totalLinhas, type Pedido } from "@/lib/pedido";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const sol: Supplier = { id: 1, nome: "Distribuidora Sol", tel: "11988887777", email: "vendas@sol.com.br", dbId: "f-sol" };
const lua: Supplier = { id: 2, nome: "Atacado Lua", tel: "", email: "", dbId: "f-lua" };
const caixa12 = { uid: "e-cx", tipo: "Caixa", qtd: 12, codigo: "", preco: 3000 };
const fardo6 = { uid: "e-fd", tipo: "Fardo", qtd: 6, codigo: "", preco: 0 };
let n = 0;
const b = (nome: string, extra: Partial<Product> = {}): Product => ({
  id: ++n, codigo: String(n), nome, compra: 250, venda: 400, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: 1,
  db: { id: `p-${n}`, contadas: [] }, deposito: { local: "A", qtd: 40, min: 10, max: 60 }, areaVenda: { local: "G", qtd: 12, min: 5, max: 20 }, ...extra,
});
const arroz = b("Arroz Camil 5 kg", { deposito: { local: "A", qtd: 10, min: 12, max: 60 }, embalagens: [caixa12, fardo6] });
const cafe = b("Café Pilão", { deposito: { local: "A", qtd: 0, min: 5, max: null } });
const ok = b("Feijão");
const semForn = b("Açúcar", { fornecedor: null, deposito: { local: "A", qtd: 1, min: 3, max: null } });
const doLua = b("Óleo", { fornecedor: 2, deposito: { local: "A", qtd: 2, min: 4, max: 12 } });
const comercio = { id: "c1", tipo: "mercado", nome: "Mercado Bom Preço", cidade: "Ourinhos", uf: "SP", rua: "Rua X", numero: "123", bairro: "Centro" };

describe("regras do pedido", () => {
  it("quanto falta para o máximo (sem máximo: dobro do mínimo)", () => {
    expect(faltaParaMaximo(10, 12, 60)).toBe(50);
    expect(faltaParaMaximo(0, 5, null)).toBe(10);
    expect(faltaParaMaximo(70, 12, 60)).toBeNull();
    expect(faltaParaMaximo(null, 12, 60)).toBeNull();
  });
  it("embalagem fechada: a maior que cabe; arredonda para cima", () => {
    expect(sugerirQuantidade(50, "Pacote", [caixa12, fardo6])).toEqual({ embalagem: caixa12, qtd: 5 });
    expect(sugerirQuantidade(4, "Pacote", [caixa12, fardo6])).toEqual({ embalagem: fardo6, qtd: 1 });
    expect(sugerirQuantidade(10, "Pacote", [])).toEqual({ embalagem: null, qtd: 10 });
    expect(sugerirQuantidade(2.3, "Kg", [])).toEqual({ embalagem: null, qtd: 2.3 });
  });
  it("sugere só quem chegou ao mínimo, por fornecedor; já pedidos e sem fornecedor ficam de fora", () => {
    const s = sugerirPedido([arroz, cafe, ok, semForn, doLua], [sol, lua], new Set());
    expect(s.porFornecedor.get(1)!.map((l) => [l.p.nome, l.embalagem?.tipo ?? "un", l.qtd])).toEqual([["Arroz Camil 5 kg", "Caixa", 5], ["Café Pilão", "un", 10]]);
    expect(s.porFornecedor.get(2)!.map((l) => l.qtd)).toEqual([10]);
    expect(s.semFornecedor.map((p) => p.nome)).toEqual(["Açúcar"]);
    expect(sugerirPedido([arroz], [sol], new Set([arroz.db!.id])).porFornecedor.size).toBe(0);
  });
  it("texto do pedido e total", () => {
    const s = sugerirPedido([arroz, cafe], [sol], new Set()).porFornecedor.get(1)!;
    expect(quantidadeTexto(s[0]!)).toBe("5 caixas (60 pacotes)");
    expect(totalLinhas(s)).toBe(5 * 3000 + 10 * 250);
    expect(textoPedido({ numero: 7, comercio, fornecedor: "Distribuidora Sol", linhas: s, observacao: "Entregar de manhã" })).toBe(
      "Olá, Distribuidora Sol! Segue o pedido nº 7 de Mercado Bom Preço:\n\n• Arroz Camil 5 kg — 5 caixas (60 pacotes)\n• Café Pilão — 10 pacotes\n\nEntrega: Rua X, 123 – Centro – Ourinhos/SP\nRecado: Entregar de manhã\nPor favor, confirme o preço e a previsão de entrega. Obrigado!");
  });
});

const pedidoEnviado: Pedido = { id: "ped-1", numero: 3, fornecedorId: "f-sol", situacao: "enviado", canal: "whatsapp", enviadoEm: "2026-10-09T12:00:00Z", observacao: "",
  token: "t".repeat(64), criadoEm: "2026-10-09T11:00:00Z",
  itens: [{ produtoId: arroz.db!.id, variacaoId: null, embalagemId: "e-cx", qtdEmbalagens: 2, qtdUnidades: 24, precoEstimado: 250, qtdConfirmada: null, qtdRecebida: null }] };

function abrir(extra: Partial<Parameters<typeof PainelPedidos>[0]> = {}) {
  const props = { products: [arroz, cafe, ok, semForn, doLua], store: comercio, suppliers: [sol, lua], pedidos: [] as Pedido[],
    onSalvar: vi.fn(async () => ({ id: "novo", numero: 8 })), onEnviado: vi.fn(async () => {}), onCancelar: vi.fn(async () => {}), onOpenProduto: vi.fn(), ...extra };
  render(<PainelPedidos {...props} />);
  return props;
}

describe("aba Pedidos", () => {
  it("lista vazia convida a fazer o primeiro pedido", () => {
    abrir();
    expect(screen.getByText("Nenhum pedido ainda")).toBeTruthy();
  });
  it("montar: sugestão por fornecedor, ajustar quantidade e salvar; depois enviar pelo WhatsApp", async () => {
    const t = abrir();
    fireEvent.click(screen.getByRole("button", { name: /Novo pedido/ }));
    const g = within(screen.getByRole("region", { name: "Distribuidora Sol" }));
    expect((g.getByLabelText("Quantidade de Arroz Camil 5 kg") as HTMLInputElement).value).toBe("5");
    fireEvent.click(g.getAllByRole("button", { name: "Aumentar" })[0]!);
    expect(g.getByText(/= 72 pacotes/)).toBeTruthy();
    fireEvent.click(g.getByRole("button", { name: "Tirar Café Pilão" }));
    fireEvent.click(g.getByRole("button", { name: /Salvar e enviar/ }));
    await waitFor(() => expect(t.onSalvar).toHaveBeenCalled());
    const arg = (t.onSalvar as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { fornecedor: Supplier; linhas: { qtd: number }[] };
    expect(arg.fornecedor).toBe(sol);
    expect(arg.linhas.map((l) => l.qtd)).toEqual([6]);
    const dlg = within(await screen.findByRole("dialog"));
    expect(dlg.getByText(/Pedido nº 8 salvo/)).toBeTruthy();
    const wa = dlg.getByRole("link", { name: /Enviar pelo WhatsApp/ });
    expect(wa.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=Ol%C3%A1%2C%20Distribuidora%20Sol!%20Segue%20o%20pedido%20n%C2%BA%208/);
    fireEvent.click(wa);
    expect(t.onEnviado).toHaveBeenCalledWith("novo", "whatsapp");
    fireEvent.click(dlg.getByRole("button", { name: "Pronto" }));
    expect(screen.queryByRole("region", { name: "Distribuidora Sol" })).toBeNull();
    expect(screen.getByText(/1 pedido salvo/)).toBeTruthy();
  });
  it("fornecedor sem WhatsApp avisa e oferece copiar o texto", async () => {
    const t = abrir();
    fireEvent.click(screen.getByRole("button", { name: /Novo pedido/ }));
    fireEvent.click(within(screen.getByRole("region", { name: "Atacado Lua" })).getByRole("button", { name: /Salvar e enviar/ }));
    const dlg = within(await screen.findByRole("dialog"));
    expect(dlg.getByText(/Sem WhatsApp cadastrado/)).toBeTruthy();
    expect(dlg.queryByRole("link")).toBeNull();
    fireEvent.click(dlg.getByRole("button", { name: /Copiar texto/ }));
    expect(t.onEnviado).toHaveBeenCalledWith("novo", "copiado");
  });
  it("produto sem fornecedor aparece com a orientação", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Novo pedido/ }));
    expect(within(screen.getByRole("region", { name: "Sem fornecedor" })).getByText("• Açúcar")).toBeTruthy();
  });
  it("produto já pedido não é sugerido de novo", () => {
    abrir({ pedidos: [pedidoEnviado] });
    fireEvent.click(screen.getByRole("button", { name: /Novo pedido/ }));
    const g = within(screen.getByRole("region", { name: "Distribuidora Sol" }));
    expect(g.queryByText("Arroz Camil 5 kg")).toBeNull();
    expect(screen.getByText(/1 produto já está num pedido em andamento/)).toBeTruthy();
  });
  it("adicionar produto pela lista do fornecedor", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Novo pedido/ }));
    const g = within(screen.getByRole("region", { name: "Distribuidora Sol" }));
    fireEvent.click(g.getByRole("button", { name: /Adicionar produto/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Feijão/ }));
    expect(g.getByText("Feijão")).toBeTruthy();
  });
  it("lista e detalhe: situação, total e cancelar com confirmação", async () => {
    const t = abrir({ pedidos: [pedidoEnviado] });
    const card = screen.getByRole("button", { name: /Pedido nº 3/ });
    expect(card.textContent).toMatch(/Aguardando resposta/);
    expect(card.textContent).toMatch(/Enviado em 09\/10 pelo WhatsApp · 1 produto · R\$\s60,00/);
    fireEvent.click(card);
    expect(screen.getByText("2 caixas (24 pacotes)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar pedido/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    await waitFor(() => expect(t.onCancelar).toHaveBeenCalledWith("ped-1"));
  });
  it("abrir já na montagem (vindo do Atenção hoje)", () => {
    abrir({ montarAgora: true });
    expect(screen.getByText("Novo pedido", { selector: "h2" })).toBeTruthy();
  });
});

describe("Atenção hoje com pedidos", () => {
  it("já pedidos saem de Comprar; botão Fazer pedido", () => {
    const onFazerPedido = vi.fn();
    render(<AtencaoHoje products={[arroz, cafe]} tipo="mercado" suppliers={[sol]} onOpen={() => {}} jaPedidos={new Set([arroz.db!.id])} onFazerPedido={onFazerPedido} />);
    expect(screen.getByRole("button", { name: /Já pedidos/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^\d+\s*Comprar$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fazer pedido" }));
    expect(onFazerPedido).toHaveBeenCalled();
  });
});
