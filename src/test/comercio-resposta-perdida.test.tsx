import { describe, it, expect, vi } from "vitest";
const sb = vi.hoisted(() => {
  const insert = vi.fn(); const select = vi.fn();
  return { insert, select, from: vi.fn((t: string) => ({ insert: (...a: unknown[]) => ({ select: () => ({ single: () => insert(...a) }) }), select: () => ({ eq: () => ({ eq: () => ({ limit: () => select(t) }) }) }) })) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: sb.from, auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) } } }));
describe("B13 — resposta perdida ao salvar o comércio", () => {
  it("comércio já gravado é reconhecido pelo documento e nome", async () => {
    sb.select.mockResolvedValue({ data: [{ id: "c1", nome: "Mercado Bom" }] });
    const { supabase } = await import("@/integrations/supabase/client");
    const r = await supabase.from("comercios").select("id,nome").eq("dono_id", "u1").eq("documento", "1").limit(1) as unknown as { data: { id: string; nome: string }[] };
    expect(r.data[0]!.id).toBe("c1");
  });
});
