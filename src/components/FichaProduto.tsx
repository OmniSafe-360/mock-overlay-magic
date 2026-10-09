/* Ficha do produto: o que o dono precisa ver de uma vez — situação, quanto tem, onde fica, validade, preço e dados. */
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CalendarClock, CircleAlert, CircleCheck, Info, MapPin, Package, Pencil, Phone, Tag, TriangleAlert, Truck } from "lucide-react";
import type { Product, Supplier } from "@/components/ProductArea";
import { ImprimirEtiquetaSheet } from "@/components/Etiqueta";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";
import { descricaoEmbalagem } from "@/lib/embalagem";
import { fmtQ, unPlural, unSingular } from "@/lib/deposito";
import { DETALHES } from "@/lib/listas";
import { ganhoSobreCompra, mostrarPct } from "@/lib/preco";
import { pmcCentavos } from "@/lib/farmacia";
import { situacaoProduto, quandoVence, type Alerta, type Nivel, type Qtds } from "@/lib/situacao";
import { avisosTexto, faixa, fmtData, hojeEm } from "@/lib/validade";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const labelDe = (tipo: string, k: string) => DETALHES[tipo]?.find((f) => f.k === k)?.label ?? k;
/** Ordem dos detalhes como no cadastro; chaves desconhecidas no fim. */
const ordemDet = (tipo: string, det: Record<string, string>) => {
  const campos = (DETALHES[tipo] ?? []).map((f) => f.k);
  return Object.entries(det).filter(([, v]) => v?.trim()).sort(([a], [b]) => (campos.indexOf(a) + 1 || 99) - (campos.indexOf(b) + 1 || 99));
};

const COR: Record<Nivel, { caixa: string; texto: string; titulo: string; Icone: typeof CircleCheck }> = {
  urgente: { caixa: "border-destructive/60 bg-destructive/10", texto: "text-destructive", titulo: "Precisa de atenção agora", Icone: TriangleAlert },
  atencao: { caixa: "border-warning/60 bg-warning/10", texto: "text-warning", titulo: "Fique de olho", Icone: CircleAlert },
  info: { caixa: "border-border bg-secondary/60", texto: "text-primary", titulo: "Falta completar o cadastro", Icone: Info },
  ok: { caixa: "border-accent/50 bg-accent/10", texto: "text-accent", titulo: "Tudo certo com este produto", Icone: CircleCheck },
};

