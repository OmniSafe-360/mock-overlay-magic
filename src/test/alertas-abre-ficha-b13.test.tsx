import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { StoreSpace } from "@/components/StoreSpace";
import type { StoreData } from "@/components/StoreSetup";
import type { Product } from "@/components/ProductArea";

// B13: vindo de Alertas, a ficha abre mesmo quando os produtos do comércio ainda estão chegando.
vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));
const f = () => vi.fn(async () => undefined as never);
const base = {
  suppliers: [], saved: false, onSalvarPedido: f(), onPedidoEnviado: f(), onCancelarPedido: f(), onNovoLinkPedido: f(), onPagamentoPedido: f(),
  onAddSupplier: f(), onUpdateSupplier: f(), onBack: vi.fn(), onNew: vi.fn(), onEdit: vi.fn(), onDismissSaved: vi.fn(),
  store: { id: "c1", tipo: "mercado", nome: "Mercado", cidade: "Bauru", uf: "SP", rua: "r", numero: "1", bairro: "b" } as StoreData,
};
const prod = (id: string, nome: string): Product => ({ id, nome, fornecedor: "", codigo: "789", compra: 1000, venda: 1500, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [],
  db: { id, contadas: ["deposito:_", "venda:_"] }, deposito: { local: "E", qtd: 0, min: 1, max: 10 }, areaVenda: { local: "G", qtd: 0, min: 1, max: 10 }, validade: { controla: false, avisos: [], dep: {}, ven: {} } });
const antigo = prod("p1", "Arroz");
const novo = prod("p2", "Feijão novo");
const ficha = () => screen.queryByText("Quanto tem");

describe("B13 — Alertas abre a ficha", () => {
  it("produto que ainda não estava na lista abre a ficha quando a lista atualiza", () => {
    const r = render(<StoreSpace {...base} products={[antigo]} inicio={{ produtoId: "p2" }} />);
    expect(ficha()).toBeNull();
    r.rerender(<StoreSpace {...base} products={[antigo, novo]} inicio={{ produtoId: "p2" }} />);
    expect(ficha()).toBeInTheDocument();
    expect(screen.getAllByText("Feijão novo").length).toBeGreaterThan(0);
  });
  it("depois de voltar da ficha, a lista atualizada não reabre a ficha", () => {
    const r = render(<StoreSpace {...base} products={[antigo]} inicio={{ produtoId: "p2" }} />);
    r.rerender(<StoreSpace {...base} products={[antigo, novo]} inicio={{ produtoId: "p2" }} />);
    fireEvent.click(screen.getByRole("button", { name: /^Produtos$/ }));
    expect(ficha()).toBeNull();
    r.rerender(<StoreSpace {...base} products={[antigo, { ...novo }]} inicio={{ produtoId: "p2" }} />);
    expect(ficha()).toBeNull();
  });
  it("se a pessoa já foi para outra parte, a ficha não abre sozinha depois", () => {
    const r = render(<StoreSpace {...base} products={[antigo]} inicio={{ produtoId: "p2" }} />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Partes do comércio" })).getByRole("button", { name: /Pedidos/ }));
    r.rerender(<StoreSpace {...base} products={[antigo, novo]} inicio={{ produtoId: "p2" }} />);
    expect(ficha()).toBeNull();
  });
  it("atalho do Atenção hoje (Vendido sem cadastro) antes de a lista chegar também cancela a ficha", () => {
    const r = render(<StoreSpace {...base} products={[antigo]} vendidoSemCadastro={2} inicio={{ produtoId: "p2" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Vendido sem cadastro/ }));
    r.rerender(<StoreSpace {...base} products={[antigo, novo]} vendidoSemCadastro={2} inicio={{ produtoId: "p2" }} />);
    expect(ficha()).toBeNull();
  });
});
