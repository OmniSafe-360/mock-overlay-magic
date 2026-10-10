import { useEffect, useState } from "react";
import { hojeEm, TZ_PADRAO } from "@/lib/validade";

/** Atualiza o dia do comércio mesmo com a tela aberta durante a meia-noite. */
export function useHoje(tz = TZ_PADRAO) {
  const [hoje, setHoje] = useState(() => hojeEm(tz));
  useEffect(() => {
    const atualizar = () => setHoje(hojeEm(tz));
    const visivel = () => { if (document.visibilityState === "visible") atualizar(); };
    atualizar();
    const timer = window.setInterval(atualizar, 30_000);
    document.addEventListener("visibilitychange", visivel);
    window.addEventListener("online", atualizar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visivel);
      window.removeEventListener("online", atualizar);
    };
  }, [tz]);
  return hoje;
}
