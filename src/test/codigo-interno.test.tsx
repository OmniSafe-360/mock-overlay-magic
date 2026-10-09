import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CODIGO_CRIADO, CODIGO_ERRO, ProductWizard } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const valor = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;

function abrir(tipo: string, gerar?: () => Promise<string>) {
  render(<ProductWizard store={{ id: "s", nome: "Loja", tipo } as never} products={[]} suppliers={[]} onAddSupplier={() => 1}
    onCancel={() => {}} onSave={vi.fn()} onGerarCodigo={gerar} />);
}

/** Dígito verificador EAN-13 (mesma conta da função gerar_codigo_interno do banco). */
const eanOk = (c: string) => /^\d{13}$/.test(c) && [...c.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10 === (10 - Number(c[12])) % 10;

describe("produto sem código de barras", () => {
  it("os códigos que o banco gera são EAN-13 válidos começando com 29", () => {
    for (const c of ["2900000000018", "2900000000025", "2900000000032", "2900000000056"]) expect(eanOk(c) && c.startsWith("29")).toBe(true);
    expect(eanOk("2900000000019")).toBe(false);
  });

  it("'Não tem código' cria o código e mostra o aviso", async () => {
    const gerar = vi.fn().mockResolvedValue("2900000000018");
    abrir("mercado", gerar);
    await act(async () => click(/Não tem código/));
    expect(gerar).toHaveBeenCalledTimes(1);
    expect(valor("Código do produto")).toBe("2900000000018");
    expect(screen.getByText(CODIGO_CRIADO)).toBeTruthy();
  });

  it("se a internet falhar, avisa e deixa tentar de novo", async () => {
    const gerar = vi.fn().mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce("2900000000025");
    abrir("mercado", gerar);
    await act(async () => click(/Não tem código/));
    expect(screen.getByText(CODIGO_ERRO)).toBeTruthy();
    await act(async () => click(/Não tem código/));
    expect(valor("Código do produto")).toBe("2900000000025");
    expect(screen.queryByText(CODIGO_ERRO)).toBeNull();
  });

  it("depois de escolher 'Digitar código', ainda dá para criar um", async () => {
    const gerar = vi.fn().mockResolvedValue("2900000000032");
    abrir("mercado", gerar);
    click("Digitar código");
    await act(async () => click(/Não tem código\? Criar um/));
    expect(valor("Código do produto")).toBe("2900000000032");
  });

  it("variação de roupas também pode criar o código", async () => {
    const gerar = vi.fn().mockResolvedValue("2900000000049");
    abrir("roupas", gerar);
    click("Digitar código");
    fireEvent.change(screen.getByLabelText("Código do produto"), { target: { value: "7890001" } });
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Camiseta" } });
    fireEvent.submit(document.querySelector("form")!);
    fireEvent.change(screen.getByLabelText("Preço de compra"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Preço de venda"), { target: { value: "2000" } });
    click("Peça");
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "Camisetas" } });
    fireEvent.submit(document.querySelector("form")!);
    click(/Adicionar variação/);
    await act(async () => click(/Não tem código\? Criar um/));
    expect(valor("Código de barras")).toBe("2900000000049");
    expect(screen.getByText(CODIGO_CRIADO)).toBeTruthy();
  });

  it("sem a função (ex.: telas antigas) o botão não aparece", () => {
    abrir("mercado");
    expect(screen.queryByRole("button", { name: /Não tem código/ })).toBeNull();
  });
});
