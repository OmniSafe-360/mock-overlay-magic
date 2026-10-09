import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flashlight, Keyboard, Loader2, RotateCcw, X } from "lucide-react";

type Controls = { stop: () => void; switchTorch?: (on: boolean) => Promise<void> };
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

/** Câmera em tela cheia que lê EAN-13, EAN-8, UPC, Code 128 e QR Code. Entrega o código uma única vez. */
export function Scanner({ onCode, onType, onClose }: { onCode: (c: string) => void; onType: () => void; onDenied?: () => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
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
    setStatus("loading"); setHasTorch(false); setTorch(false);
    (async () => {
      if (typeof window !== "undefined" && window.isSecureContext === false) { setStatus("insecure"); return; }
      if (!navigator.mediaDevices?.getUserMedia) { setStatus("unsupported"); return; }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        if (!alive || !video.current) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE]);
        const reader = new BrowserMultiFormatReader(hints);
        const onResult = (res: { getText: () => string } | undefined | null) => {
          if (!res || !alive || done.current) return;
          const text = String(res.getText()).trim(); // texto puro: zeros à esquerda preservados
          if (!text) return;
          done.current = true; alive = false;
          stopAll();
          navigator.vibrate?.(80);
          onCode(text);
        };
        let c: Controls;
        try {
          c = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, video.current, onResult);
        } catch (e) {
          // Alguns aparelhos recusam a preferência de câmera: tenta qualquer câmera.
          if (classifyCameraError(e) !== "nocamera" || !alive || !video.current) throw e;
          c = await reader.decodeFromConstraints({ video: true }, video.current, onResult);
        }
        if (!alive) { try { c.stop(); } catch { /* */ } return; } // fechou durante a inicialização
        ctrl.current = c;
        setHasTorch(!!c.switchTorch);
        setStatus("ready");
      } catch (e) {
        if (alive) { stopAll(); setStatus(classifyCameraError(e)); }
      }
    })();
    return () => { alive = false; stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, attempt]);

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
            <div className="relative h-56 w-72 max-w-[80vw] rounded-3xl border-4 border-accent shadow-[0_0_0_9999px_oklch(0.18_0.05_260/0.55)]">
              {status === "loading"
                ? <span className="absolute inset-0 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-accent" /></span>
                : <span className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-accent" />}
            </div>
            <p className="rounded-2xl bg-background/70 px-4 py-2 text-center text-base font-medium text-foreground backdrop-blur">
              {status === "loading" ? "Abrindo a câmera..." : "Aponte para o código de barras ou QR Code"}
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
