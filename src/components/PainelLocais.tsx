import { useHoje } from "@/hooks/useHoje";
/* Abas Depósito/Estoque e Gôndola/Área de venda: cada local com os produtos e quanto tem de cada um. */
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, MapPin, Package } from "lucide-react";
import type { Product } from "@/lib/produto";
import { fmtQ, unPlural, unSingular } from "@/lib/deposito";
import { textoDoTipo } from "@/lib/exemplos";
import { nomeVenda, porLocal, precisaAtencaoItem, type EstadoItem, type ItemLocal } from "@/lib/situacao";
import { hojeEm } from "@/lib/validade";

const COR: Record<EstadoItem, { barra: string; texto: string }> = {
  vencido: { barra: "bg-destructive", texto: "text-destructive" },
  acabou: { barra: "bg-destructive", texto: "text-destructive" },
  abaixo: { barra: "bg-warning", texto: "text-warning" },
  ok: { barra: "bg-transparent", texto: "" },
};

export function PainelLocais({ products, tipo, area, locaisCadastrados = [], onOpen }: {
  products: Product[]; tipo: string; area: "dep" | "ven"; locaisCadastrados?: string[] | undefined; onOpen: (p: Product) => void;
}) {
  const hoje = useHoje();
  const d = useMemo(() => porLocal(products, area, hoje, locaisCadastrados), [products, area, hoje, locaisCadastrados]);
  const [so, setSo] = useState(false);
  const [verFalta, setVerFalta] = useState(false);
  const nome = area === "dep" ? textoDoTipo(tipo)("Depósito") : nomeVenda(tipo);
  const nomeMin = nome.toLowerCase();
  /* No depósito, abaixo do mínimo = comprar; na área de venda = repor (regra 6.3 da fonte da verdade). */
  const acao = area === "dep" ? "Comprar" : "Repor";
  const nAtencao = d.resumo.abaixo + d.resumo.acabou + d.resumo.vencido;
  const grupos = so ? d.grupos.map((g) => ({ ...g, itens: g.itens.filter(precisaAtencaoItem) })).filter((g) => g.itens.length) : d.grupos;
  const semLocal = so ? d.semLocal.filter(precisaAtencaoItem) : d.semLocal;

  if (!products.length)
    return (
      <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3 py-12 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary/60 text-primary"><Package size={36} /></span>
        <p className="text-lg font-bold">Nada {area === "dep" ? `no ${nomeMin}` : `na ${nomeMin}`} ainda</p>
        <p className="text-base text-muted-foreground">Cadastre produtos e diga onde eles ficam. Eles aparecem aqui, separados por local.</p>
      </div>
    );

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2">
        <Numero rotulo="Locais" n={d.resumo.locais} />
        <Numero rotulo="Produtos" n={d.resumo.produtos} />
        <Numero rotulo={area === "dep" ? "Para comprar" : "Para repor"} n={d.resumo.abaixo + d.resumo.acabou} cor={d.resumo.abaixo + d.resumo.acabou ? "text-warning" : undefined} />
      </div>
      {d.resumo.vencido > 0 && (
        <p role="alert" className="rounded-2xl border border-destructive/60 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          {d.resumo.vencido === 1 ? "1 produto vencido" : `${d.resumo.vencido} produtos vencidos`} {area === "dep" ? `no ${nomeMin}` : `na ${nomeMin}`}. Separe para descarte ou troca.
        </p>
      )}

      <div role="group" aria-label="Mostrar" className="flex flex-wrap gap-2">
        <Chip on={!so} onClick={() => setSo(false)}>Todos</Chip>
        <Chip on={so} onClick={() => setSo(true)}>Precisam de atenção <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${nAtencao ? "bg-destructive text-white" : so ? "bg-white/20" : "bg-secondary"}`}>{nAtencao}</span></Chip>
      </div>

      {so && !grupos.length && !semLocal.length && (
        <p className="rounded-3xl border border-dashed border-border px-4 py-8 text-center text-base text-muted-foreground">Tudo certo! Nada para {acao.toLowerCase()} {area === "dep" ? `no ${nomeMin}` : `na ${nomeMin}`} agora.</p>
      )}
      {!so && !d.grupos.length && !d.semLocal.length && (
        <p className="rounded-3xl border border-dashed border-border px-4 py-8 text-center text-base text-muted-foreground">Nenhum produto tem {nomeMin} configurad{area === "dep" ? "o" : "a"} ainda.</p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {grupos.map((g) => <Local key={g.local} titulo={g.local} itens={g.itens} acao={acao} venda={area === "ven"} onOpen={onOpen} />)}
        {semLocal.length > 0 && <Local titulo="Sem local definido" itens={semLocal} acao={acao} venda={area === "ven"} onOpen={onOpen} aviso />}
      </div>

      {d.naoConfigurados.length > 0 && !so && (
        <div className="rounded-3xl border border-dashed border-border">
          <button type="button" aria-expanded={verFalta} onClick={() => setVerFalta(!verFalta)} className="flex min-h-13 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-muted-foreground">
            <span>{d.naoConfigurados.length === 1 ? "1 produto ainda não tem" : `${d.naoConfigurados.length} produtos ainda não têm`} {nomeMin} configurad{area === "dep" ? "o" : "a"}</span>
            <ChevronDown size={18} className={`shrink-0 transition ${verFalta ? "rotate-180" : ""}`} />
          </button>
          {verFalta && (
            <ul className="space-y-1 px-2 pb-2">
              {d.naoConfigurados.map((p) => (
                <li key={p.id}><button type="button" onClick={() => onOpen(p)} className="flex min-h-11 w-full items-center rounded-xl px-2 text-left text-sm font-medium hover:bg-secondary/60">{p.nome}</button></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Numero({ rotulo, n, cor }: { rotulo: string; n: number; cor?: string | undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/60 p-3 text-center">
      <p className={`text-2xl font-bold leading-none tabular-nums ${cor ?? ""}`}>{n}</p>
      <p className="mt-1 text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`flex min-h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>{children}</button>
  );
}

