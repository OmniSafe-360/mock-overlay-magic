import { useMemo, useState, type ReactNode } from "react";
import { lotesAConfirmar } from "@/lib/persistencia";
import { ArrowLeft, Check, CheckCircle2, Keyboard, Package, Pencil, Plus, ScanLine, Tag, Truck, X } from "lucide-react";
import { Field, btnGhost, btnPrimary, digits, maskPhone, nextOnEnter, useKeyboard, type StoreData } from "@/components/StoreSetup";
import { Scanner } from "@/components/Scanner";
import { ganhoSobreCompra, lerPct, mostrarPct, vendaPorGanho } from "@/lib/preco";
import { escolhasDoUltimo } from "@/lib/ultimaEscolha";
import {
  EMB_VAZIA, MAX_EMBALAGENS, ajudaCodigoEmbalagem, descricaoEmbalagem, embalagensDoTipo, rotuloComoChega, rotuloPrecoEmbalagem, errosEmbalagem, lerQtdEmbalagem, perguntaQtd, precoUnidade, rotuloContarPor, rotuloFechadas,
  rotuloSoltas, totalContado, type Embalagem,
} from "@/lib/embalagem";
import { FichaProduto } from "@/components/FichaProduto";
import { avisoCodigo } from "@/lib/codigoBarras";
import { LOCAIS_SUGERIDOS, exemplos, textoDoTipo } from "@/lib/exemplos";
import { acimaPmcMsg, localNaoCombina, localPelaTarja, pmcCentavos, pmcTexto } from "@/lib/farmacia";
import { CATEGORIAS, DETALHES, GRUPOS_TAMANHO, UNICO, UNIDADES, grupoInicial } from "@/lib/listas";
import { AUTOPECAS_VARS_MSG, CONSTRUCAO_VARS_MSG, PET_VARS_MSG, FARMACIA_VARS_MSG, msgDetalheFixo, firstInvalidStep, typeRuleError, type TypeRules, mainCodeError, usedCodes, variationErrors, variationOk } from "@/lib/variations";
import {
  ACIMA_MAX, LOCAL_DUP, LOCAL_PENDENTE, REMOCAO_BLOQUEADA, SEM_CONFIG, TEMPORARIO, aceitaFracao, fmtQ, limitesErro, limitesStatus, localDuplicado,
  localTravadoMsg, locaisDoComercio, newUid, parseNum, qtdUn, temQtdPositiva, toInput, unidadeTravadaMsg, type Deposito,
  unPlural, unSingular,
} from "@/lib/deposito";
import {
  EXEMPLO_LOCAL, SEM_REPOSICAO, VEN_ACIMA_MAX, VEN_LOCAL_DUP, VEN_LOCAL_PENDENTE, VEN_SEM_CONFIG, limitesVendaStatus,
  locaisVendaDoComercio, totalTexto, venLocalTravadoMsg, type AreaVenda,
} from "@/lib/areaVenda";
import {
  ACIMA, AGUARDANDO, AVISOS, CHAVE_PRODUTO, DESLIGAR_BLOQ, FAIXA_TXT, LINHAS_SEM_CONTAGEM, PEND_CONF, PEND_FALTA, QTD_ZERO, SEM_AVISOS, SEM_ESTOQUE,
  AREA_SEM_ESTOQUE, CONF_INCOMPLETA, VAL_AREA_PENDENTE, conferirOrigens, origemMsg, TZ_PADRAO, VAL_FARM_INCOMPLETA, VAL_SEM_CONFIG, analisarLotes, avisosTexto, conferencia, conferirSoma, conflitoMsg, faixa, fmtData, hojeEm,
  linhaTexto, lotePendente, maskData, mil, parseData, proximoVencimento, temQtdValidade, type LinhaVal, type Validade,
  LOTE_DICA, LOTE_PARECE_CODIGO, lotePareceCodigo, vencidoAVendaMsg,
  CATEGORIAS_COM_VALIDADE, avisosPadrao, sugestaoValidadeMsg, tipoSemValidade, validadeSugerida,
} from "@/lib/validade";

/* ---------- tipos e dados por comércio ---------- */
/** Junta listas de locais sem repetir (maiúsculas e espaços ignorados), mantendo a primeira grafia. */
function juntarLocais(...listas: string[][]): string[] {
  const m = new Map<string, string>();
  for (const l of listas.flat()) { const k = l.trim().toLowerCase().replace(/\s+/g, " "); if (k && !m.has(k)) m.set(k, l); }
  return [...m.values()];
}
export type Supplier = { id: number; nome: string; tel: string; email: string; dbId?: string | undefined };
/** `uid` liga a variação à sua configuração de depósito, sem depender da posição na lista. */
export type Variation = { tam: string; cor: string; qtd: number; codigo?: string | undefined; uid?: string | undefined };
export type Product = {
  id: number; codigo: string; nome: string; compra: number; venda: number; unidade: string; categoria: string;
  detalhes: Record<string, string>; variacoes: Variation[]; fornecedor: number | null;
  deposito?: Deposito | undefined;
  /** Área de venda (gôndola, prateleira, arara...). Não confundir com `venda`, que é o preço. */
  areaVenda?: AreaVenda | undefined;
  /** Controle de validade e divisão das contagens confirmadas por vencimento/lote. */
  validade?: Validade | undefined;
  /** Como chega do fornecedor (caixa, fardo...). Vazio = por unidade. Não vale para loja de roupas. */
  embalagens?: Embalagem[] | undefined;
  /** Vínculo com o banco: id real e áreas cuja contagem inicial já foi registrada ("deposito:_", "venda:<uid>"). */
  db?: { id: string; contadas: string[] } | undefined;
  /** Só true depois que o usuário marcou a confirmação do vencimento do lote. */
  confirmarVencimento?: boolean | undefined;
};


export const brl2 = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moneyIn = (v: string) => Number(digits(v).slice(0, 10) || 0);
const labelOf = (tipo: string, k: string) => DETALHES[tipo]?.find((f) => f.k === k)?.label ?? k;

/* ---------- detalhe do produto ---------- */
export function ProductDetail({ p, tipo, suppliers, onBack, onEdit }: { p: Product; tipo: string; suppliers: Supplier[]; onBack: () => void; onEdit: () => void }) {
  return <FichaProduto p={p} tipo={tipo} fornecedor={suppliers.find((s) => s.id === p.fornecedor)} onBack={onBack} onEdit={onEdit} />;
}
/** Contagem confirmada por área e chave (uid da variação ou produto). null = sem contagem confirmada. */
export type ContagemFn = (area: "dep" | "ven", k: string) => number | null;
/** Linhas de conferência da validade (resumo do cadastro). Nunca afirma que avisos ou bloqueios funcionam. */
export function validadeLinhas(v: Validade | undefined, farm: boolean, unidade: string, nomeVar: (k: string) => string, hoje: string,
  keys: string[] = [CHAVE_PRODUTO], cont: ContagemFn = () => null): string[] {
  if (!v) return [farm ? VAL_FARM_INCOMPLETA : VAL_SEM_CONFIG];
  if (!v.controla) return ["Não controla validade"];
  const out = ["Controla validade", avisosTexto(v.avisos), SEM_AVISOS];
  const todas: LinhaVal[] = [];
  const faltas: string[] = [];
  for (const [area, nome] of [["dep", "Depósito"], ["ven", "Área de venda"]] as const) {
    for (const k of keys) {
      const ls = v[area][k] ?? [];
      const c = cont(area, k);
      const pre = k === CHAVE_PRODUTO ? nome : `${nome} · ${nomeVar(k)}`;
      if (c == null) { out.push(`${pre}: ${AGUARDANDO}`); faltas.push(`${pre} aguardando contagem`); continue; }
      if (mil(c) === 0) { out.push(`${pre}: ${AREA_SEM_ESTOQUE}`); continue; }
      if (!ls.length) { out.push(`${pre}: ${VAL_AREA_PENDENTE} (${qtdUn(c, unidade)} contados)`); faltas.push(`${pre} com validade pendente`); continue; }
      todas.push(...ls);
      out.push(`${pre}: ${ls.map((l) => linhaTexto(l, unidade, hoje, farm)).join("; ")}`);
    }
  }
  const c = conferencia(todas, hoje, farm);
  const soma = `não vencida ${fmtQ(c.conhecida)} + vencida ${fmtQ(c.vencida)} + sem data ${fmtQ(c.semData)} = ${qtdUn(c.fisica, unidade)}`;
  out.push(faltas.length ? `${CONF_INCOMPLETA}: ${faltas.join("; ")}. Só nas partes com validade: ${soma}` : `Física contada ${fmtQ(c.fisica)} = ${soma}`);
  if (c.vencida > 0) out.push(`Vencidos: ${qtdUn(c.vencida, unidade)} (continuam contados)`);
  if (c.semData > 0) out.push(`Validade desconhecida: ${qtdUn(c.semData, unidade)}`);
  if (c.lotePend > 0) out.push(`Lote pendente: ${qtdUn(c.lotePend, unidade)}`);
  const pr = proximoVencimento(todas, hoje);
  out.push(pr ? `Próximo vencimento não vencido: ${fmtData(pr.data)} (${qtdUn(pr.qtd, unidade)})` : "Sem próximo vencimento não vencido");
  return out;
}
/* ---------- cadastro em 8 etapas (Depósito e Área de venda têm 3 subpassos; Validade tem 4) ---------- */
const TITLES = ["Qual é o código do produto?", "Preço e unidade", "Detalhes do produto", "Quem é o fornecedor?", "Depósito", "Área de venda", "Validade", "Conferir e salvar"];
const DEP_TITLES = ["Onde fica no depósito?", "Quanto há no depósito?", "Limites de estoque"];
const VEN_TITLES = ["Área de venda: onde fica?", "Área de venda: quantidade", "Área de venda: limites"];
const VAL_TITLES = ["Controle de validade", "Avisos de validade", "Validades no depósito", "Validades na área de venda"];
const STEP_DEP = 4;
const STEP_VEN = 5;
const STEP_VAL = 6;
const STEP_REV = 7;
const TOTAL = TITLES.length;

type LinhaEd = { id: string; qtd: string; data: string; semData: boolean; lote: string; conf: boolean; saved: boolean; lockData: boolean; lockLote: boolean; ro: boolean;
  /** Pendência registrada de origem (ela mesma ou a pendência que foi dividida). null = linha livre (antes do 1º salvamento). */
  origem: string | null };
const novaLinha = (b: Partial<LinhaEd> = {}): LinhaEd =>
  ({ id: newUid(), qtd: "", data: "", semData: false, lote: "", conf: false, saved: false, lockData: false, lockLote: false, ro: false, origem: null, ...b });
/** Linhas já salvas: conhecidas ficam só para consulta; pendências podem ser completadas sem perder o que já se sabe. */
function linhasIniciais(v: Validade | undefined, farm: boolean): Record<string, LinhaEd[]> {
  const out: Record<string, LinhaEd[]> = {};
  for (const area of ["dep", "ven"] as const)
    for (const [k, ls] of Object.entries(v?.[area] ?? {}))
      out[`${area}:${k}`] = ls.map((l) => {
        const pend = !l.data || lotePendente(l, farm);
        return { id: l.id, qtd: toInput(l.qtd), data: l.data ? fmtData(l.data) : "", semData: !l.data, lote: l.lote ?? "", conf: !!l.pendConf,
          saved: true, lockData: !!l.data, lockLote: !!l.lote, ro: !pend, origem: pend ? l.id : null };
      });
  return out;
}

type VarDep = { qtd?: string | undefined; min: string; max: string };

