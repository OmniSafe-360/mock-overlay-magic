/* Caixa no celular (C2 e C3), dentro do app da equipe "Omni Operação". Tela cheia, como um app do próprio celular:
 * abrir o caixa (troco da gaveta) → bipar (câmera sempre lendo, ou leitor de código ligado ao celular) → receber
 * (dinheiro com troco, Pix, cartão ou fiado) → "Venda finalizada". Só aqui o produto sai da gôndola.
 * Menu do caixa (C3): vendas deste caixa (cancelar com o PIN do dono), tirar dinheiro da gaveta (PIN do dono) e fechar o caixa.
 * Sem internet: a venda finalizada fica guardada no celular e vai sozinha quando a internet voltar (nunca conta duas vezes). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Banknote, BookUser, MessageCircle, Camera, CameraOff, Check, CheckCircle2, CloudOff, CreditCard, HandCoins, Home, Lock, Menu, Minus, PackagePlus, Plus, QrCode,
  Receipt, Scale, Search, ShoppingCart, Smartphone, Trash2, TriangleAlert, UserPlus, X,
} from "lucide-react";
import { LeitorContinuo } from "@/components/LeitorContinuo";
import { Sheet } from "@/components/parts/Sheet";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import {
  FORMA_TXT, acharPorCodigo, adicionar, atalhosDinheiro, bip, brl, buscarProdutos, centavosDigitados, contarItens, enviarFila, erroCaixa, erroPinDono, filaCaixa,
  itemDoProduto, lerQuantidade, linkWhatsApp, mascaraDinheiro, montarVenda, qtdTexto, semInternet, situacaoPagamento, subtotal, textoComprovante, textoDiferencaCaixa, totalCarrinho,
  type DadosComprovante,
  vendaGuardadaValida, type Achado, type FormaCaixa, type ItemCarrinho, type PagamentoCaixa, type ProdutoCaixa, type VendaGuardada,
} from "@/lib/caixa";
import { newUid, unPlural, unSingular } from "@/lib/deposito";
import { digits, maskPhone } from "@/lib/formatacao";
import { escopoAcesso } from "@/lib/operacaoLocal";

export type ApiCaixa = {
  estado: typeof banco.caixaEstado;
  produtos: typeof banco.caixaProdutos;
  clientes: typeof banco.caixaClientesFiado;
  abrir: typeof banco.caixaAbrir;
  registrar: typeof banco.caixaRegistrarVenda;
  cancelar?: typeof banco.caixaCancelarVenda | undefined;
  sangria?: typeof banco.caixaSangria | undefined;
  fechar?: typeof banco.caixaFechar | undefined;
};
const API_PADRAO: ApiCaixa = {
  estado: banco.caixaEstado, produtos: banco.caixaProdutos, clientes: banco.caixaClientesFiado, abrir: banco.caixaAbrir, registrar: banco.caixaRegistrarVenda,
  cancelar: banco.caixaCancelarVenda, sangria: banco.caixaSangria, fechar: banco.caixaFechar,
};

type ClienteVenda = { id: string; nome: string; telefone: string | null; novo: boolean };
type Rascunho = { carrinho: ItemCarrinho[]; pags: PagamentoCaixa[]; cliente: ClienteVenda | null };
const chaveRascunho = (escopo: string) => `omni.caixa.rascunho.v1:${escopo}`;
function lerRascunho(escopo: string): Rascunho | null {
  try { const r = JSON.parse(localStorage.getItem(chaveRascunho(escopo)) ?? "null"); return r && Array.isArray(r.carrinho) && Array.isArray(r.pags) ? r : null; } catch { return null; }
}
function guardarRascunho(escopo: string, r: Rascunho) {
  try { if (!r.carrinho.length && !r.pags.length) localStorage.removeItem(chaveRascunho(escopo)); else localStorage.setItem(chaveRascunho(escopo), JSON.stringify(r)); } catch { /* sem armazenamento */ }
}
/** Cópia do caixa e dos produtos no celular, para continuar vendendo se a internet cair. */
type Cache = { estado: banco.EstadoCaixa; produtos: ProdutoCaixa[]; clientes?: banco.ClienteFiado[] | undefined };
const chaveCache = (escopo: string) => `omni.caixa.cache.v1:${escopo}`;
function lerCache(escopo: string): Cache | null {
  try { const c = JSON.parse(localStorage.getItem(chaveCache(escopo)) ?? "null"); return c && c.estado && Array.isArray(c.produtos) ? c : null; } catch { return null; }
}
function gravarCache(escopo: string, c: Partial<Cache>) {
  try { const a = lerCache(escopo); localStorage.setItem(chaveCache(escopo), JSON.stringify({ ...a, ...c })); } catch { /* sem armazenamento */ }
}
function apagarCache(escopo: string) { try { localStorage.removeItem(chaveCache(escopo)); } catch { /* nada */ } }
/** A venda guardada pela versão anterior do caixa (C2) entra na fila. */
function trazerVendaAntiga(escopo: string, fila: ReturnType<typeof filaCaixa>) {
  const k = `omni.operacao.v1:${encodeURIComponent(escopo)}:caixa-venda`;
  try { const r = JSON.parse(localStorage.getItem(k) ?? "null"); if (r && vendaGuardadaValida(r.pedido)) fila.por(r.pedido); localStorage.removeItem(k); } catch { /* nada */ }
}

type Fase = "carregando" | "erro" | "abrir" | "vender" | "receber" | "feito" | "fechar";
type Aviso = { ok: boolean; texto: string } | null;
type Feito = { id: string; total: number; troco: number; numero: number | null; formas: string; guardada: boolean; comprovante: DadosComprovante; telefone: string | null };
/** Tempo entre as tentativas de enviar as vendas guardadas. */
export const SEGUNDOS_REENVIO = 20;

