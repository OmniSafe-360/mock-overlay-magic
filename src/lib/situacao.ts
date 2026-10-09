/* Situação do produto para o dono: quanto tem, onde, o que vence e o que precisa de atenção.
 * Uma regra só, usada na ficha do produto (e depois na lista e no painel). Não grava nada. */
import type { Product } from "@/components/ProductArea";
import { qtdUn } from "@/lib/deposito";
import { textoDoTipo } from "@/lib/exemplos";
import { acimaPmcMsg, localNaoCombina, pmcCentavos } from "@/lib/farmacia";
import { CHAVE_PRODUTO, diasAte, faixa, fmtData, mil, deMil, tipoSemValidade, vencidoAVendaMsg, type LinhaVal } from "@/lib/validade";

/** urgente = vermelho; atencao = amarelo; info = falta completar o cadastro; ok = verde. */
export type Nivel = "urgente" | "atencao" | "info" | "ok";
export type Alerta = { nivel: Exclude<Nivel, "ok">; titulo: string; detalhe?: string | undefined };

/** Quantidades de uma linha (produto inteiro ou uma variação de roupa). null = ainda não contado. */
export type Qtds = {
  dep: number | null; ven: number | null; total: number | null;
  depMin: number | null; depMax: number | null; venMin: number | null; venMax: number | null;
};
export type LinhaVariacao = Qtds & { uid: string; nome: string };
export type LoteVisto = { area: "dep" | "ven"; qtd: number; data: string | null; lote: string | null; dias: number | null; nome?: string | undefined };

export type Situacao = {
  nivel: Nivel;
  alertas: Alerta[];
  qtd: Qtds;
  variacoes: LinhaVariacao[];
  lotes: LoteVisto[];
  /** Nome curto das duas áreas no jeito do comércio ("Depósito"/"Estoque", "Gôndola"/"Área de venda"). */
  nomes: { dep: string; ven: string };
};

const somaOuNull = (xs: (number | null)[]) => (xs.every((x) => x == null) ? null : deMil(xs.reduce<number>((a, x) => a + mil(x ?? 0), 0)));
const total = (dep: number | null, ven: number | null) => (dep == null && ven == null ? null : deMil(mil(dep ?? 0) + mil(ven ?? 0)));

/** Nome da área de venda no singular, como se fala no dia a dia. */
export const nomeVenda = (tipo: string) => (tipo === "mercado" || tipo === "pet" ? "Gôndola" : "Área de venda");

/** "em 21 dias", "hoje", "há 4 dias". */
export function quandoVence(dias: number): string {
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias > 1) return `vence em ${dias} dias`;
  return dias === -1 ? "venceu ontem" : `venceu há ${-dias} dias`;
}

