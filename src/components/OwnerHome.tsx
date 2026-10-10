import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { conferirEnvio, carregarFornecedores, carregarProdutos, carregarVendas, carregarPendentesVenda, contarDiferencasParaDecidir, atualizarFornecedor, criarFornecedor, gerarCodigoInterno, salvarProduto, carregarPedidos, salvarPedido, marcarPedidoEnviado, cancelarPedido, novoLinkPedido, atualizarPagamento, resolverItemRecebimento, carregarRecebimentos, type LocaisCadastrados } from "@/lib/banco";
import type { CanalPedido, LinhaPedido, Pedido } from "@/lib/pedido";
import type { DadosPagamento } from "@/components/PainelPedidos";
import type { Recebimento } from "@/lib/recebimento";
import { ehIncerto, mensagemErro, type Sessao } from "@/lib/persistencia";
import { ERRO_REGISTRO, registroEnvio, type TipoEnvio } from "@/lib/envios";
import { newUid } from "@/lib/deposito";
import { AlertTriangle, Bell, CalendarClock, ChevronRight, CircleCheck, Home, Plus, ShoppingBag, ShoppingBasket, ShoppingCart, Store, UserCircle, Users, CheckCircle2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { StoreSetup, TIPOS, type StoreData } from "@/components/StoreSetup";
import { StoreSpace, type InicioComercio } from "@/components/StoreSpace";
import { AtencaoHoje } from "@/components/AtencaoHoje";
import { resumoPagamentos } from "@/lib/pagamento";
import { hojeEm } from "@/lib/validade";
import { agruparPendentes, brl as brlVenda, diaDaVenda } from "@/lib/vendas";
import { deOlho, entregasParaDecidir, fraseComercio, paraResolver, produtosJaPedidos, resumoComercio, somaResumos, type ResumoComercio } from "@/lib/resumoGeral";
import { PainelEquipe } from "@/components/PainelEquipe";
import { ProductWizard, type Product, type Supplier } from "@/components/ProductArea";

type Tab = "inicio" | "comercios" | "alertas" | "equipe" | "conta";
const NAV: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: "inicio", label: "Início", Icon: Home },
  { id: "comercios", label: "Comércios", Icon: Store },
  { id: "alertas", label: "Alertas", Icon: Bell },
  { id: "equipe", label: "Equipe", Icon: Users },
  { id: "conta", label: "Conta", Icon: UserCircle },
];

const iconOf = (tipo: string) => TIPOS.find((t) => t.id === tipo)?.Icon ?? Store;
const idDe = (s: StoreData) => (typeof s.id === "string" && s.id.trim() ? s.id : null);

/** Dados de um comércio para o resumo geral (tela inicial, Comércios e Alertas). */
type Geral = { estado: "ok" | "carregando" | "erro"; produtos: Product[]; pedidos: Pedido[];
  /** Vendas de hoje e códigos sem cadastro (null = não deu para ler; não impede o resto). */
  vendas?: { hojeN: number; hojeTotal: number; semCadastro: number } | null | undefined;
  /** Perdas para confirmar + diferenças para explicar (null = não deu para ler). */
  diferencas?: number | null | undefined };
type VisaoGeral = { geral: Record<string, Geral>; resumos: Record<string, ResumoComercio>; total: ResumoComercio; carregando: boolean; erro: boolean };

function Backdrop() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-dots" />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-24 bg-glow" />
    </>
  );
}

