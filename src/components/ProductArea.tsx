import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Check, CheckCircle2, Keyboard, Package, Pencil, Plus, ScanLine, Search, Truck, X } from "lucide-react";
import { Field, btnGhost, btnPrimary, digits, maskPhone, nextOnEnter, useKeyboard, type StoreData } from "@/components/StoreSetup";
import { Scanner } from "@/components/Scanner";
import { CONSTRUCAO_VARS_MSG, CONTROLADO_MSG, ESPECIE_MSG, PET_VARS_MSG, FARMACIA_VARS_MSG, firstInvalidStep, typeRuleError, type TypeRules, mainCodeError, usedCodes, variationErrors, variationOk } from "@/lib/variations";

/* ---------- tipos e dados por comércio ---------- */
export type Supplier = { id: number; nome: string; tel: string; email: string };
export type Variation = { tam: string; cor: string; qtd: number; codigo?: string | undefined };
export type Product = {
  id: number; codigo: string; nome: string; compra: number; venda: number; unidade: string; categoria: string;
  detalhes: Record<string, string>; variacoes: Variation[]; fornecedor: number | null;
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
            {p.variacoes.map((v, i) => <span key={i} className="block">{v.tam} · {v.cor} · Cód. {v.codigo || "sem código"} · {v.qtd} un.</span>)}
          </Row>
        )}
        <Row t="Fornecedor">{f ? <>{f.nome}{f.tel ? ` · ${f.tel}` : ""}</> : "Definir depois"}</Row>
      </div>
      <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Depósito e gôndola: configuraremos na próxima etapa.</p>
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

/* ---------- cadastro em 5 etapas ---------- */
const TITLES = ["Qual é o código do produto?", "Preço e unidade", "Detalhes do produto", "Quem é o fornecedor?", "Conferir e salvar"];

