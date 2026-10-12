/* "Instalar o Omni Safe Cliente" na página do fiado do cliente.
 * Link aberto dentro do WhatsApp (sem barra do navegador): não dá para instalar ali; mostra na hora como abrir no navegador. */
import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { abertoComoApp, instalar, linkChromeAndroid, ouvirInstalacao, podeInstalarDireto, tipoAparelho } from "@/lib/instalar";

/** Aberto dentro de outro app (WhatsApp, Instagram, Facebook...) e não no navegador. */
export function dentroDeOutroApp(ua = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  return /WhatsApp|FBAN|FBAV|Instagram|; wv\)/i.test(ua) || (/iPhone|iPad|iPod/i.test(ua) && !/Safari\//i.test(ua));
}

const MARCA = "omni.fiado.app_cliente";
/** Aberto pelo ícone do Omni Safe Cliente (o manifesto abre com ?app=cliente). */
function abertoPeloCliente() {
  try {
    if (new URLSearchParams(window.location.search).get("app") === "cliente") sessionStorage.setItem(MARCA, "1");
    return sessionStorage.getItem(MARCA) === "1";
  } catch { return false; }
}

export function InstalarCliente({ token }: { token: string }) {
  const [pronto, setPronto] = useState(false);
  const [direto, setDireto] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const [preso, setPreso] = useState(false);
  const [noAppDono, setNoAppDono] = useState(false);
  useEffect(() => {
    const app = abertoComoApp();
    const cliente = app && abertoPeloCliente();
    // Com o Omni Safe 360 instalado, o Android abre o link do WhatsApp dentro dele (tela cheia, sem navegador).
    setPronto(!cliente);
    setNoAppDono(app && !cliente);
    setPreso(dentroDeOutroApp() || (app && !cliente));
    setDireto(podeInstalarDireto());
    return ouvirInstalacao(() => setDireto(podeInstalarDireto()));
  }, []);
  if (!pronto) return null;
  const aparelho = tipoAparelho();
  const caminho = `/fiado/${token}`;
  const endereco = typeof window === "undefined" ? caminho : `${window.location.origin}${caminho}`;

  if (preso) {
    return (
      <div className="rounded-2xl border border-primary/50 bg-primary/10 p-4">
        <p className="font-bold">Instale o Omni Safe Cliente</p>
        {aparelho === "android" ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">{noAppDono ? "O link abriu dentro do app Omni Safe 360. Para instalar o Omni Safe Cliente, abra no Chrome:" : "Dentro do WhatsApp não dá para instalar. Abra no Chrome:"}</p>
            <a href={linkChromeAndroid(caminho)} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground">
              <ExternalLink size={18} /> Abrir no Chrome e instalar
            </a>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">{noAppDono ? "O link abriu dentro de outro app. " : "Dentro do WhatsApp não dá para instalar. "}Toque nos <b>três pontinhos</b> ou no ícone da bússola e escolha <b>Abrir no Safari</b>. Depois: Compartilhar → <b>Adicionar à Tela de Início</b>.</p>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(endereco)} className="mt-3 h-11 w-full rounded-2xl border border-border font-semibold">Copiar o link</button>
          </>
        )}
      </div>
    );
  }

  const tocar = async () => {
    if (direto && (await instalar())) { setPronto(false); return; }
    setAjuda(true);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <button type="button" onClick={() => void tocar()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground">
        <Download size={18} /> Instalar o Omni Safe Cliente
      </button>
      {(ajuda || aparelho === "iphone") && (
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          {aparelho === "iphone" ? (
            <p>No Safari, toque em <b>Compartilhar</b> (quadrado com seta) e escolha <b>Adicionar à Tela de Início</b>.</p>
          ) : (
            <p>No Chrome, toque no menu <b>⋮</b> e escolha <b>Instalar app</b>.</p>
          )}
          <p>Na primeira vez pelo ícone, digite seu PIN.</p>
        </div>
      )}
    </div>
  );
}
