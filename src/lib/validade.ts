/* Regras de validade do cadastro persistido. Distribuir a contagem confirmada nunca cria estoque. */
import { fmtQ, qtdUn } from "@/lib/deposito";

/** Fuso padrão explícito desta versão para definir "hoje". Não existe configuração no banco. */
export const TZ_PADRAO = "America/Sao_Paulo";
export const AVISOS = [30, 60, 90] as const;
/** Chave usada quando o produto não tem variações. Em roupas a chave é o `uid` estável da variação. */
export const CHAVE_PRODUTO = "_";

export type LinhaVal = {
  id: string;
  qtd: number;
  /** AAAA-MM-DD, sem hora. null = validade desconhecida. */
  data: string | null;
  lote: string | null;
  /** Farmácia: pendência (sem lote ou sem data) confirmada explicitamente. */
  pendConf?: boolean | undefined;
  /** Parte de uma pendência já registrada: id da pendência de origem (vínculo estável). */
  origem?: string | undefined;
};
export type LinhasArea = Record<string, LinhaVal[]>;
export type Validade = { controla: boolean; avisos: number[]; dep: LinhasArea; ven: LinhasArea };

export const VAL_SEM_CONFIG = "Validade não configurada";
export const VAL_FARM_INCOMPLETA = "Validade não configurada · Configuração incompleta: na farmácia o controle de validade é obrigatório";
export const AVISOS_NAO = "Avisos não configurados";
export const SEM_AVISOS = "Os avisos aparecem no painel do app. Não há envio por mensagem ou notificação.";
export const AGUARDANDO = "Aguardando contagem";
export const SEM_ESTOQUE = "Sem estoque nesta área. Nada a distribuir.";
export const ACIMA = "Você distribuiu mais do que foi contado.";
export const QTD_ZERO = "A quantidade precisa ser maior que zero.";
export const DATA_INV = "Data inválida. Use DD/MM/AAAA.";
export const DATA_VAZIA = "Informe o vencimento ou marque “Validade desconhecida”.";
export const PEND_CONF = "Registrar esta quantidade como pendente de conferência? Isso registra a existência da mercadoria, mas não significa autorização para vender ou repor.";
export const PEND_FALTA = "Confirme o registro como pendente de conferência.";
export const DESLIGAR_BLOQ = "Há quantidade registrada com validade ou pendência. Desligar o controle não é permitido nesta versão.";
export const LINHAS_SEM_CONTAGEM = "Há validades nesta área, mas ela não tem contagem confirmada. Remova essas linhas.";
export const faltaMsg = (n: string) => `Faltam ${n}: informe a validade ou registre como validade desconhecida.`;
export const conflitoMsg = (lote: string, datas: string[]) =>
  `O lote ${lote} aparece com vencimentos diferentes (${datas.join(" e ")}). Revise antes de continuar.`;

/* ---------- datas (calendário, sem hora) ---------- */
const bissexto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const diasNoMes = (y: number, m: number) => [31, bissexto(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;

/** DD/MM/AAAA → AAAA-MM-DD. Valida datas reais, inclusive 29/02. */
export function parseData(txt: string): { v: string | null; err: string } {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(txt.trim());
  if (!m) return { v: null, err: txt.trim() ? DATA_INV : DATA_VAZIA };
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (y < 1900 || y > 2199 || mo < 1 || mo > 12 || d < 1 || d > diasNoMes(y, mo)) return { v: null, err: DATA_INV };
  return { v: `${m[3]}-${m[2]}-${m[1]}`, err: "" };
}
export const fmtData = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
export const maskData = (s: string) => {
  const d = s.replace(/\D/g, "").slice(0, 8);
  return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/** "Hoje" como data de calendário no fuso indicado. */
export function hojeEm(tz = TZ_PADRAO, agora = new Date()): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(agora).map((x) => [x.type, x.value]));
  return `${p["year"]}-${p["month"]}-${p["day"]}`;
}
const utc = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y!, m! - 1, d!); };
export const diasAte = (iso: string, hoje: string) => Math.round((utc(iso) - utc(hoje)) / 86400000);

