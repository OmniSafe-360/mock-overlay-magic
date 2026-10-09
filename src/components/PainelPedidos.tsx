/* Aba Pedidos (D2a): montar o pedido sozinho por fornecedor, enviar pelo WhatsApp ou e-mail com um toque e acompanhar. */
import { useMemo, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, ClipboardList, Copy, Link2, Mail, MessageCircle, Minus, Plus, RefreshCw, Search, Send, Trash2, Truck, X, XCircle } from "lucide-react";
import { Sheet, type Product, type Supplier, type Variation } from "@/components/ProductArea";
import { linkWhatsApp } from "@/components/PainelFornecedores";
import { btnGhost, btnPrimary, type StoreData } from "@/components/StoreSetup";
import { aceitaFracao, fmtQ, qtdUn, unPlural } from "@/lib/deposito";
import { descricaoEmbalagem } from "@/lib/embalagem";
import {
  CANAL_TXT, SITUACAO_TXT, chaveLinha, dataEntregaTexto, formaTexto, linkPedido, respostaItem, resumoResposta, linhaManual, linhasDoPedido, nomeLinha, pedidoAberto, pedidoFechado, quantidadeTexto,
  sugerirPedido, textoPedido, totalLinha, totalLinhas, totalPedido, unidadesDaLinha, type CanalPedido, type LinhaPedido, type Pedido, type SituacaoPedido,
} from "@/lib/pedido";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataCurta = (ts: string) => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const COR_SITUACAO: Record<SituacaoPedido, string> = {
  rascunho: "border-border text-muted-foreground", enviado: "border-warning/60 text-warning", aceito: "border-accent/60 text-accent",
  aceito_ajustes: "border-accent/60 text-accent", recusado: "border-destructive/60 text-destructive", recebido_parcial: "border-primary/60 text-primary",
  recebido: "border-primary/60 text-primary", cancelado: "border-border text-muted-foreground line-through",
};

export type SalvarPedido = (a: { fornecedor: Supplier; linhas: LinhaPedido[]; observacao: string }) => Promise<{ id: string; numero: number; token?: string | undefined }>;

