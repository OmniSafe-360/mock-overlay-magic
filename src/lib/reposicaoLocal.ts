import type { RespostaContagemPrateleira } from "@/lib/banco";
import type { ProdutoFunc } from "@/lib/recebimento";
import { newUid } from "@/lib/deposito";
import { ERRO_REGISTRO } from "@/lib/envios";

// Só os dados necessários à tela. Não guarda chave, saldo esperado nem lista do comércio.
export type ItemReposicaoLocal = Pick<ProdutoFunc, "produtoId" | "variacaoId" | "nome" | "unidade" | "codigo" | "variacao"> & {
  local: string | null; localDeposito: string | null;
};
type Base = { id: string; item: ItemReposicaoLocal; tipo: string; valor: string; rodada?: number };
export type ReposicaoLocal =
  | (Base & { t: "ir" })
  | (Base & { t: "contar"; contado: number | null })
  | (Base & { t: "buscar"; r: RespostaContagemPrateleira; levado: number | null });

const objeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const texto = (x: unknown) => typeof x === "string" && x.length > 0;
const opcional = (x: unknown) => x === null || typeof x === "string";
const quantidade = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1000000;
function valido(x: unknown): x is ReposicaoLocal {
  if (!objeto(x) || !texto(x["id"]) || !texto(x["tipo"]) || typeof x["valor"] !== "string" || !objeto(x["item"])) return false;
  if (x["rodada"] != null && (!Number.isInteger(x["rodada"]) || Number(x["rodada"]) < 1 || Number(x["rodada"]) > 3)) return false;
  const p = x["item"];
  if (!texto(p["produtoId"]) || !texto(p["nome"]) || !texto(p["unidade"])
    || !["variacaoId", "codigo", "variacao", "local", "localDeposito"].every((k) => opcional(p[k]))) return false;
  if (x["t"] === "ir") return true;
  if (x["t"] === "contar") return x["contado"] === null || quantidade(x["contado"]);
  if (x["t"] !== "buscar" || !objeto(x["r"]) || !(x["levado"] === null || quantidade(x["levado"]))) return false;
  const r = x["r"];
  return quantidade(r["sugerido"]) && typeof r["cheio"] === "boolean" && typeof r["depositoVazio"] === "boolean"
    && opcional(r["localDeposito"]) && (r["situacao"] === "contado" || r["situacao"] === "concluido")
    && (r["motivoSemReposicao"] == null || ["recebimento_em_conferencia", "estoque_nao_liberado", "deposito_sem_estoque", "deposito_nao_contado"].includes(String(r["motivoSemReposicao"])));
}

/** Mesma proteção dos envios locais: guardar antes da rede, comparar a versão da outra aba
 * e usar Web Locks quando disponível. A etapa permanece até a confirmação, inclusive sem resposta. */
export function registroReposicao(escopo: string) {
  if (!escopo) throw new Error(ERRO_REGISTRO);
  const chave = `omni.operacao.v1:${encodeURIComponent(escopo)}:reposicao`;
  let esperado: string | null;
  let atual: ReposicaoLocal | null;
  try {
    esperado = localStorage.getItem(chave);
    const r = esperado ? JSON.parse(esperado) : null;
    if (r && (r.versao !== 1 || r.escopo !== escopo || typeof r.revisao !== "string" || !valido(r.reposicao))) throw new Error();
    if (esperado && !r) throw new Error();
    atual = r?.reposicao ?? null;
  } catch { throw new Error(ERRO_REGISTRO); }

  const guardar = (reposicao: ReposicaoLocal | null) => {
    try {
      if (localStorage.getItem(chave) !== esperado) throw new Error("outra_aba");
      if (reposicao && !valido(reposicao)) throw new Error();
      // Revisão única impede uma tela antiga de sobrescrever etapas que já foram e voltaram.
      const proximo = reposicao ? JSON.stringify({ versao: 1, escopo, revisao: newUid(), reposicao }) : null;
      if (proximo) localStorage.setItem(chave, proximo); else localStorage.removeItem(chave);
      esperado = proximo; atual = reposicao;
    } catch (e) {
      if (e instanceof Error && e.message === "outra_aba") throw new Error("Esta reposição foi atualizada em outra aba. Volte ao início e abra Repor novamente para continuar.");
      throw new Error(ERRO_REGISTRO);
    }
  };
  let ocupado = false;
  const exclusivo = async (acao: () => Promise<void>) => {
    if (ocupado) return;
    ocupado = true;
    try {
      if (typeof navigator !== "undefined" && navigator.locks) await navigator.locks.request(chave, acao);
      else await acao();
    } finally { ocupado = false; }
  };
  return { atual: () => atual, guardar, exclusivo };
}
