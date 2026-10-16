/* M14: o topo do cadastro mostra o nome do passo, a parte em que a pessoa está ("parte 2 de 3")
   e a barra anda junto com o contador. Mesma sequência, validações e gravação. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const typeIn = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const contador = () => screen.getByTestId("passo-contador").textContent;
const bloco = () => screen.queryByTestId("passo-bloco")?.textContent ?? null;
const titulo = () => screen.getByRole("heading", { level: 1 }).textContent;
const barra = () => parseFloat((document.querySelector(".bg-progress") as HTMLElement).style.width);

function abrir(tipo: string) {
  const onSave = vi.fn();
  render(<ProductWizard store={{ id: "s", nome: "Loja", tipo } as never} products={[]} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  return { onSave, submit };
}

describe("M14 — progresso do cadastro de produto", () => {
  it("mercado: nome do passo, parte atual e barra coerentes do começo ao fim", () => {
    const { onSave, submit } = abrir("mercado");
    expect(contador()).toBe("Passo 1 de 8");
    expect(bloco()).toBeNull();
    expect(barra()).toBeCloseTo(100 / 8);
    click("Digitar código"); typeIn("Código do produto", "7890001"); typeIn("Nome do produto", "Produto novo"); submit();
    expect(contador()).toBe("Passo 2 de 8");
    typeIn("Preço de compra", "1000"); typeIn("Preço de venda", "1500"); click("Pacote"); typeIn("Categoria", "Mercearia"); submit();
    expect(contador()).toBe("Passo 3 de 8");
    submit(); click("Definir depois"); submit();

    expect(bloco()).toBe("Depósito");
    expect(titulo()).toBe("Onde fica no depósito?");
    expect(contador()).toBe("Passo 5 de 8 · parte 1 de 3");
    expect(barra()).toBeCloseTo(((4 + 1 / 3) / 8) * 100);
    click(/^Novo local$/); typeIn("Nome do local", "Estante A"); click("Usar este local"); submit();
    expect(contador()).toBe("Passo 5 de 8 · parte 2 de 3");
    typeIn(/Quanto você contou/, "0"); submit();
    expect(contador()).toBe("Passo 5 de 8 · parte 3 de 3");
    expect(barra()).toBeCloseTo((5 / 8) * 100);
    submit();

    expect(bloco()).toBe("Área de venda");
    expect(contador()).toBe("Passo 6 de 8 · parte 1 de 3");
    click(/Novo local de venda/); typeIn("Nome do local de venda", "Balcão"); click("Usar este local de venda"); submit();
    typeIn(/Quanto deste produto já está neste local/, "0"); submit();
    expect(contador()).toBe("Passo 6 de 8 · parte 3 de 3");
    submit();

    // Sem resposta ainda, o passo de validade é uma parte só: a barra não fica num pedaço que não existe.
    expect(bloco()).toBe("Validade");
    expect(contador()).toBe("Passo 7 de 8");
    expect(barra()).toBeCloseTo((7 / 8) * 100);
    click("Sim");
    expect(contador()).toBe("Passo 7 de 8 · parte 1 de 4");
    expect(barra()).toBeCloseTo(((6 + 1 / 4) / 8) * 100);
    click("Não");
    expect(contador()).toBe("Passo 7 de 8");
    submit();

    expect(bloco()).toBeNull();
    expect(titulo()).toBe("Conferir e salvar");
    expect(contador()).toBe("Passo 8 de 8");
    expect(barra()).toBeCloseTo(100);
    submit();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("farmácia diz Estoque no nome do passo", () => {
    const { submit } = abrir("farmacia");
    click("Digitar código"); typeIn("Código do produto", "7890001"); typeIn("Nome do produto", "Remédio"); submit();
    typeIn("Preço de compra", "1000"); typeIn("Preço de venda", "1500"); click("Caixa"); typeIn("Categoria", "Medicamentos"); submit();
    submit(); click("Definir depois"); submit();
    expect(bloco()).toBe("Estoque");
    expect(contador()).toBe("Passo 5 de 8 · parte 1 de 3");
  });
});
