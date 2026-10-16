/* M12: a faixa de partes do comércio mostra que corre para o lado (setas e uma linha curta) só quando há partes escondidas. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { StoreSpace } from "@/components/StoreSpace";
import type { StoreData } from "@/components/StoreSetup";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));
const loja: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado Alfa", cidade: "Bauru", uf: "SP", rua: "r", numero: "1", bairro: "b" };
const f = () => vi.fn(async () => undefined as never);
const props = {
  store: loja, products: [], suppliers: [], saved: false, onSalvarPedido: f(), onPedidoEnviado: f(), onCancelarPedido: f(), onNovoLinkPedido: f(), onPagamentoPedido: f(),
  onAddSupplier: f(), onUpdateSupplier: f(), onBack: vi.fn(), onNew: vi.fn(), onEdit: vi.fn(), onDismissSaved: vi.fn(),
};
const AJUDA = "Deslize para o lado para ver as 8 partes";
const medidas = (el: HTMLElement, m: { scrollLeft: number; clientWidth: number; scrollWidth: number }) => {
  for (const [k, v] of Object.entries(m)) Object.defineProperty(el, k, { configurable: true, value: v });
  fireEvent.scroll(el);
};

describe("M12 — faixa que corre para o lado", () => {
  it("cabe tudo na tela: sem setas e sem a linha de ajuda", () => {
    render(<StoreSpace {...props} />);
    const nav = screen.getByRole("navigation", { name: "Partes do comércio" });
    medidas(nav.firstElementChild as HTMLElement, { scrollLeft: 0, clientWidth: 900, scrollWidth: 800 });
    expect(screen.queryByText(AJUDA)).toBeNull();
    expect(screen.queryByTestId("faixa-seta-dir")).toBeNull();
    expect(screen.queryByTestId("faixa-seta-esq")).toBeNull();
  });

  it("no começo: seta à direita e a linha de ajuda; no meio: as duas setas; no fim: só a da esquerda", () => {
    render(<StoreSpace {...props} />);
    const nav = screen.getByRole("navigation", { name: "Partes do comércio" });
    const faixa = nav.firstElementChild as HTMLElement;
    medidas(faixa, { scrollLeft: 0, clientWidth: 320, scrollWidth: 800 });
    expect(screen.getByText(AJUDA)).toBeTruthy();
    expect(screen.getByTestId("faixa-seta-dir")).toBeTruthy();
    expect(screen.queryByTestId("faixa-seta-esq")).toBeNull();
    medidas(faixa, { scrollLeft: 200, clientWidth: 320, scrollWidth: 800 });
    expect(screen.getByTestId("faixa-seta-esq")).toBeTruthy();
    expect(screen.getByTestId("faixa-seta-dir")).toBeTruthy();
    medidas(faixa, { scrollLeft: 480, clientWidth: 320, scrollWidth: 800 });
    expect(screen.getByTestId("faixa-seta-esq")).toBeTruthy();
    expect(screen.queryByTestId("faixa-seta-dir")).toBeNull();
    expect(screen.getByText(AJUDA)).toBeTruthy();
  });

  it("as mesmas 8 partes continuam e as setas não são lidas como botões", () => {
    render(<StoreSpace {...props} />);
    const nav = screen.getByRole("navigation", { name: "Partes do comércio" });
    medidas(nav.firstElementChild as HTMLElement, { scrollLeft: 100, clientWidth: 320, scrollWidth: 800 });
    expect(within(nav).getAllByRole("button")).toHaveLength(8);
    expect(screen.getByTestId("faixa-seta-dir").getAttribute("aria-hidden")).toBe("true");
  });
});
