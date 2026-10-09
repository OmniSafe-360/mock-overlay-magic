/* App do funcionário "Omni Operação" (E1): entrada com o código de 6 números e o PIN de 4, e a tela inicial
 * com os botões grandes Receber mercadoria / Repor gôndola (E2 e E3).
 * O celular fica lembrado, mas o app pede o PIN toda vez que é aberto e depois de alguns minutos fora da tela. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Delete, Lock, Download, EllipsisVertical, LogOut, PackageOpen, RefreshCw, Share, ShoppingBasket, SquarePlus } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { ReceberMercadoria, type ApiReceber } from "@/components/ReceberMercadoria";
import { ReporGondola, type ApiRepor } from "@/components/ReporGondola";
import { Sheet } from "@/components/ProductArea";
import { abertoComoApp, adiado, adiar, dentroDoAppDono, enderecoFuncionario, instalar, jaInstalado, linkChromeAndroid, ouvirInstalacao, podeInstalarDireto, prepararInstalacaoFuncionario, tipoAparelho } from "@/lib/instalar";
import { TIPO_FROM_DB, btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import {
  NOME_APP_FUNCIONARIO, apagarChave, codigoTexto, fazReceber, fazRepor, guardarChave, lerChave, mensagemEntrada, nomeAparelho, pinFacil,
} from "@/lib/funcionario";

export type ApiFuncionario = {
  conferir: typeof banco.conferirCodigoFuncionario;
  entrar: typeof banco.entrarFuncionario;
  inicio: typeof banco.inicioFuncionario;
  desbloquear: typeof banco.desbloquearFuncionario;
  sair: typeof banco.sairFuncionario;
  receber?: ApiReceber | undefined;
  repor?: ApiRepor | undefined;
};
const API_PADRAO: ApiFuncionario = { conferir: banco.conferirCodigoFuncionario, entrar: banco.entrarFuncionario, inicio: banco.inicioFuncionario, desbloquear: banco.desbloquearFuncionario, sair: banco.sairFuncionario };

type Tela =
  | { t: "abrindo" }
  | { t: "codigo"; aviso?: string }
  | { t: "pin"; codigo: string; novo: boolean }
  | { t: "travado"; dados: banco.InicioFuncionario }
  | { t: "inicio"; dados: banco.InicioFuncionario }
  | { t: "receber" }
  | { t: "repor" }
  | { t: "erro" };

/** Minutos com o app fora da tela (minimizado, celular apagado) antes de pedir o PIN de novo. */
export const MINUTOS_PARA_TRAVAR = 5;

