import { CheckCircle2, ChevronRight, Circle, Rocket } from "lucide-react";
import { passosFeitos, type Passo } from "@/lib/primeirosPassos";

/** Quadro "Primeiros passos" da tela inicial: o que falta para o comércio funcionar, cada item leva ao lugar certo. */
export function PrimeirosPassos({ passos, comercio, mostrarNome, onPasso, onOcultar }: {
  passos: Passo[]; comercio: string; mostrarNome: boolean; onPasso: (p: Passo) => void; onOcultar: () => void;
}) {
  const feitos = passosFeitos(passos);
  const proximo = passos.find((p) => !p.feito);
  return (
    <section aria-label="Primeiros passos" className="rounded-3xl border border-primary/50 bg-primary/10 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary"><Rocket size={22} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">Primeiros passos{mostrarNome ? ` · ${comercio}` : ""}</h2>
          <p className="text-sm text-muted-foreground">{feitos} de {passos.length} feitos. Siga a ordem e o Omni fica pronto para usar.</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-background-deep/60" role="progressbar" aria-valuemin={0} aria-valuemax={passos.length} aria-valuenow={feitos} aria-label="Primeiros passos feitos">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(feitos / passos.length) * 100}%` }} />
      </div>
      <ol className="mt-3 space-y-2">
        {passos.map((p) => p.feito ? (
          <li key={p.id} className="flex items-center gap-3 px-1 py-1 text-sm text-muted-foreground">
            <CheckCircle2 size={20} className="shrink-0 text-accent" /> <span className="line-through decoration-muted-foreground/40">{p.titulo}</span>
          </li>
        ) : (
          <li key={p.id}>
            <button type="button" onClick={() => onPasso(p)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-ring ${p === proximo ? "border-primary bg-background" : "border-border bg-secondary/70"}`}>
              <Circle size={20} className={`shrink-0 ${p === proximo ? "text-primary" : "text-muted-foreground"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{p.titulo}</span>
                <span className="block text-xs text-muted-foreground">{p.ajuda}</span>
              </span>
              {p === proximo ? <span className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Fazer agora</span> : <ChevronRight size={18} className="shrink-0 text-muted-foreground" />}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onOcultar} className="mt-2 min-h-11 text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">
        Esconder os primeiros passos
      </button>
    </section>
  );
}
