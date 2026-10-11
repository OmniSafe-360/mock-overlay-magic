import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import { Route } from "@/routes/index";

const api = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn(), oauth: vi.fn(), insert: vi.fn(), evento: (_evento: string, _sessao: { user: { id: string; email: string; user_metadata: { name: string } } } | null) => {}, replace: vi.fn() }));
const usuario = (id: string) => ({ id, email: `${id}@exemplo.com`, user_metadata: { name: `Dono ${id}` } });
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getSession: api.getSession,
    signOut: api.signOut, signInWithOAuth: api.oauth,
    onAuthStateChange: (cb: typeof api.evento) => { api.evento = cb; return { data: { subscription: { unsubscribe: () => {} } } }; },
  },
  from: () => { let id = "A"; const consulta = {
    select: () => consulta, eq: (coluna: string, valor: string) => { if (coluna === "id" || coluna === "dono_id") id = valor; return consulta; },
    maybeSingle: async () => ({ data: { nome: `Dono ${id}`, avatar_url: null }, error: null }),
    order: async () => ({ data: id === "B" ? [{ id: "loja-b", nome: "Mercado B", tipo: "mercado", numero: "1" }] : [], error: null }),
    insert: api.insert,
  }; return consulta; },
} }));
vi.mock("@/lib/funcionario", () => ({ lerChave: () => "a".repeat(64) }));
vi.mock("@/components/OwnerHome", () => ({ OwnerApp: (p: { fullName: string; initial: { nome: string }[] }) => <><p>{p.fullName}</p>{p.initial.map(s => <p key={s.nome}>{s.nome}</p>)}</> }));
const Index = Route.options.component as ComponentType;
const locationOriginal = window.location;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); window.history.replaceState(null, "", "/");
  api.getSession.mockResolvedValue({ data: { session: { user: usuario("A") } }, error: null });
  Object.defineProperty(window, "location", { configurable: true, value: { get href() { return locationOriginal.href; }, get search() { return locationOriginal.search; }, get hash() { return locationOriginal.hash; }, replace: api.replace } });
  api.signOut.mockImplementation(async () => { api.evento("SIGNED_OUT", null); return { error: null }; });
  api.oauth.mockResolvedValue({ error: null });
});
afterEach(() => { vi.useRealTimers(); Object.defineProperty(window, "location", { configurable: true, value: locationOriginal }); window.history.replaceState(null, "", "/"); });
async function abrir() { render(<Index />); await act(async () => { await vi.advanceTimersByTimeAsync(1500); }); }

it("primeiro comércio permite sair da conta e entrar com outro e-mail, mesmo com acesso da equipe guardado", async () => {
  await abrir(); expect(screen.getByText("Vamos cadastrar o seu comércio")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(api.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
  expect(screen.queryByText("Vamos cadastrar o seu comércio")).not.toBeInTheDocument();
  expect(api.replace).not.toHaveBeenCalled(); expect(api.insert).not.toHaveBeenCalled();
  act(() => api.evento("SIGNED_IN", { user: usuario("B") }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(screen.getByText("Dono B")).toBeInTheDocument(); expect(screen.getByText("Mercado B")).toBeInTheDocument();
});

it("falha ao sair mantém o cadastro e permite tentar novamente", async () => {
  api.signOut.mockResolvedValueOnce({ error: new Error("Failed to fetch") });
  await abrir(); fireEvent.click(screen.getByRole("button", { name: "Mercado" })); fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Nome do comércio"), { target: { value: "Mercado não enviado" } });
  fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível sair da conta");
  expect(screen.getByLabelText("Nome do comércio")).toHaveValue("Mercado não enviado");
  expect(screen.getByRole("button", { name: "Sair da conta" })).toBeEnabled(); expect(api.insert).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(screen.getByLabelText("E-mail")).toBeInTheDocument(); expect(api.replace).not.toHaveBeenCalled();
});

it("a saída só é confirmada depois da resposta e cliques repetidos não repetem signOut", async () => {
  let resolver!: (v: { error: null }) => void;
  api.signOut.mockReturnValue(new Promise(r => { resolver = r; }));
  await abrir(); const botao = screen.getByRole("button", { name: "Sair da conta" });
  act(() => { fireEvent.click(botao); fireEvent.click(botao); });
  expect(api.signOut).toHaveBeenCalledTimes(1); expect(screen.getByRole("button", { name: "Saindo..." })).toBeDisabled();
  expect(screen.getByText("Vamos cadastrar o seu comércio")).toBeInTheDocument();
  await act(async () => { resolver({ error: null }); await vi.advanceTimersByTimeAsync(50); });
  expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
});

it("ao voltar à entrada, Google solicita escolha de conta", async () => {
  await abrir(); fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  fireEvent.click(screen.getByRole("button", { name: "Entrar com Google" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(api.oauth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "https://mock-overlay-magic.lovable.app", queryParams: { prompt: "select_account" } } });
});

it("se o SDK já encerrou a sessão local após erro do servidor, permanece na entrada", async () => {
  api.signOut.mockImplementation(async () => {
    api.getSession.mockResolvedValue({ data: { session: null }, error: null });
    api.evento("SIGNED_OUT", null); return { error: new Error("Servidor indisponível") };
  });
  await abrir(); fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(screen.getByLabelText("E-mail")).toBeInTheDocument(); expect(api.replace).not.toHaveBeenCalled();
  expect(screen.queryByText("Vamos cadastrar o seu comércio")).not.toBeInTheDocument();
});
