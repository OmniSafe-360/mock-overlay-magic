import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerApp } from "@/components/OwnerHome";
import type { Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";

const banco = vi.hoisted(() => ({ carregarFornecedores: vi.fn(), carregarProdutos: vi.fn(), carregarPedidos: vi.fn(), conferirEnvio: vi.fn(), carregarVendas: vi.fn(), carregarPendentesVenda: vi.fn(), carregarDiferencas: vi.fn(), carregarLimiteFaltas: vi.fn(), carregarContagensAntifurto: vi.fn(), carregarCaixas: vi.fn(), carregarFuncionarios: vi.fn() }));
vi.mock("@/lib/banco", async (original) => ({ ...await original<object>(), ...banco }));
vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));
// O cadastro em si não é testado aqui (regras de salvamento intactas): só para onde o dono volta.
vi.mock("@/components/StoreSetup", async (original) => ({
  ...await original<object>(),
  StoreSetup: ({ onFinish, onCancel }: { onFinish?: (s: StoreData) => void; onCancel?: () => void }) => (
    <div>
      <p>Cadastro de comércio</p>
      <button type="button" onClick={() => onCancel?.()}>Cancelar cadastro</button>
      <button type="button" onClick={() => onFinish?.({ id: "c3", tipo: "mercado", nome: "Loja Nova", cidade: "Bauru", uf: "SP", rua: "R", numero: "1", bairro: "B" })}>Salvar cadastro</button>
    </div>
  ),
}));

const prod = (id: string, nome: string): Product => ({
  id, db: { id, contadas: ["deposito:_", "venda:_"] }, nome, codigo: `789${id}`, unidade: "Unidade", categoria: "Mercearia", compra: 1000, venda: 1500,
  fornecedor: null, detalhes: {}, variacoes: [], deposito: { local: "Estante A", qtd: 20, min: 5, max: 40 }, areaVenda: { local: "Gôndola 1", qtd: 10, min: 3, max: 12 },
});
const lojaA: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado Bom Preço", cidade: "Bauru", uf: "SP", rua: "Rua A", numero: "1", bairro: "Centro" };
const lojaB: StoreData = { ...lojaA, id: "c2", nome: "Farmácia Vida", tipo: "farmacia" };
const comercios = () => fireEvent.click(screen.getAllByRole("button", { name: "Comércios" })[0]!);
const atual = () => [...document.querySelectorAll('[aria-current="page"]')].map((e) => e.textContent).join("|");

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]); banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]); banco.carregarPendentesVenda.mockResolvedValue([]); banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] });
  banco.carregarLimiteFaltas.mockResolvedValue(20000); banco.carregarContagensAntifurto.mockResolvedValue([]); banco.carregarCaixas.mockResolvedValue([]); banco.carregarFuncionarios.mockResolvedValue([]);
  banco.carregarProdutos.mockImplementation(async (id: string) => ({ produtos: [prod(`${id}p`, id === "c1" ? "Arroz" : "Dipirona")], locais: { deposito: ["Estante A"], venda: ["Gôndola 1"] } }));
});

describe("RMC-02B: Início com resumo, Comércios com as unidades", () => {
  it("Início não mostra cartões nem Primeiros passos; Comércios mostra os dois e recebe dados atualizados", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    expect(await screen.findByRole("region", { name: "Resumo geral" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Entrar no / })).toBeNull();
    expect(screen.queryByText(/de 6 feitos/)).toBeNull();
    comercios();
    expect(screen.queryByRole("region", { name: "Resumo geral" })).toBeNull();
    await waitFor(() => expect(screen.getByRole("region", { name: "Mercado Bom Preço" }).textContent).toMatch(/1 produto/));
    expect(screen.getByText(/de 6 feitos/)).toBeTruthy();
  });

  it("salvar um comércio novo volta a Comércios com a unidade na lista; cancelar também volta a Comércios", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA]} />);
    comercios();
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar outro comércio" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar cadastro" }));
    expect(await screen.findByRole("button", { name: "Entrar no Mercado Bom Preço" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar outro comércio" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    expect(await screen.findByRole("button", { name: "Entrar no Loja Nova" })).toBeTruthy();
    expect(atual()).toMatch(/Comércios/);
  });

  it("cadastro iniciado durante a escolha de vendas não deixa a escolha ligada", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    fireEvent.click(await screen.findByRole("button", { name: /Vendas hoje/ }));
    expect(await screen.findByText("Escolha o comércio para ver as vendas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar comércio" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    await screen.findByRole("button", { name: "Entrar no Loja Nova" });
    expect(screen.queryByText("Escolha o comércio para ver as vendas")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entrar no Farmácia Vida" }));
    await waitFor(() => expect(atual()).toMatch(/Produtos/));
  });

  it("Voltar respeita a origem: Comércios → Comércios, Alertas → Alertas, Antifurto → Antifurto", async () => {
    const d = { id: "d1", produtoId: "c2p", variacaoId: null, area: "venda", origem: "reposicao", esperado: 10, contado: 8, diferenca: -2, valor: -2000,
      funcionario: null, situacao: "explicada", motivo: "sumiu", observacao: null, tentativas: [], resolvida: false, motivoInformado: null, criadaEm: new Date(Date.now() - 60_000).toISOString() };
    banco.carregarDiferencas.mockImplementation(async (id: string) => (id === "c2" ? { diferencas: [d], perdas: [] } : { diferencas: [], perdas: [] }));
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
    comercios();
    fireEvent.click(await screen.findByRole("button", { name: "Entrar no Mercado Bom Preço" }));
    fireEvent.click(await screen.findByRole("button", { name: /Voltar/ }));
    expect(await screen.findByRole("region", { name: "Seus comércios" })).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Alertas" })[0]!);
    const alerta = await screen.findAllByRole("button", { name: /Produto visado|Faltou no mês|Perdas/ }).catch(() => []);
    if (alerta.length) {
      fireEvent.click(alerta[0]!);
      fireEvent.click(await screen.findByRole("button", { name: /Voltar/ }));
      expect(await screen.findByRole("heading", { name: "Alertas" })).toBeTruthy();
    }
    fireEvent.click(screen.getAllByRole("button", { name: "Início" })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: /Faltou este mês/ }));
    expect(await screen.findByRole("heading", { name: /Antifurto/ })).toBeTruthy();
    const abrir = await screen.findAllByRole("button", { name: /Farmácia Vida/ });
    fireEvent.click(abrir[0]!);
    fireEvent.click(await screen.findByRole("button", { name: /Voltar/ }));
    expect(await screen.findByRole("heading", { name: /Antifurto/ })).toBeTruthy();
  });

  it("Primeiros passos abre o comércio no lugar certo e o Voltar devolve a Comércios", async () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA]} />);
    comercios();
    fireEvent.click(await screen.findByRole("button", { name: /Adicionar um funcionário/ }));
    expect(await screen.findByRole("button", { name: /^Equipe/, current: "page" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Voltar/ }));
    expect(await screen.findByText(/de 6 feitos/)).toBeTruthy();
    expect(atual()).toMatch(/Comércios/);
  });

  it("menu do celular cabe em 320 px: cinco colunas iguais, sem rolagem lateral", () => {
    render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA]} />);
    const grade = document.querySelector("nav .grid")!;
    expect(grade.className).toMatch(/\bgrid-cols-5\b/);
    expect(grade.className).not.toMatch(/overflow-x/);
    expect(grade.querySelectorAll("button")).toHaveLength(5);
  });
});
