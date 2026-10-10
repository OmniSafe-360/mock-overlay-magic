/* Embalagens de compra: o fornecedor entrega Caixa/Fardo/Pacote/Display/Saco; a loja vende na unidade do produto.
 * O estoque fica sempre na unidade de venda; a embalagem só diz quanto vem dentro. Preços em centavos. */
import { aceitaFracao, fmtQ, parseNum, qtdUn, unPlural, unSingular } from "@/lib/deposito";
import { codigoComparavel, codigosIguais } from "@/lib/codigoBarras";

export type Embalagem = { uid: string; tipo: string; qtd: number; codigo: string; preco: number };
/** Todas as embalagens que o banco aceita (função _salvar_embalagens). */
export const TIPOS_EMBALAGEM = ["Caixa", "Fardo", "Pacote", "Display", "Saco", "Pallet", "Milheiro"] as const;
/** As que cada tipo de comércio recebe no dia a dia (farmácia não recebe fardo; construção recebe pallet e milheiro). */
export const EMBALAGENS_POR_TIPO: Record<string, string[]> = {
  mercado: ["Caixa", "Fardo", "Pacote", "Display", "Saco"],
  farmacia: ["Caixa", "Display", "Pacote"],
  construcao: ["Saco", "Pallet", "Milheiro", "Caixa", "Pacote"],
  pet: ["Saco", "Caixa", "Fardo", "Pacote", "Display"],
  autopecas: ["Caixa", "Pacote", "Display"],
};
export const embalagensDoTipo = (tipo: string): string[] => EMBALAGENS_POR_TIPO[tipo] ?? [...TIPOS_EMBALAGEM];
/** Texto do botão "Em caixa, fardo ou pacote", com as embalagens do tipo. */
export const rotuloComoChega = (tipo: string) => {
  const l = embalagensDoTipo(tipo).slice(0, 3).map((t) => t.toLowerCase());
  return `Em ${l.slice(0, -1).join(", ")} ou ${l.at(-1)}`;
};
/** "Preço da caixa", "Preço do fardo", "Preço do pallet". */
export const rotuloPrecoEmbalagem = (tipo: string) => `Preço ${tipo === "Caixa" ? "da" : "do"} ${tipo.toLowerCase()}`;
export const MAX_EMBALAGENS = 5;
export const EMB_VAZIA = "Adicione pelo menos uma embalagem ou escolha \"Por unidade\".";

/** "Caixa com 12", "Saco com 25,5 Kg". */
export function descricaoEmbalagem(e: Pick<Embalagem, "tipo" | "qtd">, unidade: string) {
  const q = fmtQ(e.qtd);
  if (unidade === "Unidade" || !unidade) return `${e.tipo} com ${q}`;
  return `${e.tipo} com ${qtdUn(e.qtd, unidade)}`;
}

/** Pergunta da quantidade conforme a unidade de venda. */
export function perguntaQtd(unidade: string) {
  if (unidade === "Unidade" || !unidade) return "Quantas unidades vêm dentro?";
  return `Quanto vem dentro? (em ${unPlural(unidade)})`;
}

/** Preço de compra de 1 unidade de venda (centavos), a partir do preço da embalagem. */
export const precoUnidade = (precoEmbalagem: number, qtd: number) => (precoEmbalagem > 0 && qtd > 0 ? Math.round(precoEmbalagem / qtd) : 0);

/** Lê a quantidade digitada (vírgula para decimais só em Kg, Litro, Metro, m²). Precisa ser maior que zero. */
export function lerQtdEmbalagem(txt: string, unidade: string): { v: number | null; err: string } {
  const r = parseNum(txt, unidade, false);
  if (r.err) return r.err.startsWith("Informe a quantidade") ? { v: null, err: "Informe quanto vem dentro." } : r;
  if (!r.v || r.v <= 0) return { v: null, err: "A quantidade precisa ser maior que zero." };
  if (!aceitaFracao(unidade) && r.v === 1) return { v: null, err: "Com 1 só, é a própria unidade. Use \"Por unidade\"." };
  return r;
}