export function ProductWizard({ store, products, initial, suppliers, onAddSupplier, onCancel, onSave, saving = false, erro = "", locaisCadastrados, onGerarCodigo }: {
  store: StoreData; products: Product[]; initial?: Product | undefined; suppliers: Supplier[];
  onAddSupplier: (s: Omit<Supplier, "id">) => number | Promise<number>; onCancel: () => void; onSave: (p: Product) => void;
  saving?: boolean; erro?: string;
  /** Todos os locais cadastrados do comércio, por área, inclusive os sem produto. */
  locaisCadastrados?: { deposito: string[]; venda: string[] } | undefined;
  /** Cria um código interno no banco para produto sem código de barras (ex.: 2900000000018). */
  onGerarCodigo?: (() => Promise<string>) | undefined;
}) {
  const kb = useKeyboard();
  const tipo = store.tipo;
  /** Textos com "depósito" viram "estoque" nos tipos que falam assim. */
  const T = textoDoTipo(tipo);
  const dep = T("depósito");
  const [step, setStep] = useState(0);
  const [sub, setSub] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [fromReview, setFromReview] = useState(false);
  const [codeMode, setCodeMode] = useState<"choose" | "type">(initial ? "type" : "choose");
  const [scan, setScan] = useState(false);
  const [denied, setDenied] = useState(false);
  /** Produto novo começa com as escolhas do último produto do comércio (a lista vem do mais novo para o mais antigo). */
  const [ini] = useState(() => (initial ? {} : escolhasDoUltimo(products[0], {
    unidades: UNIDADES[tipo] ?? [], categorias: CATEGORIAS[tipo] ?? [], fornecedores: suppliers.map((s) => s.id),
  })));
  const [codigo, setCodigo] = useState(initial?.codigo ?? "");
  const gerador = useGerarCodigo(onGerarCodigo);
  const criarCodigo = () => gerador.gerar((c) => {
    setCodigo(c); setCodeMode("type");
    setTimeout(() => document.getElementById("pnome")?.focus(), 80);
  });
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [compra, setCompra] = useState(initial?.compra ?? 0);
  const [venda, setVenda] = useState(initial?.venda ?? 0);
  /** % digitado em "Ganho sobre a compra". Enquanto valer, mudar a compra recalcula a venda. */
  const [pctDigitado, setPctDigitado] = useState<string | null>(null);
  const [unidade, setUnidade] = useState(initial?.unidade ?? ini.unidade ?? "");
  const [categoria, setCategoria] = useState(initial?.categoria ?? ini.categoria ?? "");
  const [det, setDet] = useState<Record<string, string>>(initial?.detalhes ?? {});
  /* Detalhes: os opcionais ficam fechados em "Mais detalhes" (abertos se o produto já tem algum preenchido). */
  const extrasDet = (DETALHES[tipo] ?? []).filter((f) => f.opcional);
  const [maisDet, setMaisDet] = useState(() => extrasDet.some((f) => !!initial?.detalhes?.[f.k]));
  const camposDet = (DETALHES[tipo] ?? []).filter((f) => !f.opcional || maisDet);
  const [vars, setVars] = useState<Variation[]>(() => (initial?.variacoes ?? []).map((v) => (v.uid ? v : { ...v, uid: newUid() })));
  const [forn, setForn] = useState<number | null | undefined>(initial ? initial.fornecedor : ini.fornecedor);
  const [varSheet, setVarSheet] = useState<number | null>(null);
  const [suppSheet, setSuppSheet] = useState(false);
  /* ----- como chega do fornecedor (embalagens) ----- */
  const [embs, setEmbs] = useState<Embalagem[]>(initial?.embalagens ?? []);
  const [embModo, setEmbModo] = useState<"unidade" | "embalagem">((initial?.embalagens ?? []).length ? "embalagem" : "unidade");
  const [embSheet, setEmbSheet] = useState<number | null>(null);
  const [varMsg, setVarMsg] = useState("");
  const [unitMsg, setUnitMsg] = useState("");

  /* ----- depósito (em memória) ----- */
  const initDep = initial?.deposito;
  const configSalva = !!initDep;
  const locais = useMemo(() => juntarLocais(locaisCadastrados?.deposito ?? [], locaisDoComercio(products)), [products, locaisCadastrados]);
  const [dLocal, setDLocal] = useState<string | null | undefined>(initDep ? initDep.local : ini.localDeposito);
  const [manterSem, setManterSem] = useState(!!initial && !initDep);
  const [novoLocal, setNovoLocal] = useState<string | null>(null);
  const [localMsg, setLocalMsg] = useState("");
  const [dQtd, setDQtd] = useState(toInput(initDep?.qtd));
  const [dMin, setDMin] = useState(toInput(initDep?.min));
  const [dMax, setDMax] = useState(toInput(initDep?.max));
  const [dVar, setDVar] = useState<Record<string, VarDep>>(() =>
    Object.fromEntries(Object.entries(initDep?.vars ?? {}).map(([k, c]) => [k, { qtd: toInput(c.qtd), min: toInput(c.min), max: toInput(c.max) }])));
  const [subTried, setSubTried] = useState(false);

  /* ----- área de venda (em memória, conjunto de locais separado do depósito) ----- */
  const initVen = initial?.areaVenda;
  const vendaSalva = !!initVen;
  const locaisV = useMemo(() => juntarLocais(locaisCadastrados?.venda ?? [], locaisVendaDoComercio(products)), [products, locaisCadastrados]);
  const [confVenc, setConfVenc] = useState(false);
  /** Venda menor que a compra: precisa confirmar ao salvar. Guarda os preços confirmados; mudar o preço pede de novo. */
  const [prejuizoOk, setPrejuizoOk] = useState<string | null>(null);
  const [vLocal, setVLocal] = useState<string | null | undefined>(initVen ? initVen.local : ini.localVenda);
  const [vManter, setVManter] = useState(!!initial && !initVen);
  const [vNovo, setVNovo] = useState<string | null>(null);
  const [vLocalMsg, setVLocalMsg] = useState("");
  const [vQtd, setVQtd] = useState(toInput(initVen?.qtd));
  const [vMin, setVMin] = useState(toInput(initVen?.min));
  const [vMax, setVMax] = useState(toInput(initVen?.max));
  const [vVar, setVVar] = useState<Record<string, VarDep>>(() =>
    Object.fromEntries(Object.entries(initVen?.vars ?? {}).map(([k, c]) => [k, { qtd: toInput(c.qtd), min: toInput(c.min), max: toInput(c.max) }])));

  /* ----- validade (em memória) ----- */
  const isFarm = tipo === "farmacia";
  const initVal = initial?.validade;
  const hoje = useMemo(() => hojeEm(TZ_PADRAO), []);
  /* Validade de acordo com o tipo: roupas pula o passo; construção e autopeças já vêm respondidas pela categoria. */
  const pulaVal = tipoSemValidade(tipo) && !initVal?.controla;
  const [vControla, setVControla] = useState<boolean | undefined>(isFarm ? true
    : initVal?.controla ?? (pulaVal ? false : CATEGORIAS_COM_VALIDADE[tipo] ? undefined : ini.validade?.controla));
  const [valTocado, setValTocado] = useState(false);
  const [valManter, setValManter] = useState(!!initial && !initVal);
  const [avisos, setAvisos] = useState<number[]>(initVal?.avisos ?? ini.validade?.avisos ?? (initial ? [] : avisosPadrao(tipo)));
  const [valMsg, setValMsg] = useState("");
  const [lin, setLin] = useState<Record<string, LinhaEd[]>>(() => linhasIniciais(initVal, isFarm));
  const desligarBloq = temQtdValidade(initVal);

  const used = useMemo(() => usedCodes(products, initial?.id), [products, initial?.id]);
  const isRoupas = tipo === "roupas";
  /** Escolheu "Em caixa, fardo ou pacote" mas não adicionou nenhuma. */
  const embBad = !isRoupas && embModo === "embalagem" && embs.length === 0;
  const codeErr = mainCodeError(codigo, used, isRoupas ? vars : [])
    || (!isRoupas && codigo.trim() && embs.some((e) => e.codigo.trim() === codigo.trim()) ? "Este código já pertence a uma embalagem deste produto." : "");
  const [triedSave, setTriedSave] = useState(false);
  /** Detalhes com opções fixas do tipo: se preenchidos, precisam estar na lista (o banco confere igual). */
  const fixos = (DETALHES[tipo] ?? []).filter((f) => f.opts).map((f) => ({ k: f.k, opts: f.opts!, msg: msgDetalheFixo(f.label) }));
  const rules: TypeRules | undefined =
    tipo === "mercado" ? { unidades: UNIDADES["mercado"]!, categorias: CATEGORIAS["mercado"]!, semVariacoes: true }
    : tipo === "farmacia" ? { unidades: UNIDADES["farmacia"]!, categorias: CATEGORIAS["farmacia"]!, semVariacoes: true, varsMsg: FARMACIA_VARS_MSG, detalhesFixos: fixos }
    : tipo === "construcao" ? { unidades: UNIDADES["construcao"]!, categorias: CATEGORIAS["construcao"]!, semVariacoes: true, varsMsg: CONSTRUCAO_VARS_MSG, detalhesFixos: fixos }
    : tipo === "pet" ? { unidades: UNIDADES["pet"]!, categorias: CATEGORIAS["pet"]!, semVariacoes: true, varsMsg: PET_VARS_MSG, detalhesFixos: fixos }
    : tipo === "autopecas" ? { unidades: UNIDADES["autopecas"]!, categorias: CATEGORIAS["autopecas"]!, semVariacoes: true, varsMsg: AUTOPECAS_VARS_MSG, detalhesFixos: fixos }
    : tipo === "roupas" ? { unidades: UNIDADES["roupas"]!, categorias: CATEGORIAS["roupas"]!, detalhesFixos: fixos } // variações continuam obrigatórias
    : undefined;
  const ruleErr = typeRuleError({ unidade, categoria, variacoes: vars, detalhes: det }, rules);
  const dup = !!codeErr;
  const varsOk = vars.length > 0 && vars.every((v, i) => variationOk(v, i, vars, codigo, used));

  /* validações do depósito */
  const unidadeTravada = (configSalva || vendaSalva) && unidade !== initial!.unidade;
  const localTravado = !!initDep?.local && temQtdPositiva(initDep);
  const qtdTravada = configSalva && !isRoupas;
  /* Contar "embalagens fechadas + soltas" no depósito, quando o produto chega em caixa (só antes da contagem confirmada). */
  const caixas = !isRoupas && embModo === "embalagem" ? embs : [];
  const [porCaixa, setPorCaixa] = useState(true);
  const [fechadas, setFechadas] = useState<Record<string, string>>({});
  const [soltas, setSoltas] = useState("");
  const contarCaixa = caixas.length > 0 && porCaixa && !qtdTravada;
  const cont = totalContado(caixas.map((e) => ({ e, fechadas: fechadas[e.uid] ?? "" })), soltas, unidade);
  const q = qtdTravada ? { v: initDep!.qtd, err: "" }
    : contarCaixa ? (cont.err ? { v: null, err: cont.err } : cont.total == null ? parseNum("", unidade, false) : { v: cont.total, err: "" })
    : parseNum(dQtd, unidade, false);
  const mn = parseNum(dMin, unidade, true);
  const mx = parseNum(dMax, unidade, true);
  const limErr = limitesErro(mn.v, mx.v);
  const varsDep = vars.map((v) => {
    const d = dVar[v.uid!] ?? { min: "", max: "" };
    const saved = v.uid ? initDep?.vars?.[v.uid] : undefined;
    const qv = saved ? { v: saved.qtd as number | null, err: "" } : d.qtd === undefined ? { v: null, err: "pendente" } : parseNum(d.qtd, unidade, false);
    const a = parseNum(d.min, unidade, true), b = parseNum(d.max, unidade, true);
    return { v, d, travada: !!saved, q: qv, mn: a, mx: b, lim: limitesErro(a.v, b.v) };
  });
  const pendentes = varsDep.filter((x) => !x.travada && x.d.qtd === undefined);
  const localOk = manterSem || dLocal !== undefined;
  const qtdOk = manterSem || (isRoupas ? varsDep.length > 0 && varsDep.every((x) => !x.q.err) : !q.err);
  const limOk = manterSem || (isRoupas ? varsDep.every((x) => !x.mn.err && !x.mx.err && !x.lim) : !mn.err && !mx.err && !limErr);
  const depBad = !localOk ? { sub: 0, msg: "Escolha um local ou \"Definir depois\"." }
    : !qtdOk ? { sub: 1, msg: pendentes.length ? T("Responda se as quantidades estão no depósito.") : "Corrija a quantidade contada." }
    : !limOk ? { sub: 2, msg: "Corrija os limites marcados em vermelho." } : null;

  /* validações da área de venda */
  const vLocalTravado = !!initVen?.local && temQtdPositiva(initVen);
  const vQtdTravada = vendaSalva && !isRoupas;
  const vq = vQtdTravada ? { v: initVen!.qtd, err: "" } : parseNum(vQtd, unidade, false);
  const vmn = parseNum(vMin, unidade, true);
  const vmx = parseNum(vMax, unidade, true);
  const vLimErr = limitesErro(vmn.v, vmx.v);
  const varsVen = vars.map((v) => {
    const d = vVar[v.uid!] ?? { qtd: "", min: "", max: "" };
    const saved = v.uid ? initVen?.vars?.[v.uid] : undefined;
    const qv = saved ? { v: saved.qtd as number | null, err: "" } : parseNum(d.qtd ?? "", unidade, false);
    const a = parseNum(d.min, unidade, true), b = parseNum(d.max, unidade, true);
    return { v, d, travada: !!saved, q: qv, mn: a, mx: b, lim: limitesErro(a.v, b.v) };
  });
  const vLocalOk = vManter || vLocal !== undefined;
  const vQtdOk = vManter || (isRoupas ? varsVen.length > 0 && varsVen.every((x) => !x.q.err) : !vq.err);
  const vLimOk = vManter || (isRoupas ? varsVen.every((x) => !x.mn.err && !x.mx.err && !x.lim) : !vmn.err && !vmx.err && !vLimErr);
  const venBad = !vLocalOk ? { sub: 0, msg: "Escolha um local de venda ou \"Definir depois\"." }
    : !vQtdOk ? { sub: 1, msg: "Corrija a quantidade contada na área de venda." }
    : !vLimOk ? { sub: 2, msg: "Corrija os limites marcados em vermelho." } : null;

  /* validações da validade: distribui só contagens confirmadas, soma exata em milésimos */
  const valKeys = isRoupas ? vars.map((v) => v.uid!) : [CHAVE_PRODUTO];
  const contagem = (area: "dep" | "ven", k: string): number | null => {
    if (area === "dep") {
      if (manterSem) return null;
      if (k === CHAVE_PRODUTO) return q.err ? null : q.v;
      const x = varsDep.find((y) => y.v.uid === k); return x && !x.q.err ? x.q.v : null;
    }
    if (vManter) return null;
    if (k === CHAVE_PRODUTO) return vq.err ? null : vq.v;
    const x = varsVen.find((y) => y.v.uid === k); return x && !x.q.err ? x.q.v : null;
  };
  const valLinha = (l: LinhaEd) => {
    const qq = parseNum(l.qtd, unidade, false);
    const qErr = qq.err || (qq.v != null && mil(qq.v) <= 0 ? QTD_ZERO : "");
    const dd = l.semData ? { v: null, err: "" } : parseData(l.data);
    const pend = isFarm && (l.semData || !l.lote.trim());
    return { qv: qErr ? null : qq.v, qErr, dv: dd.v, dErr: dd.err, pend, pErr: pend && !l.conf ? PEND_FALTA : "" };
  };
  const grupos = (area: "dep" | "ven") => valKeys.map((k) => {
    const ls = lin[`${area}:${k}`] ?? [];
    const cont = contagem(area, k);
    const vs = ls.map((l) => ({ l, r: valLinha(l) }));
    const soma = cont == null ? null : conferirSoma(cont, vs.map((x) => x.r.qv ?? 0));
    /* pendências já registradas: cada origem preserva exatamente sua quantidade original */
    const originais = Object.fromEntries((initVal?.[area][k] ?? []).filter((l) => !l.data || lotePendente(l, isFarm)).map((l) => [l.id, l.qtd]));
    const quebradas = conferirOrigens(vs.map((x) => ({ origem: x.l.origem, qtd: x.r.qv })), originais).map((o) => {
      const l = initVal![area][k]!.find((y) => y.id === o.id)!;
      return { ...o, msg: origemMsg(`${qtdUn(o.original, unidade)}`, `${qtdUn(o.atual, unidade)}`, l.data ? ` (vence ${fmtData(l.data)})` : l.lote ? ` (lote ${l.lote})` : "") };
    });
    const err = cont == null ? (ls.length ? LINHAS_SEM_CONTAGEM : "")
      : vs.some((x) => x.r.qErr || x.r.dErr || x.r.pErr) ? "Corrija as validades marcadas em vermelho."
      : quebradas.length ? quebradas[0]!.msg : soma!.err;
    return { k, ls, cont, vs, soma, err, quebradas };
  });
  const gDep = grupos("dep"), gVen = grupos("ven");
  const vencidoNaVenda = gVen.some((g) => g.vs.some(({ r }) => !!r.dv && (r.qv ?? 0) > 0 && faixa(r.dv, hoje) === "vencido"));
  const analises = valKeys.map((k) => analisarLotes([...gDep, ...gVen].filter((g) => g.k === k).flatMap((g) => g.vs.map((x) => ({ id: x.l.id, lote: x.l.lote, data: x.r.dv })))));
  const conflitos = analises.flatMap((a) => a.conflitos);
  const sugestoes = analises.flatMap((a) => a.sugestoes);
  const valAtivo = !valManter && vControla === true;
  const valOk0 = valManter || vControla !== undefined;
  const valOk2 = !valAtivo || gDep.every((g) => !g.err);
  const valOk3 = !valAtivo || (gVen.every((g) => !g.err) && !conflitos.length);
  const valBad = !valOk0 ? { sub: 0, msg: "Responda se este produto tem validade." }
    : !valOk2 ? { sub: 2, msg: gDep.find((g) => g.err)!.err }
    : !valOk3 ? { sub: 3, msg: conflitos.length ? conflitoMsg(conflitos[0]!.lote, conflitos[0]!.datas.map(fmtData)) : gVen.find((g) => g.err)!.err } : null;

  const valid = [
    !!codigo.trim() && !dup && !!nome.trim(),
    compra > 0 && venda > 0 && !!unidade && !!categoria && ruleErr?.step !== 1 && !unidadeTravada,
    (!isRoupas || varsOk) && ruleErr?.step !== 2,
    forn !== undefined && !embBad,
    [localOk, qtdOk, limOk][sub]!,
    [vLocalOk, vQtdOk, vLimOk][sub]!,
    [valOk0, true, valOk2, valOk3][sub]!,
    true,
  ][step]!;
  const lucro = venda - compra;
  const prejuizo = compra > 0 && venda > 0 && venda < compra;
  /* Farmácia: preço máximo (PMC) e local de acordo com a tarja. São avisos; não impedem salvar. */
  const avisoPmc = isFarm ? acimaPmcMsg(venda, pmcCentavos(det)) : "";
  const tarjaInfo = isFarm ? localPelaTarja(det["tarja"]) : undefined;
  const avisoLocalTarja = isFarm ? localNaoCombina(det["tarja"], vManter ? null : vLocal) : "";
  const chavePrejuizo = `${compra}-${venda}`;
  const prejuizoConfirmado = prejuizoOk === chavePrejuizo;
  const ganho = ganhoSobreCompra(compra, venda);
  const ganhoTexto = ganho != null && venda > 0 ? mostrarPct(ganho) : "";
  const mudarCompra = (c: number) => {
    setCompra(c);
    const pct = pctDigitado != null ? lerPct(pctDigitado).valor : null;
    if (pct != null && c > 0) setVenda(vendaPorGanho(c, pct));
  };
  const mudarVenda = (v: number) => { setVenda(v); setPctDigitado(null); };
  const mudarPct = (t: string) => {
    const { texto, valor } = lerPct(t);
    setPctDigitado(texto);
    if (valor != null && compra > 0) setVenda(vendaPorGanho(compra, valor));
  };
  const fornNome = forn ? suppliers.find((s) => s.id === forn)?.nome : "Definir depois";

  /** Ao abrir as validades de uma área com contagem positiva, começa com uma linha simples. Nunca cria linha para zero ou sem contagem. */
  const seed = (area: "dep" | "ven") => setLin((m) => {
    const n = { ...m };
    for (const k of valKeys) { const c = contagem(area, k), key = `${area}:${k}`; if (c != null && mil(c) > 0 && !n[key]?.length) n[key] = [novaLinha()]; }
    return n;
  });
  const go = (to: number, s = 0) => {
    setDir(to * 10 + s > step * 10 + sub ? 1 : -1); setStep(to); setSub(s); setSubTried(false);
    if (to === STEP_VAL && s === 0 && !initVal && !valTocado) { const sg = validadeSugerida(tipo, categoria); if (sg !== undefined) setVControla(sg); }
    if (to === STEP_VAL && s === 2) seed("dep");
    if (to === STEP_VAL && s === 3) seed("ven");
  };
  const baseBad = firstInvalidStep({ codigo, nome, compra, venda, unidade, categoria, variacoes: vars, detalhes: det, fornecedor: forn }, isRoupas, used, rules);
  const bad: { step: number; sub?: number; msg: string } | null =
    unidadeTravada ? { step: 1, msg: T(unidadeTravadaMsg(initial!.unidade)) }
    : baseBad ?? (embBad ? { step: 3, msg: EMB_VAZIA } : depBad ? { step: STEP_DEP, sub: depBad.sub, msg: depBad.msg } : venBad ? { step: STEP_VEN, sub: venBad.sub, msg: venBad.msg }
      : valBad ? { step: STEP_VAL, sub: valBad.sub, msg: valBad.msg } : null);
  const hasSub = step === STEP_DEP || step === STEP_VEN || step === STEP_VAL;
  const nSub = step === STEP_VAL ? 4 : 3;
  const total = pulaVal ? TOTAL - 1 : TOTAL;
  const numPasso = pulaVal && step > STEP_VAL ? step : step + 1;
  const here = (b: { step: number; sub?: number }) => b.step === step && (!hasSub || (b.sub ?? 0) === sub);
  const saveErr = triedSave && bad && here(bad) ? bad.msg : ruleErr && ruleErr.step === step ? ruleErr.msg : "";

  const buildDeposito = (): Deposito | undefined => {
    if (manterSem) return undefined;
    if (isRoupas)
      return { local: dLocal ?? null, qtd: null, min: null, max: null,
        vars: Object.fromEntries(varsDep.map((x) => [x.v.uid!, { qtd: x.q.v ?? 0, min: x.mn.v, max: x.mx.v }])) };
    return { local: dLocal ?? null, qtd: q.v, min: mn.v, max: mx.v };
  };
  const buildVenda = (): AreaVenda | undefined => {
    if (vManter) return undefined;
    if (isRoupas)
      return { local: vLocal ?? null, qtd: null, min: null, max: null,
        vars: Object.fromEntries(varsVen.map((x) => [x.v.uid!, { qtd: x.q.v ?? 0, min: x.mn.v, max: x.mx.v }])) };
    return { local: vLocal ?? null, qtd: vq.v, min: vmn.v, max: vmx.v };
  };
  const buildValidade = (): Validade | undefined => {
    if (valManter) return initVal;
    if (!vControla) return { controla: false, avisos: [], dep: {}, ven: {} };
    const area = (gs: typeof gDep) => Object.fromEntries(gs.filter((g) => g.cont != null && g.ls.length).map((g) => [g.k,
      g.vs.map(({ l, r }): LinhaVal => ({ id: l.id, qtd: r.qv ?? 0, data: r.dv, lote: l.lote.trim() || null,
        ...(r.pend ? { pendConf: true } : {}), ...(l.origem && l.origem !== l.id ? { origem: l.origem } : {}) }))]));
    return { controla: true, avisos: [...avisos].sort((a, b) => a - b), dep: area(gDep), ven: area(gVen) };
  };
  const lotesConf = valAtivo ? lotesAConfirmar(initVal, buildValidade(), isFarm) : [];
  const save = () => {
    if (saving) return;
    if (!bad && ((lotesConf.length && !confVenc) || (prejuizo && !prejuizoConfirmado))) { setTriedSave(true); return; }
    if (bad) { setTriedSave(true); setFromReview(true); return go(bad.step, bad.sub ?? 0); }
    onSave({ id: initial?.id ?? Date.now(), codigo: codigo.trim(), nome: nome.trim(), compra, venda, unidade, categoria, detalhes: det, variacoes: vars,
      fornecedor: forn ?? null, deposito: buildDeposito(), areaVenda: buildVenda(), validade: buildValidade(), db: initial?.db,
      embalagens: isRoupas || embModo === "unidade" ? [] : embs,
      ...(lotesConf.length && confVenc ? { confirmarVencimento: true } : {}) });
  };
  const next = () => {
    if (!valid) { if (hasSub) setSubTried(true); return; }
    if (step === STEP_REV) return save();
    if (step === STEP_DEP) {
      if (fromReview && !depBad) { setFromReview(false); return go(STEP_REV); }
      if (manterSem || sub === 2) return go(STEP_VEN);
      return go(STEP_DEP, sub + 1);
    }
    if (step === STEP_VEN) {
      if (fromReview && !venBad) { setFromReview(false); return go(STEP_REV); }
      if (vManter || sub === 2) return go(pulaVal ? STEP_REV : STEP_VAL);
      return go(STEP_VEN, sub + 1);
    }
    if (step === STEP_VAL) {
      if (fromReview && !valBad) { setFromReview(false); return go(STEP_REV); }
      if (sub === 3 || (sub === 0 && !valAtivo)) { setFromReview(false); return go(STEP_REV); }
      return go(STEP_VAL, sub + 1);
    }
    if (fromReview) { setFromReview(false); return go(STEP_REV); }
    go(step + 1);
  };
  const back = () => {
    setFromReview(false);
    if (hasSub && sub > 0) return go(step, sub - 1);
    if (step === STEP_VEN) return go(STEP_DEP, manterSem ? 0 : 2);
    if (step === STEP_VAL) return go(STEP_VEN, vManter ? 0 : 2);
    if (step === STEP_REV) return pulaVal ? go(STEP_VEN, vManter ? 0 : 2) : go(STEP_VAL, valAtivo ? 3 : 0);
    go(step - 1);
  };
  const edit = (s: number, ss = 0) => { setFromReview(true); go(s, ss); };

  const pickLocal = (l: string | null) => {
    if (localTravado && l !== initDep!.local) { setLocalMsg(T(localTravadoMsg(initDep!.local!))); return; }
    setDLocal(l); setManterSem(false); setLocalMsg(""); setNovoLocal(null);
  };
  const listaLocais = dLocal && !localDuplicado(dLocal, locais) ? [...locais, dLocal] : locais;
  const novoDup = novoLocal !== null && !!novoLocal.trim() && localDuplicado(novoLocal, listaLocais);
  const addLocal = () => { if (novoLocal && novoLocal.trim() && !novoDup) pickLocal(novoLocal.trim()); };
  const pickVLocal = (l: string | null) => {
    if (vLocalTravado && l !== initVen!.local) { setVLocalMsg(venLocalTravadoMsg(initVen!.local!)); return; }
    setVLocal(l); setVManter(false); setVLocalMsg(""); setVNovo(null);
  };
  const listaVLocais = vLocal && !localDuplicado(vLocal, locaisV) ? [...locaisV, vLocal] : locaisV;
  const vNovoDup = vNovo !== null && !!vNovo.trim() && localDuplicado(vNovo, listaVLocais);
  const addVLocal = () => { if (vNovo && vNovo.trim() && !vNovoDup) pickVLocal(vNovo.trim()); };
  const setVD = (uid: string, patch: Partial<VarDep>) => setDVar((m) => ({ ...m, [uid]: { ...(m[uid] ?? { min: "", max: "" }), ...patch } }));
  const setVV = (uid: string, patch: Partial<VarDep>) => setVVar((m) => ({ ...m, [uid]: { ...(m[uid] ?? { qtd: "", min: "", max: "" }), ...patch } }));
  const numIn = (s: string) => s.replace(/[^\d,.-]/g, "").slice(0, 12);
  const fr = aceitaFracao(unidade);
  const numProps = { inputMode: fr ? ("decimal" as const) : ("numeric" as const), autoComplete: "off", placeholder: fr ? "Ex.: 12,5" : "Ex.: 40" };
  const showErr = (txt: string, err: string) => (txt.trim() || subTried ? err : "");
  const removeVar = (i: number) => {
    const x = varsDep[i], y = varsVen[i];
    if ((x && (x.q.v ?? 0) > 0) || (y && (y.q.v ?? 0) > 0)) { setVarMsg(T(REMOCAO_BLOQUEADA)); return; }
    setVarMsg("");
    setVars(vars.filter((_, j) => j !== i));
    if (x?.v.uid) {
      const k = x.v.uid; const del = (m: Record<string, VarDep>) => { const n = { ...m }; delete n[k]; return n; }; setDVar(del); setVVar(del);
      setLin((m) => { const n = { ...m }; delete n[`dep:${k}`]; delete n[`ven:${k}`]; return n; }); // configuração de validade sem saldo
    }
  };
  const resumoLocal = T(manterSem ? SEM_CONFIG : dLocal ? dLocal : LOCAL_PENDENTE);
  const resumoQtd = isRoupas
    ? varsDep.map((x) => `${x.v.tam}/${x.v.cor}: ${x.q.v != null ? fmtQ(x.q.v) : "—"}`).join(", ")
    : q.v != null ? `${qtdUn(q.v, unidade)}` : "—";
  const resumoVLocal = vManter ? VEN_SEM_CONFIG : vLocal ? vLocal : VEN_LOCAL_PENDENTE;
  const resumoVQtd = isRoupas
    ? varsVen.map((x) => `${x.v.tam}/${x.v.cor}: ${x.q.v != null && !x.q.err ? fmtQ(x.q.v) : "—"}`).join(", ")
    : vq.v != null && !vq.err ? `${qtdUn(vq.v, unidade)}` : "—";
  const resumoVLim = isRoupas ? varsVen.map((x) => `${x.v.tam}/${x.v.cor}: ${limitesVendaStatus(x.mn.v, x.mx.v)}`).join(" · ") : limitesVendaStatus(vmn.v, vmx.v);
  /* total visual: só com as duas contagens confirmadas; nunca usa a quantidade do cadastro */
  const okQ = (r: { v: number | null; err: string }) => (r.err ? null : r.v);
  const totalLinhas = isRoupas
    ? vars.map((v, i) => `${v.tam} · ${v.cor}: ${T(totalTexto(manterSem ? null : okQ(varsDep[i]!.q), vManter ? null : okQ(varsVen[i]!.q), unidade))}`)
    : [T(totalTexto(manterSem ? null : okQ(q), vManter ? null : okQ(vq), unidade))];
  const resumoLim = isRoupas ? varsDep.map((x) => `${x.v.tam}/${x.v.cor}: ${limitesStatus(x.mn.v, x.mx.v)}`).join(" · ") : limitesStatus(mn.v, mx.v);

  /* ----- validade: edição das linhas ----- */
  const setL = (key: string, id: string, patch: Partial<LinhaEd>) => setLin((m) => ({ ...m, [key]: (m[key] ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const addL = (key: string, b?: Partial<LinhaEd>) => setLin((m) => ({ ...m, [key]: [...(m[key] ?? []), novaLinha(b)] }));
  const delL = (key: string, id: string) => setLin((m) => ({ ...m, [key]: (m[key] ?? []).filter((l) => l.id !== id) }));
  const aplicarSug = (s: { data: string; ids: string[] }) =>
    setLin((m) => Object.fromEntries(Object.entries(m).map(([k, ls]) => [k, ls.map((l) => (s.ids.includes(l.id) ? { ...l, semData: false, data: fmtData(s.data), conf: false } : l))])));
  const varNome = (k: string) => { const v = vars.find((x) => x.uid === k); return v ? `${v.tam} · ${v.cor}` : "variação"; };
  const resumoVal = validadeLinhas(buildValidade(), isFarm, unidade, varNome, hoje, valKeys, contagem).map(T);

  const renderLinha = (key: string, l: LinhaEd, r: ReturnType<typeof valLinha>, i: number) => {
    const f = r.dv ? faixa(r.dv, hoje) : l.semData ? ("desconhecida" as const) : null;
    if (l.ro)
      return (
        <div key={l.id} className={`rounded-xl border p-2.5 text-sm ${f === "vencido" ? "border-destructive/70 bg-destructive/10" : "border-border"}`}>
          <p>{linhaTexto({ id: l.id, qtd: r.qv ?? 0, data: r.dv, lote: l.lote || null, pendConf: l.conf }, unidade, hoje, isFarm)}</p>
          <p className="text-xs text-muted-foreground">Registro confirmado: somente consulta. Correções virão numa etapa futura, com histórico.</p>
          {f === "vencido" && key.startsWith("ven:") && <p role="alert" className="mt-1.5 font-semibold text-destructive">{vencidoAVendaMsg(isFarm)}</p>}
        </div>
      );
    return (
      <div key={l.id} className={`space-y-2 rounded-xl border p-2.5 ${f === "vencido" ? "border-destructive/70 bg-destructive/10" : "border-border"}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground">Validade {i + 1}{l.saved ? " · pendência registrada" : ""}</p>
          {!l.saved && <button type="button" aria-label="Remover validade" onClick={() => delL(key, l.id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"><X size={16} /></button>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={`Quantidade (${unPlural(unidade)})`} name={`lq-${l.id}`} {...numProps} value={l.qtd} onChange={(e) => setL(key, l.id, { qtd: numIn(e.target.value) })} error={showErr(l.qtd, r.qErr)} />
          {l.lockData ? (
            <div><p className="text-sm font-medium text-muted-foreground">Vence em</p><p className="mt-3 text-base">{l.data}</p></div>
          ) : (
            <Field label="Vence em" name={`ld-${l.id}`} inputMode="numeric" autoComplete="off" placeholder="DD/MM/AAAA" disabled={l.semData}
              value={l.semData ? "" : l.data} onChange={(e) => setL(key, l.id, { data: maskData(e.target.value) })} error={l.semData ? "" : showErr(l.data, r.dErr)} />
          )}
        </div>
        {!l.lockData && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={l.semData} onChange={(e) => setL(key, l.id, { semData: e.target.checked, conf: false })} className="h-5 w-5 accent-primary" />
            Validade desconhecida
          </label>
        )}
        {l.lockLote ? <p className="text-sm">Lote: {l.lote}</p> : (
          <Field label={isFarm ? "Lote" : "Lote (opcional)"} name={`ll-${l.id}`} autoComplete="off" placeholder="Ex.: L2345" value={l.lote}
            hint={lotePareceCodigo(l.lote) ? LOTE_PARECE_CODIGO : LOTE_DICA}
            onChange={(e) => setL(key, l.id, { lote: e.target.value.slice(0, 30), conf: false })} />
        )}
        {f && <p className={`text-xs font-semibold ${f === "vencido" ? "text-destructive" : "text-muted-foreground"}`}>{FAIXA_TXT[f]}{f === "vencido" ? " · continua contado no total" : ""}{isFarm && !l.lote.trim() ? " · Lote pendente" : ""}</p>}
        {f === "vencido" && key.startsWith("ven:") && <p role="alert" className="text-sm font-semibold text-destructive">{vencidoAVendaMsg(isFarm)}</p>}
        {r.pend && (l.conf ? (
          <p className="flex items-center gap-2 text-xs font-semibold text-warning">Pendente de conferência
            <button type="button" onClick={() => setL(key, l.id, { conf: false })} className="font-semibold text-primary underline">Desfazer</button></p>
        ) : (
          <div className="space-y-2 rounded-xl border border-border p-2.5 text-xs">
            <p>{PEND_CONF}</p>
            <button type="button" onClick={() => setL(key, l.id, { conf: true })} className={btnGhost}>Registrar como pendente de conferência</button>
            {subTried && <p className="text-destructive">{PEND_FALTA}</p>}
          </div>
        ))}
        {l.saved && (
          <button type="button" onClick={() => addL(key, { origem: l.origem, conf: l.conf, lockData: l.lockData, data: l.lockData ? l.data : "", semData: !l.lockData && l.semData, lockLote: l.lockLote, lote: l.lockLote ? l.lote : "" })}
            className={btnGhost}>Dividir esta pendência</button>
        )}
      </div>
    );
  };
  const renderArea = (area: "dep" | "ven") => {
    const gs = area === "dep" ? gDep : gVen;
    return (
      <>
        <p className="text-sm text-muted-foreground">Divida a contagem {area === "dep" ? `do ${dep}` : "da área de venda"} pelas validades. Isso não cria entrada nem transferência.</p>
        {gs.map((g) => {
          const key = `${area}:${g.k}`;
          const temSalva = g.ls.some((l) => l.saved);
          return (
            <div key={key} className="space-y-2 rounded-2xl border border-border bg-background-deep/60 p-3">
              {isRoupas && <p className="text-sm font-semibold">{varNome(g.k)}</p>}
              {g.cont == null ? <p className="text-sm text-warning">{AGUARDANDO}</p> : (
                <p className="text-sm">Contado: <b>{qtdUn(g.cont, unidade)}</b> · Distribuído: {fmtQ(g.soma!.distribuido)} · Falta distribuir: {fmtQ(g.soma!.falta)}</p>
              )}
              {g.cont != null && mil(g.cont) === 0 && !g.ls.length && <p className="text-xs text-muted-foreground">{SEM_ESTOQUE}</p>}
              {g.vs.map(({ l, r }, i) => renderLinha(key, l, r, i))}
              {g.cont != null && mil(g.cont) > 0 && !temSalva && (
                <button type="button" onClick={() => addL(key)} className="flex min-h-12 w-full items-center gap-2 rounded-2xl border-2 border-dashed border-accent/70 px-4 text-base font-semibold text-accent"><Plus size={18} /> Adicionar outra validade</button>
              )}
              {g.err && (subTried || g.cont == null || g.soma?.err === ACIMA) && <p role="alert" className="text-sm text-destructive">{g.err}</p>}
            </div>
          );
        })}
        {conflitos.map((c) => <p key={c.lote} role="alert" className="text-sm font-semibold text-destructive">{conflitoMsg(c.lote, c.datas.map(fmtData))}</p>)}
        {sugestoes.map((s) => (
          <div key={s.lote} className="space-y-2 rounded-2xl border border-border p-3 text-sm">
            <p>O lote {s.lote} tem vencimento {fmtData(s.data)} em outra linha, e aqui está sem data. Confirme se é a mesma data.</p>
            <button type="button" onClick={() => aplicarSug(s)} className={btnGhost}>Usar {fmtData(s.data)} neste lote</button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Vencido a partir do dia seguinte à data. “Hoje” segue o horário de Brasília ({TZ_PADRAO}).</p>
      </>
    );
  };

  return (
    <div className="relative h-app overflow-hidden bg-app">
      <div className="pointer-events-none absolute inset-0 bg-dots" />
      <main className={`app-top relative flex h-full flex-col items-center overflow-hidden ${kb ? "app-top-kb" : ""}`}>
        <div className="relative flex h-full max-h-full w-full max-w-[480px] flex-col sm:h-auto sm:rounded-3xl sm:border sm:border-border sm:bg-card sm:p-8 sm:backdrop-blur-xl short:sm:p-6">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-muted-foreground">{initial ? "Editar produto" : "Novo produto"} · {store.nome}</p>
            <button type="button" onClick={onCancel} aria-label="Cancelar" className="-mr-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-muted-foreground hover:text-foreground"><X size={22} /></button>
          </div>
          <form noValidate onSubmit={(e) => { e.preventDefault(); next(); }} className="flex min-h-0 flex-1 flex-col">
            <div className="mt-2 shrink-0">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h1 className="min-w-0 text-lg font-bold short:text-base">{T(step === STEP_DEP ? DEP_TITLES[sub]! : step === STEP_VEN ? VEN_TITLES[sub]! : step === STEP_VAL ? VAL_TITLES[sub]! : TITLES[step]!)}</h1>
                <span className="shrink-0 text-xs text-muted-foreground">Passo {numPasso} de {total}{(step === STEP_DEP && !manterSem) || (step === STEP_VEN && !vManter) ? ` · ${sub + 1}/3` : step === STEP_VAL && valAtivo ? ` · ${sub + 1}/4` : ""}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-progress transition-all duration-500" style={{ width: `${((numPasso - 1 + (hasSub ? (sub + 1) / nSub : 1)) / total) * 100}%` }} />
              </div>
            </div>

            <div key={`${step}-${sub}`} data-kb-scroll className={`min-h-0 flex-1 overflow-y-auto overscroll-contain animate-in fade-in duration-300 ${kb ? "mt-2 space-y-2 pb-1 [&_.field-hint]:hidden" : "mt-4 space-y-3 short:mt-3 short:space-y-2.5"} ${dir === 1 ? "slide-in-from-right-8" : "slide-in-from-left-8"}`}>
              {saveErr && step !== STEP_REV && <p role="alert" className="text-sm font-semibold text-destructive">{saveErr}</p>}
              {step === 0 && (
                <>
                  {codeMode === "choose" && !codigo ? (
                    <div className="grid grid-cols-2 gap-3">
                      <BigChoice Icon={ScanLine} label="Escanear código" onClick={() => { setDenied(false); setScan(true); }} />
                      <BigChoice Icon={Keyboard} label="Digitar código" onClick={() => setCodeMode("type")} />
                      {onGerarCodigo && (
                        <button type="button" onClick={criarCodigo} disabled={gerador.gerando}
                          className="col-span-2 flex min-h-13 items-center gap-3 rounded-2xl border border-border bg-background-deep/60 px-4 py-2 text-left text-base font-semibold transition hover:border-primary focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60">
                          <Tag size={22} className="shrink-0 text-primary" />
                          <span>{gerador.gerando ? "Criando código..." : "Não tem código"}
                            <span className="block text-xs font-normal text-muted-foreground">O sistema cria um código só seu.</span></span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <Field label="Código do produto" name="codigo" inputMode="numeric" autoComplete="off" enterKeyHint="next" placeholder="Ex.: 7891234567890"
                      autoFocus={!codigo} onKeyDown={nextOnEnter("pnome")} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\s/g, "").slice(0, 60))}
                      error={codeErr}
                      hint={denied ? "Sem acesso à câmera. Você pode digitar o código." : gerador.criado && codigo === gerador.criado ? CODIGO_CRIADO : ajudaCodigo(codigo, "Os números abaixo do código de barras.")}
                      extra={<button type="button" onClick={() => { setDenied(false); setScan(true); }} className="flex min-h-9 items-center gap-1 text-sm font-semibold text-primary"><ScanLine size={16} /> Escanear</button>} />
                  )}
                  {onGerarCodigo && codeMode === "type" && !codigo.trim() && (
                    <button type="button" onClick={criarCodigo} disabled={gerador.gerando} className="-mt-1 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary disabled:opacity-60">
                      <Tag size={16} /> {gerador.gerando ? "Criando código..." : "Não tem código? Criar um"}
                    </button>
                  )}
                  {gerador.erro && <p role="alert" className="text-sm text-destructive">{gerador.erro}</p>}
                  {denied && codeMode === "choose" && <p className="text-sm text-destructive">Sem acesso à câmera. Você pode digitar o código.</p>}
                  <Field label="Nome do produto" name="pnome" id="pnome" autoComplete="off" enterKeyHint="done" placeholder={`Ex.: ${exemplos(tipo).produto}`}
                    value={nome} onChange={(e) => setNome(e.target.value)} hint="Como aparece na etiqueta e no caixa." />
                </>
              )}

              {step === 1 && (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Preço de compra" name="compra" inputMode="numeric" enterKeyHint="next" onKeyDown={nextOnEnter("venda")}
                      value={compra ? brl2(compra) : ""} placeholder="R$ 0,00" onChange={(e) => mudarCompra(moneyIn(e.target.value))} hint="Quanto você paga." />
                    <Field label="Preço de venda" name="venda" inputMode="numeric" enterKeyHint="done"
                      value={venda ? brl2(venda) : ""} placeholder="R$ 0,00" onChange={(e) => mudarVenda(moneyIn(e.target.value))} hint="Quanto o cliente paga." />
                  </div>
                  {avisoPmc && <p role="alert" className="text-sm font-semibold text-destructive">{avisoPmc}</p>}
                  <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-border bg-background-deep/60 p-3">
                    <div><p className="text-xs text-muted-foreground">Lucro por unidade</p><p className={`text-base font-bold ${lucro < 0 ? "text-destructive" : "text-accent"}`}>{brl2(lucro)}</p></div>
                    <label htmlFor="ganho" className="block min-w-0 cursor-text">
                      <span className="block text-xs text-muted-foreground">Quero ganhar</span>
                      <span className="relative block">
                        <input id="ganho" name="ganho" inputMode="decimal" autoComplete="off" enterKeyHint="done" disabled={compra <= 0}
                          placeholder={compra > 0 ? "Ex.: 30" : "—"} aria-describedby="ganho-dica"
                          value={pctDigitado ?? ganhoTexto} onChange={(e) => mudarPct(e.target.value)}
                          className={`mt-0.5 h-8 w-full rounded-xl border border-border bg-background-deep/60 pl-3 pr-8 text-base font-bold outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60 ${lucro < 0 ? "text-destructive" : "text-accent"}`} />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">%</span>
                      </span>
                    </label>
                    <span id="ganho-dica" className="sr-only">Digite quanto quer ganhar em cima do preço de compra. O preço de venda é calculado sozinho.</span>
                  </div>
                  {compra > 0 && venda > 0 && venda < compra && (
                    <p className="-mt-1 text-xs text-warning">O preço de venda está menor que o de compra. Você terá prejuízo.</p>
                  )}
                  <Chips label="Unidade de medida" hint="Como você vende este produto." opts={UNIDADES[tipo] ?? []} value={unidade}
                    onChange={(u) => { if ((configSalva || vendaSalva) && u !== initial!.unidade) { setUnitMsg(T(unidadeTravadaMsg(initial!.unidade))); return; } setUnitMsg(""); setUnidade(u); }} />
                  {(unitMsg || unidadeTravada) && <p role="alert" className="-mt-1 text-sm text-destructive">{unitMsg || T(unidadeTravadaMsg(initial!.unidade))}</p>}
                  <div className="space-y-1">
                    <label htmlFor="cat" className="text-sm font-medium text-muted-foreground">Categoria</label>
                    <select id="cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}
                      className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40">
                      <option value="">Selecione</option>
                      {(CATEGORIAS[tipo] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <p className="text-xs text-muted-foreground">{ini.categoria && categoria === ini.categoria ? "Igual ao último produto. Pode trocar." : "Ajuda a organizar a lista."}</p>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  {camposDet.map((f, i, arr) =>
                    f.opts ? (
                      <Chips key={f.k} label={f.label} hint={f.hint} opts={f.opts} value={det[f.k] ?? ""} onChange={(v) => setDet({ ...det, [f.k]: v })} />
                    ) : (
                      <Field key={f.k} label={f.label} name={`d-${f.k}`} autoComplete="off" placeholder={f.ph} hint={f.hint}
                        inputMode={f.dinheiro ? "numeric" : undefined} error={f.k === "pmc" ? avisoPmc : ""}
                        enterKeyHint={arr.slice(i + 1).some((x) => !x.opts) ? "next" : "done"}
                        onKeyDown={(() => { const n = arr.slice(i + 1).find((x) => !x.opts); return n ? nextOnEnter(`d-${n.k}`) : undefined; })()}
                        value={det[f.k] ?? ""} onChange={(e) => setDet({ ...det, [f.k]: f.dinheiro ? pmcTexto(e.target.value) : e.target.value })} />
                    ),
                  )}
                  {extrasDet.length > 0 && !maisDet && (
                    <button type="button" onClick={() => setMaisDet(true)} className="flex min-h-12 items-center gap-1.5 text-base font-semibold text-primary">
                      <Plus size={18} /> Mais detalhes (opcional)
                    </button>
                  )}
                  {isRoupas && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Grade de variações</p>
                      <div className="flex flex-wrap gap-2">
                        {vars.map((v, i) => { const bad = !variationOk(v, i, vars, codigo, used); return (
                          <span key={v.uid ?? i} className={`flex items-center gap-1 rounded-full border py-1 pl-1 pr-1 text-sm ${bad ? "border-destructive/70 bg-destructive/10" : "border-accent/50 bg-accent/10"}`}>
                            <button type="button" aria-label="Editar variação" onClick={() => setVarSheet(i)} className="flex min-h-8 items-center gap-1 rounded-full px-2 hover:bg-accent/20">
                              {v.tam} · {v.cor} · {v.codigo || "sem código"} · {v.qtd} <Pencil size={12} />
                            </button>
                            <button type="button" aria-label="Remover variação" onClick={() => removeVar(i)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent/20"><X size={14} /></button>
                          </span>
                        ); })}
                      </div>
                      {varMsg && <p role="alert" className="text-sm text-destructive">{varMsg}</p>}
                      <button type="button" onClick={() => setVarSheet(-1)} className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-dashed border-accent/70 px-4 text-base font-semibold text-accent"><Plus size={18} /> Adicionar variação</button>
                      <p className="text-xs text-muted-foreground">{!vars.length ? "Adicione pelo menos 1 variação." : !varsOk ? <span className="text-destructive">Toque nas variações em vermelho para completar ou corrigir.</span> : "Tamanho, cor, código e quantidade de cada peça."}</p>
                    </div>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <div className="grid grid-cols-1 gap-2">
                    {suppliers.map((s) => (
                      <Pick key={s.id} on={forn === s.id} onClick={() => setForn(s.id)}><Truck size={18} className="shrink-0 text-primary" /><span className="truncate">{s.nome}</span></Pick>
                    ))}
                    <button type="button" onClick={() => setSuppSheet(true)} className="flex min-h-13 items-center gap-2 rounded-2xl border-2 border-dashed border-accent/70 px-4 text-base font-semibold text-accent"><Plus size={18} /> Novo fornecedor</button>
                    <Pick on={forn === null} onClick={() => setForn(null)}><span>Definir depois</span></Pick>
                  </div>
                  <p className="text-xs text-muted-foreground">{ini.fornecedor != null && forn === ini.fornecedor ? "Mesmo fornecedor do último produto. Pode trocar." : "De quem você compra este produto."}</p>
                  {!isRoupas && (
                    <div className="space-y-2 pt-2">
                      <p className="text-sm font-medium text-muted-foreground">Como chega do fornecedor?</p>
                      <div className="grid grid-cols-1 gap-2">
                        <Pick on={embModo === "unidade"} onClick={() => setEmbModo("unidade")}><span>Por unidade, igual vende</span></Pick>
                        <Pick on={embModo === "embalagem"} onClick={() => { setEmbModo("embalagem"); if (!embs.length) setEmbSheet(-1); }}>
                          <Package size={18} className="shrink-0 text-primary" /><span>{rotuloComoChega(tipo)}</span>
                        </Pick>
                      </div>
                      {embModo === "embalagem" && (
                        <div className="space-y-2">
                          {embs.map((e, i) => (
                            <div key={e.uid} className="flex items-center gap-2">
                              <button type="button" onClick={() => setEmbSheet(i)}
                                className="flex min-h-13 min-w-0 flex-1 flex-col justify-center rounded-2xl border border-border bg-background-deep/60 px-4 py-2 text-left hover:border-primary">
                                <span className="truncate text-base font-semibold">{descricaoEmbalagem(e, unidade)}</span>
                                <span className="truncate text-xs text-muted-foreground">{e.codigo ? `Cód. ${e.codigo}` : "Sem código"}{e.preco ? ` · ${brl2(e.preco)} cada ${e.tipo.toLowerCase()}` : ""}</span>
                              </button>
                              <button type="button" aria-label={`Remover ${descricaoEmbalagem(e, unidade)}`} onClick={() => setEmbs(embs.filter((_, j) => j !== i))}
                                className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-border text-muted-foreground hover:text-destructive"><X size={18} /></button>
                            </div>
                          ))}
                          {embs.length < MAX_EMBALAGENS && (
                            <button type="button" onClick={() => setEmbSheet(-1)} className="flex min-h-12 w-full items-center gap-2 rounded-2xl border-2 border-dashed border-accent/70 px-4 text-base font-semibold text-accent">
                              <Plus size={18} /> Adicionar embalagem
                            </button>
                          )}
                          <p className={`text-xs ${embs.length ? "text-muted-foreground" : "text-destructive"}`}>{embs.length ? "Toque na embalagem para mudar. O estoque continua contado em unidades de venda." : EMB_VAZIA}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {step === STEP_DEP && (
                <>
                  <p className="text-xs text-muted-foreground">{TEMPORARIO}</p>

                  {sub === 0 && (
                    <>
                      <div className="grid grid-cols-1 gap-2">
                        {listaLocais.map((l) => (
                          <Pick key={l} on={!manterSem && dLocal === l} onClick={() => pickLocal(l)}><span className="truncate">{l}</span></Pick>
                        ))}
                        {novoLocal === null ? (
                          <button type="button" onClick={() => setNovoLocal("")} className="flex min-h-13 items-center gap-2 rounded-2xl border-2 border-dashed border-accent/70 px-4 text-base font-semibold text-accent"><Plus size={18} /> Novo local</button>
                        ) : (
                          <div className="space-y-2 rounded-2xl border border-border p-3">
                            <Field label="Nome do local" name="dlocal" autoFocus autoComplete="off" enterKeyHint="done" placeholder="Ex.: Estante A · Prateleira 2"
                              value={novoLocal} onChange={(e) => setNovoLocal(e.target.value.slice(0, 60))}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLocal(); } }}
                              error={novoDup ? LOCAL_DUP : ""} hint="Um nome simples. Corredor e nível não são obrigatórios." />
                            {!novoLocal && <LocaisSugeridos opts={LOCAIS_SUGERIDOS[tipo]?.dep ?? []} campo="dlocal" onPick={setNovoLocal} />}
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setNovoLocal(null)} className={`flex-1 ${btnGhost}`}>Cancelar</button>
                              <button type="button" disabled={!novoLocal.trim() || novoDup} onClick={addLocal} className={`flex-1 ${btnPrimary(!!novoLocal.trim() && !novoDup)}`}>Usar este local</button>
                            </div>
                          </div>
                        )}
                        <Pick on={!manterSem && dLocal === null} onClick={() => pickLocal(null)}><span>Definir depois</span></Pick>
                        {initial && !initDep && (
                          <Pick on={manterSem} onClick={() => { setManterSem(true); setLocalMsg(""); }}><span>Manter sem configurar por enquanto</span></Pick>
                        )}
                      </div>
                      {localMsg && <p role="alert" className="text-sm text-destructive">{localMsg}</p>}
                      <p className="text-xs text-muted-foreground">{isRoupas ? "Um local para o produto. Vale para todas as variações." : "Um local para o produto inteiro."}</p>
                      {!manterSem && dLocal === null && <p className="text-xs text-warning">{T(LOCAL_PENDENTE)}</p>}
                    </>
                  )}

                  {sub === 1 && !isRoupas && (
                    <>
                      {qtdTravada ? (
                        <div className="rounded-2xl border border-border bg-background-deep/60 p-3 text-sm">
                          <p>Quantidade confirmada no {dep}: <b>{q.v != null ? `${qtdUn(q.v, unidade)}` : "—"}</b></p>
                          <p className="mt-1 text-xs text-muted-foreground">Alterar a contagem ficará para uma etapa futura.</p>
                        </div>
                      ) : (
                        <>
                          {caixas.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              <Pick on={porCaixa} onClick={() => setPorCaixa(true)}><span className="text-sm">{rotuloContarPor(caixas)}</span></Pick>
                              <Pick on={!porCaixa} onClick={() => { if (cont.total != null) setDQtd(toInput(cont.total)); setPorCaixa(false); }}><span className="text-sm">Digitar o total</span></Pick>
                            </div>
                          )}
                          {contarCaixa ? (
                            <>
                              {caixas.map((e) => (
                                <Field key={e.uid} label={rotuloFechadas(e, unidade)} name={`fc-${e.uid}`} inputMode="numeric" autoComplete="off" placeholder="0"
                                  value={fechadas[e.uid] ?? ""} onChange={(ev) => setFechadas({ ...fechadas, [e.uid]: ev.target.value.replace(/[^\d,.-]/g, "").slice(0, 6) })} />
                              ))}
                              <Field label={rotuloSoltas(unidade)} name="soltas" {...numProps} placeholder="0" enterKeyHint="done"
                                value={soltas} onChange={(ev) => setSoltas(numIn(ev.target.value))} />
                              <div className="rounded-2xl border border-border bg-background-deep/60 p-3 text-sm">
                                Total no {dep}: <b>{cont.total != null ? qtdUn(cont.total, unidade) : "—"}</b>
                              </div>
                              {(cont.err || (subTried && q.err)) && <p role="alert" className="text-sm text-destructive">{cont.err || q.err}</p>}
                            </>
                          ) : (
                            <Field label={`Quanto você contou no ${dep} agora? (${unPlural(unidade)})`} name="dqtd" {...numProps} enterKeyHint="done"
                              value={dQtd} onChange={(e) => setDQtd(numIn(e.target.value))} error={showErr(dQtd, q.err)}
                              hint={fr ? "Aceita vírgula. Ex.: 12,5" : "Somente números inteiros."} />
                          )}
                        </>
                      )}
                      <p className="text-xs text-muted-foreground">Não é o peso ou volume da embalagem. É quanto você tem guardado. Se não houver nenhuma, digite 0.</p>
                    </>
                  )}

                  {sub === 1 && isRoupas && (
                    <>
                      {pendentes.length > 0 && (
                        <div className="space-y-2 rounded-2xl border border-accent/50 bg-accent/10 p-3">
                          <p className="text-base font-semibold">Essas quantidades estão no {dep}?</p>
                          {pendentes.map((x) => (
                            <p key={x.v.uid} className="text-sm">{x.v.tam} · {x.v.cor} · Quantidade informada no cadastro: {qtdUn(x.v.qtd, unidade)}</p>
                          ))}
                          <div className="flex flex-col gap-2">
                            <button type="button" onClick={() => setDVar((m) => { const n = { ...m }; for (const x of pendentes) n[x.v.uid!] = { ...(n[x.v.uid!] ?? { min: "", max: "" }), qtd: String(x.v.qtd) }; return n; })}
                              className={btnPrimary(true)}>Sim, estão no {dep}</button>
                            <button type="button" onClick={() => setDVar((m) => { const n = { ...m }; for (const x of pendentes) n[x.v.uid!] = { ...(n[x.v.uid!] ?? { min: "", max: "" }), qtd: "" }; return n; })}
                              className={btnGhost}>Não, vou contar o {dep}</button>
                          </div>
                        </div>
                      )}
                      {varsDep.filter((x) => x.travada || x.d.qtd !== undefined).map((x) => (
                        <div key={x.v.uid} className="space-y-1.5 rounded-2xl border border-border bg-background-deep/60 p-3">
                          <p className="text-sm font-semibold">{x.v.tam} · {x.v.cor}</p>
                          <p className="text-xs text-muted-foreground">Quantidade informada no cadastro: {x.v.qtd}</p>
                          {x.travada ? (
                            <>
                              <p className="text-sm">Quantidade confirmada no {dep}: <b>{qtdUn(x.q.v ?? 0, unidade)}</b></p>
                              <p className="text-xs text-muted-foreground">Alterar a contagem ficará para uma etapa futura.</p>
                            </>
                          ) : (
                            <Field label={`Quantidade confirmada no ${dep} (${unPlural(unidade)})`} name={`dq-${x.v.uid}`} {...numProps} placeholder="Ex.: 10"
                              value={x.d.qtd ?? ""} onChange={(e) => setVD(x.v.uid!, { qtd: numIn(e.target.value) })} error={showErr(x.d.qtd ?? "", x.q.err)} />
                          )}
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">Não é o peso da peça. É quanto você tem guardado. Zero é aceito.</p>
                    </>
                  )}

                  {sub === 2 && !isRoupas && (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <Field label={`Mínimo (${unPlural(unidade)})`} name="dmin" {...numProps} enterKeyHint="next" onKeyDown={nextOnEnter("dmax")} placeholder="Opcional"
                          value={dMin} onChange={(e) => setDMin(numIn(e.target.value))} error={mn.err} />
                        <Field label={`Máximo desejado (${unPlural(unidade)})`} name="dmax" id="dmax" {...numProps} enterKeyHint="done" placeholder="Opcional"
                          value={dMax} onChange={(e) => setDMax(numIn(e.target.value))} error={mx.err || limErr} />
                      </div>
                      <p className="text-sm text-muted-foreground">{limitesStatus(mn.v, mx.v)}</p>
                      {q.v != null && mx.v != null && q.v > mx.v && <p className="text-sm text-warning">{ACIMA_MAX}</p>}
                      <LimitesAjuda dep={dep} />
                    </>
                  )}

                  {sub === 2 && isRoupas && (
                    <>
                      {varsDep.length > 1 && (
                        <button type="button" onClick={() => { const f = varsDep[0]!; setDVar((m) => { const n = { ...m }; for (const x of varsDep) n[x.v.uid!] = { ...(n[x.v.uid!] ?? {}), min: f.d.min, max: f.d.max }; return n; }); }}
                          className={btnGhost}>Usar os mesmos limites para todas</button>
                      )}
                      {varsDep.length > 1 && <p className="-mt-1 text-xs text-muted-foreground">Copia os limites de {varsDep[0]!.v.tam} · {varsDep[0]!.v.cor} para as demais.</p>}
                      {varsDep.map((x) => (
                        <div key={x.v.uid} className="space-y-1.5 rounded-2xl border border-border bg-background-deep/60 p-3">
                          <p className="text-sm font-semibold">{x.v.tam} · {x.v.cor}</p>
                          <div className="grid grid-cols-2 gap-2.5">
                            <Field label="Mínimo" name={`dmin-${x.v.uid}`} {...numProps} placeholder="Opcional" value={x.d.min} onChange={(e) => setVD(x.v.uid!, { min: numIn(e.target.value) })} error={x.mn.err} />
                            <Field label="Máximo desejado" name={`dmax-${x.v.uid}`} {...numProps} placeholder="Opcional" value={x.d.max} onChange={(e) => setVD(x.v.uid!, { max: numIn(e.target.value) })} error={x.mx.err || x.lim} />
                          </div>
                          <p className="text-xs text-muted-foreground">{limitesStatus(x.mn.v, x.mx.v)}</p>
                          {x.q.v != null && x.mx.v != null && x.q.v > x.mx.v && <p className="text-xs text-warning">{ACIMA_MAX}</p>}
                        </div>
                      ))}
                      <LimitesAjuda dep={dep} />
                    </>
                  )}
                </>
              )}

              {step === STEP_VEN && (
                <>
                  <p className="text-xs text-muted-foreground">{TEMPORARIO} {SEM_REPOSICAO}</p>

                  {sub === 0 && (
                    <>
                      <p className="text-base font-semibold">Onde este produto fica para venda?</p>
                      {tarjaInfo && <p className="rounded-2xl border border-accent/50 bg-accent/10 p-3 text-sm">{tarjaInfo.motivo}</p>}
                      {avisoLocalTarja && <p role="alert" className="text-sm font-semibold text-destructive">{avisoLocalTarja}</p>}
                      <div className="grid grid-cols-1 gap-2">
                        {listaVLocais.map((l) => (
                          <Pick key={l} on={!vManter && vLocal === l} onClick={() => pickVLocal(l)}><span className="truncate">{l}</span></Pick>
                        ))}
                        {vNovo === null ? (
                          <button type="button" onClick={() => setVNovo("")} className="flex min-h-13 items-center gap-2 rounded-2xl border-2 border-dashed border-accent/70 px-4 text-base font-semibold text-accent"><Plus size={18} /> Novo local de venda</button>
                        ) : (
                          <div className="space-y-2 rounded-2xl border border-border p-3">
                            <Field label="Nome do local de venda" name="vlocal" autoFocus autoComplete="off" enterKeyHint="done" placeholder={`Ex.: ${EXEMPLO_LOCAL[tipo] ?? "Gôndola 3 · Prateleira 2"}`}
                              value={vNovo} onChange={(e) => setVNovo(e.target.value.slice(0, 60))}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVLocal(); } }}
                              error={vNovoDup ? VEN_LOCAL_DUP : ""} hint="Um nome simples. Corredor e nível não são obrigatórios." />
                            {!vNovo && <LocaisSugeridos opts={primeiro(LOCAIS_SUGERIDOS[tipo]?.ven ?? [], tarjaInfo?.local)} campo="vlocal" onPick={setVNovo} />}
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setVNovo(null)} className={`flex-1 ${btnGhost}`}>Cancelar</button>
                              <button type="button" disabled={!vNovo.trim() || vNovoDup} onClick={addVLocal} className={`flex-1 ${btnPrimary(!!vNovo.trim() && !vNovoDup)}`}>Usar este local de venda</button>
                            </div>
                          </div>
                        )}
                        <Pick on={!vManter && vLocal === null} onClick={() => pickVLocal(null)}><span>Definir depois</span></Pick>
                        {initial && !initVen && (
                          <Pick on={vManter} onClick={() => { setVManter(true); setVLocalMsg(""); }}><span>Manter sem configurar por enquanto</span></Pick>
                        )}
                      </div>
                      {vLocalMsg && <p role="alert" className="text-sm text-destructive">{vLocalMsg}</p>}
                      <p className="text-xs text-muted-foreground">{isRoupas ? "Um local de venda para o produto. Vale para todas as variações." : "Um local de venda para o produto inteiro."} Os locais de venda são separados dos locais do {dep}.</p>
                      {!vManter && vLocal === null && <p className="text-xs text-warning">{VEN_LOCAL_PENDENTE}</p>}
                    </>
                  )}

                  {sub === 1 && !isRoupas && (
                    <>
                      {vQtdTravada ? (
                        <div className="rounded-2xl border border-border bg-background-deep/60 p-3 text-sm">
                          <p>Quantidade confirmada na área de venda: <b>{vq.v != null ? `${qtdUn(vq.v, unidade)}` : "—"}</b></p>
                          <p className="mt-1 text-xs text-muted-foreground">Alterar a contagem ficará para uma etapa futura.</p>
                        </div>
                      ) : (
                        <Field label={`Quanto deste produto já está neste local? (${unPlural(unidade)})`} name="vqtd" {...numProps} enterKeyHint="done"
                          value={vQtd} onChange={(e) => setVQtd(numIn(e.target.value))} error={showErr(vQtd, vq.err)}
                          hint={fr ? "Aceita vírgula. Ex.: 12,5" : "Somente números inteiros."} />
                      )}
                      <p className="text-xs text-muted-foreground">Conte só o que está exposto para venda. É separado do {dep} e não é uma transferência. Se não houver nenhuma, digite 0.</p>
                      <p className="rounded-2xl border border-border bg-background-deep/60 p-3 text-sm">{totalLinhas[0]}</p>
                    </>
                  )}

                  {sub === 1 && isRoupas && (
                    <>
                      {varsVen.map((x, i) => (
                        <div key={x.v.uid} className="space-y-1.5 rounded-2xl border border-border bg-background-deep/60 p-3">
                          <p className="text-sm font-semibold">{x.v.tam} · {x.v.cor}</p>
                          {x.travada ? (
                            <>
                              <p className="text-sm">Quantidade confirmada na área de venda: <b>{qtdUn(x.q.v ?? 0, unidade)}</b></p>
                              <p className="text-xs text-muted-foreground">Alterar a contagem ficará para uma etapa futura.</p>
                            </>
                          ) : (
                            <Field label={`Quanto desta variação já está neste local? (${unPlural(unidade)})`} name={`vq-${x.v.uid}`} {...numProps} placeholder="Ex.: 3"
                              value={x.d.qtd ?? ""} onChange={(e) => setVV(x.v.uid!, { qtd: numIn(e.target.value) })} error={showErr(x.d.qtd ?? "", x.q.err)} />
                          )}
                          <p className="text-xs text-muted-foreground">{totalLinhas[i]}</p>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">Conte cada tamanho e cor. A quantidade do cadastro não é copiada. Zero é aceito.</p>
                    </>
                  )}

                  {sub === 2 && !isRoupas && (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <Field label={`Mínimo (${unPlural(unidade)})`} name="vmin" {...numProps} enterKeyHint="next" onKeyDown={nextOnEnter("vmax")} placeholder="Opcional"
                          value={vMin} onChange={(e) => setVMin(numIn(e.target.value))} error={vmn.err} />
                        <Field label={`Máximo que cabe (${unPlural(unidade)})`} name="vmax" id="vmax" {...numProps} enterKeyHint="done" placeholder="Opcional"
                          value={vMax} onChange={(e) => setVMax(numIn(e.target.value))} error={vmx.err || vLimErr} />
                      </div>
                      <p className="text-sm text-muted-foreground">{limitesVendaStatus(vmn.v, vmx.v)}</p>
                      {vq.v != null && vmx.v != null && vq.v > vmx.v && <p className="text-sm text-warning">{VEN_ACIMA_MAX}</p>}
                      <LimitesVendaAjuda />
                    </>
                  )}

                  {sub === 2 && isRoupas && (
                    <>
                      {varsVen.length > 1 && (
                        <button type="button" onClick={() => { const f = varsVen[0]!; setVVar((m) => { const n = { ...m }; for (const x of varsVen) n[x.v.uid!] = { ...(n[x.v.uid!] ?? { qtd: "" }), min: f.d.min, max: f.d.max }; return n; }); }}
                          className={btnGhost}>Usar os mesmos limites para todas</button>
                      )}
                      {varsVen.length > 1 && <p className="-mt-1 text-xs text-muted-foreground">Copia os limites de {varsVen[0]!.v.tam} · {varsVen[0]!.v.cor} para as demais.</p>}
                      {varsVen.map((x) => (
                        <div key={x.v.uid} className="space-y-1.5 rounded-2xl border border-border bg-background-deep/60 p-3">
                          <p className="text-sm font-semibold">{x.v.tam} · {x.v.cor}</p>
                          <div className="grid grid-cols-2 gap-2.5">
                            <Field label="Mínimo" name={`vmin-${x.v.uid}`} {...numProps} placeholder="Opcional" value={x.d.min} onChange={(e) => setVV(x.v.uid!, { min: numIn(e.target.value) })} error={x.mn.err} />
                            <Field label="Máximo que cabe" name={`vmax-${x.v.uid}`} {...numProps} placeholder="Opcional" value={x.d.max} onChange={(e) => setVV(x.v.uid!, { max: numIn(e.target.value) })} error={x.mx.err || x.lim} />
                          </div>
                          <p className="text-xs text-muted-foreground">{limitesVendaStatus(x.mn.v, x.mx.v)}</p>
                          {x.q.v != null && x.mx.v != null && x.q.v > x.mx.v && <p className="text-xs text-warning">{VEN_ACIMA_MAX}</p>}
                        </div>
                      ))}
                      <LimitesVendaAjuda />
                    </>
                  )}
                </>
              )}

              {step === STEP_VAL && (
                <>
                  <p className="text-xs text-muted-foreground">{TEMPORARIO}</p>
                  {sub === 0 && (
                    <>
                      <p className="text-base font-semibold">Este produto tem validade?</p>
                      {isFarm ? (
                        <div className="rounded-2xl border border-accent/50 bg-accent/10 p-3 text-sm">
                          <p className="font-semibold">Sim</p>
                          <p className="text-xs text-muted-foreground">Na farmácia o controle de validade é obrigatório.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Pick on={!valManter && vControla === true} onClick={() => { setVControla(true); setValTocado(true); setValManter(false); setValMsg(""); }}><span>Sim</span></Pick>
                          <Pick on={!valManter && vControla === false} onClick={() => { if (desligarBloq) { setValMsg(DESLIGAR_BLOQ); return; } setVControla(false); setValTocado(true); setValManter(false); setValMsg(""); }}><span>Não</span></Pick>
                        </div>
                      )}
                      {initial && !initVal && (
                        <div className="grid grid-cols-1 gap-2">
                          {isFarm && <Pick on={!valManter} onClick={() => setValManter(false)}><span>Configurar validade agora</span></Pick>}
                          <Pick on={valManter} onClick={() => { setValManter(true); setValMsg(""); }}><span>Manter sem configurar por enquanto</span></Pick>
                        </div>
                      )}
                      {valManter && <p className="text-xs text-warning">{isFarm ? VAL_FARM_INCOMPLETA : VAL_SEM_CONFIG}</p>}
                      {valMsg && <p role="alert" className="text-sm text-destructive">{valMsg}</p>}
                      {!isFarm && !initVal && !valTocado && !valManter && vControla !== undefined && validadeSugerida(tipo, categoria) === vControla ? (
                        <p className="text-sm text-accent">{sugestaoValidadeMsg(vControla, categoria)}</p>
                      ) : !isFarm && <p className="text-xs text-muted-foreground">Escolha “Não” para produtos que não vencem.</p>}
                    </>
                  )}
                  {sub === 1 && (
                    <>
                      <p className="text-base font-semibold">Quando você quer ser avisado?</p>
                      <div className="grid grid-cols-3 gap-2">
                        {AVISOS.map((d) => (
                          <Pick key={d} on={avisos.includes(d)} onClick={() => setAvisos((a) => (a.includes(d) ? a.filter((x) => x !== d) : [...a, d]))}><span>{d} dias</span></Pick>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">{avisosTexto(avisos)}</p>
                      <p className="text-sm text-warning">{SEM_AVISOS}</p>
                      <p className="text-xs text-muted-foreground">Pode marcar vários ou nenhum. A situação de cada validade (vencido, vence hoje, próximos dias) aparece mesmo sem aviso.</p>
                    </>
                  )}
                  {sub === 2 && renderArea("dep")}
                  {sub === 3 && renderArea("ven")}
                </>
              )}

              {step === STEP_REV && (
                <div className="divide-y divide-border rounded-2xl border border-border bg-background-deep/60">
                  <Sum t="Código e nome" onEdit={() => edit(0)}>{nome}<br />Cód. {codigo}</Sum>
                  <Sum t="Preços" onEdit={() => edit(1)}>{brl2(compra)} → {brl2(venda)} / {unidade}<br />{categoria}{ganho != null && ganhoTexto ? (ganho < 0 ? ` · prejuízo de ${mostrarPct(-ganho)}% sobre a compra` : ` · ganho de ${ganhoTexto}% sobre a compra`) : ""}
                    {avisoPmc && <span role="alert" className="block font-semibold text-destructive">{avisoPmc}</span>}</Sum>
                  <Sum t="Detalhes" onEdit={() => edit(2)}>
                    {Object.entries(det).filter(([, v]) => v).map(([k, v]) => `${labelOf(tipo, k)}: ${v}`).join(" · ") || (vars.length ? "" : "Nenhum")}
                    {vars.length > 0 && <><br />{vars.map((v) => `${v.tam}/${v.cor}/Cód. ${v.codigo || "—"}/${v.qtd}`).join(", ")}</>}
                  </Sum>
                  <Sum t="Fornecedor" onEdit={() => edit(3)}>{fornNome}</Sum>
                  {!isRoupas && <Sum t="Como chega" onEdit={() => edit(3)}>{embModo === "unidade" || !embs.length ? "Por unidade" : embs.map((e) => descricaoEmbalagem(e, unidade)).join(" · ")}</Sum>}
                  {manterSem ? (
                    <Sum t={T("Depósito")} onEdit={() => edit(STEP_DEP, 0)}>{T(SEM_CONFIG)}</Sum>
                  ) : (
                    <>
                      <Sum t="Local" onEdit={() => edit(STEP_DEP, 0)}>{resumoLocal}</Sum>
                      <Sum t={T("Quantidade no depósito")} onEdit={() => edit(STEP_DEP, 1)}>{resumoQtd}</Sum>
                      <Sum t="Limites" onEdit={() => edit(STEP_DEP, 2)}>{resumoLim}</Sum>
                    </>
                  )}
                  {vManter ? (
                    <Sum t="Área de venda" onEdit={() => edit(STEP_VEN, 0)}>{VEN_SEM_CONFIG}</Sum>
                  ) : (
                    <>
                      <Sum t="Local de venda" onEdit={() => edit(STEP_VEN, 0)}>{resumoVLocal}
                        {avisoLocalTarja && <span role="alert" className="block font-semibold text-destructive">{avisoLocalTarja}</span>}</Sum>
                      <Sum t="Quantidade na área de venda" onEdit={() => edit(STEP_VEN, 1)}>{resumoVQtd}</Sum>
                      <Sum t="Limites da área de venda" onEdit={() => edit(STEP_VEN, 2)}>{resumoVLim}</Sum>
                    </>
                  )}
                  <div className="p-3.5 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total para conferência</p>
                    {totalLinhas.map((t, i) => <p key={i} className="mt-0.5">{t}</p>)}
                  </div>
                  {!pulaVal && <Sum t="Validade" onEdit={() => edit(STEP_VAL, 0)}>{resumoVal[0]}</Sum>}
                  {valAtivo && (
                    <>
                      <Sum t="Avisos" onEdit={() => edit(STEP_VAL, 1)}>{avisosTexto(avisos)}<br />{SEM_AVISOS}</Sum>
                      <Sum t="Validades por área" onEdit={() => edit(STEP_VAL, 2)}>{resumoVal.slice(3).map((t, i) => <span key={i} className={`block ${/^Vencidos/.test(t) ? "font-semibold text-destructive" : ""}`}>{t}</span>)}
                        {vencidoNaVenda && <span role="alert" className="block font-semibold text-destructive">{vencidoAVendaMsg(isFarm)}</span>}</Sum>
                    </>
                  )}
                  <p className="p-3.5 text-xs text-muted-foreground">{TEMPORARIO} {SEM_REPOSICAO}</p>
                </div>
              )}
            </div>

            {step === STEP_REV && lotesConf.length > 0 && (
              <label className="flex shrink-0 items-start gap-3 pt-3 text-sm">
                <input type="checkbox" className="mt-1 h-5 w-5" checked={confVenc} onChange={(e) => setConfVenc(e.target.checked)} />
                <span>Confirmo o vencimento informado para o lote {lotesConf.filter(Boolean).join(", ")}. Depois de salvo, ele não poderá ser trocado.</span>
              </label>
            )}
            {step === STEP_REV && triedSave && lotesConf.length > 0 && !confVenc && <p role="alert" className="shrink-0 pt-2 text-sm font-semibold text-destructive">Confirme o vencimento do lote para salvar.</p>}
            {step === STEP_REV && prejuizo && (
              <label className="mt-3 flex min-h-12 shrink-0 items-start gap-3 rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={prejuizoConfirmado} onChange={(e) => setPrejuizoOk(e.target.checked ? chavePrejuizo : null)} />
                <span>Vender com prejuízo: compra {brl2(compra)} e venda {brl2(venda)}. Você perde <b>{brl2(compra - venda)}</b> em cada {qtdUn(1, unidade).replace(/^1 /, "")}. Confirmo que está certo.</span>
              </label>
            )}
            {step === STEP_REV && triedSave && prejuizo && !prejuizoConfirmado && <p role="alert" className="shrink-0 pt-2 text-sm font-semibold text-destructive">Confirme o prejuízo para salvar, ou volte e ajuste o preço de venda.</p>}
            {erro && step === STEP_REV && <p role="alert" className="shrink-0 pt-3 text-sm font-semibold text-destructive">{erro}</p>}
            <div className={`flex shrink-0 gap-2 ${kb ? "pt-2" : "pt-4 short:pt-3"}`}>
              {step > 0 && (
                <button type="button" onClick={back} className={btnGhost}><span className="flex items-center gap-1.5"><ArrowLeft size={18} />Voltar</span></button>
              )}
              {step === 2 && !isRoupas && !Object.values(det).some(Boolean) ? (
                <button type="submit" className={`flex-1 ${btnPrimary(true)}`}>Pular</button>
              ) : (
                <button type="submit" disabled={!valid || (step === STEP_REV && saving)} className={`flex-1 ${btnPrimary(valid && !(step === STEP_REV && saving))}`}>{step === STEP_REV ? (saving ? "Salvando…" : "Salvar produto") : "Continuar"}</button>
              )}
            </div>
          </form>
        </div>
      </main>

      {scan && (
        <Scanner onClose={() => setScan(false)} onType={() => { setScan(false); setCodeMode("type"); }}
          onDenied={() => { setScan(false); setDenied(true); setCodeMode("type"); }}
          onCode={(c) => { setScan(false); setCodigo(c); setCodeMode("type"); setTimeout(() => document.getElementById("pnome")?.focus(), 80); }} />
      )}
      {varSheet !== null && <VariationSheet index={varSheet} vars={vars} categoria={categoria} mainCode={codigo} used={used} onGerarCodigo={onGerarCodigo} onClose={() => setVarSheet(null)}
        onSave={(v) => {
          const uid = varSheet < 0 ? newUid() : vars[varSheet]?.uid ?? newUid();
          const nv = { ...v, uid };
          setVars(varSheet < 0 ? [...vars, nv] : vars.map((x, j) => (j === varSheet ? nv : x)));
          setVarSheet(null);
        }} />}
      {embSheet !== null && <EmbalagemSheet tipoComercio={tipo} index={embSheet} lista={embs} unidade={unidade} codigoProduto={codigo} usados={used} compra={compra}
        onGerarCodigo={onGerarCodigo} onClose={() => setEmbSheet(null)}
        onSave={(e, novaCompra) => {
          const uid = embSheet < 0 ? newUid() : embs[embSheet]?.uid ?? newUid();
          const ne = { ...e, uid };
          setEmbs(embSheet < 0 ? [...embs, ne] : embs.map((x, j) => (j === embSheet ? ne : x)));
          if (novaCompra != null) mudarCompra(novaCompra);
          setEmbSheet(null);
        }} />}
      {suppSheet && <SupplierSheet tipo={tipo} onClose={() => setSuppSheet(false)} onSave={(s) => {
        const r = onAddSupplier(s);
        if (typeof r === "number") { setForn(r); setSuppSheet(false); return; }
        return r.then((id) => { setForn(id); setSuppSheet(false); });
      }} />}
    </div>
  );
}

function LimitesVendaAjuda() {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p><b>Mínimo:</b> quando chegar a esta quantidade, será necessário repor.</p>
      <p><b>Máximo:</b> quanto deste produto cabe neste local.</p>
      <p>Valem para este produto neste local, não para o local inteiro. A reposição automática depende de local, quantidade e mínimo definidos — e não funciona nesta versão.</p>
    </div>
  );
}
/** Põe a sugestão (ex.: o local pela tarja) no começo da lista. */
const primeiro = (l: string[], x?: string) => (x ? [x, ...l.filter((o) => o !== x)] : l);
/** Atalhos para o nome do local: um toque preenche o começo e o comerciante completa ("Gôndola 3"). */
function LocaisSugeridos({ opts, campo, onPick }: { opts: string[]; campo: string; onPick: (v: string) => void }) {
  if (!opts.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Toque para começar:</p>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((o) => (
          <button key={o} type="button" onClick={() => { onPick(`${o} `); setTimeout(() => document.getElementById(campo)?.focus(), 60); }}
            className="min-h-11 rounded-2xl border border-border bg-background-deep/60 px-3 text-sm font-semibold text-muted-foreground hover:border-primary">{o}</button>
        ))}
      </div>
    </div>
  );
}
function LimitesAjuda({ dep }: { dep: string }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p><b>Mínimo:</b> avise quando a quantidade chegar a este valor. Será a referência para aviso de compra — nenhum alerta funciona nesta versão.</p>
      <p><b>Máximo desejado:</b> quanto você deseja manter no {dep}. Não bloqueia recebimentos.</p>
    </div>
  );
}

/** Ajuda do campo de código: o aviso de "parece digitado errado" tem prioridade sobre o texto normal. */
const ajudaCodigo = (codigo: string, normal: ReactNode): ReactNode => {
  const a = avisoCodigo(codigo);
  return a ? <span className="text-warning">{a}</span> : normal;
};

export const CODIGO_CRIADO = "Código criado pelo sistema para este produto.";
export const CODIGO_ERRO = "Não foi possível criar o código. Verifique sua internet e tente de novo.";

/** Pede um código interno ao banco; lembra o último criado para mostrar o aviso. */
function useGerarCodigo(gerarNoBanco: (() => Promise<string>) | undefined) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [criado, setCriado] = useState<string | null>(null);
  const gerar = async (usar: (codigo: string) => void) => {
    if (!gerarNoBanco || gerando) return;
    setGerando(true); setErro("");
    try { const c = await gerarNoBanco(); setCriado(c); usar(c); }
    catch { setErro(CODIGO_ERRO); }
    finally { setGerando(false); }
  };
  return { gerar, gerando, erro, criado };
}

function BigChoice({ Icon, label, onClick }: { Icon: typeof ScanLine; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background-deep/60 p-3 text-base font-semibold transition hover:border-primary focus-visible:outline-2 focus-visible:outline-ring short:min-h-[96px]">
      <Icon size={32} className="text-primary" /> {label}
    </button>
  );
}
function Pick({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`flex min-h-13 items-center gap-3 rounded-2xl border px-4 text-left text-base font-semibold transition ${on ? "border-accent bg-accent/10" : "border-border bg-background-deep/60 hover:border-primary"}`}>
      {children}
      {on && <Check size={18} className="ml-auto shrink-0 text-accent" />}
    </button>
  );
}
/** Tamanho em dois toques: primeiro o tipo (Letras, Números...), depois o tamanho. */
function TamanhoPicker({ value, onChange, categoria, ultimo }: { value: string; onChange: (v: string) => void; categoria: string; ultimo?: string | undefined }) {
  const [gid, setGid] = useState(() => grupoInicial(value, categoria, ultimo));
  const g = GRUPOS_TAMANHO.find((x) => x.id === gid) ?? GRUPOS_TAMANHO[0]!;
  const trocar = (nome: string) => {
    const novo = GRUPOS_TAMANHO.find((x) => x.nome === nome)!;
    setGid(novo.id);
    if (novo.id === "unico") onChange(UNICO);
    else if (!novo.tamanhos.includes(value)) onChange("");
  };
  return (
    <>
      <Chips label="Tipo de tamanho" hint={g.dica} opts={GRUPOS_TAMANHO.map((x) => x.nome)} value={g.nome} onChange={trocar} />
      {g.id === "unico" ? (
        <p className="rounded-2xl border border-accent/50 bg-accent/10 px-3.5 py-3 text-sm">Esta peça fica com <b>tamanho único</b>.</p>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Tamanho</p>
          <div className="flex flex-wrap gap-1.5">
            {g.tamanhos.map((t) => (
              <button key={t} type="button" aria-pressed={value === t} onClick={() => onChange(t)}
                className={`min-h-12 min-w-12 rounded-2xl border px-2 text-base font-semibold transition ${value === t ? "border-accent bg-accent/10 text-foreground" : "border-border bg-background-deep/60 text-muted-foreground hover:border-primary"}`}>{t}</button>
            ))}
          </div>
          {!value && <p className="text-xs text-muted-foreground">Toque no tamanho desta peça.</p>}
        </div>
      )}
    </>
  );
}
function Chips({ label, hint, opts, value, onChange }: { label: string; hint: string; opts: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}
            className={`min-h-12 rounded-2xl border px-3.5 text-base font-semibold transition ${value === o ? "border-accent bg-accent/10 text-foreground" : "border-border bg-background-deep/60 text-muted-foreground hover:border-primary"}`}>{o}</button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
function Sum({ t, onEdit, children }: { t: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t}</p>
        <p className="mt-0.5 break-words text-sm">{children}</p>
      </div>
      <button type="button" onClick={onEdit} className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary hover:underline"><Pencil size={13} /> Editar</button>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-background-deep/70 animate-in fade-in duration-200" />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative flex max-h-[90%] w-full max-w-[480px] flex-col rounded-t-3xl border border-b-0 border-border bg-background animate-in slide-in-from-bottom duration-300" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="flex shrink-0 items-center justify-between px-5 pt-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-12 w-12 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function VariationSheet({ index, vars, categoria, mainCode, used, onGerarCodigo, onClose, onSave }: {
  index: number; vars: Variation[]; categoria: string; mainCode: string; used: Set<string>; onClose: () => void; onSave: (v: Variation) => void;
  onGerarCodigo?: (() => Promise<string>) | undefined;
}) {
  const init = index >= 0 ? vars[index] : undefined;
  const [tam, setTam] = useState(init?.tam ?? ""); const [cor, setCor] = useState(init?.cor ?? "");
  const [cod, setCod] = useState(init?.codigo ?? ""); const [qtd, setQtd] = useState(init ? String(init.qtd) : "");
  const [scan, setScan] = useState(false); const [denied, setDenied] = useState(false);
  const gerador = useGerarCodigo(onGerarCodigo);
  const errs = variationErrors({ tam, cor, codigo: cod }, index, vars, mainCode, used);
  const ok = !!tam && !!cor.trim() && Number(qtd) > 0 && !errs.combo && !errs.codigo;
  return (
    <Sheet title={index >= 0 ? "Editar variação" : "Nova variação"} onClose={onClose}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ tam, cor: cor.trim(), codigo: cod.trim(), qtd: Number(qtd) }); }} className="flex min-h-0 flex-col">
        <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
          <TamanhoPicker value={tam} onChange={setTam} categoria={categoria} ultimo={vars.at(-1)?.tam} />
          <Field label="Cor" name="vcor" enterKeyHint="next" onKeyDown={nextOnEnter("vcod")} placeholder="Ex.: Azul" value={cor} onChange={(e) => setCor(e.target.value)} hint="Cor desta peça."
            error={tam && cor.trim() && errs.combo ? errs.combo : ""} />
          <Field label="Código de barras" name="vcod" id="vcod" inputMode="numeric" autoComplete="off" enterKeyHint="next" onKeyDown={nextOnEnter("vqtd")} placeholder="Ex.: 7891234567890"
            value={cod} onChange={(e) => setCod(e.target.value.replace(/\s/g, "").slice(0, 60))}
            error={cod.trim() || init ? errs.codigo ?? "" : ""}
            hint={denied ? "Sem acesso à câmera. Você pode digitar o código." : gerador.criado && cod === gerador.criado ? CODIGO_CRIADO : ajudaCodigo(cod, "Código próprio deste tamanho e cor.")}
            extra={<button type="button" onClick={() => { setDenied(false); setScan(true); }} className="flex min-h-9 items-center gap-1 text-sm font-semibold text-primary"><ScanLine size={16} /> Escanear</button>} />
          {onGerarCodigo && !cod.trim() && (
            <button type="button" disabled={gerador.gerando} className="-mt-1 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary disabled:opacity-60"
              onClick={() => gerador.gerar((c) => { setCod(c); setTimeout(() => document.getElementById("vqtd")?.focus(), 80); })}>
              <Tag size={16} /> {gerador.gerando ? "Criando código..." : "Não tem código? Criar um"}
            </button>
          )}
          {gerador.erro && <p role="alert" className="text-sm text-destructive">{gerador.erro}</p>}
          <Field label="Quantidade" name="vqtd" id="vqtd" inputMode="numeric" enterKeyHint="done" placeholder="0" value={qtd} onChange={(e) => setQtd(digits(e.target.value).slice(0, 5))} hint="Quantas peças você tem." />
        </div>
        <div className="px-5 pt-2"><button type="submit" disabled={!ok} className={btnPrimary(ok)}>{index >= 0 ? "Salvar variação" : "Adicionar"}</button></div>
      </form>
      {scan && (
        <Scanner onClose={() => setScan(false)} onType={() => setScan(false)}
          onDenied={() => { setScan(false); setDenied(true); }}
          onCode={(c) => { setScan(false); setCod(c); setTimeout(() => document.getElementById("vqtd")?.focus(), 80); }} />
      )}
    </Sheet>
  );
}
function EmbalagemSheet({ tipoComercio, index, lista, unidade, codigoProduto, usados, compra, onGerarCodigo, onClose, onSave }: {
  tipoComercio: string; index: number; lista: Embalagem[]; unidade: string; codigoProduto: string; usados: Set<string>; compra: number;
  onGerarCodigo?: (() => Promise<string>) | undefined; onClose: () => void;
  /** `novaCompra`: preço de compra da unidade calculado pela embalagem, quando o comerciante escolheu usar. */
  onSave: (e: Omit<Embalagem, "uid">, novaCompra: number | null) => void;
}) {
  const init = index >= 0 ? lista[index] : undefined;
  /* Embalagens do tipo de comércio (a mais comum primeiro); uma antiga fora da lista continua aparecendo para não sumir. */
  const doTipo = embalagensDoTipo(tipoComercio);
  const [tipo, setTipo] = useState(init?.tipo ?? doTipo[0] ?? "Caixa");
  const opcoesTipo = init && !doTipo.includes(init.tipo) ? [...doTipo, init.tipo] : doTipo;
  const [qtdTxt, setQtdTxt] = useState(init ? toInput(init.qtd) : "");
  const [cod, setCod] = useState(init?.codigo ?? "");
  const [preco, setPreco] = useState(init?.preco ?? 0);
  /* Só preenche sozinho quando o preço de compra está vazio; se já tem preço, o comerciante escolhe qual vale. */
  const [usar, setUsar] = useState(compra <= 0);
  const [tentou, setTentou] = useState(false);
  const [scan, setScan] = useState(false); const [denied, setDenied] = useState(false);
  const gerador = useGerarCodigo(onGerarCodigo);
  const q = lerQtdEmbalagem(qtdTxt, unidade);
  const errs = errosEmbalagem({ tipo, qtd: q.v ?? -1, codigo: cod }, index, lista, codigoProduto, usados, unidade);
  const unit = q.v ? precoUnidade(preco, q.v) : 0;
  const mudaCompra = unit > 0 && unit !== compra;
  const ok = !!tipo && !q.err && !errs.repetida && !errs.codigo;
  const qErr = tentou || qtdTxt ? q.err || errs.repetida || "" : "";
  const nomeUn = unSingular(unidade);
  return (
    <Sheet title={index >= 0 ? "Editar embalagem" : "Nova embalagem"} onClose={onClose}>
      <form noValidate onSubmit={(ev) => { ev.preventDefault(); if (!ok) { setTentou(true); return; } onSave({ tipo, qtd: q.v!, codigo: cod.trim(), preco }, mudaCompra && usar ? unit : null); }} className="flex min-h-0 flex-col">
        <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
          <Chips label="Tipo de embalagem" hint="Como vem do fornecedor." opts={opcoesTipo} value={tipo} onChange={setTipo} />
          <Field label={perguntaQtd(unidade)} name="eqtd" id="eqtd" inputMode={aceitaFracao(unidade) ? "decimal" : "numeric"} enterKeyHint="next" onKeyDown={nextOnEnter("ecod")}
            placeholder={aceitaFracao(unidade) ? "Ex.: 25" : "Ex.: 12"} value={qtdTxt} onChange={(e) => setQtdTxt(e.target.value.replace(/[^\d,.-]/g, "").slice(0, 10))}
            error={qErr} hint={`Ex.: ${tipo === unidade ? "fardo" : tipo.toLowerCase()} com ${qtdUn(12, unidade)}.`} />
          <Field label="Código de barras da embalagem (opcional)" name="ecod" id="ecod" inputMode="numeric" autoComplete="off" enterKeyHint="next" onKeyDown={nextOnEnter("epreco")}
            placeholder="Ex.: 17891234567890" value={cod} onChange={(e) => setCod(e.target.value.replace(/\s/g, "").slice(0, 60))} error={errs.codigo ?? ""}
            hint={denied ? "Sem acesso à câmera. Você pode digitar o código." : gerador.criado && cod === gerador.criado ? CODIGO_CRIADO : ajudaCodigo(cod, ajudaCodigoEmbalagem(tipo, unidade))}
            extra={<button type="button" onClick={() => { setDenied(false); setScan(true); }} className="flex min-h-9 items-center gap-1 text-sm font-semibold text-primary"><ScanLine size={16} /> Escanear</button>} />
          {cod.trim() && cod.trim() === codigoProduto.trim() && (
            <button type="button" onClick={() => setCod("")} className="-mt-1 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary"><X size={16} /> Apagar e deixar sem código</button>
          )}
          {onGerarCodigo && !cod.trim() && (
            <button type="button" disabled={gerador.gerando} className="-mt-1 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary disabled:opacity-60"
              onClick={() => gerador.gerar((c) => { setCod(c); setTimeout(() => document.getElementById("epreco")?.focus(), 80); })}>
              <Tag size={16} /> {gerador.gerando ? "Criando código..." : "Não tem código? Criar um"}
            </button>
          )}
          {gerador.erro && <p role="alert" className="text-sm text-destructive">{gerador.erro}</p>}
          <Field label={`${rotuloPrecoEmbalagem(tipo)} (opcional)`} name="epreco" id="epreco" inputMode="numeric" enterKeyHint="done" placeholder="R$ 0,00"
            value={preco ? brl2(preco) : ""} onChange={(e) => setPreco(moneyIn(e.target.value))} hint="Quanto você paga pela embalagem inteira." />
          {unit > 0 && (
            <div className="space-y-2 rounded-2xl border border-border bg-background-deep/60 p-3">
              <p className="text-sm">Cada {nomeUn} sai por <span className="font-bold text-accent">{brl2(unit)}</span></p>
              {mudaCompra && compra <= 0 && (
                <Pick on={usar} onClick={() => setUsar(!usar)}><span className="text-sm">Usar {brl2(unit)} como preço de compra</span></Pick>
              )}
              {mudaCompra && compra > 0 && (
                <>
                  <p className="text-sm font-semibold">O preço de compra que você digitou é {brl2(compra)}. Qual está certo?</p>
                  <Pick on={!usar} onClick={() => setUsar(false)}><span className="text-sm">Manter {brl2(compra)}</span></Pick>
                  <Pick on={usar} onClick={() => setUsar(true)}><span className="text-sm">Trocar para {brl2(unit)} (pelo preço da embalagem)</span></Pick>
                </>
              )}
            </div>
          )}
        </div>
        <div className="px-5 pt-2"><button type="submit" className={btnPrimary(ok)} aria-disabled={!ok}>{index >= 0 ? "Salvar embalagem" : "Adicionar"}</button></div>
      </form>
      {scan && (
        <Scanner onClose={() => setScan(false)} onType={() => setScan(false)}
          onDenied={() => { setScan(false); setDenied(true); }}
          onCode={(c) => { setScan(false); setCod(c); setTimeout(() => document.getElementById("epreco")?.focus(), 80); }} />
      )}
    </Sheet>
  );
}
/** Novo fornecedor, ou edição quando `inicial` vem preenchido. */
export function SupplierSheet({ tipo, inicial, onClose, onSave }: {
  tipo: string; inicial?: Supplier | undefined; onClose: () => void; onSave: (s: Omit<Supplier, "id">) => void | Promise<void>;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? ""); const [tel, setTel] = useState(inicial?.tel ? maskPhone(inicial.tel) : ""); const [email, setEmail] = useState(inicial?.email ?? "");
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState("");
  const enviar = () => {
    if (salvando) return;
    const r = onSave({ nome: nome.trim(), tel, email });
    if (!r) return;
    setSalvando(true); setErro("");
    r.catch((e: unknown) => { setErro(String((e as { message?: string })?.message ?? "Não foi possível guardar o fornecedor.")); setSalvando(false); });
  };
  const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const ok = !!nome.trim() && emailOk && (!tel || digits(tel).length >= 10);
  return (
    <Sheet title={inicial ? "Editar fornecedor" : "Novo fornecedor"} onClose={() => { if (!salvando) onClose(); }}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (ok) enviar(); }} className="flex min-h-0 flex-col">
        <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
          <Field label="Nome" name="fnome" autoComplete="organization" enterKeyHint="next" onKeyDown={nextOnEnter("ftel")} placeholder={`Ex.: ${exemplos(tipo).fornecedor}`} value={nome} onChange={(e) => setNome(e.target.value)} hint="Nome da empresa ou do vendedor." />
          <Field label="Telefone / WhatsApp" name="ftel" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" onKeyDown={nextOnEnter("femail")} placeholder="(11) 99999-9999" value={tel} onChange={(e) => setTel(maskPhone(e.target.value))} hint="Para fazer pedidos." />
          <Field label="E-mail" name="femail" type="email" inputMode="email" autoComplete="email" enterKeyHint="done" placeholder="Opcional" value={email} onChange={(e) => setEmail(e.target.value)} error={!emailOk ? "E-mail inválido." : ""} hint="Opcional." />
        </div>
        {erro && <p role="alert" className="px-5 pt-2 text-sm font-semibold text-destructive">{erro}</p>}
        <div className="px-5 pt-2"><button type="submit" disabled={!ok || salvando} className={btnPrimary(ok && !salvando)}>{salvando ? "Salvando…" : inicial ? "Salvar alterações" : "Salvar fornecedor"}</button></div>
      </form>
    </Sheet>
  );
}

/* ---------- tela de produto salvo ---------- */
export function SavedBanner({ onAnother, onList }: { onAnother: () => void; onList: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-accent/40 bg-accent/10 p-4 animate-in fade-in slide-in-from-top-4 duration-300 sm:flex-row sm:items-center">
      <p className="flex flex-1 items-center gap-2 text-base font-semibold"><CheckCircle2 size={22} className="text-accent" /> Produto cadastrado!</p>
      <div className="flex gap-2">
        <button type="button" onClick={onAnother} className={`flex-1 ${btnGhost}`}>Cadastrar outro</button>
        <button type="button" onClick={onList} className={`flex-1 ${btnGhost}`}>Ver produtos</button>
      </div>
    </div>
  );
}
