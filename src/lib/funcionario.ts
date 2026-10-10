/* Equipe e app do funcionário "Omni Operação" (etapa E1). O funcionário entra com o código de 6 números e um PIN de 4;
 * o celular guarda uma chave (só neste aparelho). O dono bloqueia ou gera novo acesso a qualquer hora. */

export const NOME_APP_FUNCIONARIO = "Omni Operação";
export type Funcao = "receber" | "repor" | "ambos";
export const FUNCAO_TXT: Record<Funcao, string> = { receber: "Recebe mercadoria", repor: "Repõe gôndola", ambos: "Recebe e repõe" };
export const FUNCOES: Funcao[] = ["receber", "repor", "ambos"];
export const fazReceber = (f: Funcao) => f === "receber" || f === "ambos";
export const fazRepor = (f: Funcao) => f === "repor" || f === "ambos";

export type Funcionario = {
  id: string; nome: string; funcao: Funcao; /** Opera o caixa no celular. */ caixa?: boolean | undefined; codigo: string; codigoGeradoEm: string; primeiroAcessoEm: string | null;
  bloqueadoEm: string | null; ultimoAcesso: string | null; travadoAte: string | null; celulares: number;
};

/** Quantas horas o código vale para o primeiro acesso. */
export const HORAS_CODIGO = 48;

export type SituacaoFuncionario = "bloqueado" | "aguardando" | "expirado" | "ativo";
export function situacaoFuncionario(f: Funcionario, agora = Date.now()): SituacaoFuncionario {
  if (f.bloqueadoEm) return "bloqueado";
  if (!f.primeiroAcessoEm) return agora - Date.parse(f.codigoGeradoEm) > HORAS_CODIGO * 3600_000 ? "expirado" : "aguardando";
  return "ativo";
}

/** "agora há pouco", "há 5 min", "hoje às 14:20", "ontem às 09:10", "12/10 às 08:00". */
export function quandoTexto(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const min = Math.floor((agora.getTime() - d.getTime()) / 60000);
  if (min < 2) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dia = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
  if (dia(d) === dia(agora)) return `hoje às ${hora}`;
  if (dia(d) === dia(ontem)) return `ontem às ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${hora}`;
}

/** Até quando o código vale (primeiro acesso): "até amanhã às 14:20". */
export function validadeCodigoTexto(f: Pick<Funcionario, "codigoGeradoEm">, agora = new Date()): string {
  const fim = new Date(Date.parse(f.codigoGeradoEm) + HORAS_CODIGO * 3600_000);
  const hora = fim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const amanha = new Date(agora); amanha.setDate(amanha.getDate() + 1);
  const mesmo = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmo(fim, agora)) return `até hoje às ${hora}`;
  if (mesmo(fim, amanha)) return `até amanhã às ${hora}`;
  return `até ${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${hora}`;
}

/** "255 392" — mais fácil de ler em voz alta. */
export const codigoTexto = (c: string) => (c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c);
/** Endereço que o QR Code abre: já vem com o código preenchido. */
export const linkAcesso = (codigo: string, origem = typeof window === "undefined" ? "https://mock-overlay-magic.lovable.app" : window.location.origin) =>
  `${origem}/funcionario?codigo=${codigo}`;

/** PIN fácil demais (o banco também recusa). */
export const pinFacil = (p: string) => /^(\d)\1{3}$/.test(p) || ["1234", "4321", "0123", "9876"].includes(p);

/* ---------- chave guardada no celular ---------- */
const CHAVE = "omni.funcionario.chave";
export function lerChave(): string | null {
  try { const c = localStorage.getItem(CHAVE); return c && /^[0-9a-f]{64}$/.test(c) ? c : null; } catch { return null; }
}
export function guardarChave(c: string) { try { localStorage.setItem(CHAVE, c); } catch { /* sem armazenamento: entra de novo na próxima vez */ } }
export function apagarChave() { try { localStorage.removeItem(CHAVE); } catch { /* nada a fazer */ } }

/** Nome curto do aparelho, para o dono reconhecer ("Android", "iPhone", "Computador"). */
export function nomeAparelho(ua = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "Celular Android" : "Tablet Android";
  return "Computador";
}

/** Mensagens da entrada do funcionário. */
export function mensagemEntrada(e: unknown): string {
  const m = String((e as { message?: string } | null)?.message ?? e ?? "");
  const n = m.match(/(muitas_tentativas|pin_errado):(\d+)/);
  if (n?.[1] === "muitas_tentativas") return `Muitas tentativas erradas. Espere ${n[2]} ${n[2] === "1" ? "minuto" : "minutos"} e tente de novo.`;
  if (n?.[1] === "pin_errado") return n[2] === "1" ? "PIN errado. Falta 1 tentativa antes de travar por 15 minutos." : `PIN errado. Você ainda tem ${n[2]} tentativas.`;
  if (m.includes("codigo_expirado")) return "Este código venceu. Peça um código novo para o dono.";
  if (m.includes("codigo_invalido")) return "Código não encontrado. Confira os 6 números com o dono.";
  if (m.includes("pin_facil")) return "Esse PIN é fácil de adivinhar. Escolha outro (sem repetir números e sem sequência).";
  if (m.includes("pin_formato")) return "O PIN tem 4 números.";
  if (/fetch|network|Failed to/i.test(m)) return "Sem internet. Confira a conexão e tente de novo.";
  return "Não foi possível entrar agora. Tente de novo.";
}
