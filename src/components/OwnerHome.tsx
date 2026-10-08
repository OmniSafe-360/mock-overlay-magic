import { useEffect, useState } from "react";
import { AlertTriangle, Bell, CalendarClock, ChevronRight, Home, PackageX, Plus, ShoppingBag, Store, UserCircle, Users, CheckCircle2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { StoreSetup, TIPOS, type StoreData } from "@/components/StoreSetup";
import { StoreSpace } from "@/components/StoreSpace";
import { ProductWizard, type Product, type Supplier } from "@/components/ProductArea";

type Tab = "inicio" | "comercios" | "alertas" | "equipe" | "conta";
const NAV: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: "inicio", label: "Início", Icon: Home },
  { id: "comercios", label: "Comércios", Icon: Store },
  { id: "alertas", label: "Alertas", Icon: Bell },
  { id: "equipe", label: "Equipe", Icon: Users },
  { id: "conta", label: "Conta", Icon: UserCircle },
];

/* valores de exemplo, estáveis por posição */
const sample = (i: number) => ({ vendas: [1840, 920, 2310, 1275, 640][i % 5]!, alertas: [3, 1, 0, 2, 4][i % 5]! });
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const iconOf = (tipo: string) => TIPOS.find((t) => t.id === tipo)?.Icon ?? Store;

function Badge() {
  return <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">Dados de exemplo</span>;
}

function Backdrop() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-dots" />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-24 bg-glow" />
    </>
  );
}