export function AppFuncionario({ codigoInicial, api = API_PADRAO }: { codigoInicial?: string | undefined; api?: ApiFuncionario }) {
  const [tela, setTela] = useState<Tela>({ t: "abrindo" });
  const ultimo = useRef<banco.InicioFuncionario | null>(null);
  const telaRef = useRef(tela);
  telaRef.current = tela;

  /** Abre a tela inicial; com `travar`, mostra antes a tela do PIN (ao abrir o app). */
  const abrirInicio = useCallback(async (chave: string, avisoSeDesligado = true, travar = false) => {
    try {
      const d = await api.inicio(chave);
      if (d) { ultimo.current = d; setTela({ t: travar || d.pinNecessario ? "travado" : "inicio", dados: d }); return; }
      apagarChave();
      setTela({ t: "codigo", ...(avisoSeDesligado ? { aviso: "Este celular saiu do app (o dono bloqueou ou gerou um acesso novo). Peça o código ao dono." } : {}) });
    } catch { setTela({ t: "erro" }); }
  }, [api]);

  useEffect(() => { prepararInstalacaoFuncionario(); }, []);
  useEffect(() => {
    const chave = lerChave();
    if (chave) { void abrirInicio(chave, true, true); return; }
    setTela({ t: "codigo" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Ficou fora da tela por alguns minutos: pede o PIN de novo ao voltar.
  useEffect(() => {
    let saiu: number | null = null;
    const mudou = () => {
      if (document.visibilityState === "hidden") { saiu = Date.now(); return; }
      const fora = saiu == null ? 0 : Date.now() - saiu;
      saiu = null;
      const t = telaRef.current.t;
      if (fora >= MINUTOS_PARA_TRAVAR * 60_000 && ultimo.current && lerChave() && t !== "codigo" && t !== "pin" && t !== "travado") {
        setTela({ t: "travado", dados: ultimo.current });
      }
    };
    document.addEventListener("visibilitychange", mudou);
    return () => document.removeEventListener("visibilitychange", mudou);
  }, []);
  const sair = async () => { const c = lerChave(); apagarChave(); ultimo.current = null; if (c) await api.sair(c).catch(() => {}); setTela({ t: "codigo" }); };

  return (
    <div className="min-h-dvh bg-app text-foreground">
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4 pb-6 pt-5">
        {tela.t === "abrindo" && <p className="m-auto text-base text-muted-foreground">Abrindo…</p>}
        {tela.t === "erro" && (
          <div className="m-auto w-full space-y-3 text-center">
            <p className="text-lg font-bold">Sem conexão</p>
            <p className="text-sm text-muted-foreground">Confira a internet do celular e tente de novo.</p>
            <button type="button" onClick={() => { const c = lerChave(); if (c) void abrirInicio(c); else setTela({ t: "codigo" }); }} className={btnPrimary(true)}>Tentar de novo</button>
          </div>
        )}
        {tela.t === "codigo" && (
          <TelaCodigo api={api} codigoInicial={codigoInicial} aviso={tela.aviso} onCodigo={(codigo, novo) => setTela({ t: "pin", codigo, novo })} />
        )}
        {tela.t === "pin" && (
          <TelaPin codigo={tela.codigo} novo={tela.novo} api={api} onVoltar={() => setTela({ t: "codigo" })}
            onEntrou={(chave) => { guardarChave(chave); void abrirInicio(chave, false); }} />
        )}
        {tela.t === "travado" && (
          <TelaTravado dados={tela.dados} api={api} onSair={sair}
            onDestravou={() => { const c = lerChave(); if (c) void abrirInicio(c); else setTela({ t: "codigo" }); }} />
        )}
        {tela.t === "receber" && (
          <ReceberMercadoria chave={lerChave() ?? ""} api={api.receber}
            onVoltar={() => { const c = lerChave(); if (c) void abrirInicio(c); else setTela({ t: "codigo" }); }} />
        )}
        {tela.t === "repor" && (
          <ReporGondola chave={lerChave() ?? ""} api={api.repor}
            onVoltar={() => { const c = lerChave(); if (c) void abrirInicio(c); else setTela({ t: "codigo" }); }} />
        )}
        {tela.t === "inicio" && (
          <TelaInicio dados={tela.dados} onReceber={() => setTela({ t: "receber" })} onRepor={() => setTela({ t: "repor" })} onAtualizar={async () => { const c = lerChave(); if (c) await abrirInicio(c); }}
            onSair={sair} />
        )}
      </main>
    </div>
  );
}

function Marca() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <LogoMark size={64} />
      <p className="text-xl font-bold">{NOME_APP_FUNCIONARIO}</p>
      <p className="text-sm text-muted-foreground">App da equipe · Omni Safe 360</p>
    </div>
  );
}

function TelaCodigo({ api, codigoInicial, aviso, onCodigo }: {
  api: ApiFuncionario; codigoInicial?: string | undefined; aviso?: string | undefined; onCodigo: (codigo: string, novo: boolean) => void;
}) {
  const inicial = /^\d{6}$/.test(codigoInicial ?? "") ? codigoInicial! : "";
  const [codigo, setCodigo] = useState(inicial);
  const [erro, setErro] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const tentouInicial = useRef(false);
  const conferir = async (c: string) => {
    if (c.length !== 6 || conferindo) return;
    setConferindo(true); setErro("");
    try {
      const r = await api.conferir(c);
      if (r === "novo" || r === "pin") { onCodigo(c, r === "novo"); return; }
      setErro(r === "expirado" ? "Este código venceu. Peça um código novo para o dono." : "Código não encontrado. Confira os 6 números com o dono.");
    } catch (e) { setErro(mensagemEntrada(e)); }
    setConferindo(false);
  };
  useEffect(() => {
    if (inicial && !tentouInicial.current) { tentouInicial.current = true; void conferir(inicial); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="my-auto space-y-6">
      <Marca />
      {aviso && <p role="status" className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">{aviso}</p>}
      <div className="space-y-2">
        <label htmlFor="codigo-func" className="block text-center text-base font-semibold">Digite o código que o dono te passou</label>
        <input id="codigo-func" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={codigoTexto(codigo)} placeholder="000 000"
          onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 6); setCodigo(d); setErro(""); if (d.length === 6) void conferir(d); }}
          className="h-16 w-full rounded-2xl border border-border bg-background-deep/60 text-center text-3xl font-bold tracking-[0.3em] text-foreground outline-none placeholder:text-muted-foreground/40 focus-visible:border-primary" />
        <p className="text-center text-xs text-muted-foreground">São 6 números. O dono vê o código na aba Equipe.</p>
      </div>
      {erro && <p role="alert" className="text-center text-sm font-semibold text-destructive">{erro}</p>}
      <button type="button" disabled={codigo.length !== 6 || conferindo} onClick={() => void conferir(codigo)} className={btnPrimary(codigo.length === 6 && !conferindo)}>
        {conferindo ? "Conferindo…" : "Continuar"}
      </button>
      <p className="text-center text-xs text-muted-foreground"><a href="/?dono" className="font-semibold text-primary">Sou o dono do comércio</a></p>
      <BotaoInstalar />
    </div>
  );
}

function TelaPin({ codigo, novo, api, onVoltar, onEntrou }: {
  codigo: string; novo: boolean; api: ApiFuncionario; onVoltar: () => void; onEntrou: (chave: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [primeiro, setPrimeiro] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const titulo = !novo ? "Digite seu PIN" : primeiro == null ? "Agora crie seu PIN" : "Digite o PIN de novo para confirmar";
  const ajuda = !novo ? "A sua senha de 4 números." : primeiro == null ? "Invente uma senha de 4 números, só sua. Não é o código do dono. Não conte para ninguém." : "";

  const completo = async (p: string) => {
    if (novo && primeiro == null) {
      if (pinFacil(p)) { setErro("Esse PIN é fácil de adivinhar. Escolha outro (sem repetir números e sem sequência)."); setPin(""); return; }
      setPrimeiro(p); setPin(""); setErro(""); return;
    }
    if (novo && primeiro !== p) { setErro("Os PINs não são iguais. Crie de novo."); setPrimeiro(null); setPin(""); return; }
    setEnviando(true); setErro("");
    try { onEntrou(await api.entrar(codigo, p, nomeAparelho())); }
    catch (e) { setErro(mensagemEntrada(e)); setPin(""); if (novo) setPrimeiro(null); setEnviando(false); }
  };
  const tecla = (d: string) => {
    if (enviando) return;
    const p = (pin + d).slice(0, 4);
    setPin(p); setErro("");
    if (p.length === 4) void completo(p);
  };
  return (
    <div className="my-auto space-y-6">
      <button type="button" onClick={onVoltar} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Código {codigoTexto(codigo)}</button>
      <p className="flex items-center justify-center gap-2 rounded-2xl border border-accent/50 bg-accent/10 p-2 text-sm font-semibold text-accent"><Check size={16} /> Código {codigoTexto(codigo)} conferido</p>
      <div className="space-y-1 text-center">
        <p className="text-xl font-bold">{titulo}</p>
        {ajuda && <p className="text-sm text-muted-foreground">{ajuda}</p>}
      </div>
      <TecladoPin pin={pin} erro={erro} ocupado={enviando ? "Entrando…" : ""} onTecla={tecla} onApagar={() => setPin((p) => p.slice(0, -1))} />
    </div>
  );
}

/** As 4 bolinhas, o erro e o teclado grande do PIN. */
function TecladoPin({ pin, erro, ocupado, onTecla, onApagar }: { pin: string; erro: string; ocupado: string; onTecla: (d: string) => void; onApagar: () => void }) {
  return (
    <>
      <div aria-label={`${pin.length} de 4 números digitados`} className="flex justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-5 w-5 rounded-full border-2 ${i < pin.length ? "border-primary bg-primary" : "border-border"}`} />
        ))}
      </div>
      {erro && <p role="alert" className="text-center text-sm font-semibold text-destructive">{erro}</p>}
      {ocupado && <p className="text-center text-sm text-muted-foreground">{ocupado}</p>}
      <div className="mx-auto grid max-w-[300px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => onTecla(d)} className="h-16 rounded-2xl border border-border bg-secondary/60 text-2xl font-bold active:scale-95">{d}</button>
        ))}
        <span />
        <button type="button" onClick={() => onTecla("0")} className="h-16 rounded-2xl border border-border bg-secondary/60 text-2xl font-bold active:scale-95">0</button>
        <button type="button" aria-label="Apagar" onClick={onApagar} className="flex h-16 items-center justify-center rounded-2xl text-muted-foreground active:scale-95"><Delete size={26} /></button>
      </div>
    </>
  );
}

