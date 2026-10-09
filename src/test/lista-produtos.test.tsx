import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Product } from "@/components/ProductArea";
import { ListaProdutos, fraseSituacao } from "@/components/ListaProdutos";
import { situacaoProduto } from "@/lib/situacao";

const base = (nome: string, extra: Partial<Product> = {}): Product => ({
  id: Math.floor(Math.random() * 1e9), codigo: "789" + nome.length, nome, compra: 1000, venda: 1500, unidade: "Pacote", categoria: "Mercearia",
  detalhes: {}, variacoes: [], fornecedor: 1, validade: { controla: false, avisos: [], dep: {}, ven: {} },
  deposito: { local: "A", qtd: 40, min: 10, max: null }, areaVenda: { local: "G", qtd: 12, min: 5, max: null }, ...extra,
});
const ok = base("Arroz");
const repor = base("Feijão", { areaVenda: { local: "G", qtd: 3, min: 5, max: null } });
const acabou = base("Café", { deposito: { local: "A", qtd: 0, min: 10, max: null }, areaVenda: { local: "G", qtd: 0, min: 5, max: null } });
const incompleto = base("Açúcar", { deposito: undefined, areaVenda: undefined });
const sup = [{ id: 1, nome: "Distribuidora Sol", tel: "", email: "" }];

function abrir(ps: Product[]) {
  const onOpen = vi.fn(), onNew = vi.fn();
  render(<ListaProdutos products={ps} tipo="mercado" suppliers={sup} onNew={onNew} onOpen={onOpen} />);
  return { onOpen, onNew };
}
const nomes = () => screen.getAllByRole("listitem").map((li) => li.querySelector("span span")!.textContent);
const filtro = (n: RegExp) => screen.getByRole("button", { name: n });

describe("lista de produtos", () => {
  it("cada linha mostra o total, a divisão e a situação", () => {
    abrir([ok, repor]);
    const linha = within(screen.getAllByRole("listitem")[0]!);
    expect(linha.getByText("52")).toBeTruthy();
    expect(linha.getByText("pacotes")).toBeTruthy();
    expect(linha.getByText("Depósito 40 · Gôndola 12")).toBeTruthy();
    expect(linha.getByText("Tudo certo")).toBeTruthy();
    expect(within(screen.getAllByRole("listitem")[1]!).getByText("Repor a gôndola")).toBeTruthy();
  });
  it("filtro 'Precisam de atenção' mostra só eles, com o mais grave primeiro", () => {
    abrir([ok, repor, acabou, incompleto]);
    expect(filtro(/Precisam de atenção/).textContent).toContain("2");
    fireEvent.click(filtro(/Precisam de atenção/));
    expect(nomes()).toEqual(["Café", "Feijão"]);
    expect(screen.getByText("Acabou")).toBeTruthy();
  });
  it("filtro 'Falta completar' e volta para todos", () => {
    abrir([ok, repor, acabou, incompleto]);
    fireEvent.click(filtro(/^Falta completar\s*\d+$/));
    expect(nomes()).toEqual(["Açúcar"]);
    expect(screen.getByText("não contado")).toBeTruthy();
    fireEvent.click(filtro(/Todos/));
    expect(nomes()).toHaveLength(4);
  });
  it("sem nada para atenção, mensagem tranquila", () => {
    abrir([ok]);
    expect(screen.queryByRole("button", { name: /Falta completar/ })).toBeNull();
    fireEvent.click(filtro(/Precisam de atenção/));
    expect(screen.getByText("Tudo certo! Nenhum produto precisa de atenção agora.")).toBeTruthy();
  });
  it("busca por nome e abre o produto", () => {
    const t = abrir([ok, repor]);
    fireEvent.change(screen.getByPlaceholderText("Buscar por nome ou código"), { target: { value: "fei" } });
    expect(nomes()).toEqual(["Feijão"]);
    fireEvent.click(screen.getByRole("button", { name: /Feijão/ }));
    expect(t.onOpen).toHaveBeenCalledWith(repor);
  });
  it("frase de falta completar", () => {
    expect(fraseSituacao(situacaoProduto(incompleto, "mercado", "2026-10-09"))).toBe("Falta completar o cadastro");
  });
  it("lista vazia convida a cadastrar", () => {
    const t = abrir([]);
    fireEvent.click(screen.getByRole("button", { name: /Novo produto/ }));
    expect(t.onNew).toHaveBeenCalled();
    expect(screen.getByText("Cadastre seu primeiro produto")).toBeTruthy();
  });
});
