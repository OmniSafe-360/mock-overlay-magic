import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BinaryBitmap, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from "@zxing/library";
import { codigoComparavel, codigosIguais, ean13, eanUpcEquivalente } from "@/lib/codigoBarras";
import { hintsLeitura, textoLeitura } from "@/lib/leituraCodigo";
import { firstInvalidStep, mainCodeError, usedCodes } from "@/lib/variations";
import { errosEmbalagem } from "@/lib/embalagem";
import { ProductWizard, type Product } from "@/components/ProductArea";

const upc = "036000291452", ean = "0036000291452";
const produto: Product = { id: "p1", codigo: ean, nome: "Produto existente", compra: 1000, venda: 1500,
  unidade: "Unidade", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: null };
vi.mock("@/components/Scanner", () => ({ Scanner: ({ onCode, mercado }: { onCode: (c: string) => void; mercado: boolean }) =>
  <button onClick={() => onCode(upc)}>Ler código {mercado ? "do mercado" : "antigo"}</button> }));

describe("correspondência UPC/EAN apenas no Mercado", () => {
  it("reconhece o equivalente válido sem alterar o original", () => {
    expect(eanUpcEquivalente(upc)).toBe(ean);
    expect(eanUpcEquivalente(ean)).toBe(ean);
    expect(codigosIguais(upc, ean, true)).toBe(true);
    expect(codigosIguais(upc, ean)).toBe(false);
  });
  it.each(["789", "96385074", "17896263503200", "036000291453", "0036000291453", "ABC-12", "", "290000000001"])("não interpreta %s como um equivalente", (c) => {
    expect(eanUpcEquivalente(c)).toBeNull();
    expect(codigoComparavel(c, true)).toBe(c);
  });
  it("código interno 29 não vira código de balança ou caixa", () => {
    expect(codigoComparavel("2900000000018", true)).toBe("2900000000018");
    expect(codigosIguais("2900000000018", "02900000000018", true)).toBe(false);
  });
  it("recusa cadastro duplicado e continua permitindo editar o próprio produto", () => {
    const usados = usedCodes([produto], undefined, true);
    expect(mainCodeError(upc, usados, [], true)).toBeTruthy();
    expect(mainCodeError(upc, usedCodes([produto], produto.id, true), [], true)).toBe("");
    expect(mainCodeError(upc, usedCodes([produto]))).toBe("");
    expect(mainCodeError(upc, usedCodes([], undefined, true), [], true)).toBe("");
    expect(firstInvalidStep({ ...produto, codigo: upc }, false, usados,
      { unidades: ["Unidade"], categorias: ["Mercearia"], equivalenciaEanUpc: true })?.step).toBe(0);
  });
  it("não confunde o código da unidade com uma embalagem, nem permite duas embalagens equivalentes", () => {
    const emb = { uid: "cx1", preco: 0, tipo: "Caixa", qtd: 12, codigo: ean };
    expect(errosEmbalagem({ ...emb, codigo: upc }, -1, [], ean, new Set(), "Unidade", true).codigo).toMatch(/mesmo do produto/);
    expect(errosEmbalagem({ ...emb, tipo: "Fardo", codigo: upc }, -1, [emb], "789", new Set(), "Unidade", true).codigo).toMatch(/Outra embalagem/);
    expect(errosEmbalagem({ ...emb, codigo: upc }, -1, [], "789", usedCodes([produto], undefined, true), "Unidade", true).codigo).toBeTruthy();
    expect(errosEmbalagem({ ...emb, codigo: "17896263503200" }, -1, [], "7896263503203", new Set(), "Unidade", true).codigo).toBeUndefined();
    expect(errosEmbalagem({ ...emb, codigo: upc }, -1, [], ean, new Set()).codigo).toBeUndefined();
  });
});

