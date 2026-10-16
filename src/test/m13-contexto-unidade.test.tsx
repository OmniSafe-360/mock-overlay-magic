import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { StoreSpace } from "@/components/StoreSpace";
import type { StoreData } from "@/components/StoreSetup";
import type { Product } from "@/components/ProductArea";
import { nomeAreaVenda, textoDoTipo } from "@/lib/exemplos";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));
const f = () => vi.fn(async () => undefined as never);
const base = {
  products: [] as Product[], suppliers: [], saved: false, onSalvarPedido: f(), onPedidoEnviado: f(), onCancelarPedido: f(), onNovoLinkPedido: f(), onPagamentoPedido: f(),
  onAddSupplier: f(), onUpdateSupplier: f(), onBack: vi.fn(), onNew: vi.fn(), onEdit: vi.fn(), onDismissSaved: vi.fn(),
};
const loja = (id: string, nome: string, tipo: StoreData["tipo"] = "mercado"): StoreData => ({ id, tipo, nome, cidade: "Bauru", uf: "SP", rua: "r", numero: "1", bairro: "b" });
const area = () => screen.getByTestId("area-atual").textContent;
const barra = () => within(screen.getByRole("navigation", { name: "Partes do comércio" }));
const prod: Product = { id: "p1", nome: "Arroz", fornecedor: "", codigo: "789", compra: 1000, venda: 1500, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], db: { id: "p1", contadas: ["deposito:_", "venda:_"] }, deposito: { local: "E", qtd: 8, min: 1, max: 10 }, areaVenda: { local: "G", qtd: 3, min: 1, max: 10 }, validade: { controla: false, avisos: [], dep: {}, ven: {} } };
const ABAS = ["Produtos", "Depósito", "Gôndolas", "Pedidos", "Fornecedores", "Equipe", "Vendas", "Diferenças"] as const;
const TIPOS: StoreData["tipo"][] = ["mercado", "farmacia", "roupas", "construcao", "pet", "autopecas"];

describe("M13 — contexto da unidade", () => {
  it("mostra o nome inteiro (sem limite de linhas) e a cidade/UF", () => {
    render(<StoreSpace {...base} store={loja("c1", "Supermercado Bom Preço Unidade Centro Norte")} onAtualizar={vi.fn()} />);
    const h = screen.getByRole("heading", { level: 1 });
    expect(h.textContent).toBe("Supermercado Bom Preço Unidade Centro Norte");
    expect(h.className).not.toMatch(/line-clamp|truncate/);
    expect(screen.getByText("Bauru - SP")).toBeInTheDocument();
  });
  it("troca de unidade sem sobrar o nome anterior (uma e seis unidades)", () => {
    const nomes = ["Supermercado Bom Preço Unidade Centro Norte", "Supermercado Bom Preço Unidade Jardim Sul", "Farmácia Vida", "Loja Estilo", "Pet Amigo", "Auto Peças Sul"];
    const r = render(<StoreSpace {...base} store={loja("c0", nomes[0]!)} />);
    nomes.forEach((n, i) => {
      r.rerender(<StoreSpace {...base} store={loja(`c${i}`, n)} />);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(n);
      nomes.filter((o) => o !== n).forEach((o) => expect(screen.queryByText(o)).toBeNull());
    });
  });
  it("Voltar e Atualizar continuam funcionando", () => {
    const onBack = vi.fn(), onAtualizar = vi.fn();
    const r = render(<StoreSpace {...base} onBack={onBack} onAtualizar={onAtualizar} store={loja("c1", "Mercado")} />);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(onBack).toHaveBeenCalledTimes(1); expect(onAtualizar).toHaveBeenCalledTimes(1);
    r.rerender(<StoreSpace {...base} onBack={onBack} onAtualizar={onAtualizar} atualizando store={loja("c1", "Mercado")} />);
    expect(screen.getByRole("button", { name: "Atualizando" })).toBeDisabled();
  });
  it("Área atual nas oito áreas e nos seis tipos, com o nome completo e sem aria-live", () => {
    for (const tipo of TIPOS) {
      const r = render(<StoreSpace {...base} store={loja("c1", "Comércio", tipo)} />);
      expect(screen.getByTestId("area-atual").getAttribute("aria-live")).toBeNull();
      ABAS.forEach((t, i) => {
        fireEvent.click(barra().getAllByRole("button")[i]!);
        const esperado = t === "Gôndolas" ? nomeAreaVenda(tipo) : textoDoTipo(tipo)(t);
        expect(area()).toBe(`Área atual: ${esperado}`);
        expect(barra().getAllByRole("button")[i]!.getAttribute("aria-current")).toBe("page");
      });
      r.unmount();
    }
  });
  it("entrada pelos alertas abre já na área certa", () => {
    const casos: [Parameters<typeof StoreSpace>[0]["inicio"], string][] = [[{ pedidos: "contas" }, "Pedidos"], [{ relatorio: true }, "Diferenças"], [{ aba: "Vendas" }, "Vendas"]];
    for (const [inicio, nome] of casos) {
      const r = render(<StoreSpace {...base} store={loja("c1", "Mercado")} inicio={inicio} />);
      expect(area()).toBe(`Área atual: ${nome}`); r.unmount();
    }
  });
  it("ao voltar da ficha a área e o nome continuam os mesmos", () => {
    render(<StoreSpace {...base} products={[prod]} store={loja("c1", "Mercado")} />);
    fireEvent.click(screen.getByRole("button", { name: /Arroz/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Produtos" }).find((b) => !b.closest("nav"))!);
    expect(area()).toBe("Área atual: Produtos");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mercado");
  });
});
