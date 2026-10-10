import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PainelPedidos } from "@/components/PainelPedidos";
import type { Product, Supplier } from "@/lib/produto";
import { linhasDoPedido, quantidadeTexto, totalPedido, valorItemPedido, type Pedido } from "@/lib/pedido";

const fornecedor: Supplier = { id: "f-1", dbId: "f-1", nome: "Monica Kazama", tel: "14999998888", email: "" };
const comercio = { id: "c-1", tipo: "mercado", nome: "Supermercado União", cidade: "Jacarezinho", uf: "PR", rua: "Rua A", numero: "1", bairro: "Centro" };
const produto: Product = {
  id: "p-1", db: { id: "p-1", contadas: [] }, codigo: "7891095154258", nome: "Bicarbonato de sódio Kitano 30 g",
  compra: 100, venda: 200, unidade: "Unidade", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: "f-1",
  embalagens: [{ uid: "e-1", tipo: "Pacote", qtd: 10, codigo: "2900000000018", preco: 1000 }],
};
const pedido: Pedido = {
  id: "pedido-1", numero: 1, fornecedorId: "f-1", situacao: "enviado", canal: "whatsapp", enviadoEm: "2026-10-10T12:00:00Z",
  criadoEm: "2026-10-10T11:00:00Z", token: "a".repeat(64), observacao: "Entregar de manhã",
  itens: [{ produtoId: "p-1", variacaoId: null, embalagemId: "e-1", qtdEmbalagens: 5, qtdUnidades: 50, precoEstimado: 100, qtdConfirmada: null, qtdRecebida: null }],
};
function abrir(pedidos = [pedido], products = [produto], extra = {}) {
  const props = {
    products, store: comercio, suppliers: [fornecedor], pedidos, onSalvar: vi.fn(), onEnviado: vi.fn(), onCancelar: vi.fn(),
    onNovoLink: vi.fn(), onPagamento: vi.fn(), onOpenProduto: vi.fn(), ...extra,
  };
  render(<PainelPedidos {...props} />);
  return props;
}
function detalhe(numero = 1) { fireEvent.click(screen.getByRole("button", { name: new RegExp(`Pedido nº ${numero}\\b`) })); }
function dado(t: string) {
  return screen.getByText(t, { selector: "dt" }).parentElement!.querySelector("dd")!.textContent;
}

