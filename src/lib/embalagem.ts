/* Embalagens de compra: o fornecedor entrega Caixa/Fardo/Pacote/Display/Saco; a loja vende na unidade do produto.
 * O estoque fica sempre na unidade de venda; a embalagem só diz quanto vem dentro. Preços em centavos. */
import { aceitaFracao, fmtQ, parseNum } from "@/lib/deposito";

export type Embalagem = { uid: string; tipo: string; qtd: number; codigo: string; preco: number };
export const TIPOS_EMBALAGEM = ["Caixa", "Fardo", "Pacote", "Display", "Saco"] as const;
export const MAX_EMBALAGENS = 5;
export const EMB_VAZIA = "Adicione pelo menos uma embalagem ou escolha \"Por unidade\".";

/** "Caixa com 12", "Saco com 25,5 Kg". */
export function descricaoEmbalagem(e: Pick<Embalagem, "tipo" | "qtd">, unidade: string) {
  const q = fmtQ(e.qtd);
  if (unidade === "Unidade" || !unidade) return `${e.tipo} com ${q}`;
  return `${e.tipo} com ${q} ${unidade}`;
}

/** Pergunta da quantidade conforme a unidade de venda. */
export function perguntaQtd(unidade: string) {
  if (unidade === "Unidade" || !unidade) return "Quantas unidades vêm dentro?";
  return `Quanto vem dentro? (em ${unidade})`;
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
export function errosEmbalagem(e: Pick<Embalagem, "tipo" | "qtd" | "codigo">, index: number, lista: Embalagem[], codigoProduto: string, usados: Set<string>) {
  const out: { repetida?: string; codigo?: string } = {};
  if (lista.some((o, i) => i !== index && o.tipo === e.tipo && o.qtd === e.qtd)) out.repetida = "Já existe esta embalagem neste produto.";
  const c = e.codigo.trim();
  if (c) {
    if (c === codigoProduto.trim()) out.codigo = "O código da embalagem precisa ser diferente do código do produto.";
    else if (lista.some((o, i) => i !== index && o.codigo.trim() === c)) out.codigo = "Outra embalagem deste produto já usa este código.";
    else if (usados.has(c)) out.codigo = "Este código já está cadastrado";
  }
  return out;
}
