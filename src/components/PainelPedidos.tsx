import { formatarCentavos as brl } from "@/lib/formatacao";
import { useHoje } from "@/hooks/useHoje";
import type { EntityId } from "@/lib/identidade";
/* Aba Pedidos (D2a): montar o pedido sozinho por fornecedor, enviar pelo WhatsApp ou e-mail com um toque e acompanhar. */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Banknote, PackageCheck, CalendarClock, Check, CheckCircle2, ClipboardList, Copy, Link2, Mail, MessageCircle, Minus, Plus, RefreshCw, Search, Send, Trash2, Truck, X, XCircle } from "lucide-react";
import { Sheet } from "@/components/parts/Sheet";
import { type Product, type Supplier, type Variation } from "@/components/ProductArea";
import { linkWhatsApp } from "@/components/PainelFornecedores";
import { btnGhost, btnPrimary, type StoreData } from "@/components/StoreSetup";
import { aceitaFracao, fmtQ, qtdUn, unPlural } from "@/lib/deposito";
import { descricaoEmbalagem } from "@/lib/embalagem";
import { estadoPagamento, ordemPagamento, resumoPagamentos, somaDias, textoPagamento, valorConta, type EstadoPagamento } from "@/lib/pagamento";
import { hojeEm } from "@/lib/validade";
import { precisaDecidir, resultadoItem, resumoRecebimento, type ItemRecebido, type Recebimento, type TipoResultado } from "@/lib/recebimento";
import {
  CANAL_TXT, SITUACAO_TXT, chaveLinha, dataEntregaTexto, formaTexto, linkPedido, respostaItem, resumoResposta, linhaManual, linhasDoPedido, nomeLinha, pedidoAberto, pedidoFechado, quantidadeTexto,
  sugerirPedido, textoPedido, totalLinha, totalLinhas, totalPedido, unidadesDaLinha, type CanalPedido, type LinhaPedido, type Pedido, type SituacaoPedido,
} from "@/lib/pedido";

const dataCurta = (ts: string) => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const COR_SITUACAO: Record<SituacaoPedido, string> = {
  rascunho: "border-border text-muted-foreground", enviado: "border-warning/60 text-warning", aceito: "border-accent/60 text-accent",
  aceito_ajustes: "border-accent/60 text-accent", recusado: "border-destructive/60 text-destructive", recebido_parcial: "border-primary/60 text-primary",
  recebido: "border-primary/60 text-primary", cancelado: "border-border text-muted-foreground line-through",
};

export type DadosPagamento = { situacao: "a_pagar" | "pago"; vencimento?: string | null; pagoEm?: string | null; valor?: number | null };
const COR_PAGAMENTO: Record<EstadoPagamento, string> = {
  atrasado: "text-destructive", hoje: "text-warning", em_breve: "text-warning", a_pagar: "text-foreground", pago: "text-accent",
};
export type SalvarPedido = (a: { fornecedor: Supplier; linhas: LinhaPedido[]; observacao: string }) => Promise<{ id: string; numero: number; token?: string | undefined; recuperado?: boolean }>;

