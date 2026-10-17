/* Caixa no celular (C2 e C3), dentro do app da equipe "Omni Operação". Tela cheia, como um app do próprio celular:
 * abrir o caixa (troco da gaveta) → bipar (câmera sempre lendo, ou leitor de código ligado ao celular) → receber
 * (dinheiro com troco, Pix, cartão ou fiado) → "Venda finalizada". Só aqui o produto sai da gôndola.
 * Menu do caixa (C3): vendas deste caixa (cancelar com o PIN do dono), tirar dinheiro da gaveta (PIN do dono) e fechar o caixa.
 * Sem internet: preserva o carrinho; novas vendas só concluem após confirmação do estoque e do banco. */
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
  FORMA_TXT, lerReais, acharPorCodigo, adicionar, atalhosDinheiro, bip, brl, buscarProdutos, centavosDigitados, contarItens, enviarFila, erroCaixa, erroPinDono, filaCaixa,
  itemDoProduto, limiteCarrinho, lerQuantidade, linkWhatsApp, mascaraDinheiro, montarVenda, notaNaoAceitas, qtdTexto, semInternet, situacaoPagamento, subtotal, textoComprovante, textoDiferencaCaixa, totalCarrinho,
  type DadosComprovante,
  vendaGuardadaValida, type Achado, type FormaCaixa, type ItemCarrinho, type PagamentoCaixa, type ProdutoCaixa, type VendaGuardada,
  devolverDe, textoDevolver, textoCanceladaPeloDono, jaDevolvido, marcarDevolvido,
  acharForaEstoque, buscarForaEstoque, itemForaEstoque, type ForaEstoque,
  lerFiadoPendente, guardarFiadoPendente, type FiadoPendente,
} from "@/lib/caixa";
import { newUid, unPlural, unSingular } from "@/lib/deposito";
import { digits, maskPhone } from "@/lib/formatacao";
import { escopoAcesso } from "@/lib/operacaoLocal";
import { DIAS_ANTIGO, haQuantoTempo, textoMovimento , bloqueioFiado, mensagemFiadoCompleta } from "@/lib/fiado";
import { CompartilharFiado } from "@/components/CompartilharFiado";
import { ehIncerto } from "@/lib/persistencia";
import { linkClienteCaixa } from "@/lib/fiadoCliente";

export type ApiCaixa = {
  estado: typeof banco.caixaEstado;
  produtos: typeof banco.caixaProdutos;
  clientes: typeof banco.caixaClientesFiado;
  abrir: typeof banco.caixaAbrir;
  registrar: typeof banco.caixaRegistrarVenda;
  conferir?: typeof banco.caixaConferirVenda;
  cancelar?: typeof banco.caixaCancelarVenda | undefined;
  sangria?: typeof banco.caixaSangria | undefined;
  fechar?: typeof banco.caixaFechar | undefined;
  /** B10: itens "não controlar" (sacola, serviço). */
  foraEstoque?: typeof banco.caixaItensForaEstoque | undefined;
};
const API_PADRAO: ApiCaixa = {
  estado: banco.caixaEstado, produtos: banco.caixaProdutos, clientes: banco.caixaClientesFiado, abrir: banco.caixaAbrir, registrar: banco.caixaRegistrarVenda,
  conferir: banco.caixaConferirVenda, cancelar: banco.caixaCancelarVenda, sangria: banco.caixaSangria, fechar: banco.caixaFechar,
  foraEstoque: banco.caixaItensForaEstoque,
};

