/* Regras das variações (Loja de roupas): códigos e combinações tamanho + cor. */
export type VarLike = { tam: string; cor: string; codigo?: string | undefined };
export type ProdLike = { id: number; codigo: string; variacoes: VarLike[]; embalagens?: { codigo: string }[] | undefined };

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();

/** Códigos já usados por OUTROS produtos do mesmo comércio (principal + variações + embalagens). */
export function usedCodes(products: ProdLike[], selfId?: number): Set<string> {
  const set = new Set<string>();
  for (const p of products) {
    if (p.id === selfId) continue;
    if (p.codigo.trim()) set.add(p.codigo.trim());
    for (const v of p.variacoes) if (v.codigo?.trim()) set.add(v.codigo.trim());
    for (const e of p.embalagens ?? []) if (e.codigo.trim()) set.add(e.codigo.trim());
  }
  return set;
}

/** Erro do código principal: repetido em outro produto ou em variação de outro produto. */
export function mainCodeError(code: string, used: Set<string>, ownVars: VarLike[] = []): string {
  const c = code.trim();
  if (!c) return "";
  if (ownVars.some((v) => (v.codigo ?? "").trim() === c)) return "Este código já pertence a uma variação deste produto.";
  return used.has(c) ? "Este código já está cadastrado" : "";
}

/** Erros de uma variação. `index` = posição dela em `vars` (-1 se for nova). */
export function variationErrors(v: VarLike, index: number, vars: VarLike[], mainCode: string, used: Set<string>) {
  const e: { combo?: string; codigo?: string } = {};
  if (vars.some((o, i) => i !== index && norm(o.tam) === norm(v.tam) && norm(o.cor) === norm(v.cor)))
    e.combo = "Já existe uma variação com este tamanho e cor.";
  const c = (v.codigo ?? "").trim();
  if (!c) e.codigo = "Informe o código de barras desta variação.";
  else if (c === mainCode.trim()) e.codigo = "Use um código diferente do código principal.";
  else if (vars.some((o, i) => i !== index && (o.codigo ?? "").trim() === c)) e.codigo = "Outra variação deste produto já usa este código.";
  else if (used.has(c)) e.codigo = "Este código já está cadastrado em outro produto.";
  return e;
}

export const variationOk = (v: VarLike, i: number, vars: VarLike[], main: string, used: Set<string>) => {
  const e = variationErrors(v, i, vars, main, used);
  return !e.combo && !e.codigo;
};

export type ProductDraft = {
  codigo: string; nome: string; compra: number; venda: number; unidade: string; categoria: string;
  variacoes: (VarLike & { qtd?: number })[]; detalhes?: Record<string, string>; fornecedor: number | null | undefined;
};

/** Valida todas as etapas antes de salvar. Retorna a primeira etapa inválida e a orientação, ou null. */
export type TypeRules = {
  unidades: string[]; categorias: string[]; semVariacoes?: boolean; varsMsg?: string;
  /** Detalhes com valores fixos: se preenchidos, precisam estar em `opts`. */
  detalhesFixos?: { k: string; opts: string[]; msg: string }[];
};
export const FARMACIA_VARS_MSG = "Este produto de Farmácia contém variações incompatíveis. O salvamento foi bloqueado.";
export const CONSTRUCAO_VARS_MSG = "Este produto de Material de construção contém variações incompatíveis. O salvamento foi bloqueado.";
export const PET_VARS_MSG = "Este produto de Pet shop contém variações incompatíveis. O salvamento foi bloqueado.";
/** Detalhe com opções fixas preenchido com um valor fora da lista. */
export const msgDetalheFixo = (label: string) => `Escolha uma das opções da lista em "${label}".`;
export const ESPECIE_MSG = msgDetalheFixo("Espécie");
export const AUTOPECAS_VARS_MSG = "Este produto de Autopeças contém variações incompatíveis. O salvamento foi bloqueado.";
export const POSICAO_MSG = msgDetalheFixo("Posição");
export const TARJA_MSG = msgDetalheFixo("Tarja");
export const MERCADO_VARS_MSG = "Este produto de Mercado contém variações incompatíveis. O salvamento foi bloqueado.";

/** Regras exclusivas do Mercado: unidade e categoria precisam estar nas listas; variações não são permitidas. */
export function typeRuleError(d: Pick<ProductDraft, "unidade" | "categoria" | "variacoes" | "detalhes">, rules?: TypeRules): { step: number; msg: string } | null {
  if (!rules) return null;
  if (d.unidade && !rules.unidades.includes(d.unidade)) return { step: 1, msg: "Unidade incompatível com este comércio. Escolha uma opção válida." };
  if (d.categoria && !rules.categorias.includes(d.categoria)) return { step: 1, msg: "Categoria incompatível com este comércio. Escolha uma opção válida." };
  if (rules.semVariacoes && d.variacoes.length > 0) return { step: 2, msg: rules.varsMsg ?? MERCADO_VARS_MSG };
  for (const f of rules.detalhesFixos ?? []) {
    const v = d.detalhes?.[f.k];
    if (v && !f.opts.includes(v)) return { step: 2, msg: f.msg };
  }
  return null;
}

export function firstInvalidStep(d: ProductDraft, isRoupas: boolean, used: Set<string>, rules?: TypeRules): { step: number; msg: string } | null {
  if (!d.codigo.trim()) return { step: 0, msg: "Informe o código do produto." };
  const ce = mainCodeError(d.codigo, used, isRoupas ? d.variacoes : []);
  if (ce) return { step: 0, msg: ce };
  if (!d.nome.trim()) return { step: 0, msg: "Informe o nome do produto." };
  if (!(d.compra > 0) || !(d.venda > 0)) return { step: 1, msg: "Informe os preços de compra e de venda." };
  if (!d.unidade) return { step: 1, msg: "Escolha a unidade." };
  if (!d.categoria) return { step: 1, msg: "Escolha a categoria." };
  const tr = typeRuleError(d, rules);
  if (tr) return tr;
  if (isRoupas) {
    const vs = d.variacoes;
    if (!vs.length) return { step: 2, msg: "Adicione pelo menos uma variação." };
    const bad = vs.some((v, i) => !v.tam || !v.cor.trim() || !(Number(v.qtd) > 0) || !variationOk(v, i, vs, d.codigo, used));
    if (bad) return { step: 2, msg: "Corrija as variações marcadas em vermelho." };
  }
  if (d.fornecedor === undefined) return { step: 3, msg: "Escolha um fornecedor ou \"Definir depois\"." };
  return null;
}
