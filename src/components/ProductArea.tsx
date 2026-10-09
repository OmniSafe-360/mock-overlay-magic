import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Check, CheckCircle2, Keyboard, Package, Pencil, Plus, ScanLine, Search, Truck, X } from "lucide-react";
import { Field, btnGhost, btnPrimary, digits, maskPhone, nextOnEnter, useKeyboard, type StoreData } from "@/components/StoreSetup";
import { Scanner } from "@/components/Scanner";
import { AUTOPECAS_VARS_MSG, POSICAO_MSG, CONSTRUCAO_VARS_MSG, CONTROLADO_MSG, ESPECIE_MSG, PET_VARS_MSG, FARMACIA_VARS_MSG, firstInvalidStep, typeRuleError, type TypeRules, mainCodeError, usedCodes, variationErrors, variationOk } from "@/lib/variations";
import {
  ACIMA_MAX, LOCAL_DUP, LOCAL_PENDENTE, REMOCAO_BLOQUEADA, SEM_CONFIG, TEMPORARIO, aceitaFracao, fmtQ, limitesErro, limitesStatus, localDuplicado,
  localTravadoMsg, locaisDoComercio, newUid, parseNum, temQtdPositiva, toInput, unidadeTravadaMsg, type Deposito,
} from "@/lib/deposito";
import {
  EXEMPLO_LOCAL, SEM_REPOSICAO, VEN_ACIMA_MAX, VEN_LOCAL_DUP, VEN_LOCAL_PENDENTE, VEN_REMOCAO_BLOQUEADA, VEN_SEM_CONFIG, limitesVendaStatus,
  locaisVendaDoComercio, totalTexto, venLocalTravadoMsg, type AreaVenda,
} from "@/lib/areaVenda";

/* ---------- tipos e dados por comércio ---------- */
export type Supplier = { id: number; nome: string; tel: string; email: string };
/** `uid` liga a variação à sua configuração de depósito, sem depender da posição na lista. */
export type Variation = { tam: string; cor: string; qtd: number; codigo?: string | undefined; uid?: string | undefined };
export type Product = {
  id: number; codigo: string; nome: string; compra: number; venda: number; unidade: string; categoria: string;
  detalhes: Record<string, string>; variacoes: Variation[]; fornecedor: number | null;
  deposito?: Deposito | undefined;
  /** Área de venda (gôndola, prateleira, arara...). Não confundir com `venda`, que é o preço. */
  areaVenda?: AreaVenda | undefined;
};

const UNIDADES: Record<string, string[]> = {
  mercado: ["Unidade", "Kg", "Litro", "Pacote", "Caixa"], pet: ["Unidade", "Kg", "Litro", "Pacote", "Caixa"],
  farmacia: ["Caixa", "Cartela", "Frasco", "Unidade"], roupas: ["Peça", "Par"],
  construcao: ["Unidade", "Metro", "m²", "Kg", "Saco", "Caixa", "Lata"], autopecas: ["Unidade", "Par", "Jogo", "Kit"],
};
const CATEGORIAS: Record<string, string[]> = {
  mercado: ["Mercearia", "Bebidas", "Hortifrúti", "Frios e laticínios", "Limpeza", "Higiene"],
  farmacia: ["Medicamentos", "Genéricos", "Higiene", "Dermocosméticos", "Infantil", "Suplementos"],
  roupas: ["Camisetas", "Calças", "Vestidos", "Calçados", "Íntima", "Acessórios"],
  construcao: ["Básico", "Hidráulica", "Elétrica", "Pintura", "Ferramentas", "Acabamento"],
  pet: ["Ração", "Petiscos", "Higiene", "Acessórios", "Farmácia pet", "Brinquedos"],
  autopecas: ["Motor", "Freios", "Suspensão", "Elétrica", "Filtros", "Acessórios"],
};
type DField = { k: string; label: string; hint: string; ph?: string; opts?: string[] };
const DETALHES: Record<string, DField[]> = {
  mercado: [{ k: "marca", label: "Marca", hint: "Fabricante do produto.", ph: "Ex.: Camil" }, { k: "peso", label: "Peso ou volume da embalagem", hint: "Como aparece no rótulo.", ph: "Ex.: 1 kg, 500 ml" }],
  farmacia: [{ k: "principio", label: "Princípio ativo", hint: "Substância principal.", ph: "Ex.: Dipirona" }, { k: "apresentacao", label: "Apresentação", hint: "Forma e quantidade.", ph: "Ex.: 10 comprimidos 500 mg" }, { k: "marca", label: "Marca", hint: "Laboratório ou marca.", ph: "Ex.: EMS" }, { k: "controlado", label: "É medicamento controlado?", hint: "Exige retenção de receita.", opts: ["Sim", "Não"] }],
  roupas: [{ k: "marca", label: "Marca", hint: "Marca da peça.", ph: "Ex.: Hering" }],
  construcao: [{ k: "marca", label: "Marca", hint: "Fabricante.", ph: "Ex.: Tigre" }, { k: "medida", label: "Medida / especificação", hint: "Tamanho, bitola ou tipo.", ph: "Ex.: Cano PVC 25 mm" }],
  pet: [{ k: "marca", label: "Marca", hint: "Fabricante.", ph: "Ex.: Golden" }, { k: "especie", label: "Espécie", hint: "Para qual animal.", opts: ["Cão", "Gato", "Outros"] }, { k: "peso", label: "Peso da embalagem", hint: "Como no rótulo.", ph: "Ex.: 15 kg" }],
  autopecas: [{ k: "referencia", label: "Código do fabricante", hint: "Referência da peça.", ph: "Ex.: KYB-334" }, { k: "marca", label: "Marca", hint: "Fabricante da peça.", ph: "Ex.: Bosch" }, { k: "aplicacao", label: "Aplicação", hint: "Marca, modelo e ano do veículo.", ph: "Ex.: Fiat Uno 2015" }, { k: "posicao", label: "Posição", hint: "Onde vai no veículo.", opts: ["Dianteira", "Traseira", "Esquerda", "Direita", "Não se aplica"] }],
};
const TAMANHOS = ["P", "M", "G", "GG", "36", "38", "40", "42", "44"];