export function PainelPedidos({ products, store, suppliers, pedidos, montarAgora = false, soAPagar = false, onSalvar, onEnviado, onCancelar, onNovoLink, onPagamento, onOpenProduto, onResolverRecebimento, onCarregarSemPedido }: {
  products: Product[]; store: StoreData; suppliers: Supplier[]; pedidos: Pedido[]; montarAgora?: boolean; soAPagar?: boolean;
  onSalvar: SalvarPedido; onEnviado: (id: string, canal: CanalPedido) => Promise<unknown>; onCancelar: (id: string) => Promise<unknown>;
  onNovoLink: (id: string) => Promise<string>; onPagamento: (id: string, d: DadosPagamento) => Promise<unknown>; onOpenProduto: (p: Product) => void;
  /** Dono decide um item recebido (E2). */ onResolverRecebimento?: ((itemId: string, acao: "aceitar" | "recusar", tentativa: number | null) => Promise<unknown>) | undefined;
  /** Entregas que chegaram sem pedido (E2). */ onCarregarSemPedido?: (() => Promise<Recebimento[]>) | undefined;
}) {
  const hoje = useHoje();
  const [filtro, setFiltro] = useState<"todos" | "pagar">(soAPagar ? "pagar" : "todos");
  const [view, setView] = useState<{ t: "lista" } | { t: "montar" } | { t: "detalhe"; id: string }>(montarAgora ? { t: "montar" } : { t: "lista" });
  const fornecedorDe = (dbId: string) => suppliers.find((s) => s.dbId === dbId);

  if (view.t === "montar")
    return <MontarPedidos products={products} store={store} suppliers={suppliers} pedidos={pedidos} onSalvar={onSalvar} onEnviado={onEnviado} onVoltar={() => setView({ t: "lista" })} />;
  const sel = view.t === "detalhe" ? pedidos.find((p) => p.id === view.id) : undefined;
  if (sel)
    return <DetalhePedido pedido={sel} products={products} store={store} fornecedor={fornecedorDe(sel.fornecedorId)} onEnviado={onEnviado} onCancelar={onCancelar} onNovoLink={onNovoLink} onPagamento={onPagamento} hoje={hoje}
      onResolver={onResolverRecebimento} onOpenProduto={onOpenProduto} onVoltar={() => setView({ t: "lista" })} />;

  const abertos = pedidos.filter(pedidoAberto);
  const contas = resumoPagamentos(pedidos, hoje);
  const lista = filtro === "pagar" ? pedidos.filter((p) => p.pagamento?.situacao === "a_pagar").sort(ordemPagamento) : pedidos;
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button type="button" onClick={() => setView({ t: "montar" })} className={`flex w-full items-center justify-center gap-2 ${btnPrimary(true)}`}><Plus size={20} /> Novo pedido</button>
      {pedidos.length > 0 && (
        <p className="text-sm text-muted-foreground">{abertos.length === 0 ? "Nenhum pedido em andamento." : abertos.length === 1 ? "1 pedido em andamento." : `${abertos.length} pedidos em andamento.`}</p>
      )}
      {contas.aPagar.n > 0 && (
        <section aria-label="Contas a pagar" className="rounded-3xl border border-border bg-secondary/60 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Banknote size={18} className="text-primary" /> Contas a pagar</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{brl(contas.aPagar.total)}</p>
          <p className="text-sm text-muted-foreground">{contas.aPagar.n === 1 ? "1 pedido" : `${contas.aPagar.n} pedidos`}{contas.esteMes.n && contas.esteMes.total !== contas.aPagar.total ? ` · ${brl(contas.esteMes.total)} este mês` : ""}</p>
          <ul className="mt-2 space-y-1 text-sm font-semibold">
            {contas.atrasados.n > 0 && <li className="text-destructive">{contas.atrasados.n === 1 ? "1 atrasado" : `${contas.atrasados.n} atrasados`} · {brl(contas.atrasados.total)}</li>}
            {contas.hoje.n > 0 && <li className="text-warning">{contas.hoje.n === 1 ? "1 vence hoje" : `${contas.hoje.n} vencem hoje`} · {brl(contas.hoje.total)}</li>}
            {contas.semana.n > 0 && <li className="text-warning">{contas.semana.n === 1 ? "1 vence nos próximos 7 dias" : `${contas.semana.n} vencem nos próximos 7 dias`} · {brl(contas.semana.total)}</li>}
          </ul>
          {contas.pagoEsteMes.n > 0 && <p className="mt-2 text-xs text-muted-foreground">Pago este mês: {brl(contas.pagoEsteMes.total)}</p>}
          <div role="group" aria-label="Mostrar" className="mt-3 grid grid-cols-2 gap-2">
            {([["todos", "Todos os pedidos"], ["pagar", `Só a pagar (${contas.aPagar.n})`]] as const).map(([f, t]) => (
              <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)}
                className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${filtro === f ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>{t}</button>
            ))}
          </div>
        </section>
      )}
      {!pedidos.length && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-4 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/60 text-primary"><ClipboardList size={30} /></span>
          <p className="text-base font-bold">Nenhum pedido ainda</p>
          <p className="text-sm text-muted-foreground">Toque em "Novo pedido": o app separa por fornecedor o que chegou ao mínimo e já sugere quanto comprar.</p>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {lista.map((p) => {
          const f = fornecedorDe(p.fornecedorId);
          const pg = estadoPagamento(p, hoje);
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
                {p.recebimento && (() => { const rr = resumoRecebimento(p.recebimento); return (
                  <span className={`flex items-start gap-1.5 text-sm font-semibold ${rr.alerta === "decidir" ? "text-destructive" : rr.alerta ? "text-warning" : "text-accent"}`}>
                    <PackageCheck size={16} className="mt-0.5 shrink-0" /> {rr.texto}
                  </span>); })()}
                {pg && (
                  <span className={`flex items-start gap-1.5 text-sm font-semibold ${COR_PAGAMENTO[pg.estado]}`}>
                    <Banknote size={16} className="mt-0.5 shrink-0" /> {pg.estado === "pago" ? "" : `A pagar ${brl(valorConta(p).valor)} · `}{textoPagamento(p, hoje)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {onCarregarSemPedido && <EntregasSemPedido carregar={onCarregarSemPedido} products={products} suppliers={suppliers} />}
    </div>
  );
}

function Etiqueta({ s }: { s: SituacaoPedido }) {
  return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${COR_SITUACAO[s]}`}>{SITUACAO_TXT[s]}</span>;
}

/* ---------- montar ---------- */
type Grupo = { fornecedorId: EntityId; linhas: LinhaPedido[]; obs: string };

function MontarPedidos({ products, store, suppliers, pedidos, onSalvar, onEnviado, onVoltar }: {
  products: Product[]; store: StoreData; suppliers: Supplier[]; pedidos: Pedido[]; onSalvar: SalvarPedido;
  onEnviado: (id: string, canal: CanalPedido) => Promise<unknown>; onVoltar: () => void;
}) {
  const jaPedidos = useMemo(() => new Set(pedidos.filter(pedidoAberto).flatMap((p) => p.itens.map((i) => i.produtoId))), [pedidos]);
  const sug = useMemo(() => sugerirPedido(products, suppliers, jaPedidos), [products, suppliers, jaPedidos]);
  const [grupos, setGrupos] = useState<Grupo[]>(() => [...sug.porFornecedor.entries()].map(([fornecedorId, linhas]) => ({ fornecedorId, linhas, obs: "" })));
  const [enviados, setEnviados] = useState<EntityId[]>([]);
  const outros = suppliers.filter((s) => !grupos.some((g) => g.fornecedorId === s.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const nPedidos = products.filter((p) => p.db?.id && jaPedidos.has(p.db.id)).length;
  const muda = (id: EntityId, f: (g: Grupo) => Grupo) => setGrupos((gs) => gs.map((g) => (g.fornecedorId === id ? f(g) : g)));

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
          <select value="" onChange={(e) => { const id = suppliers.find((s) => String(s.id) === e.target.value)?.id; if (id != null) setGrupos((gs) => [...gs, { fornecedorId: id, linhas: [], obs: "" }]); }}
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
    try {
      const r = await onSalvar({ fornecedor, linhas: grupo.linhas, observacao: grupo.obs });
      // O envio recuperado pode ter outro conteúdo. O texto atual não representa aquele pedido.
      if (r.recuperado) onConcluido();
      else setSalvo(r);
    }
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
function DetalhePedido({ pedido, products, store, fornecedor, hoje, onEnviado, onCancelar, onNovoLink, onPagamento, onResolver, onOpenProduto, onVoltar }: {
  pedido: Pedido; products: Product[]; store: StoreData; fornecedor: Supplier | undefined;
  onEnviado: (id: string, canal: CanalPedido) => Promise<unknown>; onCancelar: (id: string) => Promise<unknown>; onNovoLink: (id: string) => Promise<string>;
  onPagamento: (id: string, d: DadosPagamento) => Promise<unknown>; hoje: string; onOpenProduto: (p: Product) => void; onVoltar: () => void;
  onResolver?: ((itemId: string, acao: "aceitar" | "recusar", tentativa: number | null) => Promise<unknown>) | undefined;
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

      {pedido.recebimento && <RecebimentoPedido rec={pedido.recebimento} products={products} onResolver={onResolver} />}

      <PagamentoPedido pedido={pedido} hoje={hoje} onPagamento={(d) => onPagamento(pedido.id, d)} />

      <section aria-label="Produtos do pedido" className="rounded-3xl border border-border bg-secondary/60 p-4">
        <ul className="divide-y divide-border">
          {linhas.map((l, k) => {
            const item = pedido.itens[k];
            const s = aceito && item ? respostaItem(item.qtdEmbalagens, item.qtdConfirmada) : null;
            return (
              <li key={l.chave}>
                <button type="button" disabled={!l.p.db?.id} onClick={() => onOpenProduto(l.p)} className="flex w-full items-start justify-between gap-3 py-2.5 text-left">
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

      {!pedidoFechado(pedido) && !pedido.recebimento && (
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

      {!pedidoFechado(pedido) && !pedido.recebimento && (
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

/* ---------- pagamento (D2c) ---------- */
function PagamentoPedido({ pedido, hoje, onPagamento }: { pedido: Pedido; hoje: string; onPagamento: (d: DadosPagamento) => Promise<unknown> }) {
  const [sheet, setSheet] = useState<"pagar" | "corrigir" | null>(null);
  const [desfazer, setDesfazer] = useState(false);
  const [erro, setErro] = useState("");
  const e = estadoPagamento(pedido, hoje);
  const pg = pedido.pagamento;
  const { valor, estimado } = valorConta(pedido);
  const forma = pedido.resposta ? formaTexto(pedido.resposta.forma, pedido.resposta.prazoDias) : "";
  const semConta = ["rascunho", "cancelado", "recusado"].includes(pedido.situacao);
  if (!e && semConta) return null;
  const cor = e ? ({ atrasado: "border-destructive/50 bg-destructive/10", hoje: "border-warning/50 bg-warning/10", em_breve: "border-warning/50 bg-warning/10", a_pagar: "border-border bg-secondary/60", pago: "border-accent/50 bg-accent/10" } as const)[e.estado] : "border-dashed border-border";
  const enviar = (d: DadosPagamento) => { setErro(""); return onPagamento(d); };
  return (
    <section aria-label="Pagamento" className={`rounded-3xl border p-4 ${cor}`}>
      <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Banknote size={18} className="text-primary" /> Pagamento</p>
      {!e ? (
        <>
          <p className="mt-1 text-sm">Ainda sem conta registrada. Quando o fornecedor confirmar pelo link, o vencimento aparece aqui sozinho.</p>
          <button type="button" onClick={() => setSheet("corrigir")} className={`mt-3 w-full ${btnGhost}`}>Registrar conta a pagar</button>
        </>
      ) : (
        <>
          <p className={`mt-1 text-xl font-bold ${COR_PAGAMENTO[e.estado]}`}>{textoPagamento(pedido, hoje)}</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <Dado t="Valor" v={`${brl(valor)}${estimado ? " (estimado)" : ""}`} />
            {pg?.vencimento && <Dado t="Vencimento" v={dataEntregaTexto(pg.vencimento)} />}
            {forma && <Dado t="Forma" v={forma} />}
          </dl>
          {e.estado !== "pago" ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setSheet("pagar")} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><Check size={18} /> Marcar como pago</button>
              <button type="button" onClick={() => setSheet("corrigir")} className={`flex items-center justify-center gap-2 ${btnGhost}`}><CalendarClock size={18} /> Corrigir vencimento ou valor</button>
            </div>
          ) : !desfazer ? (
            <button type="button" onClick={() => setDesfazer(true)} className="mt-3 min-h-12 w-full text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline">Marquei por engano: desfazer pagamento</button>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sm">O pedido volta para "a pagar".</p>
              <button type="button" onClick={() => enviar({ situacao: "a_pagar" }).then(() => setDesfazer(false)).catch((x) => setErro(String(x?.message ?? "Não foi possível desfazer.")))}
                className="flex min-h-13 w-full items-center justify-center rounded-2xl border border-warning/60 px-4 text-base font-semibold text-warning">Confirmar: ainda não foi pago</button>
              <button type="button" onClick={() => setDesfazer(false)} className={`w-full ${btnGhost}`}>Voltar</button>
            </div>
          )}
        </>
      )}
      {erro && <p role="alert" className="mt-2 text-sm font-semibold text-destructive">{erro}</p>}
      {sheet === "pagar" && <MarcarPagoSheet valor={valor} estimado={estimado} hoje={hoje} onClose={() => setSheet(null)}
        onConfirmar={(data) => enviar({ situacao: "pago", pagoEm: data }).then(() => setSheet(null))} />}
      {sheet === "corrigir" && <CorrigirPagamentoSheet vencimento={pg?.vencimento ?? null} valor={pg?.valor ?? pedido.resposta?.valorTotal ?? null} estimado={totalPedido(pedido)}
        novo={!e} hoje={hoje} onClose={() => setSheet(null)} onSalvar={(venc, v) => enviar({ situacao: "a_pagar", vencimento: venc, valor: v }).then(() => setSheet(null))} />}
    </section>
  );
}

function MarcarPagoSheet({ valor, estimado, hoje, onClose, onConfirmar }: {
  valor: number; estimado: boolean; hoje: string; onClose: () => void; onConfirmar: (data: string) => Promise<unknown>;
}) {
  const [data, setData] = useState(hoje);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const atalhos: [string, string][] = [["Hoje", hoje], ["Ontem", somaDias(hoje, -1)]];
  return (
    <Sheet title="Marcar como pago" onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        <p className="text-base">Valor: <b>{brl(valor)}</b>{estimado ? " (estimado)" : ""}</p>
        <div role="group" aria-label="Quando foi pago?" className="space-y-1">
          <span className="text-sm font-medium">Quando foi pago?</span>
          <span className="grid grid-cols-2 gap-2">
            {atalhos.map(([t, d]) => (
              <button key={t} type="button" aria-pressed={data === d} onClick={() => setData(d)}
                className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${data === d ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{t}</button>
            ))}
          </span>
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} aria-label="Data do pagamento"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none [color-scheme:dark] focus-visible:border-primary" />
        </div>
      </div>
      <div className="px-5 pt-2">
        {erro && <p role="alert" className="mb-2 text-sm font-semibold text-destructive">{erro}</p>}
        <button type="button" disabled={!data || data > hoje || salvando} onClick={() => { setSalvando(true); onConfirmar(data).catch((x) => { setSalvando(false); setErro(String(x?.message ?? "Não foi possível salvar.")); }); }}
          className={`flex items-center justify-center gap-2 ${btnPrimary(!!data && data <= hoje && !salvando)}`}><Check size={18} /> {salvando ? "Salvando…" : "Confirmar pagamento"}</button>
      </div>
    </Sheet>
  );
}

function CorrigirPagamentoSheet({ vencimento, valor, estimado, novo, hoje, onClose, onSalvar }: {
  vencimento: string | null; valor: number | null; estimado: number; novo: boolean; hoje: string; onClose: () => void;
  onSalvar: (vencimento: string, valor: number | null) => Promise<unknown>;
}) {
  const [venc, setVenc] = useState(vencimento ?? "");
  const [v, setV] = useState<number | null>(valor);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const atalhos: [string, string][] = [["Hoje", hoje], ["Em 7 dias", somaDias(hoje, 7)], ["Em 28 dias", somaDias(hoje, 28)]];
  return (
    <Sheet title={novo ? "Registrar conta a pagar" : "Corrigir vencimento ou valor"} onClose={onClose}>
      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-3">
        <div role="group" aria-label="Vencimento" className="space-y-1">
          <span className="text-sm font-medium">Vencimento</span>
          <span className="grid grid-cols-3 gap-1.5">
            {atalhos.map(([t, d]) => (
              <button key={t} type="button" aria-pressed={venc === d} onClick={() => setVenc(d)}
                className={`min-h-11 rounded-xl border px-1 text-sm font-semibold ${venc === d ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{t}</button>
            ))}
          </span>
          <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} aria-label="Data de vencimento"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none [color-scheme:dark] focus-visible:border-primary" />
          {venc && <span className="block text-sm text-muted-foreground">{dataEntregaTexto(venc)}</span>}
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Valor da conta</span>
          <input inputMode="numeric" value={v ? brl(v) : ""} placeholder={brl(estimado)} aria-label="Valor da conta"
            onChange={(e) => { const c = Number(e.target.value.replace(/\D/g, "").slice(0, 10) || 0); setV(c > 0 ? c : null); }}
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary" />
          <span className="block text-xs text-muted-foreground">Em branco, vale o total estimado do pedido ({brl(estimado)}).</span>
        </label>
      </div>
      <div className="px-5 pt-2">
        {erro && <p role="alert" className="mb-2 text-sm font-semibold text-destructive">{erro}</p>}
        <button type="button" disabled={!venc || salvando} onClick={() => { setSalvando(true); onSalvar(venc, v).catch((x) => { setSalvando(false); setErro(String(x?.message ?? "Não foi possível salvar.")); }); }}
          className={`flex items-center justify-center gap-2 ${btnPrimary(!!venc && !salvando)}`}><Check size={18} /> {salvando ? "Salvando…" : "Salvar"}</button>
      </div>
    </Sheet>
  );
}

/* ---------- recebimento (E2) ---------- */
const COR_RESULTADO: Record<TipoResultado, string> = {
  ok: "text-accent", falta: "text-warning", sobra: "text-warning", nao_veio: "text-destructive", inconsistente: "text-destructive",
  fora: "text-warning", recusado: "text-muted-foreground", contando: "text-muted-foreground",
};
const dataHoraCurta = (ts: string) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const nomeDoItem = (i: Pick<ItemRecebido, "produtoId" | "variacaoId">, products: Product[]) => {
  const p = products.find((x) => x.db?.id === i.produtoId);
  if (!p) return { nome: "Produto removido", unidade: "Unidade" };
  const v = i.variacaoId ? p.variacoes.find((x) => x.uid === i.variacaoId) : null;
  return { nome: v ? `${p.nome} — ${v.tam} · ${v.cor}` : p.nome, unidade: p.unidade };
};

function RecebimentoPedido({ rec, products, onResolver }: {
  rec: Recebimento; products: Product[];
  onResolver?: ((itemId: string, acao: "aceitar" | "recusar", tentativa: number | null) => Promise<unknown>) | undefined;
}) {
  const decidir = rec.itens.filter(precisaDecidir).length;
  return (
    <section aria-label="Recebimento" className={`rounded-3xl border p-4 ${decidir ? "border-destructive/50 bg-destructive/5" : "border-border bg-secondary/40"}`}>
      <p className="flex items-center gap-2 text-base font-bold"><PackageCheck size={20} className="text-primary" /> Mercadoria recebida</p>
      <p className="text-xs text-muted-foreground">Conferida por {rec.funcionario}{rec.concluidoEm ? ` em ${dataHoraCurta(rec.concluidoEm)}` : ""} · contagem cega</p>
      {decidir > 0 && <p className="mt-2 text-sm font-semibold text-destructive">{decidir === 1 ? "1 produto precisa" : `${decidir} produtos precisam`} da sua decisão.</p>}
      <ul className="mt-2 divide-y divide-border">
        {rec.itens.map((i) => <LinhaRecebida key={i.id} i={i} products={products} onResolver={onResolver} />)}
      </ul>
    </section>
  );
}

function LinhaRecebida({ i, products, onResolver }: {
  i: ItemRecebido; products: Product[]; onResolver?: ((itemId: string, acao: "aceitar" | "recusar", tentativa: number | null) => Promise<unknown>) | undefined;
}) {
  const { nome, unidade } = nomeDoItem(i, products);
  const res = resultadoItem(i, unidade);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState("");
  const fazer = (acao: "aceitar" | "recusar", t: number | null) => {
    if (!onResolver) return;
    setTrabalhando(true); setErro("");
    onResolver(i.id, acao, t).catch((e) => setErro(String(e?.message ?? "Não foi possível salvar."))).finally(() => setTrabalhando(false));
  };
  return (
    <li className="py-2.5">
      <p className="break-words text-sm font-semibold">{nome}</p>
      <p className={`text-sm ${COR_RESULTADO[res.tipo]}`}>{res.texto}</p>
      {i.avaria > 0 && <p className="text-xs text-warning">{qtdUn(i.avaria, unidade)} quebrado(s) ou vencido(s): não entraram no estoque.</p>}
      {i.entrouEstoque > 0 && <p className="text-xs text-muted-foreground">Entrou no estoque: {qtdUn(i.entrouEstoque, unidade)}</p>}
      {i.situacao === "inconsistente" && onResolver && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">Qual contagem está certa? Ela entra no estoque.</p>
          <div className="flex flex-wrap gap-2">
            {i.tentativas.map((t, k) => (
              <button key={k} type="button" aria-pressed={escolha === k} onClick={() => setEscolha(k)}
                className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${escolha === k ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{qtdUn(t.total, unidade)}</button>
            ))}
          </div>
          {escolha != null && (
            <button type="button" disabled={trabalhando} onClick={() => fazer("aceitar", escolha)} className={`flex items-center justify-center gap-2 ${btnPrimary(!trabalhando)}`}>
              <Check size={18} /> Confirmar {qtdUn(i.tentativas[escolha]!.total, unidade)}
            </button>
          )}
        </div>
      )}
      {i.situacao === "fora_do_pedido" && onResolver && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" disabled={trabalhando} onClick={() => fazer("aceitar", null)} className={`flex items-center justify-center gap-2 ${btnGhost}`}><Check size={18} /> Ficar com ele (entra no estoque)</button>
          <button type="button" disabled={trabalhando} onClick={() => fazer("recusar", null)} className="flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-destructive/50 px-4 text-base font-semibold text-destructive"><X size={18} /> Devolver</button>
        </div>
      )}
      {erro && <p role="alert" className="mt-1 text-sm font-semibold text-destructive">{erro}</p>}
    </li>
  );
}