describe("polimento do detalhe do pedido", () => {
  it("explica os cinco pacotes com dez unidades e o valor de compra", () => {
    const props = abrir(); detalhe();
    expect(dado("Quantidade pedida")).toBe("5 pacotes");
    expect(dado("Cada pacote contém")).toBe("10 unidades");
    expect(dado("Total pedido")).toBe("50 unidades");
    expect(dado("Preço por pacote (estimado)")).toMatch(/R\$\s10,00/);
    const sec = within(screen.getByRole("region", { name: "Produtos do pedido" }));
    expect(sec.getAllByText(/R\$\s50,00/)).toHaveLength(2); // subtotal e total
    expect(sec.getByText("Subtotal estimado")).toBeTruthy();
    expect(props.onSalvar).not.toHaveBeenCalled();
    expect(props.onPagamento).not.toHaveBeenCalled();
  });

  it("mudar o preço e o conteúdo atual da embalagem não muda a compra anterior nem a ficha aberta", () => {
    const atual: Product = { ...produto, compra: 300, embalagens: [{ ...produto.embalagens![0]!, qtd: 20, preco: 4000 }] };
    const props = abrir([pedido], [atual]); detalhe();
    expect(dado("Cada pacote contém")).toBe("10 unidades");
    expect(dado("Total pedido")).toBe("50 unidades");
    expect(dado("Preço por pacote (estimado)")).toMatch(/R\$\s10,00/);
    expect(screen.queryByText(/R\$\s200,00/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver produto" }));
    expect(props.onOpenProduto).toHaveBeenCalledWith(atual);
    expect(props.onOpenProduto.mock.calls[0]![0]).toBe(atual);
    expect(atual.embalagens![0]!.qtd).toBe(20);
  });

  it("embalagem removida continua mostrando a conversão salva, sem inventar o tipo", () => {
    abrir([pedido], [{ ...produto, embalagens: [] }]); detalhe();
    expect(dado("Quantidade pedida")).toBe("5 embalagens");
    expect(dado("Cada embalagem contém")).toBe("10 unidades");
    expect(dado("Total pedido")).toBe("50 unidades");
    expect(dado("Preço por embalagem (estimado)")).toMatch(/R\$\s10,00/);
    expect(screen.queryByText("5 caixas")).toBeNull();
  });

  it("produto indisponível mantém quantidades e preço registrados", () => {
    abrir([pedido], []); detalhe();
    expect(dado("Total pedido")).toBe("50 unidades");
    expect(screen.getByRole("button", { name: "Produto indisponível no cadastro" })).toBeDisabled();
    expect(screen.getAllByText(/R\$\s50,00/)).toHaveLength(2);
  });

  it("frações e preços por Kg vêm do pedido, não do cadastro atual", () => {
    const fracionado: Product = { ...produto, unidade: "Kg", compra: 999, embalagens: [{ ...produto.embalagens![0]!, tipo: "Saco", qtd: 30 }] };
    abrir([{ ...pedido, itens: [{ ...pedido.itens[0]!, qtdEmbalagens: 2, qtdUnidades: 25, precoEstimado: 400 }] }], [fracionado]); detalhe();
    expect(dado("Quantidade pedida")).toBe("2 sacos");
    expect(dado("Cada saco contém")).toBe("12,5 Kg");
    expect(dado("Total pedido")).toBe("25 Kg");
    expect(dado("Preço por saco (estimado)")).toMatch(/R\$\s50,00/);
  });

  it.each([0, 250])("compra avulsa preserva o preço salvo de %i centavos", (precoEstimado) => {
    abrir([{ ...pedido, itens: [{ ...pedido.itens[0]!, embalagemId: null, qtdEmbalagens: 3, qtdUnidades: 3, precoEstimado }] }], [{ ...produto, compra: 999 }]); detalhe();
    expect(dado("Quantidade pedida")).toBe("3 unidades");
    expect(dado("Preço por unidade (estimado)")).toMatch(precoEstimado ? /R\$\s2,50/ : /R\$\s0,00/);
    expect(screen.queryByText("Cada pacote contém")).toBeNull();
  });

  it("preço ausente não é mostrado como compra grátis", () => {
    abrir([{ ...pedido, itens: [{ ...pedido.itens[0]!, precoEstimado: null }] }]); detalhe();
    expect(dado("Preço por pacote (estimado)")).toBe("Não informado");
    expect(screen.queryByText(/R\$\s0,00/)).toBeNull();
    expect(screen.getByText(/Há item sem preço informado/)).toBeTruthy();
  });

  it("estimativa parcial avisa que um preço está faltando", () => {
    abrir([{ ...pedido, itens: [pedido.itens[0]!, { ...pedido.itens[0]!, embalagemId: null, precoEstimado: null }] }]); detalhe();
    expect(screen.getByText("Estimativa parcial")).toBeTruthy();
    expect(screen.getByText(/Há item sem preço informado/)).toBeTruthy();
    expect(screen.getAllByText(/R\$\s50,00/)).toHaveLength(2);
  });

  it("pedido, confirmação parcial, recebido e valor do fornecedor ficam separados", () => {
    abrir([{ ...pedido, situacao: "recebido_parcial", itens: [{ ...pedido.itens[0]!, qtdConfirmada: 4, qtdRecebida: 30 }],
      resposta: { em: "2026-10-10T14:00:00Z", previsaoEntrega: "2026-10-13", valorTotal: 4200, forma: "pix", prazoDias: null, recado: "" } }]); detalhe();
    expect(dado("Quantidade pedida")).toBe("5 pacotes");
    expect(screen.getByText("Fornecedor confirmou 4 pacotes (40 unidades)")).toBeTruthy();
    expect(screen.getByText("30 unidades")).toBeTruthy();
    expect(dado("Valor informado pelo fornecedor")).toMatch(/R\$\s42,00/);
    expect(screen.getAllByText(/R\$\s50,00/)).toHaveLength(2);
  });
});

describe("lista organizada de pedidos", () => {
  const lista: Pedido[] = [pedido,
    { ...pedido, id: "pedido-2", numero: 2, situacao: "recebido", pagamento: { situacao: "a_pagar", vencimento: null, pagoEm: null } },
    { ...pedido, id: "pedido-3", numero: 3, situacao: "cancelado" },
    { ...pedido, id: "pedido-4", numero: 4, situacao: "recusado" },
    { ...pedido, id: "pedido-5", numero: 5, situacao: "recebido_parcial" },
  ];
  const numeros = () => screen.getAllByRole("button", { name: /Pedido nº/ }).map((b) => b.textContent!.match(/Pedido nº (\d+)/)![1]);

  it("separa andamento, histórico e contas, sem misturar recebimento com pagamento", () => {
    abrir(lista);
    fireEvent.click(screen.getByRole("button", { name: "Em andamento (2)" }));
    expect(numeros()).toEqual(["1", "5"]);
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    expect(numeros()).toEqual(["2", "3", "4"]);
    fireEvent.click(screen.getByRole("button", { name: "Contas a pagar (1)" }));
    expect(numeros()).toEqual(["2"]);
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(numeros()).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("busca número ou fornecedor, ignora acentos e mantém a busca ao voltar", () => {
    abrir(lista);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar pedido" }), { target: { value: "2" } });
    expect(numeros()).toEqual(["2"]);
    detalhe(2);
    fireEvent.click(screen.getByRole("button", { name: "Pedidos" }));
    expect(screen.getByRole("searchbox", { name: "Buscar pedido" })).toHaveValue("2");
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar pedido" }), { target: { value: " MÔNICA " } });
    expect(numeros()).toHaveLength(5);
  });

  it("busca vazia e filtro vazio orientam o dono sem gravar nada", () => {
    const props = abrir();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar pedido" }), { target: { value: "não existe" } });
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum pedido encontrado");
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar pedido" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum pedido neste filtro");
    expect(props.onSalvar).not.toHaveBeenCalled();
  });

  it("o polimento continua sugerindo cinco pacotes só pelo depósito, mesmo com a gôndola vazia", () => {
    abrir([], [{ ...produto, deposito: { local: "A", qtd: 0, min: 5, max: 50 }, areaVenda: { local: "G", qtd: 0, min: 10, max: 100 } }]);
    fireEvent.click(screen.getByRole("button", { name: "Novo pedido" }));
    expect(screen.getByLabelText(`Quantidade de ${produto.nome}`)).toHaveValue("5");
    expect(screen.getByText("= 50 unidades")).toBeTruthy();
  });
});

describe("quantidades registradas no pedido", () => {
  it("reenvio mantém as cinquenta unidades mesmo se o pacote atual mudou para vinte", () => {
    const atual = { ...produto, embalagens: [{ ...produto.embalagens![0]!, qtd: 20 }] };
    const l = linhasDoPedido(pedido, [atual])[0]!;
    expect(quantidadeTexto(l)).toBe("5 pacotes (50 unidades)");
    expect(l.p).toBe(atual);
    expect(totalPedido(pedido)).toBe(5000);
    expect(valorItemPedido(pedido.itens[0]!)).toBe(5000);
    expect(valorItemPedido({ ...pedido.itens[0]!, precoEstimado: null })).toBeNull();
  });
});
