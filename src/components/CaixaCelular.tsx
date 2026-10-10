/* Caixa no celular (C2), dentro do app da equipe "Omni Operação". Tela cheia, como um app do próprio celular:
 * abrir o caixa (troco da gaveta) → bipar (câmera sempre lendo, ou leitor de código ligado ao celular) → receber
 * (dinheiro com troco, Pix, cartão ou fiado) → "Venda finalizada". Só aqui o produto sai da gôndola. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Banknote, BookUser, Camera, CameraOff, Check, CheckCircle2, CreditCard, Minus, PackagePlus, Plus, QrCode, Scale, Search, ShoppingCart,
  Trash2, TriangleAlert, UserPlus, X,
} from "lucide-react";
import { LeitorContinuo } from "@/components/LeitorContinuo";
import { Sheet } from "@/components/parts/Sheet";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import {
  FORMA_TXT, acharPorCodigo, adicionar, atalhosDinheiro, bip, brl, buscarProdutos, centavosDigitados, contarItens, erroCaixa, itemDoProduto, lerQuantidade,
  mascaraDinheiro, montarVenda, qtdTexto, situacaoPagamento, subtotal, totalCarrinho,
  type Achado, type FormaCaixa, type ItemCarrinho, type PagamentoCaixa, type ProdutoCaixa,
} from "@/lib/caixa";
import { newUid, unPlural, unSingular } from "@/lib/deposito";
import { digits, maskPhone } from "@/lib/formatacao";
import { escopoAcesso, operacaoLocal } from "@/lib/operacaoLocal";
import { ehIncerto } from "@/lib/persistencia";

export type ApiCaixa = {
  estado: typeof banco.caixaEstado;
  produtos: typeof banco.caixaProdutos;
  clientes: typeof banco.caixaClientesFiado;
  abrir: typeof banco.caixaAbrir;
  registrar: typeof banco.caixaRegistrarVenda;
};
const API_PADRAO: ApiCaixa = { estado: banco.caixaEstado, produtos: banco.caixaProdutos, clientes: banco.caixaClientesFiado, abrir: banco.caixaAbrir, registrar: banco.caixaRegistrarVenda };

type ClienteVenda = { id: string; nome: string; telefone: string | null; novo: boolean };
type VendaEnviada = { venda: ReturnType<typeof montarVenda>; total: number; troco: number; formas: string };
const vendaValida = (p: unknown): p is VendaEnviada => {
  const x = p as VendaEnviada | null;
  return !!x && !!x.venda && typeof x.venda.id === "string" && Array.isArray(x.venda.itens) && x.venda.itens.length > 0
    && Array.isArray(x.venda.pagamentos) && Number.isFinite(x.total) && Number.isFinite(x.troco);
};
type Rascunho = { carrinho: ItemCarrinho[]; pags: PagamentoCaixa[]; cliente: ClienteVenda | null };
const chaveRascunho = (escopo: string) => `omni.caixa.rascunho.v1:${escopo}`;
function lerRascunho(escopo: string): Rascunho | null {
  try { const r = JSON.parse(localStorage.getItem(chaveRascunho(escopo)) ?? "null"); return r && Array.isArray(r.carrinho) && Array.isArray(r.pags) ? r : null; } catch { return null; }
}
function guardarRascunho(escopo: string, r: Rascunho) {
  try { if (!r.carrinho.length && !r.pags.length) localStorage.removeItem(chaveRascunho(escopo)); else localStorage.setItem(chaveRascunho(escopo), JSON.stringify(r)); } catch { /* sem armazenamento */ }
}

type Fase = "carregando" | "erro" | "abrir" | "vender" | "receber" | "feito";
type Aviso = { ok: boolean; texto: string } | null;

