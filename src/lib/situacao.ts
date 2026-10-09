/* Situação do produto para o dono: quanto tem, onde, o que vence e o que precisa de atenção.
 * Uma regra só, usada na ficha do produto (e depois na lista e no painel). Não grava nada. */
import type { Product } from "@/components/ProductArea";
import { qtdUn } from "@/lib/deposito";
import { textoDoTipo } from "@/lib/exemplos";
import { acimaPmcMsg, localNaoCombina, pmcCentavos } from "@/lib/farmacia";
import { CHAVE_PRODUTO, diasAte, faixa, fmtData, mil, deMil, tipoSemValidade, vencidoAVendaMsg, type LinhaVal } from "@/lib/validade";

/** urgente = vermelho; atencao = amarelo; info = falta completar o cadastro; ok = verde. */
export type Nivel = "urgente" | "atencao" | "info" | "ok";
/** Tipo do aviso, para o resumo "Atenção hoje" contar por assunto. */
export type TipoAlerta = "vencido" | "acabou" | "preco" | "lugar" | "repor" | "comprar" | "vencendo" | "conferir" | "completar";
export type Alerta = { nivel: Exclude<Nivel, "ok">; tipo: TipoAlerta; titulo: string; detalhe?: string | undefined };

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
  const add = (nivel: Alerta["nivel"], tipo: TipoAlerta, titulo: string, detalhe?: string) => alertas.push({ nivel, tipo, titulo, detalhe });
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
  if (vencVen.length) add("urgente", "vencido", `Vencido à venda: ${qtdUn(soma(vencVen), un)}`, vencidoAVendaMsg(farm));
  if (vencDep.length) add("urgente", "vencido", `Vencido no ${nomes.dep.toLowerCase()}: ${qtdUn(soma(vencDep), un)}`, "Separe para descarte ou troca com o fornecedor.");
  const linhasQtd: (Qtds & { prefixo: string })[] = porVar ? variacoes.map((x) => ({ ...x, prefixo: `${x.nome}: ` })) : [{ ...qtd, prefixo: "" }];
  for (const x of linhasQtd)
    if (x.dep != null && x.ven != null && mil(x.dep) === 0 && mil(x.ven) === 0)
      add("urgente", "acabou", `${x.prefixo}acabou`.replace(/^a/, "A"), `Acabou no ${nomes.dep.toLowerCase()} e na ${nomes.ven.toLowerCase()}. Hora de comprar${opts.fornecedor ? ` de ${opts.fornecedor}` : ""}.`);
  if (p.compra > 0 && p.venda > 0 && p.venda < p.compra) add("urgente", "preco", "Vendendo com prejuízo", "O preço de venda está menor que o de compra.");
  const pmc = farm ? acimaPmcMsg(p.venda, pmcCentavos(p.detalhes)) : "";
  if (pmc) add("urgente", "preco", "Preço acima do máximo (PMC)", pmc);
  const tarja = farm ? localNaoCombina(p.detalhes["tarja"], a?.local) : "";
  if (tarja) add("urgente", "lugar", "Remédio no lugar errado", tarja);

  /* ---------- atenção ---------- */
  for (const x of linhasQtd) {
    const zerado = x.dep != null && x.ven != null && mil(x.dep) === 0 && mil(x.ven) === 0;
    if (zerado) continue;
    if (x.ven != null && x.venMin != null && mil(x.ven) <= mil(x.venMin))
      add("atencao", "repor", `${x.prefixo}repor a ${nomes.ven.toLowerCase()}`.replace(/^r/, "R"),
        `Tem ${qtdUn(x.ven, un)}; o mínimo é ${qtdUn(x.venMin, un)}.${x.dep != null && mil(x.dep) > 0 ? ` Há ${qtdUn(x.dep, un)} no ${nomes.dep.toLowerCase()} para repor.` : ""}`);
    if (x.dep != null && x.depMin != null && mil(x.dep) <= mil(x.depMin))
      add("atencao", "comprar", `${x.prefixo}hora de comprar`.replace(/^h/, "H"),
        `O ${nomes.dep.toLowerCase()} tem ${qtdUn(x.dep, un)}; o mínimo é ${qtdUn(x.depMin, un)}.${opts.fornecedor ? ` Fornecedor: ${opts.fornecedor}.` : ""}`);
  }
  if (val) {
    const janela = Math.max(30, ...(val.avisos ?? []));
    const logo = lotes.filter((l) => l.dias != null && l.dias >= 0 && l.dias <= janela);
    if (logo.length) {
      const prox = logo[0]!;
      const naData = soma(logo.filter((l) => l.data === prox.data));
      add("atencao", "vencendo", `${quandoVence(prox.dias!).replace(/^v/, "V")}: ${qtdUn(naData, un)}`,
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
    if (semDividir > 0) add("atencao", "conferir", `Validade não informada: ${qtdUn(deMil(semDividir), un)}`, "Toque em Editar e informe as datas de vencimento.");
    const semData = lotes.filter((l) => !l.data);
    if (semData.length) add("atencao", "conferir", `Sem validade informada: ${qtdUn(soma(semData), un)}`, "Confira a data na embalagem e atualize.");
    const semLote = farm ? lotes.filter((l) => !l.lote) : [];
    if (semLote.length) add("atencao", "conferir", `Sem número de lote: ${qtdUn(soma(semLote), un)}`, "Na farmácia, o lote é obrigatório.");
  }

  /* ---------- falta completar ---------- */
  if (!d) add("info", "completar", `${nomes.dep} não configurado`, "Diga onde o produto fica guardado e quanto tem.");
  else if (!d.local) add("info", "completar", `Local no ${nomes.dep.toLowerCase()} não definido`);
  if (!a) add("info", "completar", `${nomes.ven} não configurada`, "Diga onde o produto fica exposto e quanto tem.");
  else if (!a.local) add("info", "completar", `Local na ${nomes.ven.toLowerCase()} não definido`);
  if (!p.validade && (farm || !tipoSemValidade(tipo))) add(farm ? "atencao" : "info", "completar", "Validade não configurada", farm ? "Na farmácia, o controle de validade é obrigatório." : undefined);
  if (!p.fornecedor) add("info", "completar", "Fornecedor não definido");

  const nivel: Nivel = alertas.some((x) => x.nivel === "urgente") ? "urgente" : alertas.some((x) => x.nivel === "atencao") ? "atencao"
    : alertas.some((x) => x.nivel === "info") ? "info" : "ok";
  return { nivel, alertas, qtd, variacoes, lotes, nomes };
}

/* ---------- Por local (abas Depósito/Estoque e Gôndola/Área de venda) ---------- */
export type EstadoItem = "vencido" | "acabou" | "abaixo" | "ok";
export type ItemLocal = {
  p: Product; nome: string; variacao?: string | undefined;
  qtd: number | null; min: number | null; max: number | null; estado: EstadoItem;
};
export type GrupoLocal = { local: string; itens: ItemLocal[] };
export type PorLocal = {
  grupos: GrupoLocal[];
  /** Configurado, mas sem local escolhido. */
  semLocal: ItemLocal[];
  /** Produtos que ainda não têm esta área configurada. */
  naoConfigurados: Product[];
  resumo: { locais: number; produtos: number; abaixo: number; acabou: number; vencido: number };
};
const normLocal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const precisaAtencaoItem = (i: ItemLocal) => i.estado !== "ok";

/** Agrupa os produtos pelo local de uma área. Locais cadastrados sem produto aparecem vazios. */
export function porLocal(products: Product[], area: "dep" | "ven", hoje: string, locaisCadastrados: string[] = []): PorLocal {
  const mapa = new Map<string, GrupoLocal>();
  for (const l of locaisCadastrados) if (l.trim() && !mapa.has(normLocal(l))) mapa.set(normLocal(l), { local: l.trim(), itens: [] });
  const semLocal: ItemLocal[] = [];
  const naoConfigurados: Product[] = [];
  for (const p of products) {
    const cfg = area === "dep" ? p.deposito : p.areaVenda;
    if (!cfg) { naoConfigurados.push(p); continue; }
    const linhas = p.validade?.controla ? p.validade[area] ?? {} : {};
    const vencido = (k: string) => (linhas[k] ?? []).some((l) => l.qtd > 0 && faixa(l.data, hoje) === "vencido");
    const estado = (q: number | null, min: number | null, k: string): EstadoItem =>
      vencido(k) ? "vencido" : q != null && mil(q) === 0 ? "acabou" : q != null && min != null && mil(q) <= mil(min) ? "abaixo" : "ok";
    const itens: ItemLocal[] = cfg.vars && p.variacoes.length
      ? p.variacoes.map((v) => {
          const c = cfg.vars?.[v.uid ?? ""];
          return { p, nome: p.nome, variacao: `${v.tam} · ${v.cor}`, qtd: c?.qtd ?? null, min: c?.min ?? null, max: c?.max ?? null, estado: estado(c?.qtd ?? null, c?.min ?? null, v.uid ?? "") };
        })
      : [{ p, nome: p.nome, qtd: cfg.qtd, min: cfg.min, max: cfg.max, estado: estado(cfg.qtd, cfg.min, CHAVE_PRODUTO) }];
    if (!cfg.local) { semLocal.push(...itens); continue; }
    const k = normLocal(cfg.local);
    if (!mapa.has(k)) mapa.set(k, { local: cfg.local.trim(), itens: [] });
    mapa.get(k)!.itens.push(...itens);
  }
  const porNome = (a: ItemLocal, b: ItemLocal) => a.nome.localeCompare(b.nome, "pt-BR") || (a.variacao ?? "").localeCompare(b.variacao ?? "", "pt-BR");
  const grupos = [...mapa.values()].sort((a, b) => a.local.localeCompare(b.local, "pt-BR", { numeric: true }));
  for (const g of grupos) g.itens.sort(porNome);
  semLocal.sort(porNome);
  const todos = [...grupos.flatMap((g) => g.itens), ...semLocal];
  return {
    grupos, semLocal, naoConfigurados: naoConfigurados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    resumo: {
      locais: grupos.length, produtos: new Set(todos.map((i) => i.p.id)).size,
      abaixo: todos.filter((i) => i.estado === "abaixo").length, acabou: todos.filter((i) => i.estado === "acabou").length,
      vencido: todos.filter((i) => i.estado === "vencido").length,
    },
  };
}

/* ---------- Atenção hoje (resumo do comércio) ---------- */
export type ItemAtencao = { p: Product; titulo: string; detalhe?: string | undefined };
export type GrupoAtencao = { tipo: TipoAlerta | "aguardando"; nivel: Alerta["nivel"]; titulo: string; ajuda: string; itens: ItemAtencao[] };

/** Junta os avisos de todos os produtos por assunto, do mais grave para o menos grave. Cada produto conta uma vez por assunto. */
export function atencaoHoje(products: Product[], tipo: string, hoje: string, fornecedorDe: (p: Product) => string | undefined = () => undefined,
  /** Produtos (id do banco) que já estão num pedido em andamento: saem de "Comprar"/"Acabaram" e vão para "Já pedidos". */
  jaPedidos: Set<string> = new Set()): GrupoAtencao[] {
  const T = textoDoTipo(tipo);
  const ven = nomeVenda(tipo).toLowerCase();
  const defs: Omit<GrupoAtencao, "itens">[] = [
    { tipo: "vencido", nivel: "urgente", titulo: "Vencidos", ajuda: "Separe para descarte ou troca com o fornecedor." },
    { tipo: "acabou", nivel: "urgente", titulo: "Acabaram", ajuda: "Não há nenhuma unidade. Hora de comprar." },
    { tipo: "preco", nivel: "urgente", titulo: "Preço a corrigir", ajuda: "Venda com prejuízo ou acima do preço máximo." },
    { tipo: "lugar", nivel: "urgente", titulo: "No lugar errado", ajuda: "Remédio com tarja ao alcance do cliente." },
    { tipo: "repor", nivel: "atencao", titulo: `Repor ${tipo === "mercado" || tipo === "pet" ? "a gôndola" : "a área de venda"}`, ajuda: `Chegaram ao mínimo na ${ven}.` },
    { tipo: "comprar", nivel: "atencao", titulo: "Comprar", ajuda: T("Chegaram ao mínimo no depósito.") },
    { tipo: "vencendo", nivel: "atencao", titulo: "Vencem em breve", ajuda: "Venda primeiro ou combine a troca." },
    { tipo: "conferir", nivel: "atencao", titulo: "Validade a conferir", ajuda: "Falta data ou lote." },
    { tipo: "aguardando", nivel: "info", titulo: "Já pedidos", ajuda: "Estão num pedido em andamento. Aguardando a entrega." },
    { tipo: "completar", nivel: "info", titulo: "Falta completar", ajuda: "Cadastro com local, validade ou fornecedor faltando." },
  ];
  const grupos = defs.map((d) => ({ ...d, itens: [] as ItemAtencao[] }));
  for (const p of [...products].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
    const s = situacaoProduto(p, tipo, hoje, { fornecedor: fornecedorDe(p) });
    const pedido = !!p.db?.id && jaPedidos.has(p.db.id);
    for (const g of grupos) {
      if (g.tipo === "aguardando") {
        const c = s.alertas.filter((x) => x.tipo === "comprar" || x.tipo === "acabou");
        if (pedido && c.length) g.itens.push({ p, titulo: c.map((x) => x.titulo).join(" · ") });
        continue;
      }
      if (pedido && (g.tipo === "comprar" || g.tipo === "acabou")) continue;
      const a = s.alertas.filter((x) => x.tipo === g.tipo);
      if (!a.length) continue;
      if (g.tipo === "completar" && s.alertas.some((x) => x.tipo !== "completar")) continue; // já aparece num assunto mais importante
      g.itens.push({ p, titulo: a.length > 1 ? a.map((x) => x.titulo).join(" · ") : a[0]!.titulo, detalhe: a.length > 1 ? undefined : a[0]!.detalhe });
    }
  }
  return grupos.filter((g) => g.itens.length);
}
