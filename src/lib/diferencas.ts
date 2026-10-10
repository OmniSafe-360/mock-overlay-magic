/* Fase 4.3 — aba Diferenças do dono: perdas para confirmar e diferenças para explicar.
 * Diferença = o que foi contado − o que o sistema tinha (negativo = faltou). Valor em centavos, pelo preço de compra. */
import { qtdUn } from "@/lib/deposito";
import { textoDoTipo } from "@/lib/exemplos";
import { nomeVenda } from "@/lib/situacao";

export type AreaEstoque = "deposito" | "venda";
export type MotivoDiferenca = "quebra" | "vencido" | "erro_contagem" | "sumiu" | "consumo" | "outro";
export type MotivoPerda = "quebrou" | "venceu" | "consumo" | "devolvido" | "outro";
export type OrigemDiferenca = "conferencia" | "conferencia_inconsistente" | "reposicao" | "perda_recusada";

export type Diferenca = {
  id: string; produtoId: string; variacaoId: string | null; area: AreaEstoque; origem: OrigemDiferenca;
  esperado: number; contado: number; diferenca: number; /** centavos */ valor: number;
  funcionario: string | null; situacao: "aberta" | "explicada"; motivo: MotivoDiferenca | null; observacao: string | null;
  /** Números contados pelo funcionário (conferência). */ tentativas: number[];
  /** Contagem inconsistente em que o dono já escolheu o número certo. */ resolvida: boolean;
  /** Perda recusada: o motivo que o funcionário tinha dado. */ motivoInformado: MotivoPerda | null;
  criadaEm: string;
};
export type Perda = {
  id: string; produtoId: string; variacaoId: string | null; area: AreaEstoque; quantidade: number; baixado: number;
  motivo: MotivoPerda; observacao: string | null; funcionario: string | null; peloDono: boolean;
  situacao: "aguardando" | "confirmada" | "recusada"; criadaEm: string;
};

export const MOTIVOS_DIFERENCA: { id: MotivoDiferenca; txt: string; ajuda: string }[] = [
  { id: "erro_contagem", txt: "Erro de contagem", ajuda: "Contaram errado antes ou agora." },
  { id: "quebra", txt: "Quebrou ou estragou", ajuda: "Foi jogado fora sem registrar." },
  { id: "vencido", txt: "Venceu", ajuda: "Saiu por validade sem registrar." },
  { id: "consumo", txt: "Usado na loja", ajuda: "Limpeza, café, uso da equipe." },
  { id: "sumiu", txt: "Sumiu", ajuda: "Ninguém sabe explicar. Pode ser furto." },
  { id: "outro", txt: "Outro motivo", ajuda: "Escreva o que aconteceu." },
];
export const MOTIVO_PERDA_TXT: Record<MotivoPerda, string> = {
  quebrou: "Quebrou ou estragou", venceu: "Venceu", consumo: "Usado na loja", devolvido: "Devolvido ao fornecedor", outro: "Outro motivo",
};
export const motivoDiferencaTxt = (m: MotivoDiferenca | null) => MOTIVOS_DIFERENCA.find((x) => x.id === m)?.txt ?? "";

/** Contagem que não bateu 3 vezes e ainda espera o dono escolher o número certo. */
export const precisaEscolher = (d: Diferenca) => d.origem === "conferencia_inconsistente" && !d.resolvida;

/** "no depósito" / "no estoque" / "na gôndola" / "na área de venda". */
export const ondeTexto = (area: AreaEstoque, tipo: string) =>
  area === "deposito" ? textoDoTipo(tipo)("no depósito") : `na ${nomeVenda(tipo).toLowerCase()}`;

/** "Faltaram 2 unidades na gôndola" / "Sobraram 3 unidades no depósito" / "As contagens não bateram". */
export function textoDiferenca(d: Diferenca, unidade: string, tipo: string): string {
  if (precisaEscolher(d)) return `As contagens não bateram ${ondeTexto(d.area, tipo)}`;
  if (d.diferenca === 0) return `Bateu com o sistema ${ondeTexto(d.area, tipo)}`;
  const q = qtdUn(Math.abs(d.diferenca), unidade);
  const um = Math.abs(d.diferenca) <= 1;
  return `${d.diferenca < 0 ? (um ? "Faltou" : "Faltaram") : um ? "Sobrou" : "Sobraram"} ${q} ${ondeTexto(d.area, tipo)}`;
}

/** De onde veio a diferença, em palavras simples. */
export function origemTexto(d: Diferenca, tipo: string): string {
  const t = textoDoTipo(tipo);
  switch (d.origem) {
    case "conferencia": return t("Conferência do depósito");
    case "conferencia_inconsistente": return t("Conferência do depósito (3 contagens diferentes)");
    case "reposicao": return `Reposição da ${nomeVenda(tipo).toLowerCase()}`;
    case "perda_recusada": return `Perda que você não confirmou${d.motivoInformado ? ` (a equipe disse: ${MOTIVO_PERDA_TXT[d.motivoInformado].toLowerCase()})` : ""}`;
  }
}

/** "−R$ 25,80" / "+R$ 4,00". */
export const valorSinal = (centavos: number) =>
  `${centavos < 0 ? "−" : centavos > 0 ? "+" : ""}${(Math.abs(centavos) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;

/** Mês (AAAA-MM) de uma data, no horário de Brasília. */
export const mesDe = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

export type ResumoDiferencas = {
  /** Perdas esperando o dono confirmar. */ perdas: number;
  /** Diferenças abertas (inclui contagens para escolher). */ diferencas: number;
  /** Quanto faltou este mês (centavos, positivo), sem as que o dono explicou como erro de contagem. */ faltouMes: number;
  /** Perdas confirmadas este mês (centavos, pelo preço de compra). */ perdasMes: number;
};
export function resumoDiferencas(difs: Diferenca[], perdas: Perda[], hoje: string, precoCompra: (produtoId: string) => number): ResumoDiferencas {
  const mes = hoje.slice(0, 7);
  return {
    perdas: perdas.filter((p) => p.situacao === "aguardando").length,
    diferencas: difs.filter((d) => d.situacao === "aberta").length,
    faltouMes: -difs.filter((d) => mesDe(d.criadaEm) === mes && d.valor < 0 && d.motivo !== "erro_contagem" && !precisaEscolher(d)).reduce((t, d) => t + d.valor, 0),
    perdasMes: perdas.filter((p) => p.situacao !== "recusada" && mesDe(p.criadaEm) === mes).reduce((t, p) => t + Math.round(p.baixado * precoCompra(p.produtoId)), 0),
  };
}

/** Quantos assuntos esperam o dono nesta aba (perdas para confirmar + diferenças para explicar). */
export const paraDecidir = (r: Pick<ResumoDiferencas, "perdas" | "diferencas">) => r.perdas + r.diferencas;

/** Abertas primeiro as que pedem escolha, depois as de maior valor faltando. */
export const ordemDiferencas = (a: Diferenca, b: Diferenca) =>
  Number(precisaEscolher(b)) - Number(precisaEscolher(a)) || a.valor - b.valor || b.criadaEm.localeCompare(a.criadaEm);
