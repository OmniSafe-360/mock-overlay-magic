import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProductWizard } from "@/components/ProductArea";
import { codigoConsultavel, gtinValido, nomeSugerido, type ItemCatalogo } from "@/lib/catalogo";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const moca: ItemCatalogo = { codigo: "7891000100103", nome: "Leite Condensado Integral moça", marca: "Nestlé", quantidade: "395 g", imagemUrl: "https://images.openfoodfacts.org/x.jpg", fonte: "openfoodfacts" };

describe("regras do catálogo", () => {
  it("dígito final e códigos de uso interno", () => {
    expect(gtinValido("7891000100103")).toBe(true);
    expect(gtinValido("7891000100104")).toBe(false);
    expect(gtinValido("012345678905")).toBe(true);
    expect(gtinValido("96385074")).toBe(true);
    expect(codigoConsultavel("7891000100103")).toBe(true);
    expect(codigoConsultavel("2900000000018")).toBe(false); // código interno do Omni
    expect(codigoConsultavel("7893464100065")).toBe(false); // dígito errado (o Arroz do teste)
    expect(codigoConsultavel("abc")).toBe(false);
  });
  it("nome sugerido junta marca e tamanho sem repetir e arruma maiúsculas", () => {
    expect(nomeSugerido(moca)).toBe("Leite Condensado Integral moça Nestlé 395 g");
    expect(nomeSugerido({ nome: "Refrigerante Coca Cola Garrafa 2l", marca: "COCA-COLA", quantidade: "2l" })).toBe("Refrigerante Coca Cola Garrafa 2l");
    expect(nomeSugerido({ nome: "LEITE PO NINHO INTEGRAL", marca: "Ninho", quantidade: "400g" })).toBe("Leite Po Ninho Integral 400 g");
    expect(nomeSugerido({ nome: "Tradicional", marca: "3 Corações", quantidade: "250 g" })).toBe("Tradicional 3 Corações 250 g");
    expect(nomeSugerido({ nome: "Brownie", marca: null, quantidade: null })).toBe("Brownie");
    expect(nomeSugerido({ nome: "x".repeat(170), marca: "M", quantidade: null }).length).toBe(160);
  });
});

function abrir(tipo: string, buscar = vi.fn(async (_c: string): Promise<ItemCatalogo | null> => moca), products: unknown[] = []) {
  render(<ProductWizard store={{ id: "s", nome: "Loja", tipo } as never} products={products as never} suppliers={[]} onAddSupplier={() => 1}
    onCancel={() => {}} onSave={vi.fn()} onBuscarCatalogo={buscar} />);
  return buscar;
}
const digitarCodigo = (c: string) => {
  fireEvent.click(screen.getByRole("button", { name: /Digitar código/ }));
  fireEvent.change(screen.getByLabelText("Código do produto"), { target: { value: c } });
};

describe("cadastro: sugestão ao digitar ou bipar o código", () => {
  it("mercado: sugere o nome e só preenche quando o comerciante toca em Usar", async () => {
    const buscar = abrir("mercado");
    digitarCodigo("7891000100103");
    expect(await screen.findByText("Leite Condensado Integral moça Nestlé 395 g")).toBeTruthy();
    expect(buscar).toHaveBeenCalledWith("7891000100103");
    expect((screen.getByLabelText("Nome do produto") as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/Fonte: Open Food Facts/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Usar este nome/ }));
    expect((screen.getByLabelText("Nome do produto") as HTMLInputElement).value).toBe("Leite Condensado Integral moça Nestlé 395 g");
    expect(screen.queryByText(/Encontramos este produto/)).toBeNull();
  });
  it("Não é este esconde a sugestão daquele código", async () => {
    abrir("mercado");
    digitarCodigo("7891000100103");
    fireEvent.click(await screen.findByRole("button", { name: "Não é este" }));
    expect(screen.queryByText(/Encontramos este produto/)).toBeNull();
  });
  it("não consulta código inválido, código interno, outros tipos de comércio nem código já cadastrado", async () => {
    const b1 = abrir("mercado");
    digitarCodigo("7891000100104");
    fireEvent.change(screen.getByLabelText("Código do produto"), { target: { value: "2900000000018" } });
    await new Promise((r) => setTimeout(r, 450));
    expect(b1).not.toHaveBeenCalled();
    document.body.innerHTML = "";
    const b2 = abrir("farmacia");
    digitarCodigo("7891000100103");
    await new Promise((r) => setTimeout(r, 450));
    expect(b2).not.toHaveBeenCalled();
    document.body.innerHTML = "";
    const b3 = abrir("mercado", undefined, [{ id: "p", codigo: "7891000100103", nome: "Já tem", variacoes: [], embalagens: [], detalhes: {}, unidade: "Unidade", categoria: "Mercearia", compra: 0, venda: 0, fornecedor: null }]);
    digitarCodigo("7891000100103");
    await new Promise((r) => setTimeout(r, 450));
    expect(b3).not.toHaveBeenCalled();
  });
  it("sem resultado ou sem internet: segue normal, sem aviso", async () => {
    const buscar = abrir("mercado", vi.fn(async () => { throw new Error("Failed to fetch"); }));
    digitarCodigo("7891000100103");
    await waitFor(() => expect(buscar).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/Encontramos este produto/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
