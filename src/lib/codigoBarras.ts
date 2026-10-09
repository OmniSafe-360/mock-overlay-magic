/* Desenho do código de barras das etiquetas (sem biblioteca externa). Conferido com o leitor do próprio app (ZXing).
 * - EAN-13 quando o código é um EAN-13 válido que não começa com 0 (fábrica 789..., interno 29...).
 * - Code 128 (conjunto B) para qualquer outro código com caracteres comuns (EAN-8, UPC, "KYB-334"...),
 *   para a etiqueta devolver exatamente o texto cadastrado. */

export type Barras = { formato: "EAN-13" | "Code 128"; modulos: string; quietEsq: number; quietDir: number };

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = L.map((p) => [...p].map((b) => (b === "1" ? "0" : "1")).join(""));
const PARIDADE = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** Dígito verificador EAN/UPC dos dígitos informados (sem o verificador). */
export const digitoEan = (semDv: string) => {
  const s = [...semDv].reverse().reduce((t, d, i) => t + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (s % 10)) % 10;
};
export const eanValido = (c: string) => /^\d{13}$/.test(c) && digitoEan(c.slice(0, 12)) === Number(c[12]);

export function ean13(c: string): string {
  if (!eanValido(c)) throw new Error("ean_invalido");
  const d = [...c].map(Number);
  const par = PARIDADE[d[0]!]!;
  let m = "101";
  for (let i = 1; i <= 6; i++) m += (par[i - 1] === "L" ? L : G)[d[i]!]!;
  m += "01010";
  for (let i = 7; i <= 12; i++) m += R[d[i]!]!;
  return m + "101";
}

/* Code 128: larguras barra/espaço de cada símbolo (0–102), inícios A/B/C (103–105) e parada. */
const C128 = (
  "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 " +
  "123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 " +
  "232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 " +
  "313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 " +
  "111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
  "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 " +
  "114311 411113 411311 113141 114131 311141 411131 211412 211214 211232"
).split(" ");
const PARADA = "2331112";
const START_B = 104;
const larguras = (w: string) => [...w].map((n, i) => (i % 2 === 0 ? "1" : "0").repeat(Number(n))).join("");

/** Só caracteres que o Code 128 B imprime (espaço até "~"). */
export const code128Possivel = (t: string) => t.length > 0 && /^[\x20-\x7e]+$/.test(t);

export function code128(t: string): string {
  if (!code128Possivel(t)) throw new Error("caractere_nao_suportado");
  const valores = [...t].map((ch) => ch.charCodeAt(0) - 32);
  const soma = valores.reduce((s, v, i) => s + v * (i + 1), START_B) % 103;
  return [START_B, ...valores, soma].map((v) => larguras(C128[v]!)).join("") + larguras(PARADA);
}

/** Escolhe o formato e devolve os módulos (1 = barra, 0 = espaço). null = não dá para desenhar (caractere especial). */
export function desenharCodigo(codigo: string): Barras | null {
  const c = codigo.trim();
  // Começando com 0, o leitor devolve como UPC-A (12 dígitos, sem o 0) e não bateria com o cadastro: vai em Code 128.
  if (eanValido(c) && !c.startsWith("0")) return { formato: "EAN-13", modulos: ean13(c), quietEsq: 11, quietDir: 7 };
  if (code128Possivel(c)) return { formato: "Code 128", modulos: code128(c), quietEsq: 10, quietDir: 10 };
  return null;
}

/**
 * Aviso (não bloqueia) para código de barras que parece digitado errado.
 * Só olha códigos só com números e com 8 números ou mais: 8, 12, 13 e 14 são os tamanhos de verdade
 * (EAN-8, UPC, EAN-13, caixa/fardo DUN-14), e o último número precisa conferir.
 * Códigos curtos (internos da loja) e com letras (ex.: "KYB-334") não recebem aviso.
 */
export function avisoCodigo(codigo: string): string {
  const c = codigo.trim();
  if (!/^\d{8,}$/.test(c)) return "";
  if (![8, 12, 13, 14].includes(c.length))
    return `Este código tem ${c.length} números. Códigos de barras têm 8, 12, 13 ou 14. Confira se foi digitado certo.`;
  if (digitoEan(c.slice(0, -1)) !== Number(c.at(-1))) return "O último número do código não confere. Confira se foi digitado certo.";
  return "";
}