export type Faixa = "vencido" | "hoje" | "ate30" | "ate60" | "ate90" | "mais90" | "desconhecida";
export const FAIXA_TXT: Record<Faixa, string> = {
  vencido: "Vencido", hoje: "Vence hoje", ate30: "Vence em 1–30 dias", ate60: "Vence em 31–60 dias",
  ate90: "Vence em 61–90 dias", mais90: "Vence em mais de 90 dias", desconhecida: "Validade desconhecida",
};
/** Vencido a partir do dia seguinte à data. Faixas não dependem dos avisos escolhidos. */
export function faixa(data: string | null, hoje: string): Faixa {
  if (!data) return "desconhecida";
  const n = diasAte(data, hoje);
  return n < 0 ? "vencido" : n === 0 ? "hoje" : n <= 30 ? "ate30" : n <= 60 ? "ate60" : n <= 90 ? "ate90" : "mais90";
}

/* ---------- somas em milésimos inteiros ---------- */
export const mil = (n: number) => Math.round(n * 1000);
export const deMil = (n: number) => n / 1000;
export function conferirSoma(contado: number, qtds: number[]): { distribuido: number; falta: number; err: string } {
  const s = qtds.reduce((a, q) => a + mil(q), 0);
  const diff = mil(contado) - s;
  return { distribuido: deMil(s), falta: deMil(Math.max(diff, 0)), err: diff < 0 ? ACIMA : diff > 0 ? faltaMsg(fmtQ(deMil(diff))) : "" };
}

export const lotePendente = (l: { lote: string | null }, farmacia: boolean) => farmacia && !l.lote;

/** Conferência: física = não vencida conhecida + vencida + sem data. Lote pendente é informação extra. */
export function conferencia(linhas: LinhaVal[], hoje: string, farmacia: boolean) {
  let ok = 0, venc = 0, sem = 0, lp = 0;
  for (const l of linhas) {
    const q = mil(l.qtd), f = faixa(l.data, hoje);
    if (f === "desconhecida") sem += q; else if (f === "vencido") venc += q; else ok += q;
    if (lotePendente(l, farmacia)) lp += q;
  }
  return { fisica: deMil(ok + venc + sem), conhecida: deMil(ok), vencida: deMil(venc), semData: deMil(sem), lotePend: deMil(lp) };
}

/** Vencimento mais próximo, ainda não vencido, com quantidade positiva. */
export function proximoVencimento(linhas: LinhaVal[], hoje: string): { data: string; qtd: number } | null {
  const fut = linhas.filter((l) => l.data && l.qtd > 0 && diasAte(l.data, hoje) >= 0).map((l) => l.data!).sort();
  if (!fut.length) return null;
  const d = fut[0]!;
  return { data: d, qtd: deMil(linhas.filter((l) => l.data === d).reduce((a, l) => a + mil(l.qtd), 0)) };
}

export const normLote = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

/**
 * Lotes do MESMO produto/variação (as duas áreas juntas). Mesmo número = mesma identidade.
 * Datas conhecidas diferentes = conflito. Data desconhecida + conhecida = sugestão (nunca preenchida sozinha).
 */
export function analisarLotes(linhas: { id: string; lote: string | null; data: string | null }[]) {
  const g = new Map<string, { nome: string; itens: typeof linhas }>();
  for (const l of linhas) {
    if (!l.lote?.trim()) continue;
    const k = normLote(l.lote);
    if (!g.has(k)) g.set(k, { nome: l.lote.trim(), itens: [] });
    g.get(k)!.itens.push(l);
  }
  const conflitos: { lote: string; datas: string[] }[] = [];
  const sugestoes: { lote: string; data: string; ids: string[] }[] = [];
  for (const { nome, itens } of g.values()) {
    const datas = [...new Set(itens.map((i) => i.data).filter((d): d is string => !!d))].sort();
    if (datas.length > 1) conflitos.push({ lote: nome, datas });
    else if (datas.length === 1 && itens.some((i) => !i.data)) sugestoes.push({ lote: nome, data: datas[0]!, ids: itens.filter((i) => !i.data).map((i) => i.id) });
  }
  return { conflitos, sugestoes };
}

export const avisosTexto = (a: number[]) => (a.length ? `Avisos no painel: ${[...a].sort((x, y) => x - y).join(", ")} dias antes do vencimento` : AVISOS_NAO);

