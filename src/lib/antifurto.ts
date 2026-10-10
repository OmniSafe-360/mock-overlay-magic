/* Fase 5.1 — relatório antifurto do comércio: o que falta, onde, quando e quem contou.
 * Usa as diferenças e perdas da Fase 4. Falta = diferença negativa que NÃO foi explicada como erro de contagem
 * (e não é uma contagem que ainda espera o dono escolher o número). */
import type { Product } from "@/lib/produto";
import { textoDoTipo } from "@/lib/exemplos";
import { nomeVenda } from "@/lib/situacao";
import { precisaEscolher, type AreaEstoque, type Diferenca, type MotivoDiferenca, type MotivoPerda, type Perda } from "@/lib/diferencas";

export type Periodo = "mes" | "mesPassado" | "tres";
export const PERIODOS: { id: Periodo; txt: string }[] = [
  { id: "mes", txt: "Este mês" },
  { id: "mesPassado", txt: "Mês passado" },
  { id: "tres", txt: "Últimos 3 meses" },
];

/** Uma contagem do produto num lugar (conferência, reposição ou contagem inicial): marca o começo do intervalo da falta. */
export type Contagem = { produtoId: string; variacaoId: string | null; area: AreaEstoque; em: string };

const mesMenos = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
/** Início (inclusive) e fim (exclusive) do período em AAAA-MM-DD, a partir de hoje (AAAA-MM-DD). */
export function limitesPeriodo(p: Periodo, hoje: string): { de: string; ate: string } {
  const mes = hoje.slice(0, 7);
  if (p === "mes") return { de: `${mes}-01`, ate: `${mesMenos(mes, -1)}-01` };
  if (p === "mesPassado") return { de: `${mesMenos(mes, 1)}-01`, ate: `${mes}-01` };
  return { de: `${mesMenos(mes, 2)}-01`, ate: `${mesMenos(mes, -1)}-01` };
}
/** Data (AAAA-MM-DD) no horário de Brasília. */
export const diaSP = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const noPeriodo = (iso: string, l: { de: string; ate: string }) => { const d = diaSP(iso); return d >= l.de && d < l.ate; };

/** É uma falta que conta no antifurto. */
export const ehFalta = (d: Diferenca) => d.diferenca < 0 && d.motivo !== "erro_contagem" && !precisaEscolher(d);

export type Falta = Diferenca & { /** Contagem anterior do mesmo produto no mesmo lugar (começo do intervalo). */ desde: string | null };
export type ItemRanking = { chave: string; titulo: string; sub: string; vezes: number; qtd: number; valor: number; produtos: number };
export type Relatorio = {
  faltas: Falta[];
  /** Faltas (centavos, positivo). */ faltouTotal: number;
  /** Por motivo da falta; "aberta" = ainda sem explicação. */ porMotivo: { motivo: MotivoDiferenca | "aberta"; vezes: number; valor: number }[];
  /** Erros de contagem: não contam como falta. */ erros: { vezes: number; valor: number };
  perdas: { total: number; vezes: number; porMotivo: { motivo: MotivoPerda; vezes: number; valor: number }[] };
  produtos: ItemRanking[];
  lugares: ItemRanking[];
  /** 0 = domingo. */ diasSemana: { dia: number; vezes: number; valor: number }[];
  pessoas: { nome: string; contagensComFalta: number; valorFaltas: number; perdas: number; valorPerdas: number }[];
};

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const diaSemanaSP = (iso: string) => {
  const [y, m, d] = diaSP(iso).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
};

/** A contagem anterior (mais de 1 minuto antes) do mesmo produto, variação e lugar. */
export function contagemAnterior(d: Pick<Diferenca, "produtoId" | "variacaoId" | "area" | "criadaEm">, contagens: Contagem[]): string | null {
  const limite = Date.parse(d.criadaEm) - 60_000;
  let melhor: number | null = null;
  for (const c of contagens) {
    if (c.produtoId !== d.produtoId || (c.variacaoId ?? null) !== (d.variacaoId ?? null) || c.area !== d.area) continue;
    const t = Date.parse(c.em);
    if (t <= limite && (melhor == null || t > melhor)) melhor = t;
  }
  return melhor == null ? null : new Date(melhor).toISOString();
}

export type InfoProduto = { nome: (produtoId: string, variacaoId: string | null) => string; local: (produtoId: string, area: AreaEstoque) => string | null; compra: (produtoId: string) => number };

