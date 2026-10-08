import { useEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, Check, CheckCircle2, Hammer, PawPrint, Wrench, MapPin, Pencil, Pill, Shirt, ShoppingCart, X, Loader2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/* ---------- utilidades ---------- */
export const digits = (v: string) => v.replace(/\D/g, "");
export const maskPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const maskCPF = (v: string) =>
  digits(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskCNPJ = (v: string) =>
  digits(v).slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
const maskCEP = (v: string) => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

function cpfOk(v: string) {
  const d = digits(v);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}
function cnpjOk(v: string) {
  const d = digits(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((a, x, i) => a + x * Number(d[i]), 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export const TIPOS = [
  { id: "mercado", nome: "Mercado", Icon: ShoppingCart, desc: "Controle de estoque, gôndola, validade e caixa." },
  { id: "farmacia", nome: "Farmácia", Icon: Pill, desc: "Controle de validade, lote e estoque de medicamentos." },
  { id: "roupas", nome: "Loja de roupas", Icon: Shirt, desc: "Variações de tamanho e cor em cada produto." },
  { id: "construcao", nome: "Material de construção", Icon: Hammer, desc: "Produtos por unidade, metro, caixa ou saco." },
  { id: "pet", nome: "Pet shop", Icon: PawPrint, desc: "Rações, acessórios e produtos com validade." },
  { id: "autopecas", nome: "Autopeças", Icon: Wrench, desc: "Peças por código, aplicação e localização." },
] as const;

const stepTitles = ["Qual é o seu tipo de comércio?", "Dados do comércio", "Onde fica o seu comércio?", "Confira os dados"];

export const nextOnEnter = (id: string) => (ev: KeyboardEvent<HTMLInputElement>) => {
  if (ev.key !== "Enter") return;
  ev.preventDefault();
  document.getElementById(id)?.focus();
};

/* ---------- teclado ---------- */
export function useKeyboard() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      const h = vv ? vv.height : window.innerHeight;
      root.style.setProperty("--app-h", `${h}px`);
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      const kb = typing && window.innerHeight - h > 120;
      setOpen(kb);
      if (kb) {
        window.scrollTo(0, 0);
        setTimeout(() => {
          if (!el) return;
          const box = el.closest("[data-kb-scroll]");
          if (box) {
            const next = Array.from(box.querySelectorAll('label:has(input[type="checkbox"])')).find(
              (c) => !!(el.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING),
            );
            next?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 80);
      }
    };
    const out = () => setTimeout(update, 50);
    update();
    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", out);
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", out);
      root.style.removeProperty("--app-h");
    };
  }, []);
  return open;
}

/* ---------- peças visuais ---------- */
export const inputCls = (err?: boolean) =>
  `h-13 w-full rounded-2xl border bg-background-deep/60 px-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground/60 focus-visible:ring-2 tiny:h-12 ${
    err ? "border-destructive focus-visible:ring-destructive/40" : "border-border focus-visible:border-primary focus-visible:ring-ring/40"
  }`;

export function Field({ label, hint, error, extra, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string; extra?: ReactNode }) {
  const id = props.id ?? props.name;
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-muted-foreground short:text-xs">{label}</label>
        {extra}
      </div>
      <input id={id} {...props} aria-invalid={!!error} className={inputCls(!!error)} />
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="field-hint text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CheckBox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1 text-sm text-muted-foreground">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(x) => onChange(x.target.checked)} />
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${checked ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>
        {checked && <Check size={16} strokeWidth={3} />}
      </span>
      {children}
    </label>
  );
}

export const btnPrimary = (ready: boolean) =>
  `min-h-13 w-full rounded-2xl px-4 text-base font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
    ready ? "bg-primary text-primary-foreground shadow-primary hover:brightness-110 active:scale-[0.98]" : "cursor-not-allowed border border-border bg-secondary text-muted-foreground opacity-60"
  }`;
export const btnGhost =
  "min-h-13 shrink-0 rounded-2xl border border-border px-5 text-base font-semibold text-foreground transition hover:border-primary focus-visible:outline-2 focus-visible:outline-ring";

/* ---------- tela ---------- */
type Addr = { rua: string; bairro: string; cidade: string; uf: string };

export type StoreData = { id?: string; tipo: string; nome: string; cidade: string; uf: string; rua: string; numero: string; bairro: string };
export const TIPO_TO_DB: Record<string, string> = { mercado: "mercado", farmacia: "farmacia", roupas: "loja_roupas", construcao: "material_construcao", pet: "pet_shop", autopecas: "autopecas" };
export const TIPO_FROM_DB: Record<string, string> = Object.fromEntries(Object.entries(TIPO_TO_DB).map(([a, b]) => [b, a]));

export function StoreSetup({ mode = "first", onFinish, onCancel }: { mode?: "first" | "add"; onFinish?: (s: StoreData) => void; onCancel?: () => void } = {}) {
  const kb = useKeyboard();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [fromReview, setFromReview] = useState(false);
  const [done, setDone] = useState(false);

  const [tipo, setTipo] = useState<string>("");
  const [nome, setNome] = useState("");
  const [docType, setDocType] = useState<"CNPJ" | "CPF">("CNPJ");
  const [doc, setDoc] = useState("");
  const [tel, setTel] = useState("");
  const [zap, setZap] = useState(false);
  const [cep, setCep] = useState("");
  const [addr, setAddr] = useState<Addr | null>(null);
  const [cepState, setCepState] = useState<"idle" | "loading" | "error">("idle");
  const [addrMode, setAddrMode] = useState<"full" | "city" | "manual" | null>(null);
  const [numero, setNumero] = useState("");
  const [semNumero, setSemNumero] = useState(false);
  const [compl, setCompl] = useState("");
  const [sheet, setSheet] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const lastCep = useRef("");

  useEffect(() => {
    const d = digits(cep);
    if (d.length !== 8 || d === lastCep.current) return;
    lastCep.current = d;
    setCepState("loading");
    let alive = true;
    type R = { kind: "ok"; a: Addr } | { kind: "notfound" } | { kind: "fail" };
    const viacep = async (): Promise<R> => {
      try {
        const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
        if (!r.ok) return { kind: "fail" };
        const j = await r.json();
        if (j.erro) return { kind: "notfound" };
        return { kind: "ok", a: { rua: j.logradouro ?? "", bairro: j.bairro ?? "", cidade: j.localidade ?? "", uf: j.uf ?? "" } };
      } catch { return { kind: "fail" }; }
    };
    const brasilapi = async (): Promise<R> => {
      try {
        const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${d}`);
        if (r.status === 404) return { kind: "notfound" };
        if (!r.ok) return { kind: "fail" };
        const j = await r.json();
        return { kind: "ok", a: { rua: j.street ?? "", bairro: j.neighborhood ?? "", cidade: j.city ?? "", uf: j.state ?? "" } };
      } catch { return { kind: "fail" }; }
    };
    (async () => {
      let res = await viacep();
      if (res.kind === "fail") res = await brasilapi();
      if (!alive) return;
      if (res.kind === "ok" && res.a.cidade && res.a.uf) {
        const full = !!res.a.rua.trim() && !!res.a.bairro.trim();
        setAddr(res.a);
        setAddrMode(full ? "full" : "city");
        setCepState("idle");
      } else if (res.kind === "fail") {
        setCepState("idle");
        setAddrMode("manual");
        setAddr((a) => a ?? { rua: "", bairro: "", cidade: "", uf: "" });
      } else {
        setCepState("error");
        setAddrMode(null);
        setAddr((a) => a ?? { rua: "", bairro: "", cidade: "", uf: "" });
        setSheet(true);
      }
    })();
    return () => { alive = false; };
  }, [cep]);

  const docValid = docType === "CNPJ" ? cnpjOk(doc) : cpfOk(doc);
  const docLen = docType === "CNPJ" ? 14 : 11;
  const errs = {
    nome: !nome.trim() ? "Informe o nome do comércio." : "",
    doc: !digits(doc) ? `Informe o ${docType}.` : digits(doc).length < docLen ? `${docType} incompleto.` : !docValid ? `${docType} inválido, confira os números` : "",
    tel: digits(tel).length < 10 ? "Telefone incompleto." : "",
    numero: !semNumero && !numero.trim() ? "Informe o número." : "",
  };
  const addrOk = !!addr && !!addr.rua.trim() && !!addr.bairro.trim() && !!addr.cidade.trim() && !!addr.uf;
  const valid = [
    !!tipo,
    !errs.nome && !errs.doc && !errs.tel,
    digits(cep).length === 8 && addrOk && !errs.numero,
    true,
  ][step]!;

  const go = (to: number) => { setDir(to > step ? 1 : -1); setStep(to); };
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [savedId, setSavedId] = useState<string | undefined>();
  const save = async () => {
    if (saving) return;
    setSaving(true); setSaveErr("");
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { data, error } = await supabase.from("comercios").insert({
        dono_id: u.user.id,
        tipo: TIPO_TO_DB[tipo] as Database["public"]["Enums"]["tipo_comercio"],
        nome: nome.trim(),
        documento_tipo: docType.toLowerCase(),
        documento: digits(doc),
        telefone: digits(tel),
        telefone_whatsapp: zap,
        cep: digits(cep),
        rua: (addr?.rua ?? "").trim(),
        bairro: (addr?.bairro ?? "").trim(),
        cidade: (addr?.cidade ?? "").trim(),
        uf: (addr?.uf ?? "").trim().toUpperCase().slice(0, 2),
        sem_numero: semNumero,
        numero: semNumero ? null : numero.trim(),
        complemento: compl.trim() || null,
      }).select("id").single();
      if (error) {
        setSaveErr(error.code === "23505" ? `Você já cadastrou um comércio com este ${docType}.` : "Não foi possível salvar o comércio. Verifique sua internet e tente novamente.");
        return;
      }
      setSavedId(data.id);
      if (mode === "add") onFinish?.(build(data.id)); else setDone(true);
    } catch {
      setSaveErr("Não foi possível salvar o comércio. Verifique sua internet e tente novamente.");
    } finally { setSaving(false); }
  };
  const next = () => {
    if (!valid) return;
    if (step === 3) return void save();
    if (fromReview) { setFromReview(false); return go(3); }
    go(step + 1);
  };
  const edit = (s: number) => { setFromReview(true); go(s); };
  const tipoNome = TIPOS.find((t) => t.id === tipo)?.nome ?? "";
  const build = (id?: string): StoreData => ({ id, tipo, nome: nome.trim(), cidade: addr?.cidade ?? "", uf: addr?.uf ?? "", rua: addr?.rua ?? "", numero: semNumero ? "s/n" : numero, bairro: addr?.bairro ?? "" });
  const finish = () => onFinish?.(build(savedId));

  return (
    <div className="relative h-app overflow-hidden bg-app">
      <div className="pointer-events-none absolute inset-0 bg-dots" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-24 bg-glow" />
      <main className={`app-top relative flex h-full flex-col items-center overflow-hidden ${kb ? "app-top-kb" : ""}`}>
        <div className="flex h-full max-h-full w-full max-w-[480px] flex-col sm:relative sm:h-auto sm:rounded-3xl sm:border sm:border-border sm:bg-card sm:p-8 sm:backdrop-blur-xl short:sm:p-6">
          {/* logo mini fixa */}
          {mode === "add" && (
            <button type="button" onClick={onCancel} aria-label="Cancelar" className="absolute right-3 top-3 z-10 flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground hover:text-foreground sm:right-4 sm:top-4" style={{ marginTop: "env(safe-area-inset-top)" }}>
              <X size={22} />
            </button>
          )}
          <div className={`flex shrink-0 items-center justify-center gap-2.5 overflow-hidden transition-all duration-300 ${kb ? "max-h-0 opacity-0" : "max-h-16 opacity-100"}`}>
            <LogoMark size={40} />
            <span className="whitespace-nowrap text-base font-bold tracking-[0.16em] text-foreground">
              OMNI SAFE <span className="text-accent">360</span>
            </span>
          </div>

          {done ? (
            <Success nome={nome} onContinue={finish} />
          ) : (
            <form noValidate onSubmit={(ev) => { ev.preventDefault(); next(); }} className="flex min-h-0 flex-1 flex-col">
              <div className={`shrink-0 overflow-hidden text-center transition-all duration-300 ${kb ? "max-h-0 opacity-0" : "mt-5 max-h-24 opacity-100 short:mt-3 tiny:mt-2"}`}>
                  <h1 className="text-xl font-bold text-foreground short:text-lg tiny:text-base">{mode === "add" ? "Adicionar comércio" : "Vamos cadastrar o seu comércio"}</h1>
                  <p className="mt-1 text-sm text-muted-foreground tiny:hidden">Leva menos de 2 minutos. Você pode mudar tudo depois.</p>
              </div>
              <div className={`shrink-0 transition-all duration-300 ${kb ? "mt-0" : "mt-5 short:mt-3 tiny:mt-2"}`}>
                <div className={`flex items-center justify-between gap-2 ${kb ? "mb-1.5" : "mb-2"}`}>
                  {kb && <span className="shrink-0"><LogoMark size={20} /></span>}
                  <span className="min-w-0 truncate text-base font-semibold text-foreground short:text-sm">{stepTitles[step]}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">Passo {step + 1} de 4</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-progress transition-all duration-500" style={{ width: `${((step + 1) / 4) * 100}%` }} />
                </div>
              </div>

              <div key={step} data-kb-scroll className={`min-h-0 flex-1 overflow-y-auto overscroll-contain animate-in fade-in duration-300 ${kb ? "mt-2 space-y-2 pb-1 [&_.field-hint]:hidden" : "mt-4 space-y-3 short:mt-3 short:space-y-2.5 tiny:mt-2.5 tiny:space-y-2"} ${dir === 1 ? "slide-in-from-right-8" : "slide-in-from-left-8"}`}>
                {step === 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-3 tiny:gap-2">
                      {TIPOS.map(({ id, nome: n, Icon }) => {
                        const on = tipo === id;
                        return (
                          <button key={id} type="button" aria-pressed={on} onClick={() => setTipo(id)}
                            className={`relative flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-2xl border bg-background-deep/60 px-2 py-3 text-center text-sm font-semibold text-foreground transition focus-visible:outline-2 focus-visible:outline-ring short:min-h-[76px] short:gap-1.5 short:py-2 tiny:min-h-[60px] tiny:gap-1 tiny:text-xs ${on ? "border-accent bg-accent/10" : "border-border hover:border-primary"}`}>
                            <Icon size={28} className={`shrink-0 short:h-6 short:w-6 tiny:h-5 tiny:w-5 ${on ? "text-accent" : "text-primary"}`} />
                            <span className="leading-tight">{n}</span>
                            {on && (
                              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground tiny:h-4 tiny:w-4">
                                <Check size={13} strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <Collapse show={!!tipo}>
                      <p key={tipo} className="text-center text-sm font-medium text-accent animate-in fade-in duration-300 tiny:text-xs">
                        {TIPOS.find((t) => t.id === tipo)?.desc}
                      </p>
                    </Collapse>
                    <p className="text-center text-xs text-muted-foreground">Isso adapta o sistema ao seu negócio: unidades de medida e variações dos produtos.</p>
                  </>
                )}

                {step === 1 && (
                  <>
                    <Field label="Nome do comércio" name="nome" autoComplete="organization" enterKeyHint="next" placeholder="Ex.: Mercado Bom Preço"
                      onKeyDown={nextOnEnter("doc")} value={nome} onChange={(x) => setNome(x.target.value)} onBlur={blur("nome")}
                      error={touched["nome"] ? errs.nome : ""} hint="O nome que seus clientes conhecem." />
                    <Field label="Documento" name="doc" inputMode="numeric" autoComplete="off" enterKeyHint="next"
                      placeholder={docType === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                      onKeyDown={nextOnEnter("tel")} value={doc}
                      onChange={(x) => setDoc(docType === "CNPJ" ? maskCNPJ(x.target.value) : maskCPF(x.target.value))}
                      onBlur={blur("doc")} error={touched["doc"] ? errs.doc : ""}
                      extra={
                        <div role="radiogroup" className="flex rounded-xl border border-border bg-background-deep/60 p-0.5">
                          {(["CNPJ", "CPF"] as const).map((t) => (
                            <button key={t} type="button" role="radio" aria-checked={docType === t}
                              onClick={() => { setDocType(t); setDoc(""); setTouched((s) => ({ ...s, doc: false })); }}
                              className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${docType === t ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
                              {t}
                            </button>
                          ))}
                        </div>
                      }
                      hint={docType === "CNPJ" ? (
                        <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setDocType("CPF"); setDoc(""); }}>Ainda não tenho CNPJ</button>
                      ) : "Use seu CPF enquanto não tem CNPJ."} />
                    <Field label="Telefone do comércio" name="tel" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="done" placeholder="(11) 99999-9999"
                      value={tel} onChange={(x) => setTel(maskPhone(x.target.value))} onBlur={blur("tel")}
                      error={touched["tel"] ? errs.tel : ""} hint="Para contato com o comércio." />
                    <CheckBox checked={zap} onChange={setZap}>Este número tem WhatsApp</CheckBox>
                  </>
                )}

                {step === 2 && (
                  <>
                    <Field label="CEP" name="cep" inputMode="numeric" autoComplete="postal-code" enterKeyHint="next" placeholder="00000-000"
                      onKeyDown={nextOnEnter("numero")} value={cep}
                      onChange={(x) => { setCep(maskCEP(x.target.value)); if (cepState === "error") setCepState("idle"); }}
                      error={cepState === "error" ? "Não encontramos esse CEP. Preencha o endereço manualmente." : ""}
                      hint={cepState === "loading" ? <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Buscando endereço...</span> : "Buscamos o endereço para você."} />
                    {addr && addrMode === "city" && cepState !== "loading" && (
                      <>
                        <div className="flex items-center gap-3 rounded-2xl border border-border bg-background-deep/60 p-3 animate-in fade-in duration-300">
                          <MapPin size={20} className="shrink-0 text-accent" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">{addr.cidade} - {addr.uf}</p>
                            <p className="text-xs leading-snug text-muted-foreground">Esse CEP é geral da cidade. Informe a rua e o bairro do seu comércio.</p>
                          </div>
                          <button type="button" onClick={() => setSheet(true)} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:underline">
                            <Pencil size={13} /> Alterar
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <Field label="Rua" name="rua" autoComplete="address-line1" enterKeyHint="next" onKeyDown={nextOnEnter("bairro")} value={addr.rua} onChange={(x) => setAddr({ ...addr, rua: x.target.value })} placeholder="Rua ou avenida" />
                          <Field label="Bairro" name="bairro" enterKeyHint="next" onKeyDown={nextOnEnter("numero")} value={addr.bairro} onChange={(x) => setAddr({ ...addr, bairro: x.target.value })} placeholder="Bairro" />
                        </div>
                      </>
                    )}
                    {addr && addrMode === "manual" && cepState !== "loading" && (
                      <>
                        <p role="alert" className="text-xs font-medium text-destructive">Não conseguimos buscar agora. Preencha o endereço manualmente.</p>
                        <div className="grid grid-cols-2 gap-2.5">
                          <Field label="Rua" name="rua" autoComplete="address-line1" enterKeyHint="next" onKeyDown={nextOnEnter("bairro")} value={addr.rua} onChange={(x) => setAddr({ ...addr, rua: x.target.value })} placeholder="Rua ou avenida" />
                          <Field label="Bairro" name="bairro" enterKeyHint="next" onKeyDown={nextOnEnter("cidade")} value={addr.bairro} onChange={(x) => setAddr({ ...addr, bairro: x.target.value })} placeholder="Bairro" />
                          <Field label="Cidade" name="cidade" autoComplete="address-level2" enterKeyHint="next" onKeyDown={nextOnEnter("numero")} value={addr.cidade} onChange={(x) => setAddr({ ...addr, cidade: x.target.value })} placeholder="Cidade" />
                          <div className="space-y-1">
                            <label htmlFor="uf-inline" className="text-sm font-medium text-muted-foreground">Estado</label>
                            <select id="uf-inline" value={addr.uf} onChange={(x) => setAddr({ ...addr, uf: x.target.value })} className={inputCls()}>
                              <option value="">Selecione</option>
                              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                    {addr && addrOk && addrMode !== "city" && addrMode !== "manual" && (
                      <div className="flex items-center gap-3 rounded-2xl border border-border bg-background-deep/60 p-3 animate-in fade-in duration-300">
                        <MapPin size={20} className="shrink-0 text-accent" />
                        <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">
                          {addr.rua}, {addr.bairro}, {addr.cidade} - {addr.uf}
                        </p>
                        <button type="button" onClick={() => setSheet(true)} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:underline">
                          <Pencil size={13} /> Editar
                        </button>
                      </div>
                    )}
                    {addr && !addrOk && addrMode !== "city" && addrMode !== "manual" && cepState !== "loading" && (
                      <button type="button" onClick={() => setSheet(true)} className="text-sm font-semibold text-primary hover:underline">Preencher endereço</button>
                    )}
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="Número" name="numero" inputMode="numeric" autoComplete="address-line2" enterKeyHint="next" placeholder="123"
                        disabled={semNumero} onKeyDown={nextOnEnter("compl")} value={semNumero ? "" : numero}
                        onChange={(x) => setNumero(x.target.value)} onBlur={blur("numero")}
                        error={touched["numero"] ? errs.numero : ""} hint="Da fachada." />
                      <Field label="Complemento" name="compl" autoComplete="address-line3" enterKeyHint="done" placeholder="Opcional"
                        value={compl} onChange={(x) => setCompl(x.target.value)} hint="Sala, loja..." />
                    </div>
                    <CheckBox checked={semNumero} onChange={setSemNumero}>Sem número</CheckBox>
                  </>
                )}

                {step === 3 && (
                  <div className="divide-y divide-border rounded-2xl border border-border bg-background-deep/60">
                    <Summary title="Tipo de comércio" onEdit={() => edit(0)}>{tipoNome}</Summary>
                    <Summary title="Dados" onEdit={() => edit(1)}>
                      {nome}<br />{docType} {doc} · {tel}{zap ? " (WhatsApp)" : ""}
                    </Summary>
                    <Summary title="Endereço" onEdit={() => edit(2)}>
                      {addr?.rua}, {semNumero ? "s/n" : numero}{compl ? ` - ${compl}` : ""}<br />
                      {addr?.bairro}, {addr?.cidade} - {addr?.uf} · {cep}
                    </Summary>
                  </div>
                )}
              </div>

              <div className={`flex shrink-0 gap-2 ${kb ? "pt-2" : "pt-4 short:pt-3"}`}>
                {step > 0 && (
                  <button type="button" onClick={() => { setFromReview(false); go(step - 1); }} className={btnGhost} aria-label="Voltar">
                    <span className="flex items-center gap-1.5"><ArrowLeft size={18} />Voltar</span>
                  </button>
                )}
                {step === 3 && saveErr && <p role="alert" className="absolute -top-6 left-0 right-0 text-center text-xs text-destructive">{saveErr}</p>}
                <button type="submit" disabled={!valid || saving} aria-disabled={!valid || saving} className={`flex-1 ${btnPrimary(valid && !saving)}`}>
                  {step === 3 ? (saving ? "Salvando..." : "Cadastrar meu comércio") : "Continuar"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      {sheet && addr && (
        <AddressSheet initial={addr} onClose={() => setSheet(false)} onSave={(a) => { setAddr(a); setSheet(false); setCepState("idle"); setAddrMode("full"); }} />
      )}
    </div>
  );
}

export function Collapse({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${show ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function Summary({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-3.5 tiny:p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className="mt-0.5 break-words text-sm text-foreground">{children}</p>
      </div>
      <button type="button" onClick={onEdit} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:underline">
        <Pencil size={13} /> Editar
      </button>
    </div>
  );
}

function AddressSheet({ initial, onClose, onSave }: { initial: Addr; onClose: () => void; onSave: (a: Addr) => void }) {
  const [a, setA] = useState(initial);
  const ok = !!a.rua.trim() && !!a.bairro.trim() && !!a.cidade.trim() && !!a.uf;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-background-deep/70 animate-in fade-in duration-200" />
      <div role="dialog" aria-modal="true" aria-label="Editar endereço"
        className="relative flex max-h-[90%] w-full max-w-[480px] flex-col rounded-t-3xl border border-b-0 border-border bg-background animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="flex shrink-0 items-center justify-between px-5 pt-4">
          <h2 className="text-base font-semibold text-foreground">Endereço do comércio</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <form noValidate onSubmit={(e) => { e.preventDefault(); if (ok) onSave(a); }} className="flex min-h-0 flex-col">
          <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
            <Field label="Rua" name="rua" autoComplete="address-line1" enterKeyHint="next" onKeyDown={nextOnEnter("bairro")} value={a.rua} onChange={(x) => setA({ ...a, rua: x.target.value })} hint="Nome da rua ou avenida." />
            <Field label="Bairro" name="bairro" enterKeyHint="next" onKeyDown={nextOnEnter("cidade")} value={a.bairro} onChange={(x) => setA({ ...a, bairro: x.target.value })} hint="Bairro do comércio." />
            <Field label="Cidade" name="cidade" autoComplete="address-level2" enterKeyHint="done" value={a.cidade} onChange={(x) => setA({ ...a, cidade: x.target.value })} hint="Cidade do comércio." />
            <div className="space-y-1">
              <label htmlFor="uf" className="text-sm font-medium text-muted-foreground">Estado</label>
              <select id="uf" value={a.uf} onChange={(x) => setA({ ...a, uf: x.target.value })} className={inputCls()}>
                <option value="">Selecione</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="shrink-0 px-5 pt-2">
            <button type="submit" disabled={!ok} className={btnPrimary(ok)}>Salvar endereço</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Success({ nome, onContinue }: { nome: string; onContinue: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center animate-in fade-in zoom-in-95 duration-500">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/15 animate-in zoom-in-50 duration-700">
        <CheckCircle2 size={56} className="text-accent" />
      </span>
      <h1 className="text-xl font-bold text-foreground">Tudo certo! Seu comércio está pronto</h1>
      <p className="text-base font-semibold text-accent">{nome}</p>
      <p className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Modo de demonstração: nenhum dado foi salvo.</p>
      <button type="button" onClick={onContinue} className={`mt-3 ${btnPrimary(true)}`}>Ir para meu painel</button>
    </div>
  );
}

/** Animação "Entrando..." com o anel girando em volta da logo. */
export function Entering() {
  return (
    <div className="relative flex h-app items-center justify-center overflow-hidden bg-app">
      <div className="pointer-events-none absolute inset-0 bg-dots" />
      <div className="flex flex-col items-center gap-5 animate-in fade-in duration-300">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-accent border-r-primary" />
          <LogoMark size={80} />
        </div>
        <p className="text-sm font-semibold tracking-wider text-muted-foreground">Entrando...</p>
      </div>
    </div>
  );
}
