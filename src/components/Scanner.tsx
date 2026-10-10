import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flashlight, Keyboard, Loader2, RotateCcw, X } from "lucide-react";

type Controls = { stop: () => void; switchTorch?: ((on: boolean) => Promise<void>) | undefined };
export type ScanError = "insecure" | "unsupported" | "denied" | "nocamera" | "busy" | "failed";

export const SCAN_ERROR_MSG: Record<ScanError, string> = {
  insecure: "A câmera só funciona em endereço seguro (https). Abra o app pelo endereço publicado.",
  unsupported: "Este navegador não permite usar a câmera. Use o Chrome atualizado ou digite o código.",
  denied: "Sem permissão para usar a câmera. Libere a câmera nas permissões do navegador e tente de novo.",
  nocamera: "Nenhuma câmera foi encontrada neste aparelho.",
  busy: "A câmera está sendo usada por outro app. Feche o outro app e tente de novo.",
  failed: "Não foi possível iniciar a câmera. Tente de novo.",
};

/** Converte o erro do navegador em um tipo de erro conhecido (sem expor detalhes técnicos). */
export function classifyCameraError(e: unknown): ScanError {
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "nocamera";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  if (name === "NotSupportedError" || name === "TypeError") return "unsupported";
  return "failed";
}

/** Retângulo em pixels (x, y, largura, altura). */
export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Converte a moldura visível (coordenadas da tela, relativas ao vídeo) para a região
 * correspondente no quadro real da câmera, considerando object-cover (o vídeo é ampliado
 * e cortado nas bordas). videoWidth/videoHeight já vêm na orientação exibida.
 * `margem` amplia a região (fração do tamanho) para tolerar código um pouco fora da moldura.
 */
export function cropParaVideo(vw: number, vh: number, ew: number, eh: number, frame: Rect, margem = 0.15): Rect | null {
  if (!(vw > 0 && vh > 0 && ew > 0 && eh > 0 && frame.w > 0 && frame.h > 0)) return null;
  const s = Math.max(ew / vw, eh / vh); // object-cover
  const ox = (ew - vw * s) / 2, oy = (eh - vh * s) / 2;
  const mx = frame.w * margem, my = frame.h * margem;
  let x = (frame.x - mx - ox) / s, y = (frame.y - my - oy) / s;
  let x2 = (frame.x + frame.w + mx - ox) / s, y2 = (frame.y + frame.h + my - oy) / s;
  x = Math.max(0, x); y = Math.max(0, y); x2 = Math.min(vw, x2); y2 = Math.min(vh, y2);
  if (x2 - x < 16 || y2 - y < 16) return null;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(x2 - x), h: Math.round(y2 - y) };
}

/** Câmera traseira com resolução boa para códigos de barras, sem exigências que impeçam abrir. */
export const CAMERA_PREFERIDA: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
};
/** Intervalo entre tentativas de leitura (o ZXing usa 500 ms por padrão). */
export const INTERVALO_LEITURA_MS = 80;
/** A cada N tentativas, lê o quadro inteiro (caso o código esteja fora da moldura). */
export const QUADRO_INTEIRO_A_CADA = 5;
/** Maior lado da imagem enviada ao leitor (reduz processamento sem perder barras). */
const MAX_LADO = 960;

type Caps = { torch?: boolean; focusMode?: string[] };

