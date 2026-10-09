import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Product, Supplier } from "@/components/ProductArea";
import { PainelPedidos } from "@/components/PainelPedidos";
import { PaginaFornecedor } from "@/components/PaginaFornecedor";
import type { PedidoPublico, RespostaFornecedor } from "@/lib/banco";
import { dataEntregaTexto, hojeISO, linkPedido, qtdItemTexto, respostaItem, resumoResposta, type Pedido } from "@/lib/pedido";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const TOKEN = "a".repeat(64);
const amanha = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return hojeISO(d); })();

describe("regras da resposta do fornecedor", () => {
  it("quantidade com embalagem e sem embalagem", () => {
    expect(qtdItemTexto({ unidade: "Frasco", embalagem: "Caixa", porEmbalagem: 12 }, 2)).toBe("2 caixas com 12 (24 frascos)");
    expect(qtdItemTexto({ unidade: "Pacote", embalagem: "Fardo", porEmbalagem: 6 }, 1)).toBe("1 fardo com 6 (6 pacotes)");
    expect(qtdItemTexto({ unidade: "Pacote", embalagem: null, porEmbalagem: null }, 10)).toBe("10 pacotes");
  });
  it("tudo, parte ou nada", () => {
    expect(respostaItem(2, null)).toBeNull();
    expect(respostaItem(2, 2)).toBe("tudo");
    expect(respostaItem(2, 3)).toBe("tudo");
    expect(respostaItem(2, 1)).toBe("parte");
    expect(respostaItem(2, 0)).toBe("nada");
  });
  it("resumo para o cartão e data por extenso", () => {
    expect(dataEntregaTexto("2026-10-10")).toBe("sábado, 10/10");
    expect(resumoResposta({ em: "", previsaoEntrega: "2026-10-13", valorTotal: 12000, forma: "boleto", prazoDias: 30, recado: "" }, brl))
      .toMatch(/^Entrega terça, 13\/10 · R\$\s120,00 · Boleto 30 dias$/);
    expect(resumoResposta({ em: "", previsaoEntrega: "2026-10-13", valorTotal: null, forma: null, prazoDias: null, recado: "" }, brl)).toBe("Entrega terça, 13/10");
  });
  it("link do pedido", () => {
    expect(linkPedido("abc", "https://loja.app")).toBe("https://loja.app/pedido/abc");
  });
});

const publico = (extra: Partial<PedidoPublico> = {}): PedidoPublico => ({
  numero: 12, situacao: "enviado", fornecedor: "Distribuidora Sol", observacao: "Entregar de manhã", enviadoEm: "2026-10-09T12:00:00Z", podeResponder: true,
  comercio: { nome: "Farmácia Vida", rua: "Rua das Flores", numero: "45", bairro: "Centro", cidade: "Ourinhos", uf: "SP", complemento: "", telefone: "14999998888" },
  resposta: null,
  itens: [
    { id: "i1", produto: "Dipirona 500 mg", codigo: "7891234567895", unidade: "Frasco", variacao: null, embalagem: "Caixa", porEmbalagem: 12, qtdEmbalagens: 2, qtdUnidades: 24, qtdConfirmada: null },
    { id: "i2", produto: "Soro fisiológico", codigo: null, unidade: "Unidade", variacao: null, embalagem: null, porEmbalagem: null, qtdEmbalagens: 10, qtdUnidades: 10, qtdConfirmada: null },
  ],
  ...extra,
});

function abrirPagina(p: PedidoPublico | null, responder = vi.fn(async (_t: string, _r: RespostaFornecedor): Promise<unknown> => "aceito")) {
  let atual = p;
  const carregar = vi.fn(async () => atual);
  render(<PaginaFornecedor token={TOKEN} carregar={carregar} responder={async (t, r) => {
    await responder(t, r);
    if (atual) atual = { ...atual, situacao: r.aceito ? "aceito_ajustes" : "recusado", resposta: { em: "2026-10-09T15:00:00Z", previsaoEntrega: r.previsaoEntrega, valorTotal: r.valorTotal, forma: r.forma, prazoDias: r.prazoDias, recado: r.recado },
      itens: atual.itens.map((i) => ({ ...i, qtdConfirmada: r.itens.find((x) => x.id === i.id)?.qtdConfirmada ?? null })) };
  }} />);
  return { carregar, responder };
}