/** App travado: o celular é conhecido, só falta o PIN. */
function TelaTravado({ dados, api, onDestravou, onSair }: { dados: banco.InicioFuncionario; api: ApiFuncionario; onDestravou: () => void; onSair: () => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const [sair, setSair] = useState(false);
  const tecla = (d: string) => {
    if (enviando) return;
    const p = (pin + d).slice(0, 4);
    setPin(p); setErro("");
    if (p.length !== 4) return;
    const chave = lerChave();
    if (!chave) { void onSair(); return; }
    setEnviando(true);
    void api.desbloquear(chave, p).then(onDestravou, (e: unknown) => {
      const m = String((e as { message?: string } | null)?.message ?? e ?? "");
      if (m.includes("acesso_encerrado")) { void onSair(); return; }
      setErro(mensagemEntrada(e)); setPin(""); setEnviando(false);
    });
  };
  return (
    <div className="my-auto space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <LogoMark size={56} />
        <p className="text-sm text-muted-foreground">{NOME_APP_FUNCIONARIO} · {dados.comercio.nome}</p>
      </div>
      <div className="space-y-1 text-center">
        <p className="text-2xl font-bold">Olá, {dados.nome.split(" ")[0]}!</p>
        <p className="flex items-center justify-center gap-2 text-xl font-bold"><Lock size={20} className="text-primary" /> Digite seu PIN</p>
        <p className="text-sm text-muted-foreground">A sua senha de 4 números.</p>
      </div>
      <TecladoPin pin={pin} erro={erro} ocupado={enviando ? "Abrindo…" : ""} onTecla={tecla} onApagar={() => setPin((p) => p.slice(0, -1))} />
      <div className="space-y-1 text-center">
        {!ajuda ? (
          <button type="button" onClick={() => setAjuda(true)} className="min-h-11 w-full text-sm font-semibold text-primary">Esqueci meu PIN</button>
        ) : (
          <p role="status" className="rounded-2xl border border-border p-3 text-sm">
            Peça ao dono: na <b>Equipe</b>, ele toca no seu nome e em <b>"Esqueceu o PIN ou trocou de celular?"</b>. Ele te passa um código novo e você cria outro PIN.
          </p>
        )}
        {!sair ? (
          <button type="button" onClick={() => setSair(true)} className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-muted-foreground"><LogOut size={16} /> Não sou {dados.nome.split(" ")[0]} · sair deste celular</button>
        ) : (
          <div className="space-y-2 rounded-2xl border border-border p-3 text-center">
            <p className="text-sm">Para entrar de novo, vai precisar do código e do PIN.</p>
            <button type="button" onClick={() => void onSair()} className={`w-full ${btnGhost}`}>Sim, sair</button>
            <button type="button" onClick={() => setSair(false)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
          </div>
        )}
      </div>
    </div>
  );
}

function TelaInicio({ dados, onAtualizar, onSair, onReceber, onRepor }: { dados: banco.InicioFuncionario; onAtualizar: () => Promise<void>; onSair: () => Promise<void>; onReceber: () => void; onRepor: () => void }) {
  const [sair, setSair] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const tipo = TIPO_FROM_DB[dados.comercio.tipo] ?? dados.comercio.tipo;
  const nomeRepor = tipo === "mercado" || tipo === "pet" ? "Repor gôndola" : "Repor área de venda";
  const atualizar = () => { setAtualizando(true); void onAtualizar().finally(() => setAtualizando(false)); };
  // Atualiza os números sozinho a cada minuto, com a tela aberta.
  useEffect(() => { const t = setInterval(() => { void onAtualizar(); }, 60_000); return () => clearInterval(t); }, [onAtualizar]);
  const a = dados.avisos;
  const entregasTxt = a.entregasHoje > 0 ? (a.entregasHoje === 1 ? "1 entrega prevista para hoje" : `${a.entregasHoje} entregas previstas para hoje`)
    : a.entregas > 0 ? (a.entregas === 1 ? "1 entrega a caminho" : `${a.entregas} entregas a caminho`) : "Nenhuma entrega esperada";
  const reporTxt = a.repor > 0 ? (a.repor === 1 ? "1 produto pedindo reposição" : `${a.repor} produtos pedindo reposição`) : "Tudo abastecido";
  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="flex items-center gap-3">
        <LogoMark size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{NOME_APP_FUNCIONARIO}</p>
          <p className="truncate text-base font-bold">{dados.comercio.nome}</p>
        </div>
        <button type="button" onClick={atualizar} aria-label="Atualizar" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border text-muted-foreground">
          <RefreshCw size={20} className={atualizando ? "animate-spin" : ""} />
        </button>
      </header>
      <p className="text-2xl font-bold">Olá, {dados.nome.split(" ")[0]}!</p>
      <CartaoInstalar />

      <div className="grid flex-1 grid-cols-1 content-start gap-4">
        {fazReceber(dados.funcao) && (
          <BotaoGrande icone={<PackageOpen size={40} />} titulo="Receber mercadoria" detalhe={entregasTxt} destaque={a.entregasHoje > 0 ? "atencao" : null}
            numero={a.entregasHoje || a.entregas} onClick={onReceber} />
        )}
        {fazRepor(dados.funcao) && (
          <BotaoGrande icone={<ShoppingBasket size={40} />} titulo={nomeRepor} detalhe={reporTxt} destaque={a.repor > 0 ? "urgente" : null}
            numero={a.repor} onClick={onRepor} />
        )}
      </div>

      <footer className="space-y-2 pt-2">
        <BotaoInstalar />
        {!sair ? (
          <button type="button" onClick={() => setSair(true)} className="flex min-h-12 w-full items-center justify-center gap-2 text-sm font-semibold text-muted-foreground"><LogOut size={16} /> Sair deste celular</button>
        ) : (
          <div className="space-y-2 rounded-2xl border border-border p-3 text-center">
            <p className="text-sm">Para entrar de novo, você vai precisar do código e do PIN.</p>
            <button type="button" onClick={() => void onSair()} className={`w-full ${btnGhost}`}>Sim, sair</button>
            <button type="button" onClick={() => setSair(false)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
          </div>
        )}
      </footer>
    </div>
  );
}

function BotaoGrande({ icone, titulo, detalhe, numero, destaque, onClick }: {
  icone: ReactNode; titulo: string; detalhe: string; numero: number; destaque: "urgente" | "atencao" | null; onClick: () => void;
}) {
  const cor = destaque === "urgente" ? "border-destructive/60 bg-destructive/10" : destaque === "atencao" ? "border-warning/60 bg-warning/10" : "border-border bg-secondary/60";
  const bolinha = destaque === "urgente" ? "bg-destructive text-white" : destaque === "atencao" ? "bg-warning text-background" : "bg-secondary text-muted-foreground";
  return (
    <button type="button" onClick={onClick} className={`relative flex min-h-[150px] w-full flex-col justify-between rounded-3xl border-2 p-5 text-left transition active:scale-[0.98] ${cor}`}>
      <span className="flex items-start justify-between">
        <span className="text-primary">{icone}</span>
        {numero > 0 && <span aria-hidden className={`flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-lg font-bold ${bolinha}`}>{numero}</span>}
      </span>
      <span>
        <span className="block text-2xl font-bold">{titulo}</span>
        <span className="block text-base text-muted-foreground">{detalhe}</span>
      </span>
    </button>
  );
}

/** Instalar o app: um toque quando o navegador permite; senão, o passo a passo. */
function useInstalar() {
  const [, atualizar] = useState(0);
  const [passos, setPassos] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => ouvirInstalacao(() => atualizar((n) => n + 1)), []);
  const acionar = () => { if (podeInstalarDireto()) void instalar().then((v) => { if (v) setOk(true); else setPassos(true); }); else setPassos(true); };
  const sheet = passos ? <PassosInstalar onClose={() => setPassos(false)} /> : null;
  return { acionar, sheet, ok };
}

/** Botão discreto e sempre visível (tela do código e rodapé da tela inicial), enquanto não estiver aberto como app. */
function BotaoInstalar() {
  const { acionar, sheet, ok } = useInstalar();
  if ((abertoComoApp() && !dentroDoAppDono()) || ok) return null;
  return (
    <>
      <button type="button" onClick={acionar} className="flex min-h-12 w-full items-center justify-center gap-2 text-sm font-semibold text-primary"><Download size={16} /> Instalar o app no celular</button>
      {sheet}
    </>
  );
}

/** "Instale o app": aparece depois do acesso, enquanto o app não estiver instalado. */
function CartaoInstalar() {
  const { acionar, sheet, ok } = useInstalar();
  const [fechado, setFechado] = useState(() => (abertoComoApp() && !dentroDoAppDono()) || jaInstalado() || adiado());
  if (ok) return <p role="status" className="rounded-2xl border border-accent/50 bg-accent/10 p-3 text-sm font-semibold text-accent">Pronto! O Omni Operação está na tela inicial do seu celular.</p>;
  if (fechado) return null;
  return (
    <section aria-label="Instalar o app" className="rounded-3xl border border-primary/50 bg-primary/10 p-4">
      <p className="flex items-center gap-2 text-base font-bold"><Download size={20} className="text-primary" /> Instale o app no celular</p>
      <p className="mt-1 text-sm text-muted-foreground">Ele fica na tela inicial, abre direto aqui e funciona como um aplicativo.</p>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <button type="button" className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`} onClick={acionar}><Download size={20} /> Instalar o app</button>
        <button type="button" onClick={() => { adiar(); setFechado(true); }} className="min-h-11 text-sm font-semibold text-muted-foreground">Agora não</button>
      </div>
      {sheet}
    </section>
  );
}

function PassosInstalar({ onClose }: { onClose: () => void }) {
  const aparelho = tipoAparelho();
  const [copiado, setCopiado] = useState(false);
  const noAppDono = dentroDoAppDono();
  return (
    <Sheet title="Instalar o Omni Operação" onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3 text-base">
        {noAppDono ? (
          <>
            <p>Você está dentro do <b>app do dono</b> (Omni Safe 360). Para instalar o app do funcionário, abra este endereço no <b>{aparelho === "iphone" ? "Safari" : "Chrome"}</b>:</p>
            <p className="break-all rounded-2xl border border-border bg-background-deep/60 p-3 text-sm font-semibold">{enderecoFuncionario()}</p>
            <div className="grid grid-cols-1 gap-2">
              {aparelho === "android" && <a href={linkChromeAndroid()} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}>Abrir no Chrome</a>}
              <button type="button" className={`flex items-center justify-center gap-2 ${btnGhost}`}
                onClick={() => { void navigator.clipboard?.writeText(enderecoFuncionario()).then(() => setCopiado(true)).catch(() => setCopiado(false)); }}>
                {copiado ? "Endereço copiado!" : "Copiar endereço"}
              </button>
            </div>
            <p className="text-sm text-muted-foreground">No navegador, entre com o código e o PIN e toque em "Instalar o app".</p>
          </>
        ) : aparelho === "iphone" ? (
          <ol className="space-y-3">
            <li className="flex gap-3"><b className="text-primary">1.</b><span>Abra esta página no <b>Safari</b>.</span></li>
            <li className="flex gap-3"><b className="text-primary">2.</b><span>Toque em <b>Compartilhar</b> <Share size={18} className="inline align-text-bottom" /> (o quadrado com a seta para cima, embaixo da tela).</span></li>
            <li className="flex gap-3"><b className="text-primary">3.</b><span>Role e toque em <b>Adicionar à Tela de Início</b> <SquarePlus size={18} className="inline align-text-bottom" />.</span></li>
            <li className="flex gap-3"><b className="text-primary">4.</b><span>Toque em <b>Adicionar</b>. Pronto: o ícone aparece na tela inicial.</span></li>
          </ol>
        ) : (
          <ol className="space-y-3">
            <li className="flex gap-3"><b className="text-primary">1.</b><span>Toque nos <b>três pontinhos</b> <EllipsisVertical size={18} className="inline align-text-bottom" /> do navegador (em cima, à direita).</span></li>
            <li className="flex gap-3"><b className="text-primary">2.</b><span>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</span></li>
            <li className="flex gap-3"><b className="text-primary">3.</b><span>Confirme. O ícone do Omni Operação aparece na tela inicial.</span></li>
          </ol>
        )}
        {!noAppDono && <p className="text-sm text-muted-foreground">{aparelho === "iphone"
          ? "Depois é só abrir pelo ícone. Na primeira vez pelo ícone, digite o código e o seu PIN de novo."
          : "Depois é só abrir pelo ícone e digitar o seu PIN."}</p>}
      </div>
      <div className="px-5 pt-2"><button type="button" onClick={onClose} className={`w-full ${btnGhost}`}>Entendi</button></div>
    </Sheet>
  );
}
