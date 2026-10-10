import { formatarCentavos as brl } from "@/lib/formatacao";
import { useHoje } from "@/hooks/useHoje";
/* Lista de produtos do comércio: cada produto com quanto tem e a situação em cor; filtro "Precisam de atenção". */
import { useMemo, useState } from "react";
import { Package, Plus, Search } from "lucide-react";
import type { Product, Supplier } from "@/lib/produto";
import { btnPrimary } from "@/components/StoreSetup";
import { fmtQ, unPlural, unSingular } from "@/lib/deposito";
import { situacaoProduto, type Nivel, type Situacao } from "@/lib/situacao";
import { hojeEm } from "@/lib/validade";

const ORDEM: Record<Nivel, number> = { urgente: 0, atencao: 1, info: 2, ok: 3 };
const BARRA: Record<Nivel, string> = { urgente: "bg-destructive", atencao: "bg-warning", info: "bg-primary/60", ok: "bg-accent" };
const TEXTO: Record<Nivel, string> = { urgente: "text-destructive", atencao: "text-warning", info: "text-muted-foreground", ok: "text-accent" };

type Filtro = "todos" | "atencao" | "completar";
export const precisaAtencao = (s: Situacao) => s.nivel === "urgente" || s.nivel === "atencao";

/** Frase curta da situação para a linha da lista. */
export function fraseSituacao(s: Situacao): string {
  const a = s.alertas.find((x) => x.nivel === s.nivel);
  if (s.nivel === "ok" || !a) return "Tudo certo";
  return s.nivel === "info" ? "Falta completar o cadastro" : a.titulo;
}

export function ListaProdutos({ products, tipo, suppliers, onNew, onOpen }: {
  products: Product[]; tipo: string; suppliers: Supplier[]; onNew: () => void; onOpen: (p: Product) => void;
}) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const hoje = useHoje();
  const itens = useMemo(() => products.map((p) => ({
    p, s: situacaoProduto(p, tipo, hoje, { fornecedor: suppliers.find((f) => f.id === p.fornecedor)?.nome }),
  })), [products, tipo, hoje, suppliers]);
  const nAtencao = itens.filter((i) => precisaAtencao(i.s)).length;
  const nCompletar = itens.filter((i) => i.s.nivel === "info").length;
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return itens
      .filter((i) => !t || i.p.nome.toLowerCase().includes(t) || i.p.codigo.includes(t))
      .filter((i) => filtro === "todos" || (filtro === "atencao" ? precisaAtencao(i.s) : i.s.nivel === "info"))
      .sort((a, b) => (filtro === "todos" ? 0 : ORDEM[a.s.nivel] - ORDEM[b.s.nivel]) || a.p.nome.localeCompare(b.p.nome, "pt-BR"));
  }, [itens, q, filtro]);

  const novo = <button type="button" onClick={onNew} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><Plus size={20} /> Novo produto</button>;
  if (!products.length)
    return (
      <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3 py-10 text-center animate-in fade-in duration-300">
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-secondary/60">
          <Package size={52} className="text-primary" />
          <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground"><Plus size={20} /></span>
        </div>
        <p className="text-lg font-bold">Cadastre seu primeiro produto</p>
        <p className="text-base text-muted-foreground">Leia o código de barras com a câmera ou digite. Leva poucos segundos.</p>
        <div className="mt-2 w-full">{novo}</div>
      </div>
    );

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar produto</span>
          <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou código"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 pl-12 pr-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40" />
        </label>
        <div className="sm:w-56">{novo}</div>
      </div>

      <div role="group" aria-label="Mostrar">
        <div className="flex flex-wrap gap-2">
          <Filtro on={filtro === "todos"} onClick={() => setFiltro("todos")} rotulo="Todos" n={products.length} />
          <Filtro on={filtro === "atencao"} onClick={() => setFiltro("atencao")} rotulo="Precisam de atenção" n={nAtencao} alerta={nAtencao > 0} />
          {nCompletar > 0 && <Filtro on={filtro === "completar"} onClick={() => setFiltro("completar")} rotulo="Falta completar" n={nCompletar} />}
        </div>
      </div>

      {!lista.length && (
        <p className="rounded-3xl border border-dashed border-border px-4 py-8 text-center text-base text-muted-foreground">
          {q.trim() ? "Nenhum produto encontrado." : filtro === "atencao" ? "Tudo certo! Nenhum produto precisa de atenção agora." : "Nenhum produto aqui."}
        </p>
      )}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {lista.map(({ p, s }) => <li key={p.id}><Linha p={p} s={s} onOpen={() => onOpen(p)} /></li>)}
      </ul>
    </div>
  );
}

function Filtro({ on, onClick, rotulo, n, alerta }: { on: boolean; onClick: () => void; rotulo: string; n: number; alerta?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`flex min-h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
      {rotulo}
      <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${alerta ? "bg-destructive text-white" : on ? "bg-white/20" : "bg-secondary"}`}>{n}</span>
    </button>
  );
}

function Linha({ p, s, onOpen }: { p: Product; s: Situacao; onOpen: () => void }) {
  const t = s.qtd.total;
  const outros = s.alertas.filter((a) => a.nivel === "urgente" || a.nivel === "atencao").length - (precisaAtencao(s) ? 1 : 0);
  return (
    <button type="button" onClick={onOpen}
      className="relative flex w-full items-stretch gap-3 overflow-hidden rounded-3xl border border-border bg-secondary/70 p-4 pl-5 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-ring">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${BARRA[s.nivel]}`} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block break-words text-base font-semibold leading-snug">{p.nome}</span>
        <span className="block truncate text-sm text-muted-foreground">{p.categoria || "Sem categoria"} · <span className="font-semibold text-accent">{brl(p.venda)}</span></span>
        <span className={`mt-1.5 flex items-baseline gap-1.5 text-sm font-medium leading-snug ${TEXTO[s.nivel]}`}>
          <span aria-hidden className={`h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${BARRA[s.nivel]}`} />
          <span className="min-w-0">{fraseSituacao(s)}</span>
          {outros > 0 && <span className="shrink-0 text-xs text-muted-foreground">+{outros}</span>}
        </span>
        {t != null && (
          <span className="mt-1 block truncate text-xs text-muted-foreground">{s.nomes.dep} {s.qtd.dep == null ? "—" : fmtQ(s.qtd.dep)} · {s.nomes.ven} {s.qtd.ven == null ? "—" : fmtQ(s.qtd.ven)}</span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end justify-center text-right">
        <span className={`text-2xl font-bold leading-none tabular-nums ${t != null && Math.round(t * 1000) === 0 ? "text-destructive" : ""}`}>{t == null ? "—" : fmtQ(t)}</span>
        <span className="mt-1 text-xs text-muted-foreground">{t == null ? "não contado" : t >= 1 && t < 2 ? unSingular(p.unidade) : unPlural(p.unidade)}</span>
      </span>
    </button>
  );
}
