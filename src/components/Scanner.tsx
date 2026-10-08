import { useEffect, useRef, useState } from "react";
import { Flashlight, Keyboard, X } from "lucide-react";

type Controls = { stop: () => void; switchTorch?: (on: boolean) => Promise<void> };

/** Câmera em tela cheia que lê EAN-13, EAN-8, UPC, Code 128 e QR Code. */
export function Scanner({ onCode, onType, onDenied, onClose }: { onCode: (c: string) => void; onType: () => void; onDenied: () => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const ctrl = useRef<Controls | null>(null);
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE]);
        const reader = new BrowserMultiFormatReader(hints);
        const c = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video.current!, (res) => {
          if (res && alive) { alive = false; ctrl.current?.stop(); navigator.vibrate?.(80); onCode(res.getText()); }
        });
        if (!alive) return c.stop();
        ctrl.current = c;
        setHasTorch(!!c.switchTorch);
      } catch {
        if (alive) onDenied();
      }
    })();
    return () => { alive = false; ctrl.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async () => { const v = !torch; try { await ctrl.current?.switchTorch?.(v); setTorch(v); } catch { setHasTorch(false); } };

  return (
    <div className="fixed inset-0 z-50 bg-background-deep animate-in fade-in duration-200">
      <video ref={video} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
      <div className="absolute inset-0 flex flex-col items-center justify-between safe-area">
        <div className="flex w-full justify-end">
          <button type="button" onClick={onClose} aria-label="Fechar câmera" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/70 text-foreground backdrop-blur"><X size={22} /></button>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-56 w-72 max-w-[80vw] rounded-3xl border-4 border-accent shadow-[0_0_0_9999px_oklch(0.18_0.05_260/0.55)]">
            <span className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-accent" />
          </div>
          <p className="rounded-2xl bg-background/70 px-4 py-2 text-center text-base font-medium text-foreground backdrop-blur">Aponte para o código de barras ou QR Code</p>
        </div>
        <div className="flex w-full max-w-[480px] gap-2">
          {hasTorch && (
            <button type="button" onClick={toggle} aria-pressed={torch} className={`flex min-h-13 items-center gap-2 rounded-2xl px-5 text-base font-semibold backdrop-blur ${torch ? "bg-accent text-accent-foreground" : "bg-background/70 text-foreground"}`}>
              <Flashlight size={20} /> Lanterna
            </button>
          )}
          <button type="button" onClick={onType} className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-background/70 px-5 text-base font-semibold text-foreground backdrop-blur">
            <Keyboard size={20} /> Digitar em vez disso
          </button>
        </div>
      </div>
    </div>
  );
}
