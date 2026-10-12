/* Página que o cliente do fiado abre pelo link (P2): cria/digita o PIN e vê a própria conta. Só leitura. */
import { useEffect, useState } from "react";
import { AlertTriangle, Bell, MessageCircle, Phone } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { btnPrimary } from "@/components/StoreSetup";
import { avisosFiado, chaveVisto, fiadoEntrar, fiadoEstado, fiadoExtrato, mensagemEntrarFiado, textoMov, type EstadoFiado, type ExtratoFiado } from "@/lib/fiadoCliente";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (ts: string) => {
  const d = new Date(ts);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};
const dias = (ts: string) => Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 86400000));
const chaveSessao = (t: string) => `omni.fiado.sessao:${t.slice(0, 16)}`;
const lerSessao = (t: string) => { try { return sessionStorage.getItem(chaveSessao(t)); } catch { return null; } };
const gravarSessao = (t: string, s: string | null) => { try { if (s) sessionStorage.setItem(chaveSessao(t), s); else sessionStorage.removeItem(chaveSessao(t)); } catch { /* sem armazenamento */ } };

type Tela = { t: "carregando" } | { t: "erro" } | { t: "invalido" } | { t: "pin"; e: Extract<EstadoFiado, { estado: "novo" | "pin" }> } | { t: "conta"; x: ExtratoFiado };

export function PaginaFiadoCliente({ token }: { token: string }) {
  const [tela, setTela] = useState<Tela>({ t: "carregando" });

  const abrir = async () => {
    setTela({ t: "carregando" });
    try {
      const s = lerSessao(token);
      if (s) {
        const x = await fiadoExtrato(token, s);
        if (x !== "pin") { setTela({ t: "conta", x }); return; }
        gravarSessao(token, null);
      }
      const e = await fiadoEstado(token);
      setTela(e.estado === "invalido" ? { t: "invalido" } : { t: "pin", e });
    } catch { setTela({ t: "erro" }); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void abrir(); }, [token]);

  return (
    <div className="min-h-dvh bg-app text-foreground">
      <main className="mx-auto max-w-[520px] space-y-4 px-4 pb-10 pt-5">
        <div className="flex h-11 items-center gap-2 text-sm font-semibold text-muted-foreground"><LogoMark size={28} /> Omni Safe Cliente</div>
        {tela.t === "carregando" && <p className="py-16 text-center text-base text-muted-foreground">Abrindo sua conta…</p>}
        {tela.t === "invalido" && <Aviso titulo="Este link não vale mais" texto="Peça um link novo ao comércio." />}
        {tela.t === "erro" && (
          <div className="space-y-3">
            <Aviso titulo="Não conseguimos abrir" texto="Confira a internet e tente de novo." />
            <button type="button" onClick={() => void abrir()} className={btnPrimary(true)}>Tentar de novo</button>
          </div>
        )}
        {tela.t === "pin" && (
          <TelaPin token={token} e={tela.e} onEntrou={(s) => { gravarSessao(token, s); void abrir(); }} />
        )}
        {tela.t === "conta" && <Conta token={token} x={tela.x} onSair={() => { gravarSessao(token, null); void abrir(); }} />}
      </main>
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <AlertTriangle size={30} className="mx-auto text-destructive" />
      <h1 className="mt-3 text-xl font-bold">{titulo}</h1>
      <p className="mt-2 text-base text-muted-foreground">{texto}</p>
    </div>
  );
}

