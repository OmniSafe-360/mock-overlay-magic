/* Repor gôndola no app do funcionário (E3). Primeiro ele conta a prateleira (sem ver quanto o sistema tem);
 * só depois o app diz quanto buscar no depósito, até encher (o máximo). Até o PDV existir, a contagem só acerta o estoque. */
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Camera, Check, CheckCircle2, MapPin, PackageSearch, Search, ShoppingBasket, Warehouse } from "lucide-react";
import { Scanner } from "@/components/Scanner";
import { Sheet } from "@/components/parts/Sheet";
import { Contador } from "@/components/parts/Contador";
import { TIPO_FROM_DB, btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import { aceitaFracao, newUid, parseNum, qtdUn, unPlural } from "@/lib/deposito";
import { textoDoTipo } from "@/lib/exemplos";
import { mensagemErro } from "@/lib/persistencia";
import { nomeProdutoFunc, type ProdutoFunc } from "@/lib/recebimento";

export type ApiRepor = {
  lista: typeof banco.listaReposicao;
  contar: typeof banco.contarPrateleira;
  concluir: typeof banco.concluirReposicao;
  buscar: typeof banco.buscarProdutoFuncionario;
};
const API_PADRAO: ApiRepor = { lista: banco.listaReposicao, contar: banco.contarPrateleira, concluir: banco.concluirReposicao, buscar: banco.buscarProdutoFuncionario };

const MSG_REPOR: [string, string][] = [
  ["produto_sem_area_venda", "Este produto não tem lugar na área de venda cadastrado. Avise o dono."],
  ["deposito_insuficiente", "O depósito não tem essa quantidade. Confira quanto você pegou."],
  ["deposito_reponivel_insuficiente", "Não há essa quantidade conferida e dentro da validade no depósito. Atualize e confira o que você pegou."],
  ["reposicao_acima_sugerido", "A quantidade passa do que foi indicado. Confira quanto você pegou."],
  ["reposicao_acima_maximo", "A quantidade passa da capacidade deste local. Atualize e confira."],
  ["operacao_repetida_com_outros_dados", "Este envio já foi registrado com outros dados. Volte ao início e atualize antes de continuar."],
  ["funcao_nao_permite_repor", "Sua função não inclui repor. Fale com o dono."],
  ["acesso_encerrado", "Este celular saiu do app. Entre de novo com o código do dono."],
  ["pin_necessario", "Por segurança, o app travou. Volte ao início e digite seu PIN."],
];
const erroTexto = (e: unknown) => {
  const m = String((e as { message?: string } | null)?.message ?? e ?? "");
  return MSG_REPOR.find(([k]) => m.includes(k))?.[1] ?? mensagemErro(e).replace("Seus dados continuam no formulário. ", "").replace("Não foi possível salvar agora. ", "Não foi possível enviar agora. ");
};
/** Ordem de caminho: Gôndola 3 antes de Gôndola 10; sem local por último. */
const porLocal = (a: banco.ItemReposicao, b: banco.ItemReposicao) =>
  (a.local ?? "￿").localeCompare(b.local ?? "￿", "pt-BR", { numeric: true, sensitivity: "base" }) || a.nome.localeCompare(b.nome, "pt-BR");

type Item = ProdutoFunc & { local: string | null; localDeposito: string | null };
type Tela =
  | { t: "lista" }
  | { t: "ir"; item: Item; id: string }
  | { t: "contar"; item: Item; id: string }
  | { t: "buscar"; item: Item; id: string; r: banco.RespostaContagemPrateleira };

export function ReporGondola({ chave, onVoltar, api: apiDada }: { chave: string; onVoltar: () => void; api?: ApiRepor | undefined }) {
  const api = apiDada ?? API_PADRAO;
  const [tela, setTela] = useState<Tela>({ t: "lista" });
  const [dados, setDados] = useState<{ tipo: string; produtos: banco.ItemReposicao[] } | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [outro, setOutro] = useState(false);
  const carregar = useCallback(() => { setErro(""); api.lista(chave).then((d) => setDados({ ...d, produtos: [...d.produtos].sort(porLocal) })).catch((e) => setErro(erroTexto(e))); }, [api, chave]);
  useEffect(carregar, [carregar]);
  const tipo = TIPO_FROM_DB[dados?.tipo ?? ""] ?? "mercado";
  const t = textoDoTipo(tipo);
  const prateleira = tipo === "mercado" || tipo === "pet" ? "gôndola" : "área de venda";
  const titulo = tipo === "mercado" || tipo === "pet" ? "Repor gôndola" : "Repor área de venda";
  const comecar = (item: Item) => { setFeito(""); setTela({ t: "ir", item, id: newUid() }); };
  const terminou = (item: Item, levado: number) => {
    setFeito(levado > 0 ? `${nomeProdutoFunc(item)}: ${qtdUn(levado, item.unidade)} na ${prateleira}.` : `${nomeProdutoFunc(item)}: contagem registrada.`);
    setTela({ t: "lista" }); carregar();
  };

  if (tela.t === "ir")
    return <Ir mercado={tipo === "mercado"} item={tela.item} prateleira={prateleira} chave={chave} api={api} onVoltar={() => setTela({ t: "lista" })} onCheguei={() => setTela({ t: "contar", item: tela.item, id: tela.id })} />;
  if (tela.t === "contar")
    return <ContarPrateleira item={tela.item} id={tela.id} prateleira={prateleira} chave={chave} api={api} onVoltar={() => setTela({ t: "ir", item: tela.item, id: tela.id })}
      onContou={(r) => setTela({ t: "buscar", item: tela.item, id: tela.id, r })} />;
  if (tela.t === "buscar")
    return <Buscar item={tela.item} id={tela.id} r={tela.r} prateleira={prateleira} t={t} chave={chave} api={api} onPronto={(lev) => terminou(tela.item, lev)} />;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onVoltar} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Início</button>
      <div>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">Estes produtos estão acabando na {prateleira}. Vá em cada um, conte o que tem e o app diz quanto buscar.</p>
      </div>
      {feito && <p role="status" className="flex items-start gap-2 rounded-2xl border border-accent/50 bg-accent/10 p-3 text-sm font-semibold text-accent"><CheckCircle2 size={18} className="mt-0.5 shrink-0" /> Pronto! {feito}</p>}
      {erro && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro}</p>}
      {!dados && !erro && <p className="py-8 text-center text-muted-foreground">Carregando…</p>}
      {dados && !dados.produtos.length && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-4 py-8 text-center">
          <CheckCircle2 size={36} className="text-accent" />
          <p className="text-base font-bold">Tudo abastecido!</p>
          <p className="text-sm text-muted-foreground">Nenhum produto chegou ao mínimo na {prateleira}.</p>
        </div>
      )}
      <ul className="space-y-3">
        {dados?.produtos.map((p) => (
          <li key={`${p.produtoId}:${p.variacaoId ?? "_"}`}>
            <button type="button" onClick={() => comecar(p)} className="flex w-full items-center gap-3 rounded-3xl border-2 border-destructive/50 bg-destructive/5 p-4 text-left transition active:scale-[0.99]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><ShoppingBasket size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-lg font-bold leading-snug">{nomeProdutoFunc(p)}</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin size={14} /> {p.local ?? `Sem lugar na ${prateleira}`}</span>
                {p.depositoVazio && <span className="block text-sm font-semibold text-warning">{t("Sem quantidade disponível para repor no depósito")}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setOutro(true)} className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}><PackageSearch size={18} /> Repor outro produto</button>
      {outro && <EscolherProduto mercado={dados?.tipo === "mercado"} chave={chave} api={api} onClose={() => setOutro(false)} onEscolher={(p) => { setOutro(false); comecar({ ...p, local: null, localDeposito: null }); }} />}
    </div>
  );
}

