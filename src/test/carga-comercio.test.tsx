import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { OwnerApp } from "@/components/OwnerHome";
import type { Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";
import { registroEnvio } from "@/lib/envios";

const banco = vi.hoisted(() => ({ carregarFornecedores: vi.fn(), carregarProdutos: vi.fn(), carregarPedidos: vi.fn(), conferirEnvio: vi.fn(), carregarVendas: vi.fn(), carregarPendentesVenda: vi.fn(), carregarDiferencas: vi.fn(), carregarLimiteFaltas: vi.fn() }));
vi.mock("@/lib/banco", async (original) => ({ ...await original<object>(), ...banco }));
vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));
const store: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado A", cidade: "Bauru", uf: "SP", rua: "Rua A", numero: "1", bairro: "Centro" };
const produto = (nome = "Arroz atual"): Product => ({
  id: "p1", db: { id: "p1", contadas: ["deposito:_", "venda:_"] }, nome, codigo: "789", unidade: "Unidade", categoria: "Mercearia", compra: 1000, venda: 1500,
  fornecedor: null, detalhes: {}, variacoes: [], deposito: { local: "Estante A", qtd: 8, min: 2, max: 20 }, areaVenda: { local: "Gôndola 1", qtd: 3, min: 1, max: 10 },
});
const carga = (nome?: string) => ({ produtos: [produto(nome)], locais: { deposito: ["Estante A"], venda: ["Gôndola 1"] } });
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]);
  banco.carregarProdutos.mockResolvedValue(carga()); banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]); banco.carregarPendentesVenda.mockResolvedValue([]); banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] }); banco.carregarLimiteFaltas.mockResolvedValue(20000);
});
async function abrir(stores = [store]) {
  const r = render(<OwnerApp userId="u1" owner="Monica" initial={stores} />);
  fireEvent.click(screen.getByRole("button", { name: /Mercado A/ }));
  await screen.findByRole("button", { name: /Arroz atual/ });
  return r;
}
function promessa<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

it("falha de atualização com dados antigos fica visível e não apaga a lista", async () => {
  await abrir(); banco.carregarProdutos.mockRejectedValueOnce(new Error("Failed to fetch"));
  fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
  await screen.findByText(/Os dados exibidos são da última consulta/);
  expect(screen.getByRole("button", { name: /Arroz atual/ })).toBeInTheDocument();
  banco.carregarProdutos.mockResolvedValueOnce(carga("Arroz atualizado"));
  fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
  await screen.findByRole("button", { name: /Arroz atualizado/ });
  expect(screen.queryByText(/Os dados exibidos são da última consulta/)).not.toBeInTheDocument();
});
it("resposta atrasada da mesma loja não sobrescreve a consulta mais recente", async () => {
  await abrir(); const antiga = promessa<ReturnType<typeof carga>>();
  const antes = banco.carregarProdutos.mock.calls.length;
  banco.carregarProdutos.mockReturnValueOnce(antiga.promise);
  fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
  await waitFor(() => expect(banco.carregarProdutos).toHaveBeenCalledTimes(antes + 1));
  banco.carregarProdutos.mockResolvedValueOnce(carga("Arroz recente"));
  act(() => { window.dispatchEvent(new Event("online")); });
  await screen.findByRole("button", { name: /Arroz recente/ });
  await act(async () => antiga.resolve(carga("Arroz antigo")));
  expect(screen.queryByRole("button", { name: /Arroz antigo/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Arroz recente/ })).toBeInTheDocument();
});
it("erro de pedidos não vira uma lista vazia nem permite montar compra sem conferir", async () => {
  banco.carregarPedidos.mockRejectedValue(new Error("Failed to fetch"));
  await abrir(); await screen.findByText(/Não foi possível atualizar os pedidos/);
  fireEvent.click(screen.getByRole("button", { name: "Pedidos" }));
  expect(screen.queryByText("Nenhum pedido ainda")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Novo pedido" })).not.toBeInTheDocument();
  expect(screen.getByText(/Atualize os dados e confira os envios pendentes/)).toBeInTheDocument();
});
it("envio pendente reaparece após remontar a tela e exige conferência antes de cadastrar", async () => {
  const req = { operacao_id: "op1", produto_pedido: { produto: { id: "p1", comercio_id: "c1" } } };
  registroEnvio("u1", "c1", "produto").sessao("p1").guardar!({ pedido: req });
  banco.conferirEnvio.mockImplementation(async (s) => { s.guardar(null); s.incerto = null; });
  const r = await abrir(); r.unmount();
  await abrir();
  const confirmar = screen.getByRole("button", { name: "Conferir envio de produto" });
  fireEvent.click(confirmar);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Conferir envio de produto" })).not.toBeInTheDocument());
  expect(banco.conferirEnvio.mock.calls[0]![0].dbId).toBe("p1");
  expect(banco.conferirEnvio.mock.calls[0]![1]).toBe("produto");
});
it("um carregamento antigo de A não esconde a falha do comércio B", async () => {
  await abrir([store, { ...store, id: "c2", nome: "Mercado B" }]);
  const antiga = promessa<ReturnType<typeof carga>>();
  const antes = banco.carregarProdutos.mock.calls.length;
  banco.carregarProdutos.mockReturnValueOnce(antiga.promise);
  fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
  await waitFor(() => expect(banco.carregarProdutos).toHaveBeenCalledTimes(antes + 1));
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  // A tela inicial atualiza o resumo dos dois comércios antes de abrir B.
  await waitFor(() => expect(banco.carregarProdutos).toHaveBeenCalledTimes(antes + 3));
  banco.carregarProdutos.mockRejectedValueOnce(new Error("Failed to fetch"));
  fireEvent.click(screen.getByRole("button", { name: /Mercado B/ }));
  await screen.findByText("Não foi possível carregar os produtos. Verifique sua internet.");
  await act(async () => antiga.resolve(carga("Arroz de A")));
  expect(screen.getByText("Não foi possível carregar os produtos. Verifique sua internet.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Arroz de A/ })).not.toBeInTheDocument();
});
