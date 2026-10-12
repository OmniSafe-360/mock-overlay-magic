import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { caixaClientesFiado } from "@/lib/banco";

describe("F2 — saldo do fiado na lista do caixa", () => {
  it("converte o que o cliente deve para centavos", async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: "1", nome: "Ana", telefone: null, deve: 35.5, desde: "2026-10-01T10:00:00Z" }], error: null });
    const [c] = await caixaClientesFiado("k");
    expect(c?.deve).toBe(3550);
    expect(c?.desde).toBe("2026-10-01T10:00:00Z");
  });
  it("sem o campo deve (banco antigo), fica null e a tela não inventa saldo", async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: "1", nome: "Ana", telefone: null }], error: null });
    const [c] = await caixaClientesFiado("k");
    expect(c?.deve).toBeNull();
  });
});
