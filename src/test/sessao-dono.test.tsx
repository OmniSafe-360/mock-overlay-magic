import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import { Route } from "@/routes/index";

type Usuario = { id: string; email: string; user_metadata: { name: string } };
type Resultado = { data: unknown; error: unknown };
const api = vi.hoisted(() => ({ conta: "A", getSession: vi.fn(), signOut: vi.fn(), from: vi.fn(), unsubscribe: vi.fn(), evento: (_evento: string, _sessao: { user: Usuario } | null) => {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: api.getSession, signOut: api.signOut, onAuthStateChange: (cb: typeof api.evento) => { api.evento = (event, session) => { api.conta = session?.user.id ?? ""; cb(event, session); }; return { data: { subscription: { unsubscribe: api.unsubscribe } } }; } },
  from: api.from,
} }));
vi.mock("@/lib/funcionario", () => ({ lerChave: () => null }));
vi.mock("@/components/OwnerHome", () => ({ OwnerApp: (p: { userId: string; fullName: string; initial: { nome: string }[]; onLogout: () => void }) => <><p>Conta: {p.userId} / {p.fullName}</p>{p.initial.map((s) => <p key={s.nome}>{s.nome}</p>)}<button onClick={p.onLogout}>Sair</button></> }));
vi.mock("@/components/StoreSetup", () => ({ TIPO_FROM_DB: {}, Entering: () => <p>Carregando conta</p>, StoreSetup: () => <p>Cadastrar comércio</p> }));
const Index = Route.options.component as ComponentType;
const usuario = (id: string): Usuario => ({ id, email: `${id}@exemplo.com`, user_metadata: { name: `Dono ${id}` } });
const perfil = (id: string): Resultado => ({ data: { nome: `Dono ${id}`, avatar_url: null }, error: null });
const lojas = (id: string): Resultado => ({ data: [{ id: `loja-${id}`, nome: `Mercado ${id}`, tipo: "mercado", numero: "1" }], error: null });
function pendente<T>() { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; }
let respostaPerfil: (id: string) => Promise<Resultado>;
let respostaLojas: (id: string) => Promise<Resultado>;
let filtros: { tabela: string; coluna: string; valor: unknown }[];
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); filtros = []; api.conta = "A";
  respostaPerfil = async (id) => perfil(id); respostaLojas = async (id) => lojas(id);
  api.getSession.mockResolvedValue({ data: { session: { user: usuario("A") } }, error: null });
  api.signOut.mockImplementation(async () => { api.evento("SIGNED_OUT", null); return { error: null }; });
  api.from.mockImplementation((tabela: string) => {
    let id: string | undefined;
    const consulta = {
      select: () => consulta,
      eq: (coluna: string, valor: unknown) => { filtros.push({ tabela, coluna, valor }); if (coluna === "id" || coluna === "dono_id") id = String(valor); return consulta; },
      maybeSingle: () => respostaPerfil(id ?? api.conta),
      // Sem filtro explícito, a simulação da RLS considera a sessão no começo da consulta.
      order: () => respostaLojas(id ?? api.conta),
    };
    return consulta;
  });
});
afterEach(() => vi.useRealTimers());
async function passar(ms = 1200) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function evento(tipo: string, id: string | null) { act(() => api.evento(tipo, id ? { user: usuario(id) } : null)); await passar(); }

it("trocar diretamente de A para B carrega somente o perfil e os comércios de B", async () => {
  render(<Index />); await passar();
  expect(screen.getByText("Conta: A / Dono A")).toBeInTheDocument();
  await evento("SIGNED_IN", "B");
  expect(screen.getByText("Conta: B / Dono B")).toBeInTheDocument();
  expect(screen.getByText("Mercado B")).toBeInTheDocument();
  expect(screen.queryByText("Mercado A")).not.toBeInTheDocument();
});

it("perfil de A atrasado após sair e entrar em B não substitui a conta atual", async () => {
  const antigo = pendente<Resultado>(); respostaPerfil = (id) => id === "A" ? antigo.promise : Promise.resolve(perfil(id));
  render(<Index />); await passar();
  await evento("SIGNED_OUT", null); await evento("SIGNED_IN", "B");
  await act(async () => antigo.resolve(perfil("A"))); await passar();
  expect(screen.getByText("Conta: B / Dono B")).toBeInTheDocument();
  expect(screen.queryByText("Mercado A")).not.toBeInTheDocument();
});