type ClienteVenda = { id: string; nome: string; telefone: string | null; novo: boolean };
type Rascunho = { carrinho: ItemCarrinho[]; pags: PagamentoCaixa[]; cliente: ClienteVenda | null; vendaId?: string };
const chaveRascunho = (escopo: string) => `omni.caixa.rascunho.v1:${escopo}`;
function lerRascunho(escopo: string): Rascunho | null {
  try { const r = JSON.parse(localStorage.getItem(chaveRascunho(escopo)) ?? "null"); return r && Array.isArray(r.carrinho) && Array.isArray(r.pags) ? r : null; } catch { return null; }
}
function guardarRascunho(escopo: string, r: Rascunho) {
  try { if (!r.carrinho.length && !r.pags.length) localStorage.removeItem(chaveRascunho(escopo)); else localStorage.setItem(chaveRascunho(escopo), JSON.stringify(r)); } catch { /* sem armazenamento */ }
}
/** Cópia do caixa e dos produtos no celular, para preservar o trabalho se a internet cair. */
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
type Aviso = { ok: boolean; texto: string; estoque?: boolean } | null;
type Feito = { id: string; total: number; troco: number; numero: number | null; formas: string; guardada: boolean; comprovante: DadosComprovante; telefone: string | null; clienteFiado?: { id: string; nome: string } | null };
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
  const idCarrinho = useRef(newUid());
  const [envioPendente, setEnvioPendente] = useState<VendaGuardada | null>(null);
  const [enviandoVenda, setEnviandoVenda] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const verificando = useRef(false);
  const revisaoProdutos = useRef(0);
  const atualizarProdutos = useCallback(async () => {
    const rodada = ++revisaoProdutos.current;
    try { const p = await api.produtos(chave); if (rodada === revisaoProdutos.current) { setProdutos(p); setOffline(false); if (escopo) gravarCache(escopo, { produtos: p }); } }
    catch (e) { if (semInternet(e)) setOffline(true); }
  }, [api, chave, escopo]);

  const atualizarEstado = useCallback(() => {
    void api.estado(chave).then((e) => { setEstado(e); setOffline(false); if (escopo) gravarCache(escopo, { estado: e }); }).catch(() => {});
  }, [api, chave, escopo]);

  /** Envia as vendas guardadas (a mais antiga primeiro). */
  const sincronizar = useCallback(async () => {
    if (!fila.current || sincronizando.current) return;
    sincronizando.current = true;
    try {
      setEnviandoVenda(true);
      await enviarFila(fila.current, async (v) => {
        let r: banco.ResultadoCaixa;
        try { r = await api.registrar(chave, v.venda); }
        catch (e) {
          if (v.confirmacaoPendente && !ehIncerto(e)) { fila.current!.tirar(v.venda.id); setEnvioPendente(null); setErroVenda(erroCaixa(e)); }
          throw e;
        }
        if (r.situacao === "bloqueada") {
          const mensagem = banco.textoBloqueioCaixa(r, produtos);
          if (v.confirmacaoPendente) { fila.current!.tirar(v.venda.id); setEnvioPendente(null); setErroVenda(mensagem); }
          else fila.current!.marcarProblema(v.venda.id, mensagem, true);
          throw new Error(`estoque_bloqueado:${mensagem}`);
        }
        if (r.situacao !== "registrada" && r.situacao !== "repetida") throw new Error("resposta_venda_invalida");
        return r;
      }, (v, r) => {
        if (v.confirmacaoPendente && v.comprovante) {
          setFeito({ id: v.venda.id, total: v.total, troco: r.troco, numero: r.numero, formas: v.formas, guardada: false,
            telefone: v.venda.cliente?.telefone ?? null, clienteFiado: v.venda.cliente ? { id: v.venda.cliente.id, nome: v.comprovante!.cliente ?? "Cliente" } : null,
            comprovante: { ...v.comprovante, numero: r.numero } });
          setCarrinho([]); setPags([]); setCliente(null); setEnvioPendente(null); idCarrinho.current = newUid(); setErroVenda(""); setFase("feito"); bip();
        } else setFeito((f) => (f && f.id === v.venda.id ? { ...f, numero: r.numero, guardada: false, comprovante: { ...f.comprovante, numero: r.numero } } : f));
      });
      await atualizarProdutos();
      setOffline(false); setErroFila("");
      atualizarEstado();
    } catch (e) {
      if (semInternet(e)) setOffline(true); else setErroFila(erroCaixa(e));
    } finally {
      sincronizando.current = false; setEnviandoVenda(false);
      setGuardadas(fila.current.ler());
    }
  }, [api, chave, atualizarEstado, atualizarProdutos, produtos]);

  const carregar = useCallback(async () => {
    setFase("carregando"); setErroCarga("");
    try {
      const esc = await escopoAcesso(chave);
      fila.current = filaCaixa(esc);
      trazerVendaAntiga(esc, fila.current);
      setGuardadas(fila.current.ler());
      const r = lerRascunho(esc);
      if (r) { setCarrinho(r.carrinho); setPags(r.pags); setCliente(r.cliente); if (r.vendaId) idCarrinho.current = r.vendaId; }
      const incerto = fila.current.ler().find((v) => v.confirmacaoPendente && !v.problema);
      if (incerto) { setEnvioPendente(incerto); idCarrinho.current = incerto.venda.id; }
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
    } catch (e) { setErroCarga(erroCaixa(e, "O caixa não carregou")); setFase("erro"); }
  }, [api, chave]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (escopo) guardarRascunho(escopo, { carrinho, pags, cliente, vendaId: idCarrinho.current }); }, [escopo, carrinho, pags, cliente]);
  // Preços e produtos novos do dono chegam com o caixa aberto: a cada 2 min, ao voltar ao app e quando a internet volta.
  // Não mexe na tela atual nem no carrinho; sem internet, continua com a lista guardada.
  useEffect(() => {
    if (!escopo || (fase !== "vender" && fase !== "receber")) return;
    let vivo = true;
    const atualizar = async () => {
      try {
        const rodada = ++revisaoProdutos.current;
        const prods = await api.produtos(chave);
        if (!vivo || rodada !== revisaoProdutos.current) return;
        setProdutos(prods);
        const c = lerCache(escopo);
        if (c) gravarCache(escopo, { ...c, produtos: prods });
      } catch { /* sem internet: mantém a lista atual */ }
    };
    const t = setInterval(() => { void atualizar(); }, 120000);
    const voltou = () => { if (document.visibilityState === "visible") void atualizar(); };
    const online = () => { void atualizar(); };
    document.addEventListener("visibilitychange", voltou);
    window.addEventListener("online", online);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", voltou); window.removeEventListener("online", online); };
  }, [escopo, fase, api, chave]);
  // A6: com o caixa aberto (vendendo, recebendo ou na tela da venda feita), relê o turno a cada 2 min, ao voltar ao app
  // e quando a internet volta, para o aviso de venda cancelada pelo dono aparecer.
  useEffect(() => {
    if (!escopo || (fase !== "vender" && fase !== "receber" && fase !== "feito")) return;
    const t = setInterval(() => { atualizarEstado(); }, 120000);
    const voltou = () => { if (document.visibilityState === "visible") atualizarEstado(); };
    document.addEventListener("visibilitychange", voltou);
    window.addEventListener("online", atualizarEstado);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", voltou); window.removeEventListener("online", atualizarEstado); };
  }, [escopo, fase, atualizarEstado]);
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

  const conferirCarrinho = async (itens: ItemCarrinho[], receber = false) => {
    if (!estado?.turno || verificando.current || envioPendente) return;
    if (offline || navigator.onLine === false) { setErroVenda("Conecte à internet para conferir o estoque e finalizar. O carrinho continua guardado."); return; }
    verificando.current = true; setConferindo(true); setErroVenda("");
    try {
      if (api.conferir) {
        const r = await api.conferir(chave, montarVenda(idCarrinho.current, estado.turno.id, itens, [], null));
        if (r.situacao === "bloqueada") { setErroVenda(banco.textoBloqueioCaixa(r, produtos)); await atualizarProdutos(); return; }
      } else {
        const bloqueio = limiteCarrinho(itens, produtos);
        if (bloqueio) { setErroVenda(bloqueio.motivo); return; }
      }
      if (receber) setFase("receber"); else { await atualizarProdutos(); setErroVenda("O estoque foi atualizado. Confira a quantidade e tente incluir novamente."); }
    } catch (e) { if (semInternet(e)) setOffline(true); setErroVenda(erroCaixa(e, "A conferência não foi confirmada")); }
    finally { verificando.current = false; setConferindo(false); }
  };

  /** Guardar antes do envio, manter o carrinho e só concluir após confirmação do banco. */
  const finalizar = () => {
    if (!fila.current || !estado?.turno || sincronizando.current || envioPendente) return;
    if (offline || navigator.onLine === false) { setErroVenda("Conecte à internet para finalizar. O carrinho continua guardado."); return; }
    const situacao = situacaoPagamento(total, pags);
    if (!situacao.pronto) return;
    const comprovante: DadosComprovante = { comercio: { nome: estado.comercio.nome, endereco: estado.comercio.endereco }, numero: null, feitaEm: new Date().toISOString(),
      itens: carrinho.map((i) => ({ descricao: i.detalhe ? `${i.nome} (${i.detalhe})` : i.nome, qtd: i.qtd, valor: subtotal(i) })), total, pagamentos: pags, troco: situacao.troco, cliente: cliente?.nome ?? null };
    const v: VendaGuardada = { venda: montarVenda(idCarrinho.current, estado.turno.id, carrinho, pags,
      cliente ? (cliente.novo ? { id: cliente.id, nome: cliente.nome, ...(cliente.telefone ? { telefone: cliente.telefone } : {}) } : { id: cliente.id }) : null, comprovante.feitaEm),
      total, troco: situacao.troco, formas: pags.map((p) => FORMA_TXT[p.forma]).join(" + "), confirmacaoPendente: true, comprovante };
    try { fila.current.por(v); } catch (e) { setErroVenda(e instanceof Error ? e.message : String(e)); return; }
    setErroVenda(""); setEnvioPendente(v); setGuardadas(fila.current.ler()); void sincronizar();
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
  if (envioPendente) return <Tela><div className="m-auto w-full space-y-4 px-5 text-center">
    <p className="text-xl font-bold">{enviandoVenda ? "Confirmando venda…" : "Venda sem confirmação"}</p>
    <p className="text-sm">O carrinho está preservado. Aguarde a confirmação deste envio antes de vender novamente.</p>
    {(erroFila || offline) && <p role="alert" className="rounded-2xl border border-warning/50 p-3 text-sm">{erroFila || "Sem internet. Conecte para confirmar o mesmo envio."}</p>}
    <button type="button" disabled={enviandoVenda} onClick={() => void sincronizar()} className={btnPrimary(!enviandoVenda)}>Conferir envio</button>
    <button type="button" disabled={enviandoVenda} onClick={onSair} className={`w-full ${btnGhost}`}>Voltar ao início</button>
  </div></Tela>;
  if (fase === "abrir") return <AbrirCaixa nome={estado.nome} api={api} chave={chave} onSair={onSair}
    onAberto={(t) => { const e = { ...estado, turno: t, vendas: [] }; setEstado(e); gravarCache(escopo, { estado: e }); setFase("vender"); }} />;
  if (fase === "feito" && feito) return <VendaFeita f={feito} chave={chave} comercioNome={estado?.comercio.nome ?? ""} avisos={estado?.avisosCancelamento} onProxima={() => { setFeito(null); setFase("vender"); }} />;
  if (fase === "fechar" && estado.turno) return (
    <FecharCaixa turno={estado.turno} guardadas={guardadas.filter((g) => !g.problema).length} naoAceitas={guardadas.filter((g) => g.problema && g.venda.turno_id === estado.turno?.id)} chave={chave} api={api} onEnviar={sincronizar}
      onVoltar={() => setFase("vender")} onFechado={() => { apagarCache(escopo); onSair(); }} />
  );
  if (fase === "receber") return (
    <Receber total={total} pags={pags} cliente={cliente} chave={chave} escopo={escopo} api={api} erro={erroVenda}
      onPags={setPags} onCliente={setCliente} onVoltar={() => { setErroVenda(""); setFase("vender"); }} onFinalizar={finalizar} />
  );
  return (
    <Vender estado={estado} produtos={produtos} mercado={mercado} carrinho={carrinho} onCarrinho={setCarrinho} onSair={onSair}
      guardadas={guardadas} offline={offline} erroFila={erroFila} onEnviarGuardadas={() => void sincronizar()}
      onTentarDeNovo={(id) => { if (!fila.current) return; fila.current.tentarDeNovo(id); setGuardadas(fila.current.ler()); setErroFila(""); void sincronizar(); }}
      chave={chave} api={api} onEstado={(e) => { setEstado(e); gravarCache(escopo, { estado: e }); }} onAtualizar={() => { atualizarEstado(); void atualizarProdutos(); }}
      onFechar={() => setFase("fechar")} onInstalar={onInstalar}
      erroEstoque={erroVenda} conferindo={conferindo} onSolicitarContagem={(itens) => void conferirCarrinho(itens)}
      onFecharAviso={() => setErroVenda("")}
      onReceber={() => void conferirCarrinho(carrinho, true)}
      onLimpar={() => { if (verificando.current) return; idCarrinho.current = newUid(); setCarrinho([]); setPags([]); setCliente(null); setErroVenda(""); }} />
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
    api.abrir(chave, id, troco).then(onAberto, (e) => { setErro(erroCaixa(e, "O caixa não foi aberto")); setAbrindo(false); });
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
  | { j: "fora"; f: ForaEstoque }
  | { j: "peso"; a: Achado; codigo: string | null; editar?: string | undefined; qtd?: number | undefined }
  | { j: "variacao"; a: Achado; codigo: string | null }
  | { j: "limpar" }
  | { j: "menu" }
  | { j: "vendas" }
  | { j: "sangria" }
  | { j: "fiado" }
  | null;

/** A6: venda cancelada pelo dono com o caixa aberto: o caixa devolve o dinheiro ao cliente, da gaveta. */
function AvisoCanceladasDono({ avisos }: { avisos: banco.EstadoCaixa["avisosCancelamento"] }) {
  const [vistos, setVistos] = useState<string[]>([]);
  const lista = (avisos ?? []).filter((v) => v.devolverGaveta > 0 && !vistos.includes(v.id) && !jaDevolvido(v.id));
  if (!lista.length) return null;
  return (
    <div className="space-y-2">
      {lista.map((v) => (
        <div key={v.id} role="alert" className="rounded-2xl border border-warning/60 bg-warning/10 p-3">
          <p className="break-words text-base font-bold text-warning">{textoCanceladaPeloDono(v.numero, v.devolverGaveta)}</p>
          <p className="text-xs text-muted-foreground">O fechamento do caixa já conta com essa devolução.</p>
          <button type="button" onClick={() => { marcarDevolvido(v.id); setVistos((x) => [...x, v.id]); }}
            className="mt-2 min-h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm font-semibold">Já devolvi</button>
        </div>
      ))}
    </div>
  );
}

function Vender({ estado, produtos, mercado, carrinho, onCarrinho, onSair, onReceber, onLimpar, guardadas, offline, erroFila, onEnviarGuardadas, onTentarDeNovo,
  chave, api, onEstado, onAtualizar, onFechar, onInstalar, erroEstoque, conferindo, onSolicitarContagem, onFecharAviso }: {
  erroEstoque: string; conferindo: boolean; onSolicitarContagem: (itens: ItemCarrinho[]) => void;
  onFecharAviso: () => void;
  estado: banco.EstadoCaixa; produtos: ProdutoCaixa[]; mercado: boolean; carrinho: ItemCarrinho[]; onCarrinho: (f: (c: ItemCarrinho[]) => ItemCarrinho[]) => void;
  onSair: () => void; onReceber: () => void; onLimpar: () => void;
  guardadas: VendaGuardada[]; offline: boolean; erroFila: string; onEnviarGuardadas: () => void; onTentarDeNovo: (id: string) => void;
  chave: string; api: ApiCaixa; onEstado: (e: banco.EstadoCaixa) => void; onAtualizar: () => void; onFechar: () => void; onInstalar?: (() => void) | undefined;
}) {
  const [camera, setCamera] = useState(true);
  const [janela, setJanela] = useState<Janela>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const total = totalCarrinho(carrinho);
  const fimLista = useRef<HTMLDivElement>(null);
  const t = estado.turno;

  const avisar = (a: Aviso) => { setAviso(a); };
  const carrinhoAtual = useRef(carrinho); carrinhoAtual.current = carrinho;
  const conferindoAtual = useRef(conferindo); conferindoAtual.current = conferindo;
  // B10: sacola, serviço e outros itens que o dono marcou "não controlar": vendem sem tirar do estoque.
  const [fora, setFora] = useState<ForaEstoque[]>([]);
  useEffect(() => {
    const ler = api.foraEstoque;
    if (!ler) return;
    let vivo = true;
    const atualizar = () => { void ler(chave).then((f) => { if (vivo) setFora(f); }).catch(() => { /* sem internet: mantém a lista */ }); };
    atualizar();
    const t = setInterval(atualizar, 120000);
    return () => { vivo = false; clearInterval(t); };
  }, [api, chave]);
  const colocar = useCallback((item: ItemCarrinho) => {
    if (conferindoAtual.current) return;
    const candidato = adicionar(carrinhoAtual.current, item);
    const limite = limiteCarrinho(candidato, produtos);
    if (limite) { avisar({ ok: false, estoque: true, texto: "Não foi possível adicionar esta quantidade." }); onSolicitarContagem(candidato); return; }
    carrinhoAtual.current = candidato; onCarrinho(() => candidato);
    avisar({ ok: true, texto: `${item.nome}${item.detalhe ? ` · ${item.detalhe}` : ""} · ${brl(subtotal(item))}` });
    setTimeout(() => fimLista.current?.scrollIntoView?.({ block: "end", behavior: "smooth" }), 30);
  }, [onCarrinho, produtos, onSolicitarContagem]);
  const incluir = useCallback((a: Achado, codigo: string | null) => {
    if (a.produto.variacoes.length && !a.variacaoId && !a.embalagemId) { setJanela({ j: "variacao", a, codigo }); return; }
    if (!a.embalagemId && a.produto.fracionado) { setJanela({ j: "peso", a, codigo }); return; }
    colocar(itemDoProduto(newUid(), a, codigo));
  }, [colocar]);
  const lerCodigo = useCallback((c: string) => {
    if (conferindoAtual.current) return;
    bip();
    const a = acharPorCodigo(produtos, c);
    if (!a) {
      const f = acharForaEstoque(fora, c);
      if (f) { setJanela({ j: "fora", f }); return; }
      avisar({ ok: false, texto: `Código ${c} não está cadastrado` }); setJanela({ j: "sem_cadastro", codigo: c }); return;
    }
    incluir(a, c);
  }, [produtos, incluir, fora]);

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

  const mudarQtd = (id: string, delta: number) => {
    if (conferindoAtual.current) return;
    const candidato = carrinhoAtual.current.flatMap((x) => x.id !== id ? [x] : x.qtd + delta <= 0 ? [] : [{ ...x, qtd: x.qtd + delta }]);
    const limite = limiteCarrinho(candidato, produtos);
    if (delta > 0 && limite) { avisar({ ok: false, estoque: true, texto: "Não foi possível adicionar esta quantidade." }); onSolicitarContagem(candidato); return; }
    carrinhoAtual.current = candidato; onCarrinho(() => candidato);
  };
  const tirar = (id: string) => { if (!conferindoAtual.current) onCarrinho((c) => c.filter((x) => x.id !== id)); };

  return (
    <Tela>
      <header className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
        <button type="button" onClick={onSair} aria-label="Voltar ao início" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border"><ArrowLeft size={20} /></button>
        <button type="button" onClick={() => setCamera((v) => !v)} aria-pressed={camera} aria-label={camera ? "Desligar a câmera" : "Ligar a câmera"}
          className={`ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${camera ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
          {camera ? <Camera size={20} /> : <CameraOff size={20} />}
        </button>
        <button type="button" onClick={() => { onAtualizar(); setJanela({ j: "menu" }); }} aria-label="Menu do caixa"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border"><Menu size={20} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
      <div className="space-y-2">
        <div className="min-w-0 pb-1">
          <p className="flex items-center gap-1.5 break-words text-lg font-bold"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" /> Caixa aberto</p>
          <p className="break-words text-xs text-muted-foreground">{estado.nome.split(" ")[0]} · {t ? `${t.vendas === 1 ? "1 venda" : `${t.vendas} vendas`} · ${brl(t.total)}` : ""}</p>
        </div>
        {offline && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-warning/15 px-3 py-2 text-sm font-semibold text-warning">
            <CloudOff size={16} className="shrink-0" /> Sem internet: o carrinho fica guardado. Conecte para conferir o estoque e finalizar.
          </p>
        )}
        <AvisoCanceladasDono avisos={estado.avisosCancelamento} />
        {camera && <LeitorContinuo mercado={mercado} pausado={!!janela} onCode={lerCodigo} />}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8em),1fr))] gap-2">
          <button type="button" onClick={() => setJanela({ j: "buscar" })} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 px-3 py-2 text-sm font-semibold"><Search size={18} className="shrink-0" /> Código ou nome</button>
          <button type="button" onClick={() => setJanela({ j: "sem_cadastro", codigo: null })} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 px-3 py-2 text-sm font-semibold"><PackagePlus size={18} className="shrink-0" /> Produto não encontrado</button>
        </div>
        {aviso && !aviso.estoque && !erroEstoque && (
          <p role="status" className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${aviso.ok ? "bg-accent/10 text-accent" : "bg-warning/10 text-warning"}`}>
            {aviso.ok ? <CheckCircle2 size={16} className="shrink-0" /> : <TriangleAlert size={16} className="shrink-0" />} <span className="min-w-0 truncate">{aviso.texto}</span>
          </p>
        )}
        <AvisoGuardadas guardadas={guardadas} erroFila={erroFila} onEnviar={onEnviarGuardadas} />
      </div>

      {(erroEstoque || aviso?.estoque) && (
        <section role="alert" aria-label="Aviso de estoque" className="mt-3 rounded-2xl border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning"><TriangleAlert size={20} aria-hidden="true" /></span>
            <h2 className="min-w-0 flex-1 text-sm font-bold leading-snug text-foreground">{conferindo ? "Conferindo a quantidade…" : !erroEstoque && aviso?.estoque ? "Quantidade não adicionada" : "Confira antes de continuar"}</h2>
            <button type="button" disabled={conferindo} aria-label="Fechar aviso de estoque" onClick={() => { setAviso(null); onFecharAviso(); }} className="-mr-2 -mt-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-warning/10 disabled:opacity-50"><X size={18} /></button>
          </div>
          <p className="mt-3 break-words text-sm leading-relaxed text-foreground">{erroEstoque || aviso?.texto}</p>
          <p className="mt-3 border-t border-warning/15 pt-3 text-xs leading-relaxed text-muted-foreground">O carrinho foi mantido.</p>
        </section>
      )}
      <div className="mt-3">
        {!carrinho.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground">
            <ShoppingCart size={36} />
            <p className="text-base font-semibold text-foreground">Bipe o primeiro produto</p>
            <p className="text-sm">Aponte a câmera para o código de barras, ou toque em "Código ou nome".</p>
          </div>
        ) : (
          <ul aria-label="Produtos da venda" className="divide-y divide-border">
            {carrinho.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <div className="w-full min-w-0">
                  <p className="break-words text-base font-semibold leading-snug">{i.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.detalhe ? `${i.detalhe} · ` : ""}{i.fracionado ? `${qtdTexto(i.qtd)} ${unPlural(i.unidade).toLowerCase()} × ${brl(i.preco)}` : `${brl(i.preco)} cada`}
                    {!i.produtoId && " · sem cadastro"}
                  </p>
                </div>
                {i.fracionado ? (
                  <button type="button" disabled={conferindo} aria-label={`Tirar ${i.nome}`} onClick={() => tirar(i.id)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground"><Trash2 size={18} /></button>
                ) : (
                  <div className="flex max-w-full items-center rounded-2xl border border-border">
                    <button type="button" disabled={conferindo} aria-label={i.qtd === 1 ? `Tirar ${i.nome}` : `Menos ${i.nome}`} onClick={() => mudarQtd(i.id, -1)} className="flex h-12 w-12 shrink-0 items-center justify-center text-primary">
                      {i.qtd === 1 ? <Trash2 size={17} /> : <Minus size={18} />}
                    </button>
                    <span aria-label={`Quantidade de ${i.nome}`} className="min-w-7 break-words text-center text-base font-bold tabular-nums">{i.qtd}</span>
                    <button type="button" disabled={conferindo} aria-label={`Mais ${i.nome}`} onClick={() => mudarQtd(i.id, 1)} className="flex h-12 w-12 shrink-0 items-center justify-center text-primary"><Plus size={18} /></button>
                  </div>
                )}
                <span className="ml-auto max-w-full break-words text-right text-base font-bold tabular-nums">{brl(subtotal(i))}</span>
              </li>
            ))}
          </ul>
        )}
        <div ref={fimLista} />
      </div>
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">Total{carrinho.length ? ` · ${contarItens(carrinho) === 1 ? "1 item" : `${qtdTexto(contarItens(carrinho))} itens`}` : ""}</p>
          <p aria-label="Total da venda" className="break-words text-2xl font-bold tabular-nums">{brl(total)}</p>
          {carrinho.length > 0 && <button type="button" disabled={conferindo} onClick={() => setJanela({ j: "limpar" })} className="min-h-12 min-w-12 text-xs font-semibold text-muted-foreground underline">Limpar venda</button>}
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-background/80 px-4 pt-3 backdrop-blur">
        <button type="button" disabled={!carrinho.length || conferindo} onClick={onReceber} className={`relative flex items-center justify-center gap-2 py-2 ${btnPrimary(!!carrinho.length)}`}>
          <Banknote size={22} className="absolute left-4 top-1/2 -translate-y-1/2" /><span className="min-w-0 flex-1 break-words pl-6">Receber {carrinho.length ? brl(total) : ""}</span>
        </button>
      </footer>

      {janela?.j === "buscar" && (
        <BuscarProduto produtos={produtos} fora={fora} onClose={() => setJanela(null)}
          onFora={(f) => setJanela({ j: "fora", f })}
          onCodigo={(c) => { setJanela(null); lerCodigo(c); }}
          onEscolher={(p) => { setJanela(null); incluir({ produto: p, variacaoId: null, embalagemId: null }, null); }} />
      )}
      {janela?.j === "sem_cadastro" && <SemCadastro codigo={janela.codigo} onClose={() => setJanela(null)} />}
      {janela?.j === "fora" && (
        <PrecoForaEstoque f={janela.f} onClose={() => setJanela(null)}
          onIncluir={(preco) => { setJanela(null); colocar(itemForaEstoque(newUid(), janela.f, preco)); }} />
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
          onVendas={() => setJanela({ j: "vendas" })} onSangria={() => setJanela({ j: "sangria" })} onFiado={() => setJanela({ j: "fiado" })}
          onFechar={() => { setJanela(null); onFechar(); }} onInicio={() => { setJanela(null); onSair(); }} />
      )}
      {janela?.j === "vendas" && (
        <VendasDoCaixa estado={estado} guardadas={guardadas} chave={chave} api={api} offline={offline} onClose={() => setJanela(null)} onMudou={onAtualizar} onTentarDeNovo={onTentarDeNovo} />
      )}
      {janela?.j === "fiado" && <ClientesFiadoCaixa chave={chave} api={api} turnoId={estado.turno?.id ?? null} comercioNome={estado.comercio.nome} onClose={() => setJanela(null)} />}
      {janela?.j === "sangria" && estado.turno && (
        <Sangria turno={estado.turno} chave={chave} api={api} onClose={() => setJanela(null)}
          onFeito={(t) => { onEstado({ ...estado, turno: t }); setJanela(null); setAviso({ ok: true, texto: "Dinheiro tirado da gaveta e anotado." }); }} />
      )}
    </Tela>
  );
}