export function ProductWizard({ store, products, initial, suppliers, onAddSupplier, onCancel, onSave }: {
  store: StoreData; products: Product[]; initial?: Product | undefined; suppliers: Supplier[];
  onAddSupplier: (s: Omit<Supplier, "id">) => number; onCancel: () => void; onSave: (p: Product) => void;
}) {
  const kb = useKeyboard();
  const tipo = store.tipo;
  const [step, setStep] = useState(0);
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
  const [vars, setVars] = useState<Variation[]>(initial?.variacoes ?? []);
  const [forn, setForn] = useState<number | null | undefined>(initial ? initial.fornecedor : undefined);
  const [varSheet, setVarSheet] = useState<number | null>(null);
  const [suppSheet, setSuppSheet] = useState(false);

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
    : undefined;
  const ruleErr = typeRuleError({ unidade, categoria, variacoes: vars, detalhes: det }, rules);
  const dup = !!codeErr;
  const varsOk = vars.length > 0 && vars.every((v, i) => variationOk(v, i, vars, codigo, used));
  const valid = [
    !!codigo.trim() && !dup && !!nome.trim(),
    compra > 0 && venda > 0 && !!unidade && !!categoria && ruleErr?.step !== 1,
    (!isRoupas || varsOk) && ruleErr?.step !== 2,
    forn !== undefined,
    true,
  ][step]!;
  const lucro = venda - compra;
  const margem = venda > 0 ? (lucro / venda) * 100 : 0;
  const fornNome = forn ? suppliers.find((s) => s.id === forn)?.nome : "Definir depois";

  const go = (to: number) => { setDir(to > step ? 1 : -1); setStep(to); };
  const bad = firstInvalidStep({ codigo, nome, compra, venda, unidade, categoria, variacoes: vars, detalhes: det, fornecedor: forn }, isRoupas, used, rules);
  const saveErr = triedSave && bad && bad.step === step ? bad.msg : ruleErr && ruleErr.step === step ? ruleErr.msg : "";
  const save = () => {
    if (bad) { setTriedSave(true); setFromReview(true); return go(bad.step); }
    onSave({ id: initial?.id ?? Date.now(), codigo: codigo.trim(), nome: nome.trim(), compra, venda, unidade, categoria, detalhes: det, variacoes: vars, fornecedor: forn ?? null });
  };
  const next = () => {
    if (!valid) return;
    if (step === 4) return save();
    if (fromReview) { setFromReview(false); return go(4); }
    go(step + 1);
  };
  const edit = (s: number) => { setFromReview(true); go(s); };

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
                <h1 className="min-w-0 text-lg font-bold short:text-base">{TITLES[step]}</h1>
                <span className="shrink-0 text-xs text-muted-foreground">Passo {step + 1} de 5</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-progress transition-all duration-500" style={{ width: `${((step + 1) / 5) * 100}%` }} />
              </div>
            </div>

            <div key={step} data-kb-scroll className={`min-h-0 flex-1 overflow-y-auto overscroll-contain animate-in fade-in duration-300 ${kb ? "mt-2 space-y-2 pb-1 [&_.field-hint]:hidden" : "mt-4 space-y-3 short:mt-3 short:space-y-2.5"} ${dir === 1 ? "slide-in-from-right-8" : "slide-in-from-left-8"}`}>
              {saveErr && step !== 4 && <p role="alert" className="text-sm font-semibold text-destructive">{saveErr}</p>}
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
                  <Chips label="Unidade de medida" hint="Como você vende este produto." opts={UNIDADES[tipo] ?? []} value={unidade} onChange={setUnidade} />
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
                          <span key={i} className={`flex items-center gap-1 rounded-full border py-1 pl-1 pr-1 text-sm ${bad ? "border-destructive/70 bg-destructive/10" : "border-accent/50 bg-accent/10"}`}>
                            <button type="button" aria-label="Editar variação" onClick={() => setVarSheet(i)} className="flex min-h-8 items-center gap-1 rounded-full px-2 hover:bg-accent/20">
                              {v.tam} · {v.cor} · {v.codigo || "sem código"} · {v.qtd} <Pencil size={12} />
                            </button>
                            <button type="button" aria-label="Remover variação" onClick={() => setVars(vars.filter((_, j) => j !== i))} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent/20"><X size={14} /></button>
                          </span>
                        ); })}
                      </div>
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

              {step === 4 && (
                <div className="divide-y divide-border rounded-2xl border border-border bg-background-deep/60">
                  <Sum t="Código e nome" onEdit={() => edit(0)}>{nome}<br />Cód. {codigo}</Sum>
                  <Sum t="Preços" onEdit={() => edit(1)}>{brl2(compra)} → {brl2(venda)} / {unidade}<br />{categoria} · margem {margem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</Sum>
                  <Sum t="Detalhes" onEdit={() => edit(2)}>
                    {Object.entries(det).filter(([, v]) => v).map(([k, v]) => `${labelOf(tipo, k)}: ${v}`).join(" · ") || (vars.length ? "" : "Nenhum")}
                    {vars.length > 0 && <><br />{vars.map((v) => `${v.tam}/${v.cor}/Cód. ${v.codigo || "—"}/${v.qtd}`).join(", ")}</>}
                  </Sum>
                  <Sum t="Fornecedor" onEdit={() => edit(3)}>{fornNome}</Sum>
                </div>
              )}
            </div>

            <div className={`flex shrink-0 gap-2 ${kb ? "pt-2" : "pt-4 short:pt-3"}`}>
              {step > 0 && (
                <button type="button" onClick={() => { setFromReview(false); go(step - 1); }} className={btnGhost}><span className="flex items-center gap-1.5"><ArrowLeft size={18} />Voltar</span></button>
              )}
              {step === 2 && !isRoupas && !Object.values(det).some(Boolean) ? (
                <button type="submit" className={`flex-1 ${btnPrimary(true)}`}>Pular</button>
              ) : (
                <button type="submit" disabled={!valid} className={`flex-1 ${btnPrimary(valid)}`}>{step === 4 ? "Salvar produto" : "Continuar"}</button>
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
        onSave={(v) => { setVars(varSheet < 0 ? [...vars, v] : vars.map((x, j) => (j === varSheet ? v : x))); setVarSheet(null); }} />}
      {suppSheet && <SupplierSheet onClose={() => setSuppSheet(false)} onSave={(s) => { setForn(onAddSupplier(s)); setSuppSheet(false); }} />}
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
