/* Regras do passo Área de venda (somente em memória nesta versão). Reaproveita as regras numéricas do Depósito. */
import { fmtQ, locaisDoComercio, type Deposito } from "@/lib/deposito";

/** Mesma forma do Depósito, mas é um conjunto separado de locais e quantidades. */
export type AreaVenda = Deposito;

export const VEN_SEM_CONFIG = "Área de venda não configurada";
export const VEN_LOCAL_PENDENTE = "Área de venda não configurada completamente · Local não definido · Sem reposição automática";
export const VEN_LOCAL_DUP = "Já existe um local de venda com este nome neste comércio. Escolha-o na lista.";
export const VEN_ACIMA_MAX = "A contagem passou do quanto cabe neste local. Tudo bem: a contagem real será registrada. Uma reposição futura nunca sugerirá passar do máximo.";
export const VEN_REMOCAO_BLOQUEADA = "Esta variação tem quantidade confirmada no depósito ou na área de venda. Removê-la não é permitido nesta versão.";
export const SEM_REPOSICAO = "Nenhuma reposição automática funciona nesta versão.";
export const TOTAL_INDISPONIVEL = "Total ainda não disponível";
export const venLocalTravadoMsg = (l: string) =>
  `Há quantidade na área de venda em “${l}”. Mudar de local exigirá uma transferência, que virá numa etapa futura.`;

export const EXEMPLO_LOCAL: Record<string, string> = {
  mercado: "Gôndola 3 · Prateleira 2",
  farmacia: "Balcão · Prateleira 1",
  construcao: "Corredor de tintas · Expositor 2",
  pet: "Gôndola de rações · Prateleira 3",
  autopecas: "Balcão · Expositor de filtros",
  roupas: "Arara 2 · Vitrine",
};

export function limitesVendaStatus(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Alertas de reposição não configurados";
  if (min == null) return `Máximo ${fmtQ(max!)} · Sem mínimo: a necessidade de reposição automática não está configurada`;
  if (max == null) return `Mínimo ${fmtQ(min)} · Sem máximo: será possível identificar a necessidade de repor, mas não calcular quanto repor até a capacidade`;
  return `Mínimo ${fmtQ(min)} · Máximo ${fmtQ(max)}`;
}

/** Locais de venda do comércio aberto — conjunto separado dos locais do depósito. */
export const locaisVendaDoComercio = (products: { areaVenda?: AreaVenda | undefined }[]) =>
  locaisDoComercio(products.map((p) => ({ deposito: p.areaVenda })));

/** Soma apenas visual. Só aparece quando as duas contagens estão confirmadas. */
export function totalTexto(dep: number | null | undefined, ven: number | null | undefined, unidade: string): string {
  if (dep == null || ven == null) return TOTAL_INDISPONIVEL;
  const t = Math.round((dep + ven) * 1000) / 1000;
  return `Depósito ${fmtQ(dep)} + Área de venda ${fmtQ(ven)} = ${fmtQ(t)} ${unidade} no total`;
}