/** Câmera em tela cheia que lê EAN-13, EAN-8, UPC, Code 128 e QR Code. Entrega o código uma única vez. */
export function Scanner({ onCode, onType, onClose, mercado = false }: { onCode: (c: string) => void; onType: () => void; onDenied?: () => void; onClose: () => void; mercado?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const ctrl = useRef<Controls | null>(null);
  const done = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | ScanError>("loading");
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const stopAll = () => {
    try { ctrl.current?.stop(); } catch { /* já parado */ }
    ctrl.current = null;
    const s = video.current?.srcObject as MediaStream | null | undefined;
    s?.getTracks?.().forEach((t) => t.stop());
    if (video.current) video.current.srcObject = null;
  };

  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const t0 = performance.now();
    const pararStream = () => { if (timer) clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
    setStatus("loading"); setHasTorch(false); setTorch(false);
    (async () => {
      if (typeof window !== "undefined" && window.isSecureContext === false) { setStatus("insecure"); return; }
      if (!navigator.mediaDevices?.getUserMedia) { setStatus("unsupported"); return; }
      try {
        // Câmera e biblioteca carregam em paralelo para abrir mais rápido.
        const libs = Promise.all([import("@zxing/browser"), import("@/lib/leituraCodigo")]);
        try {
          stream = await navigator.mediaDevices.getUserMedia(CAMERA_PREFERIDA);
        } catch (e) {
          // Alguns aparelhos recusam a preferência de câmera/resolução: tenta qualquer câmera.
          if (classifyCameraError(e) !== "nocamera" || !alive) throw e;
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (!alive || !video.current) { pararStream(); return; } // fechou durante a inicialização
        const track = stream.getVideoTracks()[0];
        const caps: Caps = (track?.getCapabilities?.() as Caps | undefined) ?? {};
        // Foco contínuo quando o aparelho permitir; se não, segue normalmente.
        if (track && caps.focusMode?.includes("continuous")) {
          try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }); } catch { /* sem suporte */ }
        }
        const v = video.current;
        v.srcObject = stream;
        try { await v.play(); } catch { /* autoPlay cuida */ }
        const [{ BrowserMultiFormatReader }, { hintsLeitura, textoLeitura }] = await libs;
        if (!alive || !video.current) { pararStream(); return; }
        const reader = new BrowserMultiFormatReader(hintsLeitura(mercado));
        const canvas = document.createElement("canvas");
        const g = canvas.getContext("2d", { willReadFrequently: true });
        const tPronto = performance.now();
        console.info(`[scanner] câmera aberta em ${Math.round(tPronto - t0)} ms`);

        const entregar = (raw: string) => {
          const text = String(raw).trim(); // texto puro: zeros à esquerda preservados
          if (!text || !alive || done.current) return;
          console.info(`[scanner] código reconhecido ${Math.round(performance.now() - tPronto)} ms após abrir`);
          done.current = true; alive = false;
          pararStream(); stopAll();
          navigator.vibrate?.(80);
          onCode(text);
        };

        let n = 0;
        const tick = () => {
          if (!alive || done.current) return;
          const el = video.current;
          if (el && g && el.readyState >= 2 && el.videoWidth > 0) {
            n++;
            const vr = el.getBoundingClientRect();
            const fr = frameRef.current?.getBoundingClientRect();
            const full: Rect = { x: 0, y: 0, w: el.videoWidth, h: el.videoHeight };
            const crop = n % QUADRO_INTEIRO_A_CADA !== 0 && fr
              ? cropParaVideo(el.videoWidth, el.videoHeight, vr.width, vr.height, { x: fr.left - vr.left, y: fr.top - vr.top, w: fr.width, h: fr.height })
              : null;
            const r = crop ?? full;
            const k = Math.min(1, MAX_LADO / Math.max(r.w, r.h));
            canvas.width = Math.round(r.w * k); canvas.height = Math.round(r.h * k);
            try {
              g.drawImage(el, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
              const res = reader.decodeFromCanvas(canvas);
              if (res) {
                const codigo = textoLeitura(res.getText(), res.getBarcodeFormat(), mercado);
                if (codigo) { entregar(codigo); return; }
              }
            } catch { /* nenhum código neste quadro */ }
          }
          // Próxima tentativa só depois que esta terminou: não acumula trabalho nem trava.
          timer = setTimeout(tick, INTERVALO_LEITURA_MS);
        };

        ctrl.current = {
          stop: pararStream,
          switchTorch: track && caps.torch ? (on: boolean) => track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }) : undefined,
        };
        setHasTorch(!!caps.torch);
        setStatus("ready");
        tick();
      } catch (e) {
        pararStream();
        if (alive) { stopAll(); setStatus(classifyCameraError(e)); }
      }
    })();
    return () => { alive = false; pararStream(); stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, attempt, mercado]);

  const close = (fn: () => void) => { done.current = true; stopAll(); fn(); };
  const toggle = async () => { const v = !torch; try { await ctrl.current?.switchTorch?.(v); setTorch(v); } catch { setHasTorch(false); } };
  const err = status !== "loading" && status !== "ready" ? status : null;

  if (!mounted) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Escanear código" className="fixed inset-0 z-[100] bg-background-deep animate-in fade-in duration-200">
      <video ref={video} className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay />
      <div className="absolute inset-0 flex flex-col items-center justify-between safe-area">
        <div className="flex w-full justify-end">
          <button type="button" onClick={() => close(onClose)} aria-label="Fechar câmera" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/70 text-foreground backdrop-blur"><X size={22} /></button>
        </div>
        {err ? (
          <div role="alert" className="mx-4 flex max-w-[400px] flex-col items-center gap-4 rounded-3xl border border-border bg-background/90 p-5 text-center backdrop-blur">
            <p className="text-base font-medium text-foreground">{SCAN_ERROR_MSG[err]}</p>
            {err !== "insecure" && err !== "unsupported" && err !== "nocamera" && (
              <button type="button" onClick={() => { done.current = false; setAttempt((a) => a + 1); }} className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground">
                <RotateCcw size={18} /> Tentar de novo
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div ref={frameRef} className="relative h-56 w-72 max-w-[80vw] rounded-3xl border-4 border-accent shadow-[0_0_0_9999px_oklch(0.18_0.05_260/0.55)]">
              {status === "loading"
                ? <span className="absolute inset-0 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-accent" /></span>
                : <span className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-accent" />}
            </div>
            <p className="rounded-2xl bg-background/70 px-4 py-2 text-center text-base font-medium text-foreground backdrop-blur">
              {status === "loading" ? "Abrindo a câmera..." : "Centralize o código e mantenha o celular parado"}
            </p>
          </div>
        )}
        <div className="flex w-full max-w-[480px] gap-2">
          {hasTorch && !err && (
            <button type="button" onClick={toggle} aria-pressed={torch} className={`flex min-h-13 items-center gap-2 rounded-2xl px-5 text-base font-semibold backdrop-blur ${torch ? "bg-accent text-accent-foreground" : "bg-background/70 text-foreground"}`}>
              <Flashlight size={20} /> Lanterna
            </button>
          )}
          <button type="button" onClick={() => close(onType)} className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-background/70 px-5 text-base font-semibold text-foreground backdrop-blur">
            <Keyboard size={20} /> Digitar em vez disso
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
