/* QR Code desenhado pelo próprio app (sem internet), para o funcionário apontar a câmera. */
import { useMemo } from "react";
import qrcode from "qrcode-generator";

export function QrCode({ texto, tamanho = 220, rotulo }: { texto: string; tamanho?: number; rotulo: string }) {
  const { n, d } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { n, d };
  }, [texto]);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label={rotulo} width={tamanho} height={tamanho} viewBox={`0 0 ${n + 8} ${n + 8}`} shapeRendering="crispEdges" className="rounded-2xl">
      <rect width={n + 8} height={n + 8} fill="#ffffff" />
      <path d={d} fill="#071326" />
    </svg>
  );
}