function Local({ titulo, itens, acao, venda, onOpen, aviso }: {
  titulo: string; itens: ItemLocal[]; acao: string; venda: boolean; onOpen: (p: Product) => void; aviso?: boolean;
}) {
  const nProd = new Set(itens.map((i) => i.p.id)).size;
  return (
    <section aria-label={titulo} className={`rounded-3xl border bg-secondary/60 p-4 ${aviso ? "border-warning/50" : "border-border"}`}>
      <h2 className="flex items-center gap-2">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${aviso ? "bg-warning/15 text-warning" : venda ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"}`}><MapPin size={18} /></span>
        <span className="min-w-0 flex-1 break-words text-base font-bold leading-snug">{titulo}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{nProd === 0 ? "vazio" : nProd === 1 ? "1 produto" : `${nProd} produtos`}</span>
      </h2>
      {aviso && <p className="mt-2 text-xs text-muted-foreground">Abra o produto e toque em Editar para escolher o local.</p>}
      {itens.length ? (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl bg-background-deep/50">
          {itens.map((i, k) => <li key={`${i.p.id}-${i.variacao ?? k}`}><Item i={i} acao={acao} venda={venda} onOpen={onOpen} /></li>)}
        </ul>
      ) : <p className="mt-3 rounded-2xl bg-background-deep/50 px-3 py-4 text-center text-sm text-muted-foreground">Nenhum produto neste local.</p>}
    </section>
  );
}

function Item({ i, acao, venda, onOpen }: { i: ItemLocal; acao: string; venda: boolean; onOpen: (p: Product) => void }) {
  const c = COR[i.estado];
  const un = i.qtd != null && i.qtd >= 1 && i.qtd < 2 ? unSingular(i.p.unidade) : unPlural(i.p.unidade);
  const etiqueta = i.estado === "vencido" ? "Vencido" : i.estado === "acabou" ? "Acabou" : i.estado === "abaixo" ? acao : "";
  const lim = [i.min != null ? `mín. ${fmtQ(i.min)}` : "", i.max != null ? `${venda ? "cabe" : "máx."} ${fmtQ(i.max)}` : ""].filter(Boolean).join(" · ");
  const cheio = venda && i.max && i.qtd != null ? Math.min(100, Math.round((i.qtd / i.max) * 100)) : null;
  return (
    <button type="button" onClick={() => onOpen(i.p)} className="relative flex w-full items-center gap-3 py-3 pl-4 pr-3 text-left transition hover:bg-secondary/40">
      <span aria-hidden className={`absolute inset-y-2 left-1.5 w-1 rounded-full ${c.barra}`} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block break-words text-sm font-semibold leading-snug">{i.nome}</span>
        {i.variacao && <span className="block text-xs text-muted-foreground">{i.variacao}</span>}
        {(lim || etiqueta) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {etiqueta && <span className={`font-semibold ${c.texto}`}>{etiqueta}</span>}
            {lim && <span>{lim}</span>}
          </span>
        )}
        {cheio != null && (
          <span aria-hidden className="mt-1.5 block h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-background-deep">
            <span className={`block h-full rounded-full ${i.estado === "ok" ? "bg-accent" : c.barra}`} style={{ width: `${cheio}%` }} />
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span className={`block text-xl font-bold leading-none tabular-nums ${i.estado === "acabou" ? "text-destructive" : i.estado === "abaixo" ? "text-warning" : ""}`}>{i.qtd == null ? "—" : fmtQ(i.qtd)}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{i.qtd == null ? "não contado" : un}</span>
      </span>
    </button>
  );
}
