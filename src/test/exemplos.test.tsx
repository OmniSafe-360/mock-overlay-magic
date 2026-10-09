import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ProductWizard } from "@/components/ProductArea";
import { TIPOS } from "@/components/StoreSetup";
import { EXEMPLOS, exemplos, nomeAreaVenda } from "@/lib/exemplos";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

describe("exemplos dos campos por tipo de comércio", () => {
  it("todo tipo de comércio tem seus exemplos", () => {
    for (const t of TIPOS) expect(EXEMPLOS[t.id], t.id).toBeTruthy();
  });
  it("nenhum tipo repete o exemplo de outro", () => {
    const ps = Object.values(EXEMPLOS).map((e) => e.produto);
    expect(new Set(ps).size).toBe(ps.length);
  });
  it.each(TIPOS.map((t) => t.id))("produto novo em %s mostra o exemplo do próprio tipo", (tipo) => {
    render(<ProductWizard store={{ id: "s", nome: "Loja", tipo } as never} products={[]} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={() => {}} />);
    const ph = (document.getElementById("pnome") as HTMLInputElement).placeholder;
    expect(ph).toBe(`Ex.: ${EXEMPLOS[tipo]!.produto}`);
    if (tipo !== "mercado") expect(ph).not.toMatch(/Arroz/);
  });
  it("tipo desconhecido usa exemplo que serve para qualquer um", () => {
    expect(exemplos("outro").produto).not.toMatch(/Arroz/);
  });
  it("aba de venda: Gôndolas só em mercado e pet shop", () => {
    expect(nomeAreaVenda("mercado")).toBe("Gôndolas");
    expect(nomeAreaVenda("pet")).toBe("Gôndolas");
    expect(nomeAreaVenda("farmacia")).toBe("Área de venda");
    expect(nomeAreaVenda("roupas")).toBe("Área de venda");
  });
});