export const brl2 = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moneyIn = (v: string) => Number(digits(v).slice(0, 10) || 0);
const labelOf = (tipo: string, k: string) => DETALHES[tipo]?.find((f) => f.k === k)?.label ?? k;

/* ---------- aba Produtos ---------- */
export function ProductsTab({ products, onNew, onOpen }: { products: Product[]; onNew: () => void; onOpen: (p: Product) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? products.filter((p) => p.nome.toLowerCase().includes(t) || p.codigo.includes(t)) : products;
  }, [q, products]);
  const newBtn = (
    <button type="button" onClick={onNew} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><Plus size={20} /> Novo produto</button>
  );
  if (!products.length)
    return (
      <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3 py-10 text-center animate-in fade-in duration-300">
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-secondary/60">
          <Package size={52} className="text-primary" />
          <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground"><Plus size={20} /></span>
        </div>
        <p className="text-lg font-bold">Cadastre seu primeiro produto</p>
        <p className="text-base text-muted-foreground">Leia o código de barras com a câmera ou digite. Leva poucos segundos.</p>
        <div className="mt-2 w-full">{newBtn}</div>
      </div>
    );
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar produto</span>
          <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou código"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 pl-12 pr-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40" />
        </label>
        <div className="sm:w-56">{newBtn}</div>
      </div>
      {!list.length && <p className="py-8 text-center text-base text-muted-foreground">Nenhum produto encontrado.</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <button key={p.id} type="button" onClick={() => onOpen(p)}
            className="flex min-h-[96px] items-center gap-4 rounded-3xl border border-border bg-secondary/70 p-4 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-ring">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background-deep/60 text-primary"><Package size={24} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{p.nome}</p>
              <p className="truncate text-sm text-muted-foreground">Cód. {p.codigo}</p>
              <p className="mt-1 text-sm"><span className="font-semibold text-accent">{brl2(p.venda)}</span> <span className="text-muted-foreground">/ {p.unidade}</span></p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- detalhe do produto ---------- */
export function ProductDetail({ p, tipo, suppliers, onBack, onEdit }: { p: Product; tipo: string; suppliers: Supplier[]; onBack: () => void; onEdit: () => void }) {
  const f = suppliers.find((s) => s.id === p.fornecedor);
  const lucro = p.venda - p.compra;
  const det = Object.entries(p.detalhes).filter(([, v]) => v);
  return (
    <div className="mx-auto max-w-[560px] space-y-4 animate-in fade-in slide-in-from-right-8 duration-300">
      <button type="button" onClick={onBack} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Produtos</button>
      <div>
        <h1 className="text-2xl font-bold">{p.nome}</h1>
        <p className="text-base text-muted-foreground">Cód. {p.codigo} · {p.categoria}</p>
      </div>
      <div className="divide-y divide-border rounded-3xl border border-border bg-secondary/60">
        <Row t="Preços">Compra {brl2(p.compra)} · Venda {brl2(p.venda)} / {p.unidade}<br />Lucro {brl2(lucro)} por unidade</Row>
        {(det.length > 0 || p.variacoes.length > 0) && (
          <Row t="Detalhes">
            {det.map(([k, v]) => <span key={k} className="block">{labelOf(tipo, k)}: {v}</span>)}
            {p.variacoes.map((v, i) => <span key={v.uid ?? i} className="block">{v.tam} · {v.cor} · Cód. {v.codigo || "sem código"} · Quantidade informada no cadastro: {v.qtd}</span>)}
          </Row>
        )}
        <Row t="Fornecedor">{f ? <>{f.nome}{f.tel ? ` · ${f.tel}` : ""}</> : "Definir depois"}</Row>
        <Row t="Depósito"><DepositoInfo p={p} /></Row>
        <Row t="Área de venda"><AreaVendaInfo p={p} /></Row>
        <Row t="Total para conferência"><TotalInfo p={p} /></Row>
      </div>
      <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">{TEMPORARIO}</p>
      <button type="button" onClick={onEdit} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><Pencil size={18} /> Editar</button>
    </div>
  );
}
function Row({ t, children }: { t: string; children: ReactNode }) {
  return (
    <div className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t}</p>
      <p className="mt-1 break-words text-base">{children}</p>
    </div>
  );
}