function leituraReal(modulos: string, mercado: boolean) {
  const mods = "0".repeat(30) + modulos + "0".repeat(30), px = 3, h = 60, w = mods.length * px;
  const lum = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lum[y * w + x] = mods[Math.floor(x / px)] === "1" ? 0 : 255;
  const hints = hintsLeitura(mercado), r = new MultiFormatReader();
  r.setHints(hints);
  const res = r.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, w, h))), hints);
  return textoLeitura(res.getText(), res.getBarcodeFormat(), mercado);
}
/** Barras/espaços intercalados do padrão ITF, sem simular a biblioteca de leitura. */
function itf(codigo: string) {
  const padroes = ["11221", "21112", "12112", "22111", "11212", "21211", "12211", "11122", "21121", "12121"];
  const larguras = [1, 1, 1, 1];
  for (let i = 0; i < codigo.length; i += 2) for (let j = 0; j < 5; j++)
    larguras.push(Number(padroes[Number(codigo[i])]![j]), Number(padroes[Number(codigo[i + 1])]![j]));
  larguras.push(2, 1, 1);
  return larguras.map((v, i) => (i % 2 ? "0" : "1").repeat(v)).join("");
}
describe("leitor real com imagens de códigos", () => {
  it("lê ITF-14 de uma caixa no Mercado", () => expect(leituraReal(itf("17896263503200"), true)).toBe("17896263503200"));
  it("ITF continua desabilitado fora do Mercado", () => expect(() => leituraReal(itf("17896263503200"), false)).toThrow());
  it("recusa ITF curto para evitar ler um fragmento da embalagem", () => expect(() => leituraReal(itf("12345678"), true)).toThrow());
  it("ignora ITF maior que 14 mesmo quando a biblioteca o reconhece", () => expect(leituraReal(itf("1234567890123456"), true)).toBeNull());
  it("EAN com zero inicial devolvido como UPC ainda encontra a mesma identidade", () => {
    const lido = leituraReal(ean13(ean), true);
    expect(lido).toBe(upc);
    expect(codigosIguais(lido!, ean, true)).toBe(true);
  });
});

describe("cadastro real do Mercado", () => {
  function abrir(initial?: Product) {
    const onSave = vi.fn();
    render(<ProductWizard store={{ id: "m1", tipo: "mercado", nome: "Mercado" } as never} products={[produto]} initial={initial}
      suppliers={[]} onAddSupplier={() => "f1"} onCancel={() => {}} onSave={onSave} />);
    return { onSave, submit: () => fireEvent.submit(document.querySelector("form")!) };
  }
  it("scanner do Mercado bloqueia UPC equivalente a EAN já cadastrado", () => {
    const t = abrir();
    fireEvent.click(screen.getByRole("button", { name: "Escanear código" }));
    fireEvent.click(screen.getByRole("button", { name: "Ler código do mercado" }));
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Outro produto" } });
    t.submit();
    expect(screen.getByText("Este código já está cadastrado")).toBeTruthy();
    expect(screen.getByText("Qual é o código do produto?")).toBeTruthy();
    expect(t.onSave).not.toHaveBeenCalled();
  });
  it("editar mantendo o código original salva sem contar de novo", () => {
    const t = abrir(produto);
    for (let i = 0; i < 8; i++) t.submit();
    expect(t.onSave).toHaveBeenCalledTimes(1);
    expect(t.onSave.mock.calls[0]![0]).toMatchObject({ id: produto.id, codigo: ean });
  });
  it("edição pelo resumo não permite código equivalente ao da própria caixa", () => {
    const t = abrir({ ...produto, codigo: "7896263503203", embalagens: [{ uid: "cx1", tipo: "Caixa", qtd: 12, codigo: ean, preco: 0 }] });
    for (let i = 0; i < 7; i++) t.submit();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]!);
    fireEvent.change(screen.getByLabelText("Código do produto"), { target: { value: upc } });
    t.submit();
    expect(screen.getByText("Este código já pertence a uma embalagem deste produto.")).toBeTruthy();
    expect(t.onSave).not.toHaveBeenCalled();
  });
});
