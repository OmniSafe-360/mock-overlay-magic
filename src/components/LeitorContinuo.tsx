/* Câmera do caixa (C2): fica aberta numa faixa da tela e lê um código atrás do outro, sem precisar tocar em nada.
 * O mesmo código só conta de novo depois de sair da frente da câmera por um instante (para não somar duas vezes sem querer). */
import { useEffect, useRef, useState } from "react";
import { CameraOff, Flashlight, Loader2, RotateCcw } from "lucide-react";
import { CAMERA_PREFERIDA, INTERVALO_LEITURA_MS, SCAN_ERROR_MSG, classifyCameraError, cropParaVideo, type Rect, type ScanError } from "@/components/Scanner";

/** Tempo mínimo para aceitar de novo o MESMO código (ms) e qualquer código (ms). */
export const ESPERA_MESMO_CODIGO = 1500;
export const ESPERA_QUALQUER = 500;

type Caps = { torch?: boolean; focusMode?: string[] };

/** Decide se uma leitura conta: ignora o mesmo código lido logo em seguida. */
export function aceitarLeitura(ultimo: { codigo: string; em: number } | null, codigo: string, agora: number): boolean {
  if (!ultimo) return true;
  if (agora - ultimo.em < ESPERA_QUALQUER) return false;
  return ultimo.codigo !== codigo || agora - ultimo.em >= ESPERA_MESMO_CODIGO;
}

export function LeitorContinuo({ onCode, mercado = false, pausado = false }: { onCode: (c: string) => void; mercado?: boolean; pausado?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const ultimo = useRef<{ codigo: string; em: number } | null>(null);
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const torchRef = useRef<((on: boolean) => Promise<void>) | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | ScanError>("loading");
  const [torch, setTorch] = useState(false);
  const [temTorch, setTemTorch] = useState(false);
  const [lido, setLido] = useState(false);

  useEffect(() => {
    let vivo = true;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const parar = () => { if (timer) clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); if (video.current) video.current.srcObject = null; };
    setStatus("loading"); setTemTorch(false); setTorch(false);
    (async () => {
      if (typeof window !== "undefined" && window.isSecureContext === false) { setStatus("insecure"); return; }
      if (!navigator.mediaDevices?.getUserMedia) { setStatus("unsupported"); return; }
      try {
        const libs = Promise.all([import("@zxing/browser"), import("@/lib/leituraCodigo")]);
        try { stream = await navigator.mediaDevices.getUserMedia(CAMERA_PREFERIDA); }
        catch (e) {
          if (classifyCameraError(e) !== "nocamera" || !vivo) throw e;
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (!vivo || !video.current) { parar(); return; }
        const track = stream.getVideoTracks()[0];
        const caps: Caps = (track?.getCapabilities?.() as Caps | undefined) ?? {};
        if (track && caps.focusMode?.includes("continuous")) {
          try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }); } catch { /* sem suporte */ }
        }
        const v = video.current;
        v.srcObject = stream;
        try { await v.play(); } catch { /* autoPlay cuida */ }
        const [{ BrowserMultiFormatReader }, { hintsLeitura, textoLeitura }] = await libs;
        if (!vivo || !video.current) { parar(); return; }
        const reader = new BrowserMultiFormatReader(hintsLeitura(mercado));
        const canvas = document.createElement("canvas");
        const g = canvas.getContext("2d", { willReadFrequently: true });
        let n = 0;
        const tick = () => {
          if (!vivo) return;
          const el = video.current;
          if (!pausadoRef.current && el && g && el.readyState >= 2 && el.videoWidth > 0) {
            n++;
            const vr = el.getBoundingClientRect();
            const fr = frameRef.current?.getBoundingClientRect();
            const full: Rect = { x: 0, y: 0, w: el.videoWidth, h: el.videoHeight };
            const crop = n % 4 !== 0 && fr ? cropParaVideo(el.videoWidth, el.videoHeight, vr.width, vr.height, { x: fr.left - vr.left, y: fr.top - vr.top, w: fr.width, h: fr.height }, 0.25) : null;
            const r = crop ?? full;
            const k = Math.min(1, 960 / Math.max(r.w, r.h));
            canvas.width = Math.round(r.w * k); canvas.height = Math.round(r.h * k);
            try {
              g.drawImage(el, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
              const res = reader.decodeFromCanvas(canvas);
              const codigo = res ? textoLeitura(res.getText(), res.getBarcodeFormat(), mercado) : null;
              const agora = Date.now();
              if (codigo && aceitarLeitura(ultimo.current, codigo, agora)) {
                ultimo.current = { codigo, em: agora };
                setLido(true); setTimeout(() => setLido(false), 350);
                onCodeRef.current(codigo);
              } else if (codigo && ultimo.current?.codigo === codigo) ultimo.current = { codigo, em: agora }; // ainda na frente da câmera: espera sair
            } catch { /* nenhum código neste quadro */ }
          }
          timer = setTimeout(tick, INTERVALO_LEITURA_MS);
        };
        torchRef.current = track && caps.torch ? (on: boolean) => track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }) : null;
        setTemTorch(!!caps.torch);
        setStatus("ready");
        tick();
      } catch (e) {
        parar();
        if (vivo) setStatus(classifyCameraError(e));
      }
    })();
    return () => { vivo = false; parar(); };
  }, [tentativa, mercado]);

  const erro = status !== "loading" && status !== "ready" ? status : null;
  return (
    <div className="relative h-40 w-full overflow-hidden rounded-3xl border border-border bg-background-deep">
      <video ref={video} className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay />
      {erro ? (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background-deep/90 p-3 text-center">
          <CameraOff size={22} className="text-muted-foreground" />
          <p className="text-sm">{SCAN_ERROR_MSG[erro]}</p>
          {erro !== "insecure" && erro !== "unsupported" && erro !== "nocamera" && (
            <button type="button" onClick={() => setTentativa((t) => t + 1)} className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><RotateCcw size={16} /> Tentar de novo</button>
          )}
        </div>
      ) : (
        <>
          <div ref={frameRef} className={`absolute inset-x-6 top-1/2 h-24 -translate-y-1/2 rounded-2xl border-[3px] transition-colors ${lido ? "border-accent bg-accent/20" : "border-white/80"}`}>
            {status === "loading"
              ? <span className="absolute inset-0 flex items-center justify-center"><Loader2 size={26} className="animate-spin text-white" /></span>
              : <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-accent" />}
          </div>
          <p className="absolute inset-x-0 bottom-1.5 text-center text-xs font-semibold text-white drop-shadow">{status === "loading" ? "Abrindo a câmera…" : pausado ? "Câmera em pausa" : "Aponte para o código de barras"}</p>
          {temTorch && (
            <button type="button" aria-pressed={torch} aria-label="Lanterna" onClick={() => { const v = !torch; void torchRef.current?.(v).then(() => setTorch(v), () => setTemTorch(false)); }}
              className={`absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-xl backdrop-blur ${torch ? "bg-accent text-accent-foreground" : "bg-background/60 text-foreground"}`}><Flashlight size={18} /></button>
          )}
        </>
      )}
    </div>
  );
}
