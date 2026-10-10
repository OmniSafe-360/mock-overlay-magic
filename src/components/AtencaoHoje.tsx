import { formatarCentavos as brl } from "@/lib/formatacao";
import { useHoje } from "@/hooks/useHoje";
/* "Atenção hoje": o resumo do dia no topo do comércio. Cada quadro conta produtos de um assunto; tocar abre a lista. */
import { useMemo, useState } from "react";
import { ChevronRight, CircleCheck } from "lucide-react";
import type { Product, Supplier } from "@/lib/produto";
import type { ResumoPagamentos } from "@/lib/pagamento";
import { atencaoHoje, type GrupoAtencao } from "@/lib/situacao";
import { hojeEm } from "@/lib/validade";
import { PRODUTOS_LUGAR, VEZES_VISADO, type AlertasAntifurto } from "@/lib/antifurto";

const COR: Record<GrupoAtencao["nivel"], { quadro: string; numero: string; ponto: string }> = {
  urgente: { quadro: "border-destructive/50 bg-destructive/10", numero: "text-destructive", ponto: "bg-destructive" },
  atencao: { quadro: "border-warning/50 bg-warning/10", numero: "text-warning", ponto: "bg-warning" },
  info: { quadro: "border-border bg-secondary/60", numero: "text-foreground", ponto: "bg-primary/60" },
};

/** "quinta-feira, 9 de outubro" a partir de AAAA-MM-DD. */
export const dataPorExtenso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12)).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Não repete o nome do assunto ("Repor a gôndola — Tem 4…" vira só "Tem 4…"). */
const linhaItem = (titulo: string, detalhe: string | undefined, assunto: string) =>
  titulo.toLowerCase() === assunto.toLowerCase() ? detalhe ?? "" : detalhe ? `${titulo} — ${detalhe}` : titulo;

