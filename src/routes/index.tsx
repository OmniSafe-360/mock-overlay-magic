import { createFileRoute } from "@tanstack/react-router";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
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

function GoogleIcon() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground">
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
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
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <input
          id={id}
          {...props}
          type={toggle ? (show ? "text" : "password") : props.type}
          aria-invalid={!!error}
          className={`h-13 w-full rounded-2xl border bg-background-deep/60 px-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground/60 focus-visible:ring-2 ${
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
    <button type="button" className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-primary transition hover:brightness-110 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <GoogleIcon />
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
      <span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" />
    </div>
  );
}

const submitCls = (ready: boolean) =>
  `mt-2 h-13 w-full rounded-2xl text-base font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
    ready
      ? "bg-primary text-primary-foreground shadow-primary hover:brightness-110 active:scale-[0.98]"
      : "cursor-not-allowed border border-border bg-secondary text-muted-foreground opacity-60"
  }`;

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
    { t: "", c: "" },
    { t: "Fraca", c: "bg-destructive text-destructive" },
    { t: "Média", c: "bg-warning text-warning" },
    { t: "Forte", c: "bg-accent text-accent" },
  ][level]!;
  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-3 gap-1.5">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-colors ${i <= level ? meta.c.split(" ")[0] : "bg-secondary"}`} />
          ))}
        </div>
        <span className={`w-12 text-right text-xs font-semibold ${meta.c.split(" ")[1] ?? ""}`}>{meta.t}</span>
      </div>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {passRules.map((r) => {
          const ok = r.test(value);
          return (
            <li key={r.label} className={`flex items-center gap-2 text-xs transition-colors ${ok ? "text-accent" : "text-muted-foreground"}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full ${ok ? "bg-accent text-accent-foreground" : "bg-secondary"}`}>
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

function LoginForm() {
  const [v, setV] = useState({ email: "", senha: "" });
  const [sub, setSub] = useState(false);
  const e = {
    email: !v.email ? "Informe seu e-mail." : !emailOk(v.email) ? "E-mail inválido." : "",
    senha: !v.senha ? "Informe sua senha." : "",
  };
  const ready = !!v.email && !!v.senha;
  return (
    <form noValidate onSubmit={(ev) => { ev.preventDefault(); setSub(true); }} className="space-y-4">
      <GoogleButton>Entrar com Google</GoogleButton>
      <Divider />
      <Field label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" placeholder="voce@empresa.com"
        value={v.email} onChange={(x) => setV({ ...v, email: x.target.value })} error={sub ? e.email : ""} />
      <div className="space-y-2">
        <Field label="Senha" name="senha" toggle autoComplete="current-password" placeholder="Sua senha"
          value={v.senha} onChange={(x) => setV({ ...v, senha: x.target.value })} error={sub ? e.senha : ""} />
        <div className="flex justify-end">
          <button type="button" className="rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            Esqueci minha senha
          </button>
        </div>
      </div>
      <button type="submit" className={submitCls(ready)}>Acessar minha conta</button>
    </form>
  );
}

function SignupForm() {
  const [v, setV] = useState({ nome: "", email: "", tel: "", senha: "", conf: "", termos: false });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const strong = passRules.every((r) => r.test(v.senha));
  const e = {
    nome: !v.nome.trim() ? "Informe seu nome." : v.nome.trim().split(/\s+/).length < 2 ? "Digite nome e sobrenome." : "",
    email: !v.email ? "Informe seu e-mail." : !emailOk(v.email) ? "E-mail inválido." : "",
    tel: v.tel.replace(/\D/g, "").length < 10 ? "Telefone incompleto." : "",
    senha: !v.senha ? "Crie uma senha." : !strong ? "A senha não cumpre todas as regras." : "",
    conf: !v.conf ? "Confirme sua senha." : v.conf !== v.senha ? "As senhas não conferem" : "",
  };
  const ready = Object.values(e).every((x) => !x) && v.termos;
  const err = (k: keyof typeof e) => (touched[k] ? e[k] : "");
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  return (
    <form noValidate onSubmit={(ev) => ev.preventDefault()} className="space-y-4">
      <GoogleButton>Continuar com Google</GoogleButton>
      <Divider />
      <Field label="Nome completo" name="nome" autoComplete="name" placeholder="Maria Silva" onBlur={blur("nome")}
        value={v.nome} onChange={(x) => setV({ ...v, nome: x.target.value })} error={err("nome")} />
      <Field label="E-mail" name="email2" type="email" autoComplete="email" inputMode="email" placeholder="voce@empresa.com" onBlur={blur("email")}
        value={v.email} onChange={(x) => setV({ ...v, email: x.target.value })} error={err("email")} />
      <Field label="Telefone" name="tel" type="tel" autoComplete="tel" inputMode="numeric" placeholder="(11) 99999-9999" onBlur={blur("tel")}
        value={v.tel} onChange={(x) => setV({ ...v, tel: maskPhone(x.target.value) })} error={err("tel")} />
      <div>
        <Field label="Senha" name="senha2" toggle autoComplete="new-password" placeholder="Crie uma senha forte" onBlur={blur("senha")}
          value={v.senha} onChange={(x) => setV({ ...v, senha: x.target.value })} error={err("senha")} />
        <PasswordStrength value={v.senha} />
      </div>
      <Field label="Confirmar senha" name="conf" toggle autoComplete="new-password" placeholder="Repita a senha"
        value={v.conf} onChange={(x) => setV({ ...v, conf: x.target.value })}
        error={v.conf && v.conf !== v.senha ? "As senhas não conferem" : ""} />
      <div>
        <label className="flex cursor-pointer items-center gap-3 py-1 text-sm text-muted-foreground">
          <input type="checkbox" className="peer sr-only" checked={v.termos} onChange={(x) => setV({ ...v, termos: x.target.checked })} />
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${v.termos ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>
            {v.termos && <Check size={16} strokeWidth={3} />}
          </span>
          Li e aceito os <span className="font-medium text-foreground underline underline-offset-2">termos de uso</span>
        </label>
      </div>
      <button type="submit" disabled={!ready} aria-disabled={!ready} className={submitCls(ready)}>Criar conta</button>
    </form>
  );
}

function Index() {
  const [tab, setTab] = useState<"entrar" | "criar">("entrar");
  return (
    <div className="relative min-h-dvh overflow-hidden bg-app">
      <div className="pointer-events-none absolute inset-0 bg-dots" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-24 bg-glow" />
      <main className="safe-area relative flex min-h-dvh flex-col items-center justify-center">
        <div className="w-full max-w-[440px] sm:rounded-3xl sm:border sm:border-border sm:bg-card sm:p-8 sm:backdrop-blur-xl">
          <div className="flex justify-center">
            <span className="sm:hidden"><Logo size={96} /></span>
            <span className="hidden sm:block"><Logo size={120} /></span>
          </div>

          <div role="tablist" className="mt-8 grid grid-cols-2 rounded-2xl border border-border bg-background-deep/60 p-1">
            {(["entrar", "criar"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`h-11 rounded-xl text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-ring ${tab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <div className="mt-6">{tab === "entrar" ? <LoginForm /> : <SignupForm />}</div>
        </div>
        <footer className="mt-8 flex items-center gap-2 text-xs tracking-wider text-muted-foreground">
          <LogoMark size={16} /> Omni Safe 360
        </footer>
      </main>
    </div>
  );
}
