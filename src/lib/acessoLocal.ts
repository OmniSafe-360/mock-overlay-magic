/* Abrir o Omni Operação sem internet (para o caixa continuar vendendo).
 * Guarda no celular a última tela inicial que veio do banco e uma conferência do PIN (só o resumo, com sal),
 * feita a cada PIN aceito pelo banco. Sem internet, o PIN é conferido aqui; 5 erros seguidos travam
 * a conferência local até a internet voltar (aí quem confere é o banco, como sempre). */
import type { InicioFuncionario } from "@/lib/banco";

export const ERROS_PIN_LOCAL = 5;
type PinLocal = { sal: string; resumo: string; erros: number };

const chaveInicio = (escopo: string) => `omni.funcionario.inicio.v1:${escopo}`;
const chavePin = (escopo: string) => `omni.funcionario.pin.v1:${escopo}`;

export function guardarInicio(escopo: string, d: InicioFuncionario) {
  try { localStorage.setItem(chaveInicio(escopo), JSON.stringify(d)); } catch { /* sem armazenamento */ }
}
export function lerInicio(escopo: string): InicioFuncionario | null {
  try { const d = JSON.parse(localStorage.getItem(chaveInicio(escopo)) ?? "null"); return d && typeof d.nome === "string" && d.comercio ? d : null; } catch { return null; }
}

async function resumo(sal: string, pin: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sal}:${pin}`));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}
function lerPin(escopo: string): PinLocal | null {
  try { const p = JSON.parse(localStorage.getItem(chavePin(escopo)) ?? "null"); return p && typeof p.sal === "string" && typeof p.resumo === "string" ? { ...p, erros: Number(p.erros) || 0 } : null; } catch { return null; }
}

/** Depois de o banco aceitar o PIN: guarda a conferência local (zera os erros). */
export async function guardarPinLocal(escopo: string, pin: string) {
  try {
    const sal = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(chavePin(escopo), JSON.stringify({ sal, resumo: await resumo(sal, pin), erros: 0 }));
  } catch { /* sem armazenamento: sem internet, não abre */ }
}

/** Sem internet: "ok", "errado" (com quantas tentativas faltam) ou "indisponivel" (nunca conferido aqui ou erros demais). */
export async function conferirPinLocal(escopo: string, pin: string): Promise<{ r: "ok" } | { r: "errado"; restam: number } | { r: "indisponivel" }> {
  const p = lerPin(escopo);
  if (!p || p.erros >= ERROS_PIN_LOCAL) return { r: "indisponivel" };
  if (await resumo(p.sal, pin) === p.resumo) {
    try { localStorage.setItem(chavePin(escopo), JSON.stringify({ ...p, erros: 0 })); } catch { /* nada */ }
    return { r: "ok" };
  }
  const erros = p.erros + 1;
  try { localStorage.setItem(chavePin(escopo), JSON.stringify({ ...p, erros })); } catch { /* nada */ }
  return erros >= ERROS_PIN_LOCAL ? { r: "indisponivel" } : { r: "errado", restam: ERROS_PIN_LOCAL - erros };
}

/** Ao sair do celular: apaga a cópia e a conferência local. */
export function apagarAcessoLocal(escopo: string) {
  try { localStorage.removeItem(chaveInicio(escopo)); localStorage.removeItem(chavePin(escopo)); } catch { /* nada */ }
}
