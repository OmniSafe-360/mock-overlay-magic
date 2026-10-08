import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { Eye, EyeOff, Check, CheckCircle2, ArrowLeft, MailCheck } from "lucide-react";
import { Logo, LogoMark } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — Omni Safe 360" },
      { name: "description", content: "Acesse o Omni Safe 360: estoque, gôndola, PDV e antifurto para qualquer comércio." },
      { property: "og:title", content: "Entrar — Omni Safe 360" },
      { property: "og:description", content: "Controle inteligente de estoque, PDV e antifurto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

function GoogleIcon({ small }: { small?: boolean }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-foreground ${small ? "h-6 w-6" : "h-8 w-8"}`}>
      <svg width={small ? 14 : 18} height={small ? 14 : 18} viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    </span>
  );
}

function Field({
  label, error, hint, toggle, ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; toggle?: boolean }) {
  const [show, setShow] = useState(false);
  const id = props.id ?? props.name;
  return (
    <div className="space-y-1.5 short:space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground short:text-xs">{label}</label>
      <div className="relative">
        <input
          id={id}
          {...props}
          type={toggle ? (show ? "text" : "password") : props.type}
          aria-invalid={!!error}
          className={`h-13 w-full rounded-2xl border bg-background-deep/60 px-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground/60 focus-visible:ring-2 short:h-12 tiny:h-11 ${
            error ? "border-destructive focus-visible:ring-destructive/40" : "border-border focus-visible:border-primary focus-visible:ring-ring/40"
          } ${toggle ? "pr-12" : ""}`}
        />
        {toggle && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function GoogleButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-primary transition hover:brightness-110 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent tiny:min-h-12">
      <GoogleIcon />
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground short:my-3 tiny:my-2">
      <span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" />
    </div>
  );
}

const submitCls = (ready: boolean) =>
  `h-13 w-full rounded-2xl text-base font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent short:h-12 tiny:h-11 ${
    ready
      ? "bg-primary text-primary-foreground shadow-primary hover:brightness-110 active:scale-[0.98]"
      : "cursor-not-allowed border border-border bg-secondary text-muted-foreground opacity-60"
  }`;

const ghostCls =
  "h-13 shrink-0 rounded-2xl border border-border px-5 text-base font-semibold text-foreground transition hover:border-primary focus-visible:outline-2 focus-visible:outline-ring short:h-12 tiny:h-11";

const nextOnEnter = (id: string, ok = true) => (ev: KeyboardEvent<HTMLInputElement>) => {
  if (ev.key !== "Enter") return;
  ev.preventDefault();
  if (ok) document.getElementById(id)?.focus();
};

const passRules = [
  { label: "Mínimo de 8 caracteres", test: (s: string) => s.length >= 8 },
  { label: "Uma letra maiúscula", test: (s: string) => /[A-Z]/.test(s) },
  { label: "Uma letra minúscula", test: (s: string) => /[a-z]/.test(s) },
  { label: "Um número", test: (s: string) => /\d/.test(s) },
];

function PasswordStrength({ value }: { value: string }) {
  const score = passRules.filter((r) => r.test(value)).length;
  const level = !value ? 0 : score <= 2 ? 1 : score === 3 ? 2 : 3;
  const meta = [
    { t: "", bar: "", txt: "" },
    { t: "Fraca", bar: "bg-destructive", txt: "text-destructive" },
    { t: "Média", bar: "bg-warning", txt: "text-warning" },
    { t: "Forte", bar: "bg-accent", txt: "text-accent" },
  ][level]!;
  return (
    <div className="space-y-2 pt-2 short:space-y-1.5 short:pt-1.5">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-3 gap-1.5">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-colors ${i <= level ? meta.bar : "bg-secondary"}`} />
          ))}
        </div>
        <span className={`w-12 text-right text-xs font-semibold ${meta.txt}`}>{meta.t}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        {passRules.map((r) => {
          const ok = r.test(value);
          return (
            <li key={r.label} className={`flex min-w-0 items-center gap-1.5 text-[11px] leading-tight transition-colors sm:text-xs ${ok ? "text-accent" : "text-muted-foreground"}`}>
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${ok ? "bg-accent text-accent-foreground" : "bg-secondary"}`}>
                <Check size={11} strokeWidth={3} className={ok ? "" : "opacity-40"} />
              </span>
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const [v, setV] = useState({ email: "", senha: "" });
  const [sub, setSub] = useState(false);
  const e = {
    email: !v.email ? "Informe seu e-mail." : !emailOk(v.email) ? "E-mail inválido." : "",
    senha: !v.senha ? "Informe sua senha." : "",
  };
  const ready = !!v.email && !!v.senha;
  return (
    <form noValidate onSubmit={(ev) => { ev.preventDefault(); setSub(true); }} className="space-y-4 short:space-y-2.5">
      <GoogleButton>Entrar com Google</GoogleButton>
      <Divider />
      <Field label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" enterKeyHint="next" placeholder="voce@empresa.com"
        onKeyDown={nextOnEnter("senha")} value={v.email} onChange={(x) => setV({ ...v, email: x.target.value })} error={sub ? e.email : ""} />
      <div className="space-y-2 short:space-y-1">
        <Field label="Senha" name="senha" toggle autoComplete="current-password" enterKeyHint="done" placeholder="Sua senha"
          value={v.senha} onChange={(x) => setV({ ...v, senha: x.target.value })} error={sub ? e.senha : ""} />
        <div className="flex justify-end">
          <button type="button" onClick={onForgot} className="rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            Esqueci minha senha
          </button>
        </div>
      </div>
      <div className="pt-2 short:pt-1"><button type="submit" className={submitCls(ready)}>Acessar minha conta</button></div>
    </form>
  );
}

const stepTitles = ["Seus dados", "Seu e-mail", "Crie sua senha", "Confirme e finalize"];

function SignupForm({ onGoogle }: { onGoogle?: () => void }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [done, setDone] = useState(false);
  const [v, setV] = useState({ nome: "", email: "", tel: "", senha: "", conf: "", termos: false });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const strong = passRules.every((r) => r.test(v.senha));
  const e = {
    nome: !v.nome.trim() ? "Informe seu nome." : v.nome.trim().split(/\s+/).length < 2 ? "Digite nome e sobrenome." : "",
    tel: v.tel.replace(/\D/g, "").length < 10 ? "Telefone incompleto." : "",
    email: !v.email ? "Informe seu e-mail." : !emailOk(v.email) ? "E-mail inválido." : "",
  };
  const err = (k: keyof typeof e) => (touched[k] ? e[k] : "");
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const valid = [
    !e.nome && !e.tel,
    !e.email,
    strong,
    strong && v.conf === v.senha && v.termos,
  ][step]!;
  const [nav, setNav] = useState(false);
  const go = (d: 1 | -1) => { setDir(d); setNav(true); setStep((s) => s + d); };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <CheckCircle2 size={56} className="text-accent" />
        <p className="text-lg font-semibold text-foreground">Conta criada!</p>
        <p className="text-sm text-muted-foreground">Em breve você poderá entrar.</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(ev) => { ev.preventDefault(); if (!valid) return; step < 3 ? go(1) : setDone(true); }}
      className="flex flex-col"
    >
      <div className="mb-4 short:mb-2.5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-base font-semibold text-foreground short:text-sm">{stepTitles[step]}</span>
          <span className="text-xs text-muted-foreground">Passo {step + 1} de 4</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-progress transition-all duration-500" style={{ width: `${((step + 1) / 4) * 100}%` }} />
        </div>
      </div>

      <div
        key={step}
        className={`space-y-4 animate-in fade-in duration-300 short:space-y-2.5 ${dir === 1 ? "slide-in-from-right-8" : "slide-in-from-left-8"}`}
      >
        {step === 0 && (
          <>
            <Field label="Nome completo" name="nome" autoComplete="name" enterKeyHint="next" autoFocus={nav} placeholder="Maria Silva" onBlur={blur("nome")}
              onKeyDown={nextOnEnter("tel", !e.nome)}
              value={v.nome} onChange={(x) => setV({ ...v, nome: x.target.value })} error={err("nome")} />
            <Field label="Telefone" name="tel" type="tel" autoComplete="tel" inputMode="tel" enterKeyHint="done" placeholder="(11) 99999-9999" onBlur={blur("tel")}
              value={v.tel} onChange={(x) => setV({ ...v, tel: maskPhone(x.target.value) })} error={err("tel")} />
          </>
        )}
        {step === 1 && (
          <Field label="E-mail" name="email2" type="email" autoComplete="email" inputMode="email" enterKeyHint="done" autoFocus={nav} placeholder="voce@empresa.com" onBlur={blur("email")}
            value={v.email} onChange={(x) => setV({ ...v, email: x.target.value })} error={err("email")} />
        )}
        {step === 2 && (
          <div>
            <Field label="Senha" name="senha2" toggle autoComplete="new-password" enterKeyHint="done" autoFocus={nav} placeholder="Crie uma senha forte"
              value={v.senha} onChange={(x) => setV({ ...v, senha: x.target.value })} />
            <PasswordStrength value={v.senha} />
          </div>
        )}
        {step === 3 && (
          <>
            <Field label="Confirmar senha" name="conf" toggle autoComplete="new-password" enterKeyHint="done" autoFocus={nav} placeholder="Repita a senha"
              value={v.conf} onChange={(x) => setV({ ...v, conf: x.target.value })}
              error={v.conf && v.conf !== v.senha ? "As senhas não conferem" : ""} />
            <label className="flex cursor-pointer items-center gap-3 py-1 text-sm text-muted-foreground">
              <input type="checkbox" className="peer sr-only" checked={v.termos} onChange={(x) => setV({ ...v, termos: x.target.checked })} />
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${v.termos ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>
                {v.termos && <Check size={16} strokeWidth={3} />}
              </span>
              Li e aceito os <span className="font-medium text-foreground underline underline-offset-2">termos de uso</span>
            </label>
          </>
        )}
      </div>

      <div className="mt-5 flex gap-2 short:mt-3">
        {step > 0 && (
          <button type="button" onClick={() => go(-1)} className={ghostCls} aria-label="Voltar">
            <span className="flex items-center gap-1.5"><ArrowLeft size={18} />Voltar</span>
          </button>
        )}
        <button type="submit" disabled={!valid} aria-disabled={!valid} className={`flex-1 ${submitCls(valid)}`}>
          {step < 3 ? "Continuar" : "Criar conta"}
        </button>
      </div>

      {step === 0 && (
        <button type="button" onClick={onGoogle} className="mx-auto mt-4 flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring short:mt-3">
          <GoogleIcon small /> Ou continuar com Google
        </button>
      )}
    </form>
  );
}

function RecoverForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const ok = emailOk(email);
  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-300">
      <h1 className="text-lg font-semibold text-foreground">Recuperar senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">Digite seu e-mail e enviaremos um link para criar uma nova senha.</p>
      {sent ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm text-foreground">
          <MailCheck size={20} className="mt-0.5 shrink-0 text-accent" />
          Se o e-mail estiver cadastrado, você receberá o link em instantes.
        </div>
      ) : (
        <form noValidate onSubmit={(ev) => { ev.preventDefault(); if (ok) setSent(true); }} className="mt-5 space-y-4 short:mt-3 short:space-y-3">
          <Field label="E-mail" name="recover" type="email" autoComplete="email" inputMode="email" enterKeyHint="done" placeholder="voce@empresa.com"
            value={email} onChange={(x) => setEmail(x.target.value)} onBlur={() => setTouched(true)}
            error={touched && !ok ? (email ? "E-mail inválido." : "Informe seu e-mail.") : ""} />
          <button type="submit" disabled={!ok} aria-disabled={!ok} className={submitCls(ok)}>Enviar link</button>
        </form>
      )}
      <button type="button" onClick={onBack} className="mx-auto mt-5 flex items-center gap-1.5 short:mt-3 rounded-lg px-2 py-1 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
        <ArrowLeft size={16} /> Voltar para o login
      </button>
    </div>
  );
}

/** Detecta teclado aberto pela altura visível real (visualViewport) e expõe --app-h. */
function useKeyboard() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      const h = vv ? vv.height : window.innerHeight;
      root.style.setProperty("--app-h", `${h}px`);
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      const kb = typing && window.innerHeight - h > 120;
      setOpen(kb);
      if (kb) window.scrollTo(0, 0);
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", () => setTimeout(update, 50));
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      root.style.removeProperty("--app-h");
    };
  }, []);
  return open;
}

function MiniLogo() {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <LogoMark size={32} />
      <span className="whitespace-nowrap text-base font-bold tracking-[0.16em] text-foreground">
        OMNI SAFE <span className="text-accent">360</span>
      </span>
    </div>
  );
}

/** Bloco que recolhe suavemente (altura + opacidade). */
function Collapse({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return (
    <div aria-hidden={hidden} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${hidden ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function Index() {
  const [view, setView] = useState<"entrar" | "criar" | "recuperar">("entrar");
  const kb = useKeyboard();
  return (
    <div className="relative h-app overflow-hidden bg-app">
      <div className="pointer-events-none absolute inset-0 bg-dots" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-24 bg-glow" />
      <main className={`app-top relative flex h-full flex-col items-center overflow-y-auto ${kb ? "app-top-kb" : ""}`}>
        <div className="w-full max-w-[440px] sm:rounded-3xl sm:border sm:border-border sm:bg-card sm:p-8 sm:backdrop-blur-xl short:sm:p-6">
          {/* Cabeçalho fixo: igual em todas as telas e etapas */}
          {kb ? (
            <div className="animate-in fade-in duration-200"><MiniLogo /></div>
          ) : (
            <div className="flex justify-center animate-in fade-in duration-300">
              <span className="sm:hidden short:hidden"><Logo size={96} /></span>
              <span className="hidden short:block tiny:hidden"><Logo size={72} /></span>
              <span className="hidden tiny:block"><Logo size={56} /></span>
              <span className="hidden sm:block short:hidden"><Logo size={120} /></span>
            </div>
          )}

          {view === "recuperar" ? (
            <div className={kb ? "mt-3" : "mt-6 short:mt-4 tiny:mt-3"}><RecoverForm onBack={() => setView("entrar")} /></div>
          ) : (
            <>
              <Collapse hidden={kb}>
                <div role="tablist" className="mt-8 grid grid-cols-2 rounded-2xl border border-border bg-background-deep/60 p-1 short:mt-4 tiny:mt-3">
                  {(["entrar", "criar"] as const).map((t) => (
                    <button
                      key={t}
                      role="tab"
                      tabIndex={kb ? -1 : 0}
                      aria-selected={view === t}
                      onClick={() => setView(t)}
                      className={`h-11 rounded-xl text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-ring tiny:h-10 ${view === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {t === "entrar" ? "Entrar" : "Criar conta"}
                    </button>
                  ))}
                </div>
              </Collapse>
              <div className={kb ? "mt-3" : "mt-6 short:mt-4 tiny:mt-3"}>
                {view === "entrar" ? <LoginForm onForgot={() => setView("recuperar")} /> : <SignupForm />}
              </div>
            </>
          )}
        </div>
        {!kb && (
          <footer className="mt-auto flex items-center gap-2 pt-4 text-xs tracking-wider text-muted-foreground">
            <LogoMark size={16} /> Omni Safe 360
          </footer>
        )}
      </main>
    </div>
  );
}
