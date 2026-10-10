import { ERRO_REGISTRO } from "@/lib/envios";
import { ehIncerto } from "@/lib/persistencia";

/** Identifica o acesso deste aparelho sem copiar a chave secreta para os rascunhos. */
export async function escopoAcesso(chave: string): Promise<string> {
  if (!chave) throw new Error(ERRO_REGISTRO);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(chave));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Guarda a intenção antes da rede. Uma resposta incerta mantém exatamente o mesmo conteúdo.
 * A comparação protege outras abas; nunca guarda chaves de acesso dentro do pedido. */
export function operacaoLocal<T extends object>(escopo: string, modulo: string, validar: (p: unknown) => p is T) {
  const chave = `omni.operacao.v1:${encodeURIComponent(escopo)}:${modulo}`;
  let esperado: string | null;
  const ler = (): T | null => {
    try {
      const texto = localStorage.getItem(chave);
      esperado = texto;
      if (!texto) return null;
      const r = JSON.parse(texto);
      if (r.versao !== 1 || r.escopo !== escopo || r.modulo !== modulo || !validar(r.pedido)) throw new Error();
      return r.pedido;
    } catch { throw new Error(ERRO_REGISTRO); }
  };
  let pendente = ler();
  const guardar = (pedido: T | null) => {
    try {
      if (localStorage.getItem(chave) !== esperado) throw new Error();
      const texto = pedido ? JSON.stringify({ versao: 1, escopo, modulo, pedido }) : null;
      if (texto) localStorage.setItem(chave, texto); else localStorage.removeItem(chave);
      esperado = texto; pendente = pedido;
    } catch { throw new Error(ERRO_REGISTRO); }
  };
  let ocupado = false;
  const enviar = async <R>(novo: () => T, executar: (pedido: T) => Promise<R>) => {
    if (ocupado) throw new Error("Aguarde a confirmação do envio.");
    ocupado = true;
    const acao = async () => {
      try {
        const recuperado = !!pendente;
        const pedido = pendente ?? novo();
        if (!validar(pedido)) throw new Error(ERRO_REGISTRO);
        guardar(pedido);
        let resultado: R;
        try { resultado = await executar(pedido); }
        catch (e) { if (!ehIncerto(e)) guardar(null); throw e; }
        guardar(null);
        return { pedido, recuperado, resultado };
      } finally { ocupado = false; }
    };
    try {
      return typeof navigator !== "undefined" && navigator.locks
        ? await navigator.locks.request(chave, acao) : await acao();
    } finally { ocupado = false; }
  };
  return { pendente: () => pendente, enviar };
}
