/* B3 (checklist funcional 3): "Para comprar"/"Para repor" das abas Depósito e Gôndolas com a mesma regra do Início
   e do "Atenção hoje": conta produtos (não tamanhos/cores), produto que acabou de vez fica em "Acabaram" e já pedido
   não conta para comprar (aparece "Já pedido"). */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Product } from "@/components/ProductArea";
import { PainelLocais } from "@/components/PainelLocais";
import { resumoComercio } from "@/lib/resumoGeral";

let id = 0;
const b = (nome: string, dep: number, ven: number, extra: Partial<Product> = {}): Product => ({
  id: ++id, codigo: String(id), nome, compra: 100, venda: 200, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: null,
  deposito: { local: "Estante A", qtd: dep, min: 10, max: null }, areaVenda: { local: "Gôndola 3", qtd: ven, min: 5, max: null }, db: { id: `p${id}` }, ...extra,
} as unknown as Product);
const arroz = b("Arroz", 6, 3);    // comprar + repor
const feijao = b("Feijão", 0, 0);  // acabou de vez
const cafe = b("Café", 8, 12);     // comprar (já pedido)
const camisa = b("Camiseta", 0, 0, { unidade: "Peça", variacoes: [{ tam: "M", cor: "Azul", qtd: 1, uid: "a" }, { tam: "G", cor: "Azul", qtd: 1, uid: "c" }],
  deposito: { local: "Estante A", qtd: null, min: null, max: null, vars: { a: { qtd: 2, min: 4, max: null }, c: { qtd: 1, min: 4, max: null } } },
  areaVenda: { local: "Gôndola 3", qtd: null, min: null, max: null, vars: { a: { qtd: 1, min: 2, max: null }, c: { qtd: 9, min: 2, max: null } } } });
const produtos = [arroz, feijao, cafe, camisa];
const pedidos = new Set(["p3"]);
const numero = (rotulo: string) => Number(screen.getByText(rotulo).previousElementSibling!.textContent);

describe("B3 — abas Depósito e Gôndolas batem com o Início", () => {
  it("depósito: Para comprar = Início (sem acabou de vez, sem já pedido, um por produto)", () => {
    render(<PainelLocais products={produtos} tipo="mercado" area="dep" jaPedidos={pedidos} onOpen={() => {}} />);
    const r = resumoComercio(produtos, "mercado", new Date().toISOString().slice(0, 10), [
      { situacao: "enviado", itens: [{ produtoId: "p3" }] } as never]);
    expect(numero("Para comprar")).toBe(2); // Arroz e Camiseta
    expect(numero("Para comprar")).toBe(r.comprar);
    const estante = within(screen.getByRole("region", { name: "Estante A" }));
    expect(estante.getByText("Já pedido")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Precisam de atenção/ }));
    expect(screen.queryByText("Café")).toBeNull();
  });
  it("gôndola: Para repor = Início", () => {
    render(<PainelLocais products={produtos} tipo="mercado" area="ven" onOpen={() => {}} />);
    const r = resumoComercio(produtos, "mercado", new Date().toISOString().slice(0, 10), []);
    expect(numero("Para repor")).toBe(2); // Arroz e Camiseta (M)
    expect(numero("Para repor")).toBe(r.repor);
  });
});
