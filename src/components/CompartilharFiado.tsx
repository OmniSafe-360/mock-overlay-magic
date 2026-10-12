/* P3: botão que monta a mensagem completa do fiado (com o link da conta do cliente) e abre o WhatsApp. */
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { btnGhost } from "@/components/StoreSetup";
import { linkFiadoCliente, linkWhats } from "@/lib/fiado";

export function CompartilharFiado({ telefone, montar, rotulo = "Mandar a conta no WhatsApp" }: {
  telefone: string | null;
  /** Busca o link e devolve o texto pronto. */
  montar: (link: (token: string) => string) => Promise<string>;
  rotulo?: string;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const abrir = async () => {
    setOcupado(true); setErro("");
    try {
      const texto = await montar((t) => linkFiadoCliente(t));
      window.location.href = linkWhats(telefone, texto);
    } catch { setErro("Não foi possível preparar a mensagem. Confira a internet e tente de novo."); }
    finally { setOcupado(false); }
  };
  return (
    <div className="space-y-1">
      <button type="button" disabled={ocupado} onClick={() => void abrir()} className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}>
        <MessageCircle size={18} /> {ocupado ? "Preparando…" : rotulo}
      </button>
      {erro && <p role="alert" className="text-center text-xs font-semibold text-destructive">{erro}</p>}
    </div>
  );
}