export function AtencaoHoje({ products, tipo, suppliers, onOpen, jaPedidos, onFazerPedido, contas, onVerContas, entregasDecidir = 0, onVerEntregas, semCadastro = 0, onVerSemCadastro, diferencas = 0, onVerDiferencas, antifurto, onVerAntifurto }: {
  products: Product[]; tipo: string; suppliers: Supplier[]; onOpen: (p: Product) => void;
  /** Produtos (id do banco) já num pedido em andamento. */ jaPedidos?: Set<string> | undefined;
  /** Abre a montagem do pedido de compra. */ onFazerPedido?: (() => void) | undefined;
  /** Contas dos pedidos (D2c); tocar abre a aba Pedidos em "Só a pagar". */ contas?: ResumoPagamentos | undefined; onVerContas?: (() => void) | undefined;
  /** Produtos recebidos que esperam o dono decidir (E2); tocar abre a aba Pedidos. */ entregasDecidir?: number | undefined; onVerEntregas?: (() => void) | undefined;
  /** Códigos vendidos no caixa que o Omni não sabe qual produto é (Fase 3.4); tocar abre a aba Vendas. */ semCadastro?: number | undefined; onVerSemCadastro?: (() => void) | undefined;
  /** Perdas para confirmar + diferenças para explicar (Fase 4.3); tocar abre a aba Diferenças. */ diferencas?: number | undefined; onVerDiferencas?: (() => void) | undefined;
  /** Alertas de antifurto (Fase 5.2); tocar abre o Relatório da aba Diferenças. */ antifurto?: AlertasAntifurto | undefined; onVerAntifurto?: (() => void) | undefined;
}) {
  const hoje = useHoje();
  const grupos = useMemo(() => atencaoHoje(products, tipo, hoje, (p) => suppliers.find((f) => f.id === p.fornecedor)?.nome, jaPedidos), [products, tipo, hoje, suppliers, jaPedidos]);
  const [aberto, setAberto] = useState<string | null>(null);
  const restoMes = contas ? contas.esteMes.n - contas.atrasados.n - contas.hoje.n : 0;
  const quadrosContas: { k: string; nivel: GrupoAtencao["nivel"]; n: number; titulo: string; total: number }[] = !contas ? [] : [
    { k: "atrasadas", nivel: "urgente" as const, n: contas.atrasados.n, titulo: contas.atrasados.n === 1 ? "Conta atrasada" : "Contas atrasadas", total: contas.atrasados.total },
    { k: "hoje", nivel: "atencao" as const, n: contas.hoje.n, titulo: contas.hoje.n === 1 ? "Conta vence hoje" : "Contas vencem hoje", total: contas.hoje.total },
    { k: "mes", nivel: "info" as const, n: restoMes, titulo: "A pagar este mês", total: contas.esteMes.total - contas.atrasados.total - contas.hoje.total },
  ].filter((q) => q.n > 0);
  const quadrosEntrega = [
    ...(semCadastro > 0 ? [{ k: "semcad", n: semCadastro, titulo: "Vendido sem cadastro", ajuda: "diga qual produto é", onClick: onVerSemCadastro }] : []),
    ...(diferencas > 0 ? [{ k: "difs", n: diferencas, titulo: diferencas === 1 ? "Perda ou diferença" : "Perdas e diferenças", ajuda: "confirme ou explique", onClick: onVerDiferencas }] : []),
    ...(entregasDecidir > 0 ? [{ k: "entrega", n: entregasDecidir, titulo: entregasDecidir === 1 ? "Entrega para decidir" : "Entregas para decidir", ajuda: "contagem ou produto fora do pedido", onClick: onVerEntregas }] : []),
  ];
  const quadrosAntifurto = !antifurto ? [] : [
    ...(antifurto.visados.length ? [{ k: "visado", n: antifurto.visados.length, titulo: antifurto.visados.length === 1 ? "Produto visado" : "Produtos visados", ajuda: `faltou ${VEZES_VISADO}+ vezes em 30 dias` }] : []),
    ...(antifurto.lugares.length ? [{ k: "lugar", n: antifurto.lugares.length, titulo: antifurto.lugares.length === 1 ? "Lugar com muitas faltas" : "Lugares com muitas faltas", ajuda: `${PRODUTOS_LUGAR}+ produtos em 30 dias` }] : []),
    ...(antifurto.passouLimite ? [{ k: "limite", n: brl(antifurto.faltouMes), titulo: "Faltou no mês", ajuda: `passou do limite de ${brl(antifurto.limite)}` }] : []),
  ];
  if (!products.length && !quadrosContas.length && !quadrosEntrega.length && !quadrosAntifurto.length) return null;
  const sel = grupos.find((g) => g.tipo === aberto);
  const importantes = grupos.filter((g) => g.nivel !== "info").reduce((n, g) => n + g.itens.length, 0);

  return (
    <section aria-label="Atenção hoje" className="rounded-3xl border border-border bg-secondary/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-base font-bold">Atenção hoje</h2>
        <span className="text-xs text-muted-foreground">{maiuscula(dataPorExtenso(hoje))}</span>
      </div>

      {!grupos.some((g) => g.nivel !== "info") && !quadrosContas.some((q) => q.nivel !== "info") && !quadrosEntrega.length && !quadrosAntifurto.length && (
        <p className="mt-3 flex items-center gap-2 rounded-2xl border border-accent/50 bg-accent/10 p-3 text-sm font-semibold text-accent">
          <CircleCheck size={18} className="shrink-0" /> Tudo certo! Nenhum produto precisa de atenção agora.
        </p>
      )}
      {importantes > 0 && <p className="mt-1 text-sm text-muted-foreground">Toque num quadro para ver os produtos.</p>}

      {(grupos.length > 0 || quadrosContas.length > 0 || quadrosEntrega.length > 0 || quadrosAntifurto.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {quadrosEntrega.map((q) => (
            <button key={q.k} type="button" onClick={q.onClick}
              className={`flex min-h-[84px] flex-col justify-between rounded-2xl border p-3 text-left transition hover:border-primary ${COR.urgente.quadro}`}>
              <span className={`text-3xl font-bold leading-none tabular-nums ${COR.urgente.numero}`}>{q.n}</span>
              <span className="mt-2 text-sm font-semibold leading-tight">{q.titulo}<span className="block text-xs font-normal text-muted-foreground">{q.ajuda}</span></span>
            </button>
          ))}
          {quadrosAntifurto.map((q) => (
            <button key={q.k} type="button" onClick={onVerAntifurto}
              className={`flex min-h-[84px] flex-col justify-between rounded-2xl border p-3 text-left transition hover:border-primary ${COR.atencao.quadro}`}>
              <span className={`${typeof q.n === "number" ? "text-3xl" : "text-xl"} font-bold leading-none tabular-nums ${COR.atencao.numero}`}>{q.n}</span>
              <span className="mt-2 text-sm font-semibold leading-tight">{q.titulo}<span className="block text-xs font-normal text-muted-foreground">{q.ajuda}</span></span>
            </button>
          ))}
          {quadrosContas.map((q) => (
            <button key={q.k} type="button" onClick={onVerContas}
              className={`flex min-h-[84px] flex-col justify-between rounded-2xl border p-3 text-left transition hover:border-primary ${COR[q.nivel].quadro}`}>
              <span className={`text-3xl font-bold leading-none tabular-nums ${COR[q.nivel].numero}`}>{q.n}</span>
              <span className="mt-2 text-sm font-semibold leading-tight">{q.titulo}<span className="block text-xs font-normal text-muted-foreground">{brl(q.total)}</span></span>
            </button>
          ))}
          {grupos.map((g) => {
            const c = COR[g.nivel];
            const on = aberto === g.tipo;
            return (
              <button key={g.tipo} type="button" aria-expanded={on} onClick={() => setAberto(on ? null : g.tipo)}
                className={`flex min-h-[84px] flex-col justify-between rounded-2xl border p-3 text-left transition ${c.quadro} ${on ? "ring-2 ring-primary" : "hover:border-primary"}`}>
                <span className={`text-3xl font-bold leading-none tabular-nums ${c.numero}`}>{g.itens.length}</span>
                <span className="mt-2 text-sm font-semibold leading-tight">{g.titulo}</span>
              </button>
            );
          })}
        </div>
      )}

      {sel && (
        <div className="mt-3 rounded-2xl border border-border bg-background-deep/60 p-3 animate-in fade-in duration-200">
          <p className="text-sm font-bold">{sel.titulo}</p>
          <p className="text-xs text-muted-foreground">{sel.ajuda}</p>
          {onFazerPedido && (sel.tipo === "comprar" || sel.tipo === "acabou") && (
            <button type="button" onClick={onFazerPedido} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-semibold text-primary-foreground">
              Fazer pedido
            </button>
          )}
          <ul className="mt-2 divide-y divide-border">
            {sel.itens.map((i) => (
              <li key={i.p.id}>
                <button type="button" onClick={() => onOpen(i.p)} className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left">
                  <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${COR[sel.nivel].ponto}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold">{i.p.nome}</span>
                    <span className="block text-xs text-muted-foreground">{linhaItem(i.titulo, i.detalhe, sel.titulo)}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
