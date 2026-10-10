/* Aba Equipe (E1): o dono cadastra os funcionários do comércio e dá o acesso ao app "Omni Operação"
 * (QR Code ou código de 6 números + PIN que o funcionário cria). Bloquear e "Novo acesso" desligam o celular na hora. */
import { useCallback, useEffect, useState } from "react";
import { Ban, Check, Copy, KeyRound, LockKeyhole, MessageCircle, Pencil, ShieldCheck, ShoppingCart, Smartphone, UserPlus, Users } from "lucide-react";
import { Sheet } from "@/components/parts/Sheet";
import { QrCode } from "@/components/QrCode";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import {
  FUNCAO_TXT, FUNCOES, HORAS_CODIGO, NOME_APP_FUNCIONARIO, codigoTexto, linkAcesso, pinFacil, quandoTexto, situacaoFuncionario, validadeCodigoTexto,
  type Funcao, type Funcionario, type SituacaoFuncionario,
} from "@/lib/funcionario";
import { mensagemErro } from "@/lib/persistencia";

export type ApiEquipe = {
  carregar: (comercioId: string) => Promise<Funcionario[]>;
  criar: (comercioId: string, nome: string, funcao: Funcao) => Promise<{ id: string; codigo: string }>;
  atualizar: (id: string, nome: string, funcao: Funcao) => Promise<unknown>;
  bloquear: (id: string, bloquear: boolean) => Promise<string | null>;
  novoAcesso: (id: string) => Promise<string>;
  /** Liga ou desliga a função Caixa (vender pelo celular). */
  caixa?: ((id: string, ligado: boolean) => Promise<unknown>) | undefined;
  /** PIN do dono (autoriza cancelar venda e tirar dinheiro do caixa no celular do funcionário). */
  temPin?: (() => Promise<boolean>) | undefined;
  definirPin?: ((pin: string) => Promise<unknown>) | undefined;
};
const API_PADRAO: ApiEquipe = {
  carregar: banco.carregarFuncionarios, criar: banco.criarFuncionario, atualizar: banco.atualizarFuncionario,
  bloquear: banco.bloquearFuncionario, novoAcesso: banco.novoAcessoFuncionario, caixa: banco.definirCaixaFuncionario,
  temPin: banco.temPinDono, definirPin: banco.definirPinDono,
};
const erroTexto = (e: unknown) => mensagemErro(e).replace("Seus dados continuam no formulário. ", "");

