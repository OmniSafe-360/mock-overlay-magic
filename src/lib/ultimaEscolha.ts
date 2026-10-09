/* "Lembrar a última escolha" (decisão do dono, 09/10/2026): um produto NOVO começa com as escolhas
 * do último produto cadastrado no mesmo comércio. Só o que costuma se repetir; nunca código, nome,
 * preços, detalhes, quantidades, mínimos e máximos. Tudo pode ser trocado na tela. */
import type { Product } from "@/components/ProductArea";

export type EscolhasIniciais = {
  unidade?: string;
  categoria?: string;
  fornecedor?: number;
  localDeposito?: string;
  localVenda?: string;
  validade?: { controla: boolean; avisos: number[] };
};

export function escolhasDoUltimo(
  ultimo: Product | undefined,
  validas: { unidades: string[]; categorias: string[]; fornecedores: number[] },
): EscolhasIniciais {
  if (!ultimo) return {};
  const e: EscolhasIniciais = {};
  if (validas.unidades.includes(ultimo.unidade)) e.unidade = ultimo.unidade;
  if (validas.categorias.includes(ultimo.categoria)) e.categoria = ultimo.categoria;
  if (ultimo.fornecedor != null && validas.fornecedores.includes(ultimo.fornecedor)) e.fornecedor = ultimo.fornecedor;
  if (ultimo.deposito?.local) e.localDeposito = ultimo.deposito.local;
  if (ultimo.areaVenda?.local) e.localVenda = ultimo.areaVenda.local;
  if (ultimo.validade) e.validade = { controla: ultimo.validade.controla, avisos: [...ultimo.validade.avisos] };
  return e;
}
