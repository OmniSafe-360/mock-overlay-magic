import { useCallback, useEffect, useRef, useState } from "react";
import { carregarFornecedores, carregarProdutos, atualizarFornecedor, criarFornecedor, gerarCodigoInterno, salvarProduto, carregarPedidos, salvarPedido, marcarPedidoEnviado, cancelarPedido, novoLinkPedido, type LocaisCadastrados } from "@/lib/banco";
import type { CanalPedido, LinhaPedido, Pedido } from "@/lib/pedido";
import { ehIncerto, mensagemErro, type Sessao } from "@/lib/persistencia";
import { newUid } from "@/lib/deposito";
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

export function OwnerApp({ owner, initial, fullName = "", email = "", onLogout }: { owner: string; initial: StoreData[]; fullName?: string; email?: string; onLogout?: () => void }) {
  const [stores, setStores] = useState<StoreData[]>(initial);
  const [tab, setTab] = useState<Tab>("inicio");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<StoreData | null>(null);
  const [toast, setToast] = useState("");
  const [products, setProducts] = useState<Record<string, Product[]>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [wizard, setWizard] = useState<{ initial?: Product | undefined } | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErro, setSaveErro] = useState("");
  const [carga, setCarga] = useState<"ok" | "carregando" | "erro">("ok");
  /** Identificadores estáveis do envio aberto: repetir o envio usa os mesmos e não duplica nada. */
  const sessao = useRef<Sessao | null>(null);
  const [locais, setLocais] = useState<Record<string, LocaisCadastrados>>({});
  const [pedidos, setPedidos] = useState<Record<string, Pedido[]>>({});
  const suppRef = useRef<Supplier[]>([]);
  suppRef.current = suppliers;

  const recarregar = useCallback(async (comercioId: string) => {
    setCarga("carregando");
    try {
      const fs = await carregarFornecedores();
      setSuppliers(fs); suppRef.current = fs;
      const r = await carregarProdutos(comercioId, fs);
      setProducts((m) => ({ ...m, [comercioId]: r.produtos }));
      setLocais((m) => ({ ...m, [comercioId]: r.locais }));
      setCarga("ok");
      // Pedidos carregam à parte: se falhar, o resto do comércio continua funcionando.
      carregarPedidos(comercioId).then((ps) => setPedidos((m) => ({ ...m, [comercioId]: ps }))).catch(() => {});
    } catch { setCarga("erro"); }
  }, []);
  const openSid = typeof open?.id === "string" && open.id.trim() ? open.id : null;
  useEffect(() => { if (openSid) void recarregar(openSid); }, [openSid, recarregar]);

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

  const cur = open ?? undefined;
  const sid = typeof cur?.id === "string" && cur.id.trim() ? cur.id : null;
  const list = sid ? products[sid] ?? [] : [];
  const NO_ID = "Este comércio ainda não foi salvo. Não é possível cadastrar ou editar produtos.";
  const openWizard = (initial?: Product) => {
    if (!sid) { setToast(NO_ID); return; }
    sessao.current = { dbId: initial?.db?.id ?? newUid(), incerto: null };
    setSaveErro(""); setWizard({ initial });
  };
  /** Grava no banco e só depois aparece na lista. Devolve o id local. */
  const addSupplier = async (f: Omit<Supplier, "id">) => {
    const dbId = newUid();
    try { await criarFornecedor(dbId, f); }
    catch (e) { throw new Error(`Não foi possível guardar o fornecedor. ${mensagemErro(e).replace(/^Não foi possível salvar agora\. /, "")}`); }
    const novo = { ...f, id: Date.now(), dbId };
    suppRef.current = [...suppRef.current, novo];
    setSuppliers((l) => [...l, novo]);
    return novo.id;
  };
  const recarregarPedidos = async (comercioId: string) => {
    const ps = await carregarPedidos(comercioId);
    setPedidos((m) => ({ ...m, [comercioId]: ps }));
    return ps;
  };
  const comMensagem = async <T,>(acao: () => Promise<T>, inicio: string): Promise<T> => {
    try { return await acao(); }
    catch (e) { throw new Error(`${inicio} ${mensagemErro(e).replace(/^Não foi possível salvar agora\. /, "")}`); }
  };
  const salvarPedidoNovo = (comercioId: string) => async (a: { fornecedor: Supplier; linhas: LinhaPedido[]; observacao: string }) => {
    if (!a.fornecedor.dbId) throw new Error("Este fornecedor ainda não foi salvo.");
    const r = await comMensagem(() => salvarPedido({ id: newUid(), comercioId, fornecedorId: a.fornecedor.dbId!, observacao: a.observacao, linhas: a.linhas }), "Não foi possível salvar o pedido.");
    const ps = await recarregarPedidos(comercioId).catch(() => null);
    return { ...r, token: ps?.find((x) => x.id === r.id)?.token };
  };
  const pedidoNovoLink = (comercioId: string) => async (id: string) => {
    const t = await comMensagem(() => novoLinkPedido(id), "Não foi possível gerar o novo link.");
    await recarregarPedidos(comercioId).catch(() => {});
    return t;
  };
  const pedidoEnviado = (comercioId: string) => async (id: string, canal: CanalPedido) => {
    await comMensagem(() => marcarPedidoEnviado(id, canal), "Não foi possível marcar o pedido como enviado.");
    await recarregarPedidos(comercioId).catch(() => {});
  };
  const pedidoCancelado = (comercioId: string) => async (id: string) => {
    await comMensagem(() => cancelarPedido(id), "Não foi possível cancelar o pedido.");
    await recarregarPedidos(comercioId).catch(() => {});
  };
  const updateSupplier = async (s: Supplier, f: Omit<Supplier, "id">) => {
    if (!s.dbId) throw new Error("Este fornecedor ainda não foi salvo.");
    try { await atualizarFornecedor(s.dbId, f); }
    catch (e) { throw new Error(`Não foi possível salvar o fornecedor. ${mensagemErro(e).replace(/^Não foi possível salvar agora\. /, "")}`); }
    const novo = { ...s, nome: f.nome.trim(), tel: f.tel.replace(/\D/g, ""), email: f.email.trim().toLowerCase() };
    suppRef.current = suppRef.current.map((x) => (x.id === s.id ? novo : x));
    setSuppliers((l) => l.map((x) => (x.id === s.id ? novo : x)));
  };

  if (wizard && cur && sid)
    return (
      <ProductWizard store={cur} products={list} initial={wizard.initial} suppliers={suppliers} saving={saving} erro={saveErro} locaisCadastrados={locais[sid]}
        onGerarCodigo={() => gerarCodigoInterno(sid)}
        onAddSupplier={addSupplier}
        onCancel={() => { if (!saving) setWizard(null); }}
        onSave={async (p) => {
          if (saving || !sessao.current) return;
          setSaving(true); setSaveErro("");
          const comDb: Product = { ...p, db: p.db ?? { id: sessao.current.dbId, contadas: [] } };
          let res: "gravado" | "anterior_gravado";
          try {
            res = await salvarProduto(sessao.current, comDb, wizard.initial, sid, cur.tipo === "farmacia", suppRef.current, newUid);
          } catch (e) {
            setSaveErro(ehIncerto(e)
              ? "Não foi possível confirmar se o produto foi salvo. Toque em Salvar de novo: o mesmo envio será repetido sem duplicar."
              : mensagemErro(e));
            setSaving(false); return;
          }
          await recarregar(sid);
          setSaving(false); setWizard(null);
          if (res === "anterior_gravado") setToast("O envio anterior já tinha sido salvo. Abra o produto para conferir.");
          else { setSaved(!wizard.initial); if (wizard.initial) setToast("Produto atualizado!"); }
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
          {tab === "inicio" && cur && carga !== "ok" && !list.length ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <p className="text-muted-foreground">{carga === "carregando" ? "Carregando produtos…" : "Não foi possível carregar os produtos. Verifique sua internet."}</p>
              {carga === "erro" && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOpen(null)} className="h-12 rounded-2xl border border-border px-5 font-semibold">Voltar</button>
                  <button type="button" onClick={() => sid && void recarregar(sid)} className="h-12 rounded-2xl bg-primary px-5 font-semibold text-primary-foreground">Tentar de novo</button>
                </div>
              )}
            </div>
          ) : tab === "inicio" && cur ? (
            <StoreSpace key={sid ?? "sem-id"} store={cur} products={list} suppliers={suppliers} saved={saved} locais={sid ? locais[sid] : undefined}
              onAddSupplier={addSupplier} onUpdateSupplier={updateSupplier}
              pedidos={sid ? pedidos[sid] ?? [] : []}
              onSalvarPedido={sid ? salvarPedidoNovo(sid) : async () => { throw new Error(NO_ID); }}
              onPedidoEnviado={sid ? pedidoEnviado(sid) : async () => {}} onCancelarPedido={sid ? pedidoCancelado(sid) : async () => {}}
              onNovoLinkPedido={sid ? pedidoNovoLink(sid) : async () => { throw new Error(NO_ID); }}
              onBack={() => { setOpen(null); setSaved(false); }} onNew={() => openWizard()} onEdit={(p) => openWizard(p)} onDismissSaved={() => setSaved(false)} />
          ) : tab === "inicio" ? (
            <HomeContent stores={stores} onAdd={() => setAdding(true)} onOpen={(s) => setOpen(s)} />
          ) : tab === "conta" ? (
            <div className="mx-auto max-w-md space-y-4 animate-in fade-in duration-300">
              <div className="rounded-3xl border border-border bg-secondary/70 p-5">
                <UserCircle size={40} className="text-primary" />
                <p className="mt-3 text-lg font-bold">{fullName || owner || "Sua conta"}</p>
                <p className="mt-1 break-all text-sm text-muted-foreground">{email}</p>
              </div>
              <button type="button" onClick={onLogout}
                className="h-12 w-full rounded-2xl border border-destructive/50 text-sm font-semibold text-destructive transition hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-ring">
                Sair
              </button>
            </div>
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

function HomeContent({ stores, onAdd, onOpen }: { stores: StoreData[]; onAdd: () => void; onOpen: (s: StoreData) => void }) {
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
              <button key={s.id ?? i} type="button" onClick={() => onOpen(s)}
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