export function OwnerApp({ owner, initial }: { owner: string; initial: StoreData[] }) {
  const [stores, setStores] = useState<StoreData[]>(initial);
  const [tab, setTab] = useState<Tab>("inicio");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [products, setProducts] = useState<Record<number, Product[]>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [wizard, setWizard] = useState<{ initial?: Product | undefined } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (adding)
    return (
      <StoreSetup mode="add" onCancel={() => setAdding(false)}
        onFinish={(s) => { setStores((l) => [...l, s]); setAdding(false); setTab("inicio"); setToast("Comércio adicionado!"); }} />
    );

  const cur = open !== null ? stores[open] : undefined;
  if (wizard && cur && open !== null)
    return (
      <ProductWizard store={cur} products={products[open] ?? []} initial={wizard.initial} suppliers={suppliers}
        onAddSupplier={(f) => { const id = Date.now(); setSuppliers((l) => [...l, { ...f, id }]); return id; }}
        onCancel={() => setWizard(null)}
        onSave={(p) => {
          setProducts((m) => { const l = m[open] ?? []; return { ...m, [open]: l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [p, ...l] }; });
          setSaved(!wizard.initial); setWizard(null); if (wizard.initial) setToast("Produto atualizado!");
        }} />
    );

  return (
    <div className="relative min-h-dvh bg-app text-foreground">
      <Backdrop />

      {/* menu lateral (tablet/computador) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-background-deep/80 px-4 py-6 backdrop-blur-xl md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <LogoMark size={36} />
          <span className="whitespace-nowrap text-sm font-bold tracking-[0.14em]">OMNI SAFE <span className="text-accent">360</span></span>
        </div>
        <nav className="space-y-1">
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => { setTab(id); if (id !== "inicio") setOpen(null); }} aria-current={tab === id ? "page" : undefined}
              className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition ${tab === id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon size={20} className={tab === id ? "text-accent" : ""} /> {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="relative md:pl-60">
        {/* cabeçalho fixo */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="mx-auto grid max-w-[1100px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="md:hidden"><LogoMark size={36} /></span>
              <p className="truncate text-lg font-bold">{owner ? `Olá, ${owner}` : "Olá!"}</p>
            </div>
            <button type="button" aria-label="Notificações" onClick={() => setTab("alertas")}
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/60 text-foreground hover:border-primary">
              <Bell size={20} />
              <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-accent" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1100px] px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 md:pb-10">
          {tab === "inicio" && cur && open !== null ? (
            <StoreSpace key={open} store={cur} products={products[open] ?? []} suppliers={suppliers} saved={saved}
              onBack={() => { setOpen(null); setSaved(false); }} onNew={() => setWizard({})} onEdit={(p) => setWizard({ initial: p })} onDismissSaved={() => setSaved(false)} />
          ) : tab === "inicio" ? (
            <HomeContent stores={stores} onAdd={() => setAdding(true)} onOpen={setOpen} />
          ) : (
            <Soon title={NAV.find((n) => n.id === tab)!.label} />
          )}
        </main>
      </div>

      {/* barra inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background-deep/90 backdrop-blur-xl md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-5">
          {NAV.map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <button key={id} type="button" onClick={() => { setTab(id); if (id !== "inicio") setOpen(null); }} aria-current={on ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${on ? "text-accent" : "text-muted-foreground"}`}>
                <Icon size={22} /> {label}
              </button>
            );
          })}
        </div>
      </nav>

      {toast && (
        <div className="fixed inset-x-0 z-40 flex justify-center px-5 animate-in fade-in slide-in-from-bottom-4 duration-300 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-8">
          <div className="flex items-center gap-2 rounded-2xl border border-accent/40 bg-background px-4 py-3 text-sm font-semibold shadow-primary">
            <CheckCircle2 size={18} className="text-accent" /> {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeContent({ stores, onAdd, onOpen }: { stores: StoreData[]; onAdd: () => void; onOpen: (i: number) => void }) {
  const totals = stores.reduce((a, _, i) => ({ v: a.v + sample(i).vendas, al: a.al + sample(i).alertas }), { v: 0, al: 0 });
  const n = stores.length;
  const kpis = [
    { label: "Vendas hoje", value: brl(totals.v), Icon: ShoppingBag, cls: "text-primary" },
    { label: "Produtos perto de vencer", value: String(n * 7), Icon: CalendarClock, cls: "text-warning" },
    { label: "Faltas detectadas", value: String(n * 4), Icon: PackageX, cls: "text-destructive" },
    { label: "Alertas", value: String(totals.al), Icon: AlertTriangle, cls: "text-accent" },
  ];
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Resumo geral</h2>
          <Badge />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map(({ label, value, Icon, cls }) => (
            <div key={label} className="rounded-3xl border border-border bg-secondary/70 p-4">
              <Icon size={20} className={cls} />
              <p className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
              <p className="mt-1 text-xs leading-tight text-muted-foreground sm:text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Seus comércios <span className="text-muted-foreground">({n})</span></h2>
        {n === 0 && (
          <div className="mb-3 rounded-3xl border border-border bg-secondary/40 p-6 text-center">
            <Store size={32} className="mx-auto text-muted-foreground" />
            <p className="mt-2 font-semibold">Você ainda não tem comércios</p>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre o primeiro para começar a acompanhar tudo por aqui.</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {stores.map((s, i) => {
            const Icon = iconOf(s.tipo);
            const m = sample(i);
            return (
              <button key={i} type="button" onClick={() => onOpen(i)}
                className="flex min-h-[112px] items-center gap-4 rounded-3xl border border-border bg-secondary/70 p-4 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-ring">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background-deep/60 text-primary"><Icon size={24} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.nome}</p>
                  <p className="truncate text-sm text-muted-foreground">{s.cidade} - {s.uf}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="text-foreground">{brl(m.vendas)}</span> hoje · <span className={m.alertas ? "text-accent" : ""}>{m.alertas} {m.alertas === 1 ? "alerta" : "alertas"}</span>
                  </p>
                </div>
                <ChevronRight size={20} className="shrink-0 text-muted-foreground" />
              </button>
            );
          })}
          <button type="button" onClick={onAdd}
            className="flex min-h-[112px] items-center gap-4 rounded-3xl border-2 border-dashed border-accent/80 p-4 text-left transition hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-ring">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Plus size={24} /></span>
            <div className="min-w-0">
              <p className="font-semibold">Adicionar comércio</p>
              <p className="text-sm text-muted-foreground">Cadastre outro comércio em poucos passos</p>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}

function Soon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center animate-in fade-in duration-300">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">Em breve</p>
    </div>
  );
}