export function CaixaCelular({ chave, mercado = false, onSair, onInstalar, api: apiDada }: {
  chave: string; mercado?: boolean; onSair: () => void; api?: ApiCaixa | undefined;
  /** Pôr o ícone "Omni Caixa" na tela do celular (some quando já está aberto pelo ícone). */ onInstalar?: (() => void) | undefined;
}) {
  const api = apiDada ?? API_PADRAO;
  const [fase, setFase] = useState<Fase>("carregando");
  const [erroCarga, setErroCarga] = useState("");
  const [estado, setEstado] = useState<banco.EstadoCaixa | null>(null);
  const [produtos, setProdutos] = useState<ProdutoCaixa[]>([]);
  const [escopo, setEscopo] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [pags, setPags] = useState<PagamentoCaixa[]>([]);
  const [cliente, setCliente] = useState<ClienteVenda | null>(null);
  const [feito, setFeito] = useState<Feito | null>(null);
  const [guardadas, setGuardadas] = useState<VendaGuardada[]>([]);
  const [offline, setOffline] = useState(false);
  const [erroFila, setErroFila] = useState("");
  const [erroVenda, setErroVenda] = useState("");
  const fila = useRef<ReturnType<typeof filaCaixa> | null>(null);
  const sincronizando = useRef(false);

  const atualizarEstado = useCallback(() => {
    void api.estado(chave).then((e) => { setEstado(e); setOffline(false); if (escopo) gravarCache(escopo, { estado: e }); }).catch(() => {});
  }, [api, chave, escopo]);

  /** Envia as vendas guardadas (a mais antiga primeiro). */
  const sincronizar = useCallback(async () => {
    if (!fila.current || sincronizando.current) return;
    sincronizando.current = true;
    try {
      await enviarFila(fila.current, (v) => api.registrar(chave, v.venda),
        (v, r) => setFeito((f) => (f && f.id === v.venda.id ? { ...f, numero: r.numero, guardada: false, comprovante: { ...f.comprovante, numero: r.numero } } : f)));
      setOffline(false); setErroFila("");
      atualizarEstado();
    } catch (e) {
      if (semInternet(e)) setOffline(true); else setErroFila(erroCaixa(e));
    } finally {
      sincronizando.current = false;
      setGuardadas(fila.current.ler());
    }
  }, [api, chave, atualizarEstado]);

  const carregar = useCallback(async () => {
    setFase("carregando"); setErroCarga("");
    try {
      const esc = await escopoAcesso(chave);
      fila.current = filaCaixa(esc);
      trazerVendaAntiga(esc, fila.current);
      setGuardadas(fila.current.ler());
      const r = lerRascunho(esc);
      if (r) { setCarrinho(r.carrinho); setPags(r.pags); setCliente(r.cliente); }
      setEscopo(esc);
      let est: banco.EstadoCaixa, prods: ProdutoCaixa[];
      try {
        [est, prods] = await Promise.all([api.estado(chave), api.produtos(chave)]);
        gravarCache(esc, { estado: est, produtos: prods }); setOffline(false);
      } catch (e) {
        const c = lerCache(esc);
        if (!semInternet(e) || !c?.estado.turno) throw e;
        est = c.estado; prods = c.produtos; setOffline(true);
      }
      setEstado(est); setProdutos(prods);
      setFase(est.turno ? "vender" : "abrir");
    } catch (e) { setErroCarga(erroCaixa(e)); setFase("erro"); }
  }, [api, chave]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (escopo) guardarRascunho(escopo, { carrinho, pags, cliente }); }, [escopo, carrinho, pags, cliente]);
  // Vendas guardadas: tenta de novo de tempos em tempos e quando a internet volta.
  useEffect(() => {
    if (!guardadas.some((g) => !g.problema)) return;
    const t = setInterval(() => { void sincronizar(); }, SEGUNDOS_REENVIO * 1000);
    const voltou = () => { void sincronizar(); };
    window.addEventListener("online", voltou);
    return () => { clearInterval(t); window.removeEventListener("online", voltou); };
  }, [guardadas, sincronizar]);
  // A tela não apaga enquanto o caixa está aberto.
  useEffect(() => {
    if (fase !== "vender" && fase !== "receber") return;
    let trava: { release: () => Promise<void> } | null = null;
    const pedir = () => { void (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen").then((w) => { trava = w; }).catch(() => {}); };
    pedir();
    const voltou = () => { if (document.visibilityState === "visible") pedir(); };
    document.addEventListener("visibilitychange", voltou);
    return () => { document.removeEventListener("visibilitychange", voltou); void trava?.release().catch(() => {}); };
  }, [fase]);

  const total = totalCarrinho(carrinho);

  /** Finalizar: a venda é guardada no celular na hora e enviada em seguida (sem internet, vai depois). */
  const finalizar = () => {
    if (!fila.current || !estado?.turno) return;
    const s = situacaoPagamento(total, pags);
    if (!s.pronto) return;
    const v: VendaGuardada = {
      venda: montarVenda(newUid(), estado.turno.id, carrinho, pags, cliente ? (cliente.novo ? { id: cliente.id, nome: cliente.nome, ...(cliente.telefone ? { telefone: cliente.telefone } : {}) } : { id: cliente.id }) : null),
      total, troco: s.troco, formas: pags.map((p) => FORMA_TXT[p.forma]).join(" + "),
    };
    try { fila.current.por(v); } catch (e) { setErroVenda(e instanceof Error ? e.message : String(e)); return; }
    setErroVenda("");
    setCarrinho([]); setPags([]); setCliente(null);
    setGuardadas(fila.current.ler());
    setFeito({ id: v.venda.id, total: v.total, troco: v.troco, numero: null, formas: v.formas, guardada: true, telefone: cliente?.telefone ?? null,
      comprovante: { comercio: { nome: estado.comercio.nome, endereco: estado.comercio.endereco }, numero: null, feitaEm: v.venda.feita_em,
        itens: carrinho.map((i) => ({ descricao: i.detalhe ? `${i.nome} (${i.detalhe})` : i.nome, qtd: i.qtd, valor: subtotal(i) })),
        total, pagamentos: pags, troco: s.troco, cliente: cliente?.nome ?? null } });
    setFase("feito"); bip();
    void sincronizar();
  };

  if (fase === "carregando") return <Tela><p className="m-auto text-base text-muted-foreground">Abrindo o caixa…</p></Tela>;
  if (fase === "erro" || !estado) return (
    <Tela>
      <div className="m-auto w-full space-y-3 px-4 text-center">
        <TriangleAlert size={32} className="mx-auto text-warning" />
        <p className="text-base font-semibold">{erroCarga || "Não foi possível abrir o caixa."}</p>
        <button type="button" onClick={() => void carregar()} className={btnPrimary(true)}>Tentar de novo</button>
        <button type="button" onClick={onSair} className={`w-full ${btnGhost}`}>Voltar ao início</button>
      </div>
    </Tela>
  );
  if (fase === "abrir") return <AbrirCaixa nome={estado.nome} api={api} chave={chave} onSair={onSair}
    onAberto={(t) => { const e = { ...estado, turno: t, vendas: [] }; setEstado(e); gravarCache(escopo, { estado: e }); setFase("vender"); }} />;
  if (fase === "feito" && feito) return <VendaFeita f={feito} onProxima={() => { setFeito(null); setFase("vender"); }} />;
  if (fase === "fechar" && estado.turno) return (
    <FecharCaixa turno={estado.turno} guardadas={guardadas.filter((g) => !g.problema).length} chave={chave} api={api} onEnviar={sincronizar}
      onVoltar={() => setFase("vender")} onFechado={() => { apagarCache(escopo); onSair(); }} />
  );
  if (fase === "receber") return (
    <Receber total={total} pags={pags} cliente={cliente} chave={chave} escopo={escopo} api={api} erro={erroVenda}
      onPags={setPags} onCliente={setCliente} onVoltar={() => { setErroVenda(""); setFase("vender"); }} onFinalizar={finalizar} />
  );
  return (
    <Vender estado={estado} produtos={produtos} mercado={mercado} carrinho={carrinho} onCarrinho={setCarrinho} onSair={onSair}
      guardadas={guardadas} offline={offline} erroFila={erroFila} onEnviarGuardadas={() => void sincronizar()}
      chave={chave} api={api} onEstado={(e) => { setEstado(e); gravarCache(escopo, { estado: e }); }} onAtualizar={atualizarEstado}
      onFechar={() => setFase("fechar")} onInstalar={onInstalar}
      onReceber={() => { setErroVenda(""); setFase("receber"); }}
      onLimpar={() => { setCarrinho([]); setPags([]); setCliente(null); }} />
  );
}

/** Tela cheia por cima de tudo, com cara de app do celular. */
function Tela({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-app text-foreground">
      <div className="flex h-dvh w-full max-w-[480px] flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>{children}</div>
    </div>
  );
}

/** Campo de dinheiro como na máquina do caixa: os números entram pelos centavos. */
function CampoDinheiro({ rotulo, valor, onMudar, grande = false, autoFocus = false }: { rotulo: string; valor: number; onMudar: (c: number) => void; grande?: boolean; autoFocus?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-muted-foreground">{rotulo}</span>
      <span className="relative block">
        <span className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground ${grande ? "text-2xl" : "text-lg"}`}>R$</span>
        <input inputMode="numeric" autoFocus={autoFocus} aria-label={rotulo} value={mascaraDinheiro(valor)} onChange={(e) => onMudar(centavosDigitados(e.target.value))}
          className={`w-full rounded-2xl border border-border bg-background-deep/60 pl-14 pr-4 text-right font-bold tabular-nums text-foreground outline-none focus-visible:border-primary ${grande ? "h-16 text-3xl" : "h-14 text-2xl"}`} />
      </span>
    </label>
  );
}

function AbrirCaixa({ nome, chave, api, onAberto, onSair }: { nome: string; chave: string; api: ApiCaixa; onAberto: (t: banco.TurnoCaixa) => void; onSair: () => void }) {
  const [troco, setTroco] = useState(0);
  const [id] = useState(newUid);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  const abrir = () => {
    setAbrindo(true); setErro("");
    api.abrir(chave, id, troco).then(onAberto, (e) => { setErro(erroCaixa(e)); setAbrindo(false); });
  };
  return (
    <Tela>
      <div className="flex flex-1 flex-col gap-5 px-4 pt-4">
        <button type="button" onClick={onSair} className="flex min-h-12 w-fit items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Início</button>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15 text-primary"><ShoppingCart size={32} /></span>
          <h1 className="text-2xl font-bold">Abrir o caixa</h1>
          <p className="text-base text-muted-foreground">Olá, {nome.split(" ")[0]}! Conte o dinheiro que já está na gaveta.</p>
        </div>
        <CampoDinheiro rotulo="Quanto tem de troco na gaveta?" valor={troco} onMudar={setTroco} grande autoFocus />
        <div className="grid grid-cols-4 gap-2">
          {[0, 5000, 10000, 20000].map((v) => (
            <button key={v} type="button" aria-pressed={troco === v} onClick={() => setTroco(v)}
              className={`min-h-12 rounded-2xl border text-sm font-semibold ${troco === v ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{v ? brl(v).replace(",00", "") : "Sem troco"}</button>
          ))}
        </div>
        {erro && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro}</p>}
        <button type="button" disabled={abrindo} onClick={abrir} className={`mt-auto flex items-center justify-center gap-2 ${btnPrimary(!abrindo)}`}>
          <Check size={20} /> {abrindo ? "Abrindo…" : "Abrir caixa"}
        </button>
        <p className="pb-2 text-center text-xs text-muted-foreground">No fim do dia você fecha o caixa e conta o dinheiro de novo.</p>
      </div>
    </Tela>
  );
}

