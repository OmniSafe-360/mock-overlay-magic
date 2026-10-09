/* Preço pela margem: "quero ganhar X% em cima da compra" (decisão do dono, 09/10/2026). Valores em centavos. */

/** Preço de venda (centavos) para ganhar `pct`% em cima da compra. Ex.: compra 1000 e 30% -> 1300. */
export const vendaPorGanho = (compra: number, pct: number) => Math.round(compra * (1 + pct / 100));

/** Quanto se ganha em cima da compra, em %. Sem compra não há como calcular. */
export const ganhoSobreCompra = (compra: number, venda: number): number | null =>
  compra > 0 ? ((venda - compra) / compra) * 100 : null;

/** Lê o que foi digitado no campo de %: só números e uma vírgula, até 1 casa, no máximo 999. */
export const lerPct = (v: string) => {
  const limpo = v.replace(/[^\d,]/g, "");
  const [int = "", ...resto] = limpo.split(",");
  const texto = resto.length ? `${int.slice(0, 3)},${resto.join("").slice(0, 1)}` : int.slice(0, 3);
  const n = texto === "" || texto === "," ? null : Number(texto.replace(",", "."));
  return { texto, valor: n != null && Number.isFinite(n) ? n : null };
};

/** Mostra o % como o comerciante lê: "30", "28,7", "-5". */
export const mostrarPct = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
