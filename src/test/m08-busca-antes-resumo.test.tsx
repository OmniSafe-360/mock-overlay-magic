import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { StoreSpace } from "@/components/StoreSpace";
import type { StoreData } from "@/components/StoreSetup";
import type { Product } from "@/components/ProductArea";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));
const loja: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado Teste", cidade: "Jacarezinho", uf: "PR", rua: "r", numero: "1", bairro: "b" };
const f = () => vi.fn(async () => undefined as never);
const base = (id: number, nome: string, extra: Partial<Product> = {}): Product => ({
  id, codigo: "789" + id, nome, compra: 1000, venda: 1500, unidade: "Pacote", categoria: "Mercearia",
  detalhes: {}, variacoes: [], fornecedor: 1, validade: { controla: false, avisos: [], dep: {}, ven: {} },
  deposito: { local: "A", qtd: 40, min: 10, max: null }, areaVenda: { local: "G", qtd: 12, min: 5, max: null }, ...extra,
});
const arroz = base(1, "Arroz");
const feijao = base(2, "Feijão", { areaVenda: { local: "G", qtd: 3, min: 5, max: null } });
const sup = [{ id: 1, nome: "Distribuidora Sol", tel: "", email: "" }];
function montar(extra: Record<string, unknown> = {}) {
  const props = {
    store: loja, products: [arroz, feijao], suppliers: sup, saved: false, onSalvarPedido: f(), onPedidoEnviado: f(), onCancelarPedido: f(), onNovoLinkPedido: f(), onPagamentoPedido: f(),
    onAddSupplier: f(), onUpdateSupplier: f(), onBack: vi.fn(), onNew: vi.fn(), onEdit: vi.fn(), onDismissSaved: vi.fn(), ...extra,
  };
  render(<StoreSpace {...(props as never)} />);
  return props;
}
const depois = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("M08 — busca antes do resumo", () => {
  it("ordem: busca → Novo produto → resumo → filtros → cartões, com um resumo só", () => {
    montar();
    const busca = screen.getByRole("searchbox", { name: "Buscar produto" });
    const novo = screen.getByRole("button", { name: /Novo produto/ });
    const resumos = screen.getAllByRole("region", { name: "Atenção hoje" });
    expect(resumos).toHaveLength(1);
    const filtros = screen.getByRole("group", { name: "Mostrar" });
    const lista = screen.getAllByRole("listitem")[0]!;
    expect(depois(busca, novo)).toBe(true);
    expect(depois(novo, resumos[0]!)).toBe(true);
    expect(depois(resumos[0]!, filtros)).toBe(true);
    expect(depois(filtros, lista)).toBe(true);
  });
  it("busca e filtro continuam depois de abrir e voltar da ficha", () => {
    montar();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar produto" }), { target: { value: "fei" } });
    fireEvent.click(screen.getByRole("button", { name: /Precisam de atenção/ }));
    fireEvent.click(within(screen.getByRole("list")).getByRole("button", { name: /Feijão/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /Voltar/ })[0]!);
    expect((screen.getByRole("searchbox", { name: "Buscar produto" }) as HTMLInputElement).value).toBe("fei");
    expect(screen.getByRole("button", { name: /Precisam de atenção/ }).getAttribute("aria-pressed")).toBe("true");
  });
  it("atalho do resumo continua levando ao mesmo destino", () => {
    montar({ vendidoSemCadastro: 2 });
    fireEvent.click(within(screen.getByRole("region", { name: "Atenção hoje" })).getByRole("button", { name: /Vendido sem cadastro/ }));
    const barra = within(screen.getByRole("navigation", { name: "Partes do comércio" }));
    expect(barra.getByRole("button", { name: /^Vendas/ }).getAttribute("aria-current")).toBe("page");
  });
  it("comércio vazio com alerta: resumo antes do cartão inicial, sem duplicar", () => {
    montar({ products: [], diferencasDecidir: 1 });
    const resumos = screen.getAllByRole("region", { name: "Atenção hoje" });
    expect(resumos).toHaveLength(1);
    expect(depois(resumos[0]!, screen.getByText("Cadastre seu primeiro produto"))).toBe(true);
  });
  it("comércio vazio sem alerta: sem resumo nem espaço vazio", () => {
    montar({ products: [] });
    expect(screen.queryByRole("region", { name: "Atenção hoje" })).toBeNull();
    const cartao = screen.getByText("Cadastre seu primeiro produto").closest("div.mx-auto")!;
    expect(cartao.parentElement!.children).toHaveLength(1);
  });
});
