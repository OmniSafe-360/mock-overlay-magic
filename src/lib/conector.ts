import { formatarReais as moeda } from "@/lib/formatacao";
/* Omni Conector (Fase 3.3): página aberta no computador do caixa que lê as notas da pasta e manda ao Omni.
 * Guarda no computador só a chave do caixa, a pasta escolhida e a lista dos arquivos já enviados. Nunca grava estoque aqui. */
import { lerNota, notaParaEnvio, type NotaVenda } from "@/lib/nfce";

const CHAVE = "omni.conector.chave";
const FEITOS = "omni.conector.feitos.v1";

export const lerChaveCaixa = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
export const guardarChaveCaixa = (k: string) => { try { localStorage.setItem(CHAVE, k); } catch { /* sem armazenamento */ } };
export const apagarChaveCaixa = () => { try { localStorage.removeItem(CHAVE); localStorage.removeItem(FEITOS); } catch { /* nada */ } };

/* ---------- arquivos já enviados (para não ler de novo) ---------- */
type Feitos = Record<string, number>;
export function lerFeitos(): Feitos {
  try { return JSON.parse(localStorage.getItem(FEITOS) ?? "{}") as Feitos; } catch { return {}; }
}
export function marcarFeito(id: string, agora = Date.now()) {
  const f = lerFeitos();
  f[id] = agora;
  // Guarda só os últimos 15 dias e no máximo 30 mil arquivos.
  const limite = agora - 15 * 86_400_000;
  const ids = Object.keys(f).filter((k) => f[k]! >= limite).sort((a, b) => f[b]! - f[a]!).slice(0, 30_000);
  try { localStorage.setItem(FEITOS, JSON.stringify(Object.fromEntries(ids.map((k) => [k, f[k]!])))); } catch { /* cheio: tenta de novo depois */ }
}
export const idArquivo = (caminho: string, tamanho: number, modificado: number) => `${caminho}|${tamanho}|${modificado}`;

/* ---------- pasta escolhida (fica guardada no navegador do caixa) ---------- */
type Pasta = FileSystemDirectoryHandle;
const BANCO_LOCAL = "omni-conector";
function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO_LOCAL, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("pasta");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
export async function guardarPasta(p: Pasta | null) {
  try {
    const db = await abrirBanco();
    await new Promise<void>((ok, erro) => {
      const t = db.transaction("pasta", "readwrite");
      if (p) t.objectStore("pasta").put(p, "notas"); else t.objectStore("pasta").clear();
      t.oncomplete = () => ok(); t.onerror = () => erro(t.error);
    });
  } catch { /* sem IndexedDB: a pasta precisa ser escolhida de novo ao abrir */ }
}
export async function lerPasta(): Promise<Pasta | null> {
  try {
    const db = await abrirBanco();
    return await new Promise<Pasta | null>((ok, erro) => {
      const r = db.transaction("pasta").objectStore("pasta").get("notas");
      r.onsuccess = () => ok((r.result as Pasta | undefined) ?? null); r.onerror = () => erro(r.error);
    });
  } catch { return null; }
}
/** O navegador permite escolher uma pasta? (Chrome e Edge no computador.) */
export const podeEscolherPasta = () => typeof window !== "undefined" && "showDirectoryPicker" in window;
export async function escolherPasta(): Promise<Pasta> {
  return (window as unknown as { showDirectoryPicker: (o?: object) => Promise<Pasta> }).showDirectoryPicker({ id: "omni-notas", mode: "read" });
}
type ComPermissao = Pasta & { queryPermission?: (o: object) => Promise<PermissionState>; requestPermission?: (o: object) => Promise<PermissionState> };
export async function permissaoPasta(p: Pasta, pedir = false): Promise<PermissionState> {
  const h = p as ComPermissao;
  try {
    if (pedir && h.requestPermission) return await h.requestPermission({ mode: "read" });
    return h.queryPermission ? await h.queryPermission({ mode: "read" }) : "granted";
  } catch { return "denied"; }
}

