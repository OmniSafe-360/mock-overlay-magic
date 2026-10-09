import type { Sessao } from "@/lib/persistencia";

export type TipoEnvio = "produto" | "pedido";
type Registro = { versao: 1; usuario: string; comercio: string; tipo: TipoEnvio; dbId: string; pedido: object };
export const ERRO_REGISTRO = "Não foi possível guardar ou ler o envio neste aparelho. Nenhum novo envio será feito. Confira o armazenamento do navegador e tente novamente.";

/** Um envio sem confirmação por usuário, comércio e módulo. Sem tokens ou credenciais.
 * Não é estoque offline: só permite repetir o pedido original para conferir o resultado no servidor. */
export function registroEnvio(usuario: string, comercio: string, tipo: TipoEnvio, storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage) {
  if (!usuario || !comercio) throw new Error(ERRO_REGISTRO);
  const chave = `omni.envio.v1:${encodeURIComponent(usuario)}:${encodeURIComponent(comercio)}:${tipo}`;
  const ler = (): Registro | null => {
    try {
      const texto = storage.getItem(chave);
      if (!texto) return null;
      const r = JSON.parse(texto) as Registro;
      if (r.versao !== 1 || r.usuario !== usuario || r.comercio !== comercio || r.tipo !== tipo || typeof r.dbId !== "string" || !r.dbId || !r.pedido || typeof r.pedido !== "object") throw new Error();
      const p = r.pedido as Record<string, unknown>;
      const produto = (p["produto_pedido"] as { produto?: { id?: string; comercio_id?: string } } | undefined)?.produto;
      if (tipo === "produto" ? typeof p["operacao_id"] !== "string" || produto?.id !== r.dbId || produto.comercio_id !== comercio
        : p["id"] !== r.dbId || p["comercio_id"] !== comercio) throw new Error();
      return r;
    } catch { throw new Error(ERRO_REGISTRO); }
  };
  const sessao = (novoId: string): Sessao => {
    const anterior = ler();
    let esperado = anterior ? JSON.stringify(anterior) : null;
    const s: Sessao = {
      dbId: anterior?.dbId ?? novoId, incerto: anterior ? { pedido: anterior.pedido } : null,
      exclusivo: async (acao) => typeof navigator !== "undefined" && navigator.locks
        ? await navigator.locks.request(chave, acao) : await acao(),
      guardar: (envio) => {
        try {
          // Uma aba não sobrescreve nem apaga o envio ainda aberto em outra.
          if (storage.getItem(chave) !== esperado) throw new Error();
          const proximo = envio ? JSON.stringify({ versao: 1, usuario, comercio, tipo, dbId: s.dbId, pedido: envio.pedido } satisfies Registro) : null;
          if (proximo) storage.setItem(chave, proximo);
          else storage.removeItem(chave);
          esperado = proximo;
        } catch { throw new Error(ERRO_REGISTRO); }
      },
    };
    return s;
  };
  return { ler, sessao };
}
