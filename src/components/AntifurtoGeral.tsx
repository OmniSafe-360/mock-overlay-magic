/* Antifurto de todos os comércios (Fase 5.3): quanto faltou este mês em cada comércio, os alertas e o produto que mais sumiu.
 * Tocar num comércio abre a aba Diferenças dele, já no Relatório. */
import { ArrowLeft, ChevronRight, CircleCheck, ShieldAlert, Store } from "lucide-react";
import { TIPOS, type StoreData } from "@/components/StoreSetup";
import type { AlertasAntifurto } from "@/lib/antifurto";
import { brl } from "@/lib/vendas";

export type LinhaAntifurto = {
  s: StoreData; id: string;
  /** null = não deu para ler as diferenças deste comércio. */ alertas: AlertasAntifurto | null;
  maisSumiu: { titulo: string; vezes: number; valor: number } | null;
};

/** Soma do que faltou este mês e dos alertas, nos comércios que carregaram. */
export function totalAntifurto(linhas: LinhaAntifurto[]) {
  return linhas.reduce((t, l) => ({
    faltou: t.faltou + (l.alertas?.faltouMes ?? 0),
    alertas: t.alertas + (l.alertas ? l.alertas.visados.length + l.alertas.lugares.length + (l.alertas.passouLimite ? 1 : 0) : 0),
  }), { faltou: 0, alertas: 0 });
}

export function AntifurtoGeral({ linhas, carregando, onAbrir, onVoltar }: {
  linhas: LinhaAntifurto[]; carregando: boolean; onAbrir: (s: StoreData) => void; onVoltar: () => void;
}) {
  const tot = totalAntifurto(linhas);
  const comFalta = linhas.filter((l) => l.alertas && (l.alertas.faltouMes > 0 || l.alertas.visados.length || l.alertas.lugares.length))
    .sort((a, b) => (b.alertas!.faltouMes - a.alertas!.faltouMes) || a.s.nome.localeCompare(b.s.nome, "pt-BR"));
  const semFalta = linhas.filter((l) => l.alertas && !comFalta.includes(l));
  const semDados = linhas.filter((l) => !l.alertas);
  const Icone = (tipo: string) => TIPOS.find((t) => t.id === tipo)?.Icon ?? Store;
  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-in fade-in duration-300">
      <button type="button" onClick={onVoltar} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Início</button>
      <div>
        <h1 className="text-xl font-bold">Antifurto</h1>
        <p className="text-sm text-muted-foreground">O que faltou no estoque este mês em todos os seus comércios, pelo preço de compra. O pior vem primeiro.</p>
      </div>
      <section aria-label="Total de todos os comércios" className="rounded-3xl border border-border bg-secondary/40 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ShieldAlert size={18} className="text-destructive" /> Faltou este mês</p>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${tot.faltou > 0 ? "text-destructive" : ""}`}>{!linhas.some((l) => l.alertas) ? carregando ? "…" : "—" : brl(tot.faltou)}</p>
        <p className="text-sm text-muted-foreground">{semDados.length ? `Subtotal de ${linhas.length - semDados.length} de ${linhas.length} comércios · consulta incompleta` : `${tot.alertas === 0 ? "Nenhum alerta" : tot.alertas === 1 ? "1 alerta" : `${tot.alertas} alertas`} · ${linhas.length === 1 ? "1 comércio" : `${linhas.length} comércios`}`}</p>
      </section>

      {comFalta.length > 0 && (
        <ul className="space-y-3" aria-label="Comércios com faltas">
          {comFalta.map(({ s, id, alertas: a, maisSumiu }) => {
            const Icon = Icone(s.tipo);
            return (
              <li key={id}>
                <button type="button" onClick={() => onAbrir(s)} className="w-full space-y-2 rounded-3xl border border-border bg-secondary/50 p-4 text-left transition hover:border-primary">
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon size={20} /></span>
                    <span className="min-w-0 flex-1 break-words font-bold leading-tight">{s.nome}</span>
                    <span className={`shrink-0 text-lg font-bold tabular-nums ${a!.faltouMes > 0 ? "text-destructive" : ""}`}>{brl(a!.faltouMes)}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {a!.passouLimite && <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">Passou do limite de {brl(a!.limite)}</span>}
                    {a!.visados.length > 0 && <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">{a!.visados.length === 1 ? "1 produto visado" : `${a!.visados.length} produtos visados`}</span>}
                    {a!.lugares.length > 0 && <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">{a!.lugares.length === 1 ? "1 lugar com muitas faltas" : `${a!.lugares.length} lugares com muitas faltas`}</span>}
                  </span>
                  {maisSumiu && (
                    <span className="block text-sm text-muted-foreground">Mais sumiu: <b className="text-foreground">{maisSumiu.titulo}</b> · {maisSumiu.vezes === 1 ? "1 vez" : `${maisSumiu.vezes} vezes`} · {brl(maisSumiu.valor)}</span>
                  )}
                  <span className="flex items-center justify-end text-sm font-semibold text-primary">Ver relatório <ChevronRight size={18} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {semFalta.length > 0 && (
        <div className="rounded-2xl border border-border p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-accent"><CircleCheck size={16} /> Sem faltas este mês</p>
          <p className="mt-1 text-muted-foreground">{semFalta.map((l) => l.s.nome).join(" · ")}</p>
        </div>
      )}
      {semDados.length > 0 && (
        <p role="status" className="rounded-2xl border border-warning/50 p-3 text-sm">
          {carregando ? "Carregando…" : `Não foi possível atualizar: ${semDados.map((l) => l.s.nome).join(", ")}.`}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Falta é o que a contagem achou a menos e que não foi explicado como erro de contagem. A gôndola só acusa falta quando o caixa está ligado ao Omni.</p>
    </div>
  );
}
