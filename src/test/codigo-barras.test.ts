import { describe, expect, it } from "vitest";
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from "@zxing/library";
import { code128Possivel, desenharCodigo, digitoEan, eanValido } from "@/lib/codigoBarras";

/** Desenha os módulos como uma imagem e lê com o mesmo leitor do app (ZXing): prova que um scanner entende a etiqueta. */
function ler(codigo: string) {
  const b = desenharCodigo(codigo)!;
  const mods = "0".repeat(b.quietEsq) + b.modulos + "0".repeat(b.quietDir);
  const px = 3, h = 40, w = mods.length * px;
  const lum = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lum[y * w + x] = mods[Math.floor(x / px)] === "1" ? 0 : 255;
  const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128]], [DecodeHintType.TRY_HARDER, true]]);
  const r = new MultiFormatReader();
  r.setHints(hints as never);
  const res = r.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, w, h))), hints as never);
  return { texto: res.getText(), formato: BarcodeFormat[res.getBarcodeFormat()], escolhido: b.formato };
}

describe("código de barras da etiqueta", () => {
  it("dígito verificador EAN", () => {
    expect(digitoEan("789626350320")).toBe(3);
    expect(eanValido("7896263503203")).toBe(true);
    expect(eanValido("7896263503204")).toBe(false);
    expect(eanValido("2900000000018")).toBe(true);
  });

  it.each(["7896263503203", "2900000000018", "2900000000025", "2900000000056", "7891000100103", "4006381333931"])(
    "EAN-13 %s é lido de volta igual", (c) => {
      expect(ler(c)).toEqual({ texto: c, formato: "EAN_13", escolhido: "EAN-13" });
    });

  it.each(["789", "7890001", "96385074", "036000291452", "0012345678905", "KYB-334", "ABC 12/x", "7896263503204"])(
    "outros códigos usam Code 128 e voltam exatamente iguais: %s", (c) => {
      expect(ler(c)).toEqual({ texto: c, formato: "CODE_128", escolhido: "Code 128" });
    });

  it("todos os caracteres comuns do Code 128 funcionam", () => {
    const todos = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
    for (let i = 0; i < todos.length; i += 19) {
      const pedaco = "X" + todos.slice(i, i + 19) + "X"; // sem espaço nas pontas
      expect(ler(pedaco).texto).toBe(pedaco);
    }
  });

  it("código com acento não vira código de barras (a etiqueta mostra só o texto)", () => {
    expect(code128Possivel("PEÇA-1")).toBe(false);
    expect(desenharCodigo("PEÇA-1")).toBeNull();
    expect(desenharCodigo("")).toBeNull();
  });
});
