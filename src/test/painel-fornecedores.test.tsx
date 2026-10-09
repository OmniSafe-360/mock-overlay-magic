import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Product, Supplier } from "@/components/ProductArea";
import { PainelFornecedores, linkWhatsApp } from "@/components/PainelFornecedores";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const sol: Supplier = { id: 1, nome: "Distribuidora Sol", tel: "11988887777", email: "vendas@sol.com.br", dbId: "a" };
const lua: Supplier = { id: 2, nome: "Atacado Lua", tel: "", email: "", dbId: "b" };
let n = 0;
const b = (nome: string, fornecedor: number | null, extra: Partial<Product> = {}): Product => ({
  id: ++n, codigo: String(n), nome, compra: 100, venda: 200, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor,
  deposito: { local: "A", qtd: 40, min: 10, max: null }, areaVenda: { local: "G", qtd: 12, min: 5, max: null }, ...extra,
});
const arroz = b("Arroz", 1, { deposito: { local: "A", qtd: 6, min: 10, max: null } });
const feijao = b("Feijão", 1);
const cafe = b("Café", null);

function abrir(extra: Partial<Parameters<typeof PainelFornecedores>[0]> = {}) {
  const props = { products: [arroz, feijao, cafe], tipo: "mercado", suppliers: [lua, sol], onOpen: vi.fn(), onAdd: vi.fn(async () => 3), onUpdate: vi.fn(async () => {}), ...extra };
  render(<PainelFornecedores {...props} />);
  return props;
}

describe("aba Fornecedores", () => {
  it("link do WhatsApp com +55", () => {
    expect(linkWhatsApp("(11) 98888-7777")).toBe("https://wa.me/5511988887777");
    expect(linkWhatsApp("11988887777", "Olá")).toBe("https://wa.me/5511988887777?text=Ol%C3%A1");
    expect(linkWhatsApp("123")).toBe("");
  });
  it("quem tem produto para comprar vem primeiro; contatos com um toque", () => {
    abrir();
    const cards = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(cards).toEqual(["Distribuidora Sol", "Atacado Lua", "Sem fornecedor"]);
    const s = within(screen.getByRole("region", { name: "Distribuidora Sol" }));
    expect(s.getByText("(11) 98888-7777")).toBeTruthy(); expect(s.getByText("vendas@sol.com.br")).toBeTruthy();
    expect(s.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toBe("https://wa.me/5511988887777");
    expect(s.getByRole("link", { name: /Ligar/ }).getAttribute("href")).toBe("tel:11988887777");
    expect(s.getByRole("link", { name: /E-mail/ }).getAttribute("href")).toBe("mailto:vendas@sol.com.br");
    expect(s.getByText("1 para comprar")).toBeTruthy();
  });
  it("fornecedor sem contato avisa e não tem links", () => {
    abrir();
    const l = within(screen.getByRole("region", { name: "Atacado Lua" }));
    expect(l.queryAllByRole("link")).toHaveLength(0);
    expect(l.getByText(/informe o WhatsApp ou o e-mail/)).toBeTruthy();
    expect(l.getByText("Nenhum produto neste comércio")).toBeTruthy();
  });
  it("abrir a lista de produtos e ir para o produto", () => {
    const t = abrir();
    const s = within(screen.getByRole("region", { name: "Distribuidora Sol" }));
    fireEvent.click(s.getByRole("button", { name: /2 produtos neste comércio/ }));
    expect(s.getByText("Comprar")).toBeTruthy();
    fireEvent.click(s.getByRole("button", { name: /Arroz/ }));
    expect(t.onOpen).toHaveBeenCalledWith(arroz);
  });
  it("produtos sem fornecedor ficam num grupo", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Sem fornecedor/ }));
    expect(screen.getByRole("button", { name: /Café/ })).toBeTruthy();
  });
  it("editar fornecedor envia os dados novos", async () => {
    const t = abrir();
    fireEvent.click(screen.getByRole("button", { name: "Editar Atacado Lua" }));
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Atacado Lua");
    fireEvent.change(screen.getByLabelText("Telefone / WhatsApp"), { target: { value: "21977776666" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(t.onUpdate).toHaveBeenCalledWith(lua, { nome: "Atacado Lua", tel: "(21) 97777-6666", email: "" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("novo fornecedor", async () => {
    const t = abrir({ suppliers: [] });
    expect(screen.getByText("Nenhum fornecedor ainda")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Novo fornecedor/ }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Distribuidora Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar fornecedor" }));
    await waitFor(() => expect(t.onAdd).toHaveBeenCalledWith({ nome: "Distribuidora Nova", tel: "", email: "" }));
  });
});