function Cabecalho({ item, onVoltar, voltar }: { item: Item; onVoltar: () => void; voltar: string }) {
  return (
    <>
      <button type="button" onClick={onVoltar} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> {voltar}</button>
      <div className="rounded-3xl border border-border bg-secondary/60 p-4">
        <p className="break-words text-xl font-bold leading-snug">{nomeProdutoFunc(item)}</p>
        {item.codigo && <p className="text-xs text-muted-foreground">Cód. {item.codigo}</p>}
      </div>
    </>
  );
}

function Ir({ item, prateleira, chave, api, onVoltar, onCheguei, mercado }: {
  item: Item; prateleira: string; chave: string; api: ApiRepor; onVoltar: () => void; onCheguei: () => void; mercado: boolean;
}) {
  const [scan, setScan] = useState(false);
  const [aviso, setAviso] = useState("");
  const conferir = async (codigo: string) => {
    try {
      const r = await api.buscar(chave, codigo);
      const certo = r.find((x) => x.produtoId === item.produtoId && (x.variacaoId ?? null) === (item.variacaoId ?? null));
      if (certo) { onCheguei(); return; }
      setAviso(r.length ? `Este código é de outro produto (${nomeProdutoFunc(r[0]!)}). Procure ${nomeProdutoFunc(item)}.` : "Código não encontrado. Confira se é o produto certo.");
    } catch (e) { setAviso(erroTexto(e)); }
  };
  return (
    <div className="flex flex-1 flex-col gap-4">
      <Cabecalho item={item} onVoltar={onVoltar} voltar="Lista" />
      <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-primary/50 bg-primary/10 p-6 text-center">
        <MapPin size={36} className="text-primary" />
        <p className="text-sm text-muted-foreground">Vá até</p>
        <p className="text-2xl font-bold">{item.local ?? `a ${prateleira} deste produto`}</p>
      </div>
      {aviso && <p role="alert" className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">{aviso}</p>}
      <div className="mt-auto space-y-2">
        <button type="button" onClick={() => setScan(true)} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><Camera size={20} /> Bipar o produto na prateleira</button>
        <button type="button" onClick={onCheguei} className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}>Estou na prateleira, vou contar</button>
      </div>
      {scan && <Scanner mercado={mercado} onClose={() => setScan(false)} onType={() => { setScan(false); onCheguei(); }} onDenied={() => { setScan(false); onCheguei(); }}
        onCode={(c) => { setScan(false); void conferir(c); }} />}
    </div>
  );
}

