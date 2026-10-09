import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Product } from "@/components/ProductArea";
import { AtencaoHoje, dataPorExtenso } from "@/components/AtencaoHoje";
import { atencaoHoje, situacaoProduto } from "@/lib/situacao";

const HOJE = "2026-10-09";
let id = 0;
const b = (nome: string, extra: Partial<Product> = {}): Product => ({
  id: ++id, codigo: String(id), nome, compra: 100, venda: 200, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: 1,
  validade: { controla: false, avisos: [], dep: {}, ven: {} },
  deposito: { local: "A", qtd: 40, min: 10, max: null }, areaVenda: { local: "G", qtd: 12, min: 5, max: null }, ...extra,
});
const ok = b("Arroz");
const repor = b("Feijão", { areaVenda: { local: "G", qtd: 3, min: 5, max: null } });
const comprar = b("Macarrão", { deposito: { local: "A", qtd: 6, min: 10, max: null } });
const acabou = b("Café", { deposito: { local: "A", qtd: 0, min: 10, max: null }, areaVenda: { local: "G", qtd: 0, min: 5, max: null } });
const vencido = b("Leite", { validade: { controla: true, avisos: [30], dep: { _: [{ id: "a", qtd: 40, data: "2026-10-20", lote: null }] }, ven: { _: [{ id: "b", qtd: 12, data: "2026-10-01", lote: null }] } } });
const incompleto = b("Açúcar", { fornecedor: null });
const todos = [ok, repor, comprar, acabou, vencido, incompleto];

describe("atenção hoje: regra", () => {
  it("cada aviso tem um tipo", () => {
    expect(situacaoProduto(repor, "mercado", HOJE).alertas.map((a) => a.tipo)).toEqual(["repor"]);
    expect(situacaoProduto(vencido, "mercado", HOJE).alertas.map((a) => a.tipo)).toEqual(["vencido", "vencendo"]);
  });
  it("agrupa por assunto, do mais grave para o menos grave", () => {
    const g = atencaoHoje(todos, "mercado", HOJE);
    expect(g.map((x) => [x.titulo, x.itens.map((i) => i.p.nome)])).toEqual([
      ["Vencidos", ["Leite"]], ["Acabaram", ["Café"]], ["Repor a gôndola", ["Feijão"]], ["Comprar", ["Macarrão"]],
      ["Vencem em breve", ["Leite"]], ["Falta completar", ["Açúcar"]],
    ]);
  });
  it("farmácia fala estoque e área de venda", () => {
    const g = atencaoHoje([repor, comprar], "farmacia", HOJE);
    expect(g.map((x) => x.titulo)).toEqual(["Repor a área de venda", "Comprar"]);
    expect(g[1]!.ajuda).toBe("Chegaram ao mínimo no estoque.");
  });
  it("nada a fazer: lista vazia", () => {
    expect(atencaoHoje([ok], "mercado", HOJE)).toEqual([]);
  });
  it("data por extenso", () => {
    expect(dataPorExtenso("2026-10-09")).toBe("sexta-feira, 9 de outubro");
  });
});

describe("atenção hoje: tela", () => {
  it("quadros com números; tocar mostra os produtos e abre o produto", () => {
    const onOpen = vi.fn();
    render(<AtencaoHoje products={todos} tipo="mercado" suppliers={[]} onOpen={onOpen} />);
    const quadro = screen.getByRole("button", { name: /Repor a gôndola/ });
    expect(quadro.textContent).toBe("1Repor a gôndola");
    fireEvent.click(quadro);
    expect(screen.getByText("Chegaram ao mínimo na gôndola.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Feijão/ }));
    expect(onOpen).toHaveBeenCalledWith(repor);
    fireEvent.click(quadro);
    expect(screen.queryByText("Chegaram ao mínimo na gôndola.")).toBeNull();
  });
  it("tudo certo", () => {
    render(<AtencaoHoje products={[ok]} tipo="mercado" suppliers={[]} onOpen={() => {}} />);
    expect(screen.getByText(/Tudo certo! Nenhum produto precisa de atenção agora./)).toBeTruthy();
  });
  it("sem produtos não aparece", () => {
    const { container } = render(<AtencaoHoje products={[]} tipo="mercado" suppliers={[]} onOpen={() => {}} />);
    expect(container.textContent).toBe("");
  });
});
