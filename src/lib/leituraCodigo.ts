import { BarcodeFormat, DecodeHintType } from "@zxing/library";

/** O Mercado também recebe caixas/fardos com ITF-14. Os outros tipos mantêm os formatos anteriores. */
export function hintsLeitura(mercado = false): Map<DecodeHintType, unknown> {
  const formatos = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE];
  if (mercado) formatos.push(BarcodeFormat.ITF);
  const hints = new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, formatos],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  // ITF também admite códigos curtos. Aqui só interessam as embalagens de 14 dígitos.
  if (mercado) hints.set(DecodeHintType.ALLOWED_LENGTHS, [14]);
  return hints;
}

/** ZXing aceita ITF maior que o maior ALLOWED_LENGTHS. Confere o resultado também. */
export function textoLeitura(texto: string, formato: BarcodeFormat, mercado = false): string | null {
  const c = texto.trim();
  if (formato === BarcodeFormat.ITF && (!mercado || !/^\d{14}$/.test(c))) return null;
  return c || null;
}
