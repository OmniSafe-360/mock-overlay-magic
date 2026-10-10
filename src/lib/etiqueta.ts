import { formatarCentavos } from "@/lib/formatacao";
/* Etiquetas: modelos de papel e cálculo das páginas. Medidas em milímetros. */

export type Modelo = {
  id: string; nome: string; descricao: string; tipo: "a4" | "termica"; larg: number; alt: number;
  /* Só folha A4 */
  colunas?: number; linhas?: number; margemTopo?: number; margemEsq?: number; espacoCol?: number; espacoLin?: number;
};

export const MODELOS: Modelo[] = [
  { id: "a4-21", tipo: "a4", nome: "Folha A4 · 21 etiquetas", descricao: "3 colunas × 7 linhas, cada etiqueta 63,5 × 38,1 mm (o modelo mais comum, tipo Pimaco)",
    larg: 63.5, alt: 38.1, colunas: 3, linhas: 7, margemTopo: 15.15, margemEsq: 7.25, espacoCol: 2.5, espacoLin: 0 },
  { id: "termica-50x30", tipo: "termica", nome: "Térmica 50 × 30 mm", descricao: "Rolinho, uma etiqueta por vez (o tamanho mais comum)", larg: 50, alt: 30 },
  { id: "termica-40x25", tipo: "termica", nome: "Térmica 40 × 25 mm", descricao: "Rolinho, etiqueta pequena", larg: 40, alt: 25 },
  { id: "termica-60x40", tipo: "termica", nome: "Térmica 60 × 40 mm", descricao: "Rolinho, etiqueta grande", larg: 60, alt: 40 },
];
export const MODELO_PADRAO = MODELOS[1]!;
export const modeloPorId = (id: string | null | undefined) => MODELOS.find((m) => m.id === id) ?? MODELO_PADRAO;

export const QTD_MAX = 200;
export const porFolha = (m: Modelo) => (m.colunas ?? 1) * (m.linhas ?? 1);

/** Folhas A4: cada folha tem as posições na ordem (linha por linha); null = posição pulada (folha já usada). */
export function folhasA4(m: Modelo, qtd: number, comecarEm: number): (number | null)[][] {
  const n = porFolha(m);
  const pular = Math.min(Math.max(1, Math.floor(comecarEm)), n) - 1;
  const total = Math.min(Math.max(0, Math.floor(qtd)), QTD_MAX);
  const posicoes: (number | null)[] = [...Array<null>(pular).fill(null), ...Array.from({ length: total }, (_, i) => i)];
  const folhas: (number | null)[][] = [];
  for (let i = 0; i < posicoes.length; i += n) folhas.push(posicoes.slice(i, i + n));
  return total ? folhas : [];
}

/** Onde fica a etiqueta `pos` (0 = canto superior esquerdo) na folha, em mm. */
export function posicaoNaFolha(m: Modelo, pos: number) {
  const col = pos % (m.colunas ?? 1), lin = Math.floor(pos / (m.colunas ?? 1));
  return { esq: (m.margemEsq ?? 0) + col * (m.larg + (m.espacoCol ?? 0)), topo: (m.margemTopo ?? 0) + lin * (m.alt + (m.espacoLin ?? 0)) };
}

/** Regra da página de impressão (tamanho real do papel, sem margem do navegador). */
export const regraPagina = (m: Modelo) => (m.tipo === "a4" ? "@page { size: A4 portrait; margin: 0; }" : `@page { size: ${m.larg}mm ${m.alt}mm; margin: 0; }`);

/** Preço como vai na etiqueta: "R$ 3,49", "R$ 6,50 / Kg". */
export function precoEtiqueta(centavos: number, unidade: string) {
  const v = formatarCentavos(centavos);
  return unidade && !["Unidade", "Peça"].includes(unidade) ? `${v} / ${unidade}` : v;
}

/** Largura de cada barra fina em mm; abaixo de 0,25 mm muitos leitores não conseguem ler. */
export const LARGURA_MIN_MODULO = 0.25;
export const larguraModulo = (m: Modelo, totalModulos: number) => (m.larg - 4) / totalModulos;
