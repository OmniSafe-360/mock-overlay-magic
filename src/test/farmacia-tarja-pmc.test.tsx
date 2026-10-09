import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";
import { OPCOES_DETALHE } from "@/lib/listas";
import { LOCAL_PELA_TARJA, acimaPmcMsg, localNaoCombina, localPelaTarja, pmcCentavos, pmcTexto } from "@/lib/farmacia";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const base: Product = { id: 1, codigo: "7891234567895", nome: "Amoxicilina", compra: 1000, venda: 3000, unidade: "Caixa", categoria: "Medicamentos",
  detalhes: { tarja: "Tarja vermelha" }, variacoes: [], fornecedor: null };
function abrir(p: Product) {
  const onSave = vi.fn();
  render(<ProductWizard store={{ id: "s", nome: "F", tipo: "farmacia" } as never} products={[p]} initial={p} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={onSave} />);
  return { onSave, submit: () => fireEvent.submit(document.querySelector("form")!) };
}

describe("local pela tarja", () => {
  it("toda tarja da lista tem um local", () => {
    for (const t of OPCOES_DETALHE["farmacia"]!["tarja"]!) expect(LOCAL_PELA_TARJA[t], t).toBeTruthy();
  });
  it("vermelha atrás do balcão; preta e retém receita no armário", () => {
    expect(localPelaTarja("Tarja vermelha")!.local).toBe("Atrás do balcão");
    expect(localPelaTarja("Tarja preta")!.local).toBe("Armário de controlados");
    expect(localPelaTarja("Tarja vermelha (retém receita)")!.local).toBe("Armário de controlados");
    expect(localPelaTarja("Sem tarja (venda livre)")!.local).toBe("Gôndola");
    expect(localPelaTarja(undefined)).toBeUndefined();
  });
  it("avisa remédio com tarja na gôndola; sem tarja pode", () => {
    expect(localNaoCombina("Tarja preta", "Gôndola 3")).toMatch(/não pode ficar em “Gôndola 3”/);
    expect(localNaoCombina("Tarja vermelha", "Atrás do balcão")).toBe("");
    expect(localNaoCombina("Sem tarja (venda livre)", "Gôndola 1")).toBe("");
    expect(localNaoCombina(undefined, "Gôndola 1")).toBe("");
  });
  it("na tela: mostra o motivo e põe o local da tarja primeiro", () => {
    const t = abrir(base);
    for (let i = 0; i < 4; i++) t.submit();
    t.submit(); // estoque fica "sem configurar"; vai para a área de venda
    expect(screen.getByText("Área de venda: onde fica?")).toBeTruthy();
    expect(screen.getByText(/tarja vermelha fica atrás do balcão/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Novo local de venda/ }));
    const chips = screen.getByText("Toque para começar:").nextElementSibling!.querySelectorAll("button");
    expect(chips[0]!.textContent).toBe("Atrás do balcão");
  });
  it("na tela: escolher gôndola para tarja vermelha mostra o aviso, mas deixa seguir", () => {
    const t = abrir(base);
    for (let i = 0; i < 4; i++) t.submit();
    t.submit(); // estoque fica "sem configurar"; vai para a área de venda
    expect(screen.getByText("Área de venda: onde fica?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Novo local de venda/ }));
    fireEvent.click(screen.getByRole("button", { name: "Gôndola" }));
    fireEvent.change(document.getElementById("vlocal")!, { target: { value: "Gôndola 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar este local de venda" }));
    expect(screen.getByRole("alert").textContent).toMatch(/não pode ficar em “Gôndola 2”/);
  });
});

describe("preço máximo (PMC)", () => {
  it("guarda em reais e lê em centavos", () => {
    expect(pmcTexto("4590")).toMatch(/45,90/);
    expect(pmcTexto("")).toBe("");
    expect(pmcCentavos({ pmc: pmcTexto("4590") })).toBe(4590);
    expect(pmcCentavos({})).toBe(0);
  });
  it("avisa só quando a venda passa do PMC", () => {
    expect(acimaPmcMsg(3000, 2500)).toMatch(/passa do preço máximo/);
    expect(acimaPmcMsg(2500, 2500)).toBe("");
    expect(acimaPmcMsg(3000, 0)).toBe("");
  });
  it("na tela: PMC menor que a venda mostra aviso no preço e no resumo, e o produto salva com o PMC", () => {
    const t = abrir({ ...base, detalhes: { tarja: "Tarja vermelha", pmc: pmcTexto("2500") } });
    t.submit();
    expect(screen.getByRole("alert").textContent).toMatch(/passa do preço máximo \(PMC\)/);
    for (let i = 0; i < 12 && !screen.queryByText("Salvar produto"); i++) t.submit();
    expect(screen.getAllByText(/passa do preço máximo/).length).toBeGreaterThan(0);
    t.submit();
    expect(t.onSave.mock.calls[0]![0].detalhes.pmc).toMatch(/25,00/);
  });
});
