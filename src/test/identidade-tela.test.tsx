import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { StoreSpace } from "@/components/StoreSpace";
import { PainelPedidos } from "@/components/PainelPedidos";
import { ProductWizard, type Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));
const store: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado", cidade: "Bauru", uf: "SP", rua: "Rua A", numero: "1", bairro: "Centro" };
const fornecedores = [{ id: "f1", dbId: "f1", nome: "Distribuidora Sol", tel: "", email: "" }, { id: "f2", dbId: "f2", nome: "Distribuidora Lua", tel: "", email: "" }];
const prod = (id: string, nome: string, fornecedor: string): Product => ({ id, nome, fornecedor, codigo: id === "p1" ? "789" : "123", compra: 1000, venda: 1500, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], db: { id, contadas: ["deposito:_", "venda:_"] }, deposito: { local: "Estante", qtd: 8, min: 1, max: 10 }, areaVenda: { local: "Gôndola", qtd: 3, min: 1, max: 10 }, validade: { controla: false, avisos: [], dep: {}, ven: {} } });

it("ficha aberta continua no mesmo produto e fornecedor depois de reordenar as listas", () => {
  const p1 = prod("p1", "Arroz", "f1"), p2 = prod("p2", "Feijão", "f2");
  const props = { store, suppliers: fornecedores, products: [p1, p2], saved: false, onSalvarPedido: vi.fn(), onPedidoEnviado: vi.fn(), onCancelarPedido: vi.fn(), onNovoLinkPedido: vi.fn(), onPagamentoPedido: vi.fn(), onAddSupplier: vi.fn(), onUpdateSupplier: vi.fn(), onBack: vi.fn(), onNew: vi.fn(), onEdit: vi.fn(), onDismissSaved: vi.fn() };
  const r = render(<StoreSpace {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /Arroz/ }));
  r.rerender(<StoreSpace {...props} products={[p2, { ...p1, nome: "Arroz atualizado" }]} suppliers={[...fornecedores].reverse()} />);
  expect(screen.getByRole("heading", { name: "Arroz atualizado" })).toBeInTheDocument();
  expect(screen.getByText("Distribuidora Sol")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Feijão" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  expect(props.onEdit.mock.calls[0]![0].id).toBe("p1");
});
it("montagem manual de pedido seleciona o fornecedor pelo UUID", () => {
  render(<PainelPedidos store={store} products={[]} suppliers={fornecedores} pedidos={[]} montarAgora onSalvar={vi.fn()} onEnviado={vi.fn()} onCancelar={vi.fn()} onNovoLink={vi.fn()} onPagamento={vi.fn()} onOpenProduto={vi.fn()} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "f2" } });
  expect(screen.getByRole("region", { name: "Distribuidora Lua" })).toBeInTheDocument();
});
it("uma área com local, mas sem contagem, permite informar a contagem sem inventar zero", () => {
  const p = prod("p1", "Arroz", "f1"); p.deposito!.qtd = null; p.db!.contadas = ["venda:_"];
  render(<ProductWizard store={store} products={[p]} suppliers={fornecedores} initial={p} onAddSupplier={vi.fn()} onCancel={vi.fn()} onSave={vi.fn()} />);
  const form = () => document.querySelector("form")!;
  for (let i = 0; i < 5; i++) fireEvent.submit(form());
  const campo = screen.getByRole("textbox", { name: /Quanto você contou/ });
  expect(campo).toHaveValue(""); expect(campo).not.toHaveAttribute("readonly");
  fireEvent.change(campo, { target: { value: "0" } });
  fireEvent.submit(form());
  expect(screen.getByRole("textbox", { name: /Mínimo/ })).toBeInTheDocument();
});
