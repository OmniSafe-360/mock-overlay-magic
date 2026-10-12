/* Botão "Instalar o Omni Safe Cliente" na página do fiado do cliente (Android: um toque; iPhone: passo a passo). */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { abertoComoApp, instalar, linkChromeAndroid, ouvirInstalacao, podeInstalarDireto, tipoAparelho } from "@/lib/instalar";

export function InstalarCliente({ token }: { token: string }) {
  const [pronto, setPronto] = useState(false);
  const [direto, setDireto] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  useEffect(() => {
    setPronto(!abertoComoApp());
    setDireto(podeInstalarDireto());
    return ouvirInstalacao(() => setDireto(podeInstalarDireto()));
  }, []);
  if (!pronto) return null;
  const aparelho = tipoAparelho();
  const caminho = `/fiado/${token}`;

  const tocar = async () => {
    if (direto && (await instalar())) { setPronto(false); return; }
    setAjuda(true);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <button type="button" onClick={() => void tocar()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/50 font-semibold text-primary">
        <Download size={18} /> Instalar o Omni Safe Cliente
      </button>
      {ajuda && (
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          {aparelho === "iphone" ? (
            <ol className="list-decimal space-y-1 pl-5">
              <li>Abra este link no <b>Safari</b>.</li>
              <li>Toque em <b>Compartilhar</b> (quadrado com seta para cima).</li>
              <li>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</li>
            </ol>
          ) : (
            <>
              <p>No Chrome, toque no menu <b>⋮</b> e escolha <b>Instalar app</b> (ou "Adicionar à tela inicial").</p>
              {aparelho === "android" && (
                <p>Abriu dentro de outro app? <a href={linkChromeAndroid(caminho)} className="font-semibold text-primary underline">Abrir no Chrome</a></p>
              )}
            </>
          )}
          <p>Na primeira vez pelo ícone, digite seu PIN.</p>
        </div>
      )}
    </div>
  );
}
