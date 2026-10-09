import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Product } from "@/components/ProductArea";
import { PainelLocais } from "@/components/PainelLocais";
import { porLocal } from "@/lib/situacao";

const HOJE = "2026-10-09";
let id = 0;
const b = (nome: string, extra: Partial<Product> = {}): Product => ({
  id: ++id, codigo: String(id), nome, compra: 100, venda: 200, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: null,
  deposito: { local: "Estante A", qtd: 40, min: 10, max: 60 }, areaVenda: { local: "Gôndola 3", qtd: 12, min: 5, max: 20 }, ...extra,
});
const arroz = b("Arroz");
const feijao = b("Feijão", { deposito: { local: "estante a", qtd: 8, min: 10, max: null }, areaVenda: { local: "Gôndola 10", qtd: 3, min: 5, max: 20 } });
const cafe = b("Café", { deposito: { local: "Estante B", qtd: 0, min: 5, max: null }, areaVenda: { local: null, qtd: 2, min: null, max: null } });
const acucar = b("Açúcar", { deposito: undefined, areaVenda: undefined });
const leite = b("Leite", { areaVenda: { local: "Geladeira", qtd: 6, min: 2, max: 12 },
  validade: { controla: true, avisos: [], dep: {}, ven: { _: [{ id: "x", qtd: 6, data: "2026-10-01", lote: null }] } } });
const todos = [arroz, feijao, cafe, acucar, leite];

describe("agrupar por local", () => {
  it("depósito: junta nomes iguais (maiúsculas), ordena e marca o estado", () => {
    const d = porLocal(todos, "dep", HOJE, ["Câmara fria"]);
    expect(d.grupos.map((g) => g.local)).toEqual(["Câmara fria", "Estante A", "Estante B"]);
    expect(d.grupos[1]!.itens.map((i) => [i.nome, i.estado])).toEqual([["Arroz", "ok"], ["Feijão", "abaixo"], ["Leite", "ok"]]);
    expect(d.grupos[2]!.itens[0]!.estado).toBe("acabou");
    expect(d.grupos[0]!.itens).toEqual([]);
    expect(d.naoConfigurados.map((p) => p.nome)).toEqual(["Açúcar"]);
    expect(d.resumo).toEqual({ locais: 3, produtos: 4, abaixo: 1, acabou: 1, vencido: 0 });
  });
  it("gôndola: ordem numérica dos locais, sem local e vencido", () => {
    const d = porLocal(todos, "ven", HOJE);
    expect(d.grupos.map((g) => g.local)).toEqual(["Geladeira", "Gôndola 3", "Gôndola 10"]);
    expect(d.semLocal.map((i) => i.nome)).toEqual(["Café"]);
    expect(d.grupos[0]!.itens[0]!.estado).toBe("vencido");
    expect(d.resumo.vencido).toBe(1);
  });
  it("roupas: uma linha por variação", () => {
    const camisa = b("Camiseta", { unidade: "Peça", variacoes: [{ tam: "M", cor: "Azul", qtd: 1, uid: "a" }, { tam: "G", cor: "Azul", qtd: 1, uid: "c" }],
      deposito: { local: "Estoque", qtd: null, min: null, max: null, vars: { a: { qtd: 3, min: 4, max: null }, c: { qtd: 5, min: null, max: null } } } });
    const d = porLocal([camisa], "dep", HOJE);
    expect(d.grupos[0]!.itens.map((i) => [i.variacao, i.qtd, i.estado])).toEqual([["G · Azul", 5, "ok"], ["M · Azul", 3, "abaixo"]]);
    expect(d.resumo.produtos).toBe(1);
  });
});

describe("abas na tela", () => {
  it("depósito: resumo, locais, 'Comprar' e abrir o produto", () => {
    const onOpen = vi.fn();
    render(<PainelLocais products={todos} tipo="mercado" area="dep" onOpen={onOpen} />);
    expect(screen.getByText("Para comprar").previousElementSibling!.textContent).toBe("2");
    const a = within(screen.getByRole("region", { name: "Estante A" }));
    expect(a.getByText("Comprar")).toBeTruthy();
    expect(a.getByText("3 produtos")).toBeTruthy();
    fireEvent.click(a.getByRole("button", { name: /Feijão/ }));
    expect(onOpen).toHaveBeenCalledWith(feijao);
  });
  it("gôndola: 'Repor', aviso de vencido, sem local e não configurados", () => {
    render(<PainelLocais products={todos} tipo="mercado" area="ven" onOpen={() => {}} />);
    expect(within(screen.getByRole("region", { name: "Gôndola 10" })).getByText("Repor")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/1 produto vencido na gôndola/);
    expect(screen.getByRole("region", { name: "Sem local definido" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /1 produto ainda não tem gôndola configurada/ }));
    expect(screen.getByRole("button", { name: "Açúcar" })).toBeTruthy();
  });
  it("filtro mostra só o que precisa de atenção", () => {
    render(<PainelLocais products={todos} tipo="mercado" area="ven" onOpen={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Precisam de atenção/ }));
    expect(screen.queryByRole("region", { name: "Gôndola 3" })).toBeNull();
    expect(screen.getByRole("region", { name: "Gôndola 10" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Geladeira" })).toBeTruthy();
  });
  it("farmácia fala estoque e área de venda", () => {
    render(<PainelLocais products={[]} tipo="farmacia" area="dep" onOpen={() => {}} />);
    expect(screen.getByText("Nada no estoque ainda")).toBeTruthy();
  });
});