/** Erros de uma embalagem dentro da lista do produto. `index` = posição dela (-1 se for nova). */
/** "o display fechado", "a caixa fechada" — para as frases de ajuda. */
export const embalagemFechada = (tipo: string) => (tipo === "Caixa" ? "a caixa fechada" : `o ${tipo.toLowerCase()} fechado`);
/** Ajuda do campo de código da embalagem: deixa claro que não é o código de cada unidade vendida. */
export const ajudaCodigoEmbalagem = (tipo: string, unidade: string) =>
  `O código impresso ${tipo === "Caixa" ? "na" : "no"} ${embalagemFechada(tipo).slice(2)}, se tiver. Não é o código de cada ${unSingular(unidade) || "unidade"}.`;
/** Quando escaneiam o código do produto (de cada unidade) no lugar do código da embalagem. */
export const codigoIgualProdutoMsg = (tipo: string, unidade: string) => {
  const e = embalagemFechada(tipo);
  return `Este é o código de cada ${unSingular(unidade) || "unidade"} (o mesmo do produto). ${e.charAt(0).toUpperCase()}${e.slice(1)} tem um código próprio, impresso ${tipo === "Caixa" ? "nela" : "nele"}. Se não tiver, deixe este campo em branco.`;
};

export function errosEmbalagem(e: Pick<Embalagem, "tipo" | "qtd" | "codigo">, index: number, lista: Embalagem[], codigoProduto: string, usados: Set<string>, unidade = "Unidade", mercado = false) {
  const out: { repetida?: string; codigo?: string } = {};
  if (lista.some((o, i) => i !== index && o.tipo === e.tipo && o.qtd === e.qtd)) out.repetida = "Já existe esta embalagem neste produto.";
  const c = e.codigo.trim();
  if (c) {
    if (codigosIguais(c, codigoProduto, mercado)) out.codigo = codigoIgualProdutoMsg(e.tipo, unidade);
    else if (lista.some((o, i) => i !== index && codigosIguais(o.codigo, c, mercado))) out.codigo = "Outra embalagem deste produto já usa este código.";
    else if (usados.has(codigoComparavel(c, mercado))) out.codigo = "Este código já está cadastrado";
  }
  return out;
}

/* ---------- contagem por embalagem (depósito) ---------- */
const PLURAL: Record<string, string> = { Caixa: "Caixas", Fardo: "Fardos", Pacote: "Pacotes", Display: "Displays", Saco: "Sacos", Pallet: "Pallets", Milheiro: "Milheiros" };

/** "Caixas com 12 fechadas", "Fardos com 72 fechados", "Sacos com 25,5 Kg fechados". */
export function rotuloFechadas(e: Pick<Embalagem, "tipo" | "qtd">, unidade: string) {
  const fem = e.tipo === "Caixa";
  const q = unidade === "Unidade" || !unidade ? fmtQ(e.qtd) : `${fmtQ(e.qtd)} ${unidade}`;
  return `${PLURAL[e.tipo] ?? e.tipo} com ${q} ${fem ? "fechadas" : "fechados"}`;
}
/** Nome do modo de contagem: "Caixas + soltas" (uma só embalagem) ou "Embalagens + soltas". */
export const rotuloContarPor = (embs: Pick<Embalagem, "tipo">[]) =>
  `${embs.length === 1 ? PLURAL[embs[0]!.tipo] ?? "Embalagens" : "Embalagens"} + soltas`;
export const rotuloSoltas = (unidade: string) => (unidade === "Unidade" || !unidade ? "Unidades soltas" : `Soltos (em ${unPlural(unidade)})`);

/** Soma "N embalagens fechadas + soltas" na unidade de venda. Campos vazios contam como zero; tudo vazio = sem contagem. */
export function totalContado(
  linhas: { e: Pick<Embalagem, "qtd">; fechadas: string }[], soltasTxt: string, unidade: string,
): { total: number | null; err: string } {
  if (linhas.every((l) => !l.fechadas.trim()) && !soltasTxt.trim()) return { total: null, err: "" };
  let total = 0;
  for (const l of linhas) {
    const t = l.fechadas.trim();
    if (!t) continue;
    if (!/^\d+$/.test(t)) return { total: null, err: "Embalagens fechadas: use um número inteiro." };
    total += Number(t) * l.e.qtd;
  }
  if (soltasTxt.trim()) {
    const r = parseNum(soltasTxt, unidade, false);
    if (r.err) return { total: null, err: r.err };
    total += r.v ?? 0;
  }
  return { total: Math.round(total * 1000) / 1000, err: "" };
}