export function CaixaCelular({ chave, mercado = false, onSair, api: apiDada }: { chave: string; mercado?: boolean; onSair: () => void; api?: ApiCaixa | undefined }) {
  const api = apiDada ?? API_PADRAO;
  const [fase, setFase] = useState<Fase>("carregando");
  const [erroCarga, setErroCarga] = useState("");
  const [estado, setEstado] = useState<banco.EstadoCaixa | null>(null);
  const [produtos, setProdutos] = useState<ProdutoCaixa[]>([]);
  const [escopo, setEscopo] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [pags, setPags] = useState<PagamentoCaixa[]>([]);
  const [cliente, setCliente] = useState<ClienteVenda | null>(null);
  const [feito, setFeito] = useState<{ total: number; troco: number; numero: number | null; formas: string } | null>(null);
  const [pendente, setPendente] = useState<VendaEnviada | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const registro = useRef<ReturnType<typeof operacaoLocal<VendaEnviada>> | null>(null);

  const carregar = useCallback(async () => {
    setFase("carregando"); setErroCarga("");
    try {
      const [esc, est, prods] = await Promise.all([escopoAcesso(chave), api.estado(chave), api.produtos(chave)]);
      registro.current = operacaoLocal(esc, "caixa-venda", vendaValida);
      setPendente(registro.current.pendente());
      const r = lerRascunho(esc);
      if (r) { setCarrinho(r.carrinho); setPags(r.pags); setCliente(r.cliente); }
      setEscopo(esc); setEstado(est); setProdutos(prods);
      setFase(est.turno ? "vender" : "abrir");
    } catch (e) { setErroCarga(erroCaixa(e)); setFase("erro"); }
  }, [api, chave]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (escopo) guardarRascunho(escopo, { carrinho, pags, cliente }); }, [escopo, carrinho, pags, cliente]);
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

  const atualizarEstado = () => { void api.estado(chave).then(setEstado).catch(() => {}); };
  const total = totalCarrinho(carrinho);

  const finalizar = async () => {
    if (!registro.current || !estado?.turno || enviando) return;
    const s = situacaoPagamento(total, pags);
    if (!pendente && !s.pronto) return;
    setEnviando(true); setErroEnvio("");
    try {
      const turnoId = estado.turno.id;
      const r = await registro.current.enviar(() => ({
        venda: montarVenda(newUid(), turnoId, carrinho, pags, cliente ? (cliente.novo ? { id: cliente.id, nome: cliente.nome, ...(cliente.telefone ? { telefone: cliente.telefone } : {}) } : { id: cliente.id }) : null),
        total, troco: s.troco, formas: pags.map((p) => FORMA_TXT[p.forma]).join(" + "),
      }), (p) => api.registrar(chave, p.venda));
      setFeito({ total: r.pedido.total, troco: r.pedido.troco, numero: r.resultado.numero, formas: r.pedido.formas });
      if (!r.recuperado) { setCarrinho([]); setPags([]); setCliente(null); }
      setPendente(null); setFase("feito"); bip();
      atualizarEstado();
    } catch (e) {
      setErroEnvio(erroCaixa(e));
      setPendente(registro.current.pendente());
      if (!ehIncerto(e)) setFase("receber");
    } finally { setEnviando(false); }
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
    onAberto={(t) => { setEstado({ ...estado, turno: t }); setFase("vender"); }} />;
  if (fase === "feito" && feito) return <VendaFeita f={feito} onProxima={() => { setFeito(null); setFase("vender"); }} />;
  if (fase === "receber") return (
    <Receber total={total} pags={pags} cliente={cliente} chave={chave} api={api} enviando={enviando} erro={erroEnvio}
      onPags={setPags} onCliente={setCliente} onVoltar={() => { setErroEnvio(""); setFase("vender"); }} onFinalizar={() => void finalizar()} />
  );
  return (
    <Vender estado={estado} produtos={produtos} mercado={mercado} carrinho={carrinho} onCarrinho={setCarrinho} onSair={onSair}
      pendente={pendente} enviando={enviando} erroEnvio={erroEnvio} onEnviarPendente={() => void finalizar()}
      onReceber={() => { setErroEnvio(""); setFase("receber"); }}
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
  | null;

function Vender({ estado, produtos, mercado, carrinho, onCarrinho, onSair, onReceber, onLimpar, pendente, enviando, erroEnvio, onEnviarPendente }: {
  estado: banco.EstadoCaixa; produtos: ProdutoCaixa[]; mercado: boolean; carrinho: ItemCarrinho[]; onCarrinho: (f: (c: ItemCarrinho[]) => ItemCarrinho[]) => void;
  onSair: () => void; onReceber: () => void; onLimpar: () => void; pendente: VendaEnviada | null; enviando: boolean; erroEnvio: string; onEnviarPendente: () => void;
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
          <p className="truncate text-xs text-muted-foreground">{estado.nome.split(" ")[0]} · {t ? `${t.vendas === 1 ? "1 venda" : `${t.vendas} vendas`} · ${brl(t.total)} hoje` : ""}</p>
        </div>
        <button type="button" onClick={() => setCamera((v) => !v)} aria-pressed={camera} aria-label={camera ? "Desligar a câmera" : "Ligar a câmera"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${camera ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
          {camera ? <Camera size={20} /> : <CameraOff size={20} />}
        </button>
      </header>

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
        {pendente && (
          <div role="alert" className="space-y-2 rounded-2xl border border-warning/60 bg-warning/10 p-3 text-sm">
            <p><b>Uma venda de {brl(pendente.total)} não foi confirmada.</b> Ela está guardada neste celular. Envie antes de começar outra (não conta duas vezes).</p>
            {erroEnvio && <p className="font-semibold text-destructive">{erroEnvio}</p>}
            <button type="button" disabled={enviando} onClick={onEnviarPendente} className={btnPrimary(!enviando)}>{enviando ? "Enviando…" : "Enviar a venda guardada"}</button>
          </div>
        )}
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
        <button type="button" disabled={!carrinho.length || !!pendente} onClick={onReceber} className={`flex items-center justify-center gap-2 ${btnPrimary(!!carrinho.length && !pendente)}`}>
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

function Receber({ total, pags, cliente, chave, api, enviando, erro, onPags, onCliente, onVoltar, onFinalizar }: {
  total: number; pags: PagamentoCaixa[]; cliente: ClienteVenda | null; chave: string; api: ApiCaixa; enviando: boolean; erro: string;
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
        <button type="button" disabled={!s.pronto || enviando} onClick={onFinalizar} className={`flex items-center justify-center gap-2 ${btnPrimary(s.pronto && !enviando)}`}>
          <CheckCircle2 size={22} /> {enviando ? "Finalizando…" : "Finalizar venda"}
        </button>
      </div>
      {janela === "dinheiro" && <Dinheiro falta={s.falta} onClose={() => setJanela(null)} onConfirmar={(v) => { setJanela(null); incluir("dinheiro", v); }} />}
      {janela === "fiado" && (
        <Fiado chave={chave} api={api} valor={s.falta} onClose={() => setJanela(null)}
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

function Fiado({ chave, api, valor, onEscolher, onClose }: { chave: string; api: ApiCaixa; valor: number; onEscolher: (c: ClienteVenda) => void; onClose: () => void }) {
  const [lista, setLista] = useState<banco.ClienteFiado[] | null>(null);
  const [erro, setErro] = useState("");
  const [q, setQ] = useState("");
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  useEffect(() => { api.clientes(chave).then(setLista, (e) => { setErro(erroCaixa(e)); setLista([]); }); }, [api, chave]);
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

function VendaFeita({ f, onProxima }: { f: { total: number; troco: number; numero: number | null; formas: string }; onProxima: () => void }) {
  return (
    <Tela>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/20 text-accent animate-in zoom-in duration-300"><CheckCircle2 size={56} /></span>
        <div>
          <p className="text-2xl font-bold">Venda finalizada</p>
          <p className="text-sm text-muted-foreground">{f.numero ? `Venda nº ${f.numero} · ` : ""}{f.formas}</p>
        </div>
        <p className="text-4xl font-bold tabular-nums">{brl(f.total)}</p>
        {f.troco > 0 && (
          <div className="w-full rounded-3xl bg-accent/15 p-4 text-accent">
            <p className="text-sm font-semibold">Troco</p>
            <p className="text-5xl font-bold tabular-nums">{brl(f.troco)}</p>
          </div>
        )}
      </div>
      <div className="px-4">
        <button type="button" autoFocus onClick={onProxima} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><ShoppingCart size={20} /> Próxima venda</button>
      </div>
    </Tela>
  );
}
