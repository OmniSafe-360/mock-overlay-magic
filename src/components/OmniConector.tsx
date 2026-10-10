/* Omni Conector (Fase 3.3): fica aberto no computador do caixa. Lê a pasta onde o sistema do caixa guarda as notas
 * e manda cada venda FINALIZADA ao Omni (a nota só existe depois que a venda fecha). Também aceita arrastar notas. */
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { CircleCheck, FileUp, FolderOpen, LogOut, MonitorSmartphone, RefreshCw, TriangleAlert } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import {
  apagarChaveCaixa, arquivosNovos, escolherPasta, guardarChaveCaixa, guardarPasta, lerChaveCaixa, lerPasta, marcarFeito, permissaoPasta,
  podeEscolherPasta, processarArquivo, type ApiConector, type Resultado,
} from "@/lib/conector";
import { nomeAparelho } from "@/lib/funcionario";
import { nomeVenda } from "@/lib/situacao";
import { TIPO_FROM_DB } from "@/components/StoreSetup";
import { brl, codigoCaixaTexto, haQuanto } from "@/lib/vendas";

export type ApiOmniConector = ApiConector & {
  ligar: typeof banco.conectorLigar;
  estado: typeof banco.conectorEstado;
};
const API_PADRAO: ApiOmniConector = {
  ligar: banco.conectorLigar, estado: banco.conectorEstado, enviar: banco.conectorEnviarVenda, cancelar: banco.conectorCancelarVenda,
};
/** De quanto em quanto tempo a pasta é conferida. */
export const SEGUNDOS_PASTA = 20;

type Tela = { t: "abrindo" } | { t: "codigo"; aviso?: string } | { t: "ligado" } | { t: "sem_internet" };
type Registro = { id: number; hora: string; r: Resultado; arquivo: string };
type Pasta = FileSystemDirectoryHandle;
/** Texto de um arquivo escolhido (FileReader funciona em qualquer navegador). */
const lerTexto = (f: File) => new Promise<string>((ok, erro) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result ?? "")); r.onerror = () => erro(r.error);
  r.readAsText(f);
});