it("lista de A atrasada após entrar em B não abre comércios antigos", async () => {
  const antigo = pendente<Resultado>(); respostaLojas = (id) => id === "A" ? antigo.promise : Promise.resolve(lojas(id));
  render(<Index />); await passar();
  await evento("SIGNED_OUT", null); await evento("SIGNED_IN", "B");
  await act(async () => antigo.resolve(lojas("A"))); await passar();
  expect(screen.getByText("Conta: B / Dono B")).toBeInTheDocument();
  expect(screen.getByText("Mercado B")).toBeInTheDocument();
  expect(screen.queryByText("Mercado A")).not.toBeInTheDocument();
});

it("sessão inicial atrasada não reabre A depois do evento de saída", async () => {
  const inicial = pendente<Awaited<ReturnType<typeof api.getSession>>>(); api.getSession.mockReturnValue(inicial.promise);
  render(<Index />); await evento("SIGNED_OUT", null);
  await act(async () => inicial.resolve({ data: { session: { user: usuario("A") } }, error: null })); await passar();
  expect(screen.getByRole("tab", { name: "Entrar" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByText("Conta: A / Dono A")).not.toBeInTheDocument();
});

it("evento de entrada já agendado não reabre a conta após sair", async () => {
  render(<Index />); await passar(); await evento("SIGNED_OUT", null);
  act(() => { api.evento("SIGNED_IN", { user: usuario("A") }); api.evento("SIGNED_OUT", null); }); await passar();
  expect(screen.getByRole("tab", { name: "Entrar" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByText("Conta: A / Dono A")).not.toBeInTheDocument();
});

it("Sair limpa a conta imediatamente mesmo antes da resposta da autenticação", async () => {
  const saida = pendente<Resultado>(); api.signOut.mockReturnValue(saida.promise);
  render(<Index />); await passar();
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  expect(screen.queryByText("Mercado A")).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Entrar" })).toBeInTheDocument();
  await evento("SIGNED_IN", "B");
  expect(screen.getByText("Conta: B / Dono B")).toBeInTheDocument();
});

it("saída durante a animação impede que o timer antigo abra o comércio", async () => {
  api.getSession.mockResolvedValue({ data: { session: null }, error: null });
  render(<Index />); await passar();
  act(() => api.evento("SIGNED_IN", { user: usuario("A") })); await passar(5);
  expect(screen.getByText("Carregando conta")).toBeInTheDocument();
  await evento("SIGNED_OUT", null);
  expect(screen.queryByText("Mercado A")).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Entrar" })).toBeInTheDocument();
});

it("entrada repetida e renovação da mesma sessão não desmontam a tela nem repetem as consultas", async () => {
  render(<Index />); await passar(); const chamadas = api.from.mock.calls.length;
  await evento("SIGNED_IN", "A"); await evento("TOKEN_REFRESHED", "A");
  expect(screen.getByText("Conta: A / Dono A")).toBeInTheDocument();
  expect(api.from).toHaveBeenCalledTimes(chamadas);
});

it("falha no perfil aparece e tentar de novo consulta antes de abrir a conta", async () => {
  let falhar = true; respostaPerfil = async (id) => falhar ? { data: null, error: { message: "Failed to fetch" } } : perfil(id);
  render(<Index />); await passar();
  expect(screen.getByText(/Não foi possível carregar sua conta/)).toBeInTheDocument();
  expect(filtros.some((f) => f.tabela === "comercios")).toBe(false);
  falhar = false; fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" })); await passar();
  expect(screen.getByText("Conta: A / Dono A")).toBeInTheDocument();
});

it("consulta rejeitada do perfil não fica presa carregando", async () => {
  respostaPerfil = async () => { throw new TypeError("Failed to fetch"); };
  render(<Index />); await passar();
  expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  expect(screen.queryByText("Carregando conta")).not.toBeInTheDocument();
});

it("erro na leitura de comércios não abre cadastro vazio e pode ser recuperado", async () => {
  let falhar = true; respostaLojas = async (id) => falhar ? { data: null, error: { message: "Failed to fetch" } } : lojas(id);
  render(<Index />); await passar();
  expect(screen.queryByText("Cadastrar comércio")).not.toBeInTheDocument();
  falhar = false; fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" })); await passar();
  expect(screen.getByText("Mercado A")).toBeInTheDocument();
  expect(filtros).toContainEqual({ tabela: "comercios", coluna: "dono_id", valor: "A" });
});

it("conta sem comércio abre o cadastro somente depois da consulta confirmada", async () => {
  respostaPerfil = async () => ({ data: null, error: null }); respostaLojas = async () => ({ data: [], error: null });
  render(<Index />); await passar();
  expect(screen.getByText("Cadastrar comércio")).toBeInTheDocument();
});

it("perfil ausente usa o nome da autenticação somente da conta atual", async () => {
  respostaPerfil = async () => ({ data: null, error: null });
  render(<Index />); await passar(); await evento("SIGNED_IN", "B");
  expect(screen.getByText("Conta: B / Dono B")).toBeInTheDocument();
});

it("falha ao ler a sessão inicial oferece nova tentativa", async () => {
  api.getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  render(<Index />); await passar();
  fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" })); await passar();
  expect(screen.getByText("Conta: A / Dono A")).toBeInTheDocument();
});

it("sessão inicial atrasada não substitui B já recebida pelo evento", async () => {
  const inicial = pendente<unknown>(); api.getSession.mockReturnValue(inicial.promise);
  render(<Index />); await evento("SIGNED_IN", "B");
  await act(async () => inicial.resolve({ data: { session: { user: usuario("A") } }, error: null })); await passar();
  expect(screen.getByText("Conta: B / Dono B")).toBeInTheDocument();
  expect(screen.queryByText("Mercado A")).not.toBeInTheDocument();
});

it("desmontar cancela a entrada agendada e a assinatura de autenticação", async () => {
  api.getSession.mockResolvedValue({ data: { session: null }, error: null });
  const tela = render(<Index />); await passar();
  act(() => api.evento("SIGNED_IN", { user: usuario("A") })); tela.unmount(); await passar();
  expect(api.from).not.toHaveBeenCalled(); expect(api.unsubscribe).toHaveBeenCalledTimes(1);
});

it("evento INITIAL_SESSION atrasado não substitui uma entrada mais recente", async () => {
  render(<Index />); await passar(); await evento("SIGNED_IN", "B");
  await evento("INITIAL_SESSION", "A");
  expect(screen.getByText("Conta: B / Dono B")).toBeInTheDocument();
  expect(screen.queryByText("Mercado A")).not.toBeInTheDocument();
});

it("voltar para A não reaproveita a resposta da primeira entrada de A", async () => {
  const antigo = pendente<Resultado>(); let primeira = true;
  respostaPerfil = async (id) => {
    if (id === "A" && primeira) { primeira = false; return antigo.promise; }
    return perfil(id);
  };
  render(<Index />); await passar(); await evento("SIGNED_IN", "B"); await evento("SIGNED_IN", "A");
  await act(async () => antigo.resolve({ data: { nome: "Nome antigo de A", avatar_url: null }, error: null })); await passar();
  expect(screen.getByText("Conta: A / Dono A")).toBeInTheDocument();
  expect(screen.queryByText(/Nome antigo de A/)).not.toBeInTheDocument();
});

it("falha antiga do perfil não tira B da tela atual", async () => {
  const antigo = pendente<Resultado>(); respostaPerfil = (id) => id === "A" ? antigo.promise : Promise.resolve(perfil(id));
  render(<Index />); await passar(); await evento("SIGNED_IN", "B");
  await act(async () => antigo.reject(new TypeError("Failed to fetch"))); await passar();
  expect(screen.getByText("Conta: B / Dono B")).toBeInTheDocument();
  expect(screen.queryByText(/Não foi possível carregar sua conta/)).not.toBeInTheDocument();
});

it("recuperação de senha invalida o carregamento anterior da conta", async () => {
  const antigo = pendente<Resultado>(); respostaPerfil = () => antigo.promise;
  render(<Index />); await passar(); await evento("PASSWORD_RECOVERY", "A");
  await act(async () => antigo.resolve(perfil("A"))); await passar();
  expect(screen.getByText("Nova senha")).toBeInTheDocument();
  expect(screen.queryByText("Mercado A")).not.toBeInTheDocument();
  expect(filtros.some((f) => f.tabela === "comercios")).toBe(false);
});
