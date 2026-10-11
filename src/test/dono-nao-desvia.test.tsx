import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import { Route } from "@/routes/index";

// Checklist 2, item A1: celular que já abriu o Omni Operação não pode mandar o dono logado para /funcionario.
const api = vi.hoisted(() => ({ getSession: vi.fn(), replace: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: api.getSession, signOut: vi.fn(), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  from: () => { const c: any = { select: () => c, eq: () => c, maybeSingle: async () => ({ data: { nome: "Dono A", avatar_url: null }, error: null }), order: async () => ({ data: [{ id: "l1", nome: "Mercado A", tipo: "mercado", numero: "1" }], error: null }) }; return c; },
} }));
vi.mock("@/lib/funcionario", () => ({ lerChave: () => "a".repeat(64) }));
vi.mock("@/components/OwnerHome", () => ({ OwnerApp: (p: { fullName: string }) => <p>Dono: {p.fullName}</p> }));
vi.mock("@/components/StoreSetup", () => ({ TIPO_FROM_DB: {}, Entering: () => <p>Carregando conta</p>, StoreSetup: () => <p>Cadastrar comércio</p> }));
const Index = Route.options.component as ComponentType;
const original = window.location;
beforeEach(() => {
  vi.useFakeTimers(); api.replace.mockReset();
  Object.defineProperty(window, "location", { configurable: true, value: { ...original, search: "", hash: "", replace: api.replace } });
});
afterEach(() => { vi.useRealTimers(); Object.defineProperty(window, "location", { configurable: true, value: original }); });
const passar = () => act(async () => { await vi.advanceTimersByTimeAsync(1500); });

it("dono logado num celular com a chave da equipe fica no app do dono", async () => {
  api.getSession.mockResolvedValue({ data: { session: { user: { id: "A", email: "a@x.com", user_metadata: {} } } }, error: null });
  render(<Index />); await passar();
  expect(api.replace).not.toHaveBeenCalled();
  expect(screen.getByText("Dono: Dono A")).toBeInTheDocument();
});

it("sem sessão do dono, o celular da equipe continua indo para o Omni Operação", async () => {
  api.getSession.mockResolvedValue({ data: { session: null }, error: null });
  render(<Index />); await passar();
  expect(api.replace).toHaveBeenCalledWith("/funcionario");
});