function TelaPin({ token, e, onEntrou }: { token: string; e: Extract<EstadoFiado, { estado: "novo" | "pin" }>; onEntrou: (s: string) => void }) {
  const novo = e.estado === "novo";
  const [tel, setTel] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const so4 = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  const entrar = async () => {
    setErro(null);
    if (novo && e.temTelefone && tel.length !== 4) return setErro("Digite os 4 últimos números do seu telefone.");
    if (pin.length !== 4) return setErro("O PIN tem 4 números.");
    if (novo && pin !== pin2) return setErro("Os dois PINs não são iguais.");
    setEnviando(true);
    try {
      const r = await fiadoEntrar(token, tel, pin);
      if (r.ok) onEntrou(r.sessao); else { setErro(mensagemEntrarFiado(r.erro, r.restam)); setPin(""); setPin2(""); }
    } catch { setErro("Sem conexão. Confira a internet e tente de novo."); }
    finally { setEnviando(false); }
  };

  const campo = "h-14 w-full rounded-2xl border border-border bg-card px-4 text-center text-2xl tracking-[0.5em] outline-none focus:border-primary";
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <p className="text-sm text-muted-foreground">{e.comercio}</p>
        <h1 className="mt-1 text-2xl font-bold">Olá{e.cliente ? `, ${e.cliente}` : ""}!</h1>
        <p className="mt-2 text-base text-muted-foreground">
          {novo ? "Aqui você vê quanto deve no fiado. Na primeira vez, crie uma senha de 4 números (o PIN)." : "Digite seu PIN para ver sua conta."}
        </p>
      </div>
      {e.travadoAte && <p className="rounded-xl bg-destructive/15 p-3 text-sm text-destructive">Muitas tentativas. Espere 15 minutos e tente de novo.</p>}
      {novo && e.temTelefone && (
        <label className="block space-y-1">
          <span className="text-sm font-medium">4 últimos números do seu telefone</span>
          <input inputMode="numeric" autoComplete="off" value={tel} onChange={(v) => setTel(so4(v.target.value))} className={campo} />
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-medium">{novo ? "Crie seu PIN" : "Seu PIN"}</span>
        <input inputMode="numeric" type="password" autoComplete="off" value={pin} onChange={(v) => setPin(so4(v.target.value))} className={campo} />
      </label>
      {novo && (
        <label className="block space-y-1">
          <span className="text-sm font-medium">Digite o PIN de novo</span>
          <input inputMode="numeric" type="password" autoComplete="off" value={pin2} onChange={(v) => setPin2(so4(v.target.value))} className={campo} />
        </label>
      )}
      {erro && <p role="alert" className="text-sm font-medium text-destructive">{erro}</p>}
      <button type="button" disabled={enviando} onClick={() => void entrar()} className={btnPrimary(!enviando)}>
        {enviando ? "Conferindo…" : novo ? "Criar PIN e ver minha conta" : "Entrar"}
      </button>
      {!novo && <p className="text-center text-sm text-muted-foreground">Esqueceu o PIN? Peça ao comércio para apagar e crie outro.</p>}
    </div>
  );
}

function Conta({ token, x, onSair }: { token: string; x: ExtratoFiado; onSair: () => void }) {
  const [avisos, setAvisos] = useState<ReturnType<typeof avisosFiado>>([]);
  const [balao, setBalao] = useState(false);
  useEffect(() => {
    let visto: string | null = null;
    try { visto = localStorage.getItem(chaveVisto(token)); } catch { /* sem armazenamento */ }
    const a = avisosFiado(x, visto);
    setAvisos(a);
    setBalao(a.length > 0);
    try { localStorage.setItem(chaveVisto(token), new Date().toISOString()); } catch { /* sem armazenamento */ }
  }, [token, x]);
  const tel = x.telefoneComercio.replace(/\D/g, "");
  const podeComprar = x.limite != null ? Math.max(0, x.limite - x.deve) : null;
  return (
    <div className="space-y-4">
      <div className="-mt-[60px] flex justify-end">
        <button type="button" onClick={() => setBalao((b) => !b)} aria-label={`Notificações${avisos.length ? `: ${avisos.length}` : ""}`} className="relative flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
          <Bell size={20} />
          {avisos.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">{avisos.length}</span>}
        </button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">{x.comercio} · {x.cliente}</p>
        <p className="mt-3 text-base font-medium">{x.deve > 0 ? "Total que você deve" : "Você não deve nada"}</p>
        <p className={`text-4xl font-bold ${x.deve > 0 ? "text-destructive" : "text-primary"}`}>{brl(x.deve)}</p>
        {x.deve > 0 && x.desde && <p className="mt-1 text-sm text-muted-foreground">Devendo desde {new Date(x.desde).toLocaleDateString("pt-BR")} (há {dias(x.desde)} dia{dias(x.desde) === 1 ? "" : "s"})</p>}
        {x.bloqueado && <p className="mt-3 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">Compras no fiado estão pausadas. Fale com o comércio.</p>}
        {!x.bloqueado && podeComprar != null && <p className="mt-3 text-sm">Seu limite é {brl(x.limite!)}. Ainda pode comprar {brl(podeComprar)}.</p>}
      </div>

      {balao && (
        <div className="relative rounded-2xl border border-border bg-card p-4 shadow-lg" aria-label="Notificações">
          <div className="absolute -top-2 right-5 h-4 w-4 rotate-45 border-l border-t border-border bg-card" />
          <p className="mb-2 text-sm font-bold">Notificações</p>
          {avisos.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma novidade.</p>}
          <ul className="space-y-2">
            {avisos.map((a, i) => (
              <li key={i} className={`rounded-xl border p-3 text-sm font-medium ${a.tipo === "pagamento" ? "border-primary/40 bg-primary/10" : a.tipo === "antiga" ? "border-destructive/40 bg-destructive/10" : "border-border bg-background/40"}`}>{a.texto}</li>
            ))}
          </ul>
        </div>
      )}

      {tel && (
        <div className="grid grid-cols-2 gap-2">
          {x.whatsapp && (
            <a href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card font-semibold">
              <MessageCircle size={18} /> WhatsApp
            </a>
          )}
          <a href={`tel:${tel}`} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card font-semibold ${x.whatsapp ? "" : "col-span-2"}`}>
            <Phone size={18} /> Ligar
          </a>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Compras e pagamentos</h2>
        {x.movimentos.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nada por aqui ainda.</p>}
        <ul className="mt-2 divide-y divide-border">
          {x.movimentos.map((m, i) => (
            <li key={i} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{textoMov(m)}</p>
                  <p className="text-sm text-muted-foreground">{dataHora(m.criadoEm)}</p>
                </div>
                <p className={`shrink-0 font-bold ${m.tipo === "compra" ? "text-destructive" : "text-primary"}`}>{m.tipo === "compra" ? "+" : "−"} {brl(m.valor)}</p>
              </div>
              {m.itens.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  {m.itens.map((it, j) => <li key={j}>{String(it.qtd).replace(".", ",")} × {it.descricao} · {brl(it.valor)}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={onSair} className="w-full py-2 text-center text-sm text-muted-foreground underline">Sair</button>
    </div>
  );
}
