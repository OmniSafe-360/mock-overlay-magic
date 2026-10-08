import { useId } from "react";

/** Símbolo Omni Safe 360 — cores da marca fixas (identidade visual). */
export function LogoMark({ size = 48, className }: { size?: number; className?: string | undefined }) {
  const id = useId().replace(/:/g, "");
  const bars = [
    [40, 3], [45, 1.5], [48.5, 3], [53.5, 1.5], [57, 4], [63, 1.5], [66.5, 3], [71.5, 1.5], [75, 3], [80, 1.5], [83.5, 3],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" className={className} role="img" aria-label="Omni Safe 360">
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16376B" />
          <stop offset="1" stopColor="#071326" />
        </linearGradient>
        <linearGradient id={`sh${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#CFE3FF" />
        </linearGradient>
        <linearGradient id={`ring${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2DE2C4" />
          <stop offset="1" stopColor="#2F8CFF" />
        </linearGradient>
        <filter id={`glow${id}`} x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <rect width="128" height="128" rx="30" fill={`url(#bg${id})`} />
      {/* anel 360 com abertura no topo */}
      <path
        d="M72 19.7 A45 45 0 1 1 56 19.7"
        fill="none"
        stroke={`url(#ring${id})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="64" cy="19" r="3.4" fill="#2DE2C4" />
      {/* escudo */}
      <path
        d="M64 32 L90 41 V62 C90 79 79 90 64 96 C49 90 38 79 38 62 V41 Z"
        fill={`url(#sh${id})`}
      />
      {/* código de barras */}
      {bars.map(([x, w]) => (
        <rect key={x} x={x} y="50" width={w} height="28" rx="0.5" fill="#0B1B3A" />
      ))}
      {/* feixe do scanner */}
      <rect x="34" y="62" width="60" height="4" rx="2" fill="#2DE2C4" filter={`url(#glow${id})`} opacity="0.9" />
      <rect x="35" y="63" width="58" height="2" rx="1" fill="#2DE2C4" />
    </svg>
  );
}

export function Logo({
  variant = "full",
  size = 48,
  className,
}: {
  variant?: "mark" | "full";
  size?: number;
  className?: string;
}) {
  if (variant === "mark") return <LogoMark size={size} className={className} />;
  return (
    <div className={`flex flex-col items-center gap-4 ${className ?? ""}`}>
      <LogoMark size={size} />
      <div className="text-center">
        <div className="text-xl font-bold tracking-[0.18em] text-foreground sm:text-2xl">
          OMNI SAFE <span className="text-accent">360</span>
        </div>
        <div className="mt-1.5 text-[10px] font-medium tracking-[0.28em] text-muted-foreground sm:text-[11px]">
          CONTROLE INTELIGENTE DE ESTOQUE
        </div>
      </div>
    </div>
  );
}
