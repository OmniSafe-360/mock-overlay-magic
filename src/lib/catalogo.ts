/* Catálogo de produtos por código de barras (Open Food Facts, produtos do Brasil): ao bipar um código novo no cadastro,
 * o app sugere o nome. É só sugestão: o comerciante confere e pode mudar. Preço, estoque e fornecedor nunca vêm daqui. */

export type ItemCatalogo = { codigo: string; nome: string; marca: string | null; quantidade: string | null; imagemUrl: string | null; fonte: string };

/** Tipos de comércio que consultam o catálogo (por enquanto só o mercado, para testar). */
export const tipoUsaCatalogo = (tipo: string) => tipo === "mercado";

/** Dígito final de um GTIN (8, 12, 13 ou 14 números). */
export function gtinValido(c: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(c) || /^0+$/.test(c)) return false;
  let s = 0;
  for (let i = 1; i < c.length; i++) s += Number(c[c.length - 1 - i]) * (i % 2 === 1 ? 3 : 1);
  return (10 - (s % 10)) % 10 === Number(c[c.length - 1]);
}
/** Vale a pena consultar: código de fábrica válido (não é código de balança/loja, que começa com 2). */
export function codigoConsultavel(c: string): boolean {
  const t = c.trim();
  if (!gtinValido(t)) return false;
  const g13 = t.length === 12 ? `0${t}` : t.length === 14 && t.startsWith("0") ? t.slice(1) : t;
  if (g13.length === 13 && (g13.startsWith("2") || /^0[24]/.test(g13))) return false;
  if (g13.length === 8 && /^[02]/.test(g13)) return false;
  return true;
}

const PEQUENAS = new Set(["de", "da", "do", "das", "dos", "e", "com", "sem", "em", "para", "a", "o"]);
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s.\-]+/g, "");
/** "LEITE PO NINHO" → "Leite Po Ninho"; só mexe quando está tudo em maiúsculas. */
function arrumarMaiusculas(s: string): string {
  if (s !== s.toUpperCase() || !/[A-ZÀ-Ý]/.test(s)) return s;
  return s.toLowerCase().split(" ").map((w, i) => (i > 0 && PEQUENAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}
/** "250g" → "250 g", "2l" → "2 L". */
const arrumarTamanho = (q: string) => q.replace(/(\d)\s*(kg|g|mg|ml|l)\b/gi, (_, n: string, u: string) => `${n} ${u.toLowerCase() === "l" ? "L" : u.toLowerCase()}`).trim();

/** Marca e peso/volume do catálogo para os detalhes do mercado. Só preenche o que está vazio: nunca apaga o que o comerciante digitou. */
export function detalhesDoCatalogo(i: Pick<ItemCatalogo, "marca" | "quantidade">, det: Record<string, string>): Record<string, string> {
  const novo = { ...det };
  const marca = i.marca?.trim() ? arrumarMaiusculas(i.marca.trim().replace(/\s+/g, " ")) : "";
  if (marca && !novo["marca"]?.trim()) novo["marca"] = marca;
  const q = i.quantidade?.trim() ? arrumarTamanho(i.quantidade.replace(/\s+/g, " ")) : "";
  if (q && /\d/.test(q) && !novo["peso"]?.trim()) novo["peso"] = q;
  return novo;
}

/** Nome sugerido para o cadastro: nome + marca + tamanho, sem repetir o que já está no nome. Até 160 letras. */
export function nomeSugerido(i: Pick<ItemCatalogo, "nome" | "marca" | "quantidade">): string {
  let n = arrumarMaiusculas(i.nome.trim().replace(/\s+/g, " "));
  const marca = i.marca?.trim() ? arrumarMaiusculas(i.marca.trim()) : "";
  if (marca && !semAcento(n).includes(semAcento(marca))) n = `${n} ${marca}`;
  const q = i.quantidade?.trim() ? arrumarTamanho(i.quantidade) : "";
  if (q && /\d/.test(q) && !semAcento(n).includes(semAcento(q))) n = `${n} ${q}`;
  n = n.charAt(0).toUpperCase() + n.slice(1);
  return n.slice(0, 160).trim();
}
