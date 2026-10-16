/* P5: no app do dono, controles da página do cliente do fiado: último acesso, novo link e zerar PIN. */
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Link2 } from "lucide-react";
import { acessoInfo, novoLinkCliente, zerarPinCliente, type InfoAcesso } from "@/lib/fiadoCliente";

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(",", " às");

type Api = { acessoInfo: typeof acessoInfo; novoLinkCliente: typeof novoLinkCliente; zerarPinCliente: typeof zerarPinCliente };
// Criado uma vez só: um objeto novo a cada desenho fazia a consulta repetir sem parar.
const API_PADRAO: Api = { acessoInfo, novoLinkCliente, zerarPinCliente };

export function AcessoClienteFiado({ clienteId, api = API_PADRAO }: { clienteId: string; api?: Api }) {
  const [info, setInfo] = useState<InfoAcesso | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [confirmar, setConfirmar] = useState<"link" | "pin" | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Só a consulta mais recente, com a tela ainda aberta, muda o que aparece.
  const vez = useRef(0);
  const ler = useCallback(() => {
    const minha = ++vez.current;
    setErro("");
    api.acessoInfo(clienteId).then(
      (i) => { if (vez.current === minha) setInfo(i); },
      () => { if (vez.current === minha) setErro("Não foi possível ler o acesso do cliente. Confira a internet."); },
    );
  }, [api, clienteId]);
  useEffect(() => { ler(); return () => { vez.current++; }; }, [ler]);
  const fazer = async (q: "link" | "pin") => {
    setOcupado(true); setErro(""); setOk("");
    try {
      if (q === "link") { await api.novoLinkCliente(clienteId); setOk("Link novo criado. O antigo não abre mais. Mande a conta de novo pelo WhatsApp."); }
      else { await api.zerarPinCliente(clienteId); setOk("PIN apagado. Na próxima vez, o cliente cria um PIN novo."); }
      setConfirmar(null); ler();
    } catch { setErro("Não deu certo. Confira a internet e tente de novo."); }
    finally { setOcupado(false); }
  };
  const btn = "flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border text-sm font-semibold disabled:opacity-60";
  return (
    <div className="space-y-2 rounded-3xl border border-border p-4" aria-label="Página do cliente">
      <p className="text-sm font-semibold">Página do cliente</p>
      {info && <p className="text-xs text-muted-foreground">
        {!info.temLink ? "Ainda não recebeu o link." : !info.temPin ? "Recebeu o link, mas ainda não criou o PIN." : info.ultimoAcesso ? `Entrou pela última vez em ${dataHora(info.ultimoAcesso)}.` : "Criou o PIN."}
      </p>}
      {ok && <p role="status" className="text-xs font-semibold text-accent">{ok}</p>}
      {erro && <p role="alert" className="text-xs font-semibold text-destructive">{erro}</p>}
      {confirmar ? (
        <div className="space-y-2 rounded-2xl bg-secondary/40 p-3">
          <p className="text-sm">{confirmar === "link" ? "O link que o cliente tem vai parar de funcionar. Continuar?" : "O cliente vai precisar criar um PIN novo. Continuar?"}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={ocupado} onClick={() => setConfirmar(null)} className={btn}>Cancelar</button>
            <button type="button" disabled={ocupado} onClick={() => void fazer(confirmar)} className={`${btn} border-primary text-primary`}>{ocupado ? "Aguarde…" : "Sim, continuar"}</button>
          </div>
        </div>
      ) : info?.temLink && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { setOk(""); setConfirmar("link"); }} className={btn}><Link2 size={16} /> Gerar novo link</button>
          <button type="button" disabled={!info.temPin} onClick={() => { setOk(""); setConfirmar("pin"); }} className={btn}><KeyRound size={16} /> Zerar PIN</button>
        </div>
      )}
    </div>
  );
}