function BuscarProduto({ produtos, fora = [], onEscolher, onFora, onCodigo, onClose }: { produtos: ProdutoCaixa[]; fora?: ForaEstoque[]; onEscolher: (p: ProdutoCaixa) => void;
  onFora?: (f: ForaEstoque) => void; onCodigo: (c: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const achados = useMemo(() => buscarProdutos(produtos, q), [produtos, q]);
  const achadosFora = useMemo(() => (onFora ? buscarForaEstoque(fora, q) : []), [fora, q, onFora]);
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
          {q.trim().length >= 2 && !achados.length && !achadosFora.length && !soNumeros && <li className="p-3 text-center text-sm text-muted-foreground">Nenhum produto com esse nome.</li>}
          {achados.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onEscolher(p)} className="flex min-h-13 w-full items-center justify-between gap-2 rounded-2xl border border-border px-3 text-left">
                <span className="min-w-0"><span className="block break-words text-base font-semibold">{p.nome}</span><span className="block text-xs text-muted-foreground">{p.fracionado ? `${brl(p.preco)} / ${unSingular(p.unidade).toLowerCase()}` : brl(p.preco)}</span></span>
                <Plus size={18} className="shrink-0 text-primary" />
              </button>
            </li>
          ))}
          {achadosFora.map((f) => (
            <li key={`fora:${f.codigo ?? f.nome}`}>
              <button type="button" onClick={() => onFora?.(f)} className="flex min-h-13 w-full items-center justify-between gap-2 rounded-2xl border border-border px-3 text-left">
                <span className="min-w-0"><span className="block break-words text-base font-semibold">{f.nome}</span><span className="block text-xs text-muted-foreground">Fora do estoque · digite o preço</span></span>
                <Plus size={18} className="shrink-0 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      </form>
    </Sheet>
  );
}

/** B10: sacola, serviço… o dono marcou "não controlar": não sai do estoque; o caixa digita o preço. */
function PrecoForaEstoque({ f, onIncluir, onClose }: { f: ForaEstoque; onIncluir: (preco: number) => void; onClose: () => void }) {
  const [txt, setTxt] = useState("");
  const preco = lerReais(txt);
  return (
    <Sheet title={f.nome} onClose={onClose}>
      <form className="min-h-0 space-y-3 overflow-y-auto px-5 py-3" onSubmit={(e) => { e.preventDefault(); if (preco != null) onIncluir(preco); }}>
        <p className="text-sm text-muted-foreground">Este item não sai do estoque (o dono marcou que não é controlado). Digite o preço.</p>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Preço (R$)</span>
          <input autoFocus inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ex.: 0,50" aria-label="Preço do item"
            className="h-16 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-center text-3xl font-bold tabular-nums text-foreground outline-none focus-visible:border-primary" />
        </label>
        <button type="submit" disabled={preco == null} className={btnPrimary(preco != null)}>Incluir</button>
      </form>
    </Sheet>
  );
}

function SemCadastro({ codigo, onClose }: { codigo: string | null; onClose: () => void }) {
  return <Sheet title="Produto não encontrado" onClose={onClose}>
    <div className="space-y-3 px-5 py-3">
      <p className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">{codigo ? <>O código <b>{codigo}</b> não foi encontrado no caixa.</> : "Não encontrou o produto?"} Peça ao dono para verificar o cadastro do produto e a área de venda antes de vender.</p>
      <p className="text-sm text-muted-foreground">O carrinho atual continua preservado.</p>
      <button type="button" onClick={onClose} className={`w-full ${btnGhost}`}>Entendi</button>
    </div>
  </Sheet>;
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
          <input autoFocus inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value.replace(/\./g, ","))} placeholder={un === "Kg" ? "Ex.: 0,350" : "Ex.: 1,5"} aria-label={pergunta}
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
        {s.passou > 0 ? (
          <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-center text-base font-semibold text-destructive">
            O total da venda diminuiu. Pix, cartão e fiado não dão troco: tire o pagamento de cima (no X) e lance de novo com {brl(total)}.
          </p>
        ) : s.falta > 0 ? (
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
  const [daCopia, setDaCopia] = useState(false);
  useEffect(() => {
    api.clientes(chave).then((l) => { setLista(l); setDaCopia(false); gravarCache(escopo, { clientes: l }); },
      (e) => { const c = lerCache(escopo)?.clientes; if (c) { setLista(c); setDaCopia(true); } else { setErro(erroCaixa(e, "A lista de clientes não carregou")); setLista([]); } });
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
            {daCopia && <p role="status" className="rounded-2xl border border-warning/50 bg-warning/10 p-2 text-xs font-semibold">Sem internet: os valores são da última atualização e podem ter mudado.</p>}
            {lista && !lista.length && !erro && <p className="text-center text-sm text-muted-foreground">Nenhum cliente no fiado ainda. Toque em "Cliente novo".</p>}
            <ul className="space-y-1.5">
              {achados.map((c) => {
                const temSaldo = typeof c.deve === "number";
                const deve = c.deve ?? 0;
                const barra = bloqueioFiado(c, valor);
                return (
                <li key={c.id}>
                  <button type="button" disabled={!!barra} onClick={() => onEscolher({ id: c.id, nome: c.nome, telefone: c.telefone, novo: false })}
                    className={`flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left ${barra ? "border-destructive/50 opacity-70" : "border-border"}`}>
                    <span className="min-w-0">
                      <span className="block text-base font-semibold">{c.nome}</span>
                      {c.telefone && <span className="block text-xs text-muted-foreground">{maskPhone(c.telefone)}</span>}
                      {barra && <span className="block text-xs font-semibold text-destructive">{barra}</span>}
                      {!barra && c.limite != null && <span className="block text-xs text-muted-foreground">Limite {brl(c.limite)}</span>}
                      {temSaldo && <span className="block text-xs text-muted-foreground">Com esta venda, vai ficar devendo <b className="text-foreground">{brl(deve + valor)}</b></span>}
                    </span>
                    {temSaldo && (deve > 0
                      ? <span className="shrink-0 text-right text-sm"><span className="block text-xs text-muted-foreground">Deve</span><b className="tabular-nums text-warning">{brl(deve)}</b></span>
                      : <span className="shrink-0 text-xs font-semibold text-accent">Em dia</span>)}
                    {!temSaldo && <Check size={18} className="text-primary" />}
                  </button>
                </li>
                );
              })}
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

function VendaFeita({ f, chave, comercioNome, avisos, onProxima }: { f: Feito; chave: string; comercioNome: string; avisos?: banco.EstadoCaixa["avisosCancelamento"]; onProxima: () => void }) {
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
        <div className="w-full text-left"><AvisoCanceladasDono avisos={avisos} /></div>
        {f.troco > 0 && (
          <div className="w-full rounded-3xl bg-accent/15 p-4 text-accent">
            <p className="text-sm font-semibold">Troco</p>
            <p className="text-5xl font-bold tabular-nums">{brl(f.troco)}</p>
          </div>
        )}
      </div>
      <div className="px-4">
        {f.clienteFiado && f.numero ? (
          <div className="mb-2">
            <CompartilharFiado telefone={f.telefone} rotulo="Mandar a conta do fiado no WhatsApp"
              montar={async (link) => {
                const cf = f.clienteFiado!;
                const [token, movs, lista] = await Promise.all([linkClienteCaixa(chave, cf.id), banco.caixaClienteFiadoHistorico(chave, cf.id).catch(() => []), banco.caixaClientesFiado(chave).catch(() => [])]);
                const c = lista.find((x) => x.id === cf.id) as { deve?: number | null; desde?: string | null } | undefined;
                return mensagemFiadoCompleta({ nome: cf.nome, deve: c?.deve ?? f.total, desde: c?.desde ?? null }, comercioNome, movs, link(token));
              }} />
          </div>
        ) : f.clienteFiado ? (
          <p className="mb-2 text-center text-xs text-muted-foreground">A conta do fiado para o WhatsApp aparece assim que a venda chegar ao Omni.</p>
        ) : (
          <button type="button" onClick={() => setComprovante(true)} className={`mb-2 flex w-full items-center justify-center gap-2 ${btnGhost}`}><MessageCircle size={18} /> Mandar comprovante no WhatsApp</button>
        )}
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

/** F5: cadastrar cliente do fiado sem vender. O id fica guardado até dar certo, então repetir não duplica. */
function NovoClienteCaixa({ chave, onSalvo }: { chave: string; onSalvo: (c: banco.ClienteFiado) => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [id, setId] = useState(() => crypto.randomUUID());
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const t = digits(tel);
  const valido = nome.trim().length >= 2 && nome.trim().length <= 60 && (!t || t.length === 10 || t.length === 11);
  const salvar = async () => {
    if (!valido || salvando) return;
    setSalvando(true); setMsg("");
    try {
      const c = await banco.caixaSalvarClienteFiado(chave, id, nome.trim(), t || null);
      onSalvo(c); setOk(`${c.nome} cadastrado.`); setNome(""); setTel(""); setId(crypto.randomUUID()); setAberto(false);
    } catch (e) { setMsg(erroCaixa(e, "O cliente não foi cadastrado")); }
    finally { setSalvando(false); }
  };
  if (!aberto) return (
    <div className="space-y-1">
      <button type="button" onClick={() => { setAberto(true); setOk(""); }} className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-primary/60 text-sm font-semibold text-primary">+ Cadastrar cliente</button>
      {ok && <p role="status" className="text-center text-xs font-semibold text-accent">{ok}</p>}
    </div>
  );
  return (
    <div className="space-y-2 rounded-3xl border border-border bg-secondary/40 p-4">
      <p className="text-sm font-semibold">Cadastrar cliente do fiado</p>
      <input value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvando} placeholder="Nome do cliente" aria-label="Nome do cliente" maxLength={60}
        className="h-12 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
      <input value={maskPhone(tel)} onChange={(e) => setTel(digits(e.target.value).slice(0, 11))} disabled={salvando} inputMode="tel" placeholder="Telefone com DDD (opcional)" aria-label="Telefone do cliente"
        className="h-12 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
      {t && t.length < 10 && <p className="text-xs text-warning">Telefone com DDD: 10 ou 11 números.</p>}
      {msg && <p role="alert" className="text-sm font-semibold text-destructive">{msg}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={salvando} onClick={() => { setAberto(false); setMsg(""); }} className="h-12 flex-1 rounded-2xl border border-border text-sm font-semibold">Cancelar</button>
        <button type="button" disabled={!valido || salvando} onClick={() => void salvar()} className="h-12 flex-1 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">{salvando ? "Salvando…" : "Salvar cliente"}</button>
      </div>
      <p className="text-xs text-muted-foreground">Precisa de internet. Mudar nome ou telefone depois é com o dono.</p>
    </div>
  );
}

/** F3: consulta de quem deve no fiado, dentro do caixa (só leitura). Sem internet, usa a última cópia com aviso. */
function ClientesFiadoCaixa({ chave, api, turnoId, comercioNome = "", onClose }: { chave: string; api: ApiCaixa; turnoId: string | null; comercioNome?: string; onClose: () => void }) {
  const [versao, setVersao] = useState(0);
  const [lista, setLista] = useState<banco.ClienteFiado[] | null>(null);
  const [daCopia, setDaCopia] = useState(false);
  const [erro, setErro] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const esc = await escopoAcesso(chave);
      try {
        const l = await api.clientes(chave);
        if (!vivo) return;
        setLista(l); setDaCopia(false); gravarCache(esc, { clientes: l });
      } catch (e) {
        if (!vivo) return;
        const c = lerCache(esc)?.clientes;
        if (c) { setLista(c); setDaCopia(true); } else { setErro(erroCaixa(e, "A lista de clientes não carregou")); setLista([]); }
      }
    })();
    return () => { vivo = false; };
  }, [api, chave]);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const todos = [...(lista ?? [])].sort((a, b) => (b.deve ?? 0) - (a.deve ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"));
  const achados = todos.filter((c) => norm(c.nome).includes(norm(q)) || (!!digits(q) && (c.telefone ?? "").includes(digits(q))));
  const devendo = todos.filter((c) => (c.deve ?? 0) > 0);
  const total = devendo.reduce((t, c) => t + (c.deve ?? 0), 0);
  const antigo = (c: banco.ClienteFiado) => !!c.desde && Date.now() - Date.parse(c.desde) > DIAS_ANTIGO * 86_400_000;
  const c = todos.find((x) => x.id === sel);
  const dataTxt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return (
    <Sheet title={c ? c.nome : "Clientes do fiado"} onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        {daCopia && <p role="status" className="rounded-2xl border border-warning/50 bg-warning/10 p-2 text-xs font-semibold">Sem internet: os valores são da última atualização e podem ter mudado.</p>}
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
        {lista === null && <p className="text-center text-sm text-muted-foreground">Carregando os clientes…</p>}
        {c ? (
          <>
            <button type="button" onClick={() => setSel(null)} className="text-sm font-semibold text-primary">← Todos os clientes</button>
            <div className="rounded-3xl border border-border bg-secondary/40 p-4">
              <p className="text-sm text-muted-foreground">{(c.deve ?? 0) > 0 ? "Deve" : "Conta em dia"}</p>
              <p className={`text-3xl font-bold tabular-nums ${(c.deve ?? 0) > 0 ? "" : "text-accent"}`}>{typeof c.deve === "number" ? brl(c.deve) : "—"}</p>
              {c.desde && (c.deve ?? 0) > 0 && <p className={`text-xs ${antigo(c) ? "font-semibold text-warning" : "text-muted-foreground"}`}>Devendo desde {dataTxt(c.desde)} ({haQuantoTempo(c.desde)})</p>}
              {c.telefone && <p className="mt-1 text-sm">{maskPhone(c.telefone)}</p>}
            </div>
            {turnoId && (c.deve ?? 0) > 0 && !daCopia && (
              <ReceberFiadoCaixa key={c.id} chave={chave} turnoId={turnoId} cliente={c}
                onPago={(deve) => { setLista((l) => (l ?? []).map((x) => x.id === c.id ? { ...x, deve, desde: deve > 0 ? (x.desde ?? null) : null } : x)); setVersao((n) => n + 1); }} />
            )}
            {!daCopia && (
              <CompartilharFiado telefone={c.telefone ?? null} rotulo="Mandar a conta no WhatsApp"
                montar={async (link) => {
                  const [token, movs] = await Promise.all([linkClienteCaixa(chave, c.id), banco.caixaClienteFiadoHistorico(chave, c.id).catch(() => [])]);
                  return mensagemFiadoCompleta({ nome: c.nome, deve: c.deve ?? 0, desde: c.desde ?? null }, comercioNome, movs, link(token));
                }} />
            )}
            <HistoricoFiado key={versao} chave={chave} clienteId={c.id} />
            <p className="text-xs text-muted-foreground">Para anotar uma compra, use Fiado na hora de receber.</p>
          </>
        ) : lista && (
          <>
            <div className="rounded-3xl border border-border bg-secondary/40 p-4">
              <p className="text-sm text-muted-foreground">Total a receber</p>
              <p className="text-2xl font-bold tabular-nums">{brl(total)}</p>
              <p className="text-xs text-muted-foreground">{devendo.length === 0 ? "Ninguém devendo" : devendo.length === 1 ? "1 cliente deve" : `${devendo.length} clientes devem`}</p>
            </div>
            <NovoClienteCaixa chave={chave} onSalvo={(n) => setLista((l) => { const nova = [...(l ?? []).filter((x) => x.id !== n.id), n]; void escopoAcesso(chave).then((esc) => gravarCache(esc, { clientes: nova })).catch(() => {}); return nova; })} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar pelo nome ou telefone" aria-label="Procurar cliente"
              className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            {!lista.length && !erro && <p className="text-center text-sm text-muted-foreground">Nenhum cliente no fiado ainda.</p>}
            <ul className="space-y-1.5" aria-label="Clientes do fiado">
              {achados.map((x) => {
                const deve = x.deve ?? 0;
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => setSel(x.id)}
                      className={`flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left ${antigo(x) && deve > 0 ? "border-warning/60 bg-warning/5" : "border-border"}`}>
                      <span className="min-w-0">
                        <span className="block text-base font-semibold">{x.nome}</span>
                        {x.desde && deve > 0 && <span className={`block text-xs ${antigo(x) ? "font-semibold text-warning" : "text-muted-foreground"}`}>Desde {dataTxt(x.desde)} ({haQuantoTempo(x.desde)})</span>}
                      </span>
                      {typeof x.deve !== "number" ? null : deve > 0
                        ? <b className="shrink-0 tabular-nums">{brl(deve)}</b>
                        : <span className="shrink-0 text-xs font-semibold text-accent">Em dia</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}

function MenuCaixa({ estado, guardadas, onClose, onVendas, onSangria, onFechar, onInicio, onInstalar, onFiado }: {
  estado: banco.EstadoCaixa; guardadas: number; onClose: () => void; onVendas: () => void; onSangria: () => void; onFechar: () => void; onInicio: () => void;
  onFiado: () => void;
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
        <button type="button" onClick={onFiado} className={item}><BookUser size={20} className="text-primary" /><span className="flex-1"><b className="block text-base">Clientes do fiado</b><span className="text-xs text-muted-foreground">Quem deve, quanto e desde quando</span></span></button>
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

function VendasDoCaixa({ estado, guardadas, chave, api, offline, onClose, onMudou, onTentarDeNovo }: {
  estado: banco.EstadoCaixa; guardadas: VendaGuardada[]; chave: string; api: ApiCaixa; offline: boolean; onClose: () => void; onMudou: () => void; onTentarDeNovo: (id: string) => void;
}) {
  const [aberta, setAberta] = useState<banco.VendaDoCaixa | null>(null);
  const [cancelar, setCancelar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pin, setPin] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState("");
  const [devolver, setDevolver] = useState(0);
  const [gaveta, setGaveta] = useState(false);
  const [comprovante, setComprovante] = useState(false);
  const fazerCancelar = () => {
    if (!aberta || pin.length !== 4 || ocupado) return;
    setOcupado(true); setErro("");
    (api.cancelar ?? banco.caixaCancelarVenda)(chave, aberta.id, pin, motivo.trim()).then((r) => {
      setDevolver(devolverDe(r)); setGaveta(!!(r as { gaveta?: boolean })?.gaveta);
      setPronto(`Venda ${aberta.numero ? `nº ${aberta.numero} ` : ""}cancelada. Os produtos voltaram para a gôndola.`);
      setAberta(null); setCancelar(false); setPin(""); setMotivo(""); onMudou();
    }, (e) => { setErro(erroPinDono(e, "A venda não foi cancelada")); setPin(""); }).finally(() => setOcupado(false));
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
        {pronto && devolver > 0 && <p role="alert" className="rounded-2xl border border-warning/60 bg-warning/10 p-3 text-base font-bold text-warning">{textoDevolver(devolver, gaveta)}</p>}
        {guardadas.map((g) => (
          <div key={g.venda.id} className={`rounded-2xl border p-3 text-sm ${g.problema ? "border-destructive/50 bg-destructive/5" : "border-warning/50 bg-warning/5"}`}>
            <p className="flex justify-between"><b>{horaTxt(g.venda.feita_em)} · {g.formas}</b><b>{brl(g.total)}</b></p>
            <p className={g.problema ? "font-semibold text-destructive" : "text-warning"}>{g.problema ? `Não foi aceita: ${g.problema}` : "Guardada no celular · esperando a internet"}</p>
            {g.problema && (
              <>
                {g.conciliacaoDono ? <p className="mt-2 text-sm font-semibold">Venda antiga: mostre ao dono para conciliar o dinheiro e o estoque. O envio foi preservado.</p> :
                  <button type="button" onClick={() => onTentarDeNovo(g.venda.id)} className={`mt-2 w-full ${btnGhost}`}>Tentar enviar de novo</button>}
                <p className="mt-1 text-xs text-muted-foreground">Se continuar sem ir, mostre ao dono. Ao fechar o caixa, ela aparece para ele no fechamento.</p>
              </>
            )}
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
    (api.sangria ?? banco.caixaSangria)(chave, id, turno.id, valor, motivo.trim(), pin).then(onFeito, (e) => { setErro(erroPinDono(e, "O dinheiro tirado não foi registrado")); setPin(""); setOcupado(false); });
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
function FecharCaixa({ turno, guardadas, naoAceitas, chave, api, onEnviar, onVoltar, onFechado }: {
  turno: banco.TurnoCaixa; guardadas: number; naoAceitas: VendaGuardada[]; chave: string; api: ApiCaixa; onEnviar: () => Promise<void>; onVoltar: () => void; onFechado: () => void;
}) {
  const [contado, setContado] = useState(0);
  const [obs, setObs] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [fim, setFim] = useState<banco.TurnoCaixa | null>(null);
  const fechar = () => {
    setOcupado(true); setErro("");
    // Vendas não aceitas vão primeiro na anotação (o dono vê no fechamento por que pode sobrar dinheiro).
    const anotacao = [notaNaoAceitas(naoAceitas), obs.trim()].filter(Boolean).join(" ");
    (api.fechar ?? banco.caixaFechar)(chave, turno.id, contado, anotacao).then(setFim, (e) => { setErro(erroPinDono(e, "O caixa não foi fechado")); setOcupado(false); });
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
            {naoAceitas.length > 0 && <p className="mt-1 text-sm font-semibold text-warning">{notaNaoAceitas(naoAceitas)} O dono foi avisado no fechamento.</p>}
          </div>
          <div className="divide-y divide-border rounded-3xl border border-border px-4 py-2 text-sm">
            {linha(`Vendas (${fim.vendas})`, brl(fim.total), true)}
            {linha("Dinheiro", brl(fim.porForma.dinheiro))}{linha("Pix", brl(fim.porForma.pix))}{linha("Cartão", brl(fim.porForma.cartao))}{linha("Fiado", brl(fim.porForma.fiado))}
            {(fim.fiadoRecebido?.quantos ?? 0) > 0 && linha(`Recebido do fiado (${fim.fiadoRecebido!.quantos})`, brl(fim.fiadoRecebido!.dinheiro + fim.fiadoRecebido!.pix + fim.fiadoRecebido!.cartao))}
          </div>
          <div className="divide-y divide-border rounded-3xl border border-border px-4 py-2 text-sm">
            {linha("Troco no começo", brl(fim.trocoInicial))}
            {linha("+ Dinheiro recebido", brl(fim.porForma.dinheiro))}
            {(fim.fiadoRecebido?.dinheiro ?? 0) > 0 && linha("+ Dinheiro do fiado", brl(fim.fiadoRecebido!.dinheiro))}
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
        {naoAceitas.length > 0 && (
          <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <b>{notaNaoAceitas(naoAceitas)}</b> O dinheiro delas está na gaveta, mas elas não entram na conta do Omni. O dono vai ver isso no fechamento.
          </p>
        )}
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

/** F4: histórico do cliente do fiado no caixa (só consulta; precisa de internet). */
function HistoricoFiado({ chave, clienteId }: { chave: string; clienteId: string }) {
  const [movs, setMovs] = useState<banco.MovimentoFiadoCaixa[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true; setMovs(null); setErro("");
    banco.caixaClienteFiadoHistorico(chave, clienteId)
      .then((m) => { if (vivo) setMovs(m); })
      .catch((e) => { if (vivo) setErro(erroCaixa(e, "O histórico não carregou")); });
    return () => { vivo = false; };
  }, [chave, clienteId]);
  const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const texto = (m: banco.MovimentoFiadoCaixa) => textoMovimento({ ...m, clienteId, observacao: null });
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">Últimos movimentos</p>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {!erro && movs === null && <p className="text-sm text-muted-foreground">Carregando o histórico…</p>}
      {movs && movs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum movimento ainda.</p>}
      {movs && movs.length > 0 && (
        <ul className="space-y-1" aria-label="Histórico do cliente">
          {movs.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-2xl border border-border px-3 py-2 text-sm">
              <span><span className="block">{texto(m)}</span><span className="text-xs text-muted-foreground">{quando(m.criadoEm)}</span></span>
              <b className={`tabular-nums ${m.tipo === "compra" ? "" : "text-accent"}`}>{m.tipo === "compra" ? "+" : "−"}{brl(m.valor)}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** F6: o cliente pagou o fiado no balcão. Precisa do caixa aberto e de internet; o id fica guardado até dar certo (repetir não duplica). */
function ReceberFiadoCaixa({ chave, turnoId, cliente, onPago }: { chave: string; turnoId: string; cliente: banco.ClienteFiado; onPago: (deve: number) => void }) {
  const deve = cliente.deve ?? 0;
  // B11: pagamento enviado sem resposta (internet caiu) fica travado com o mesmo id, valor e forma até o banco responder.
  const [pendente, setPendente] = useState<FiadoPendente | null>(() => lerFiadoPendente(cliente.id));
  const [aberto, setAberto] = useState(() => !!pendente);
  const [valor, setValor] = useState(() => ((pendente?.centavos ?? deve) / 100).toFixed(2).replace(".", ","));
  const [forma, setForma] = useState<"dinheiro" | "pix" | "cartao">(() => pendente?.forma ?? "dinheiro");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(() => (pendente ? "O último envio ficou sem resposta. Toque em Tentar de novo: o mesmo pagamento não é registrado duas vezes." : ""));
  const [ok, setOk] = useState("");
  // A7: "15.5" é R$ 15,50 (antes o ponto era apagado e virava R$ 155).
  const cent = pendente ? pendente.centavos : lerReais(valor) ?? NaN;
  const valido = pendente ? true : Number.isFinite(cent) && cent > 0 && cent <= deve;
  const travar = (p: FiadoPendente | null) => { setPendente(p); guardarFiadoPendente(cliente.id, p); };
  const salvar = async () => {
    if (!valido || salvando) return;
    const envio: FiadoPendente = pendente ?? { id: crypto.randomUUID(), centavos: cent, forma };
    travar(envio); // guardado antes da rede: se o app fechar, o próximo envio repete este
    setSalvando(true); setMsg("");
    try {
      const r = await banco.caixaReceberFiado(chave, envio.id, turnoId, cliente.id, envio.centavos, envio.forma);
      travar(null);
      setOk(`Pagamento de ${brl(envio.centavos)} registrado.${envio.forma === "dinheiro" ? " O dinheiro entra na conta da gaveta." : ""}`);
      setAberto(false); onPago(r.deve);
    } catch (e) {
      if (ehIncerto(e)) setMsg(`${erroCaixa(e, "O pagamento não foi confirmado")} O valor fica guardado: tentar de novo não registra duas vezes.`);
      else { travar(null); setMsg(erroCaixa(e, "O pagamento não foi registrado")); }
    } finally { setSalvando(false); }
  };
  if (!aberto) return (
    <div className="space-y-1">
      <button type="button" onClick={() => { setAberto(true); setOk(""); }} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">{pendente ? `Pagamento de ${brl(pendente.centavos)} sem resposta: conferir` : "Recebeu pagamento"}</button>
      {ok && <p role="status" className="text-center text-xs font-semibold text-accent">{ok}</p>}
    </div>
  );
  const btn = (f: "dinheiro" | "pix" | "cartao", t: string) => (
    <button type="button" disabled={salvando || !!pendente} onClick={() => setForma(f)} aria-pressed={forma === f}
      className={`h-11 flex-1 rounded-2xl border text-sm font-semibold ${forma === f ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{t}</button>
  );
  return (
    <div className="space-y-2 rounded-3xl border border-border bg-secondary/40 p-4">
      <p className="text-sm font-semibold">Quanto o cliente pagou?</p>
      <input value={valor} onChange={(e) => setValor(e.target.value.replace(/[^0-9,.]/g, ""))} disabled={salvando || !!pendente} inputMode="decimal" aria-label="Valor pago"
        className="h-12 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
      <div className="flex gap-2">{btn("dinheiro", "Dinheiro")}{btn("pix", "Pix")}{btn("cartao", "Cartão")}</div>
      {!pendente && cent > deve && <p className="text-xs text-warning">Não pode passar do que deve ({brl(deve)}).</p>}
      {!pendente && valido && <p className="text-xs text-muted-foreground">{cent === deve ? "A conta fica em dia." : `Vai continuar devendo ${brl(deve - cent)}.`}</p>}
      {msg && <p role="alert" className="text-sm font-semibold text-destructive">{msg}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={salvando} onClick={() => { setAberto(false); if (!pendente) setMsg(""); }} className="h-12 flex-1 rounded-2xl border border-border text-sm font-semibold">Cancelar</button>
        <button type="button" disabled={!valido || salvando} onClick={() => void salvar()} className="h-12 flex-1 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">{salvando ? "Registrando…" : pendente ? "Tentar de novo" : "Registrar pagamento"}</button>
      </div>
      <p className="text-xs text-muted-foreground">Precisa de internet. Dinheiro recebido entra no fechamento do caixa.</p>
    </div>
  );
}
