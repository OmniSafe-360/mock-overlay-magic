/* Regras das variações (Loja de roupas): códigos e combinações tamanho + cor. */
export type VarLike = { tam: string; cor: string; codigo?: string | undefined };
export type ProdLike = { id: number; codigo: string; variacoes: VarLike[] };

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();

/** Códigos já usados por OUTROS produtos do mesmo comércio (principal + variações). */
export function usedCodes(products: ProdLike[], selfId?: number): Set<string> {
  const set = new Set<string>();
  for (const p of products) {
    if (p.id === selfId) continue;
    if (p.codigo.trim()) set.add(p.codigo.trim());
    for (const v of p.variacoes) if (v.codigo?.trim()) set.add(v.codigo.trim());
  }
  return set;
}

/** Erro do código principal: repetido em outro produto ou em variação de outro produto. */
export function mainCodeError(code: string, used: Set<string>): string {
  return code.trim() && used.has(code.trim()) ? "Este código já está cadastrado" : "";
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
