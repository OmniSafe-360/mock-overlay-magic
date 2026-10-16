/* O quadro "Página do cliente" consultava o banco sem parar (objeto padrão novo a cada desenho). */
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const conta = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/fiadoCliente", () => ({
  acessoInfo: () => { conta.n++; return Promise.resolve({ temLink: true, temPin: false, ultimoAcesso: null }); },
  novoLinkCliente: async () => {},
  zerarPinCliente: async () => {},
}));

import { AcessoClienteFiado } from "@/components/AcessoClienteFiado";

const espera = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

describe("Página do cliente do fiado", () => {
  it("consulta o banco uma vez só ao abrir, sem repetir sozinha", async () => {
    conta.n = 0;
    render(<AcessoClienteFiado clienteId="c1" />);
    await screen.findByText("Recebeu o link, mas ainda não criou o PIN.");
    await espera(300);
    expect(conta.n).toBe(1);
  });

  it("resposta de outro cliente que chega atrasada não aparece", async () => {
    const respostas: Record<string, (v: unknown) => void> = {};
    const api = {
      acessoInfo: vi.fn((id: string) => new Promise<any>((r) => { respostas[id] = r; })),
      novoLinkCliente: vi.fn(), zerarPinCliente: vi.fn(),
    };
    const { rerender } = render(<AcessoClienteFiado clienteId="a" api={api as any} />);
    rerender(<AcessoClienteFiado clienteId="b" api={api as any} />);
    await act(async () => { respostas["b"]!({ temLink: false, temPin: false, ultimoAcesso: null }); });
    await act(async () => { respostas["a"]!({ temLink: true, temPin: true, ultimoAcesso: null }); });
    expect(screen.getByText("Ainda não recebeu o link.")).toBeTruthy();
    expect(screen.queryByText("Criou o PIN.")).toBeNull();
  });
});