const SIT: Record<SituacaoFuncionario, { txt: string; cor: string }> = {
  aguardando: { txt: "Aguardando primeiro acesso", cor: "border-warning/60 text-warning" },
  expirado: { txt: "Código venceu", cor: "border-destructive/60 text-destructive" },
  ativo: { txt: "Ativo", cor: "border-accent/60 text-accent" },
  bloqueado: { txt: "Bloqueado", cor: "border-border text-muted-foreground" },
};
const iniciais = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export function PainelEquipe({ comercioId, comercioNome, api = API_PADRAO, titulo = false }: {
  comercioId: string; comercioNome: string; api?: ApiEquipe; titulo?: boolean;
}) {
  const [lista, setLista] = useState<Funcionario[] | null>(null);
  const [erroCarga, setErroCarga] = useState(false);
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const recarregar = useCallback(() => api.carregar(comercioId).then((l) => { setLista(l); setErroCarga(false); return l; }).catch(() => { setErroCarga(true); return null; }), [api, comercioId]);
  useEffect(() => { void recarregar(); }, [recarregar]);
  const sel = lista?.find((f) => f.id === aberto);

  return (
    <section aria-label={`Equipe de ${comercioNome}`} className="space-y-4 animate-in fade-in duration-300">
      {titulo && <h2 className="text-lg font-bold">{comercioNome}</h2>}
      {!titulo && (
        <div className="rounded-3xl border border-border bg-secondary/40 p-4">
          <p className="flex items-center gap-2 text-base font-bold"><Users size={20} className="text-primary" /> Equipe</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Os funcionários usam o app <b className="text-foreground">{NOME_APP_FUNCIONARIO}</b> no próprio celular para receber mercadoria, repor a gôndola e vender no caixa.
            Eles nunca veem preços nem quanto deveria ter.
          </p>
        </div>
      )}
      <button type="button" onClick={() => setNovo(true)} className={`flex w-full items-center justify-center gap-2 ${btnPrimary(true)}`}><UserPlus size={20} /> Adicionar funcionário</button>
      {lista?.some((f) => f.caixa) && api.temPin && api.definirPin && <PinDono temPin={api.temPin} definirPin={api.definirPin} />}

      {lista === null && !erroCarga && <p className="py-6 text-center text-sm text-muted-foreground">Carregando a equipe…</p>}
      {erroCarga && (
        <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm">
          Não foi possível carregar a equipe. <button type="button" onClick={() => void recarregar()} className="font-semibold text-primary underline">Tentar de novo</button>
        </div>
      )}
      {lista && !lista.length && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-4 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/60 text-primary"><Users size={26} /></span>
          <p className="text-base font-bold">Nenhum funcionário ainda</p>
          <p className="text-sm text-muted-foreground">Toque em "Adicionar funcionário". O app mostra um QR Code para ele apontar a câmera do celular.</p>
        </div>
      )}
      {lista && lista.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {lista.map((f) => {
            const s = situacaoFuncionario(f);
            return (
              <li key={f.id}>
                <button type="button" onClick={() => setAberto(f.id)} aria-label={`${f.nome}, ${SIT[s].txt}`}
                  className={`flex w-full items-center gap-3 rounded-3xl border border-border bg-secondary/60 p-4 text-left transition hover:border-primary ${s === "bloqueado" ? "opacity-70" : ""}`}>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-base font-bold text-primary">{iniciais(f.nome)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-base font-bold leading-snug">{f.nome}</span>
                    <span className="block text-sm text-muted-foreground">{FUNCAO_TXT[f.funcao]}{f.caixa ? " · Caixa" : ""}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${SIT[s].cor}`}>{SIT[s].txt}</span>
                      {s === "ativo" && f.ultimoAcesso && <span className="text-xs text-muted-foreground">usou {quandoTexto(f.ultimoAcesso)}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {novo && (
        <EditarFuncionario titulo="Adicionar funcionário" onClose={() => setNovo(false)}
          onSalvar={async (nome, funcao) => {
            const r = await api.criar(comercioId, nome, funcao);
            await recarregar();
            setNovo(false); setAberto(r.id);
          }} />
      )}
      {sel && <DetalheFuncionario f={sel} comercioNome={comercioNome} api={api} onMudou={recarregar} onClose={() => setAberto(null)} />}
    </section>
  );
}

function EditarFuncionario({ titulo, inicial, onSalvar, onClose }: {
  titulo: string; inicial?: { nome: string; funcao: Funcao }; onSalvar: (nome: string, funcao: Funcao) => Promise<unknown>; onClose: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [funcao, setFuncao] = useState<Funcao | null>(inicial?.funcao ?? null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const ok = nome.trim().length >= 2 && !!funcao && !salvando;
  return (
    <Sheet title={titulo} onClose={onClose}>
      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nome do funcionário</span>
          <input value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Maria Souza" autoComplete="off"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary" />
        </label>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">O que ele faz?</legend>
          {FUNCOES.map((f) => (
            <button key={f} type="button" aria-pressed={funcao === f} onClick={() => setFuncao(f)}
              className={`flex min-h-13 w-full items-center justify-between rounded-2xl border px-4 text-left text-base font-semibold transition ${funcao === f ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
              {FUNCAO_TXT[f]} {funcao === f && <Check size={18} />}
            </button>
          ))}
        </fieldset>
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
      </div>
      <div className="px-5 pt-2">
        <button type="button" disabled={!ok} className={btnPrimary(ok)}
          onClick={() => { setSalvando(true); setErro(""); onSalvar(nome.trim(), funcao!).catch((e) => { setErro(erroTexto(e)); setSalvando(false); }); }}>
          {salvando ? "Salvando…" : inicial ? "Salvar" : "Adicionar e mostrar o acesso"}
        </button>
      </div>
    </Sheet>
  );
}

function DetalheFuncionario({ f, comercioNome, api, onMudou, onClose }: {
  f: Funcionario; comercioNome: string; api: ApiEquipe; onMudou: () => Promise<unknown>; onClose: () => void;
}) {
  const [editar, setEditar] = useState(false);
  const [confirmar, setConfirmar] = useState<"bloquear" | "novo" | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const s = situacaoFuncionario(f);
  const link = linkAcesso(f.codigo);
  const fazer = (acao: () => Promise<unknown>) => {
    setTrabalhando(true); setErro("");
    acao().then(() => onMudou()).then(() => setConfirmar(null)).catch((e) => setErro(erroTexto(e))).finally(() => setTrabalhando(false));
  };
  const convite = `Olá, ${f.nome.split(" ")[0]}! Para usar o app ${NOME_APP_FUNCIONARIO} de ${comercioNome}, abra este link no seu celular: ${link}\nSeu código: ${codigoTexto(f.codigo)}. No primeiro acesso você cria um PIN de 4 números.`;

  if (editar)
    return <EditarFuncionario titulo="Editar funcionário" inicial={{ nome: f.nome, funcao: f.funcao }} onClose={() => setEditar(false)}
      onSalvar={async (nome, funcao) => { await api.atualizar(f.id, nome, funcao); await onMudou(); setEditar(false); }} />;

  return (
    <Sheet title={f.nome} onClose={onClose}>
      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{FUNCAO_TXT[f.funcao]}</p>
            <p className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${SIT[s].cor}`}>{SIT[s].txt}</p>
          </div>
          <button type="button" onClick={() => setEditar(true)} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold"><Pencil size={16} /> Editar</button>
        </div>

        {s === "aguardando" && (
          <section aria-label="Acesso do funcionário" className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-secondary/40 p-4 text-center">
            <p className="text-base font-bold">Peça para {f.nome.split(" ")[0]} apontar a câmera do celular dele aqui</p>
            <QrCode texto={link} rotulo={`QR Code de acesso de ${f.nome}`} tamanho={200} />
            <div>
              <p className="text-xs text-muted-foreground">Ou digitar no app o código</p>
              <p className="text-3xl font-bold tracking-widest tabular-nums" aria-label={`Código ${f.codigo.split("").join(" ")}`}>{codigoTexto(f.codigo)}</p>
              <p className="text-xs text-muted-foreground">Vale {validadeCodigoTexto(f)} para o primeiro acesso.</p>
            </div>
            <ol className="w-full space-y-1 rounded-2xl bg-background-deep/50 p-3 text-left text-sm">
              <li>1. Ele aponta a câmera para o QR Code (ou abre o app e toca em "Sou funcionário").</li>
              <li>2. Cria uma senha própria de 4 números (o PIN). É diferente do código acima.</li>
              <li>3. Pronto: nas próximas vezes, só o PIN.</li>
            </ol>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(convite)}`} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-center gap-2 ${btnGhost}`}><MessageCircle size={18} /> Enviar pelo WhatsApp</a>
              <button type="button" className={`flex items-center justify-center gap-2 ${btnGhost}`}
                onClick={() => { void navigator.clipboard?.writeText(convite).then(() => setCopiado(true)).catch(() => setCopiado(false)); }}>
                <Copy size={18} /> {copiado ? "Copiado!" : "Copiar convite"}
              </button>
            </div>
          </section>
        )}

        {s === "expirado" && (
          <section aria-label="Acesso do funcionário" className="rounded-3xl border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-base font-bold">O código venceu antes do primeiro acesso</p>
            <p className="text-sm text-muted-foreground">Por segurança, o código vale {HORAS_CODIGO} horas. Gere um novo e mostre o QR Code de novo.</p>
            <button type="button" disabled={trabalhando} onClick={() => fazer(() => api.novoAcesso(f.id))} className={`mt-3 flex items-center justify-center gap-2 ${btnPrimary(!trabalhando)}`}>
              <KeyRound size={18} /> Gerar código novo
            </button>
          </section>
        )}

        {s === "ativo" && (
          <section aria-label="Acesso do funcionário" className="space-y-2 rounded-3xl border border-accent/50 bg-accent/10 p-4">
            <p className="flex items-center gap-2 text-base font-bold text-accent"><ShieldCheck size={20} /> Acesso liberado</p>
            <p className="flex items-center gap-2 text-sm"><Smartphone size={16} className="text-muted-foreground" />
              {f.celulares === 1 ? "1 celular ligado" : f.celulares > 1 ? `${f.celulares} celulares ligados` : "Nenhum celular ligado agora"}
              {f.ultimoAcesso ? ` · usou ${quandoTexto(f.ultimoAcesso)}` : ""}
            </p>
            {f.primeiroAcessoEm && <p className="text-xs text-muted-foreground">Primeiro acesso {quandoTexto(f.primeiroAcessoEm)}.</p>}
          </section>
        )}

        {s === "bloqueado" && (
          <section aria-label="Acesso do funcionário" className="rounded-3xl border border-border bg-secondary/40 p-4">
            <p className="flex items-center gap-2 text-base font-bold"><Ban size={18} /> Bloqueado</p>
            <p className="text-sm text-muted-foreground">Ele não consegue entrar no app. Desbloquear gera um código novo, e ele cria outro PIN.</p>
            <button type="button" disabled={trabalhando} onClick={() => fazer(() => api.bloquear(f.id, false))} className={`mt-3 flex items-center justify-center gap-2 ${btnPrimary(!trabalhando)}`}>
              <KeyRound size={18} /> Desbloquear e gerar código
            </button>
          </section>
        )}

        {s !== "bloqueado" && (
          <section aria-label="Caixa no celular" className="space-y-2 rounded-3xl border border-border p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><ShoppingCart size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">Caixa no celular</span>
                <span className="block text-sm text-muted-foreground">{f.caixa ? "Pode vender pelo app: bipar, receber e finalizar." : "Desligado: não vende pelo app."}</span>
              </span>
              <button type="button" role="switch" aria-checked={!!f.caixa} aria-label="Caixa no celular" disabled={trabalhando}
                onClick={() => fazer(() => (api.caixa ?? banco.definirCaixaFuncionario)(f.id, !f.caixa))}
                className={`relative h-8 w-14 shrink-0 rounded-full transition ${f.caixa ? "bg-accent" : "bg-secondary"}`}>
                <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${f.caixa ? "left-7" : "left-1"}`} />
              </button>
            </div>
            {f.caixa && <p className="text-xs text-muted-foreground">No app {NOME_APP_FUNCIONARIO}, aparece o botão <b>Caixa</b>. O produto só sai da gôndola quando a venda é finalizada.</p>}
          </section>
        )}

        {s !== "bloqueado" && (
          <div className="space-y-2">
            {s === "ativo" && (confirmar !== "novo" ? (
              <button type="button" onClick={() => setConfirmar("novo")} className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}><KeyRound size={18} /> Esqueceu o PIN ou trocou de celular?</button>
            ) : (
              <div className="space-y-2 rounded-2xl border border-warning/50 bg-warning/10 p-3">
                <p className="text-sm">Use quando ele <b>esqueceu o PIN</b> ou <b>trocou de celular</b>. O celular atual sai do app e aparece um QR Code novo.</p>
                <button type="button" disabled={trabalhando} onClick={() => fazer(() => api.novoAcesso(f.id))}
                  className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-warning/60 px-4 text-base font-semibold text-warning">Confirmar novo acesso</button>
                <button type="button" onClick={() => setConfirmar(null)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
              </div>
            ))}
            {confirmar !== "bloquear" ? (
              <button type="button" onClick={() => setConfirmar("bloquear")}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-destructive/50 px-4 text-base font-semibold text-destructive"><Ban size={18} /> Bloquear</button>
            ) : (
              <div className="space-y-2 rounded-2xl border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm">{f.nome.split(" ")[0]} sai do app <b>na hora</b>, em todos os celulares. Você pode desbloquear depois.</p>
                <button type="button" disabled={trabalhando} onClick={() => fazer(() => api.bloquear(f.id, true))}
                  className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-destructive/60 px-4 text-base font-semibold text-destructive">Confirmar bloqueio</button>
                <button type="button" onClick={() => setConfirmar(null)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
              </div>
            )}
          </div>
        )}
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
      </div>
      <div className="px-5 pt-2"><button type="button" onClick={onClose} className={`w-full ${btnGhost}`}>Fechar</button></div>
    </Sheet>
  );
}