function ContarPrateleira({ item, id, prateleira, chave, api, onVoltar, onContou }: {
  item: Item; id: string; prateleira: string; chave: string; api: ApiRepor; onVoltar: () => void; onContou: (r: banco.RespostaContagemPrateleira) => void;
}) {
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const n = parseNum(valor, item.unidade, false);
  const plural = unPlural(item.unidade).toLowerCase();
  const enviar = async (q: number) => {
    setEnviando(true); setErro("");
    try { onContou(await api.contar(chave, id, item.produtoId, item.variacaoId, q)); }
    catch (e) { setErro(erroTexto(e)); setEnviando(false); }
  };
  return (
    <div className="flex flex-1 flex-col gap-4">
      <Cabecalho item={item} onVoltar={onVoltar} voltar="Voltar" />
      <div className="space-y-3 rounded-3xl border border-border p-4">
        <p className="text-xl font-bold">Quanto tem na {prateleira} agora?</p>
        <p className="text-sm text-muted-foreground">Conte tudo deste produto na {prateleira}, inclusive atrás e embaixo.</p>
        <Contador rotulo={`Na ${prateleira} (${plural})`} valor={valor} fracao={aceitaFracao(item.unidade)} onMudar={setValor} />
        {valor && n.err && <p role="alert" className="text-sm font-semibold text-destructive">{n.err}</p>}
      </div>
      {erro && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro}</p>}
      <div className="mt-auto space-y-2">
        <button type="button" disabled={enviando || n.v == null} onClick={() => n.v != null && void enviar(n.v)} className={`flex items-center justify-center gap-2 ${btnPrimary(!enviando && n.v != null)}`}>
          <Check size={20} /> {enviando ? "Enviando…" : "Confirmar contagem"}
        </button>
        <button type="button" disabled={enviando} onClick={() => void enviar(0)} className={`w-full ${btnGhost}`}>Está vazia (nenhum)</button>
      </div>
    </div>
  );
}