export function situacaoProduto(p: Product, tipo: string, hoje: string, opts: { fornecedor?: string | undefined } = {}): Situacao {
  const T = textoDoTipo(tipo);
  const nomes = { dep: T("Depósito"), ven: nomeVenda(tipo) };
  const farm = tipo === "farmacia";
  const un = p.unidade;
  const alertas: Alerta[] = [];
  const add = (nivel: Alerta["nivel"], titulo: string, detalhe?: string) => alertas.push({ nivel, titulo, detalhe });
  const d = p.deposito, a = p.areaVenda;
  const porVar = p.variacoes.length > 0 && !!(d?.vars || a?.vars);

  /* ---------- quantidades ---------- */
  const variacoes: LinhaVariacao[] = porVar
    ? p.variacoes.map((v) => {
        const k = v.uid ?? "";
        const dv = d?.vars?.[k], av = a?.vars?.[k];
        const dep = dv?.qtd ?? null, ven = av?.qtd ?? null;
        return { uid: k, nome: `${v.tam} · ${v.cor}`, dep, ven, total: total(dep, ven),
          depMin: dv?.min ?? null, depMax: dv?.max ?? null, venMin: av?.min ?? null, venMax: av?.max ?? null };
      })
    : [];
  const qtd: Qtds = porVar
    ? { dep: somaOuNull(variacoes.map((x) => x.dep)), ven: somaOuNull(variacoes.map((x) => x.ven)), total: null,
        depMin: null, depMax: null, venMin: null, venMax: null }
    : { dep: d && !d.vars ? d.qtd : null, ven: a && !a.vars ? a.qtd : null, total: null,
        depMin: d?.min ?? null, depMax: d?.max ?? null, venMin: a?.min ?? null, venMax: a?.max ?? null };
  qtd.total = total(qtd.dep, qtd.ven);

  /* ---------- validade ---------- */
  const val = p.validade?.controla ? p.validade : undefined;
  const nomeDaChave = (k: string) => (k === CHAVE_PRODUTO ? undefined : variacoes.find((x) => x.uid === k)?.nome ?? p.variacoes.find((v) => v.uid === k)?.tam);
  const lotes: LoteVisto[] = [];
  if (val)
    for (const area of ["dep", "ven"] as const)
      for (const [k, ls] of Object.entries(val[area] ?? {}))
        for (const l of ls as LinhaVal[])
          if (l.qtd > 0) lotes.push({ area, qtd: l.qtd, data: l.data, lote: l.lote, dias: l.data ? diasAte(l.data, hoje) : null, nome: nomeDaChave(k) });
  lotes.sort((x, y) => (x.data ?? "9999") < (y.data ?? "9999") ? -1 : (x.data ?? "9999") > (y.data ?? "9999") ? 1 : x.area < y.area ? -1 : 1);

  /* ---------- urgente ---------- */
  const soma = (ls: LoteVisto[]) => deMil(ls.reduce((s, l) => s + mil(l.qtd), 0));
  const vencVen = lotes.filter((l) => l.area === "ven" && faixa(l.data, hoje) === "vencido");
  const vencDep = lotes.filter((l) => l.area === "dep" && faixa(l.data, hoje) === "vencido");
  if (vencVen.length) add("urgente", `Vencido à venda: ${qtdUn(soma(vencVen), un)}`, vencidoAVendaMsg(farm));
  if (vencDep.length) add("urgente", `Vencido no ${nomes.dep.toLowerCase()}: ${qtdUn(soma(vencDep), un)}`, "Separe para descarte ou troca com o fornecedor.");
  const linhasQtd: (Qtds & { prefixo: string })[] = porVar ? variacoes.map((x) => ({ ...x, prefixo: `${x.nome}: ` })) : [{ ...qtd, prefixo: "" }];
  for (const x of linhasQtd)
    if (x.dep != null && x.ven != null && mil(x.dep) === 0 && mil(x.ven) === 0)
      add("urgente", `${x.prefixo}acabou`.replace(/^a/, "A"), `Acabou no ${nomes.dep.toLowerCase()} e na ${nomes.ven.toLowerCase()}. Hora de comprar${opts.fornecedor ? ` de ${opts.fornecedor}` : ""}.`);
  if (p.compra > 0 && p.venda > 0 && p.venda < p.compra) add("urgente", "Vendendo com prejuízo", "O preço de venda está menor que o de compra.");
  const pmc = farm ? acimaPmcMsg(p.venda, pmcCentavos(p.detalhes)) : "";
  if (pmc) add("urgente", "Preço acima do máximo (PMC)", pmc);
  const tarja = farm ? localNaoCombina(p.detalhes["tarja"], a?.local) : "";
  if (tarja) add("urgente", "Remédio no lugar errado", tarja);

  /* ---------- atenção ---------- */
  for (const x of linhasQtd) {
    const zerado = x.dep != null && x.ven != null && mil(x.dep) === 0 && mil(x.ven) === 0;
    if (zerado) continue;
    if (x.ven != null && x.venMin != null && mil(x.ven) <= mil(x.venMin))
      add("atencao", `${x.prefixo}repor a ${nomes.ven.toLowerCase()}`.replace(/^r/, "R"),
        `Tem ${qtdUn(x.ven, un)}; o mínimo é ${qtdUn(x.venMin, un)}.${x.dep != null && mil(x.dep) > 0 ? ` Há ${qtdUn(x.dep, un)} no ${nomes.dep.toLowerCase()} para repor.` : ""}`);
    if (x.dep != null && x.depMin != null && mil(x.dep) <= mil(x.depMin))
      add("atencao", `${x.prefixo}hora de comprar`.replace(/^h/, "H"),
        `O ${nomes.dep.toLowerCase()} tem ${qtdUn(x.dep, un)}; o mínimo é ${qtdUn(x.depMin, un)}.${opts.fornecedor ? ` Fornecedor: ${opts.fornecedor}.` : ""}`);
  }
  if (val) {
    const janela = Math.max(30, ...(val.avisos ?? []));
    const logo = lotes.filter((l) => l.dias != null && l.dias >= 0 && l.dias <= janela);
    if (logo.length) {
      const prox = logo[0]!;
      const naData = soma(logo.filter((l) => l.data === prox.data));
      add("atencao", `${quandoVence(prox.dias!).replace(/^v/, "V")}: ${qtdUn(naData, un)}`,
        `Vencimento em ${fmtData(prox.data!)}.${logo.length > 1 && logo.some((l) => l.data !== prox.data) ? ` Outras ${logo.filter((l) => l.data !== prox.data).length} validades vencem nos próximos ${janela} dias.` : ""}`);
    }
    /* Contado, mas ainda sem a validade distribuída (por área e por variação). */
    let semDividir = 0;
    for (const area of ["dep", "ven"] as const) {
      const chaves = porVar ? variacoes.map((x) => x.uid) : [CHAVE_PRODUTO];
      for (const k of chaves) {
        const contado = porVar ? variacoes.find((x) => x.uid === k)?.[area] ?? null : qtd[area];
        if (contado == null) continue;
        const dividido = (val[area]?.[k] ?? []).reduce((acc, l) => acc + mil(l.qtd), 0);
        semDividir += Math.max(mil(contado) - dividido, 0);
      }
    }
    if (semDividir > 0) add("atencao", `Validade não informada: ${qtdUn(deMil(semDividir), un)}`, "Toque em Editar e informe as datas de vencimento.");
    const semData = lotes.filter((l) => !l.data);
    if (semData.length) add("atencao", `Sem validade informada: ${qtdUn(soma(semData), un)}`, "Confira a data na embalagem e atualize.");
    const semLote = farm ? lotes.filter((l) => !l.lote) : [];
    if (semLote.length) add("atencao", `Sem número de lote: ${qtdUn(soma(semLote), un)}`, "Na farmácia, o lote é obrigatório.");
  }

  /* ---------- falta completar ---------- */
  if (!d) add("info", `${nomes.dep} não configurado`, "Diga onde o produto fica guardado e quanto tem.");
  else if (!d.local) add("info", `Local no ${nomes.dep.toLowerCase()} não definido`);
  if (!a) add("info", `${nomes.ven} não configurada`, "Diga onde o produto fica exposto e quanto tem.");
  else if (!a.local) add("info", `Local na ${nomes.ven.toLowerCase()} não definido`);
  if (!p.validade && (farm || !tipoSemValidade(tipo))) add(farm ? "atencao" : "info", "Validade não configurada", farm ? "Na farmácia, o controle de validade é obrigatório." : undefined);
  if (!p.fornecedor) add("info", "Fornecedor não definido");

  const nivel: Nivel = alertas.some((x) => x.nivel === "urgente") ? "urgente" : alertas.some((x) => x.nivel === "atencao") ? "atencao"
    : alertas.some((x) => x.nivel === "info") ? "info" : "ok";
  return { nivel, alertas, qtd, variacoes, lotes, nomes };
}
