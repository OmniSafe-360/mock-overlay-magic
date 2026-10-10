/* Conferir o depósito no app do funcionário (Fase 4.2): até 5 produtos por dia, revezando.
 * A contagem é cega (o funcionário nunca vê quanto o sistema tem). Vale quando bate, ou quando ele repete o mesmo número;
 * 3 números diferentes ficam para o dono decidir. */
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Camera, Check, CheckCircle2, ClipboardCheck, MapPin, RotateCcw } from "lucide-react";
import { Scanner } from "@/components/Scanner";
import { Contador } from "@/components/parts/Contador";
import { TIPO_FROM_DB, btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import { aceitaFracao, newUid, parseNum, qtdUn, unPlural } from "@/lib/deposito";
import { textoDoTipo } from "@/lib/exemplos";
import { mensagemErro } from "@/lib/persistencia";
import { nomeProdutoFunc } from "@/lib/recebimento";

export type ApiConferir = {
  lista: typeof banco.listaConferencia;
  contar: typeof banco.contarConferencia;
  buscar: typeof banco.buscarProdutoFuncionario;
};
const API_PADRAO: ApiConferir = { lista: banco.listaConferencia, contar: banco.contarConferencia, buscar: banco.buscarProdutoFuncionario };

const MSG: [string, string][] = [
  ["acesso_encerrado", "Este celular saiu do app. Entre de novo com o código do dono."],
  ["pin_necessario", "Por segurança, o app travou. Volte ao início e digite seu PIN."],
  ["variacao_obrigatoria", "Escolha o tamanho e a cor para contar."],
];
const erroTexto = (e: unknown) => {
  const m = String((e as { message?: string } | null)?.message ?? e ?? "");
  return MSG.find(([k]) => m.includes(k))?.[1] ?? mensagemErro(e).replace("Seus dados continuam no formulário. ", "").replace("Não foi possível salvar agora. ", "Não foi possível enviar agora. ");
};
const porLocal = (a: banco.ItemConferencia, b: banco.ItemConferencia) =>
  (a.local ?? "￿").localeCompare(b.local ?? "￿", "pt-BR", { numeric: true, sensitivity: "base" }) || a.nome.localeCompare(b.nome, "pt-BR");

/** Total contado: embalagens fechadas × quantidade + soltas. */
export function totalConferido(fechadas: Record<string, string>, soltas: string, embalagens: { id: string; quantidade: number }[], unidade: string) {
  let total = parseNum(soltas, unidade, true).v ?? 0;
  for (const e of embalagens) total += (parseNum(fechadas[e.id] ?? "", "Unidade", true).v ?? 0) * e.quantidade;
  return Math.round(total * 1000) / 1000;
}

type Tela = { t: "lista" } | { t: "contar"; item: banco.ItemConferencia; id: string; rodada: number };

export function ConferirDeposito({ chave, onVoltar, api: apiDada }: { chave: string; onVoltar: () => void; api?: ApiConferir | undefined }) {
  const api = apiDada ?? API_PADRAO;
  const [tela, setTela] = useState<Tela>({ t: "lista" });
  const [dados, setDados] = useState<Awaited<ReturnType<typeof banco.listaConferencia>> | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const carregar = useCallback(() => { setErro(""); api.lista(chave).then((d) => setDados({ ...d, produtos: [...d.produtos].sort(porLocal) })).catch((e) => setErro(erroTexto(e))); }, [api, chave]);
  useEffect(carregar, [carregar]);
  const tipo = TIPO_FROM_DB[dados?.tipo ?? ""] ?? "mercado";
  const t = textoDoTipo(tipo);
  const titulo = t("Conferir depósito");

  if (tela.t === "contar")
    return <Contar mercado={tipo === "mercado"} key={tela.rodada} item={tela.item} id={tela.id} rodada={tela.rodada} chave={chave} api={api} t={t} onVoltar={() => setTela({ t: "lista" })}
      onFim={(r) => {
        if (r.situacao === "recontar") { setTela({ ...tela, rodada: r.rodada ?? tela.rodada + 1 }); return; }
        setAviso(r.situacao === "concluida"
          ? { ok: true, texto: `${nomeProdutoFunc(tela.item)}: conferido. Obrigado!` }
          : { ok: false, texto: `${nomeProdutoFunc(tela.item)}: as contagens não bateram. O dono vai conferir.` });
        setTela({ t: "lista" }); carregar();
      }} />;

  const feitos = dados?.feitosHoje ?? 0;
  const meta = dados?.meta ?? 5;
  return (
    <div className="space-y-4">
      <button type="button" onClick={onVoltar} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Início</button>
      <div>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{t("Todo dia o app escolhe alguns produtos do depósito. Vá em cada um e conte tudo o que tem.")}</p>
      </div>
      {dados && (
        <div className="rounded-3xl border border-border bg-secondary/40 p-4">
          <p className="text-sm font-semibold">{Math.min(feitos, meta)} de {meta} conferidos hoje</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-background-deep/60"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, (feitos / meta) * 100)}%` }} /></div>
        </div>
      )}
      {aviso && (
        <p role="status" className={`flex items-start gap-2 rounded-2xl border p-3 text-sm font-semibold ${aviso.ok ? "border-accent/50 bg-accent/10 text-accent" : "border-warning/50 bg-warning/10 text-warning"}`}>
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> {aviso.texto}
        </p>
      )}
      {erro && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro}</p>}
      {!dados && !erro && <p className="py-8 text-center text-muted-foreground">Carregando…</p>}
      {dados && !dados.produtos.length && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-4 py-8 text-center">
          <CheckCircle2 size={36} className="text-accent" />
          <p className="text-base font-bold">{feitos > 0 ? "Conferência de hoje feita!" : "Nada para conferir agora"}</p>
          <p className="text-sm text-muted-foreground">{feitos > 0 ? "Amanhã o app escolhe outros produtos." : t("Os produtos do depósito já foram conferidos nos últimos dias.")}</p>
        </div>
      )}
      <ul className="space-y-3">
        {dados?.produtos.map((p) => (
          <li key={`${p.produtoId}:${p.variacaoId ?? "_"}`}>
            <button type="button" onClick={() => { setAviso(null); setTela({ t: "contar", item: p, id: p.conferenciaId ?? newUid(), rodada: 1 }); }}
              className="flex w-full items-center gap-3 rounded-3xl border-2 border-primary/40 bg-primary/5 p-4 text-left transition active:scale-[0.99]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><ClipboardCheck size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-lg font-bold leading-snug">{nomeProdutoFunc(p)}</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin size={14} /> {p.local ?? t("Sem lugar no depósito")}</span>
                {p.conferenciaId && <span className="block text-sm font-semibold text-warning">Contagem começada: termine</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cada rodada abre do zero (key = rodada): a contagem anterior some, para não influenciar. */
function Contar({ item, id, rodada, chave, api, t, onVoltar, onFim, mercado }: {
  item: banco.ItemConferencia; id: string; rodada: number; chave: string; api: ApiConferir; t: (s: string) => string; mercado: boolean;
  onVoltar: () => void; onFim: (r: Awaited<ReturnType<typeof banco.contarConferencia>>) => void;
}) {
  const [fechadas, setFechadas] = useState<Record<string, string>>({});
  const [soltas, setSoltas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [scan, setScan] = useState(false);
  const [certo, setCerto] = useState<boolean | null>(null);
  const embs = aceitaFracao(item.unidade) ? [] : item.embalagens;
  const total = totalConferido(fechadas, soltas, embs, item.unidade);
  const nSoltas = parseNum(soltas, item.unidade, true);
  const vazio = !soltas && !Object.values(fechadas).some(Boolean);
  const plural = unPlural(item.unidade).toLowerCase();
  const enviar = async (q: number) => {
    setEnviando(true); setErro("");
    try { onFim(await api.contar(chave, id, item.produtoId, item.variacaoId, q)); }
    catch (e) { setErro(erroTexto(e)); setEnviando(false); }
  };
  const conferir = async (codigo: string) => {
    try {
      const r = await api.buscar(chave, codigo);
      setCerto(r.some((x) => x.produtoId === item.produtoId && (x.variacaoId ?? null) === (item.variacaoId ?? null)));
    } catch (e) { setErro(erroTexto(e)); }
  };
  return (
    <div className="flex flex-1 flex-col gap-4">
      <button type="button" onClick={onVoltar} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Lista</button>
      <div className="rounded-3xl border border-border bg-secondary/60 p-4">
        <p className="break-words text-xl font-bold leading-snug">{nomeProdutoFunc(item)}</p>
        {item.codigo && <p className="text-xs text-muted-foreground">Cód. {item.codigo}</p>}
        <p className="mt-1 flex items-center gap-1 text-sm"><MapPin size={14} className="text-primary" /> {item.local ?? t("Sem lugar no depósito")}</p>
      </div>
      {rodada > 1 && (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">
          <RotateCcw size={18} className="mt-0.5 shrink-0 text-warning" /> Conte de novo, com calma, tudo deste produto. (Contagem {rodada} de 3)
        </p>
      )}
      <button type="button" onClick={() => setScan(true)} className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}><Camera size={18} /> Bipar para conferir se é este produto</button>
      {certo === true && <p className="text-sm font-semibold text-accent">É este produto. Pode contar.</p>}
      {certo === false && <p role="alert" className="text-sm font-semibold text-warning">Este código é de outro produto. Procure {nomeProdutoFunc(item)}.</p>}
      <div className="space-y-3 rounded-3xl border border-border p-4">
        <p className="text-xl font-bold">{t("Quanto tem no depósito?")}</p>
        <p className="text-sm text-muted-foreground">{t("Conte tudo deste produto no depósito, inclusive atrás e em cima.")}</p>
        {embs.map((e) => (
          <Contador key={e.id} rotulo={`${e.tipo}s ${e.tipo === "Caixa" ? "fechadas" : "fechados"} com ${e.quantidade}`} valor={fechadas[e.id] ?? ""}
            onMudar={(v) => setFechadas((f) => ({ ...f, [e.id]: v }))} />
        ))}
        <Contador rotulo={embs.length ? `Sem embalagem (${plural})` : `No depósito (${plural})`} valor={soltas} fracao={aceitaFracao(item.unidade)} onMudar={setSoltas} />
        {soltas && nSoltas.err && <p role="alert" className="text-sm font-semibold text-destructive">{nSoltas.err}</p>}
        {embs.length > 0 && !vazio && <p className="text-base font-bold">Total: {qtdUn(total, item.unidade)}</p>}
      </div>
      {erro && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro}</p>}
      <div className="mt-auto space-y-2">
        <button type="button" disabled={enviando || vazio || !!nSoltas.err} onClick={() => void enviar(total)}
          className={`flex items-center justify-center gap-2 ${btnPrimary(!enviando && !vazio && !nSoltas.err)}`}>
          <Check size={20} /> {enviando ? "Enviando…" : "Confirmar contagem"}
        </button>
        <button type="button" disabled={enviando} onClick={() => void enviar(0)} className={`w-full ${btnGhost}`}>{t("Não tem nenhum no depósito")}</button>
      </div>
      {scan && <Scanner mercado={mercado} onClose={() => setScan(false)} onType={() => setScan(false)} onDenied={() => setScan(false)} onCode={(c) => { setScan(false); void conferir(c); }} />}
    </div>
  );
}
