/* Relatório antifurto do comércio (Fase 5.1), dentro da aba Diferenças: o que falta, onde, quando e quem contou. */
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, MapPin, Package, ShieldAlert, Users } from "lucide-react";
import type { Product } from "@/components/ProductArea";
import * as banco from "@/lib/banco";
import { DIAS_SEMANA, PERIODOS, intervaloFalta, limitesPeriodo, relatorioAntifurto, type Contagem, type Periodo } from "@/lib/antifurto";
import { qtdUn } from "@/lib/deposito";
import { MOTIVO_PERDA_TXT, motivoDiferencaTxt, type AreaEstoque, type Diferenca, type Perda } from "@/lib/diferencas";
import { textoDoTipo } from "@/lib/exemplos";
import { nomeVenda } from "@/lib/situacao";
import { hojeEm } from "@/lib/validade";
import { brl } from "@/lib/vendas";

export type ApiRelatorio = { carregar: typeof banco.carregarDiferencas; contagens: typeof banco.carregarContagensAntifurto };
const API_PADRAO: ApiRelatorio = { carregar: banco.carregarDiferencas, contagens: banco.carregarContagensAntifurto };

export function RelatorioAntifurto({ comercioId, tipo, products, api = API_PADRAO }: { comercioId: string; tipo: string; products: Product[]; api?: ApiRelatorio | undefined }) {
  const hoje = useMemo(() => hojeEm(), []);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [dados, setDados] = useState<{ diferencas: Diferenca[]; perdas: Perda[]; contagens: Contagem[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    // Carrega 3 meses de uma vez; as contagens vêm de 30 dias antes, para achar o começo do intervalo da primeira falta.
    const de = limitesPeriodo("tres", hoje).de;
    const desde = new Date(`${de}T00:00:00-03:00`).toISOString();
    const antes = new Date(Date.parse(desde) - 30 * 86_400_000).toISOString();
    Promise.all([api.carregar(comercioId, desde), api.contagens(comercioId, antes)])
      .then(([d, c]) => { if (vivo) { setDados({ ...d, contagens: c }); setErro(false); } })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [api, comercioId, hoje]);

  const prod = (id: string) => products.find((p) => (p.db?.id ?? String(p.id)) === id);
  const t = textoDoTipo(tipo);
  const nomeArea = (a: AreaEstoque) => (a === "deposito" ? t("Depósito") : nomeVenda(tipo));
  const rel = useMemo(() => dados && relatorioAntifurto(dados.diferencas, dados.perdas, dados.contagens, periodo, hoje, {
    nome: (id, v) => { const p = prod(id); const x = v ? p?.variacoes.find((y) => y.uid === v) : undefined; return `${p?.nome ?? "Produto removido"}${x ? ` · ${[x.tam, x.cor].filter(Boolean).join(" ")}` : ""}`; },
    local: (id, a) => (a === "deposito" ? prod(id)?.deposito?.local : prod(id)?.areaVenda?.local) ?? null,
    compra: (id) => prod(id)?.compra ?? 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, nomeArea), [dados, periodo, hoje, products, tipo]);

  if (erro && !dados) return <p role="alert" className="rounded-2xl border border-warning/50 p-4 text-sm text-warning">Não foi possível carregar o relatório agora. Tente de novo em instantes.</p>;
  if (!rel) return <p className="py-10 text-center text-muted-foreground">Carregando…</p>;
  const unidade = (id: string) => prod(id)?.unidade ?? "Unidade";
  const maxDia = Math.max(1, ...rel.diasSemana.map((d) => d.vezes));
  const maxMotivo = Math.max(1, ...rel.porMotivo.map((m) => m.valor));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
        {PERIODOS.map((p) => (
          <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => { setPeriodo(p.id); setAberto(null); }}
            className={`min-h-11 rounded-2xl px-4 text-sm font-semibold transition ${periodo === p.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{p.txt}</button>
        ))}
      </div>

      <section aria-label="Total do período" className="rounded-3xl border border-border bg-secondary/40 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ShieldAlert size={18} className="text-destructive" /> Faltou no estoque</p>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${rel.faltouTotal > 0 ? "text-destructive" : ""}`}>{brl(rel.faltouTotal)}</p>
        <p className="text-sm text-muted-foreground">{rel.faltas.length === 0 ? "Nenhuma falta neste período" : rel.faltas.length === 1 ? "1 falta" : `${rel.faltas.length} faltas`}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <p className="text-xs text-muted-foreground">Perdas registradas</p>
            <p className="font-bold">{brl(rel.perdas.total)}</p>
            <p className="text-xs text-muted-foreground">{rel.perdas.vezes === 1 ? "1 registro" : `${rel.perdas.vezes} registros`}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <p className="text-xs text-muted-foreground">Erros de contagem</p>
            <p className="font-bold">{rel.erros.vezes}</p>
            <p className="text-xs text-muted-foreground">não contam como falta</p>
          </div>
        </div>
        {rel.porMotivo.length > 0 && (
          <ul className="mt-3 space-y-2" aria-label="Faltas por motivo">
            {rel.porMotivo.map((m) => (
              <li key={m.motivo}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className={m.motivo === "sumiu" || m.motivo === "aberta" ? "font-semibold text-destructive" : ""}>{m.motivo === "aberta" ? "Ainda sem explicação" : motivoDiferencaTxt(m.motivo)} · {m.vezes}</span>
                  <b className="tabular-nums">{brl(m.valor)}</b>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-background-deep/60">
                  <div className={`h-full rounded-full ${m.motivo === "sumiu" || m.motivo === "aberta" ? "bg-destructive" : "bg-warning"}`} style={{ width: `${Math.max(4, (m.valor / maxMotivo) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {rel.perdas.porMotivo.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Perdas: {rel.perdas.porMotivo.map((m) => `${MOTIVO_PERDA_TXT[m.motivo].toLowerCase()} ${brl(m.valor)}`).join(" · ")}</p>
        )}
      </section>

      {rel.produtos.length > 0 && (
        <section aria-label="Produtos que mais somem" className="space-y-2">
          <h2 className="flex items-center gap-2 text-base font-bold"><Package size={18} className="text-primary" /> Produtos que mais somem</h2>
          <ul className="space-y-2">
            {rel.produtos.slice(0, 10).map((p) => {
              const on = aberto === p.chave;
              const lista = rel.faltas.filter((f) => `${f.produtoId}:${f.variacaoId ?? ""}` === p.chave);
              const un = unidade(lista[0]!.produtoId);
              return (
                <li key={p.chave} className="rounded-2xl border border-border bg-secondary/50">
                  <button type="button" aria-expanded={on} onClick={() => setAberto(on ? null : p.chave)} className="flex w-full items-center gap-3 p-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-bold">{p.titulo}</span>
                      <span className={`block text-xs ${p.vezes >= 3 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{p.vezes === 1 ? "1 vez" : `${p.vezes} vezes`} · {qtdUn(p.qtd, un)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-destructive">{brl(p.valor)}</span>
                    <ChevronDown size={18} className={`shrink-0 text-muted-foreground transition ${on ? "rotate-180" : ""}`} />
                  </button>
                  {on && (
                    <ul className="space-y-2 border-t border-border px-3 py-2">
                      {lista.map((f) => (
                        <li key={f.id} className="text-xs">
                          <p className="font-semibold">{qtdUn(-f.diferenca, un)} {f.area === "deposito" ? t("no depósito") : `na ${nomeVenda(tipo).toLowerCase()}`} · {brl(-f.valor)} · {f.situacao === "aberta" ? <span className="text-destructive">sem explicação</span> : motivoDiferencaTxt(f.motivo).toLowerCase()}</p>
                          <p className="text-muted-foreground">{intervaloFalta(f)}{f.funcionario ? ` · contou: ${f.funcionario}` : ""}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {rel.lugares.length > 0 && (
        <section aria-label="Lugares com mais faltas" className="space-y-2">
          <h2 className="flex items-center gap-2 text-base font-bold"><MapPin size={18} className="text-primary" /> Lugares com mais faltas</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {rel.lugares.map((l) => (
              <li key={l.chave} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{l.titulo}</span>
                  <span className={`block text-xs ${l.produtos >= 3 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{l.sub} · {l.vezes === 1 ? "1 falta" : `${l.vezes} faltas`} · {l.produtos === 1 ? "1 produto" : `${l.produtos} produtos`}</span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums">{brl(l.valor)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rel.faltas.length > 0 && (
        <section aria-label="Dias da semana" className="space-y-2">
          <h2 className="flex items-center gap-2 text-base font-bold"><CalendarDays size={18} className="text-primary" /> Em que dia a falta foi descoberta</h2>
          <div className="grid grid-cols-7 items-end gap-1.5 rounded-2xl border border-border p-3">
            {rel.diasSemana.map((d) => (
              <div key={d.dia} className="flex flex-col items-center gap-1" aria-label={`${DIAS_SEMANA[d.dia]}: ${d.vezes}`}>
                <span className="text-xs font-bold tabular-nums">{d.vezes || ""}</span>
                <div className="flex h-16 w-full items-end"><div className={`w-full rounded-md ${d.vezes ? "bg-destructive/70" : "bg-border"}`} style={{ height: `${Math.max(6, (d.vezes / maxDia) * 100)}%` }} /></div>
                <span className="text-[11px] text-muted-foreground">{DIAS_SEMANA[d.dia]!.slice(0, 3)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">O dia em que a contagem achou a falta. O produto sumiu entre essa contagem e a anterior (veja em cada produto).</p>
        </section>
      )}

      {rel.pessoas.length > 0 && (
        <section aria-label="Equipe" className="space-y-2">
          <h2 className="flex items-center gap-2 text-base font-bold"><Users size={18} className="text-primary" /> Equipe</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {rel.pessoas.map((p) => (
              <li key={p.nome} className="p-3 text-sm">
                <p className="font-bold">{p.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {p.contagensComFalta > 0 && `Contou ${p.contagensComFalta === 1 ? "1 falta" : `${p.contagensComFalta} faltas`} (${brl(p.valorFaltas)})`}
                  {p.contagensComFalta > 0 && p.perdas > 0 && " · "}
                  {p.perdas > 0 && `Registrou ${p.perdas === 1 ? "1 perda" : `${p.perdas} perdas`} (${brl(p.valorPerdas)})`}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Quem conta é quem encontra a falta: não quer dizer que foi essa pessoa. Fique de olho em quem registra perdas demais.</p>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Os valores são pelo preço de compra. {t("O depósito é conferido todo dia pela equipe")}; a {nomeVenda(tipo).toLowerCase()} só mostra falta quando o caixa está ligado ao Omni (aba Vendas).
      </p>
    </div>
  );
}
