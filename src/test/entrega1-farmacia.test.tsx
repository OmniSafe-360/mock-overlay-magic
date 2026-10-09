import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Product } from "@/components/ProductArea";
import { FichaProduto } from "@/components/FichaProduto";
import { descricaoEmbalagem } from "@/lib/embalagem";
import { unPlural } from "@/lib/deposito";
import { LOTE_PARECE_CODIGO, lotePareceCodigo, temVencidoNaVenda, vencidoAVendaMsg } from "@/lib/validade";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const ontem = (() => { const d = new Date(Date.now() - 3 * 86400000); return d.toISOString().slice(0, 10); })();
const longe = "2099-12-31";

describe("textos no plural", () => {
  it("embalagem e rótulos usam o plural da unidade", () => {
    expect(descricaoEmbalagem({ tipo: "Caixa", qtd: 12 }, "Frasco")).toBe("Caixa com 12 frascos");
    expect(descricaoEmbalagem({ tipo: "Saco", qtd: 25 }, "Kg")).toBe("Saco com 25 Kg");
    expect(descricaoEmbalagem({ tipo: "Caixa", qtd: 12 }, "Unidade")).toBe("Caixa com 12");
    expect(unPlural("Frasco")).toBe("frascos");
    expect(unPlural("Kg")).toBe("Kg");
  });
});

describe("lote parecido com código de barras", () => {
  it("avisa com 8 números ou mais; lote curto não", () => {
    expect(lotePareceCodigo("6366663666646")).toBe(true);
    expect(lotePareceCodigo("L2345")).toBe(false);
    expect(lotePareceCodigo("123456")).toBe(false);
    expect(LOTE_PARECE_CODIGO).toMatch(/código curto/);
  });
});

describe("vencido na área de venda", () => {
  const val = (data: string) => ({ controla: true, avisos: [30], dep: {}, ven: { produto: [{ id: "l1", qtd: 40, data, lote: "L1" }] } });
  it("detecta só quando há quantidade vencida na venda", () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(temVencidoNaVenda(val(ontem) as never, hoje)).toBe(true);
    expect(temVencidoNaVenda(val(longe) as never, hoje)).toBe(false);
    expect(temVencidoNaVenda({ ...val(ontem), ven: {}, dep: { produto: [{ id: "l1", qtd: 40, data: ontem, lote: "L1" }] } } as never, hoje)).toBe(false);
  });
  it("farmácia fala de remédio e Anvisa; os outros, de produto", () => {
    expect(vencidoAVendaMsg(true)).toMatch(/Remédio vencido não pode ficar à venda/);
    expect(vencidoAVendaMsg(false)).toMatch(/Produto vencido não deve ficar à venda/);
  });
  it("o detalhe do produto mostra o alerta", () => {
    const p = { id: 1, codigo: "1", nome: "Dipirona", compra: 1990, venda: 2990, unidade: "Frasco", categoria: "Medicamentos", detalhes: {}, variacoes: [], fornecedor: null,
      validade: val(ontem) } as unknown as Product;
    render(<FichaProduto p={p} tipo="farmacia" onBack={() => {}} onEdit={() => {}} />);
    expect(screen.getByText(vencidoAVendaMsg(true))).toBeTruthy();
    expect(screen.getByText("Precisa de atenção agora")).toBeTruthy();
  });
});