/** Situação do depósito, mostrada no detalhe do produto. */
export function DepositoInfo({ p }: { p: Product }) {
  const d = p.deposito;
  if (!d) return <span className="block">{SEM_CONFIG}</span>;
  return (
    <>
      <span className="block">{d.local ? `Local: ${d.local}` : LOCAL_PENDENTE}</span>
      {d.vars ? (
        p.variacoes.map((v, i) => {
          const c = v.uid ? d.vars?.[v.uid] : undefined;
          return (
            <span key={v.uid ?? i} className="block">
              {v.tam} · {v.cor}: {c ? <>Quantidade confirmada no depósito: {fmtQ(c.qtd)} {p.unidade} · {limitesStatus(c.min, c.max)}</> : "Depósito não configurado"}
            </span>
          );
        })
      ) : (
        <>
          <span className="block">Quantidade confirmada no depósito: {d.qtd != null ? `${fmtQ(d.qtd)} ${p.unidade}` : "não informada"}</span>
          <span className="block">{limitesStatus(d.min, d.max)}</span>
        </>
      )}
    </>
  );
}

/** Situação da área de venda, mostrada no detalhe do produto. */
export function AreaVendaInfo({ p }: { p: Product }) {
  const a = p.areaVenda;
  if (!a) return <span className="block">{VEN_SEM_CONFIG}</span>;
  return (
    <>
      <span className="block">{a.local ? `Local: ${a.local}` : VEN_LOCAL_PENDENTE}</span>
      {a.vars ? (
        p.variacoes.map((v, i) => {
          const c = v.uid ? a.vars?.[v.uid] : undefined;
          return (
            <span key={v.uid ?? i} className="block">
              {v.tam} · {v.cor}: {c ? <>Quantidade na área de venda: {fmtQ(c.qtd)} {p.unidade} · {limitesVendaStatus(c.min, c.max)}</> : VEN_SEM_CONFIG}
            </span>
          );
        })
      ) : (
        <>
          <span className="block">Quantidade na área de venda: {a.qtd != null ? `${fmtQ(a.qtd)} ${p.unidade}` : "não informada"}</span>
          <span className="block">{limitesVendaStatus(a.min, a.max)}</span>
        </>
      )}
      <span className="block text-sm text-muted-foreground">{SEM_REPOSICAO}</span>
    </>
  );
}

/** Contagem confirmada de uma área (produto inteiro ou variação). Nunca usa a quantidade do cadastro. */
const qtdArea = (d: Deposito | undefined, uid?: string) => (!d ? null : uid ? d.vars?.[uid]?.qtd ?? null : d.vars ? null : d.qtd);
export function TotalInfo({ p }: { p: Product }) {
  if (p.variacoes.length && (p.deposito?.vars || p.areaVenda?.vars))
    return <>{p.variacoes.map((v, i) => <span key={v.uid ?? i} className="block">{v.tam} · {v.cor}: {totalTexto(qtdArea(p.deposito, v.uid), qtdArea(p.areaVenda, v.uid), p.unidade)}</span>)}</>;
  return <span className="block">{totalTexto(qtdArea(p.deposito), qtdArea(p.areaVenda), p.unidade)}</span>;
}

/* ---------- cadastro em 7 etapas (Depósito e Área de venda têm 3 subpassos) ---------- */
const TITLES = ["Qual é o código do produto?", "Preço e unidade", "Detalhes do produto", "Quem é o fornecedor?", "Depósito", "Área de venda", "Conferir e salvar"];
const DEP_TITLES = ["Onde fica no depósito?", "Quanto há no depósito?", "Limites de estoque"];
const VEN_TITLES = ["Área de venda: onde fica?", "Área de venda: quantidade", "Área de venda: limites"];
const STEP_DEP = 4;
const STEP_VEN = 5;
const STEP_REV = 6;
const TOTAL = TITLES.length;

type VarDep = { qtd?: string | undefined; min: string; max: string };