type Janela =
  | { j: "buscar" }
  | { j: "sem_cadastro"; codigo: string | null }
  | { j: "peso"; a: Achado; codigo: string | null; editar?: string | undefined; qtd?: number | undefined }
  | { j: "variacao"; a: Achado; codigo: string | null }
  | { j: "limpar" }
  | { j: "menu" }
  | { j: "vendas" }
  | { j: "sangria" }
  | null;

function Vender({ estado, produtos, mercado, carrinho, onCarrinho, onSair, onReceber, onLimpar, guardadas, offline, erroFila, onEnviarGuardadas,
  chave, api, onEstado, onAtualizar, onFechar, onInstalar }: {
  estado: banco.EstadoCaixa; produtos: ProdutoCaixa[]; mercado: boolean; carrinho: ItemCarrinho[]; onCarrinho: (f: (c: ItemCarrinho[]) => ItemCarrinho[]) => void;
  onSair: () => void; onReceber: () => void; onLimpar: () => void;
  guardadas: VendaGuardada[]; offline: boolean; erroFila: string; onEnviarGuardadas: () => void;
  chave: string; api: ApiCaixa; onEstado: (e: banco.EstadoCaixa) => void; onAtualizar: () => void; onFechar: () => void; onInstalar?: (() => void) | undefined;
}) {
  const [camera, setCamera] = useState(true);
  const [janela, setJanela] = useState<Janela>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const total = totalCarrinho(carrinho);
  const fimLista = useRef<HTMLDivElement>(null);
  const t = estado.turno;

  const avisar = (a: Aviso) => { setAviso(a); };
  const colocar = useCallback((item: ItemCarrinho) => {
    onCarrinho((c) => adicionar(c, item));
    avisar({ ok: true, texto: `${item.nome}${item.detalhe ? ` · ${item.detalhe}` : ""} · ${brl(subtotal(item))}` });
    setTimeout(() => fimLista.current?.scrollIntoView?.({ block: "end", behavior: "smooth" }), 30);
  }, [onCarrinho]);
  const incluir = useCallback((a: Achado, codigo: string | null) => {
    if (a.produto.variacoes.length && !a.variacaoId && !a.embalagemId) { setJanela({ j: "variacao", a, codigo }); return; }
    if (!a.embalagemId && a.produto.fracionado) { setJanela({ j: "peso", a, codigo }); return; }
    colocar(itemDoProduto(newUid(), a, codigo));
  }, [colocar]);
  const lerCodigo = useCallback((c: string) => {
    bip();
    const a = acharPorCodigo(produtos, c);
    if (!a) { avisar({ ok: false, texto: `Código ${c} não está cadastrado` }); setJanela({ j: "sem_cadastro", codigo: c }); return; }
    incluir(a, c);
  }, [produtos, incluir]);

  // Leitor de código ligado ao celular (bluetooth/USB): ele "digita" os números e aperta Enter.
  const lerRef = useRef(lerCodigo); lerRef.current = lerCodigo;
  const janelaRef = useRef(janela); janelaRef.current = janela;
  useEffect(() => {
    let buf = ""; let ultimo = 0;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (janelaRef.current || (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      const agora = Date.now();
      if (agora - ultimo > 100) buf = "";
      ultimo = agora;
      if (/^\d$/.test(e.key)) { buf += e.key; return; }
      if (e.key === "Enter" && buf.length >= 6) { const c = buf; buf = ""; lerRef.current(c); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  const mudarQtd = (id: string, delta: number) => onCarrinho((c) => c.flatMap((x) => (x.id !== id ? [x] : x.qtd + delta <= 0 ? [] : [{ ...x, qtd: x.qtd + delta }])));
  const tirar = (id: string) => onCarrinho((c) => c.filter((x) => x.id !== id));

  return (
    <Tela>
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
        <button type="button" onClick={onSair} aria-label="Voltar ao início" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border"><ArrowLeft size={20} /></button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-lg font-bold"><span className="h-2.5 w-2.5 rounded-full bg-accent" /> Caixa aberto</p>
          <p className="truncate text-xs text-muted-foreground">{estado.nome.split(" ")[0]} · {t ? `${t.vendas === 1 ? "1 venda" : `${t.vendas} vendas`} · ${brl(t.total)}` : ""}</p>
        </div>
        <button type="button" onClick={() => setCamera((v) => !v)} aria-pressed={camera} aria-label={camera ? "Desligar a câmera" : "Ligar a câmera"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${camera ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
          {camera ? <Camera size={20} /> : <CameraOff size={20} />}
        </button>
        <button type="button" onClick={() => { onAtualizar(); setJanela({ j: "menu" }); }} aria-label="Menu do caixa"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border"><Menu size={20} /></button>
      </header>
      {offline && (
        <p role="status" className="mx-4 mb-2 flex items-center gap-2 rounded-2xl bg-warning/15 px-3 py-2 text-sm font-semibold text-warning">
          <CloudOff size={16} className="shrink-0" /> Sem internet: pode continuar vendendo, as vendas ficam guardadas.
        </p>
      )}

      <div className="space-y-2 px-4">
        {camera && <LeitorContinuo mercado={mercado} pausado={!!janela} onCode={lerCodigo} />}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setJanela({ j: "buscar" })} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 px-3 text-sm font-semibold"><Search size={18} /> Código ou nome</button>
          <button type="button" onClick={() => setJanela({ j: "sem_cadastro", codigo: null })} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 px-3 text-sm font-semibold"><PackagePlus size={18} /> Sem cadastro</button>
        </div>
        {aviso && (
          <p role="status" className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${aviso.ok ? "bg-accent/10 text-accent" : "bg-warning/10 text-warning"}`}>
            {aviso.ok ? <CheckCircle2 size={16} className="shrink-0" /> : <TriangleAlert size={16} className="shrink-0" />} <span className="min-w-0 truncate">{aviso.texto}</span>
          </p>
        )}
        <AvisoGuardadas guardadas={guardadas} erroFila={erroFila} onEnviar={onEnviarGuardadas} />
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-4">
        {!carrinho.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground">
            <ShoppingCart size={36} />
            <p className="text-base font-semibold text-foreground">Bipe o primeiro produto</p>
            <p className="text-sm">Aponte a câmera para o código de barras, ou toque em "Código ou nome".</p>
          </div>
        ) : (
          <ul aria-label="Produtos da venda" className="divide-y divide-border">
            {carrinho.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-base font-semibold leading-snug">{i.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.detalhe ? `${i.detalhe} · ` : ""}{i.fracionado ? `${qtdTexto(i.qtd)} ${unPlural(i.unidade).toLowerCase()} × ${brl(i.preco)}` : `${brl(i.preco)} cada`}
                    {!i.produtoId && " · sem cadastro"}
                  </p>
                </div>
                {i.fracionado ? (
                  <button type="button" aria-label={`Tirar ${i.nome}`} onClick={() => tirar(i.id)} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground"><Trash2 size={18} /></button>
                ) : (
                  <div className="flex items-center rounded-2xl border border-border">
                    <button type="button" aria-label={i.qtd === 1 ? `Tirar ${i.nome}` : `Menos ${i.nome}`} onClick={() => mudarQtd(i.id, -1)} className="flex h-11 w-10 items-center justify-center text-primary">
                      {i.qtd === 1 ? <Trash2 size={17} /> : <Minus size={18} />}
                    </button>
                    <span aria-label={`Quantidade de ${i.nome}`} className="min-w-7 text-center text-base font-bold tabular-nums">{i.qtd}</span>
                    <button type="button" aria-label={`Mais ${i.nome}`} onClick={() => mudarQtd(i.id, 1)} className="flex h-11 w-10 items-center justify-center text-primary"><Plus size={18} /></button>
                  </div>
                )}
                <span className="w-20 shrink-0 text-right text-base font-bold tabular-nums">{brl(subtotal(i))}</span>
              </li>
            ))}
          </ul>
        )}
        <div ref={fimLista} />
      </div>

      <footer className="space-y-2 border-t border-border bg-background/80 px-4 pt-3 backdrop-blur">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total{carrinho.length ? ` · ${contarItens(carrinho) === 1 ? "1 item" : `${qtdTexto(contarItens(carrinho))} itens`}` : ""}</p>
            {carrinho.length > 0 && <button type="button" onClick={() => setJanela({ j: "limpar" })} className="text-xs font-semibold text-muted-foreground underline">Limpar venda</button>}
          </div>
          <p aria-label="Total da venda" className="text-4xl font-bold tabular-nums">{brl(total)}</p>
        </div>
        <button type="button" disabled={!carrinho.length} onClick={onReceber} className={`flex items-center justify-center gap-2 ${btnPrimary(!!carrinho.length)}`}>
          <Banknote size={22} /> Receber {carrinho.length ? brl(total) : ""}
        </button>
      </footer>

      {janela?.j === "buscar" && (
        <BuscarProduto produtos={produtos} onClose={() => setJanela(null)}
          onCodigo={(c) => { setJanela(null); lerCodigo(c); }}
          onEscolher={(p) => { setJanela(null); incluir({ produto: p, variacaoId: null, embalagemId: null }, null); }} />
      )}
      {janela?.j === "sem_cadastro" && (
        <SemCadastro codigo={janela.codigo} onClose={() => setJanela(null)}
          onIncluir={(descricao, preco, qtd) => { setJanela(null); colocar({ id: newUid(), produtoId: null, variacaoId: null, embalagemId: null, codigo: janela.codigo, nome: descricao, detalhe: "", unidade: "Unidade", fracionado: false, qtd, preco }); }} />
      )}
      {janela?.j === "peso" && (
        <Peso a={janela.a} onClose={() => setJanela(null)}
          onIncluir={(q) => { setJanela(null); colocar(itemDoProduto(newUid(), janela.a, janela.codigo, q)); }} />
      )}
      {janela?.j === "variacao" && (
        <Sheet title={janela.a.produto.nome} onClose={() => setJanela(null)}>
          <div className="min-h-0 space-y-2 overflow-y-auto px-5 py-3">
            <p className="text-sm text-muted-foreground">Qual tamanho e cor?</p>
            {janela.a.produto.variacoes.map((v) => (
              <button key={v.id} type="button" onClick={() => { const a = { ...janela.a, variacaoId: v.id }; setJanela(null); incluir(a, janela.codigo); }}
                className="flex min-h-13 w-full items-center justify-between rounded-2xl border border-border px-4 text-left text-base font-semibold">{v.nome} <Check size={18} className="text-primary" /></button>
            ))}
          </div>
        </Sheet>
      )}
      {janela?.j === "limpar" && (
        <Sheet title="Limpar a venda?" onClose={() => setJanela(null)}>
          <div className="space-y-2 px-5 py-3">
            <p className="text-sm">Tira todos os produtos desta venda. Nada saiu da gôndola ainda.</p>
            <button type="button" onClick={() => { onLimpar(); setAviso(null); setJanela(null); }} className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-destructive/60 px-4 text-base font-semibold text-destructive">Sim, limpar</button>
            <button type="button" onClick={() => setJanela(null)} className={`w-full ${btnGhost}`}>Voltar</button>
          </div>
        </Sheet>
      )}
      {janela?.j === "menu" && (
        <MenuCaixa estado={estado} guardadas={guardadas.length} onClose={() => setJanela(null)} onInstalar={onInstalar ? () => { setJanela(null); onInstalar(); } : undefined}
          onVendas={() => setJanela({ j: "vendas" })} onSangria={() => setJanela({ j: "sangria" })}
          onFechar={() => { setJanela(null); onFechar(); }} onInicio={() => { setJanela(null); onSair(); }} />
      )}
      {janela?.j === "vendas" && (
        <VendasDoCaixa estado={estado} guardadas={guardadas} chave={chave} api={api} offline={offline} onClose={() => setJanela(null)} onMudou={onAtualizar} />
      )}
      {janela?.j === "sangria" && estado.turno && (
        <Sangria turno={estado.turno} chave={chave} api={api} onClose={() => setJanela(null)}
          onFeito={(t) => { onEstado({ ...estado, turno: t }); setJanela(null); setAviso({ ok: true, texto: "Dinheiro tirado da gaveta e anotado." }); }} />
      )}
    </Tela>
  );
}

function BuscarProduto({ produtos, onEscolher, onCodigo, onClose }: { produtos: ProdutoCaixa[]; onEscolher: (p: ProdutoCaixa) => void; onCodigo: (c: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const achados = useMemo(() => buscarProdutos(produtos, q), [produtos, q]);
  const soNumeros = /^\d{6,14}$/.test(q.trim());
  return (
    <Sheet title="Código ou nome" onClose={onClose}>
      <form className="min-h-0 space-y-3 overflow-y-auto px-5 py-3" onSubmit={(e) => { e.preventDefault(); if (soNumeros) onCodigo(q.trim()); else if (achados.length === 1) onEscolher(achados[0]!); }}>
        <label className="relative block">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite o código ou o nome" aria-label="Código ou nome do produto" enterKeyHint="search"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 pl-11 pr-4 text-base text-foreground outline-none focus-visible:border-primary" />
        </label>
        {soNumeros && <button type="submit" className={btnPrimary(true)}>Usar o código {q.trim()}</button>}
        <ul className="space-y-1.5" aria-label="Produtos encontrados">
          {q.trim().length >= 2 && !achados.length && !soNumeros && <li className="p-3 text-center text-sm text-muted-foreground">Nenhum produto com esse nome.</li>}
          {achados.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onEscolher(p)} className="flex min-h-13 w-full items-center justify-between gap-2 rounded-2xl border border-border px-3 text-left">
                <span className="min-w-0"><span className="block break-words text-base font-semibold">{p.nome}</span><span className="block text-xs text-muted-foreground">{p.fracionado ? `${brl(p.preco)} / ${unSingular(p.unidade).toLowerCase()}` : brl(p.preco)}</span></span>
                <Plus size={18} className="shrink-0 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      </form>
    </Sheet>
  );
}

function SemCadastro({ codigo, onIncluir, onClose }: { codigo: string | null; onIncluir: (descricao: string, preco: number, qtd: number) => void; onClose: () => void }) {
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState(0);
  const [qtd, setQtd] = useState(1);
  const ok = preco > 0;
  return (
    <Sheet title="Produto sem cadastro" onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        <p className="rounded-2xl bg-secondary/50 p-3 text-sm">
          {codigo ? <>O código <b>{codigo}</b> não está no Omni.</> : "Venda um produto que não está cadastrado."} Digite o preço e venda normalmente. O dono resolve depois qual produto é.
        </p>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-muted-foreground">O que é? (opcional)</span>
          <input value={descricao} maxLength={60} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Sacola, pão de queijo"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
        </label>
        <CampoDinheiro rotulo="Preço de cada um" valor={preco} onMudar={setPreco} autoFocus />
        <div className="flex items-center justify-between">
          <span className="text-base font-medium">Quantidade</span>
          <div className="flex items-center rounded-2xl border border-border">
            <button type="button" aria-label="Menos" onClick={() => setQtd((q) => Math.max(1, q - 1))} className="flex h-12 w-12 items-center justify-center text-primary"><Minus size={18} /></button>
            <span className="min-w-8 text-center text-lg font-bold">{qtd}</span>
            <button type="button" aria-label="Mais" onClick={() => setQtd((q) => q + 1)} className="flex h-12 w-12 items-center justify-center text-primary"><Plus size={18} /></button>
          </div>
        </div>
      </div>
      <div className="px-5 pt-2">
        <button type="button" disabled={!ok} onClick={() => onIncluir(descricao.trim() || "Produto sem cadastro", preco, qtd)} className={btnPrimary(ok)}>
          Incluir {ok ? brl(preco * qtd) : ""}
        </button>
      </div>
    </Sheet>
  );
}

function Peso({ a, onIncluir, onClose }: { a: Achado; onIncluir: (qtd: number) => void; onClose: () => void }) {
  const [txt, setTxt] = useState("");
  const q = lerQuantidade(txt);
  const un = a.produto.unidade;
  const pergunta = un === "Kg" ? "Quanto pesou? (kg)" : `Quantos ${unPlural(un).toLowerCase()}?`;
  return (
    <Sheet title={a.produto.nome} onClose={onClose}>
      <form className="min-h-0 space-y-3 overflow-y-auto px-5 py-3" onSubmit={(e) => { e.preventDefault(); if (q) onIncluir(q); }}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Scale size={16} /> {brl(a.produto.preco)} por {unSingular(un).toLowerCase()}</p>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{pergunta}</span>
          <input autoFocus inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value.replace(/[^\d,]/g, ""))} placeholder={un === "Kg" ? "Ex.: 0,350" : "Ex.: 1,5"} aria-label={pergunta}
            className="h-16 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-center text-3xl font-bold tabular-nums text-foreground outline-none focus-visible:border-primary" />
        </label>
        {q != null && <p className="text-center text-base">Fica <b>{brl(subtotal({ qtd: q, preco: a.produto.preco }))}</b></p>}
        <button type="submit" disabled={q == null} className={btnPrimary(q != null)}>Incluir</button>
      </form>
    </Sheet>
  );
}

function Receber({ total, pags, cliente, chave, escopo, api, erro, onPags, onCliente, onVoltar, onFinalizar }: {
  total: number; pags: PagamentoCaixa[]; cliente: ClienteVenda | null; chave: string; escopo: string; api: ApiCaixa; erro: string;
  onPags: (p: PagamentoCaixa[]) => void; onCliente: (c: ClienteVenda | null) => void; onVoltar: () => void; onFinalizar: () => void;
}) {
  const [janela, setJanela] = useState<"dinheiro" | "fiado" | null>(null);
  const s = situacaoPagamento(total, pags);
  const temFiado = pags.some((p) => p.forma === "fiado");
  const incluir = (forma: FormaCaixa, valor: number) => { if (valor > 0) onPags([...pags, { forma, valor }]); };
  const tirar = (k: number) => { const p = pags[k]; onPags(pags.filter((_, i) => i !== k)); if (p?.forma === "fiado") onCliente(null); };
  const FORMAS: { f: FormaCaixa; icone: React.ReactNode; ajuda: string }[] = [
    { f: "dinheiro", icone: <Banknote size={30} />, ajuda: "Calcula o troco" },
    { f: "pix", icone: <QrCode size={30} />, ajuda: "Confira o Pix recebido" },
    { f: "cartao", icone: <CreditCard size={30} />, ajuda: "Na maquininha" },
    { f: "fiado", icone: <BookUser size={30} />, ajuda: "Anota na conta do cliente" },
  ];
  return (
    <Tela>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3">
        <button type="button" onClick={onVoltar} className="flex min-h-12 w-fit items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Voltar para a venda</button>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Total da venda</p>
          <p className="text-5xl font-bold tabular-nums">{brl(total)}</p>
        </div>
        {pags.length > 0 && (
          <ul aria-label="Pagamentos" className="space-y-2">
            {pags.map((p, k) => (
              <li key={k} className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/50 px-3 py-2">
                <span className="flex-1 text-base font-semibold">{FORMA_TXT[p.forma]}{p.forma === "fiado" && cliente ? ` · ${cliente.nome}` : ""}</span>
                <span className="text-base font-bold tabular-nums">{brl(p.valor)}</span>
                <button type="button" aria-label={`Tirar ${FORMA_TXT[p.forma]}`} onClick={() => tirar(k)} className="flex h-10 w-10 items-center justify-center text-muted-foreground"><X size={18} /></button>
              </li>
            ))}
          </ul>
        )}
        {s.falta > 0 ? (
          <p className="rounded-2xl bg-warning/10 p-3 text-center text-lg font-bold text-warning">{pags.length ? "Ainda falta" : "A receber"} {brl(s.falta)}</p>
        ) : s.troco > 0 ? (
          <p className="rounded-2xl bg-accent/15 p-3 text-center text-accent"><span className="block text-sm font-semibold">Troco</span><span className="block text-4xl font-bold tabular-nums">{brl(s.troco)}</span></p>
        ) : (
          <p className="rounded-2xl bg-accent/15 p-3 text-center text-lg font-bold text-accent">Pago</p>
        )}
        {s.falta > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {FORMAS.map(({ f, icone, ajuda }) => {
              const pode = f !== "fiado" || !temFiado;
              return (
                <button key={f} type="button" disabled={!pode}
                  onClick={() => (f === "dinheiro" ? setJanela("dinheiro") : f === "fiado" ? setJanela("fiado") : incluir(f, s.falta))}
                  className={`flex min-h-[112px] flex-col items-start justify-between rounded-3xl border-2 p-4 text-left transition active:scale-[0.98] ${pode ? "border-border bg-secondary/60" : "border-border opacity-40"}`}>
                  <span className="text-primary">{icone}</span>
                  <span><span className="block text-xl font-bold">{FORMA_TXT[f]}</span><span className="block text-xs text-muted-foreground">{ajuda}</span></span>
                </button>
              );
            })}
          </div>
        )}
        {erro && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro}</p>}
      </div>
      <div className="px-4 pt-3">
        <button type="button" disabled={!s.pronto} onClick={onFinalizar} className={`flex items-center justify-center gap-2 ${btnPrimary(s.pronto)}`}>
          <CheckCircle2 size={22} /> Finalizar venda
        </button>
      </div>
      {janela === "dinheiro" && <Dinheiro falta={s.falta} onClose={() => setJanela(null)} onConfirmar={(v) => { setJanela(null); incluir("dinheiro", v); }} />}
      {janela === "fiado" && (
        <Fiado chave={chave} escopo={escopo} api={api} valor={s.falta} onClose={() => setJanela(null)}
          onEscolher={(c) => { setJanela(null); onCliente(c); incluir("fiado", s.falta); }} />
      )}
    </Tela>
  );
}

function Dinheiro({ falta, onConfirmar, onClose }: { falta: number; onConfirmar: (v: number) => void; onClose: () => void }) {
  const [valor, setValor] = useState(0);
  return (
    <Sheet title="Dinheiro" onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        <CampoDinheiro rotulo="Quanto o cliente deu?" valor={valor} onMudar={setValor} grande autoFocus />
        <div className="grid grid-cols-2 gap-2">
          {atalhosDinheiro(falta).map((v, k) => (
            <button key={v} type="button" onClick={() => setValor(v)} aria-pressed={valor === v}
              className={`min-h-12 rounded-2xl border text-base font-semibold ${valor === v ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{k === 0 ? `Exato ${brl(v)}` : brl(v)}</button>
          ))}
        </div>
        {valor > 0 && (valor >= falta
          ? <p className="text-center text-lg">Troco: <b className="text-accent">{brl(valor - falta)}</b></p>
          : <p className="text-center text-sm text-muted-foreground">Ainda vai faltar {brl(falta - valor)} (pode completar com Pix ou cartão).</p>)}
      </div>
      <div className="px-5 pt-2"><button type="button" disabled={valor <= 0} onClick={() => onConfirmar(valor)} className={btnPrimary(valor > 0)}>Confirmar</button></div>
    </Sheet>
  );
}

function Fiado({ chave, escopo, api, valor, onEscolher, onClose }: { chave: string; escopo: string; api: ApiCaixa; valor: number; onEscolher: (c: ClienteVenda) => void; onClose: () => void }) {
  const [lista, setLista] = useState<banco.ClienteFiado[] | null>(null);
  const [erro, setErro] = useState("");
  const [q, setQ] = useState("");
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  // Sem internet, usa a última lista guardada no celular.
  useEffect(() => {
    api.clientes(chave).then((l) => { setLista(l); gravarCache(escopo, { clientes: l }); },
      (e) => { const c = lerCache(escopo)?.clientes; if (c) setLista(c); else { setErro(erroCaixa(e)); setLista([]); } });
  }, [api, chave, escopo]);
  const achados = (lista ?? []).filter((c) => c.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()));
  const telOk = !tel || /^\d{10,11}$/.test(digits(tel));
  const novoOk = nome.trim().length >= 2 && telOk;
  return (
    <Sheet title={`Fiado · ${brl(valor)}`} onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        {!novo ? (
          <>
            <button type="button" onClick={() => setNovo(true)} className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}><UserPlus size={18} /> Cliente novo</button>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar o cliente pelo nome" aria-label="Procurar cliente"
              className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            {lista === null && <p className="text-center text-sm text-muted-foreground">Carregando os clientes…</p>}
            {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
            {lista && !lista.length && !erro && <p className="text-center text-sm text-muted-foreground">Nenhum cliente no fiado ainda. Toque em "Cliente novo".</p>}
            <ul className="space-y-1.5">
              {achados.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onEscolher({ id: c.id, nome: c.nome, telefone: c.telefone, novo: false })}
                    className="flex min-h-13 w-full items-center justify-between rounded-2xl border border-border px-4 text-left">
                    <span><span className="block text-base font-semibold">{c.nome}</span>{c.telefone && <span className="block text-xs text-muted-foreground">{maskPhone(c.telefone)}</span>}</span>
                    <Check size={18} className="text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Nome do cliente</span>
              <input autoFocus value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: João da Silva"
                className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Telefone (opcional)</span>
              <input inputMode="tel" value={tel} onChange={(e) => setTel(maskPhone(e.target.value))} placeholder="(43) 99999-9999"
                className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
              {!telOk && <span className="block text-xs font-semibold text-destructive">Use DDD + número.</span>}
            </label>
            <button type="button" disabled={!novoOk} onClick={() => onEscolher({ id: newUid(), nome: nome.trim(), telefone: digits(tel) || null, novo: true })} className={btnPrimary(novoOk)}>Anotar no fiado</button>
            <button type="button" onClick={() => setNovo(false)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar à lista</button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function VendaFeita({ f, onProxima }: { f: Feito; onProxima: () => void }) {
  const [comprovante, setComprovante] = useState(false);
  return (
    <Tela>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/20 text-accent animate-in zoom-in duration-300"><CheckCircle2 size={56} /></span>
        <div>
          <p className="text-2xl font-bold">Venda finalizada</p>
          <p className="text-sm text-muted-foreground">{f.numero ? `Venda nº ${f.numero} · ` : ""}{f.formas}</p>
        </div>
        {f.guardada && !f.numero && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-3 py-2 text-sm text-muted-foreground"><CloudOff size={16} className="shrink-0" /> Guardada no celular. Vai para o Omni assim que a internet responder.</p>
        )}
        <p className="text-4xl font-bold tabular-nums">{brl(f.total)}</p>
        {f.troco > 0 && (
          <div className="w-full rounded-3xl bg-accent/15 p-4 text-accent">
            <p className="text-sm font-semibold">Troco</p>
            <p className="text-5xl font-bold tabular-nums">{brl(f.troco)}</p>
          </div>
        )}
      </div>
      <div className="px-4">
        <button type="button" onClick={() => setComprovante(true)} className={`mb-2 flex w-full items-center justify-center gap-2 ${btnGhost}`}><MessageCircle size={18} /> Mandar comprovante no WhatsApp</button>
        <button type="button" autoFocus onClick={onProxima} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><ShoppingCart size={20} /> Próxima venda</button>
      </div>
      {comprovante && <Comprovante dados={f.comprovante} telefone={f.telefone} onClose={() => setComprovante(false)} />}
    </Tela>
  );
}

/** Vendas guardadas no celular (sem internet) e as que deram problema. */
function AvisoGuardadas({ guardadas, erroFila, onEnviar }: { guardadas: VendaGuardada[]; erroFila: string; onEnviar: () => void }) {
  const esperando = guardadas.filter((g) => !g.problema);
  const problemas = guardadas.filter((g) => g.problema);
  if (!esperando.length && !problemas.length) return null;
  return (
    <div className="space-y-2">
      {esperando.length > 0 && (
        <div role="status" className="flex items-center gap-2 rounded-2xl border border-warning/50 bg-warning/10 p-2.5 text-sm">
          <CloudOff size={18} className="shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            <b>{esperando.length === 1 ? "1 venda guardada" : `${esperando.length} vendas guardadas`}</b> no celular ({brl(esperando.reduce((t, g) => t + g.total, 0))}). Vão sozinhas quando a internet voltar.
            {erroFila && <span className="block font-semibold text-destructive">{erroFila}</span>}
          </span>
          <button type="button" onClick={onEnviar} className="shrink-0 rounded-xl border border-warning/60 px-3 py-2 text-xs font-semibold text-warning">Enviar agora</button>
        </div>
      )}
      {problemas.length > 0 && (
        <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-2.5 text-sm">
          <b className="text-destructive">{problemas.length === 1 ? "1 venda não foi aceita" : `${problemas.length} vendas não foram aceitas`}.</b> Mostre ao dono no menu → Vendas deste caixa.
        </p>
      )}
    </div>
  );
}

function MenuCaixa({ estado, guardadas, onClose, onVendas, onSangria, onFechar, onInicio, onInstalar }: {
  estado: banco.EstadoCaixa; guardadas: number; onClose: () => void; onVendas: () => void; onSangria: () => void; onFechar: () => void; onInicio: () => void;
  onInstalar?: (() => void) | undefined;
}) {
  const t = estado.turno;
  const item = "flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-secondary/50 px-4 text-left";
  return (
    <Sheet title="Caixa" onClose={onClose}>
      <div className="min-h-0 space-y-2 overflow-y-auto px-5 py-3">
        {t && (
          <div className="rounded-2xl bg-secondary/40 p-3 text-sm">
            <p className="font-semibold">Aberto às {new Date(t.abertoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {estado.nome.split(" ")[0]}</p>
            <p className="text-muted-foreground">{t.vendas === 1 ? "1 venda" : `${t.vendas} vendas`} · {brl(t.total)}{guardadas ? ` · ${guardadas} guardada${guardadas > 1 ? "s" : ""} no celular` : ""}</p>
          </div>
        )}
        <button type="button" onClick={onVendas} className={item}><Receipt size={20} className="text-primary" /><span className="flex-1"><b className="block text-base">Vendas deste caixa</b><span className="text-xs text-muted-foreground">Ver e cancelar (com o PIN do dono)</span></span></button>
        <button type="button" onClick={onSangria} className={item}><HandCoins size={20} className="text-primary" /><span className="flex-1"><b className="block text-base">Tirar dinheiro da gaveta</b><span className="text-xs text-muted-foreground">Sangria, com o PIN do dono</span></span></button>
        <button type="button" onClick={onFechar} className={item}><Lock size={20} className="text-primary" /><span className="flex-1"><b className="block text-base">Fechar o caixa</b><span className="text-xs text-muted-foreground">Contar o dinheiro e encerrar o dia</span></span></button>
        {onInstalar && (
          <button type="button" onClick={onInstalar} className={item}><Smartphone size={20} className="text-primary" /><span className="flex-1"><b className="block text-base">Ícone "Omni Caixa" no celular</b><span className="text-xs text-muted-foreground">Abre direto no caixa, como um app</span></span></button>
        )}
        <button type="button" onClick={onInicio} className={item}><Home size={20} className="text-muted-foreground" /><span className="flex-1"><b className="block text-base">Voltar ao início</b><span className="text-xs text-muted-foreground">O caixa continua aberto</span></span></button>
      </div>
    </Sheet>
  );
}

/** PIN do dono, digitado no celular do funcionário (não aparece na tela). */
function CampoPinDono({ valor, onMudar }: { valor: string; onMudar: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">PIN do dono</span>
      <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={valor} aria-label="PIN do dono" placeholder="••••"
        onChange={(e) => onMudar(digits(e.target.value).slice(0, 4))}
        className="h-14 w-full rounded-2xl border border-border bg-background-deep/60 text-center text-2xl font-bold tracking-[0.6em] text-foreground outline-none focus-visible:border-primary" />
      <span className="block text-xs text-muted-foreground">Peça para o dono digitar. É a senha de 4 números que ele criou no app dele.</span>
    </label>
  );
}

const horaTxt = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function VendasDoCaixa({ estado, guardadas, chave, api, offline, onClose, onMudou }: {
  estado: banco.EstadoCaixa; guardadas: VendaGuardada[]; chave: string; api: ApiCaixa; offline: boolean; onClose: () => void; onMudou: () => void;
}) {
  const [aberta, setAberta] = useState<banco.VendaDoCaixa | null>(null);
  const [cancelar, setCancelar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pin, setPin] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState("");
  const [comprovante, setComprovante] = useState(false);
  const fazerCancelar = () => {
    if (!aberta || pin.length !== 4 || ocupado) return;
    setOcupado(true); setErro("");
    (api.cancelar ?? banco.caixaCancelarVenda)(chave, aberta.id, pin, motivo.trim()).then(() => {
      setPronto(`Venda ${aberta.numero ? `nº ${aberta.numero} ` : ""}cancelada. Os produtos voltaram para a gôndola.`);
      setAberta(null); setCancelar(false); setPin(""); setMotivo(""); onMudou();
    }, (e) => { setErro(erroPinDono(e)); setPin(""); }).finally(() => setOcupado(false));
  };
  if (aberta) return (
    <Sheet title={`Venda ${aberta.numero ? `nº ${aberta.numero}` : ""} · ${horaTxt(aberta.feitaEm)}`} onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        <p className={`text-3xl font-bold tabular-nums ${aberta.situacao === "cancelada" ? "line-through opacity-60" : ""}`}>{brl(aberta.total)}</p>
        {aberta.situacao === "cancelada" && <p className="rounded-2xl border border-border p-2 text-sm">Cancelada. Os produtos voltaram para a gôndola.</p>}
        <p className="text-sm text-muted-foreground">{aberta.pagamentos.map((p) => `${FORMA_TXT[p.forma as FormaCaixa] ?? p.forma} ${brl(p.valor)}`).join(" · ")}{aberta.troco ? ` · troco ${brl(aberta.troco)}` : ""}{aberta.cliente ? ` · ${aberta.cliente}` : ""}</p>
        <ul className="divide-y divide-border rounded-2xl border border-border px-3">
          {aberta.itens.map((i, k) => (
            <li key={k} className="flex justify-between gap-2 py-2 text-sm"><span className="min-w-0">{qtdTexto(i.qtd)} × {i.descricao}</span><b className="shrink-0">{brl(i.valor)}</b></li>
          ))}
        </ul>
        {aberta.situacao === "finalizada" && !cancelar && (
          <button type="button" onClick={() => setComprovante(true)} className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}><MessageCircle size={18} /> Mandar comprovante no WhatsApp</button>
        )}
        {comprovante && (
          <Comprovante telefone={null} onClose={() => setComprovante(false)}
            dados={{ comercio: { nome: estado.comercio.nome, endereco: estado.comercio.endereco }, numero: aberta.numero, feitaEm: aberta.feitaEm,
              itens: aberta.itens, total: aberta.total, pagamentos: aberta.pagamentos, troco: aberta.troco, cliente: aberta.cliente }} />
        )}
        {aberta.situacao === "finalizada" && (!cancelar ? (
          <button type="button" onClick={() => { setCancelar(true); setErro(""); }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-destructive/50 px-4 text-base font-semibold text-destructive">
            <X size={18} /> Cancelar esta venda
          </button>
        ) : (
          <div className="space-y-3 rounded-2xl border border-destructive/50 bg-destructive/5 p-3">
            <p className="text-sm">Os produtos voltam para a gôndola{aberta.cliente ? " e o valor sai da conta do fiado" : ""}. {offline ? <b>Precisa de internet.</b> : ""}</p>
            <input value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (ex.: cliente desistiu)" aria-label="Motivo do cancelamento"
              className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            <CampoPinDono valor={pin} onMudar={setPin} />
            {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
            <button type="button" disabled={pin.length !== 4 || ocupado} onClick={fazerCancelar}
              className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-destructive px-4 text-base font-semibold text-white disabled:opacity-40">{ocupado ? "Cancelando…" : "Confirmar cancelamento"}</button>
            <button type="button" onClick={() => { setCancelar(false); setPin(""); setErro(""); }} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
          </div>
        ))}
        <button type="button" onClick={() => { setAberta(null); setCancelar(false); setPin(""); setErro(""); }} className={`w-full ${btnGhost}`}>Todas as vendas</button>
      </div>
    </Sheet>
  );
  return (
    <Sheet title="Vendas deste caixa" onClose={onClose}>
      <div className="min-h-0 space-y-2 overflow-y-auto px-5 py-3">
        {pronto && <p role="status" className="rounded-2xl bg-accent/10 p-3 text-sm font-semibold text-accent">{pronto}</p>}
        {guardadas.map((g) => (
          <div key={g.venda.id} className={`rounded-2xl border p-3 text-sm ${g.problema ? "border-destructive/50 bg-destructive/5" : "border-warning/50 bg-warning/5"}`}>
            <p className="flex justify-between"><b>{horaTxt(g.venda.feita_em)} · {g.formas}</b><b>{brl(g.total)}</b></p>
            <p className={g.problema ? "font-semibold text-destructive" : "text-warning"}>{g.problema ? `Não foi aceita: ${g.problema}` : "Guardada no celular · esperando a internet"}</p>
          </div>
        ))}
        {!estado.vendas.length && !guardadas.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma venda neste caixa ainda.</p>}
        <ul className="space-y-2">
          {estado.vendas.map((v) => (
            <li key={v.id}>
              <button type="button" onClick={() => { setAberta(v); setPronto(""); }}
                className={`flex w-full items-center gap-3 rounded-2xl border border-border bg-secondary/50 p-3 text-left ${v.situacao === "cancelada" ? "opacity-60" : ""}`}>
                <span className="w-12 shrink-0 text-sm font-bold">{horaTxt(v.feitaEm)}</span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-semibold">{v.numero ? `Venda nº ${v.numero}` : "Venda"}{v.cliente ? ` · ${v.cliente}` : ""}</span>
                  <span className="block text-xs text-muted-foreground">{v.situacao === "cancelada" ? "Cancelada" : v.pagamentos.map((p) => FORMA_TXT[p.forma as FormaCaixa] ?? p.forma).join(" + ")}</span>
                </span>
                <span className={`shrink-0 text-sm font-bold ${v.situacao === "cancelada" ? "line-through" : ""}`}>{brl(v.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

function Sangria({ turno, chave, api, onFeito, onClose }: { turno: banco.TurnoCaixa; chave: string; api: ApiCaixa; onFeito: (t: banco.TurnoCaixa) => void; onClose: () => void }) {
  const [id] = useState(newUid);
  const [valor, setValor] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [pin, setPin] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const ok = valor > 0 && pin.length === 4 && !ocupado;
  const tirar = () => {
    if (!ok) return;
    setOcupado(true); setErro("");
    (api.sangria ?? banco.caixaSangria)(chave, id, turno.id, valor, motivo.trim(), pin).then(onFeito, (e) => { setErro(erroPinDono(e)); setPin(""); setOcupado(false); });
  };
  return (
    <Sheet title="Tirar dinheiro da gaveta" onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        <p className="text-sm text-muted-foreground">Fica anotado no caixa e entra na conta do fechamento.</p>
        <CampoDinheiro rotulo="Quanto vai tirar?" valor={valor} onMudar={setValor} autoFocus />
        <input value={motivo} maxLength={120} onChange={(e) => setMotivo(e.target.value)} placeholder="Para quê? (ex.: depósito no banco, pagar o gás)" aria-label="Motivo da retirada"
          className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
        <CampoPinDono valor={pin} onMudar={setPin} />
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
      </div>
      <div className="px-5 pt-2"><button type="button" disabled={!ok} onClick={tirar} className={btnPrimary(ok)}>{ocupado ? "Anotando…" : `Tirar ${valor ? brl(valor) : ""}`}</button></div>
    </Sheet>
  );
}

/** Fechar o caixa: o funcionário conta a gaveta SEM ver quanto deveria ter; depois o app mostra a conta. */
function FecharCaixa({ turno, guardadas, chave, api, onEnviar, onVoltar, onFechado }: {
  turno: banco.TurnoCaixa; guardadas: number; chave: string; api: ApiCaixa; onEnviar: () => Promise<void>; onVoltar: () => void; onFechado: () => void;
}) {
  const [contado, setContado] = useState(0);
  const [obs, setObs] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [fim, setFim] = useState<banco.TurnoCaixa | null>(null);
  const fechar = () => {
    setOcupado(true); setErro("");
    (api.fechar ?? banco.caixaFechar)(chave, turno.id, contado, obs.trim()).then(setFim, (e) => { setErro(erroPinDono(e)); setOcupado(false); });
  };
  if (fim) {
    const d = textoDiferencaCaixa(fim.diferenca ?? 0);
    const linha = (a: string, b: string, forte = false) => <p className={`flex justify-between py-1.5 ${forte ? "font-bold" : ""}`}><span>{a}</span><span className="tabular-nums">{b}</span></p>;
    return (
      <Tela>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-5">
          <div className="text-center">
            <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${d.nivel === "ok" ? "bg-accent/20 text-accent" : d.nivel === "falta" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>
              {d.nivel === "ok" ? <CheckCircle2 size={36} /> : <TriangleAlert size={34} />}
            </span>
            <p className="mt-2 text-2xl font-bold">Caixa fechado</p>
            <p className={`text-xl font-bold ${d.nivel === "ok" ? "text-accent" : d.nivel === "falta" ? "text-destructive" : "text-warning"}`}>{d.texto}</p>
            {d.nivel !== "ok" && <p className="text-sm text-muted-foreground">O dono vai ver esta diferença no app dele.</p>}
          </div>
          <div className="divide-y divide-border rounded-3xl border border-border px-4 py-2 text-sm">
            {linha(`Vendas (${fim.vendas})`, brl(fim.total), true)}
            {linha("Dinheiro", brl(fim.porForma.dinheiro))}{linha("Pix", brl(fim.porForma.pix))}{linha("Cartão", brl(fim.porForma.cartao))}{linha("Fiado", brl(fim.porForma.fiado))}
          </div>
          <div className="divide-y divide-border rounded-3xl border border-border px-4 py-2 text-sm">
            {linha("Troco no começo", brl(fim.trocoInicial))}
            {linha("+ Dinheiro recebido", brl(fim.porForma.dinheiro))}
            {linha("− Troco dado", brl(fim.trocoDado))}
            {linha("− Tirado da gaveta", brl(fim.sangrias))}
            {linha("Deveria ter na gaveta", brl(fim.dinheiroEsperado), true)}
            {linha("Você contou", brl(fim.dinheiroContado ?? 0), true)}
          </div>
        </div>
        <div className="px-4 pt-3"><button type="button" onClick={onFechado} className={btnPrimary(true)}>Concluir</button></div>
      </Tela>
    );
  }
  return (
    <Tela>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3">
        <button type="button" onClick={onVoltar} className="flex min-h-12 w-fit items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Voltar para o caixa</button>
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15 text-primary"><Lock size={30} /></span>
          <h1 className="mt-2 text-2xl font-bold">Fechar o caixa</h1>
          <p className="text-sm text-muted-foreground">Conte todo o dinheiro da gaveta (notas e moedas) e digite o total.</p>
        </div>
        {guardadas > 0 ? (
          <div role="alert" className="space-y-2 rounded-2xl border border-warning/60 bg-warning/10 p-3 text-sm">
            <p><b>{guardadas === 1 ? "1 venda ainda está guardada" : `${guardadas} vendas ainda estão guardadas`}</b> no celular. Para fechar, elas precisam chegar ao Omni (precisa de internet).</p>
            <button type="button" onClick={() => void onEnviar()} className={btnPrimary(true)}>Enviar agora</button>
          </div>
        ) : (
          <>
            <CampoDinheiro rotulo="Quanto tem na gaveta?" valor={contado} onMudar={setContado} grande autoFocus />
            <input value={obs} maxLength={300} onChange={(e) => setObs(e.target.value)} placeholder="Recado para o dono (opcional)" aria-label="Recado para o dono"
              className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            {confirmar && <p className="rounded-2xl bg-secondary/60 p-3 text-sm">Depois de fechar, só dá para vender abrindo o caixa de novo. Confirma <b>{brl(contado)}</b> na gaveta?</p>}
            {erro && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro}</p>}
          </>
        )}
      </div>
      {guardadas === 0 && (
        <div className="px-4 pt-3">
          <button type="button" disabled={ocupado} onClick={() => (confirmar ? fechar() : setConfirmar(true))} className={`flex items-center justify-center gap-2 ${btnPrimary(!ocupado)}`}>
            <Lock size={20} /> {ocupado ? "Fechando…" : confirmar ? "Sim, fechar o caixa" : "Fechar o caixa"}
          </button>
        </div>
      )}
    </Tela>
  );
}

/** Comprovante simples pelo WhatsApp do cliente (não é nota fiscal). Sem número: o WhatsApp pede para escolher o contato. */
function Comprovante({ dados, telefone, onClose }: { dados: DadosComprovante; telefone: string | null; onClose: () => void }) {
  const [tel, setTel] = useState(telefone ? maskPhone(telefone) : "");
  const texto = textoComprovante(dados);
  const telOk = !tel || /^\d{10,11}$/.test(digits(tel));
  return (
    <Sheet title="Comprovante no WhatsApp" onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">WhatsApp do cliente (opcional)</span>
          <input inputMode="tel" value={tel} onChange={(e) => setTel(maskPhone(e.target.value))} placeholder="(43) 99999-9999" aria-label="WhatsApp do cliente"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
          <span className="block text-xs text-muted-foreground">{telOk ? "Sem número, o WhatsApp abre para você escolher o contato." : "Use DDD + número."}</span>
        </label>
        <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-secondary/50 p-3 font-sans text-xs leading-relaxed">{texto}</pre>
      </div>
      <div className="px-5 pt-2">
        {telOk ? (
          <a href={linkWhatsApp(digits(tel), texto)} target="_blank" rel="noopener noreferrer" onClick={onClose} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><MessageCircle size={20} /> Abrir o WhatsApp</a>
        ) : (
          <button type="button" disabled className={btnPrimary(false)}>Abrir o WhatsApp</button>
        )}
      </div>
    </Sheet>
  );
}
