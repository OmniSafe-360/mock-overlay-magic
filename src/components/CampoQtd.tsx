import { useEffect, useState } from "react";
import { fmtQ } from "@/lib/deposito";

/** Campo de quantidade que aceita vírgula enquanto digita (ex.: "2," → "2,5"). */
export function CampoQtd({ valor, onValor, inteiro, minimo, ...rest }: {
  valor: number; onValor: (n: number) => void; inteiro: boolean; minimo: number;
  "aria-label": string; inputMode: "decimal" | "numeric"; className?: string;
}) {
  const [texto, setTexto] = useState(fmtQ(valor));
  const [editando, setEditando] = useState(false);
  useEffect(() => { if (!editando) setTexto(fmtQ(valor)); }, [valor, editando]);
  return (
    <input {...rest} value={texto}
      onFocus={() => setEditando(true)}
      onBlur={() => { setEditando(false); setTexto(fmtQ(valor)); }}
      onChange={(e) => {
        const t = inteiro ? e.target.value.replace(/\D/g, "") : e.target.value.replace(/[^\d,.]/g, "").replace(/\./g, ",").replace(/,(?=.*,)/g, "");
        setTexto(t);
        const n = Number(t.replace(",", "."));
        if (t !== "" && Number.isFinite(n) && n >= minimo) onValor(inteiro ? Math.round(n) : n);
      }} />
  );
}
