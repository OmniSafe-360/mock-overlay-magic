/* Instalar o app do funcionário (Omni Operação) na tela inicial do celular. */

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const INSTALADO = "omni.funcionario.instalado";
const ADIADO = "omni.funcionario.instalar_depois";
let guardado: EventoInstalar | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

const DENTRO_DONO = "omni.funcionario.dentro_do_app_dono";
if (typeof window !== "undefined") {
  // "Sou funcionário" tocado dentro do app do dono instalado: a página abre dentro dele (não dá para instalar daqui).
  try { if (new URLSearchParams(window.location.search).get("origem") === "dono") sessionStorage.setItem(DENTRO_DONO, "1"); } catch { /* nada */ }
  // O navegador avisa uma vez que dá para instalar; guardamos para o botão "Instalar".
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); guardado = e as EventoInstalar; avisar(); });
  window.addEventListener("appinstalled", () => { guardado = null; try { localStorage.setItem(INSTALADO, "1"); } catch { /* nada */ } avisar(); });
}

export const podeInstalarDireto = () => !!guardado;
export function ouvirInstalacao(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; }
/** Abre a janela do celular para instalar. true = instalou. */
export async function instalar(): Promise<boolean> {
  if (!guardado) return false;
  const e = guardado;
  await e.prompt();
  const r = await e.userChoice;
  guardado = null; avisar();
  return r.outcome === "accepted";
}

/** Já está aberto como app instalado (sem a barra do navegador)? */
export function abertoComoApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
export function jaInstalado(): boolean { try { return localStorage.getItem(INSTALADO) === "1"; } catch { return false; } }
export function adiado(): boolean {
  try { const t = Number(localStorage.getItem(ADIADO) || 0); return Date.now() - t < 7 * 86400_000; } catch { return false; }
}
export function adiar() { try { localStorage.setItem(ADIADO, String(Date.now())); } catch { /* nada */ } }

export type Aparelho = "iphone" | "android" | "outro";
export function tipoAparelho(ua = typeof navigator === "undefined" ? "" : navigator.userAgent): Aparelho {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iphone";
  if (/Android/i.test(ua)) return "android";
  return "outro";
}

/** Na página do funcionário, o celular instala o "Omni Operação" (nome, ícone e início próprios), não o app do dono. */
export function prepararInstalacaoFuncionario() {
  if (typeof document === "undefined") return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) { link = document.createElement("link"); link.rel = "manifest"; document.head.appendChild(link); }
  link.href = "/manifest-funcionario.webmanifest";
  let meta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (!meta) { meta = document.createElement("meta"); meta.name = "apple-mobile-web-app-title"; document.head.appendChild(meta); }
  meta.content = "Omni Operação";
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw-funcionario.js", { scope: "/funcionario" }).catch(() => { /* sem instalação automática: o menu do navegador ainda funciona */ });
}

/** Aberto dentro do app do dono instalado (Omni Safe 360): para instalar o do funcionário, precisa abrir no navegador. */
export function dentroDoAppDono(): boolean {
  try { return abertoComoApp() && sessionStorage.getItem(DENTRO_DONO) === "1"; } catch { return false; }
}
/** Endereço para abrir no navegador. No Android, abre direto no Chrome. */
export const enderecoFuncionario = () => (typeof window === "undefined" ? "/funcionario" : `${window.location.origin}/funcionario`);
export const linkChromeAndroid = () => (typeof window === "undefined" ? "" : `intent://${window.location.host}/funcionario#Intent;scheme=https;package=com.android.chrome;end`);
