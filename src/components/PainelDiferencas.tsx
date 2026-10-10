/* Aba Diferenças do comércio (Fase 4.3): o dono confirma as perdas da equipe e explica cada diferença entre o que foi
 * contado e o que o sistema tinha, com o valor em reais. Também registra perdas ele mesmo. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronRight, PackageX, RefreshCw, Search } from "lucide-react";
import { Sheet, type Product } from "@/components/ProductArea";
import { Contador } from "@/components/ReceberMercadoria";
import { MOTIVOS_PERDA } from "@/components/RegistrarPerda";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import { aceitaFracao, fmtQ, newUid, parseNum, qtdUn, unPlural } from "@/lib/deposito";
import {
  MOTIVOS_DIFERENCA, MOTIVO_PERDA_TXT, motivoDiferencaTxt, ondeTexto, ordemDiferencas, origemTexto, precisaEscolher, resumoDiferencas, textoDiferenca, valorSinal,
  type AreaEstoque, type Diferenca, type MotivoDiferenca, type MotivoPerda, type Perda,
} from "@/lib/diferencas";
import { textoDoTipo } from "@/lib/exemplos";
import { mensagemErro } from "@/lib/persistencia";
import { nomeVenda } from "@/lib/situacao";
import { hojeEm } from "@/lib/validade";
import { brl, haQuanto, normalizar } from "@/lib/vendas";

export type ApiDiferencas = {
  carregar: typeof banco.carregarDiferencas;
  decidirPerda: typeof banco.decidirPerda;
  explicar: typeof banco.explicarDiferenca;
  resolver: typeof banco.resolverConferencia;
  registrarPerda: typeof banco.registrarPerdaDono;
};
const API_PADRAO: ApiDiferencas = {
  carregar: banco.carregarDiferencas, decidirPerda: banco.decidirPerda, explicar: banco.explicarDiferenca,
  resolver: banco.resolverConferencia, registrarPerda: banco.registrarPerdaDono,
};
const MSG: [string, string][] = [
  ["perda_ja_decidida", "Esta perda já foi decidida. A lista foi atualizada."],
  ["contagem_ja_resolvida", "Esta contagem já foi resolvida. A lista foi atualizada."],
  ["variacao_obrigatoria", "Escolha o tamanho e a cor."],
  ["unidade_exige_inteiro", "Este produto é contado inteiro (sem vírgula)."],
];
const erroTexto = (e: unknown) => {
  const m = String((e as { message?: string } | null)?.message ?? e ?? "");
  return MSG.find(([k]) => m.includes(k))?.[1] ?? mensagemErro(e).replace("Seus dados continuam no formulário. ", "");
};
/** "98, 97 e 98 unidades". */
const listaContagens = (ns: number[], unidade: string) => {
  const ult = qtdUn(ns[ns.length - 1]!, unidade);
  return ns.length === 1 ? ult : `${ns.slice(0, -1).map(fmtQ).join(", ")} e ${ult}`;
};
/** Mostra 30 dias de histórico; abertas e aguardando aparecem sempre. */
const DIAS_HISTORICO = 30;