export function linhaTexto(l: LinhaVal, unidade: string, hoje: string, farmacia: boolean): string {
  const partes = [`${qtdUn(l.qtd, unidade)}`, l.data ? `vence ${fmtData(l.data)}` : "validade desconhecida"];
  if (l.lote) partes.push(`lote ${l.lote}`); else if (farmacia) partes.push("lote pendente");
  const f = faixa(l.data, hoje);
  if (f !== "desconhecida") partes.push(FAIXA_TXT[f]);
  if (l.pendConf) partes.push("Pendente de conferência");
  return partes.join(" · ");
}

export const temQtdValidade = (v?: Validade) =>
  !!v && [...Object.values(v.dep), ...Object.values(v.ven)].some((ls) => ls.some((l) => l.qtd > 0));

/**
 * Pendências já registradas: as partes de cada origem precisam somar exatamente a quantidade original (milésimos).
 * Quantidades nunca passam de uma pendência para outra. Retorna as origens com soma diferente.
 */
export function conferirOrigens(partes: { origem: string | null; qtd: number | null }[], originais: Record<string, number>) {
  const soma = new Map<string, number>();
  for (const p of partes) if (p.origem) soma.set(p.origem, (soma.get(p.origem) ?? 0) + mil(p.qtd ?? 0));
  return Object.entries(originais).filter(([id, q]) => (soma.get(id) ?? 0) !== mil(q)).map(([id, q]) => ({ id, original: q, atual: deMil(soma.get(id) ?? 0) }));
}
export const origemMsg = (orig: string, atual: string, desc: string) =>
  `A pendência registrada de ${orig}${desc} agora soma ${atual}. As partes dela precisam somar exatamente ${orig}: quantidades não podem passar de uma pendência para outra.`;
export const AREA_SEM_ESTOQUE = "Sem estoque nesta área";
export const VAL_AREA_PENDENTE = "Há quantidade contada, mas a validade desta quantidade ainda não foi configurada";
export const CONF_INCOMPLETA = "Conferência incompleta";

/** Produto vencido contado na área de venda: precisa sair da venda. Na farmácia é exigência da Anvisa. */
export const vencidoAVendaMsg = (farmacia: boolean) => farmacia
  ? "Remédio vencido não pode ficar à venda. Retire da área de venda e separe para descarte ou devolução ao distribuidor."
  : "Produto vencido não deve ficar à venda. Retire da área de venda e separe.";

/** O lote é um código curto; 8 números ou mais seguidos parecem código de barras lido por engano. */
export const LOTE_DICA = "Código curto impresso perto da validade.";
export const LOTE_PARECE_CODIGO = "Isto parece um código de barras. O lote é o código curto impresso perto da validade (ex.: L2345).";
export const lotePareceCodigo = (lote: string) => /^\d{8,}$/.test(lote.trim());
/** Há quantidade vencida contada na área de venda? */
export const temVencidoNaVenda = (v: Validade | null | undefined, hoje: string) =>
  !!v?.controla && Object.values(v.ven ?? {}).flat().some((l) => !!l.data && l.qtd > 0 && faixa(l.data, hoje) === "vencido");

/* ---------- Validade de acordo com o tipo de comércio (entrega 2 da análise por comércio) ---------- */
/** Roupa não vence: a loja de roupas não vê o passo de validade. */
export const tipoSemValidade = (tipo: string) => tipo === "roupas";
/** Categorias que costumam ter validade, nos tipos em que a maioria dos produtos não vence. */
export const CATEGORIAS_COM_VALIDADE: Record<string, string[]> = {
  construcao: ["Básico", "Pintura", "Pisos e revestimentos", "Acabamento"],
  autopecas: ["Óleos e lubrificantes", "Arrefecimento"],
};
/** Resposta já marcada para "Este produto tem validade?" (undefined = o comerciante escolhe). */
export function validadeSugerida(tipo: string, categoria: string): boolean | undefined {
  const lista = CATEGORIAS_COM_VALIDADE[tipo];
  if (!lista || !categoria) return undefined;
  return lista.includes(categoria);
}
export const sugestaoValidadeMsg = (sim: boolean, categoria: string) => sim
  ? `Já marcamos “Sim”: produtos de ${categoria} costumam ter validade. Mude se este não vencer.`
  : `Já marcamos “Não”: produtos de ${categoria} normalmente não vencem. Mude se este vencer.`;
/** Avisos já marcados num produto novo. Farmácia precisa de antecedência para trocar com o distribuidor. */
export const avisosPadrao = (tipo: string): number[] => (tipo === "farmacia" ? [30, 60, 90] : []);