/* ---------- ler a pasta ---------- */
export type Arquivo = { id: string; nome: string; ler: () => Promise<string> };
/** Arquivos .xml da pasta (e até 3 níveis de subpastas) modificados desde `desde` e ainda não enviados. */
export async function arquivosNovos(p: Pasta, desde: number, feitos: Feitos = lerFeitos(), limite = 300): Promise<Arquivo[]> {
  const out: (Arquivo & { quando: number })[] = [];
  async function andar(dir: Pasta, caminho: string, nivel: number) {
    for await (const [nome, h] of (dir as unknown as { entries: () => AsyncIterable<[string, FileSystemHandle]> }).entries()) {
      if (out.length >= limite * 3) return;
      if (h.kind === "directory") { if (nivel < 3) await andar(h as Pasta, `${caminho}${nome}/`, nivel + 1); continue; }
      if (!/\.xml$/i.test(nome)) continue;
      const f = await (h as FileSystemFileHandle).getFile();
      if (f.lastModified < desde) continue;
      const id = idArquivo(`${caminho}${nome}`, f.size, f.lastModified);
      if (feitos[id]) continue;
      out.push({ id, nome: `${caminho}${nome}`, quando: f.lastModified, ler: () => f.text() });
    }
  }
  await andar(p, "", 0);
  // A venda chega antes do cancelamento dela: os mais antigos primeiro.
  return out.sort((a, b) => a.quando - b.quando).slice(0, limite);
}

/* ---------- mandar ao Omni ---------- */
export type ApiConector = {
  enviar: (chave: string, nota: Omit<NotaVenda, "cnpj">) => Promise<{ situacao: string; sem_cadastro?: number; itens?: number }>;
  cancelar: (chave: string, chaveNota: string) => Promise<{ situacao: string }>;
};
export type Resultado =
  | { ok: true; texto: string; nivel: "ok" | "info" | "atencao" }
  | { ok: false; texto: string; tentarDeNovo: boolean; desligado?: boolean };

const ERROS_DA_NOTA: [string, string][] = [
  ["nota_de_outro_cnpj", "Nota de outro CNPJ: não é deste comércio"],
  ["nota_de_outro_comercio", "Esta nota já foi enviada por outro comércio"],
  ["nota_invalida", "Nota com a chave ou a data inválida"],
  ["nota_sem_itens", "Nota sem produtos"],
  ["item_sem_quantidade", "Nota com produto sem quantidade"],
];

/** Lê um arquivo e manda ao Omni. Erro de internet: tenta de novo depois. Erro da nota: não tenta de novo. */
export async function processarArquivo(texto: string, chaveCaixa: string, api: ApiConector, opts: { cnpj?: string | null | undefined; area?: string | undefined } = {}): Promise<Resultado> {
  const cnpjComercio = opts.cnpj; const area = opts.area ?? "gôndola";
  const lido = lerNota(texto);
  try {
    if (lido.tipo === "outro") return { ok: true, nivel: "info", texto: "Arquivo que não é nota de venda do caixa (ignorado)" };
    if (lido.tipo === "rejeitada") return { ok: true, nivel: "atencao", texto: `Não contou: ${lido.motivo}` };
    if (lido.tipo === "cancelamento") {
      const r = await api.cancelar(chaveCaixa, lido.chave);
      return { ok: true, nivel: "info", texto: r.situacao === "repetida" ? "Cancelamento já recebido" : `Venda cancelada: os produtos voltaram para a ${area}` };
    }
    const n = lido.nota;
    if (cnpjComercio && n.cnpj && n.cnpj !== cnpjComercio) return { ok: false, tentarDeNovo: false, texto: "Nota de outro CNPJ: não é deste comércio" };
    const r = await api.enviar(chaveCaixa, notaParaEnvio(n));
    const nome = `Nota ${n.numero ?? ""}`.trim();
    if (r.situacao === "anterior") return { ok: true, nivel: "info", texto: `${nome}: venda de antes de ligar o caixa (não conta)` };
    if (r.situacao === "repetida") return { ok: true, nivel: "info", texto: `${nome}: já tinha sido enviada` };
    if (r.situacao === "cancelada") return { ok: true, nivel: "info", texto: `${nome}: venda cancelada (não conta)` };
    const itens = n.itens.length === 1 ? "1 item" : `${n.itens.length} itens`;
    const sem = r.sem_cadastro ? ` · ${r.sem_cadastro} sem cadastro no Omni` : "";
    return { ok: true, nivel: r.sem_cadastro ? "atencao" : "ok", texto: `${nome} · ${itens} · ${moeda(n.total)}${sem}` };
  } catch (e) {
    const m = String((e as { message?: string } | null)?.message ?? e ?? "");
    if (m.includes("caixa_desligado")) return { ok: false, tentarDeNovo: false, desligado: true, texto: "Este caixa foi desligado pelo dono" };
    const erro = ERROS_DA_NOTA.find(([k]) => m.includes(k));
    if (erro) return { ok: false, tentarDeNovo: false, texto: erro[1] };
    return { ok: false, tentarDeNovo: true, texto: "Sem internet ou o Omni não respondeu. Tenta de novo sozinho." };
  }
}