export function PainelDiferencas({ comercioId, tipo, products, api = API_PADRAO, onMudou }: {
  comercioId: string; tipo: string; products: Product[]; api?: ApiDiferencas | undefined;
  /** O estoque ou os números do resumo mudaram. */ onMudou?: (() => void) | undefined;
}) {
  const [dados, setDados] = useState<{ diferencas: Diferenca[]; perdas: Perda[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [registrar, setRegistrar] = useState(false);
  const [pronto, setPronto] = useState("");
  const [agora, setAgora] = useState(() => Date.now());
  const recarregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const desde = new Date(Date.now() - DIAS_HISTORICO * 86_400_000).toISOString();
      setDados(await api.carregar(comercioId, desde)); setErro(false); setAgora(Date.now());
    } catch { setErro(true); }
    setAtualizando(false);
  }, [api, comercioId]);
  useEffect(() => { void recarregar(); }, [recarregar]);

  const prod = useCallback((id: string) => products.find((p) => (p.db?.id ?? String(p.id)) === id), [products]);
  const nome = (produtoId: string, variacaoId: string | null) => {
    const p = prod(produtoId);
    const v = variacaoId ? p?.variacoes.find((x) => x.uid === variacaoId) : undefined;
    return `${p?.nome ?? "Produto removido"}${v ? ` · ${[v.tam, v.cor].filter(Boolean).join(" ")}` : ""}`;
  };
  const unidade = (produtoId: string) => prod(produtoId)?.unidade ?? "Unidade";
  const resumo = useMemo(() => resumoDiferencas(dados?.diferencas ?? [], dados?.perdas ?? [], hojeEm(), (id) => prod(id)?.compra ?? 0), [dados, prod]);
  const perdasAguardando = (dados?.perdas ?? []).filter((p) => p.situacao === "aguardando").sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  const abertas = (dados?.diferencas ?? []).filter((d) => d.situacao === "aberta").sort(ordemDiferencas);
  const historico = [
    ...(dados?.diferencas ?? []).filter((d) => d.situacao === "explicada").map((d) => ({ k: `d${d.id}`, em: d.criadaEm, d })),
    ...(dados?.perdas ?? []).filter((p) => p.situacao !== "aguardando").map((p) => ({ k: `p${p.id}`, em: p.criadaEm, p })),
  ].sort((a, b) => b.em.localeCompare(a.em));
  const difAberta = dados?.diferencas.find((d) => d.id === aberta) ?? null;
  const depois = async (msg: string) => { setPronto(msg); await recarregar(); onMudou?.(); };

  if (!dados && !erro) return <p className="py-10 text-center text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-5">
      <section aria-label="Resumo das diferenças" className="rounded-3xl border border-border bg-secondary/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Diferenças</h2>
            <p className="text-sm text-muted-foreground">O que a equipe contou e o sistema não esperava. Confirme as perdas e explique cada diferença.</p>
          </div>
          <button type="button" onClick={() => void recarregar()} disabled={atualizando} aria-label="Atualizar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border text-muted-foreground disabled:opacity-50">
            <RefreshCw size={18} className={atualizando ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <p className="text-xs text-muted-foreground">Faltou este mês</p>
            <p className={`text-xl font-bold tabular-nums ${resumo.faltouMes > 0 ? "text-destructive" : ""}`}>{brl(resumo.faltouMes)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <p className="text-xs text-muted-foreground">Perdas este mês</p>
            <p className="text-xl font-bold tabular-nums">{brl(resumo.perdasMes)}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Pelo preço de compra. "Faltou" não conta o que você explicou como erro de contagem.</p>
        {erro && <p role="alert" className="mt-3 text-sm text-warning">Não foi possível atualizar agora.{dados ? " Os números são da última consulta." : ""}</p>}
      </section>

      {pronto && <p role="status" className="flex items-center gap-2 rounded-2xl border border-accent/50 bg-accent/10 p-3 text-sm font-semibold text-accent"><Check size={18} className="shrink-0" /> {pronto}</p>}

      {dados && !perdasAguardando.length && !abertas.length && (
        <p className="flex items-center gap-2 rounded-3xl border border-accent/50 bg-accent/10 p-4 text-sm font-semibold text-accent">
          <CheckCircle2 size={20} className="shrink-0" /> Tudo certo! Nenhuma perda ou diferença esperando você.
        </p>
      )}

      {perdasAguardando.length > 0 && (
        <section aria-label="Perdas para confirmar" className="space-y-3">
          <div>
            <h2 className="text-base font-bold">Perdas para confirmar ({perdasAguardando.length})</h2>
            <p className="text-xs text-muted-foreground">Já saíram do estoque. Confirme se aconteceu mesmo.</p>
          </div>
          <ul className="space-y-2">
            {perdasAguardando.map((p) => (
              <CartaoPerda key={p.id} p={p} nome={nome(p.produtoId, p.variacaoId)} unidade={unidade(p.produtoId)} tipo={tipo} agora={agora}
                valor={Math.round(p.baixado * (prod(p.produtoId)?.compra ?? 0))}
                onDecidir={async (aceitar) => {
                  try { await api.decidirPerda(p.id, aceitar); }
                  catch (e) { await recarregar(); throw e; }
                  await depois(aceitar ? "Perda confirmada." : "Perda não confirmada: virou uma diferença para explicar, logo abaixo.");
                }} />
            ))}
          </ul>
        </section>
      )}

      {abertas.length > 0 && (
        <section aria-label="Diferenças para explicar" className="space-y-3">
          <div>
            <h2 className="text-base font-bold">Diferenças para explicar ({abertas.length})</h2>
            <p className="text-xs text-muted-foreground">Toque para dizer o que aconteceu. O estoque já está com o número contado.</p>
          </div>
          <ul className="space-y-2">
            {abertas.map((d) => (
              <li key={d.id}><CartaoDiferenca d={d} nome={nome(d.produtoId, d.variacaoId)} unidade={unidade(d.produtoId)} tipo={tipo} agora={agora} onClick={() => { setPronto(""); setAberta(d.id); }} /></li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" onClick={() => { setPronto(""); setRegistrar(true); }} className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}>
        <PackageX size={20} /> Registrar perda
      </button>

      {historico.length > 0 && (
        <details className="rounded-2xl border border-border p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-muted-foreground">Resolvidas nos últimos {DIAS_HISTORICO} dias ({historico.length})</summary>
          <ul className="mt-2 divide-y divide-border">
            {historico.map((h) => "d" in h && h.d ? (
              <li key={h.k}>
                <button type="button" onClick={() => setAberta(h.d.id)} className="flex min-h-12 w-full items-center gap-3 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{nome(h.d.produtoId, h.d.variacaoId)}</span>
                    <span className="block text-xs text-muted-foreground">{textoDiferenca(h.d, unidade(h.d.produtoId), tipo)} · {motivoDiferencaTxt(h.d.motivo)}</span>
                  </span>
                  <span className={`shrink-0 text-sm font-bold tabular-nums ${h.d.valor < 0 ? "text-destructive" : ""}`}>{valorSinal(h.d.valor)}</span>
                </button>
              </li>
            ) : "p" in h && h.p ? (
              <li key={h.k} className="flex min-h-12 items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{nome(h.p.produtoId, h.p.variacaoId)}</span>
                  <span className="block text-xs text-muted-foreground">
                    Perda · {qtdUn(h.p.baixado, unidade(h.p.produtoId))} · {MOTIVO_PERDA_TXT[h.p.motivo].toLowerCase()} · {h.p.situacao === "confirmada" ? (h.p.peloDono ? "registrada por você" : "confirmada") : "não confirmada"}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{haQuanto(h.p.criadaEm, agora)}</span>
              </li>
            ) : null)}
          </ul>
        </details>
      )}

      {difAberta && (
        <ExplicarDiferenca d={difAberta} nome={nome(difAberta.produtoId, difAberta.variacaoId)} unidade={unidade(difAberta.produtoId)} tipo={tipo}
          precoCompra={prod(difAberta.produtoId)?.compra ?? 0} onClose={() => setAberta(null)}
          onSalvar={async (contado, motivo, obs) => {
            try {
              let dif = difAberta.diferenca;
              if (contado != null) dif = (await api.resolver(difAberta.id, contado)).diferenca;
              if (dif !== 0 && motivo) await api.explicar(difAberta.id, motivo, obs);
            } catch (e) { await recarregar(); throw e; }
            setAberta(null);
            await depois(contado != null ? "Estoque acertado com a contagem escolhida." : "Explicação salva.");
          }} />
      )}
      {registrar && (
        <PerdaDono products={products} tipo={tipo} onClose={() => setRegistrar(false)}
          onRegistrar={async (p) => {
            await api.registrarPerda({ ...p, comercioId });
            setRegistrar(false);
            await depois(`Perda registrada: ${qtdUn(p.quantidade, prod(p.produtoId)?.unidade ?? "Unidade")} saíram do estoque.`);
          }} />
      )}
    </div>
  );
}

function CartaoPerda({ p, nome, unidade, tipo, agora, valor, onDecidir }: {
  p: Perda; nome: string; unidade: string; tipo: string; agora: number; valor: number; onDecidir: (aceitar: boolean) => Promise<void>;
}) {
  const [recusar, setRecusar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const decidir = (aceitar: boolean) => {
    setEnviando(true); setErro("");
    onDecidir(aceitar).catch((e) => { setErro(erroTexto(e)); setEnviando(false); });
  };
  return (
    <li className="space-y-2 rounded-2xl border border-warning/50 bg-warning/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block break-words text-sm font-bold">{nome}</span>
          <span className="block text-sm">{qtdUn(p.quantidade, unidade)} · {MOTIVO_PERDA_TXT[p.motivo]} · {ondeTexto(p.area, tipo)}</span>
          <span className="block text-xs text-muted-foreground">{p.funcionario ?? "Equipe"} · {haQuanto(p.criadaEm, agora)}</span>
        </span>
        {valor > 0 && <span className="shrink-0 text-sm font-bold tabular-nums text-destructive">{valorSinal(-valor)}</span>}
      </div>
      {p.observacao && <p className="rounded-xl bg-background/40 px-3 py-2 text-sm italic">"{p.observacao}"</p>}
      {p.baixado < p.quantidade && (
        <p className="text-xs font-semibold text-warning">O sistema só tinha {qtdUn(p.baixado, unidade)} {ondeTexto(p.area, tipo)}: {p.baixado === 0 ? "nada saiu" : "só isso saiu"} do estoque.</p>
      )}
      {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
      {!recusar ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={enviando} onClick={() => decidir(true)} className={`flex items-center justify-center gap-2 ${btnPrimary(!enviando)}`}><Check size={18} /> Confirmar</button>
          <button type="button" disabled={enviando} onClick={() => setRecusar(true)} className={btnGhost}>Não aconteceu</button>
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-border bg-background/40 p-3">
          <p className="text-sm">O produto já saiu do estoque. Se a perda não aconteceu, ela vira uma <b>diferença para investigar</b> (pode ter sumido).</p>
          <button type="button" disabled={enviando} onClick={() => decidir(false)} className={`w-full ${btnGhost}`}>{enviando ? "Salvando…" : "Sim, não confirmo"}</button>
          <button type="button" onClick={() => setRecusar(false)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
        </div>
      )}
    </li>
  );
}

function CartaoDiferenca({ d, nome, unidade, tipo, agora, onClick }: { d: Diferenca; nome: string; unidade: string; tipo: string; agora: number; onClick: () => void }) {
  const escolher = precisaEscolher(d);
  const cor = escolher ? "border-warning/50 bg-warning/5" : d.diferenca < 0 ? "border-destructive/50 bg-destructive/5" : "border-border bg-secondary/50";
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-primary ${cor}`}>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-bold">{nome}</span>
        <span className={`block text-sm font-semibold ${escolher ? "text-warning" : d.diferenca < 0 ? "text-destructive" : ""}`}>{textoDiferenca(d, unidade, tipo)}</span>
        <span className="block text-xs text-muted-foreground">{origemTexto(d, tipo)} · {d.funcionario ?? "Equipe"} · {haQuanto(d.criadaEm, agora)}</span>
        {escolher && <span className="block text-xs font-semibold text-warning">Escolha a contagem certa</span>}
      </span>
      {!escolher && <span className={`shrink-0 text-sm font-bold tabular-nums ${d.valor < 0 ? "text-destructive" : ""}`}>{valorSinal(d.valor)}</span>}
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
    </button>
  );
}

/** Explicar uma diferença. Na contagem que não bateu, primeiro escolhe o número certo. */
function ExplicarDiferenca({ d, nome, unidade, tipo, precoCompra, onSalvar, onClose }: {
  d: Diferenca; nome: string; unidade: string; tipo: string; precoCompra: number; onClose: () => void;
  onSalvar: (contado: number | null, motivo: MotivoDiferenca | null, obs: string) => Promise<void>;
}) {
  const escolher = precisaEscolher(d);
  const [contado, setContado] = useState<number | null>(null);
  const [motivo, setMotivo] = useState<MotivoDiferenca | null>(d.motivo);
  const [obs, setObs] = useState(d.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const onde = ondeTexto(d.area, tipo);
  const opcoes = escolher ? [...new Set(d.tentativas)].map((n) => ({ n, txt: `Contagem da equipe: ${qtdUn(n, unidade)}` })).concat([{ n: d.esperado, txt: `Manter o número do sistema: ${qtdUn(d.esperado, unidade)}` }]) : [];
  const difFinal = escolher ? (contado == null ? null : contado - d.esperado) : d.diferenca;
  const precisaMotivo = difFinal != null && difFinal !== 0;
  const ok = !salvando && (!escolher || contado != null) && (!precisaMotivo || (!!motivo && (motivo !== "outro" || obs.trim().length >= 3)));
  const salvar = () => {
    setSalvando(true); setErro("");
    onSalvar(escolher ? contado : null, precisaMotivo ? motivo : null, obs.trim()).catch((e) => { setErro(erroTexto(e)); setSalvando(false); });
  };
  return (
    <Sheet title="Explicar diferença" onClose={onClose}>
      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-3">
        <div className="rounded-2xl border border-border p-3">
          <p className="text-base font-bold">{nome}</p>
          <p className="text-sm text-muted-foreground">{origemTexto(d, tipo)}{d.funcionario ? ` · ${d.funcionario}` : ""}</p>
          {!escolher && (
            <>
              <p className="mt-2 text-sm">O sistema tinha <b>{qtdUn(d.esperado, unidade)}</b> {onde}; {d.origem === "perda_recusada" ? "a perda que você não confirmou deixou" : "contaram"} <b>{qtdUn(d.contado, unidade)}</b>.</p>
              <p className={`mt-1 text-lg font-bold ${d.diferenca < 0 ? "text-destructive" : ""}`}>{textoDiferenca(d, unidade, tipo)} · {valorSinal(d.valor)}</p>
              {d.tentativas.length > 1 && <p className="text-xs text-muted-foreground">Contagens da equipe: {listaContagens(d.tentativas, unidade)}.</p>}
            </>
          )}
        </div>

        {escolher && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-base font-bold">As 3 contagens não bateram. Qual número está certo?</legend>
            <p className="text-sm text-muted-foreground">O sistema tinha {qtdUn(d.esperado, unidade)} {onde}. Se não souber, peça para alguém contar de novo antes de escolher.</p>
            {opcoes.map((o) => (
              <button key={o.txt} type="button" aria-pressed={contado === o.n} onClick={() => setContado(o.n)}
                className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border px-4 text-left text-sm font-semibold ${contado === o.n ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
                {o.txt} {contado === o.n && <Check size={18} />}
              </button>
            ))}
            {difFinal != null && (
              <p className={`text-sm font-semibold ${difFinal < 0 ? "text-destructive" : ""}`}>
                {difFinal === 0 ? "O estoque fica como está." : `${difFinal < 0 ? "Faltam" : "Sobram"} ${qtdUn(Math.abs(difFinal), unidade)} · ${valorSinal(Math.round(difFinal * precoCompra))}. O estoque será acertado.`}
              </p>
            )}
          </fieldset>
        )}

        {precisaMotivo && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-base font-bold">O que aconteceu?</legend>
            <div className="grid grid-cols-1 gap-2">
              {MOTIVOS_DIFERENCA.map((m) => (
                <button key={m.id} type="button" aria-pressed={motivo === m.id} onClick={() => setMotivo(m.id)}
                  className={`flex min-h-12 flex-col justify-center rounded-2xl border px-4 py-2 text-left ${motivo === m.id ? "border-primary bg-primary/15" : "border-border"}`}>
                  <span className={`text-sm font-semibold ${motivo === m.id ? "text-primary" : ""}`}>{m.txt}</span>
                  <span className="text-xs text-muted-foreground">{m.ajuda}</span>
                </button>
              ))}
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-medium">{motivo === "outro" ? "O que aconteceu? (obrigatório)" : "Anotação (opcional)"}</span>
              <input value={obs} maxLength={300} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: conferir câmera da gôndola"
                className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            </label>
          </fieldset>
        )}
      </div>
      <div className="shrink-0 space-y-2 border-t border-border px-5 pt-3">
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
        <button type="button" disabled={!ok} onClick={salvar} className={btnPrimary(ok)}>
          {salvando ? "Salvando…" : escolher ? (precisaMotivo ? "Acertar o estoque e salvar" : "Salvar") : d.situacao === "explicada" ? "Mudar a explicação" : "Salvar explicação"}
        </button>
      </div>
    </Sheet>
  );
}

/** O dono registra uma perda: sai do estoque na hora, já confirmada. */
function PerdaDono({ products, tipo, onRegistrar, onClose }: {
  products: Product[]; tipo: string; onClose: () => void;
  onRegistrar: (p: { id: string; produtoId: string; variacaoId: string | null; area: AreaEstoque; quantidade: number; motivo: MotivoPerda; observacao: string }) => Promise<void>;
}) {
  const [id] = useState(newUid);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Product | null>(null);
  const [variacao, setVariacao] = useState<string | null>(null);
  const [area, setArea] = useState<AreaEstoque | null>(null);
  const [motivo, setMotivo] = useState<MotivoPerda | null>(null);
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const q = normalizar(busca);
  const achados = (q ? products.filter((p) => normalizar(p.nome ?? "").includes(q) || (p.codigo ?? "").includes(q)) : products).filter((p) => p.db?.id).slice(0, 30);
  const vars = (sel?.variacoes ?? []).filter((v) => v.uid);
  const n = sel ? parseNum(valor, sel.unidade, false) : { v: null, err: "" };
  const ok = !!sel && (!vars.length || !!variacao) && !!area && !!motivo && n.v != null && !n.err && (motivo !== "outro" || obs.trim().length >= 3) && !salvando;
  const enviar = () => {
    if (!ok || !sel || !area || !motivo || n.v == null) return;
    setSalvando(true); setErro("");
    onRegistrar({ id, produtoId: sel.db!.id, variacaoId: variacao, area, quantidade: n.v, motivo, observacao: obs.trim() })
      .catch((e) => { setErro(erroTexto(e)); setSalvando(false); });
  };
  return (
    <Sheet title="Registrar perda" onClose={onClose}>
      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-3">
        <p className="text-sm text-muted-foreground">Sai do estoque agora, já confirmada.</p>
        {!sel ? (
          <>
            <label className="relative block">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar pelo nome ou código" aria-label="Procurar produto"
                className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 pl-11 pr-4 text-base text-foreground outline-none focus-visible:border-primary" />
            </label>
            <ul className="max-h-60 space-y-1.5 overflow-y-auto" aria-label="Produtos">
              {!achados.length && <li className="p-3 text-center text-sm text-muted-foreground">Nenhum produto com esse nome.</li>}
              {achados.map((p) => (
                <li key={String(p.id)}>
                  <button type="button" onClick={() => { setSel(p); setVariacao(null); setValor(""); }}
                    className="flex min-h-12 w-full items-center gap-2 rounded-2xl border border-border px-3 text-left text-sm">
                    <span className="min-w-0"><span className="block truncate font-semibold">{p.nome}</span><span className="block text-xs text-muted-foreground">{p.codigo} · {p.unidade}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-primary/50 bg-primary/10 p-3">
            <span className="min-w-0 break-words font-semibold">{sel.nome}</span>
            <button type="button" onClick={() => setSel(null)} className="shrink-0 text-sm font-semibold text-primary">Trocar</button>
          </div>
        )}
        {sel && (
          <>
            {vars.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-bold">Qual tamanho e cor?</legend>
                <div className="flex flex-wrap gap-2">
                  {vars.map((v) => (
                    <button key={v.uid} type="button" aria-pressed={variacao === v.uid} onClick={() => setVariacao(v.uid!)}
                      className={`min-h-11 rounded-2xl border px-3 text-sm font-semibold ${variacao === v.uid ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
                      {[v.tam, v.cor].filter(Boolean).join(" · ")}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-bold">Onde estava?</legend>
              <div className="grid grid-cols-2 gap-2">
                {([["deposito", textoDoTipo(tipo)("No depósito")], ["venda", `Na ${nomeVenda(tipo).toLowerCase()}`]] as const).map(([k, txt]) => (
                  <button key={k} type="button" aria-pressed={area === k} onClick={() => setArea(k)}
                    className={`min-h-12 rounded-2xl border px-3 text-sm font-semibold ${area === k ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{txt}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-bold">O que aconteceu?</legend>
              <div className="flex flex-wrap gap-2">
                {MOTIVOS_PERDA.map((m) => (
                  <button key={m.id} type="button" aria-pressed={motivo === m.id} onClick={() => setMotivo(m.id)}
                    className={`min-h-11 rounded-2xl border px-3 text-sm font-semibold ${motivo === m.id ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{m.txt}</button>
                ))}
              </div>
            </fieldset>
            <Contador rotulo={`Quantos (${unPlural(sel.unidade).toLowerCase()})`} valor={valor} fracao={aceitaFracao(sel.unidade)} onMudar={setValor} />
            {valor && n.err && <p role="alert" className="text-sm font-semibold text-destructive">{n.err}</p>}
            <label className="block space-y-1">
              <span className="text-sm font-medium">{motivo === "outro" ? "O que aconteceu? (obrigatório)" : "Anotação (opcional)"}</span>
              <input value={obs} maxLength={300} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: caiu da prateleira"
                className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            </label>
          </>
        )}
      </div>
      <div className="shrink-0 space-y-2 border-t border-border px-5 pt-3">
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
        <button type="button" disabled={!ok} onClick={enviar} className={`flex items-center justify-center gap-2 ${btnPrimary(ok)}`}>
          <PackageX size={18} /> {salvando ? "Registrando…" : "Registrar perda"}
        </button>
      </div>
    </Sheet>
  );
}