export function PainelPedidos({ products, store, suppliers, pedidos, montarAgora = false, onSalvar, onEnviado, onCancelar, onNovoLink, onOpenProduto }: {
  products: Product[]; store: StoreData; suppliers: Supplier[]; pedidos: Pedido[]; montarAgora?: boolean;
  onSalvar: SalvarPedido; onEnviado: (id: string, canal: CanalPedido) => Promise<unknown>; onCancelar: (id: string) => Promise<unknown>;
  onNovoLink: (id: string) => Promise<string>; onOpenProduto: (p: Product) => void;
}) {
  const [view, setView] = useState<{ t: "lista" } | { t: "montar" } | { t: "detalhe"; id: string }>(montarAgora ? { t: "montar" } : { t: "lista" });
  const fornecedorDe = (dbId: string) => suppliers.find((s) => s.dbId === dbId);

  if (view.t === "montar")
    return <MontarPedidos products={products} store={store} suppliers={suppliers} pedidos={pedidos} onSalvar={onSalvar} onEnviado={onEnviado} onVoltar={() => setView({ t: "lista" })} />;
  const sel = view.t === "detalhe" ? pedidos.find((p) => p.id === view.id) : undefined;
  if (sel)
    return <DetalhePedido pedido={sel} products={products} store={store} fornecedor={fornecedorDe(sel.fornecedorId)} onEnviado={onEnviado} onCancelar={onCancelar} onNovoLink={onNovoLink}
      onOpenProduto={onOpenProduto} onVoltar={() => setView({ t: "lista" })} />;

  const abertos = pedidos.filter(pedidoAberto);
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button type="button" onClick={() => setView({ t: "montar" })} className={`flex w-full items-center justify-center gap-2 ${btnPrimary(true)}`}><Plus size={20} /> Novo pedido</button>
      {pedidos.length > 0 && (
        <p className="text-sm text-muted-foreground">{abertos.length === 0 ? "Nenhum pedido em andamento." : abertos.length === 1 ? "1 pedido em andamento." : `${abertos.length} pedidos em andamento.`}</p>
      )}
      {!pedidos.length && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-4 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/60 text-primary"><ClipboardList size={30} /></span>
          <p className="text-base font-bold">Nenhum pedido ainda</p>
          <p className="text-sm text-muted-foreground">Toque em "Novo pedido": o app separa por fornecedor o que chegou ao mínimo e já sugere quanto comprar.</p>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {pedidos.map((p) => {
          const f = fornecedorDe(p.fornecedorId);
          return (
            <li key={p.id}>
              <button type="button" onClick={() => setView({ t: "detalhe", id: p.id })}
                className="flex w-full flex-col gap-2 rounded-3xl border border-border bg-secondary/60 p-4 text-left transition hover:border-primary">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-base font-bold">Pedido nº {p.numero}</span>
                    <span className="block break-words text-sm text-muted-foreground">{f?.nome ?? "Fornecedor"}</span>
                  </span>
                  <Etiqueta s={p.situacao} />
                </span>
                <span className="text-sm text-muted-foreground">
                  {p.enviadoEm ? `Enviado em ${dataCurta(p.enviadoEm)}${p.canal ? ` ${CANAL_TXT[p.canal]}` : ""}` : `Criado em ${dataCurta(p.criadoEm)}`}
                  {` · ${p.itens.length === 1 ? "1 produto" : `${p.itens.length} produtos`} · ${brl(totalPedido(p))}`}
                </span>
                {p.resposta && (p.situacao === "aceito" || p.situacao === "aceito_ajustes") && resumoResposta(p.resposta, brl) && (
                  <span className="flex items-start gap-1.5 text-sm font-semibold text-accent"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {resumoResposta(p.resposta, brl)}</span>
                )}
                {p.situacao === "recusado" && <span className="flex items-start gap-1.5 text-sm font-semibold text-destructive"><XCircle size={16} className="mt-0.5 shrink-0" /> O fornecedor não pode atender</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Etiqueta({ s }: { s: SituacaoPedido }) {
  return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${COR_SITUACAO[s]}`}>{SITUACAO_TXT[s]}</span>;
}

/* ---------- montar ---------- */
type Grupo = { fornecedorId: number; linhas: LinhaPedido[]; obs: string };

function MontarPedidos({ products, store, suppliers, pedidos, onSalvar, onEnviado, onVoltar }: {
  products: Product[]; store: StoreData; suppliers: Supplier[]; pedidos: Pedido[]; onSalvar: SalvarPedido;
  onEnviado: (id: string, canal: CanalPedido) => Promise<unknown>; onVoltar: () => void;
}) {
  const jaPedidos = useMemo(() => new Set(pedidos.filter(pedidoAberto).flatMap((p) => p.itens.map((i) => i.produtoId))), [pedidos]);
  const sug = useMemo(() => sugerirPedido(products, suppliers, jaPedidos), [products, suppliers, jaPedidos]);
  const [grupos, setGrupos] = useState<Grupo[]>(() => [...sug.porFornecedor.entries()].map(([fornecedorId, linhas]) => ({ fornecedorId, linhas, obs: "" })));
  const [enviados, setEnviados] = useState<number[]>([]);
  const outros = suppliers.filter((s) => !grupos.some((g) => g.fornecedorId === s.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const nPedidos = products.filter((p) => p.db?.id && jaPedidos.has(p.db.id)).length;
  const muda = (id: number, f: (g: Grupo) => Grupo) => setGrupos((gs) => gs.map((g) => (g.fornecedorId === id ? f(g) : g)));

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button type="button" onClick={onVoltar} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Pedidos</button>
      <div>
        <h2 className="text-xl font-bold">Novo pedido</h2>
        <p className="text-sm text-muted-foreground">
          {grupos.length ? "Separamos o que chegou ao mínimo no estoque, por fornecedor, com a quantidade para voltar ao máximo. Confira e ajuste." : "Nenhum produto chegou ao mínimo. Escolha um fornecedor para montar um pedido."}
        </p>
        {nPedidos > 0 && <p className="mt-1 text-xs text-muted-foreground">{nPedidos === 1 ? "1 produto já está" : `${nPedidos} produtos já estão`} num pedido em andamento e não {nPedidos === 1 ? "foi sugerido" : "foram sugeridos"} de novo.</p>}
      </div>

      {enviados.length > 0 && <p className="flex items-center gap-2 rounded-2xl border border-accent/50 bg-accent/10 p-3 text-sm font-semibold text-accent"><Check size={18} /> {enviados.length === 1 ? "1 pedido salvo." : `${enviados.length} pedidos salvos.`} Veja na lista de pedidos.</p>}

      {grupos.map((g) => {
        const s = suppliers.find((x) => x.id === g.fornecedorId);
        if (!s) return null;
        return (
          <GrupoFornecedor key={g.fornecedorId} fornecedor={s} grupo={g} products={products} store={store} onSalvar={onSalvar} onEnviado={onEnviado}
            onMudar={(f) => muda(g.fornecedorId, f)} onRemover={() => setGrupos((gs) => gs.filter((x) => x.fornecedorId !== g.fornecedorId))}
            onConcluido={() => { setEnviados((e) => [...e, g.fornecedorId]); setGrupos((gs) => gs.filter((x) => x.fornecedorId !== g.fornecedorId)); }} />
        );
      })}

      {sug.semFornecedor.length > 0 && (
        <section aria-label="Sem fornecedor" className="rounded-3xl border border-dashed border-border p-4">
          <p className="text-base font-bold">Sem fornecedor</p>
          <p className="text-sm text-muted-foreground">Estes produtos precisam de compra, mas não têm fornecedor. Abra o produto, toque em Editar e escolha o fornecedor.</p>
          <ul className="mt-2 space-y-1 text-sm">{sug.semFornecedor.map((p) => <li key={p.id}>• {p.nome}</li>)}</ul>
        </section>
      )}

      {outros.length > 0 && (
        <label className="block space-y-1">
          <span className="text-sm font-medium text-muted-foreground">Pedir de {grupos.length ? "outro " : ""}fornecedor</span>
          <select value="" onChange={(e) => { const id = Number(e.target.value); if (id) setGrupos((gs) => [...gs, { fornecedorId: id, linhas: [], obs: "" }]); }}
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground">
            <option value="">Escolha o fornecedor…</option>
            {outros.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </label>
      )}
      {!suppliers.length && <p className="text-sm text-muted-foreground">Cadastre um fornecedor na aba Fornecedores para fazer pedidos.</p>}
    </div>
  );
}

function GrupoFornecedor({ fornecedor, grupo, products, store, onSalvar, onEnviado, onMudar, onRemover, onConcluido }: {
  fornecedor: Supplier; grupo: Grupo; products: Product[]; store: StoreData; onSalvar: SalvarPedido;
  onEnviado: (id: string, canal: CanalPedido) => Promise<unknown>; onMudar: (f: (g: Grupo) => Grupo) => void; onRemover: () => void; onConcluido: () => void;
}) {
  const [adicionar, setAdicionar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState<{ id: string; numero: number; token?: string | undefined } | null>(null);
  const total = totalLinhas(grupo.linhas);
  const salvar = async () => {
    if (salvando || !grupo.linhas.length) return;
    setSalvando(true); setErro("");
    try { setSalvo(await onSalvar({ fornecedor, linhas: grupo.linhas, observacao: grupo.obs })); }
    catch (e) { setErro(String((e as { message?: string })?.message ?? "Não foi possível salvar o pedido.")); }
    finally { setSalvando(false); }
  };
  return (
    <section aria-label={fornecedor.nome} className="rounded-3xl border border-border bg-secondary/60 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Truck size={20} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-bold leading-snug">{fornecedor.nome}</h3>
          <p className="text-sm text-muted-foreground">{grupo.linhas.length === 1 ? "1 produto" : `${grupo.linhas.length} produtos`} · estimado {brl(total)}</p>
        </div>
        <button type="button" onClick={onRemover} aria-label={`Tirar ${fornecedor.nome} deste pedido`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"><X size={18} /></button>
      </div>

      <ul className="mt-3 space-y-2">
        {grupo.linhas.map((l) => (
          <li key={l.chave}>
            <EditorLinha l={l} onMudar={(n) => onMudar((g) => ({ ...g, linhas: g.linhas.map((x) => (x.chave === l.chave ? n : x)) }))}
              onRemover={() => onMudar((g) => ({ ...g, linhas: g.linhas.filter((x) => x.chave !== l.chave) }))} />
          </li>
        ))}
      </ul>
      {!grupo.linhas.length && <p className="mt-3 rounded-2xl bg-background-deep/50 px-3 py-4 text-center text-sm text-muted-foreground">Nenhum produto ainda.</p>}
      <button type="button" onClick={() => setAdicionar(true)} className="mt-2 flex min-h-12 w-full items-center gap-2 rounded-2xl border-2 border-dashed border-accent/70 px-4 text-base font-semibold text-accent"><Plus size={18} /> Adicionar produto</button>

      <label className="mt-3 block space-y-1">
        <span className="text-sm font-medium text-muted-foreground">Recado para o fornecedor (opcional)</span>
        <textarea value={grupo.obs} maxLength={500} rows={2} onChange={(e) => onMudar((g) => ({ ...g, obs: e.target.value }))} placeholder="Ex.: entregar pela manhã"
          className="w-full rounded-2xl border border-border bg-background-deep/60 px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary" />
      </label>

      {erro && <p role="alert" className="mt-2 text-sm font-semibold text-destructive">{erro}</p>}
      <button type="button" disabled={!grupo.linhas.length || salvando} onClick={salvar} className={`mt-3 flex w-full items-center justify-center gap-2 ${btnPrimary(!!grupo.linhas.length && !salvando)}`}>
        <Send size={18} /> {salvando ? "Salvando…" : "Salvar e enviar"}
      </button>
      <p className="mt-1 text-center text-xs text-muted-foreground">Total estimado {brl(total)}, pelo último preço de compra.</p>

      {adicionar && (
        <AdicionarProduto products={products.filter((p) => p.fornecedor === fornecedor.id)} todos={products} jaNoPedido={new Set(grupo.linhas.map((l) => l.chave))}
          onClose={() => setAdicionar(false)} onEscolher={(l) => { onMudar((g) => ({ ...g, linhas: [...g.linhas, l] })); setAdicionar(false); }} />
      )}
      {salvo && (
        <EnviarSheet numero={salvo.numero} fornecedor={fornecedor} texto={textoPedido({ numero: salvo.numero, comercio: store, fornecedor: fornecedor.nome, linhas: grupo.linhas, observacao: grupo.obs, link: salvo.token ? linkPedido(salvo.token) : undefined })}
          novo onCanal={(c) => onEnviado(salvo.id, c)} onClose={() => { setSalvo(null); onConcluido(); }} />
      )}
    </section>
  );
}

function EditorLinha({ l, onMudar, onRemover }: { l: LinhaPedido; onMudar: (l: LinhaPedido) => void; onRemover: () => void }) {
  const passo = l.embalagem ? 1 : aceitaFracao(l.p.unidade) ? 0.5 : 1;
  const embs = l.variacao ? [] : l.p.embalagens ?? [];
  const dep = l.variacao ? l.p.deposito?.vars?.[l.variacao.uid ?? ""] : l.p.deposito;
  const mudarQtd = (q: number) => onMudar({ ...l, qtd: Math.max(passo, Math.round(q * 1000) / 1000) });
  return (
    <div className="rounded-2xl bg-background-deep/50 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold leading-snug">{nomeLinha(l)}</p>
          {dep && <p className="text-xs text-muted-foreground">Tem {dep.qtd == null ? "—" : qtdUn(dep.qtd, l.p.unidade)}{dep.min != null ? ` · mín. ${fmtQ(dep.min)}` : ""}{dep.max != null ? ` · máx. ${fmtQ(dep.max)}` : ""}</p>}
        </div>
        <button type="button" onClick={onRemover} aria-label={`Tirar ${nomeLinha(l)}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-destructive"><Trash2 size={17} /></button>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex shrink-0 items-center rounded-2xl border border-border">
          <button type="button" aria-label="Diminuir" onClick={() => mudarQtd(l.qtd - passo)} className="flex h-11 w-11 items-center justify-center text-primary"><Minus size={18} /></button>
          <input aria-label={`Quantidade de ${nomeLinha(l)}`} inputMode={passo < 1 ? "decimal" : "numeric"} value={fmtQ(l.qtd)}
            onChange={(e) => { const n = Number(e.target.value.replace(/\./g, "").replace(",", ".")); if (Number.isFinite(n) && n > 0) mudarQtd(l.embalagem ? Math.round(n) : n); }}
            className="h-11 w-14 bg-transparent text-center text-base font-bold tabular-nums outline-none" />
          <button type="button" aria-label="Aumentar" onClick={() => mudarQtd(l.qtd + passo)} className="flex h-11 w-11 items-center justify-center text-primary"><Plus size={18} /></button>
        </div>
        <p className="min-w-0 text-xs text-muted-foreground">= {qtdUn(unidadesDaLinha(l), l.p.unidade)}<span className="block">{brl(totalLinha(l))}</span></p>
      </div>
      {embs.length > 0 && (
          <select aria-label={`Embalagem de ${nomeLinha(l)}`} value={l.embalagem?.uid ?? ""}
            onChange={(e) => { const emb = embs.find((x) => x.uid === e.target.value) ?? null; onMudar({ ...l, embalagem: emb, qtd: emb ? Math.max(1, Math.round(l.qtd)) : l.qtd }); }}
            className="mt-2 h-11 w-full rounded-2xl border border-border bg-background-deep/60 px-3 text-sm text-foreground">
            {embs.map((e) => <option key={e.uid} value={e.uid}>{descricaoEmbalagem(e, l.p.unidade)}</option>)}
            <option value="">{`Por ${l.p.unidade === "Unidade" ? "unidade" : unPlural(l.p.unidade).replace(/s$/, "")} (avulso)`}</option>
          </select>
      )}
    </div>
  );
}

function AdicionarProduto({ products, todos, jaNoPedido, onClose, onEscolher }: {
  products: Product[]; todos: Product[]; jaNoPedido: Set<string>; onClose: () => void; onEscolher: (l: LinhaPedido) => void;
}) {
  const [q, setQ] = useState("");
  const [todosForn, setTodosForn] = useState(false);
  const base = (todosForn ? todos : products).filter((p) => p.db?.id);
  const t = q.trim().toLowerCase();
  const opcoes = base.flatMap((p): { p: Product; v: Variation | null }[] => (p.variacoes.length && p.deposito?.vars ? p.variacoes.map((v) => ({ p, v })) : [{ p, v: null }]))
    .filter(({ p, v }) => !jaNoPedido.has(chaveLinha(p, v)) && (!t || p.nome.toLowerCase().includes(t) || p.codigo.includes(t)))
    .sort((a, b) => a.p.nome.localeCompare(b.p.nome, "pt-BR"));
  return (
    <Sheet title="Adicionar produto" onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        <label className="relative block">
          <span className="sr-only">Buscar produto</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou código"
            className="h-12 w-full rounded-2xl border border-border bg-background-deep/60 pl-11 pr-4 text-base text-foreground outline-none focus-visible:border-primary" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={todosForn} onChange={(e) => setTodosForn(e.target.checked)} className="h-5 w-5 accent-primary" />
          Mostrar produtos de outros fornecedores também
        </label>
        {!opcoes.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum produto para adicionar.</p>}
        <ul className="divide-y divide-border">
          {opcoes.map(({ p, v }) => (
            <li key={chaveLinha(p, v)}>
              <button type="button" onClick={() => onEscolher(linhaManual(p, v))} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left">
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold">{v ? `${p.nome} — ${v.tam} · ${v.cor}` : p.nome}</span>
                  <span className="block text-xs text-muted-foreground">Cód. {p.codigo}</span>
                </span>
                <Plus size={18} className="shrink-0 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

/** Depois de salvar (ou para reenviar): escolher como mandar. Marca o canal no banco ao tocar. */
function EnviarSheet({ numero, fornecedor, texto, novo, onCanal, onClose }: {
  numero: number; fornecedor: Supplier | undefined; texto: string; novo?: boolean; onCanal: (c: CanalPedido) => Promise<unknown>; onClose: () => void;
}) {
  const [usado, setUsado] = useState<CanalPedido | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");
  const wa = fornecedor ? linkWhatsApp(fornecedor.tel, texto) : "";
  const mail = fornecedor?.email ? `mailto:${fornecedor.email}?subject=${encodeURIComponent(`Pedido nº ${numero}`)}&body=${encodeURIComponent(texto)}` : "";
  const marcar = (c: CanalPedido) => { setUsado(c); setErro(""); onCanal(c).catch(() => setErro("O pedido foi aberto, mas não conseguimos marcar como enviado. Tente de novo.")); };
  return (
    <Sheet title={novo ? `Pedido nº ${numero} salvo` : `Enviar pedido nº ${numero}`} onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        {novo && <p className="flex items-center gap-2 text-sm font-semibold text-accent"><Check size={18} /> Salvo. Agora escolha como mandar para {fornecedor?.nome ?? "o fornecedor"}.</p>}
        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-background-deep/60 p-3 font-sans text-sm">{texto}</pre>
        <div className="grid grid-cols-1 gap-2">
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => marcar("whatsapp")} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><MessageCircle size={18} /> Enviar pelo WhatsApp</a>
          ) : <p className="text-xs text-warning">Sem WhatsApp cadastrado para este fornecedor. Informe na aba Fornecedores.</p>}
          {mail && <a href={mail} onClick={() => marcar("email")} className={`flex items-center justify-center gap-2 ${btnGhost}`}><Mail size={18} /> Enviar por e-mail</a>}
          <button type="button" className={`flex items-center justify-center gap-2 ${btnGhost}`}
            onClick={() => { void navigator.clipboard?.writeText(texto).then(() => setCopiado(true)).catch(() => setCopiado(false)); marcar("copiado"); }}>
            <Copy size={18} /> {copiado ? "Texto copiado!" : "Copiar texto"}
          </button>
        </div>
        {usado && !erro && <p className="text-sm text-muted-foreground">Marcado como enviado {CANAL_TXT[usado]}.</p>}
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
      </div>
      <div className="px-5 pt-2"><button type="button" onClick={onClose} className={`w-full ${btnGhost}`}>{usado ? "Pronto" : "Enviar depois"}</button></div>
    </Sheet>
  );
}

/* ---------- detalhe ---------- */
function DetalhePedido({ pedido, products, store, fornecedor, onEnviado, onCancelar, onNovoLink, onOpenProduto, onVoltar }: {
  pedido: Pedido; products: Product[]; store: StoreData; fornecedor: Supplier | undefined;
  onEnviado: (id: string, canal: CanalPedido) => Promise<unknown>; onCancelar: (id: string) => Promise<unknown>; onNovoLink: (id: string) => Promise<string>;
  onOpenProduto: (p: Product) => void; onVoltar: () => void;
}) {
  const linhas = useMemo(() => linhasDoPedido(pedido, products), [pedido, products]);
  const [enviar, setEnviar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [trocar, setTrocar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const link = linkPedido(pedido.token);
  const texto = textoPedido({ numero: pedido.numero, comercio: store, fornecedor: fornecedor?.nome ?? "fornecedor", linhas, observacao: pedido.observacao, link });
  const r = pedido.resposta;
  const aceito = pedido.situacao === "aceito" || pedido.situacao === "aceito_ajustes";
  const recusado = pedido.situacao === "recusado";
  return (
    <div className="mx-auto max-w-[560px] space-y-4 animate-in fade-in slide-in-from-right-8 duration-300">
      <button type="button" onClick={onVoltar} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Pedidos</button>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold">Pedido nº {pedido.numero}</h2>
          <p className="break-words text-sm text-muted-foreground">{fornecedor?.nome ?? "Fornecedor"}</p>
          <p className="text-sm text-muted-foreground">{pedido.enviadoEm ? `Enviado em ${dataCurta(pedido.enviadoEm)}${pedido.canal ? ` ${CANAL_TXT[pedido.canal]}` : ""}` : "Ainda não enviado"}</p>
        </div>
        <Etiqueta s={pedido.situacao} />
      </header>

      {r && (aceito || recusado) && (
        <section aria-label="Resposta do fornecedor" className={`rounded-3xl border p-4 ${recusado ? "border-destructive/50 bg-destructive/10" : "border-accent/50 bg-accent/10"}`}>
          <p className={`flex items-center gap-2 text-base font-bold ${recusado ? "text-destructive" : "text-accent"}`}>
            {recusado ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
            {recusado ? "O fornecedor não pode atender" : pedido.situacao === "aceito_ajustes" ? "Aceito, com mudanças nos produtos" : "O fornecedor aceitou o pedido"}
          </p>
          <p className="text-xs text-muted-foreground">Respondido em {new Date(r.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
          {aceito && (
            <dl className="mt-3 space-y-1.5 text-sm">
              {r.previsaoEntrega && <Dado t="Entrega prevista" v={dataEntregaTexto(r.previsaoEntrega)} />}
              <Dado t="Valor total" v={r.valorTotal != null ? brl(r.valorTotal) : "Não informado"} />
              <Dado t="Pagamento" v={formaTexto(r.forma, r.prazoDias) || "Não informado"} />
            </dl>
          )}
          {r.recado && <p className="mt-2 text-sm"><span className="block text-xs text-muted-foreground">Recado do fornecedor</span>{r.recado}</p>}
          {recusado && !pedidoFechado(pedido) && <p className="mt-2 text-sm text-muted-foreground">Você pode cancelar este pedido e pedir para outro fornecedor.</p>}
        </section>
      )}

      <section aria-label="Produtos do pedido" className="rounded-3xl border border-border bg-secondary/60 p-4">
        <ul className="divide-y divide-border">
          {linhas.map((l, k) => {
            const item = pedido.itens[k];
            const s = aceito && item ? respostaItem(item.qtdEmbalagens, item.qtdConfirmada) : null;
            return (
              <li key={l.chave}>
                <button type="button" disabled={l.p.id < 0} onClick={() => onOpenProduto(l.p)} className="flex w-full items-start justify-between gap-3 py-2.5 text-left">
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold">{nomeLinha(l)}</span>
                    <span className="block text-xs text-muted-foreground">{s && s !== "tudo" ? "Pedido: " : ""}{quantidadeTexto(l)}</span>
                    {s === "tudo" && <span className="block text-xs font-semibold text-accent">Confirmado</span>}
                    {s === "parte" && <span className="block text-xs font-semibold text-warning">Vai mandar {quantidadeTexto({ ...l, qtd: item!.qtdConfirmada! })}</span>}
                    {s === "nada" && <span className="block text-xs font-semibold text-destructive">O fornecedor não tem</span>}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">{brl(totalLinha(l))}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-bold"><span>Total estimado</span><span>{brl(totalPedido(pedido))}</span></p>
        {pedido.observacao && <p className="mt-2 text-sm text-muted-foreground">Seu recado: {pedido.observacao}</p>}
      </section>

      {pedido.situacao === "enviado" && <p className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">Aguardando a resposta do fornecedor. Ele responde pelo link que foi junto na mensagem, e a resposta aparece aqui.</p>}

      {!pedidoFechado(pedido) && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button type="button" onClick={() => setEnviar(true)} className={`flex items-center justify-center gap-2 ${r ? btnGhost : btnPrimary(true)}`}><Send size={18} /> {pedido.situacao === "rascunho" ? "Enviar" : "Enviar de novo"}</button>
          {!confirmar ? (
            <button type="button" onClick={() => setConfirmar(true)} className={`flex items-center justify-center gap-2 ${btnGhost}`}><X size={18} /> Cancelar pedido</button>
          ) : (
            <button type="button" onClick={() => { setErro(""); onCancelar(pedido.id).then(() => setConfirmar(false)).catch((e) => setErro(String(e?.message ?? "Não foi possível cancelar."))); }}
              className="flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-destructive/60 px-4 text-base font-semibold text-destructive">Confirmar cancelamento</button>
          )}
        </div>
      )}
      {confirmar && <p className="text-sm text-muted-foreground">Avise o fornecedor que o pedido foi cancelado.</p>}

      {!pedidoFechado(pedido) && (
        <section aria-label="Link do fornecedor" className="rounded-3xl border border-border p-4">
          <p className="flex items-center gap-2 text-base font-bold"><Link2 size={18} className="text-primary" /> Link do fornecedor</p>
          <p className="text-sm text-muted-foreground">O fornecedor abre este link no celular ou no computador para confirmar o pedido. Ele já vai junto na mensagem.</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" className={`flex items-center justify-center gap-2 ${btnGhost}`}
              onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopiado(true)).catch(() => setCopiado(false)); }}>
              <Copy size={18} /> {copiado ? "Link copiado!" : "Copiar link"}
            </button>
            {!trocar ? (
              <button type="button" onClick={() => { setTrocar(true); setAviso(""); }} className={`flex items-center justify-center gap-2 ${btnGhost}`}><RefreshCw size={18} /> Gerar novo link</button>
            ) : (
              <button type="button" className="flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-warning/60 px-4 text-base font-semibold text-warning"
                onClick={() => { setErro(""); onNovoLink(pedido.id).then(() => { setTrocar(false); setCopiado(false); setAviso("Novo link criado. O antigo parou de funcionar: envie o pedido de novo."); }).catch((e) => setErro(String(e?.message ?? "Não foi possível gerar o novo link."))); }}>
                Confirmar novo link
              </button>
            )}
          </div>
          {trocar && <p className="mt-2 text-sm text-muted-foreground">Use se o link foi para a pessoa errada. O link antigo para de funcionar e você precisa enviar o pedido de novo.</p>}
          {aviso && <p role="status" className="mt-2 text-sm font-semibold text-accent">{aviso}</p>}
        </section>
      )}
      {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
      {enviar && <EnviarSheet numero={pedido.numero} fornecedor={fornecedor} texto={texto} onCanal={(c) => onEnviado(pedido.id, c)} onClose={() => setEnviar(false)} />}
    </div>
  );
}

function Dado({ t, v }: { t: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t}</dt><dd className="text-right font-semibold">{v}</dd></div>;
}
