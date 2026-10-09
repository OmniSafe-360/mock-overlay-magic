import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard } from "@/components/ProductArea";
import { CATEGORIAS } from "@/lib/listas";
import { CATEGORIAS_COM_VALIDADE, avisosPadrao, tipoSemValidade, validadeSugerida } from "@/lib/validade";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const typeIn = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const pressed = (name: string | RegExp) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

/** Produto novo até o passo "Controle de validade", com depósito e venda configurados. */
function ateValidade(tipo: string, unidade: string, categoria: string) {
  const onSave = vi.fn();
  render(<ProductWizard store={{ id: "s", nome: "Loja", tipo } as never} products={[]} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  click("Digitar código"); typeIn("Código do produto", "7890001"); typeIn("Nome do produto", "Produto novo"); submit();
  typeIn("Preço de compra", "1000"); typeIn("Preço de venda", "1500"); click(unidade); typeIn("Categoria", categoria); submit();
  submit(); click("Definir depois"); submit();
  click(/^Novo local$/); typeIn("Nome do local", "Estante A"); click("Usar este local"); submit();
  typeIn(/Quanto você contou/, "0"); submit(); submit();
  click(/Novo local de venda/); typeIn("Nome do local de venda", "Balcão"); click("Usar este local de venda"); submit();
  typeIn(/Quanto deste produto já está neste local/, "0"); submit(); submit();
  expect(screen.getByText("Controle de validade")).toBeTruthy();
  return { onSave, submit };
}

describe("regras de validade por tipo", () => {
  it("só a loja de roupas pula o passo", () => {
    expect(tipoSemValidade("roupas")).toBe(true);
    for (const t of ["mercado", "farmacia", "construcao", "pet", "autopecas"]) expect(tipoSemValidade(t)).toBe(false);
  });
  it("as categorias com validade existem nas listas", () => {
    for (const [tipo, cats] of Object.entries(CATEGORIAS_COM_VALIDADE)) for (const c of cats) expect(CATEGORIAS[tipo]).toContain(c);
  });
  it("sugestão pela categoria", () => {
    expect(validadeSugerida("construcao", "Pintura")).toBe(true);
    expect(validadeSugerida("construcao", "Ferramentas")).toBe(false);
    expect(validadeSugerida("autopecas", "Óleos e lubrificantes")).toBe(true);
    expect(validadeSugerida("autopecas", "Freios")).toBe(false);
    expect(validadeSugerida("mercado", "Mercearia")).toBeUndefined();
    expect(validadeSugerida("pet", "Ração")).toBeUndefined();
  });
  it("farmácia começa com 30, 60 e 90 dias; os outros sem aviso", () => {
    expect(avisosPadrao("farmacia")).toEqual([30, 60, 90]);
    expect(avisosPadrao("mercado")).toEqual([]);
  });
});

describe("passo de validade na tela", () => {
  it("construção, Ferramentas: já vem “Não” com a explicação e salva sem controle", () => {
    const t = ateValidade("construcao", "Unidade", "Ferramentas");
    expect(pressed("Não")).toBe("true");
    expect(screen.getByText(/produtos de Ferramentas normalmente não vencem/)).toBeTruthy();
    t.submit();
    expect(screen.getByText("Salvar produto")).toBeTruthy();
    t.submit();
    expect(t.onSave.mock.calls[0]![0].validade).toMatchObject({ controla: false });
  });
  it("construção, Pintura: já vem “Sim”", () => {
    ateValidade("construcao", "Lata", "Pintura");
    expect(pressed("Sim")).toBe("true");
    expect(screen.getByText(/produtos de Pintura costumam ter validade/)).toBeTruthy();
  });
  it("autopeças: o comerciante pode mudar a resposta sugerida", () => {
    ateValidade("autopecas", "Unidade", "Freios");
    expect(pressed("Não")).toBe("true");
    click("Sim");
    expect(pressed("Sim")).toBe("true");
    expect(screen.queryByText(/normalmente não vencem/)).toBeNull();
  });
  it("mercado continua perguntando, sem resposta marcada", () => {
    ateValidade("mercado", "Pacote", "Mercearia");
    expect(pressed("Sim")).toBe("false");
    expect(pressed("Não")).toBe("false");
  });
  it("farmácia: os avisos já vêm com 30, 60 e 90 dias", () => {
    const t = ateValidade("farmacia", "Caixa", "Medicamentos");
    t.submit();
    for (const d of ["30 dias", "60 dias", "90 dias"]) expect(pressed(d)).toBe("true");
  });
});
