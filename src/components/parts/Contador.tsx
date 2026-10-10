import { Minus, Plus } from "lucide-react";
import { digits } from "@/lib/formatacao";
import { fmtQ, parseNum } from "@/lib/deposito";

export function Contador({ rotulo, valor, onMudar, fracao = false }: { rotulo: string; valor: string; onMudar: (v: string) => void; fracao?: boolean }) {
  const n = parseNum(valor, fracao ? "Kg" : "Unidade", true).v ?? 0;
  const passo = 1;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="min-w-[7.5rem] flex-1 text-base font-medium">{rotulo}</span>
      <div className="ml-auto flex shrink-0 items-center rounded-2xl border border-border">
        <button type="button" aria-label={`Menos — ${rotulo}`} onClick={() => onMudar(n - passo > 0 ? fmtQ(Math.round((n - passo) * 1000) / 1000).replace(/\./g, "") : "")} className="flex h-12 w-12 items-center justify-center text-primary"><Minus size={20} /></button>
        <input aria-label={rotulo} inputMode={fracao ? "decimal" : "numeric"} value={valor} placeholder="0"
          onChange={(e) => onMudar(fracao ? e.target.value.replace(/[^\d,]/g, "") : digits(e.target.value).slice(0, 6))}
          className="h-12 w-16 bg-transparent text-center text-xl font-bold tabular-nums outline-none placeholder:text-muted-foreground/40" />
        <button type="button" aria-label={`Mais — ${rotulo}`} onClick={() => onMudar(fmtQ(Math.round((n + passo) * 1000) / 1000).replace(/\./g, ""))} className="flex h-12 w-12 items-center justify-center text-primary"><Plus size={20} /></button>
      </div>
    </div>
  );
}
