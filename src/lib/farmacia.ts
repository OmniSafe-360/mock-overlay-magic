/* Regras próprias da farmácia (entrega 4 da análise por comércio): local pela tarja e preço máximo (PMC). */

/** Onde o remédio deve ficar na loja, de acordo com a tarja. */
export const LOCAL_PELA_TARJA: Record<string, { local: string; motivo: string }> = {
  "Sem tarja (venda livre)": { local: "Gôndola", motivo: "Remédio sem tarja pode ficar na gôndola, ao alcance do cliente." },
  "Tarja vermelha": { local: "Atrás do balcão", motivo: "Remédio de tarja vermelha fica atrás do balcão: só o atendente entrega." },
  "Tarja vermelha (retém receita)": { local: "Armário de controlados", motivo: "Remédio que retém receita é controlado: fica no armário de controlados, trancado." },
  "Tarja preta": { local: "Armário de controlados", motivo: "Remédio de tarja preta é controlado: fica no armário de controlados, trancado." },
};
export const localPelaTarja = (tarja: string | undefined) => (tarja ? LOCAL_PELA_TARJA[tarja] : undefined);

/** Local de autosserviço (o cliente pega sozinho). */
const AUTOSSERVICO = /g[ôo]ndola|ilha|autosservi/i;
/** Aviso quando um remédio com tarja foi posto num local onde o cliente pega sozinho. Não impede salvar. */
export function localNaoCombina(tarja: string | undefined, local: string | null | undefined): string {
  if (!tarja || !local || tarja === "Sem tarja (venda livre)" || !LOCAL_PELA_TARJA[tarja]) return "";
  return AUTOSSERVICO.test(local) ? `Remédio com ${tarja.toLowerCase()} não pode ficar em “${local}”, ao alcance do cliente. Use ${LOCAL_PELA_TARJA[tarja]!.local.toLowerCase()}.` : "";
}

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** O PMC fica nos detalhes como texto em reais ("R$ 45,90"); aqui vira centavos (0 = não informado). */
export const pmcCentavos = (det: Record<string, string> | undefined) => Number((det?.["pmc"] ?? "").replace(/\D/g, "").slice(0, 10) || 0);
/** Texto guardado nos detalhes a partir do que foi digitado. */
export const pmcTexto = (digitado: string) => { const c = Number(digitado.replace(/\D/g, "").slice(0, 10) || 0); return c ? brl(c) : ""; };
/** Aviso quando o preço de venda passa do PMC. */
export const acimaPmcMsg = (venda: number, pmc: number) => (pmc > 0 && venda > pmc
  ? `O preço de venda (${brl(venda)}) passa do preço máximo (PMC) de ${brl(pmc)}. A farmácia não pode vender acima do PMC.` : "");
