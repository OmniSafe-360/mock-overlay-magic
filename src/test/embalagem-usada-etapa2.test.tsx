import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";
import { QTD_CONFERINDO_MSG, QTD_SEM_CONFERIR_MSG, QTD_TRAVADA_MSG, travaQtdEmbalagem } from "@/lib/embalagem";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

/* Ovos de teste (dados de mentira): Caixa com 6 já gravada no banco. */
const CX = "11111111-1111-4111-8111-111111111111";
const ovos: Product = { id: 1, codigo: "7890000000001", nome: "Ovos", compra: 299, venda: 810, unidade: "Unidade", categoria: "Mercearia",
  detalhes: { peso: "6 u" }, variacoes: [], fornecedor: null,
  embalagens: [{ uid: CX, tipo: "Caixa", qtd: 6, codigo: "", preco: 0 }], db: { id: "p1", contadas: [] } };

async function abrir(p: Product, conferir?: (ids: string[]) => Promise<Set<string>>) {
  const onSave = vi.fn();
  render(<ProductWizard store={{ id: "s", nome: "Loja", tipo: "mercado" } as never} products={[p]} initial={p} suppliers={[]}
    onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} onConferirEmbalagens={conferir} />);
  await act(async () => {});
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  submit(); submit(); submit(); // até "Quem é o fornecedor?"
  return { onSave, submit, salvo: () => onSave.mock.calls[0]![0] as Product };
}
const qtd = () => screen.getByLabelText("Quantas unidades vêm dentro?") as HTMLInputElement;
const salvarSheet = () => fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

describe("Etapa 2 — embalagem já usada não muda a quantidade dentro (só na tela)", () => {
  it("regra: nova nunca trava; usada trava; conferindo/erro travam por segurança", () => {
    const salvas = new Set([CX]);
    expect(travaQtdEmbalagem("nova", salvas, { estado: "ok", usadas: new Set([CX]) })).toBe("");
    expect(travaQtdEmbalagem(CX, salvas, { estado: "ok", usadas: new Set() })).toBe("");
    expect(travaQtdEmbalagem(CX, salvas, { estado: "ok", usadas: new Set([CX]) })).toBe(QTD_TRAVADA_MSG);
    expect(travaQtdEmbalagem(CX, salvas, { estado: "carregando", usadas: new Set() })).toBe(QTD_CONFERINDO_MSG);
    expect(travaQtdEmbalagem(CX, salvas, { estado: "erro", usadas: new Set() })).toBe(QTD_SEM_CONFERIR_MSG);
    expect(travaQtdEmbalagem(CX, salvas, { estado: "livre", usadas: new Set() })).toBe("");
  });

  it("embalagem ligada a pedido: quantidade travada, mensagem, outros campos editáveis e 6 preservado", async () => {
    const conferir = vi.fn(async () => new Set([CX]));
    const t = await abrir(ovos, conferir);
    expect(conferir).toHaveBeenCalledWith([CX]);
    fireEvent.click(screen.getByText("Caixa com 6"));
    expect(qtd().readOnly).toBe(true);
    expect(screen.getByRole("dialog").textContent).toContain(QTD_TRAVADA_MSG);
    fireEvent.change(qtd(), { target: { value: "12" } });
    expect(qtd().value).toBe("6");
    fireEvent.change(screen.getByLabelText(/Código de barras da embalagem/), { target: { value: "17890000000008" } });
    fireEvent.change(screen.getByLabelText(/Preço da caixa/), { target: { value: "1794" } });
    salvarSheet();
    for (let i = 0; i < 5; i++) t.submit();
    expect(t.salvo().embalagens).toMatchObject([{ uid: CX, tipo: "Caixa", qtd: 6, codigo: "17890000000008", preco: 1794 }]);
  });

  it("embalagem gravada mas nunca usada continua editável", async () => {
    const t = await abrir(ovos, async () => new Set());
    fireEvent.click(screen.getByText("Caixa com 6"));
    expect(qtd().readOnly).toBe(false);
    fireEvent.change(qtd(), { target: { value: "12" } });
    salvarSheet();
    for (let i = 0; i < 5; i++) t.submit();
    expect(t.salvo().embalagens![0]!.qtd).toBe(12);
  });

  it("embalagem nova adicionada no mesmo produto não é travada", async () => {
    await abrir(ovos, async () => new Set([CX]));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar outra embalagem|Adicionar embalagem/ }));
    expect(qtd().readOnly).toBe(false);
    expect(screen.getByRole("dialog").textContent).not.toContain(QTD_TRAVADA_MSG);
  });

  it("sem conseguir conferir o histórico, trava por segurança", async () => {
    await abrir(ovos, async () => { throw new Error("rede"); });
    fireEvent.click(screen.getByText("Caixa com 6"));
    expect(qtd().readOnly).toBe(true);
    expect(screen.getByRole("dialog").textContent).toContain(QTD_SEM_CONFERIR_MSG);
  });

  it("produto novo (sem banco) não consulta nada", async () => {
    const conferir = vi.fn(async () => new Set<string>());
    await abrir({ ...ovos, db: undefined }, conferir);
    expect(conferir).not.toHaveBeenCalled();
  });
});
