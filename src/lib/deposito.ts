/* Regras do passo Depósito (somente em memória nesta versão). */
import { FRACAO } from "@/lib/listas";
export type DepVar = { qtd: number | null; min: number | null; max: number | null };
export type Deposito = {
  /** null = "Definir depois" */
  local: string | null;
  qtd: number | null; min: number | null; max: number | null;
  /** Roupas: configuração por variação, ligada ao `uid` estável da variação. */
  vars?: Record<string, DepVar> | undefined;
};

export { FRACAO };
export const aceitaFracao = (u: string) => FRACAO.includes(u);

export const QTD_VAZIA = "Informe a quantidade contada. Se não houver nenhuma, digite 0.";
export const NEGATIVO = "Não use valores negativos.";
export const MAX_MENOR = "O máximo precisa ser igual ou maior que o mínimo.";
export const LOCAL_DUP = "Já existe um local com este nome neste comércio. Escolha-o na lista.";
export const SEM_CONFIG = "Depósito não configurado";
export const LOCAL_PENDENTE = "Depósito não configurado completamente · Local não definido";
export const TEMPORARIO = "A configuração é guardada junto com o produto ao salvar.";
export const ACIMA_MAX = "Você tem mais que o desejado. Tudo bem: a contagem real será registrada.";
export const REMOCAO_BLOQUEADA = "Esta variação tem quantidade confirmada no depósito ou na área de venda. Removê-la não é permitido nesta versão.";
export const unidadeTravadaMsg = (u: string) =>
  `Este produto já tem depósito ou área de venda configurados em ${u}. Para não mudar o sentido das quantidades, a unidade não pode ser alterada nesta versão.`;
export const localTravadoMsg = (l: string) =>
  `Há quantidade no depósito em “${l}”. Mudar de local exigirá uma transferência, que virá numa etapa futura.`;

/** Lê um número digitado. Nunca transforma "1,5" em "15". */
export function parseNum(txt: string, unidade: string, opcional: boolean): { v: number | null; err: string } {
  const t = txt.trim();
  if (!t) return opcional ? { v: null, err: "" } : { v: null, err: QTD_VAZIA };
  if (t.includes("-")) return { v: null, err: NEGATIVO };
  if (aceitaFracao(unidade)) {
    if (/^\d+\.\d+$/.test(t)) return { v: null, err: "Use vírgula para separar os decimais. Ex.: 1,5" };
    if (!/^\d+(,\d{1,3})?$/.test(t)) return { v: null, err: "Digite um número válido. Ex.: 12,5" };
    return { v: Number(t.replace(",", ".")), err: "" };
  }
  if (!/^\d+$/.test(t)) return { v: null, err: `Use um número inteiro para ${unidade || "esta unidade"}.` };
  return { v: Number(t), err: "" };
}

export const limitesErro = (min: number | null, max: number | null) => (min != null && max != null && max < min ? MAX_MENOR : "");
export const fmtQ = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
/** Plural das unidades de venda (Kg e m² não mudam). Singular de 1 até menos de 2 ("1,5 litro"), como se fala. */
const PALAVRA_UN: Record<string, [string, string]> = {
  Unidade: ["unidade", "unidades"], Peça: ["peça", "peças"], Par: ["par", "pares"], Pacote: ["pacote", "pacotes"],
  Caixa: ["caixa", "caixas"], Cartela: ["cartela", "cartelas"], Frasco: ["frasco", "frascos"], Saco: ["saco", "sacos"],
  Lata: ["lata", "latas"], Jogo: ["jogo", "jogos"], Kit: ["kit", "kits"], Litro: ["litro", "litros"], Metro: ["metro", "metros"],
  Dúzia: ["dúzia", "dúzias"], Bandeja: ["bandeja", "bandejas"], Tubo: ["tubo", "tubos"], Ampola: ["ampola", "ampolas"],
  Sachê: ["sachê", "sachês"], Galão: ["galão", "galões"], Barra: ["barra", "barras"], Rolo: ["rolo", "rolos"], Milheiro: ["milheiro", "milheiros"],
};
/** Nome da unidade no plural, para rótulos: "Mínimo (frascos)". Kg e m² não mudam. */
export const unPlural = (unidade: string) => PALAVRA_UN[unidade]?.[1] ?? unidade;
/** Nome da unidade no singular, em minúscula: "Cada frasco sai por...". */
export const unSingular = (unidade: string) => PALAVRA_UN[unidade]?.[0] ?? unidade;
/** "100 unidades", "1 unidade", "1,5 litro", "2,5 Kg", "3 pacotes". */
export function qtdUn(n: number, unidade: string): string {
  const p = PALAVRA_UN[unidade];
  const palavra = !p ? unidade : Math.abs(n) >= 1 && Math.abs(n) < 2 ? p[0] : p[1];
  return `${fmtQ(n)} ${palavra}`.trim();
}
export const toInput = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export function limitesStatus(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Alertas de estoque não configurados";
  if (max == null) return `Mínimo ${fmtQ(min!)} · Sem máximo definido`;
  if (min == null) return `Máximo ${fmtQ(max)} · Sem mínimo definido. Sem aviso de compra configurado`;
  return `Mínimo ${fmtQ(min)} · Máximo ${fmtQ(max)}`;
}

export const normLocal = (s: string) => s.trim().toLowerCase();

/** Locais já usados pelos produtos do comércio aberto (a lista recebida já é só desse comércio). */
export function locaisDoComercio(products: { deposito?: Deposito | undefined }[]): string[] {
  const seen = new Map<string, string>();
  for (const p of products) {
    const l = p.deposito?.local;
    if (l && !seen.has(normLocal(l))) seen.set(normLocal(l), l);
  }
  return [...seen.values()];
}
export const localDuplicado = (nome: string, locais: string[]) => locais.some((l) => normLocal(l) === normLocal(nome));

export function temQtdPositiva(d?: Deposito): boolean {
  if (!d) return false;
  return (d.qtd ?? 0) > 0 || Object.values(d.vars ?? {}).some((v) => (v.qtd ?? 0) > 0);
}

let seq = 0;
/** Identificador estável no formato aceito pelo banco (uuid). */
export const newUid = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; seq++; return (c === "x" ? r : (r & 3) | 8).toString(16); });
