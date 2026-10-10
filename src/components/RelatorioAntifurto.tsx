/* Relatório antifurto do comércio (Fase 5.1), dentro da aba Diferenças: o que falta, onde, quando e quem contou. */
import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarDays, ChevronDown, MapPin, Package, ShieldAlert, Users } from "lucide-react";
import type { Product } from "@/components/ProductArea";
import * as banco from "@/lib/banco";
import { DIAS_SEMANA, PERIODOS, PRODUTOS_LUGAR, VEZES_VISADO, alertasAntifurto, infoDosProdutos, intervaloFalta, limitesPeriodo, nomeAreaDoTipo, relatorioAntifurto, type Contagem, type Periodo } from "@/lib/antifurto";
import { qtdUn } from "@/lib/deposito";
import { MOTIVO_PERDA_TXT, motivoDiferencaTxt, type Diferenca, type Perda } from "@/lib/diferencas";
import { textoDoTipo } from "@/lib/exemplos";
import { nomeVenda } from "@/lib/situacao";
import { hojeEm } from "@/lib/validade";
import { brl } from "@/lib/vendas";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";
import { mensagemErro } from "@/lib/persistencia";

export type ApiRelatorio = {
  carregar: typeof banco.carregarDiferencas; contagens: typeof banco.carregarContagensAntifurto;
  limite: typeof banco.carregarLimiteFaltas; definirLimite: typeof banco.definirLimiteFaltas;
};
const API_PADRAO: ApiRelatorio = {
  carregar: banco.carregarDiferencas, contagens: banco.carregarContagensAntifurto, limite: banco.carregarLimiteFaltas, definirLimite: banco.definirLimiteFaltas,
};

