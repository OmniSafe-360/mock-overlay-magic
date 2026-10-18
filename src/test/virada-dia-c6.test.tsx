import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PainelDiferencas, type ApiDiferencas } from "@/components/PainelDiferencas";
import type { Product } from "@/components/ProductArea";
import type { Diferenca } from "@/lib/diferencas";

/* C6 (checklist 3): "Faltou este mês" da aba Diferenças vira o mês à meia-noite com a tela aberta. */
const arroz: Product = {
  id: "arroz", db: { id: "arroz", contadas: [] }, nome: "Arroz 5 kg", codigo: "789", unidade: "Unidade", categoria: "Mercearia", compra: 1290, venda: 1990,
  fornecedor: null, detalhes: {}, variacoes: [],
};
const falta: Diferenca = {
  id: "d1", produtoId: "arroz", variacaoId: null, area: "deposito", origem: "conferencia", esperado: 100, contado: 98, diferenca: -2, valor: -2580,
  funcionario: "Maria", situacao: "aberta", motivo: null, observacao: null, tentativas: [98, 97, 98], resolvida: false, motivoInformado: null,
  criadaEm: "2026-10-31T12:00:00-03:00",
};

afterEach(() => { vi.useRealTimers(); });

describe("C6 — virada do mês com a aba Diferenças aberta", () => {
  it("a falta de 31/10 sai de \"Faltou este mês\" em 01/11, sem sair da tela", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-31T23:59:50-03:00"));
    const api = {
      carregar: vi.fn(async () => ({ diferencas: [falta], perdas: [] })), decidirPerda: vi.fn(async () => {}), explicar: vi.fn(async () => {}),
      resolverComMotivo: vi.fn(async () => ({ diferenca: 0 })), registrarPerda: vi.fn(async () => {}),
    } satisfies ApiDiferencas;
    render(<PainelDiferencas comercioId="c1" tipo="mercado" products={[arroz]} api={api} />);
    const valor = () => screen.getByText("Faltou este mês").nextElementSibling?.textContent ?? "";
    await vi.waitFor(() => expect(valor()).toMatch(/25,80/));
    act(() => { vi.setSystemTime(new Date("2026-11-01T00:00:20-03:00")); vi.advanceTimersByTime(30_000); });
    await vi.waitFor(() => expect(valor()).toMatch(/0,00/));
    expect(api.carregar).toHaveBeenCalledTimes(2);
  });
});