function EntregasSemPedido({ carregar, products, suppliers }: { carregar: () => Promise<Recebimento[]>; products: Product[]; suppliers: Supplier[] }) {
  const [lista, setLista] = useState<Recebimento[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => { carregar().then(setLista).catch(() => setFalhou(true)); }, [carregar]);
  if (falhou) return <p className="text-sm text-muted-foreground">Não foi possível carregar as entregas sem pedido.</p>;
  if (!lista?.length) return null;
  return (
    <section aria-label="Entregas sem pedido" className="space-y-2 pt-2">
      <h3 className="text-base font-bold">Entregas sem pedido</h3>
      <ul className="space-y-2">
        {lista.slice(0, 10).map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-secondary/40 p-3">
            <p className="text-sm font-semibold">{suppliers.find((x) => x.dbId === r.fornecedorId)?.nome ?? "Fornecedor não informado"}</p>
            <p className="text-xs text-muted-foreground">Recebida por {r.funcionario}{r.concluidoEm ? ` em ${dataHoraCurta(r.concluidoEm)}` : ""}</p>
            <ul className="mt-1 text-sm">
              {r.itens.map((i) => { const n = nomeDoItem(i, products); return <li key={i.id}>• {n.nome}: {qtdUn(i.quantidadeAceita ?? 0, n.unidade)}{i.avaria > 0 ? ` (${fmtQ(i.avaria)} quebrado/vencido)` : ""}</li>; })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