export function relatorioAntifurto(difs: Diferenca[], perdas: Perda[], contagens: Contagem[], periodo: Periodo, hoje: string, info: InfoProduto, nomeArea: (a: AreaEstoque) => string): Relatorio {
  const l = limitesPeriodo(periodo, hoje);
  const doPeriodo = difs.filter((d) => noPeriodo(d.criadaEm, l));
  const faltas: Falta[] = doPeriodo.filter(ehFalta).map((d) => ({ ...d, desde: contagemAnterior(d, contagens) })).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  const erros = doPeriodo.filter((d) => d.diferenca < 0 && d.motivo === "erro_contagem");
  const perdasP = perdas.filter((p) => p.situacao !== "recusada" && noPeriodo(p.criadaEm, l));
  const valorPerda = (p: Perda) => Math.round(p.baixado * info.compra(p.produtoId));

  const agrupar = (chave: (f: Falta) => string, titulo: (f: Falta) => string, sub: (f: Falta) => string): ItemRanking[] => {
    const m = new Map<string, ItemRanking & { ids: Set<string> }>();
    for (const f of faltas) {
      const k = chave(f);
      const it = m.get(k) ?? { chave: k, titulo: titulo(f), sub: sub(f), vezes: 0, qtd: 0, valor: 0, produtos: 0, ids: new Set<string>() };
      it.vezes += 1; it.qtd += -f.diferenca; it.valor += -f.valor; it.ids.add(`${f.produtoId}:${f.variacaoId ?? ""}`);
      m.set(k, it);
    }
    return [...m.values()].map(({ ids, ...it }) => ({ ...it, produtos: ids.size })).sort((a, b) => b.valor - a.valor || b.vezes - a.vezes || a.titulo.localeCompare(b.titulo, "pt-BR"));
  };
  const lugar = (f: Falta) => info.local(f.produtoId, f.area) ?? "Sem lugar definido";

  const motivos = new Map<MotivoDiferenca | "aberta", { vezes: number; valor: number }>();
  for (const f of faltas) { const k = f.situacao === "aberta" ? "aberta" : f.motivo ?? "outro"; const x = motivos.get(k) ?? { vezes: 0, valor: 0 }; x.vezes += 1; x.valor += -f.valor; motivos.set(k, x); }
  const pm = new Map<MotivoPerda, { vezes: number; valor: number }>();
  for (const p of perdasP) { const x = pm.get(p.motivo) ?? { vezes: 0, valor: 0 }; x.vezes += 1; x.valor += valorPerda(p); pm.set(p.motivo, x); }
  const dias = Array.from({ length: 7 }, (_, dia) => ({ dia, vezes: 0, valor: 0 }));
  for (const f of faltas) { const d = dias[diaSemanaSP(f.criadaEm)]!; d.vezes += 1; d.valor += -f.valor; }
  const pessoas = new Map<string, Relatorio["pessoas"][number]>();
  const pessoa = (nome: string) => pessoas.get(nome) ?? { nome, contagensComFalta: 0, valorFaltas: 0, perdas: 0, valorPerdas: 0 };
  for (const f of faltas) if (f.funcionario && f.origem !== "perda_recusada") { const x = pessoa(f.funcionario); x.contagensComFalta += 1; x.valorFaltas += -f.valor; pessoas.set(f.funcionario, x); }
  for (const p of perdasP) if (p.funcionario && !p.peloDono) { const x = pessoa(p.funcionario); x.perdas += 1; x.valorPerdas += valorPerda(p); pessoas.set(p.funcionario, x); }

  return {
    faltas,
    faltouTotal: faltas.reduce((t, f) => t - f.valor, 0),
    porMotivo: [...motivos.entries()].map(([motivo, x]) => ({ motivo, ...x })).sort((a, b) => b.valor - a.valor),
    erros: { vezes: erros.length, valor: erros.reduce((t, d) => t - d.valor, 0) },
    perdas: { total: perdasP.reduce((t, p) => t + valorPerda(p), 0), vezes: perdasP.length, porMotivo: [...pm.entries()].map(([motivo, x]) => ({ motivo, ...x })).sort((a, b) => b.valor - a.valor) },
    produtos: agrupar((f) => `${f.produtoId}:${f.variacaoId ?? ""}`, (f) => info.nome(f.produtoId, f.variacaoId), () => ""),
    lugares: agrupar((f) => `${f.area}|${lugar(f).toLowerCase()}`, lugar, (f) => nomeArea(f.area)),
    diasSemana: dias,
    pessoas: [...pessoas.values()].sort((a, b) => b.valorFaltas + b.valorPerdas - (a.valorFaltas + a.valorPerdas) || a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

const fmtDiaHora = (iso: string) => {
  const d = new Date(iso);
  const dia = DIAS_SEMANA[diaSemanaSP(iso)]!.toLowerCase();
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return `${dia} ${data}, ${hora}`;
};
/** "Sumiu entre a contagem de segunda 06/10, 10:00 e a de terça 07/10, 15:00" (ou só quando foi descoberta). */
export function intervaloFalta(f: Pick<Falta, "desde" | "criadaEm" | "origem">): string {
  if (f.origem === "perda_recusada") return `Perda não confirmada · ${fmtDiaHora(f.criadaEm)}`;
  return f.desde ? `Entre a contagem de ${fmtDiaHora(f.desde)} e a de ${fmtDiaHora(f.criadaEm)}` : `Descoberta na contagem de ${fmtDiaHora(f.criadaEm)} (primeira contagem conferida)`;
}

/* ---------- Fase 5.2 — alertas automáticos ---------- */
/** Faltas para virar "produto visado" (em 30 dias, com a última nos últimos 7) e "lugar com muitas faltas" (produtos diferentes em 30 dias). */
export const VEZES_VISADO = 3;
export const PRODUTOS_LUGAR = 3;
export const LIMITE_PADRAO = 20000; // centavos (R$ 200,00)
const DIA = 86_400_000;

export type AlertasAntifurto = {
  visados: { chave: string; produtoId: string; variacaoId: string | null; titulo: string; vezes: number; valor: number }[];
  lugares: { chave: string; titulo: string; sub: string; produtos: number; vezes: number; valor: number }[];
  /** Faltou este mês (centavos) e o limite do comércio (centavos). */ faltouMes: number; limite: number; passouLimite: boolean;
};
/** Quantos avisos de antifurto há (cada produto visado, cada lugar e o limite contam 1). */
export const nAlertas = (a: AlertasAntifurto | null | undefined) => (a ? a.visados.length + a.lugares.length + (a.passouLimite ? 1 : 0) : 0);

/** Mesma regra do banco (`_produtos_visados`), para a tela. `agora` em ms. */
export function alertasAntifurto(difs: Diferenca[], hoje: string, agora: number, info: InfoProduto, nomeArea: (a: AreaEstoque) => string, limite: number): AlertasAntifurto {
  const ult30 = difs.filter((d) => ehFalta(d) && Date.parse(d.criadaEm) > agora - 30 * DIA);
  const porProduto = new Map<string, Diferenca[]>();
  for (const d of ult30) { const k = `${d.produtoId}:${d.variacaoId ?? ""}`; porProduto.set(k, [...(porProduto.get(k) ?? []), d]); }
  const visados = [...porProduto.entries()]
    .filter(([, ds]) => ds.length >= VEZES_VISADO && ds.some((d) => Date.parse(d.criadaEm) > agora - 7 * DIA))
    .map(([chave, ds]) => ({ chave, produtoId: ds[0]!.produtoId, variacaoId: ds[0]!.variacaoId, titulo: info.nome(ds[0]!.produtoId, ds[0]!.variacaoId), vezes: ds.length, valor: ds.reduce((t, d) => t - d.valor, 0) }))
    .sort((a, b) => b.valor - a.valor);
  const porLugar = new Map<string, { titulo: string; sub: string; ids: Set<string>; vezes: number; valor: number }>();
  for (const d of ult30) {
    const loc = info.local(d.produtoId, d.area);
    if (!loc) continue;
    const k = `${d.area}|${loc.toLowerCase()}`;
    const x = porLugar.get(k) ?? { titulo: loc, sub: nomeArea(d.area), ids: new Set<string>(), vezes: 0, valor: 0 };
    x.ids.add(`${d.produtoId}:${d.variacaoId ?? ""}`); x.vezes += 1; x.valor += -d.valor;
    porLugar.set(k, x);
  }
  const lugares = [...porLugar.entries()].filter(([, x]) => x.ids.size >= PRODUTOS_LUGAR)
    .map(([chave, x]) => ({ chave, titulo: x.titulo, sub: x.sub, produtos: x.ids.size, vezes: x.vezes, valor: x.valor })).sort((a, b) => b.valor - a.valor);
  const faltouMes = difs.filter((d) => ehFalta(d) && diaSP(d.criadaEm).slice(0, 7) === hoje.slice(0, 7)).reduce((t, d) => t - d.valor, 0);
  return { visados, lugares, faltouMes, limite, passouLimite: limite > 0 && faltouMes > limite };
}

/** Nome, lugar atual e preço de compra dos produtos do comércio (para o relatório e os alertas). */
export function infoDosProdutos(products: Product[]): InfoProduto {
  const prod = (id: string) => products.find((p) => (p.db?.id ?? String(p.id)) === id);
  return {
    nome: (id, v) => { const p = prod(id); const x = v ? p?.variacoes.find((y) => y.uid === v) : undefined; return `${p?.nome ?? "Produto removido"}${x ? ` · ${[x.tam, x.cor].filter(Boolean).join(" ")}` : ""}`; },
    local: (id, a) => (a === "deposito" ? prod(id)?.deposito?.local : prod(id)?.areaVenda?.local) ?? null,
    compra: (id) => prod(id)?.compra ?? 0,
  };
}
/** "Depósito"/"Estoque" e "Gôndola"/"Área de venda", conforme o tipo. */
export const nomeAreaDoTipo = (tipo: string) => (a: AreaEstoque) => (a === "deposito" ? textoDoTipo(tipo)("Depósito") : nomeVenda(tipo));
/** Desde quando carregar as diferenças para os alertas: o começo do mês ou 30 dias atrás, o que vier antes. */
export function desdeAlertas(hoje: string, agora: number): string {
  const mes = Date.parse(`${hoje.slice(0, 7)}-01T00:00:00-03:00`);
  return new Date(Math.min(mes, agora - 30 * DIA)).toISOString();
}