function Buscar({ item, id, r, prateleira, t, chave, api, onPronto }: {
  item: Item; id: string; r: banco.RespostaContagemPrateleira; prateleira: string; t: (s: string) => string; chave: string; api: ApiRepor; onPronto: (levado: number) => void;
}) {
  const [valor, setValor] = useState(r.sugerido > 0 ? String(r.sugerido).replace(".", ",") : "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const n = parseNum(valor, item.unidade, true);
  const lev = n.v ?? 0;
  const acima = lev > r.sugerido;
  const concluir = async (q: number) => {
    setEnviando(true); setErro("");
    try { await api.concluir(chave, id, q); onPronto(q); }
    catch (e) { setErro(erroTexto(e)); setEnviando(false); }
  };
  if (r.cheio || r.depositoVazio || r.sugerido <= 0)
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="rounded-3xl border border-border bg-secondary/60 p-4"><p className="break-words text-xl font-bold">{nomeProdutoFunc(item)}</p></div>
        <div className={`rounded-3xl border p-5 text-center ${r.cheio ? "border-accent/50 bg-accent/10" : "border-warning/50 bg-warning/10"}`}>
          <p className="text-xl font-bold">{r.cheio ? `A ${prateleira} está cheia` : "Sem quantidade disponível para repor"}</p>
          <p className="mt-1 text-sm">{r.cheio ? "Não precisa repor agora." : t("Avise o dono para conferir o depósito. Sua contagem já ajuda.")}</p>
        </div>
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
        <button type="button" disabled={enviando} onClick={() => void concluir(0)} className={`mt-auto ${btnPrimary(!enviando)}`}>{enviando ? "Enviando…" : "Entendi"}</button>
      </div>
    );
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="rounded-3xl border border-border bg-secondary/60 p-4"><p className="break-words text-xl font-bold">{nomeProdutoFunc(item)}</p></div>
      <div className="flex flex-col items-center gap-1 rounded-3xl border-2 border-primary/50 bg-primary/10 p-5 text-center">
        <Warehouse size={34} className="text-primary" />
        <p className="text-sm text-muted-foreground">{t("Busque no depósito")}</p>
        <p className="text-3xl font-bold">{qtdUn(r.sugerido, item.unidade)}</p>
        {(r.localDeposito ?? item.localDeposito) && <p className="flex items-center gap-1 text-sm"><MapPin size={14} /> {r.localDeposito ?? item.localDeposito}</p>}
      </div>
      <div className="space-y-2 rounded-3xl border border-border p-4">
        <p className="text-base font-bold">Quanto você colocou na {prateleira}?</p>
        <Contador rotulo={`Coloquei (${unPlural(item.unidade).toLowerCase()})`} valor={valor} fracao={aceitaFracao(item.unidade)} onMudar={setValor} />
        <p className="text-xs text-muted-foreground">{t("Se o depósito tinha menos, diga quanto pegou.")}</p>
        {acima && <p role="alert" className="text-sm font-semibold text-destructive">No máximo {qtdUn(r.sugerido, item.unidade)}: mais que isso não cabe.</p>}
        {n.err && <p role="alert" className="text-sm font-semibold text-destructive">{n.err}</p>}
      </div>
      {erro && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro}</p>}
      <button type="button" disabled={enviando || acima || !!n.err} onClick={() => void concluir(lev)} className={`mt-auto flex items-center justify-center gap-2 ${btnPrimary(!enviando && !acima && !n.err)}`}>
        <Check size={20} /> {enviando ? "Enviando…" : `Coloquei na ${prateleira}`}
      </button>
    </div>
  );
}

function EscolherProduto({ chave, api, onClose, onEscolher, mercado }: { chave: string; api: ApiRepor; onClose: () => void; onEscolher: (p: ProdutoFunc) => void; mercado: boolean }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ProdutoFunc[] | null>(null);
  const [scan, setScan] = useState(false);
  const [erro, setErro] = useState("");
  const procurar = async (texto: string) => {
    if (texto.trim().length < 2) return;
    setErro("");
    try { const r = await api.buscar(chave, texto.trim()); if (r.length === 1) onEscolher(r[0]!); else setRes(r); }
    catch (e) { setErro(erroTexto(e)); }
  };
  return (
    <Sheet title="Repor outro produto" onClose={onClose}>
      <form className="min-h-0 space-y-3 overflow-y-auto px-5 py-3" onSubmit={(e) => { e.preventDefault(); void procurar(q); }}>
        <button type="button" onClick={() => setScan(true)} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><Camera size={20} /> Bipar produto</button>
        <label className="relative block">
          <span className="sr-only">Código ou nome</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código de barras ou nome" enterKeyHint="search"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 pl-11 pr-4 text-base text-foreground outline-none focus-visible:border-primary" />
        </label>
        <button type="submit" disabled={q.trim().length < 2} className={`w-full ${btnGhost}`}>Procurar</button>
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
        {res && !res.length && <p className="text-center text-sm text-muted-foreground">Nada encontrado.</p>}
        <ul className="divide-y divide-border">
          {res?.map((p) => (
            <li key={`${p.produtoId}:${p.variacaoId ?? "_"}:${p.embalagemId ?? ""}`}>
              <button type="button" onClick={() => onEscolher(p)} className="flex min-h-13 w-full items-center py-2 text-left text-base font-semibold">{nomeProdutoFunc(p)}</button>
            </li>
          ))}
        </ul>
      </form>
      {scan && <Scanner mercado={mercado} onClose={() => setScan(false)} onType={() => setScan(false)} onDenied={() => setScan(false)} onCode={(c) => { setScan(false); setQ(c); void procurar(c); }} />}
    </Sheet>
  );
}