export function ProductWizard({ store, products, initial, suppliers, onAddSupplier, onCancel, onSave }: {
  store: StoreData; products: Product[]; initial?: Product | undefined; suppliers: Supplier[];
  onAddSupplier: (s: Omit<Supplier, "id">) => number; onCancel: () => void; onSave: (p: Product) => void;
}) {
  const kb = useKeyboard();
  const tipo = store.tipo;
  const [step, setStep] = useState(0);
  const [sub, setSub] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [fromReview, setFromReview] = useState(false);
  const [codeMode, setCodeMode] = useState<"choose" | "type">(initial ? "type" : "choose");
  const [scan, setScan] = useState(false);
  const [denied, setDenied] = useState(false);
  const [codigo, setCodigo] = useState(initial?.codigo ?? "");
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [compra, setCompra] = useState(initial?.compra ?? 0);
  const [venda, setVenda] = useState(initial?.venda ?? 0);
  const [unidade, setUnidade] = useState(initial?.unidade ?? "");
  const [categoria, setCategoria] = useState(initial?.categoria ?? "");
  const [det, setDet] = useState<Record<string, string>>(initial?.detalhes ?? {});
  const [vars, setVars] = useState<Variation[]>(() => (initial?.variacoes ?? []).map((v) => (v.uid ? v : { ...v, uid: newUid() })));
  const [forn, setForn] = useState<number | null | undefined>(initial ? initial.fornecedor : undefined);
  const [varSheet, setVarSheet] = useState<number | null>(null);
  const [suppSheet, setSuppSheet] = useState(false);
  const [varMsg, setVarMsg] = useState("");
  const [unitMsg, setUnitMsg] = useState("");

  /* ----- depósito (em memória) ----- */
  const initDep = initial?.deposito;
  const configSalva = !!initDep;
  const locais = useMemo(() => locaisDoComercio(products), [products]);
  const [dLocal, setDLocal] = useState<string | null | undefined>(initDep ? initDep.local : undefined);
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
  const locaisV = useMemo(() => locaisVendaDoComercio(products), [products]);
  const [vLocal, setVLocal] = useState<string | null | undefined>(initVen ? initVen.local : undefined);
  const [vManter, setVManter] = useState(!!initial && !initVen);
  const [vNovo, setVNovo] = useState<string | null>(null);
  const [vLocalMsg, setVLocalMsg] = useState("");
  const [vQtd, setVQtd] = useState(toInput(initVen?.qtd));
  const [vMin, setVMin] = useState(toInput(initVen?.min));
  const [vMax, setVMax] = useState(toInput(initVen?.max));
  const [vVar, setVVar] = useState<Record<string, VarDep>>(() =>
    Object.fromEntries(Object.entries(initVen?.vars ?? {}).map(([k, c]) => [k, { qtd: toInput(c.qtd), min: toInput(c.min), max: toInput(c.max) }])));

  const used = useMemo(() => usedCodes(products, initial?.id), [products, initial?.id]);
  const isRoupas = tipo === "roupas";
  const codeErr = mainCodeError(codigo, used, isRoupas ? vars : []);
  const [triedSave, setTriedSave] = useState(false);
  const rules: TypeRules | undefined =
    tipo === "mercado" ? { unidades: UNIDADES["mercado"]!, categorias: CATEGORIAS["mercado"]!, semVariacoes: true }
    : tipo === "farmacia" ? { unidades: UNIDADES["farmacia"]!, categorias: CATEGORIAS["farmacia"]!, semVariacoes: true, varsMsg: FARMACIA_VARS_MSG,
        detalhesFixos: [{ k: "controlado", opts: DETALHES["farmacia"]!.find((f) => f.k === "controlado")?.opts ?? [], msg: CONTROLADO_MSG }] }
    : tipo === "construcao" ? { unidades: UNIDADES["construcao"]!, categorias: CATEGORIAS["construcao"]!, semVariacoes: true, varsMsg: CONSTRUCAO_VARS_MSG }
    : tipo === "pet" ? { unidades: UNIDADES["pet"]!, categorias: CATEGORIAS["pet"]!, semVariacoes: true, varsMsg: PET_VARS_MSG,
        detalhesFixos: [{ k: "especie", opts: DETALHES["pet"]!.find((f) => f.k === "especie")?.opts ?? [], msg: ESPECIE_MSG }] }
    : tipo === "autopecas" ? { unidades: UNIDADES["autopecas"]!, categorias: CATEGORIAS["autopecas"]!, semVariacoes: true, varsMsg: AUTOPECAS_VARS_MSG,
        detalhesFixos: [{ k: "posicao", opts: DETALHES["autopecas"]!.find((f) => f.k === "posicao")?.opts ?? [], msg: POSICAO_MSG }] }
    : tipo === "roupas" ? { unidades: UNIDADES["roupas"]!, categorias: CATEGORIAS["roupas"]! } // variações continuam obrigatórias
    : undefined;
  const ruleErr = typeRuleError({ unidade, categoria, variacoes: vars, detalhes: det }, rules);
  const dup = !!codeErr;
  const varsOk = vars.length > 0 && vars.every((v, i) => variationOk(v, i, vars, codigo, used));

  /* validações do depósito */
  const unidadeTravada = (configSalva || vendaSalva) && unidade !== initial!.unidade;
  const localTravado = !!initDep?.local && temQtdPositiva(initDep);
  const qtdTravada = configSalva && !isRoupas;
  const q = qtdTravada ? { v: initDep!.qtd, err: "" } : parseNum(dQtd, unidade, false);
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
    : !qtdOk ? { sub: 1, msg: pendentes.length ? "Responda se as quantidades estão no depósito." : "Corrija a quantidade contada." }
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

  const valid = [
    !!codigo.trim() && !dup && !!nome.trim(),
    compra > 0 && venda > 0 && !!unidade && !!categoria && ruleErr?.step !== 1 && !unidadeTravada,
    (!isRoupas || varsOk) && ruleErr?.step !== 2,
    forn !== undefined,
    [localOk, qtdOk, limOk][sub]!,
    [vLocalOk, vQtdOk, vLimOk][sub]!,
    true,
  ][step]!;
  const lucro = venda - compra;
  const margem = venda > 0 ? (lucro / venda) * 100 : 0;
  const fornNome = forn ? suppliers.find((s) => s.id === forn)?.nome : "Definir depois";

  const go = (to: number, s = 0) => { setDir(to * 10 + s > step * 10 + sub ? 1 : -1); setStep(to); setSub(s); setSubTried(false); };
  const baseBad = firstInvalidStep({ codigo, nome, compra, venda, unidade, categoria, variacoes: vars, detalhes: det, fornecedor: forn }, isRoupas, used, rules);
  const bad: { step: number; sub?: number; msg: string } | null =
    unidadeTravada ? { step: 1, msg: unidadeTravadaMsg(initial!.unidade) }
    : baseBad ?? (depBad ? { step: STEP_DEP, sub: depBad.sub, msg: depBad.msg } : venBad ? { step: STEP_VEN, sub: venBad.sub, msg: venBad.msg } : null);
  const hasSub = step === STEP_DEP || step === STEP_VEN;
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
  const save = () => {
    if (bad) { setTriedSave(true); setFromReview(true); return go(bad.step, bad.sub ?? 0); }
    onSave({ id: initial?.id ?? Date.now(), codigo: codigo.trim(), nome: nome.trim(), compra, venda, unidade, categoria, detalhes: det, variacoes: vars,
      fornecedor: forn ?? null, deposito: buildDeposito(), areaVenda: buildVenda() });
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
      if (vManter || sub === 2 || (fromReview && !venBad)) { setFromReview(false); return go(STEP_REV); }
      return go(STEP_VEN, sub + 1);
    }
    if (fromReview) { setFromReview(false); return go(STEP_REV); }
    go(step + 1);
  };
  const back = () => {
    setFromReview(false);
    if (hasSub && sub > 0) return go(step, sub - 1);
    if (step === STEP_VEN) return go(STEP_DEP, manterSem ? 0 : 2);
    if (step === STEP_REV) return go(STEP_VEN, vManter ? 0 : 2);
    go(step - 1);
  };
  const edit = (s: number, ss = 0) => { setFromReview(true); go(s, ss); };

  const pickLocal = (l: string | null) => {
    if (localTravado && l !== initDep!.local) { setLocalMsg(localTravadoMsg(initDep!.local!)); return; }
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
    if ((x && (x.q.v ?? 0) > 0) || (y && (y.q.v ?? 0) > 0)) { setVarMsg(VEN_REMOCAO_BLOQUEADA); return; }
    setVarMsg("");
    setVars(vars.filter((_, j) => j !== i));
    if (x?.v.uid) { const k = x.v.uid; const del = (m: Record<string, VarDep>) => { const n = { ...m }; delete n[k]; return n; }; setDVar(del); setVVar(del); }
  };
  const resumoLocal = manterSem ? SEM_CONFIG : dLocal ? dLocal : LOCAL_PENDENTE;
  const resumoQtd = isRoupas
    ? varsDep.map((x) => `${x.v.tam}/${x.v.cor}: ${x.q.v != null ? fmtQ(x.q.v) : "—"}`).join(", ")
    : q.v != null ? `${fmtQ(q.v)} ${unidade}` : "—";
  const resumoVLocal = vManter ? VEN_SEM_CONFIG : vLocal ? vLocal : VEN_LOCAL_PENDENTE;
  const resumoVQtd = isRoupas
    ? varsVen.map((x) => `${x.v.tam}/${x.v.cor}: ${x.q.v != null && !x.q.err ? fmtQ(x.q.v) : "—"}`).join(", ")
    : vq.v != null && !vq.err ? `${fmtQ(vq.v)} ${unidade}` : "—";
  const resumoVLim = isRoupas ? varsVen.map((x) => `${x.v.tam}/${x.v.cor}: ${limitesVendaStatus(x.mn.v, x.mx.v)}`).join(" · ") : limitesVendaStatus(vmn.v, vmx.v);
  /* total visual: só com as duas contagens confirmadas; nunca usa a quantidade do cadastro */
  const okQ = (r: { v: number | null; err: string }) => (r.err ? null : r.v);
  const totalLinhas = isRoupas
    ? vars.map((v, i) => `${v.tam} · ${v.cor}: ${totalTexto(manterSem ? null : okQ(varsDep[i]!.q), vManter ? null : okQ(varsVen[i]!.q), unidade)}`)
    : [totalTexto(manterSem ? null : okQ(q), vManter ? null : okQ(vq), unidade)];
  const resumoLim = isRoupas ? varsDep.map((x) => `${x.v.tam}/${x.v.cor}: ${limitesStatus(x.mn.v, x.mx.v)}`).join(" · ") : limitesStatus(mn.v, mx.v);

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
                <h1 className="min-w-0 text-lg font-bold short:text-base">{step === STEP_DEP ? DEP_TITLES[sub] : TITLES[step]}</h1>
                <span className="shrink-0 text-xs text-muted-foreground">Passo {step + 1} de {TOTAL}{step === STEP_DEP && !manterSem ? ` · ${sub + 1}/3` : ""}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-progress transition-all duration-500" style={{ width: `${((step + (step === STEP_DEP ? (sub + 1) / 3 : 1)) / TOTAL) * 100}%` }} />
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
                    </div>
                  ) : (
                    <Field label="Código do produto" name="codigo" inputMode="numeric" autoComplete="off" enterKeyHint="next" placeholder="Ex.: 7891234567890"
                      autoFocus={!codigo} onKeyDown={nextOnEnter("pnome")} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\s/g, "").slice(0, 60))}
                      error={codeErr}
                      hint={denied ? "Sem acesso à câmera. Você pode digitar o código." : "Os números abaixo do código de barras."}
                      extra={<button type="button" onClick={() => { setDenied(false); setScan(true); }} className="flex min-h-9 items-center gap-1 text-sm font-semibold text-primary"><ScanLine size={16} /> Escanear</button>} />
                  )}
                  {denied && codeMode === "choose" && <p className="text-sm text-destructive">Sem acesso à câmera. Você pode digitar o código.</p>}
                  <Field label="Nome do produto" name="pnome" id="pnome" autoComplete="off" enterKeyHint="done" placeholder="Ex.: Arroz branco 5 kg"
                    value={nome} onChange={(e) => setNome(e.target.value)} hint="Como aparece na etiqueta e no caixa." />
                </>
              )}

              {step === 1 && (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Preço de compra" name="compra" inputMode="numeric" enterKeyHint="next" onKeyDown={nextOnEnter("venda")}
                      value={compra ? brl2(compra) : ""} placeholder="R$ 0,00" onChange={(e) => setCompra(moneyIn(e.target.value))} hint="Quanto você paga." />
                    <Field label="Preço de venda" name="venda" inputMode="numeric" enterKeyHint="done"
                      value={venda ? brl2(venda) : ""} placeholder="R$ 0,00" onChange={(e) => setVenda(moneyIn(e.target.value))} hint="Quanto o cliente paga." />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-border bg-background-deep/60 p-3">
                    <div><p className="text-xs text-muted-foreground">Lucro por unidade</p><p className={`text-base font-bold ${lucro < 0 ? "text-destructive" : "text-accent"}`}>{brl2(lucro)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Margem %</p><p className={`text-base font-bold ${lucro < 0 ? "text-destructive" : "text-accent"}`}>{margem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</p></div>
                  </div>
                  {compra > 0 && venda > 0 && venda < compra && (
                    <p className="-mt-1 text-xs text-warning">O preço de venda está menor que o de compra. Você terá prejuízo.</p>
                  )}
                  <Chips label="Unidade de medida" hint="Como você vende este produto." opts={UNIDADES[tipo] ?? []} value={unidade}
                    onChange={(u) => { if (configSalva && u !== initial!.unidade) { setUnitMsg(unidadeTravadaMsg(initial!.unidade)); return; } setUnitMsg(""); setUnidade(u); }} />
                  {(unitMsg || unidadeTravada) && <p role="alert" className="-mt-1 text-sm text-destructive">{unitMsg || unidadeTravadaMsg(initial!.unidade)}</p>}
                  <div className="space-y-1">
                    <label htmlFor="cat" className="text-sm font-medium text-muted-foreground">Categoria</label>
                    <select id="cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}
                      className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40">
                      <option value="">Selecione</option>
                      {(CATEGORIAS[tipo] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <p className="text-xs text-muted-foreground">Ajuda a organizar a lista.</p>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  {(DETALHES[tipo] ?? []).map((f, i, arr) =>
                    f.opts ? (
                      <Chips key={f.k} label={f.label} hint={f.hint} opts={f.opts} value={det[f.k] ?? ""} onChange={(v) => setDet({ ...det, [f.k]: v })} />
                    ) : (
                      <Field key={f.k} label={f.label} name={`d-${f.k}`} autoComplete="off" placeholder={f.ph} hint={f.hint}
                        enterKeyHint={arr.slice(i + 1).some((x) => !x.opts) ? "next" : "done"}
                        onKeyDown={(() => { const n = arr.slice(i + 1).find((x) => !x.opts); return n ? nextOnEnter(`d-${n.k}`) : undefined; })()}
                        value={det[f.k] ?? ""} onChange={(e) => setDet({ ...det, [f.k]: e.target.value })} />
                    ),
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
                  <p className="text-xs text-muted-foreground">De quem você compra este produto.</p>
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
                      {!manterSem && dLocal === null && <p className="text-xs text-warning">{LOCAL_PENDENTE}</p>}
                    </>
                  )}

                  {sub === 1 && !isRoupas && (
                    <>
                      {qtdTravada ? (
                        <div className="rounded-2xl border border-border bg-background-deep/60 p-3 text-sm">
                          <p>Quantidade confirmada no depósito: <b>{q.v != null ? `${fmtQ(q.v)} ${unidade}` : "—"}</b></p>
                          <p className="mt-1 text-xs text-muted-foreground">Alterar a contagem ficará para uma etapa futura.</p>
                        </div>
                      ) : (
                        <Field label={`Quanto você contou no depósito agora? (${unidade})`} name="dqtd" {...numProps} enterKeyHint="done"
                          value={dQtd} onChange={(e) => setDQtd(numIn(e.target.value))} error={showErr(dQtd, q.err)}
                          hint={fr ? "Aceita vírgula. Ex.: 12,5" : "Somente números inteiros."} />
                      )}
                      <p className="text-xs text-muted-foreground">Não é o peso ou volume da embalagem. É quanto você tem guardado. Se não houver nenhuma, digite 0.</p>
                    </>
                  )}

                  {sub === 1 && isRoupas && (
                    <>
                      {pendentes.length > 0 && (
                        <div className="space-y-2 rounded-2xl border border-accent/50 bg-accent/10 p-3">
                          <p className="text-base font-semibold">Essas quantidades estão no depósito?</p>
                          {pendentes.map((x) => (
                            <p key={x.v.uid} className="text-sm">{x.v.tam} · {x.v.cor} · Quantidade informada no cadastro: {x.v.qtd} {unidade}</p>
                          ))}
                          <div className="flex flex-col gap-2">
                            <button type="button" onClick={() => setDVar((m) => { const n = { ...m }; for (const x of pendentes) n[x.v.uid!] = { ...(n[x.v.uid!] ?? { min: "", max: "" }), qtd: String(x.v.qtd) }; return n; })}
                              className={btnPrimary(true)}>Sim, estão no depósito</button>
                            <button type="button" onClick={() => setDVar((m) => { const n = { ...m }; for (const x of pendentes) n[x.v.uid!] = { ...(n[x.v.uid!] ?? { min: "", max: "" }), qtd: "" }; return n; })}
                              className={btnGhost}>Não, vou contar o depósito</button>
                          </div>
                        </div>
                      )}
                      {varsDep.filter((x) => x.travada || x.d.qtd !== undefined).map((x) => (
                        <div key={x.v.uid} className="space-y-1.5 rounded-2xl border border-border bg-background-deep/60 p-3">
                          <p className="text-sm font-semibold">{x.v.tam} · {x.v.cor}</p>
                          <p className="text-xs text-muted-foreground">Quantidade informada no cadastro: {x.v.qtd}</p>
                          {x.travada ? (
                            <>
                              <p className="text-sm">Quantidade confirmada no depósito: <b>{fmtQ(x.q.v ?? 0)} {unidade}</b></p>
                              <p className="text-xs text-muted-foreground">Alterar a contagem ficará para uma etapa futura.</p>
                            </>
                          ) : (
                            <Field label={`Quantidade confirmada no depósito (${unidade})`} name={`dq-${x.v.uid}`} {...numProps} placeholder="Ex.: 10"
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
                        <Field label={`Mínimo (${unidade})`} name="dmin" {...numProps} enterKeyHint="next" onKeyDown={nextOnEnter("dmax")} placeholder="Opcional"
                          value={dMin} onChange={(e) => setDMin(numIn(e.target.value))} error={mn.err} />
                        <Field label={`Máximo desejado (${unidade})`} name="dmax" id="dmax" {...numProps} enterKeyHint="done" placeholder="Opcional"
                          value={dMax} onChange={(e) => setDMax(numIn(e.target.value))} error={mx.err || limErr} />
                      </div>
                      <p className="text-sm text-muted-foreground">{limitesStatus(mn.v, mx.v)}</p>
                      {q.v != null && mx.v != null && q.v > mx.v && <p className="text-sm text-warning">{ACIMA_MAX}</p>}
                      <LimitesAjuda />
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
                      <LimitesAjuda />
                    </>
                  )}
                </>
              )}

              {step === STEP_REV && (
                <div className="divide-y divide-border rounded-2xl border border-border bg-background-deep/60">
                  <Sum t="Código e nome" onEdit={() => edit(0)}>{nome}<br />Cód. {codigo}</Sum>
                  <Sum t="Preços" onEdit={() => edit(1)}>{brl2(compra)} → {brl2(venda)} / {unidade}<br />{categoria} · margem {margem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</Sum>
                  <Sum t="Detalhes" onEdit={() => edit(2)}>
                    {Object.entries(det).filter(([, v]) => v).map(([k, v]) => `${labelOf(tipo, k)}: ${v}`).join(" · ") || (vars.length ? "" : "Nenhum")}
                    {vars.length > 0 && <><br />{vars.map((v) => `${v.tam}/${v.cor}/Cód. ${v.codigo || "—"}/${v.qtd}`).join(", ")}</>}
                  </Sum>
                  <Sum t="Fornecedor" onEdit={() => edit(3)}>{fornNome}</Sum>
                  {manterSem ? (
                    <Sum t="Depósito" onEdit={() => edit(STEP_DEP, 0)}>{SEM_CONFIG}</Sum>
                  ) : (
                    <>
                      <Sum t="Local" onEdit={() => edit(STEP_DEP, 0)}>{resumoLocal}</Sum>
                      <Sum t="Quantidade no depósito" onEdit={() => edit(STEP_DEP, 1)}>{resumoQtd}</Sum>
                      <Sum t="Limites" onEdit={() => edit(STEP_DEP, 2)}>{resumoLim}</Sum>
                    </>
                  )}
                  <p className="p-3.5 text-xs text-muted-foreground">{TEMPORARIO}</p>
                </div>
              )}
            </div>

            <div className={`flex shrink-0 gap-2 ${kb ? "pt-2" : "pt-4 short:pt-3"}`}>
              {step > 0 && (
                <button type="button" onClick={back} className={btnGhost}><span className="flex items-center gap-1.5"><ArrowLeft size={18} />Voltar</span></button>
              )}
              {step === 2 && !isRoupas && !Object.values(det).some(Boolean) ? (
                <button type="submit" className={`flex-1 ${btnPrimary(true)}`}>Pular</button>
              ) : (
                <button type="submit" disabled={!valid} className={`flex-1 ${btnPrimary(valid)}`}>{step === STEP_REV ? "Salvar produto" : "Continuar"}</button>
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
      {varSheet !== null && <VariationSheet index={varSheet} vars={vars} mainCode={codigo} used={used} onClose={() => setVarSheet(null)}
        onSave={(v) => {
          const uid = varSheet < 0 ? newUid() : vars[varSheet]?.uid ?? newUid();
          const nv = { ...v, uid };
          setVars(varSheet < 0 ? [...vars, nv] : vars.map((x, j) => (j === varSheet ? nv : x)));
          setVarSheet(null);
        }} />}
      {suppSheet && <SupplierSheet onClose={() => setSuppSheet(false)} onSave={(s) => { setForn(onAddSupplier(s)); setSuppSheet(false); }} />}
    </div>
  );
}

function LimitesAjuda() {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p><b>Mínimo:</b> avise quando a quantidade chegar a este valor. Será a referência para aviso de compra — nenhum alerta funciona nesta versão.</p>
      <p><b>Máximo desejado:</b> quanto você deseja manter no depósito. Não bloqueia recebimentos.</p>
    </div>
  );
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
function Chips({ label, hint, opts, value, onChange }: { label: string; hint: string; opts: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}
            className={`min-h-12 rounded-2xl border px-4 text-base font-semibold transition ${value === o ? "border-accent bg-accent/10 text-foreground" : "border-border bg-background-deep/60 text-muted-foreground hover:border-primary"}`}>{o}</button>
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
function VariationSheet({ index, vars, mainCode, used, onClose, onSave }: {
  index: number; vars: Variation[]; mainCode: string; used: Set<string>; onClose: () => void; onSave: (v: Variation) => void;
}) {
  const init = index >= 0 ? vars[index] : undefined;
  const [tam, setTam] = useState(init?.tam ?? ""); const [cor, setCor] = useState(init?.cor ?? "");
  const [cod, setCod] = useState(init?.codigo ?? ""); const [qtd, setQtd] = useState(init ? String(init.qtd) : "");
  const [scan, setScan] = useState(false); const [denied, setDenied] = useState(false);
  const errs = variationErrors({ tam, cor, codigo: cod }, index, vars, mainCode, used);
  const ok = !!tam && !!cor.trim() && Number(qtd) > 0 && !errs.combo && !errs.codigo;
  return (
    <Sheet title={index >= 0 ? "Editar variação" : "Nova variação"} onClose={onClose}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ tam, cor: cor.trim(), codigo: cod.trim(), qtd: Number(qtd) }); }} className="flex min-h-0 flex-col">
        <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
          <Chips label="Tamanho" hint="Letra ou número." opts={TAMANHOS} value={tam} onChange={setTam} />
          <Field label="Cor" name="vcor" enterKeyHint="next" onKeyDown={nextOnEnter("vcod")} placeholder="Ex.: Azul" value={cor} onChange={(e) => setCor(e.target.value)} hint="Cor desta peça."
            error={tam && cor.trim() && errs.combo ? errs.combo : ""} />
          <Field label="Código de barras" name="vcod" id="vcod" inputMode="numeric" autoComplete="off" enterKeyHint="next" onKeyDown={nextOnEnter("vqtd")} placeholder="Ex.: 7891234567890"
            value={cod} onChange={(e) => setCod(e.target.value.replace(/\s/g, "").slice(0, 60))}
            error={cod.trim() || init ? errs.codigo ?? "" : ""}
            hint={denied ? "Sem acesso à câmera. Você pode digitar o código." : "Código próprio deste tamanho e cor."}
            extra={<button type="button" onClick={() => { setDenied(false); setScan(true); }} className="flex min-h-9 items-center gap-1 text-sm font-semibold text-primary"><ScanLine size={16} /> Escanear</button>} />
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
function SupplierSheet({ onClose, onSave }: { onClose: () => void; onSave: (s: Omit<Supplier, "id">) => void }) {
  const [nome, setNome] = useState(""); const [tel, setTel] = useState(""); const [email, setEmail] = useState("");
  const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const ok = !!nome.trim() && emailOk && (!tel || digits(tel).length >= 10);
  return (
    <Sheet title="Novo fornecedor" onClose={onClose}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ nome: nome.trim(), tel, email }); }} className="flex min-h-0 flex-col">
        <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
          <Field label="Nome" name="fnome" autoComplete="organization" enterKeyHint="next" onKeyDown={nextOnEnter("ftel")} placeholder="Ex.: Distribuidora Sol" value={nome} onChange={(e) => setNome(e.target.value)} hint="Nome da empresa ou do vendedor." />
          <Field label="Telefone / WhatsApp" name="ftel" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" onKeyDown={nextOnEnter("femail")} placeholder="(11) 99999-9999" value={tel} onChange={(e) => setTel(maskPhone(e.target.value))} hint="Para fazer pedidos." />
          <Field label="E-mail" name="femail" type="email" inputMode="email" autoComplete="email" enterKeyHint="done" placeholder="Opcional" value={email} onChange={(e) => setEmail(e.target.value)} error={!emailOk ? "E-mail inválido." : ""} hint="Opcional." />
        </div>
        <div className="px-5 pt-2"><button type="submit" disabled={!ok} className={btnPrimary(ok)}>Salvar fornecedor</button></div>
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