/** O PIN do dono: o funcionário pede para o dono digitar no celular dele para cancelar uma venda ou tirar dinheiro do caixa. */
function PinDono({ temPin, definirPin }: { temPin: () => Promise<boolean>; definirPin: (pin: string) => Promise<unknown> }) {
  const [tem, setTem] = useState<boolean | null>(null);
  const [editar, setEditar] = useState(false);
  const [pin, setPin] = useState("");
  const [rep, setRep] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState(false);
  useEffect(() => { temPin().then(setTem, () => setTem(null)); }, [temPin]);
  const erroPin = pin.length === 4 && pinFacil(pin) ? "Esse PIN é fácil de adivinhar. Escolha outro (sem repetir números e sem sequência)." : rep.length === 4 && rep !== pin ? "Os dois PINs não são iguais." : "";
  const ok = pin.length === 4 && rep === pin && !erroPin && !salvando;
  const campo = (rotulo: string, v: string, set: (x: string) => void) => (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{rotulo}</span>
      <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={v} aria-label={rotulo} placeholder="••••"
        onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 text-center text-2xl font-bold tracking-[0.6em] text-foreground outline-none focus-visible:border-primary" />
    </label>
  );
  return (
    <section aria-label="PIN do dono" className={`space-y-3 rounded-3xl border p-4 ${tem === false ? "border-warning/60 bg-warning/10" : "border-border bg-secondary/40"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><LockKeyhole size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">Seu PIN do caixa {tem && <span className="ml-1 text-sm font-semibold text-accent">· criado</span>}</p>
          <p className="text-sm text-muted-foreground">
            {tem === false ? "Crie agora: sem ele, a equipe não consegue cancelar venda nem tirar dinheiro do caixa no celular."
              : "O funcionário pede para você digitar no celular dele quando precisa cancelar uma venda ou tirar dinheiro da gaveta."}
            {" "}Vale para todos os seus comércios.
          </p>
        </div>
      </div>
      {pronto && !editar && <p role="status" className="text-sm font-semibold text-accent">PIN salvo. Não conte para ninguém da equipe.</p>}
      {!editar ? (
        tem !== null && <button type="button" onClick={() => { setEditar(true); setPronto(false); }} className={`w-full ${tem ? btnGhost : btnPrimary(true)}`}>{tem ? "Trocar o PIN" : "Criar o PIN"}</button>
      ) : (
        <div className="space-y-3">
          {campo("Novo PIN (4 números)", pin, setPin)}
          {campo("Digite de novo", rep, setRep)}
          {(erroPin || erro) && <p role="alert" className="text-sm font-semibold text-destructive">{erroPin || erro}</p>}
          <button type="button" disabled={!ok} className={btnPrimary(ok)}
            onClick={() => { setSalvando(true); setErro(""); definirPin(pin).then(() => { setTem(true); setEditar(false); setPin(""); setRep(""); setPronto(true); }, (e) => setErro(erroTexto(e))).finally(() => setSalvando(false)); }}>
            {salvando ? "Salvando…" : "Salvar o PIN"}
          </button>
          <button type="button" onClick={() => { setEditar(false); setPin(""); setRep(""); setErro(""); }} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
        </div>
      )}
    </section>
  );
}
