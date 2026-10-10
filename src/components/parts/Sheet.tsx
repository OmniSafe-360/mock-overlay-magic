import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useRef(onClose);
  fechar.current = onClose;
  useLayoutEffect(() => {
    const el = painel.current;
    const anterior = document.activeElement as HTMLElement | null;
    if (!el) return;
    if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
    const teclado = (e: KeyboardEvent) => {
      // Janelas e scanner sobrepostos mantêm seu próprio foco e fechamento.
      const topo = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).at(-1);
      if (topo !== el) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar.current(); }
      if (e.key !== "Tab") return;
      const alvos = Array.from(el.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]'))
        .filter((x) => x.tabIndex >= 0 && !x.closest('[hidden],[inert],[aria-hidden="true"]'));
      const primeiro = alvos[0]; const ultimo = alvos.at(-1);
      if (!primeiro) { e.preventDefault(); el.focus(); return; }
      if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === el)) { e.preventDefault(); ultimo?.focus(); }
      else if (!e.shiftKey && (document.activeElement === ultimo || document.activeElement === el)) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", teclado);
    return () => { document.removeEventListener("keydown", teclado); if (anterior?.isConnected) anterior.focus({ preventScroll: true }); };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" tabIndex={-1} aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-background-deep/70 animate-in fade-in duration-200" />
      <div ref={painel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="relative flex max-h-[90%] w-full max-w-[480px] flex-col rounded-t-3xl border border-b-0 border-border bg-background outline-none animate-in slide-in-from-bottom duration-300" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="flex shrink-0 items-center justify-between px-5 pt-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-12 w-12 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