export function RelatorioAntifurto({ comercioId, tipo, products, api = API_PADRAO, onMudou }: {
  comercioId: string; tipo: string; products: Product[]; api?: ApiRelatorio | undefined; /** O limite mudou (o resumo geral recalcula). */ onMudou?: (() => void) | undefined;
}) {
  const hoje = useMemo(() => hojeEm(), []);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [dados, setDados] = useState<{ diferencas: Diferenca[]; perdas: Perda[]; contagens: Contagem[]; limite: number } | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    // Carrega 3 meses de uma vez; as contagens vêm de 30 dias antes, para achar o começo do intervalo da primeira falta.
    const de = limitesPeriodo("tres", hoje).de;
    const desde = new Date(`${de}T00:00:00-03:00`).toISOString();
    const antes = new Date(Date.parse(desde) - 30 * 86_400_000).toISOString();
    Promise.all([api.carregar(comercioId, desde), api.contagens(comercioId, antes), api.limite(comercioId)])
      .then(([d, c, limite]) => { if (vivo) { setDados({ ...d, contagens: c, limite }); setErro(false); } })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [api, comercioId, hoje]);

  const prod = (id: string) => products.find((p) => (p.db?.id ?? String(p.id)) === id);
  const t = textoDoTipo(tipo);
  const info = useMemo(() => infoDosProdutos(products), [products]);
  const rel = useMemo(() => dados && relatorioAntifurto(dados.diferencas, dados.perdas, dados.contagens, periodo, hoje, info, nomeAreaDoTipo(tipo)), [dados, periodo, hoje, info, tipo]);
  const alertas = useMemo(() => dados && alertasAntifurto(dados.diferencas, hoje, Date.now(), info, nomeAreaDoTipo(tipo), dados.limite), [dados, hoje, info, tipo]);

  if (erro && !dados) return <p role="alert" className="rounded-2xl border border-warning/50 p-4 text-sm text-warning">Não foi possível carregar o relatório agora. Tente de novo em instantes.</p>;
  if (!rel || !alertas || !dados) return <p className="py-10 text-center text-muted-foreground">Carregando…</p>;
  const visados = new Set(alertas.visados.map((v) => v.chave));
  const unidade = (id: string) => prod(id)?.unidade ?? "Unidade";
  const maxDia = Math.max(1, ...rel.diasSemana.map((d) => d.vezes));
  const maxMotivo = Math.max(1, ...rel.porMotivo.map((m) => m.valor));

  return (
    <div className="space-y-5">
      <section aria-label="Alertas de antifurto" className={`space-y-3 rounded-3xl border p-4 ${alertas.visados.length || alertas.lugares.length || alertas.passouLimite ? "border-warning/50 bg-warning/5" : "border-border"}`}>
        <h2 className="flex items-center gap-2 text-base font-bold"><BellRing size={18} className="text-warning" /> Alertas dos últimos 30 dias</h2>
        {!alertas.visados.length && !alertas.lugares.length && !alertas.passouLimite && <p className="text-sm text-muted-foreground">Nenhum alerta. O Omni avisa quando um produto faltar {VEZES_VISADO} vezes, quando {PRODUTOS_LUGAR} produtos faltarem no mesmo lugar ou quando o mês passar do limite.</p>}
        <ul className="space-y-2 text-sm">
          {alertas.passouLimite && (
            <li className="rounded-2xl border border-warning/50 bg-background/40 p-3">
              <p className="font-bold">Faltou {brl(alertas.faltouMes)} este mês</p>
              <p className="text-xs text-muted-foreground">Passou do limite de {brl(alertas.limite)}.</p>
            </li>
          )}
          {alertas.visados.map((v) => (
            <li key={v.chave} className="rounded-2xl border border-warning/50 bg-background/40 p-3">
              <p className="font-bold">Produto visado: {v.titulo}</p>
              <p className="text-xs text-muted-foreground">Faltou {v.vezes} vezes ({brl(v.valor)}). {t("A equipe passa a conferir no depósito todo dia")}, sem saber o motivo, até passar 7 dias sem faltar.</p>
            </li>
          ))}
          {alertas.lugares.map((l) => (
            <li key={l.chave} className="rounded-2xl border border-warning/50 bg-background/40 p-3">
              <p className="font-bold">Lugar com muitas faltas: {l.titulo}</p>
              <p className="text-xs text-muted-foreground">{l.sub} · {l.produtos} produtos diferentes faltaram ({brl(l.valor)}). Vale olhar a câmera e quem passa por ali.</p>
            </li>
          ))}
        </ul>
        <Limite limite={dados.limite} onSalvar={async (c) => { await api.definirLimite(comercioId, c); setDados((d) => (d ? { ...d, limite: c } : d)); onMudou?.(); }} />
      </section>

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
                      <span className="block break-words text-sm font-bold">{p.titulo}{visados.has(p.chave) && <span className="ml-2 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning">Visado</span>}</span>
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

/** "Avisar quando faltar mais de R$ 200,00 no mês · Mudar". */
function Limite({ limite, onSalvar }: { limite: number; onSalvar: (centavos: number) => Promise<void> }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(limite));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const centavos = Number(valor.replace(/\D/g, "").slice(0, 10) || 0);
  if (!editando)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Avisar quando faltar mais de <b className="text-foreground">{brl(limite)}</b> no mês</span>
        <button type="button" onClick={() => { setValor(String(limite)); setEditando(true); }} className="min-h-11 px-2 font-semibold text-primary">Mudar</button>
      </div>
    );
  const salvar = () => { setSalvando(true); setErro(""); onSalvar(centavos).then(() => { setEditando(false); setSalvando(false); }, (e) => { setErro(mensagemErro(e).replace("Seus dados continuam no formulário. ", "")); setSalvando(false); }); };
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Avisar quando faltar mais de (por mês)</span>
        <input inputMode="numeric" value={brl(centavos)} onChange={(e) => setValor(e.target.value)} aria-label="Limite do mês"
          className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-lg font-bold text-foreground outline-none focus-visible:border-primary" />
      </label>
      <p className="text-xs text-muted-foreground">Coloque R$ 0,00 para não receber este aviso.</p>
      {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setEditando(false)} className={btnGhost}>Cancelar</button>
        <button type="button" disabled={salvando} onClick={salvar} className={btnPrimary(!salvando)}>{salvando ? "Salvando…" : "Salvar"}</button>
      </div>
    </div>
  );
}
