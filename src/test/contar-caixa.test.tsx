import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const typeIn = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });

/** Produto novo de mercado que chega em caixa com 12, até o passo "Quanto há no depósito?". */
function ateContagem(comCaixa = true) {
  const onSave = vi.fn();
  render(<ProductWizard store={{ id: "s", nome: "Mercado", tipo: "mercado" } as never} products={[]} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  click("Digitar código"); typeIn("Código do produto", "7890001"); typeIn("Nome do produto", "Guaraná 2L"); submit();
  typeIn("Preço de compra", "250"); typeIn("Preço de venda", "400"); click("Unidade"); typeIn("Categoria", "Bebidas"); submit();
  submit(); // detalhes
  click("Definir depois");
  if (comCaixa) {
    click(/Em caixa, fardo ou pacote/);
    typeIn("Quantas unidades vêm dentro?", "12");
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
  }
  submit(); // fornecedor
  click(/^Novo local$/); typeIn("Nome do local", "Estante A"); click("Usar este local"); submit();
  expect(screen.getByText("Quanto há no depósito?")).toBeTruthy();
  return { onSave, submit };
}

describe("contar caixas fechadas + unidades soltas no depósito", () => {
  it("5 caixas com 12 + 3 soltas = 63, e salva 63", () => {
    const t = ateContagem();
    expect(screen.getByRole("button", { name: "Caixas + soltas" }).getAttribute("aria-pressed")).toBe("true");
    typeIn("Caixas com 12 fechadas", "5"); typeIn("Unidades soltas", "3");
    expect(screen.getByText("Total no depósito:").textContent).toContain("63 unidades");
    t.submit(); t.submit(); // quantidade -> limites -> área de venda
    click("Definir depois"); t.submit(); // área de venda sem local
    if (screen.queryByText("Área de venda: quantidade")) { typeIn(/Quanto deste produto já está neste local/, "0"); t.submit(); t.submit(); }
    click("Não"); t.submit(); // validade
    t.submit(); // salvar
    const p = t.onSave.mock.calls[0]![0] as Product;
    expect(p.deposito?.qtd).toBe(63);
    expect(p.embalagens).toMatchObject([{ tipo: "Caixa", qtd: 12 }]);
  });

  it("sem preencher nada não deixa continuar", () => {
    const t = ateContagem();
    t.submit();
    expect(screen.getByText("Quanto há no depósito?")).toBeTruthy();
  });

  it("caixa quebrada mostra o erro e não continua", () => {
    const t = ateContagem();
    typeIn("Caixas com 12 fechadas", "1,5");
    expect(screen.getByRole("alert").textContent).toMatch(/inteiro/);
    t.submit();
    expect(screen.getByText("Quanto há no depósito?")).toBeTruthy();
  });

  it("'Digitar o total' leva o que já foi somado", () => {
    ateContagem();
    typeIn("Caixas com 12 fechadas", "2"); typeIn("Unidades soltas", "1");
    click("Digitar o total");
    expect((screen.getByLabelText(/Quanto você contou no depósito agora/) as HTMLInputElement).value).toBe("25");
  });

  it("produto que chega por unidade continua com o campo de sempre", () => {
    ateContagem(false);
    expect(screen.queryByRole("button", { name: /\+ soltas/ })).toBeNull();
    expect(screen.getByLabelText(/Quanto você contou no depósito agora/)).toBeTruthy();
  });
});