describe("página do fornecedor (link)", () => {
  it("mostra o pedido sem preços, com endereço, telefone e recado", async () => {
    abrirPagina(publico());
    expect(await screen.findByText("Farmácia Vida")).toBeTruthy();
    expect(screen.getByText(/Pedido nº 12/)).toBeTruthy();
    expect(screen.getByText("Rua das Flores, 45 – Centro – Ourinhos/SP")).toBeTruthy();
    expect(screen.getByRole("link", { name: /\(14\) 99999-8888/ }).getAttribute("href")).toBe("tel:14999998888");
    expect(screen.getByText("Entregar de manhã")).toBeTruthy();
    expect(screen.getByText("2 caixas com 12 (24 frascos)")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/R\$\s?\d/);
  });
  it("confirmar: pede a data, ajusta um item, forma e prazo; envia tudo", async () => {
    const { responder } = abrirPagina(publico());
    await screen.findByText("Farmácia Vida");
    expect(screen.getByText("Informe a data prevista de entrega.")).toBeTruthy();
    const dip = within(screen.getByRole("group", { name: "Resposta para Dipirona 500 mg" }));
    expect(dip.getByRole("button", { name: "Tenho" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(dip.getByRole("button", { name: "Outra qtd." }));
    expect(screen.getByText("Vai mandar 1 caixa com 12 (12 frascos)")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("group", { name: "Resposta para Soro fisiológico" })).getByRole("button", { name: "Não tenho" }));
    fireEvent.change(screen.getByLabelText("Data prevista de entrega"), { target: { value: amanha } });
    fireEvent.change(screen.getByLabelText("Valor total"), { target: { value: "23880" } });
    expect((screen.getByLabelText("Valor total") as HTMLInputElement).value).toMatch(/R\$\s238,80/);
    fireEvent.click(screen.getByRole("button", { name: "Boleto" }));
    fireEvent.click(screen.getByRole("button", { name: "28" }));
    fireEvent.change(screen.getByPlaceholderText("Ex.: entrego pela manhã"), { target: { value: "Soro só semana que vem" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pedido/ }));
    await waitFor(() => expect(responder).toHaveBeenCalled());
    const r = responder.mock.calls[0]![1];
    expect(r).toEqual({ aceito: true, itens: [{ id: "i1", qtdConfirmada: 1 }, { id: "i2", qtdConfirmada: 0 }], previsaoEntrega: amanha, valorTotal: 23880,
      forma: "boleto", prazoDias: 28, recado: "Soro só semana que vem" });
    expect(await screen.findByText(/já recebeu sua resposta/)).toBeTruthy();
    expect(screen.getByText("Você confirmou o pedido")).toBeTruthy();
    expect(screen.getByText("Não tem")).toBeTruthy();
    expect(screen.getByText("Boleto 28 dias")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Alterar a resposta" }));
    expect(screen.getByRole("button", { name: /Confirmar pedido/ })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Resposta para Soro fisiológico" })).getByRole("button", { name: "Não tenho" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("tudo 'Não tenho' não deixa confirmar", async () => {
    const { responder } = abrirPagina(publico());
    await screen.findByText("Farmácia Vida");
    for (const n of ["Dipirona 500 mg", "Soro fisiológico"]) fireEvent.click(within(screen.getByRole("group", { name: `Resposta para ${n}` })).getByRole("button", { name: "Não tenho" }));
    fireEvent.change(screen.getByLabelText("Data prevista de entrega"), { target: { value: amanha } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pedido/ }));
    expect(screen.getByRole("alert").textContent).toMatch(/pelo menos um produto/);
    expect(responder).not.toHaveBeenCalled();
  });
  it("não posso atender, com confirmação", async () => {
    const { responder } = abrirPagina(publico());
    await screen.findByText("Farmácia Vida");
    fireEvent.click(screen.getByRole("button", { name: "Não posso atender este pedido" }));
    fireEvent.click(screen.getByRole("button", { name: /Sim, não posso atender/ }));
    await waitFor(() => expect(responder).toHaveBeenCalled());
    expect(responder.mock.calls[0]![1].aceito).toBe(false);
    expect(await screen.findByText("Você avisou que não pode atender")).toBeTruthy();
  });
  it("erro do banco aparece em português", async () => {
    abrirPagina(publico(), vi.fn(async (_t: string, _r: RespostaFornecedor): Promise<unknown> => { throw new Error("pedido_fechado"); }));
    await screen.findByText("Farmácia Vida");
    fireEvent.click(screen.getByRole("button", { name: "Amanhã" }));
    expect((screen.getByLabelText("Data prevista de entrega") as HTMLInputElement).value).toBe(amanha);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pedido/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Este pedido já foi recebido ou cancelado.");
  });
  it("link inválido e pedido cancelado", async () => {
    abrirPagina(null);
    expect(await screen.findByText("Este link não vale mais")).toBeTruthy();
  });
  it("pedido cancelado não deixa responder", async () => {
    abrirPagina(publico({ situacao: "cancelado", podeResponder: false }));
    expect(await screen.findByText(/foi/)).toBeTruthy();
    expect(screen.getByText("cancelado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirmar pedido|Responder|Alterar/ })).toBeNull();
  });
});

/* ---------- lado do dono ---------- */
const sol: Supplier = { id: 1, nome: "Distribuidora Sol", tel: "11988887777", email: "", dbId: "f-sol" };
const caixa12 = { uid: "e-cx", tipo: "Caixa", qtd: 12, codigo: "", preco: 3000 };
const arroz: Product = { id: 1, codigo: "1", nome: "Arroz Camil 5 kg", compra: 250, venda: 400, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: 1,
  db: { id: "p-1", contadas: [] }, deposito: { local: "A", qtd: 10, min: 12, max: 60 }, embalagens: [caixa12] };
const feijao: Product = { ...arroz, id: 2, codigo: "2", nome: "Feijão", db: { id: "p-2", contadas: [] }, embalagens: [] };
const comercio = { id: "c1", tipo: "mercado", nome: "Mercado Bom Preço", cidade: "Ourinhos", uf: "SP", rua: "Rua X", numero: "123", bairro: "Centro" };
const respondido: Pedido = {
  id: "ped-1", numero: 3, fornecedorId: "f-sol", situacao: "aceito_ajustes", canal: "whatsapp", enviadoEm: "2026-10-09T12:00:00Z", observacao: "", token: TOKEN, criadoEm: "2026-10-09T11:00:00Z",
  resposta: { em: "2026-10-09T15:00:00Z", previsaoEntrega: "2026-10-13", valorTotal: 12000, forma: "boleto", prazoDias: 30, recado: "Feijão em falta" },
  itens: [
    { produtoId: "p-1", variacaoId: null, embalagemId: "e-cx", qtdEmbalagens: 2, qtdUnidades: 24, precoEstimado: 250, qtdConfirmada: 1, qtdRecebida: null },
    { produtoId: "p-2", variacaoId: null, embalagemId: null, qtdEmbalagens: 10, qtdUnidades: 10, precoEstimado: 250, qtdConfirmada: 0, qtdRecebida: null },
  ],
};
function abrirDono(pedidos: Pedido[], extra = {}) {
  const props = { products: [arroz, feijao], store: comercio, suppliers: [sol], pedidos,
    onSalvar: vi.fn(async () => ({ id: "novo", numero: 8, token: TOKEN })), onEnviado: vi.fn(async () => {}), onCancelar: vi.fn(async () => {}),
    onNovoLink: vi.fn(async () => "b".repeat(64)), onPagamento: vi.fn(async () => {}), onOpenProduto: vi.fn(), ...extra };
  render(<PainelPedidos {...props} />);
  return props;
}

describe("pedido do dono com a resposta do fornecedor", () => {
  it("cartão mostra entrega, valor e pagamento; detalhe mostra o que vem e o que não vem", () => {
    abrirDono([respondido]);
    const card = screen.getByRole("button", { name: /Pedido nº 3/ });
    expect(card.textContent).toMatch(/Aceito com ajustes/);
    expect(card.textContent).toMatch(/Entrega terça, 13\/10 · R\$\s120,00 · Boleto 30 dias/);
    fireEvent.click(card);
    const r = within(screen.getByRole("region", { name: "Resposta do fornecedor" }));
    expect(r.getByText("Aceito, com mudanças nos produtos")).toBeTruthy();
    expect(r.getByText("terça, 13/10")).toBeTruthy();
    expect(r.getByText("Boleto 30 dias")).toBeTruthy();
    expect(r.getByText("Feijão em falta")).toBeTruthy();
    expect(screen.getByText("Vai mandar 1 caixa (12 pacotes)")).toBeTruthy();
    expect(screen.getByText("O fornecedor não tem")).toBeTruthy();
  });
  it("recusado aparece em vermelho no cartão", () => {
    abrirDono([{ ...respondido, situacao: "recusado", resposta: { ...respondido.resposta!, previsaoEntrega: null, valorTotal: null, forma: null, prazoDias: null } }]);
    expect(screen.getByRole("button", { name: /Pedido nº 3/ }).textContent).toMatch(/O fornecedor não pode atender/);
  });
  it("gerar novo link pede confirmação", async () => {
    const t = abrirDono([respondido]);
    fireEvent.click(screen.getByRole("button", { name: /Pedido nº 3/ }));
    fireEvent.click(screen.getByRole("button", { name: /Gerar novo link/ }));
    expect(t.onNovoLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar novo link" }));
    await waitFor(() => expect(t.onNovoLink).toHaveBeenCalledWith("ped-1"));
    expect(await screen.findByText(/O antigo parou de funcionar/)).toBeTruthy();
  });
  it("a mensagem do WhatsApp leva o link do pedido", async () => {
    abrirDono([]);
    fireEvent.click(screen.getByRole("button", { name: /Novo pedido/ }));
    fireEvent.click(within(screen.getByRole("region", { name: "Distribuidora Sol" })).getByRole("button", { name: /Salvar e enviar/ }));
    const dlg = within(await screen.findByRole("dialog"));
    expect(dlg.getByText(new RegExp(`Veja e confirme o pedido aqui: .*/pedido/${TOKEN}`))).toBeTruthy();
    expect(decodeURIComponent(dlg.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")!)).toMatch(new RegExp(`/pedido/${TOKEN}$`));
  });
});
