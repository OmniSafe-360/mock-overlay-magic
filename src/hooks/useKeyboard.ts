import { useSyncExternalStore } from "react";

const ouvintes = new Set<() => void>();
let aberto = false;
let parar: (() => void) | undefined;

/** Um único observador de teclado para o login, cadastro e janelas abertas ao mesmo tempo. */
function observar() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  let focoTimer: ReturnType<typeof setTimeout> | undefined;
  let rolagemTimer: ReturnType<typeof setTimeout> | undefined;
  const atualizar = () => {
    const h = vv ? vv.height : window.innerHeight;
    root.style.setProperty("--app-h", `${h}px`);
    const el = document.activeElement as HTMLElement | null;
    const digitando = !!el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
    const proximo = digitando && window.innerHeight - h > 120;
    if (aberto !== proximo) { aberto = proximo; for (const avisar of ouvintes) avisar(); }
    if (rolagemTimer) clearTimeout(rolagemTimer);
    if (proximo) {
      window.scrollTo(0, 0);
      rolagemTimer = setTimeout(() => {
        const box = el?.closest("[data-kb-scroll]");
        const seguinte = box && Array.from(box.querySelectorAll('label:has(input[type="checkbox"])')).find(
          (c) => !!(el!.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING),
        );
        seguinte?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
        el?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      }, 80);
    }
  };
  const saiu = () => { if (focoTimer) clearTimeout(focoTimer); focoTimer = setTimeout(atualizar, 50); };
  atualizar();
  vv?.addEventListener("resize", atualizar);
  vv?.addEventListener("scroll", atualizar);
  window.addEventListener("resize", atualizar);
  document.addEventListener("focusin", atualizar);
  document.addEventListener("focusout", saiu);
  return () => {
    vv?.removeEventListener("resize", atualizar);
    vv?.removeEventListener("scroll", atualizar);
    window.removeEventListener("resize", atualizar);
    document.removeEventListener("focusin", atualizar);
    document.removeEventListener("focusout", saiu);
    clearTimeout(focoTimer); clearTimeout(rolagemTimer);
    root.style.removeProperty("--app-h"); aberto = false;
  };
}

const assinar = (ouvinte: () => void) => {
  ouvintes.add(ouvinte);
  if (ouvintes.size === 1) parar = observar();
  return () => { ouvintes.delete(ouvinte); if (!ouvintes.size) { parar?.(); parar = undefined; } };
};
export function useKeyboard() { return useSyncExternalStore(assinar, () => aberto, () => false); }