export function OwnerApp({ userId, owner, initial, fullName = "", email = "", onLogout }: { userId: string; owner: string; initial: StoreData[]; fullName?: string; email?: string; onLogout?: () => void }) {
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
  type Carga = "ok" | "carregando" | "erro";
  const [cargas, setCargas] = useState<Record<string, Carga>>({});
  const [cargasPedidos, setCargasPedidos] = useState<Record<string, Carga>>({});
  const requisicoes = useRef<Record<string, number>>({});
  const fornVersao = useRef(0);
  const ativo = useRef(true);
  const [, atualizarEnvios] = useState(0);
  const [conferindo, setConferindo] = useState(false);
  const [recuperacoes, setRecuperacoes] = useState<Record<string, number>>({});
  const conferindoRef = useRef(false);
  useEffect(() => { ativo.current = true; return () => { ativo.current = false; }; }, []);
  /** Identificadores estáveis do envio aberto: repetir o envio usa os mesmos e não duplica nada. */
  const sessao = useRef<Sessao | null>(null);
  const [locais, setLocais] = useState<Record<string, LocaisCadastrados>>({});
  const [pedidos, setPedidos] = useState<Record<string, Pedido[]>>({});
  const suppRef = useRef<Supplier[]>([]);
  suppRef.current = suppliers;

  const recarregarPedidos = useCallback(async (comercioId: string) => {
    const chave = `pedidos:${comercioId}`;
    const versao = requisicoes.current[chave] = (requisicoes.current[chave] ?? 0) + 1;
    const vigente = () => ativo.current && requisicoes.current[chave] === versao;
    setCargasPedidos((m) => ({ ...m, [comercioId]: "carregando" }));
    try {
      const ps = await carregarPedidos(comercioId);
      if (!vigente()) return null;
      setPedidos((m) => ({ ...m, [comercioId]: ps }));
      setCargasPedidos((m) => ({ ...m, [comercioId]: "ok" }));
      return ps;
    } catch {
      if (vigente()) setCargasPedidos((m) => ({ ...m, [comercioId]: "erro" }));
      return null; // O erro fica visível; os dados já carregados são preservados.
    }
  }, []);
  const recarregar = useCallback(async (comercioId: string) => {
    const chave = `produtos:${comercioId}`;
    const versao = requisicoes.current[chave] = (requisicoes.current[chave] ?? 0) + 1;
    const versaoForn = ++fornVersao.current;
    const vigente = () => ativo.current && requisicoes.current[chave] === versao;
    setCargas((m) => ({ ...m, [comercioId]: "carregando" }));
    void recarregarPedidos(comercioId);
    try {
      const fs = await carregarFornecedores();
      const r = await carregarProdutos(comercioId, fs);
      if (!vigente()) return false;
      // Publica o conjunto pronto; nunca uma lista de fornecedores parcial.
      if (fornVersao.current === versaoForn) { setSuppliers(fs); suppRef.current = fs; }
      setProducts((m) => ({ ...m, [comercioId]: r.produtos }));
      setLocais((m) => ({ ...m, [comercioId]: r.locais }));
      setCargas((m) => ({ ...m, [comercioId]: "ok" }));
      return true;
    } catch {
      if (vigente()) setCargas((m) => ({ ...m, [comercioId]: "erro" }));
      return false;
    }
  }, [recarregarPedidos]);
  /* ---------- resumo de todos os comércios (tela inicial, Comércios e Alertas) ---------- */
  const [geral, setGeral] = useState<Record<string, Geral>>({});
  const [fornGeral, setFornGeral] = useState<Supplier[]>([]);
  const [inicioLoja, setInicioLoja] = useState<InicioComercio | undefined>(undefined);
  const geralVersao = useRef(0);
  const carregarGeral = useCallback(async (ids: string[]) => {
    const v = ++geralVersao.current;
    const vigente = () => ativo.current && geralVersao.current === v;
    setGeral((m) => Object.fromEntries(ids.map((id) => [id, { produtos: m[id]?.produtos ?? [], pedidos: m[id]?.pedidos ?? [], estado: "carregando" as const }])));
    let fs: Supplier[] = [];
    try { fs = await carregarFornecedores(); } catch { /* sem os nomes dos fornecedores; as contas continuam certas */ }
    if (vigente()) setFornGeral(fs);
    await Promise.all(ids.map(async (id) => {
      try {
        const inicioHoje = new Date(`${hojeEm()}T00:00:00-03:00`).toISOString();
        const [r, ps, vendas, diferencas] = await Promise.all([carregarProdutos(id, fs), carregarPedidos(id),
          Promise.all([carregarVendas(id, inicioHoje), carregarPendentesVenda(id)])
            .then(([vs, pend]) => {
              const hoje = vs.filter((v) => v.situacao === "finalizada" && diaDaVenda(v) === hojeEm());
              return { hojeN: hoje.length, hojeTotal: hoje.reduce((t, v) => t + v.total, 0), semCadastro: agruparPendentes(pend).length };
            }).catch(() => null),
          contarDiferencasParaDecidir(id).then((d) => d.perdas + d.diferencas).catch(() => null)]);
        if (vigente()) setGeral((m) => ({ ...m, [id]: { estado: "ok", produtos: r.produtos, pedidos: ps, vendas, diferencas } }));
      } catch {
        if (vigente()) setGeral((m) => ({ ...m, [id]: { produtos: m[id]?.produtos ?? [], pedidos: m[id]?.pedidos ?? [], estado: "erro" } }));
      }
    }));
  }, []);
  const idsLojas = stores.map(idDe).filter((x): x is string => !!x).join(",");
  const telaGeral = !open && (tab === "inicio" || tab === "comercios" || tab === "alertas");
  useEffect(() => { if (telaGeral && idsLojas) void carregarGeral(idsLojas.split(",")); }, [telaGeral, idsLojas, carregarGeral]);
  useEffect(() => {
    if (!telaGeral || !idsLojas) return;
    const atualizar = () => { if (document.visibilityState === "visible") void carregarGeral(idsLojas.split(",")); };
    window.addEventListener("online", atualizar);
    document.addEventListener("visibilitychange", atualizar);
    return () => { window.removeEventListener("online", atualizar); document.removeEventListener("visibilitychange", atualizar); };
  }, [telaGeral, idsLojas, carregarGeral]);
  const hojeGeral = hojeEm();
  const visao: VisaoGeral = useMemo(() => {
    const resumos: Record<string, ResumoComercio> = {};
    for (const s of stores) { const id = idDe(s); const g = id ? geral[id] : undefined; if (id && g && (g.estado === "ok" || g.produtos.length)) resumos[id] = resumoComercio(g.produtos, s.tipo, hojeGeral, g.pedidos, g.vendas ?? {}, g.diferencas ?? 0); }
    const gs = Object.values(geral);
    return { geral, resumos, total: somaResumos(Object.values(resumos)), carregando: gs.some((g) => g.estado === "carregando"), erro: gs.some((g) => g.estado === "erro") };
  }, [stores, geral, hojeGeral]);
  const abrirLoja = (s: StoreData, inicio?: InicioComercio) => { setInicioLoja(inicio); setSaved(false); setOpen(s); setTab("inicio"); };

  const openSid = typeof open?.id === "string" && open.id.trim() ? open.id : null;
  useEffect(() => { if (openSid) void recarregar(openSid); }, [openSid, recarregar]);
  // Voltar ao app ou recuperar a internet atualiza o mesmo modelo usado pelas abas.
  useEffect(() => {
    const atualizar = () => { if (openSid && !wizard && !saving && !conferindoRef.current) void recarregar(openSid); };
    const visivel = () => { if (document.visibilityState === "visible") atualizar(); };
    const envioEmOutraAba = (e: StorageEvent) => { if (e.key?.startsWith("omni.envio.v1:")) atualizarEnvios((n) => n + 1); };
    window.addEventListener("online", atualizar);
    document.addEventListener("visibilitychange", visivel);
    window.addEventListener("storage", envioEmOutraAba);
    return () => { window.removeEventListener("online", atualizar); document.removeEventListener("visibilitychange", visivel); window.removeEventListener("storage", envioEmOutraAba); };
  }, [openSid, wizard, saving, recarregar]);

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
  const carga = sid ? cargas[sid] ?? "carregando" : "ok";
  const cargaPedidos = sid ? cargasPedidos[sid] ?? "carregando" : "ok";
  const pendentes: TipoEnvio[] = [];
  let registroErro = "";
  if (sid) {
    try { for (const tipo of ["produto", "pedido"] as const) if (registroEnvio(userId, sid, tipo).ler()) pendentes.push(tipo); }
    catch { registroErro = ERRO_REGISTRO; }
  }
  const recuperar = async (tipo: TipoEnvio) => {
    if (!sid || conferindoRef.current) return;
    conferindoRef.current = true; setConferindo(true);
    try {
      const s = registroEnvio(userId, sid, tipo).sessao(newUid());
      await conferirEnvio(s, tipo);
      setRecuperacoes((m) => ({ ...m, [sid]: (m[sid] ?? 0) + 1 }));
      setToast("Envio confirmado. Confira os dados atualizados no comércio.");
    } catch (e) {
      setToast(e instanceof Error && e.message === ERRO_REGISTRO ? ERRO_REGISTRO : ehIncerto(e)
        ? "Ainda não foi possível confirmar o envio. Tente de novo quando a conexão voltar."
        : `O envio foi recusado. ${mensagemErro(e)}`);
    } finally {
      atualizarEnvios((n) => n + 1);
      await recarregar(sid);
      conferindoRef.current = false; setConferindo(false);
    }
  };
  const NO_ID = "Este comércio ainda não foi salvo. Não é possível cadastrar ou editar produtos.";
  const openWizard = (initial?: Product) => {
    if (!sid) { setToast(NO_ID); return; }
    if (carga !== "ok" || conferindoRef.current) { setToast("Atualize os dados deste comércio antes de cadastrar ou editar."); return; }
    if (registroErro) { setToast(registroErro); return; }
    if (pendentes.length) { setToast("Confira os envios pendentes antes de abrir outro cadastro."); return; }
    try { sessao.current = registroEnvio(userId, sid, "produto").sessao(initial?.db?.id ?? newUid()); }
    catch { setToast(ERRO_REGISTRO); return; }
    setSaveErro(""); setWizard({ initial });
  };
  /** Grava no banco e só depois aparece na lista. Devolve o id local. */
  const addSupplier = async (f: Omit<Supplier, "id">) => {
    const dbId = newUid();
    try { await criarFornecedor(dbId, f); }
    catch (e) { throw new Error(`Não foi possível guardar o fornecedor. ${mensagemErro(e).replace(/^Não foi possível salvar agora\. /, "")}`); }
    const novo = { ...f, id: dbId, dbId };
    ++fornVersao.current;
    suppRef.current = [...suppRef.current, novo];
    setSuppliers((l) => [...l, novo]);
    return novo.id;
  };
  const comMensagem = async <T,>(acao: () => Promise<T>, inicio: string): Promise<T> => {
    try { return await acao(); }
    catch (e) { throw new Error(`${inicio} ${mensagemErro(e).replace(/^Não foi possível salvar agora\. /, "")}`); }
  };
  const salvarPedidoNovo = (comercioId: string) => async (a: { fornecedor: Supplier; linhas: LinhaPedido[]; observacao: string }) => {
    if (!a.fornecedor.dbId) throw new Error("Este fornecedor ainda não foi salvo.");
    if (conferindoRef.current) throw new Error("Aguarde a conferência do envio pendente.");
    const s = registroEnvio(userId, comercioId, "pedido").sessao(newUid());
    let r: Awaited<ReturnType<typeof salvarPedido>>;
    try {
      r = await salvarPedido({ id: s.dbId, comercioId, fornecedorId: a.fornecedor.dbId!, observacao: a.observacao, linhas: a.linhas }, s);
    } catch (e) {
      throw new Error(e instanceof Error && e.message === ERRO_REGISTRO ? ERRO_REGISTRO : s.incerto
        ? "Não foi possível confirmar o pedido. Confira o envio pendente antes de montar outro pedido."
        : mensagemErro(e));
    } finally { atualizarEnvios((n) => n + 1); }
    if (r.recuperado) setToast("O pedido anterior foi confirmado. Confira-o na lista de pedidos.");
    const ps = await recarregarPedidos(comercioId);
    return { ...r, token: ps?.find((x) => x.id === r.id)?.token };
  };
  const resolverRecebimento = (comercioId: string) => async (itemId: string, acao: "aceitar" | "recusar", tentativa: number | null) => {
    await comMensagem(() => resolverItemRecebimento(itemId, acao, tentativa), "Não foi possível salvar a decisão.");
    await recarregar(comercioId);
  };
  const semPedidoCache = useRef<Record<string, () => Promise<Recebimento[]>>>({});
  const semPedido = (comercioId: string) => (semPedidoCache.current[comercioId] ??= () => carregarRecebimentos(comercioId, false));
  const pedidoPagamento = (comercioId: string) => async (id: string, d: DadosPagamento) => {
    await comMensagem(() => atualizarPagamento(id, d), "Não foi possível salvar o pagamento.");
    await recarregarPedidos(comercioId);
  };
  const pedidoNovoLink = (comercioId: string) => async (id: string) => {
    const t = await comMensagem(() => novoLinkPedido(id), "Não foi possível gerar o novo link.");
    await recarregarPedidos(comercioId);
    return t;
  };
  const pedidoEnviado = (comercioId: string) => async (id: string, canal: CanalPedido) => {
    await comMensagem(() => marcarPedidoEnviado(id, canal), "Não foi possível marcar o pedido como enviado.");
    await recarregarPedidos(comercioId);
  };
  const pedidoCancelado = (comercioId: string) => async (id: string) => {
    await comMensagem(() => cancelarPedido(id), "Não foi possível cancelar o pedido.");
    await recarregarPedidos(comercioId);
  };
  const updateSupplier = async (s: Supplier, f: Omit<Supplier, "id">) => {
    if (!s.dbId) throw new Error("Este fornecedor ainda não foi salvo.");
    try { await atualizarFornecedor(s.dbId, f); }
    catch (e) { throw new Error(`Não foi possível salvar o fornecedor. ${mensagemErro(e).replace(/^Não foi possível salvar agora\. /, "")}`); }
    const novo = { ...s, nome: f.nome.trim(), tel: f.tel.replace(/\D/g, ""), email: f.email.trim().toLowerCase() };
    ++fornVersao.current;
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
          const comDb: Product = { ...p, id: sessao.current.dbId, db: p.db ?? { id: sessao.current.dbId, contadas: [] } };
          let res: "gravado" | "anterior_gravado";
          try {
            res = await salvarProduto(sessao.current, comDb, wizard.initial, sid, cur.tipo === "farmacia", suppRef.current, newUid);
          } catch (e) {
            atualizarEnvios((n) => n + 1);
            setSaveErro(e instanceof Error && e.message === ERRO_REGISTRO ? ERRO_REGISTRO : sessao.current.incerto
              ? "Não foi possível confirmar se o produto foi salvo. Toque em Salvar de novo: o mesmo envio será repetido sem duplicar."
              : mensagemErro(e));
            setSaving(false); return;
          }
          atualizarEnvios((n) => n + 1);
          const atualizou = await recarregar(sid);
          setSaving(false); setWizard(null);
          if (!atualizou) { setToast("Produto salvo. Não foi possível atualizar a lista; tente atualizar antes de editar."); return; }
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
            <button type="button" aria-label={paraResolver(visao.total) ? `Alertas: ${paraResolver(visao.total)} para resolver agora` : "Alertas"} onClick={() => { setTab("alertas"); setOpen(null); }}
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/60 text-foreground hover:border-primary">
              <Bell size={20} />
              {(paraResolver(visao.total) > 0 || deOlho(visao.total) > 0) && <span className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${paraResolver(visao.total) ? "bg-destructive" : "bg-warning"}`} />}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1100px] px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 md:pb-10">
          {tab === "inicio" && cur && (
            <>
              {(pendentes.length > 0 || registroErro) && <div role="alert" className="mb-4 space-y-3 rounded-2xl border border-warning/60 bg-warning/10 p-4">
                <p className="text-sm font-semibold">{registroErro || "Há um envio sem confirmação neste aparelho. Confira antes de cadastrar novamente."}</p>
                {pendentes.map((tipo) => <button key={tipo} type="button" disabled={conferindo} onClick={() => void recuperar(tipo)}
                  className="min-h-12 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50">
                  {conferindo ? "Conferindo…" : `Conferir envio de ${tipo === "produto" ? "produto" : "pedido"}`}
                </button>)}
              </div>}
              {list.length > 0 && carga !== "ok" && <p role="status" className="mb-4 rounded-2xl border border-warning/60 p-3 text-sm">
                {carga === "carregando" ? "Atualizando produtos e saldos…" : "Não foi possível atualizar produtos e saldos. Os dados exibidos são da última consulta. Toque em Atualizar."}
              </p>}
              {cargaPedidos === "erro" && <p role="alert" className="mb-4 rounded-2xl border border-warning/60 p-3 text-sm">Não foi possível atualizar os pedidos e as contas a pagar. Toque em Atualizar.</p>}
              {(carga === "erro" || cargaPedidos === "erro") && list.length > 0 && <button type="button" disabled={conferindo || carga === "carregando" || cargaPedidos === "carregando"}
                onClick={() => { if (sid) void recarregar(sid); }} className="mb-4 min-h-12 rounded-2xl border border-border px-4 text-sm font-semibold disabled:opacity-50">Atualizar dados</button>}
            </>
          )}
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
            <StoreSpace key={`${sid ?? "sem-id"}:${sid ? recuperacoes[sid] ?? 0 : 0}`} store={cur} products={list} suppliers={suppliers} saved={saved} locais={sid ? locais[sid] : undefined}
              onAddSupplier={addSupplier} onUpdateSupplier={updateSupplier}
              pedidos={sid ? pedidos[sid] ?? [] : []}
              pedidosProntos={carga === "ok" && cargaPedidos === "ok" && !pendentes.length && !registroErro && !conferindo}
              pedidosCarregados={!!sid && sid in pedidos}
              atualizando={carga === "carregando" || cargaPedidos === "carregando" || conferindo}
              onAtualizar={() => { if (sid) void recarregar(sid); }}
              onSalvarPedido={sid ? salvarPedidoNovo(sid) : async () => { throw new Error(NO_ID); }}
              onPedidoEnviado={sid ? pedidoEnviado(sid) : async () => {}} onCancelarPedido={sid ? pedidoCancelado(sid) : async () => {}}
              onNovoLinkPedido={sid ? pedidoNovoLink(sid) : async () => { throw new Error(NO_ID); }}
              onPagamentoPedido={sid ? pedidoPagamento(sid) : async () => { throw new Error(NO_ID); }}
              onResolverRecebimento={sid ? resolverRecebimento(sid) : undefined}
              onCarregarSemPedido={sid ? semPedido(sid) : undefined}
              inicio={inicioLoja}
              vendidoSemCadastro={sid ? geral[sid]?.vendas?.semCadastro ?? 0 : 0}
              onVendasMudou={() => { if (sid) { void recarregar(sid); if (idsLojas) void carregarGeral(idsLojas.split(",")); } }}
              diferencasDecidir={sid ? geral[sid]?.diferencas ?? 0 : 0}
              onDiferencasMudou={() => { if (sid) { void recarregar(sid); if (idsLojas) void carregarGeral(idsLojas.split(",")); } }}
              onBack={() => { setOpen(null); setSaved(false); setInicioLoja(undefined); }} onNew={() => openWizard()} onEdit={(p) => openWizard(p)} onDismissSaved={() => setSaved(false)} />
          ) : tab === "inicio" ? (
            <HomeContent stores={stores} visao={visao} onAdd={() => setAdding(true)} onOpen={(s) => abrirLoja(s)} onAlertas={() => setTab("alertas")}
              onVendas={() => { const com = stores.filter((s) => idDe(s)); if (com.length === 1) abrirLoja(com[0]!, { aba: "Vendas" }); else setTab("comercios"); }}
              onTentar={() => { if (idsLojas) void carregarGeral(idsLojas.split(",")); }} />
          ) : tab === "comercios" ? (
            <div className="mx-auto max-w-[1100px] space-y-4 animate-in fade-in duration-300">
              <div>
                <h1 className="text-xl font-bold">Comércios</h1>
                <p className="text-sm text-muted-foreground">Toque num comércio para ver produtos, depósito, pedidos e equipe.</p>
              </div>
              <CartoesComercios stores={stores} visao={visao} onAdd={() => setAdding(true)} onOpen={(s) => abrirLoja(s)} detalhado />
            </div>
          ) : tab === "alertas" ? (
            <Alertas stores={stores} visao={visao} suppliers={fornGeral} onAbrir={abrirLoja} onTentar={() => { if (idsLojas) void carregarGeral(idsLojas.split(",")); }} />
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
          ) : tab === "equipe" ? (
            <div className="mx-auto max-w-3xl space-y-8">
              <div>
                <h1 className="text-xl font-bold">Equipe</h1>
                <p className="text-sm text-muted-foreground">Cada comércio tem a sua equipe. Também dá para ver dentro do comércio, na aba Equipe.</p>
              </div>
              {stores.filter((s) => s.id).map((s) => <PainelEquipe key={s.id} comercioId={s.id!} comercioNome={s.nome} titulo />)}
            </div>
          ) : (
            null
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

const COR_FRASE = { urgente: "text-destructive", atencao: "text-warning", ok: "text-accent", vazio: "text-muted-foreground" } as const;

function HomeContent({ stores, visao, onAdd, onOpen, onAlertas, onVendas, onTentar }: {
  stores: StoreData[]; visao: VisaoGeral; onAdd: () => void; onOpen: (s: StoreData) => void; onAlertas: () => void; onVendas: () => void; onTentar: () => void;
}) {
  const t = visao.total;
  const pronto = Object.keys(visao.resumos).length > 0;
  const kpis = [
    { label: "Para resolver agora", n: paraResolver(t), Icon: AlertTriangle, cor: "urgente" as const },
    { label: "Para repor", n: t.repor, Icon: ShoppingBasket, cor: "atencao" as const },
    { label: "Para comprar", n: t.comprar, Icon: ShoppingCart, cor: "atencao" as const },
    { label: t.vencendo === 1 ? "Vence em breve" : "Vencem em breve", n: t.vencendo, Icon: CalendarClock, cor: "atencao" as const },
  ];
  const tudoCerto = pronto && !visao.carregando && kpis.every((k) => k.n === 0);
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {stores.length > 0 && (
        <section aria-label="Resumo geral">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Resumo de hoje</h2>
            {visao.carregando && <span className="text-xs text-muted-foreground">Atualizando…</span>}
          </div>
          {visao.erro && !visao.carregando && (
            <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warning/60 p-3 text-sm">
              <span>Não foi possível atualizar algum comércio. Os números podem estar incompletos.</span>
              <button type="button" onClick={onTentar} className="min-h-11 rounded-xl border border-border px-3 font-semibold">Tentar de novo</button>
            </div>
          )}
          <button type="button" onClick={onVendas} aria-label={`Vendas hoje: ${brlVenda(t.vendasHojeTotal)}`}
            className="mb-3 flex w-full items-center gap-4 rounded-3xl border border-primary/50 bg-primary/10 p-4 text-left transition hover:border-primary">
            <ShoppingBag size={24} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted-foreground sm:text-sm">Vendas hoje</span>
              <span className="block text-2xl font-bold tracking-tight sm:text-3xl">{pronto ? brlVenda(t.vendasHojeTotal) : "…"}</span>
            </span>
            <span className="shrink-0 text-right text-xs text-muted-foreground">
              {!pronto ? "" : t.vendasHojeN === 0 ? "Nenhuma venda ainda" : t.vendasHojeN === 1 ? "1 venda" : `${t.vendasHojeN} vendas`}
              <span className="block font-semibold text-primary">Ver vendas</span>
            </span>
          </button>
          {tudoCerto ? (
            <p className="flex items-center gap-2 rounded-3xl border border-accent/50 bg-accent/10 p-4 text-sm font-semibold text-accent">
              <CircleCheck size={20} className="shrink-0" /> Tudo certo! Nenhum comércio precisa de atenção agora.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {kpis.map(({ label, n, Icon, cor }) => {
                const ativo = n > 0;
                const borda = !ativo ? "border-border bg-secondary/70" : cor === "urgente" ? "border-destructive/60 bg-destructive/10" : "border-warning/60 bg-warning/10";
                return (
                  <button key={label} type="button" onClick={onAlertas} className={`rounded-3xl border p-4 text-left transition hover:border-primary ${borda}`}>
                    <Icon size={20} className={!ativo ? "text-muted-foreground" : cor === "urgente" ? "text-destructive" : "text-warning"} />
                    <p className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{pronto ? n : "…"}</p>
                    <p className="mt-1 text-xs leading-tight text-muted-foreground sm:text-sm">{label}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold">Seus comércios <span className="text-muted-foreground">({stores.length})</span></h2>
        <CartoesComercios stores={stores} visao={visao} onAdd={onAdd} onOpen={onOpen} />
      </section>
    </div>
  );
}

/** Cartões dos comércios com a situação de cada um (mesma regra do "Atenção hoje"). */
function CartoesComercios({ stores, visao, onAdd, onOpen, detalhado = false }: {
  stores: StoreData[]; visao: VisaoGeral; onAdd: () => void; onOpen: (s: StoreData) => void; detalhado?: boolean;
}) {
  const nome = (tipo: string) => TIPOS.find((t) => t.id === tipo)?.nome ?? "";
  return (
    <>
      {stores.length === 0 && (
        <div className="mb-3 rounded-3xl border border-border bg-secondary/40 p-6 text-center">
          <Store size={32} className="mx-auto text-muted-foreground" />
          <p className="mt-2 font-semibold">Você ainda não tem comércios</p>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre o primeiro para começar a acompanhar tudo por aqui.</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {stores.map((s, i) => {
          const Icon = iconOf(s.tipo);
          const id = idDe(s);
          const r = id ? visao.resumos[id] : undefined;
          const g = id ? visao.geral[id] : undefined;
          const f = r ? fraseComercio(r) : null;
          return (
            <button key={s.id ?? i} type="button" onClick={() => onOpen(s)}
              className="flex min-h-[112px] items-center gap-4 rounded-3xl border border-border bg-secondary/70 p-4 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-ring">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background-deep/60 text-primary"><Icon size={24} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.nome}</p>
                <p className="truncate text-sm text-muted-foreground">{detalhado && nome(s.tipo) ? `${nome(s.tipo)} · ` : ""}{s.cidade} - {s.uf}</p>
                <p className={`mt-1.5 text-xs font-semibold ${f ? COR_FRASE[f.nivel] : "text-muted-foreground"}`}>
                  {f ? f.texto : g?.estado === "erro" ? "Não foi possível atualizar" : "Carregando…"}
                </p>
                {f?.extra && <p className="mt-0.5 text-xs font-semibold text-warning">{f.extra}</p>}
                {r && r.vendasHojeTotal > 0 && <p className="mt-0.5 text-xs text-muted-foreground"><b className="text-foreground">{brlVenda(r.vendasHojeTotal)}</b> vendidos hoje</p>}
                {detalhado && r && r.produtos > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{r.produtos} {r.produtos === 1 ? "produto" : "produtos"}</p>}
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
    </>
  );
}

/** Menu Alertas: o "Atenção hoje" de cada comércio, o mais urgente primeiro. Tocar abre o comércio no lugar certo. */
function Alertas({ stores, visao, suppliers, onAbrir, onTentar }: {
  stores: StoreData[]; visao: VisaoGeral; suppliers: Supplier[]; onAbrir: (s: StoreData, inicio?: InicioComercio) => void; onTentar: () => void;
}) {
  const hoje = hojeEm();
  const comId = stores.map((s) => ({ s, id: idDe(s) })).filter((x): x is { s: StoreData; id: string } => !!x.id);
  const prontos = comId.filter((x) => visao.resumos[x.id]);
  const comAviso = prontos.filter((x) => paraResolver(visao.resumos[x.id]!) + deOlho(visao.resumos[x.id]!) > 0)
    .sort((a, b) => paraResolver(visao.resumos[b.id]!) - paraResolver(visao.resumos[a.id]!) || deOlho(visao.resumos[b.id]!) - deOlho(visao.resumos[a.id]!));
  const semAviso = prontos.filter((x) => !comAviso.includes(x));
  const faltando = comId.filter((x) => !visao.resumos[x.id]);
  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-in fade-in duration-300">
      <div>
        <h1 className="text-xl font-bold">Alertas</h1>
        <p className="text-sm text-muted-foreground">O que precisa de atenção em todos os seus comércios. O mais urgente vem primeiro.</p>
      </div>
      {!stores.length && <p className="rounded-3xl border border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground">Cadastre um comércio para ver os alertas aqui.</p>}
      {faltando.length > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-3 text-sm">
          <span>{faltando.some((x) => visao.geral[x.id]?.estado === "erro") ? `Não foi possível atualizar: ${faltando.map((x) => x.s.nome).join(", ")}.` : "Carregando os comércios…"}</span>
          {faltando.some((x) => visao.geral[x.id]?.estado === "erro") && <button type="button" onClick={onTentar} className="min-h-11 rounded-xl border border-border px-3 font-semibold">Tentar de novo</button>}
        </div>
      )}
      {prontos.length > 0 && !comAviso.length && (
        <p className="flex items-center gap-2 rounded-3xl border border-accent/50 bg-accent/10 p-4 text-sm font-semibold text-accent">
          <CircleCheck size={20} className="shrink-0" /> Tudo certo! Nenhum comércio precisa de atenção agora.
        </p>
      )}
      {comAviso.map(({ s, id }) => {
        const g = visao.geral[id]!;
        const Icon = iconOf(s.tipo);
        const f = fraseComercio(visao.resumos[id]!);
        return (
          <section key={id} aria-label={s.nome} className="space-y-2">
            <button type="button" onClick={() => onAbrir(s)} className="flex w-full items-center gap-3 rounded-2xl px-1 py-1 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{s.nome}</span>
                <span className={`block text-xs font-semibold ${COR_FRASE[f.nivel]}`}>{f.texto}</span>
                {f.extra && <span className="block text-xs font-semibold text-warning">{f.extra}</span>}
              </span>
              <span className="flex shrink-0 items-center text-sm font-semibold text-primary">Abrir <ChevronRight size={18} /></span>
            </button>
            <AtencaoHoje products={g.produtos} tipo={s.tipo} suppliers={suppliers} jaPedidos={produtosJaPedidos(g.pedidos)}
              contas={resumoPagamentos(g.pedidos, hoje)} entregasDecidir={entregasParaDecidir(g.pedidos)}
              onOpen={(p) => onAbrir(s, { produtoId: p.id })}
              onFazerPedido={() => onAbrir(s, { pedidos: "montar" })}
              onVerContas={() => onAbrir(s, { pedidos: "contas" })}
              onVerEntregas={() => onAbrir(s, { pedidos: "lista" })}
              semCadastro={g.vendas?.semCadastro ?? 0} onVerSemCadastro={() => onAbrir(s, { aba: "Vendas" })}
              diferencas={g.diferencas ?? 0} onVerDiferencas={() => onAbrir(s, { aba: "Diferenças" })} />
          </section>
        );
      })}
      {semAviso.length > 0 && comAviso.length > 0 && (
        <div className="rounded-2xl border border-border p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-accent"><CircleCheck size={16} /> Tudo certo</p>
          <p className="mt-1 text-muted-foreground">{semAviso.map((x) => x.s.nome).join(" · ")}</p>
        </div>
      )}
    </div>
  );
}