export function OmniConector({ api = API_PADRAO }: { api?: ApiOmniConector | undefined }) {
  const [tela, setTela] = useState<Tela>({ t: "abrindo" });
  const [estado, setEstado] = useState<banco.EstadoConector | null>(null);
  const [pasta, setPasta] = useState<Pasta | null>(null);
  const [permissao, setPermissao] = useState<PermissionState | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [lendo, setLendo] = useState(false);
  const [ultimaLeitura, setUltimaLeitura] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [sair, setSair] = useState(false);
  const ocupado = useRef(false);
  const seq = useRef(0);

  const desligado = useCallback((aviso = "Este caixa foi desligado pelo dono. Para ligar de novo, peça um código novo no app do dono (comércio → Vendas).") => {
    apagarChaveCaixa(); void guardarPasta(null); setPasta(null); setEstado(null); setTela({ t: "codigo", aviso });
  }, []);

  const atualizarEstado = useCallback(async () => {
    const chave = lerChaveCaixa();
    if (!chave) { setTela({ t: "codigo" }); return; }
    try {
      const e = await api.estado(chave);
      if (!e) { desligado(); return; }
      setEstado(e); setTela({ t: "ligado" });
    } catch { setTela((t) => (t.t === "ligado" ? t : { t: "sem_internet" })); }
    setAgora(Date.now());
  }, [api, desligado]);

  useEffect(() => {
    void atualizarEstado();
    void lerPasta().then(async (p) => { if (p) { setPasta(p); setPermissao(await permissaoPasta(p)); } });
  }, [atualizarEstado]);
  // Avisa o Omni que o caixa está ligado e atualiza os números de hoje.
  useEffect(() => { const t = setInterval(() => { void atualizarEstado(); }, 60_000); return () => clearInterval(t); }, [atualizarEstado]);

  const anotar = (arquivo: string, r: Resultado) => {
    const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setRegistros((l) => [{ id: ++seq.current, hora, r, arquivo }, ...l].slice(0, 40));
  };
  const area = nomeVenda(TIPO_FROM_DB[estado?.comercio.tipo ?? ""] ?? estado?.comercio.tipo ?? "mercado").toLowerCase();

  /** Manda uma lista de arquivos, um de cada vez. Para no primeiro erro de internet (tenta de novo depois). */
  const mandar = useCallback(async (arqs: { id?: string; nome: string; ler: () => Promise<string> }[]) => {
    const chave = lerChaveCaixa();
    if (!chave || ocupado.current) return;
    ocupado.current = true; setLendo(true);
    let mudou = false;
    try {
      for (const a of arqs) {
        let texto = "";
        try { texto = await a.ler(); } catch { anotar(a.nome, { ok: false, tentarDeNovo: true, texto: "Não foi possível abrir o arquivo agora" }); continue; }
        const r = await processarArquivo(texto, chave, api, { cnpj: estado?.comercio.documento, area });
        if (!r.ok && r.desligado) { desligado(); return; }
        if (!r.ok && r.tentarDeNovo) { anotar(a.nome, r); break; }
        if (a.id) marcarFeito(a.id);
        if (!(r.ok && r.nivel === "info" && /não é nota/.test(r.texto))) anotar(a.nome, r);
        mudou = true;
      }
    } finally { ocupado.current = false; setLendo(false); }
    if (mudou) void atualizarEstado();
  }, [api, estado, area, desligado, atualizarEstado]);

  const lerAPasta = useCallback(async () => {
    if (!pasta || permissao !== "granted" || ocupado.current) return;
    const desde = estado?.desde ? Date.parse(estado.desde) - 86_400_000 : Date.now() - 86_400_000;
    try { await mandar(await arquivosNovos(pasta, desde)); }
    catch { setPermissao(await permissaoPasta(pasta)); }
    setUltimaLeitura(Date.now()); setAgora(Date.now());
  }, [pasta, permissao, estado, mandar]);
  useEffect(() => {
    if (tela.t !== "ligado" || !pasta || permissao !== "granted") return;
    void lerAPasta();
    const t = setInterval(() => { void lerAPasta(); }, SEGUNDOS_PASTA * 1000);
    return () => clearInterval(t);
  }, [tela.t, pasta, permissao, lerAPasta]);

  const escolher = async () => {
    try {
      const p = await escolherPasta();
      await guardarPasta(p); setPasta(p); setPermissao(await permissaoPasta(p));
    } catch { /* a pessoa fechou a janela sem escolher */ }
  };
  const permitir = async () => { if (pasta) setPermissao(await permissaoPasta(pasta, true)); };

  const [arrastando, setArrastando] = useState(false);
  const soltar = (fs: FileList | null) => {
    const lista = [...(fs ?? [])].filter((f) => /\.xml$/i.test(f.name));
    if (!lista.length) return;
    void mandar(lista.map((f) => ({ nome: f.name, ler: () => lerTexto(f) })));
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setArrastando(false); soltar(e.dataTransfer?.files ?? null); };

  return (
    <div className="min-h-dvh bg-app text-foreground">
      <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col gap-5 px-4 pb-8 pt-6">
        <header className="flex items-center gap-3">
          <LogoMark size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold">Omni Conector</p>
            <p className="truncate text-sm text-muted-foreground">{estado ? `${estado.caixa} · ${estado.comercio.nome}` : "Liga o caixa do comércio ao Omni Safe 360"}</p>
          </div>
          {tela.t === "ligado" && <span className="flex items-center gap-1.5 rounded-full border border-accent/60 px-3 py-1 text-sm font-semibold text-accent"><span className="h-2.5 w-2.5 rounded-full bg-accent" /> Ligado</span>}
        </header>

        {tela.t === "abrindo" && <p className="m-auto text-muted-foreground">Abrindo…</p>}
        {tela.t === "sem_internet" && (
          <div className="m-auto space-y-3 text-center">
            <p className="text-lg font-bold">Sem conexão com o Omni</p>
            <p className="text-sm text-muted-foreground">Confira a internet deste computador. As vendas ficam guardadas na pasta e são enviadas quando a internet voltar.</p>
            <button type="button" onClick={() => void atualizarEstado()} className={btnPrimary(true)}>Tentar de novo</button>
          </div>
        )}
        {tela.t === "codigo" && <TelaCodigo api={api} aviso={tela.aviso} onLigou={() => void atualizarEstado()} />}

        {tela.t === "ligado" && estado && (
          <>
            <section aria-label="Hoje neste caixa" className="rounded-3xl border border-border bg-secondary/50 p-4">
              <p className="text-sm text-muted-foreground">Hoje neste caixa</p>
              <p className="text-3xl font-bold">{brl(estado.hoje.total)}</p>
              <p className="text-sm text-muted-foreground">
                {estado.hoje.vendas === 0 ? "Nenhuma venda ainda" : estado.hoje.vendas === 1 ? "1 venda" : `${estado.hoje.vendas} vendas`}
                {estado.ultimaVendaEm && ` · última ${haQuanto(estado.ultimaVendaEm, agora)}`}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Cada venda <b className="text-foreground">finalizada</b> neste caixa sai da {area} no Omni. Bipar sem finalizar não desconta.</p>
            </section>

            <section aria-label="Pasta das notas" className="space-y-3 rounded-3xl border border-border bg-secondary/40 p-4">
              <p className="flex items-center gap-2 text-base font-bold"><FolderOpen size={20} className="text-primary" /> Pasta das notas</p>
              {!podeEscolherPasta() ? (
                <p className="flex gap-2 rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">
                  <TriangleAlert size={18} className="shrink-0 text-warning" />
                  Este navegador não consegue ler pastas. Abra esta página no <b>Google Chrome</b> ou no <b>Microsoft Edge</b> do computador do caixa.
                </p>
              ) : !pasta ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    É a pasta onde o sistema do caixa guarda os arquivos das notas (<b>.xml</b>, NFC-e ou SAT). Se não souber qual é, pergunte ao técnico do caixa.
                  </p>
                  <button type="button" onClick={() => void escolher()} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><FolderOpen size={20} /> Escolher a pasta das notas</button>
                </>
              ) : permissao !== "granted" ? (
                <>
                  <p className="text-sm">O navegador precisa da sua permissão para ler a pasta <b>{pasta.name}</b> de novo.</p>
                  <button type="button" onClick={() => void permitir()} className={btnPrimary(true)}>Permitir ler a pasta</button>
                  <p className="text-xs text-muted-foreground">Se aparecer a opção "Permitir em todas as visitas", escolha ela: assim não precisa repetir.</p>
                </>
              ) : (
                <>
                  <p className="flex items-center gap-2 text-sm font-semibold text-accent"><CircleCheck size={18} /> Lendo a pasta {pasta.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Confere a cada {SEGUNDOS_PASTA} segundos{ultimaLeitura ? ` · última conferência ${haQuanto(new Date(ultimaLeitura).toISOString(), agora)}` : ""}.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={lendo} onClick={() => void lerAPasta()} className={`flex items-center justify-center gap-2 ${btnGhost}`}>
                      <RefreshCw size={16} className={lendo ? "animate-spin" : ""} /> Conferir agora
                    </button>
                    <button type="button" onClick={() => void escolher()} className={btnGhost}>Trocar a pasta</button>
                  </div>
                </>
              )}
              <label onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={onDrop}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed p-4 text-center text-sm transition ${arrastando ? "border-primary bg-primary/10" : "border-border"}`}>
                <FileUp size={22} className="text-primary" />
                <span className="font-semibold">Ou arraste notas (.xml) para cá</span>
                <span className="text-xs text-muted-foreground">ou toque para escolher os arquivos</span>
                <input type="file" accept=".xml,text/xml,application/xml" multiple className="sr-only" aria-label="Escolher notas" onChange={(e) => { soltar(e.target.files); e.target.value = ""; }} />
              </label>
            </section>

            <section aria-label="O que foi enviado" className="space-y-2">
              <h2 className="text-base font-bold">O que foi enviado</h2>
              {!registros.length && <p className="rounded-2xl border border-border p-4 text-center text-sm text-muted-foreground">{lendo ? "Lendo as notas…" : "As vendas aparecem aqui assim que forem enviadas."}</p>}
              <ul className="space-y-1.5">
                {registros.map((g) => (
                  <li key={g.id} className="flex items-start gap-2 rounded-2xl border border-border px-3 py-2 text-sm">
                    <span className="w-11 shrink-0 font-semibold text-muted-foreground">{g.hora}</span>
                    <span className={g.r.ok ? (g.r.nivel === "ok" ? "text-accent" : g.r.nivel === "atencao" ? "text-warning" : "text-muted-foreground") : "text-destructive"}>{g.r.texto}</span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="flex gap-2 rounded-2xl border border-border p-3 text-sm text-muted-foreground">
              <MonitorSmartphone size={18} className="shrink-0 text-primary" />
              Deixe esta página aberta (pode minimizar). Se fechar, as vendas ficam esperando na pasta e são enviadas quando abrir de novo.
            </p>

            <footer className="pt-2">
              {!sair ? (
                <button type="button" onClick={() => setSair(true)} className="flex min-h-12 w-full items-center justify-center gap-2 text-sm font-semibold text-muted-foreground"><LogOut size={16} /> Desligar este computador do Omni</button>
              ) : (
                <div className="space-y-2 rounded-2xl border border-border p-3 text-center">
                  <p className="text-sm">Este computador para de mandar as vendas. Para ligar de novo, vai precisar de um código novo do dono.</p>
                  <button type="button" onClick={() => desligado("Este computador foi desligado do Omni. Para ligar de novo, digite um código novo.")} className={`w-full ${btnGhost}`}>Sim, desligar</button>
                  <button type="button" onClick={() => setSair(false)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
                </div>
              )}
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function TelaCodigo({ api, aviso, onLigou }: { api: ApiOmniConector; aviso?: string | undefined; onLigou: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [ligando, setLigando] = useState(false);
  const ligar = async (c: string) => {
    if (c.length !== 8 || ligando) return;
    setLigando(true); setErro("");
    try {
      const r = await api.ligar(c, `${nomeAparelho()} · ${navigator.userAgent.includes("Edg/") ? "Edge" : "Chrome"}`);
      guardarChaveCaixa(r.chave); onLigou();
    } catch (e) {
      const m = String((e as { message?: string } | null)?.message ?? e ?? "");
      setErro(m.includes("codigo_expirado") ? "Este código venceu. Peça um código novo ao dono."
        : m.includes("codigo_invalido") ? "Código não encontrado. Confira os 8 números no app do dono."
        : "Sem internet ou o Omni não respondeu. Tente de novo.");
      setLigando(false);
    }
  };
  return (
    <div className="my-auto space-y-5">
      {aviso && <p role="status" className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">{aviso}</p>}
      <div className="space-y-2">
        <label htmlFor="codigo-caixa" className="block text-center text-lg font-bold">Digite o código do caixa</label>
        <input id="codigo-caixa" inputMode="numeric" autoComplete="off" maxLength={9} value={codigoCaixaTexto(codigo)} placeholder="0000 0000"
          onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 8); setCodigo(d); setErro(""); if (d.length === 8) void ligar(d); }}
          className="h-16 w-full rounded-2xl border border-border bg-background-deep/60 text-center text-3xl font-bold tracking-[0.25em] text-foreground outline-none placeholder:text-muted-foreground/40 focus-visible:border-primary" />
        <p className="text-center text-sm text-muted-foreground">No app do dono: abra o comércio → aba <b>Vendas</b> → <b>Ligar um caixa</b>.</p>
      </div>
      {erro && <p role="alert" className="text-center text-sm font-semibold text-destructive">{erro}</p>}
      <button type="button" disabled={codigo.length !== 8 || ligando} onClick={() => void ligar(codigo)} className={btnPrimary(codigo.length === 8 && !ligando)}>
        {ligando ? "Ligando…" : "Ligar este caixa"}
      </button>
    </div>
  );
}