export function FichaProduto({ p, tipo, fornecedor, onBack, onEdit }: {
  p: Product; tipo: string; fornecedor?: Supplier | undefined; onBack: () => void; onEdit: () => void;
}) {
  const hoje = useMemo(() => hojeEm(), []);
  const s = useMemo(() => situacaoProduto(p, tipo, hoje, { fornecedor: fornecedor?.nome }), [p, tipo, hoje, fornecedor?.nome]);
  const [etiqueta, setEtiqueta] = useState(false);
  const un1 = unSingular(p.unidade);
  return (
    <div className="mx-auto max-w-[560px] space-y-4 pb-4 animate-in fade-in slide-in-from-right-8 duration-300">
      <button type="button" onClick={onBack} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Produtos</button>

      {/* Cabeçalho: nome e preço de venda */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold leading-tight">{p.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{p.categoria || "Sem categoria"}</p>
          <p className="text-sm tabular-nums text-muted-foreground">Cód. {p.codigo}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold leading-tight text-accent">{brl(p.venda)}</p>
          <p className="text-xs text-muted-foreground">por {un1}</p>
        </div>
      </header>

      <Situacao nivel={s.nivel} alertas={s.alertas} />

      {/* Quanto tem */}
      <Cartao titulo="Quanto tem" Icone={Package}>
        <div className="grid grid-cols-3 gap-2">
          <Bloco nome={s.nomes.dep} q={s.qtd.dep} min={s.qtd.depMin} un={p.unidade} />
          <Bloco nome={s.nomes.ven} q={s.qtd.ven} min={s.qtd.venMin} un={p.unidade} />
          <Bloco nome="Total" q={s.qtd.total} un={p.unidade} destaque />
        </div>
        <Barra q={s.qtd} nomes={s.nomes} />
        {s.variacoes.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-border">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 bg-background-deep/60 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Variação</span><span className="w-12 text-right">{abrev(s.nomes.dep)}</span><span className="w-12 text-right">{abrev(s.nomes.ven)}</span><span className="w-12 text-right">Total</span>
            </div>
            {s.variacoes.map((v) => (
              <div key={v.uid} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-t border-border px-3 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium">{v.nome}</span>
                <span className={`w-12 text-right tabular-nums ${baixo(v.dep, v.depMin) ? "font-semibold text-warning" : ""}`}>{num(v.dep)}</span>
                <span className={`w-12 text-right tabular-nums ${baixo(v.ven, v.venMin) ? "font-semibold text-warning" : ""}`}>{num(v.ven)}</span>
                <span className="w-12 text-right font-semibold tabular-nums">{num(v.total)}</span>
              </div>
            ))}
          </div>
        )}
        {s.qtd.total == null && <p className="mt-3 text-sm text-muted-foreground">{s.qtd.dep != null || s.qtd.ven != null || s.variacoes.some((v) => v.dep != null || v.ven != null)
          ? "Total ainda incompleto. Há áreas ou variações sem contagem."
          : "Ainda não foi contado. Toque em Editar para informar quanto tem."}</p>}
      </Cartao>

      {/* Onde fica */}
      <Cartao titulo="Onde fica" Icone={MapPin}>
        <div className="space-y-2.5">
          <Lugar nome={s.nomes.dep} area={p.deposito} un={p.unidade} />
          <Lugar nome={s.nomes.ven} area={p.areaVenda} un={p.unidade} venda />
        </div>
      </Cartao>

      {/* Validade */}
      {p.validade?.controla && (
        <Cartao titulo="Validade" Icone={CalendarClock}>
          {s.lotes.length ? (
            <ul className="space-y-2">
              {s.lotes.map((l, i) => {
                const f = faixa(l.data, hoje);
                const cor = f === "vencido" ? "border-destructive/60 bg-destructive/10 text-destructive"
                  : f === "hoje" || f === "ate30" ? "border-warning/60 bg-warning/10 text-warning"
                  : f === "desconhecida" ? "border-border bg-background-deep/60 text-muted-foreground" : "border-accent/40 bg-accent/10 text-accent";
                return (
                  <li key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-background-deep/40 p-3">
                    <span className={`flex min-w-[88px] shrink-0 flex-col items-center rounded-xl border px-2 py-1.5 text-center ${cor}`}>
                      <span className="text-sm font-bold leading-tight">{l.data ? fmtData(l.data) : "Sem data"}</span>
                      <span className="text-[11px] leading-tight">{l.dias != null ? quandoVence(l.dias) : "confira"}</span>
                    </span>
                    <span className="min-w-0 text-sm">
                      <span className="block font-semibold">{qtdTxt(l.qtd, p.unidade)}{l.nome ? ` · ${l.nome}` : ""}</span>
                      <span className="block text-muted-foreground">{l.area === "dep" ? s.nomes.dep : s.nomes.ven}{l.lote ? ` · Lote ${l.lote}` : tipo === "farmacia" ? " · sem lote" : ""}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nenhuma validade informada ainda.</p>}
          <p className="mt-3 text-xs text-muted-foreground">{avisosTexto(p.validade.avisos)}</p>
        </Cartao>
      )}

      {/* Preço */}
      <Cartao titulo="Preço" Icone={Tag}>
        <Preco p={p} tipo={tipo} un1={un1} />
      </Cartao>

      {/* Sobre o produto */}
      <Cartao titulo="Sobre o produto" Icone={Truck}>
        <dl className="divide-y divide-border">
          {ordemDet(tipo, p.detalhes).filter(([k]) => k !== "pmc").map(([k, v]) => <Par key={k} k={labelDe(tipo, k)}>{v}</Par>)}
          {p.variacoes.length > 0 && !s.variacoes.length && (
            <Par k="Variações">
              <span className="flex flex-wrap gap-1.5">
                {p.variacoes.map((v, i) => <span key={v.uid ?? i} className="rounded-full border border-border px-2.5 py-0.5 text-sm">{v.tam} · {v.cor}</span>)}
              </span>
            </Par>
          )}
          <Par k="Fornecedor">
            {fornecedor ? (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{fornecedor.nome}</span>
                {fornecedor.tel && <a href={`tel:${fornecedor.tel.replace(/\D/g, "")}`} className="inline-flex min-h-9 items-center gap-1 font-semibold text-primary"><Phone size={15} /> {fornecedor.tel}</a>}
              </span>
            ) : <span className="text-muted-foreground">Não definido</span>}
          </Par>
          {tipo !== "roupas" && (
            <Par k="Como chega">
              {p.embalagens?.length ? p.embalagens.map((e) => (
                <span key={e.uid} className="block">{descricaoEmbalagem(e, p.unidade)}{e.preco ? ` · ${brl(e.preco)}` : ""}{e.codigo ? <span className="block text-xs text-muted-foreground">Cód. {e.codigo}</span> : null}</span>
              )) : `Por ${un1}`}
            </Par>
          )}
        </dl>
      </Cartao>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button type="button" onClick={onEdit} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><Pencil size={18} /> Editar</button>
        <button type="button" onClick={() => setEtiqueta(true)} className={`flex items-center justify-center gap-2 ${btnGhost}`}><Tag size={18} /> Imprimir etiqueta</button>
      </div>
      {etiqueta && <ImprimirEtiquetaSheet produto={p} onClose={() => setEtiqueta(false)} />}
    </div>
  );
}

/* ---------- partes ---------- */
const num = (q: number | null) => (q == null ? "—" : fmtQ(q));
const qtdTxt = (q: number, un: string) => `${fmtQ(q)} ${q >= 1 && q < 2 ? unSingular(un) : unPlural(un)}`;
const baixo = (q: number | null, min: number | null) => q != null && min != null && Math.round(q * 1000) <= Math.round(min * 1000);
const abrev = (nome: string) => (nome === "Área de venda" ? "Venda" : nome === "Depósito" ? "Dep." : nome);

function Situacao({ nivel, alertas }: { nivel: Nivel; alertas: Alerta[] }) {
  const c = COR[nivel];
  const principais = alertas.filter((a) => a.nivel !== "info");
  const faltas = alertas.filter((a) => a.nivel === "info");
  return (
    <section aria-label="Situação" className={`rounded-3xl border p-4 ${c.caixa}`}>
      <p className={`flex items-center gap-2 text-base font-bold ${c.texto}`}><c.Icone size={20} className="shrink-0" /> {c.titulo}</p>
      {principais.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {principais.map((a, i) => (
            <li key={i} className="flex gap-2.5">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.nivel === "urgente" ? "bg-destructive" : "bg-warning"}`} aria-hidden />
              <span className="min-w-0 text-sm"><span className="block font-semibold text-foreground">{a.titulo}</span>{a.detalhe && <span className="block text-muted-foreground">{a.detalhe}</span>}</span>
            </li>
          ))}
        </ul>
      )}
      {faltas.length > 0 && (
        <div className={principais.length ? "mt-3 border-t border-border/70 pt-3" : "mt-2"}>
          {principais.length > 0 && <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Falta completar</p>}
          <ul className="space-y-1">
            {faltas.map((a, i) => <li key={i} className="flex gap-2 text-sm text-muted-foreground"><span aria-hidden>•</span><span>{a.titulo}</span></li>)}
          </ul>
        </div>
      )}
      {nivel === "ok" && <p className="mt-1 text-sm text-muted-foreground">Quantidades, locais e validade em ordem.</p>}
    </section>
  );
}

function Cartao({ titulo, Icone, children }: { titulo: string; Icone: typeof Package; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="rounded-3xl border border-border bg-secondary/60 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Icone size={16} className="text-primary" /> {titulo}</h2>
      {children}
    </section>
  );
}

function Bloco({ nome, q, min, un, destaque }: { nome: string; q: number | null; min?: number | null; un: string; destaque?: boolean }) {
  const pouco = baixo(q, min ?? null);
  const zero = q != null && Math.round(q * 1000) === 0;
  const borda = zero && !destaque ? "border-destructive/60" : pouco ? "border-warning/60" : destaque ? "border-accent/50" : "border-border";
  return (
    <div className={`flex min-w-0 flex-col items-center rounded-2xl border bg-background-deep/60 px-1.5 py-3 text-center ${borda}`}>
      <span className="w-full truncate text-xs text-muted-foreground">{nome}</span>
      <span className={`mt-0.5 text-3xl font-bold leading-none tabular-nums ${destaque ? "text-accent" : zero ? "text-destructive" : pouco ? "text-warning" : ""}`}>{num(q)}</span>
      <span className="mt-1 text-xs text-muted-foreground">{q == null ? "não contado" : q >= 1 && q < 2 ? unSingular(un) : unPlural(un)}</span>
      {min != null && <span className={`mt-1 text-[11px] ${pouco ? "font-semibold text-warning" : "text-muted-foreground"}`}>mín. {fmtQ(min)}</span>}
    </div>
  );
}

/** Barra com a divisão entre as duas áreas. */
function Barra({ q, nomes }: { q: Qtds; nomes: { dep: string; ven: string } }) {
  if (!q.total || q.total <= 0) return null;
  const pd = Math.round(((q.dep ?? 0) / q.total) * 100);
  return (
    <div className="mt-3" aria-hidden>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-background-deep">
        <span className="bg-primary" style={{ width: `${pd}%` }} />
        <span className="bg-accent" style={{ width: `${100 - pd}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> {nomes.dep} {pd}%</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" /> {nomes.ven} {100 - pd}%</span>
      </div>
    </div>
  );
}

function Lugar({ nome, area, un, venda }: { nome: string; area: Product["deposito"]; un: string; venda?: boolean }) {
  const lim = area && !area.vars ? [area.min != null ? `mínimo ${qtdTxt(area.min, un)}` : "", area.max != null ? `${venda ? "cabe até" : "máximo"} ${qtdTxt(area.max, un)}` : ""].filter(Boolean).join(" · ") : "";
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-background-deep/40 p-3">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${venda ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"}`}><MapPin size={18} /></span>
      <span className="min-w-0 text-sm">
        <span className="block text-xs text-muted-foreground">{nome}</span>
        <span className={`block text-base font-semibold ${area?.local ? "" : "text-warning"}`}>{!area ? "Não configurado" : area.local ?? "Local não definido"}</span>
        {lim && <span className="block text-muted-foreground">{lim}</span>}
      </span>
    </div>
  );
}

function Preco({ p, tipo, un1 }: { p: Product; tipo: string; un1: string }) {
  const lucro = p.venda - p.compra;
  const ganho = ganhoSobreCompra(p.compra, p.venda);
  const pmc = tipo === "farmacia" ? pmcCentavos(p.detalhes) : 0;
  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-background-deep/60 p-2.5"><p className="text-xs text-muted-foreground">Compra</p><p className="mt-0.5 text-base font-bold">{brl(p.compra)}</p></div>
        <div className="rounded-2xl bg-background-deep/60 p-2.5"><p className="text-xs text-muted-foreground">Venda</p><p className="mt-0.5 text-base font-bold text-accent">{brl(p.venda)}</p></div>
        <div className="rounded-2xl bg-background-deep/60 p-2.5"><p className="text-xs text-muted-foreground">Lucro</p><p className={`mt-0.5 text-base font-bold ${lucro < 0 ? "text-destructive" : ""}`}>{brl(lucro)}</p></div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Por {un1}{ganho != null ? (ganho < 0 ? ` · prejuízo de ${mostrarPct(-ganho)}% sobre a compra` : ` · ganho de ${mostrarPct(ganho)}% sobre a compra`) : ""}
      </p>
      {pmc > 0 && <p className={`mt-1 text-sm ${p.venda > pmc ? "font-semibold text-destructive" : "text-muted-foreground"}`}>Preço máximo (PMC): {brl(pmc)}</p>}
    </>
  );
}

function Par({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
