import { useHoje } from "@/hooks/useHoje";
import { formatarCentavos as brl } from "@/lib/formatacao";
/* Página que o fornecedor abre pelo link do pedido (D2b): vê o pedido, confirma o que tem, a entrega e o pagamento.
 * Não precisa de cadastro nem de senha. Mostra só este pedido, sem preços de compra nem estoque. */
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarDays, Check, CheckCircle2, MapPin, Minus, Phone, Plus, X, XCircle } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { btnGhost, btnPrimary, digits } from "@/components/StoreSetup";
import { carregarPedidoPublico, responderPedido, type ItemPublico, type PedidoPublico, type RespostaFornecedor } from "@/lib/banco";
import { aceitaFracao, fmtQ } from "@/lib/deposito";
import { mensagemErro } from "@/lib/persistencia";
import { FORMA_TXT, dataEntregaTexto, formaTexto, hojeISO, qtdItemTexto, respostaItem, type FormaPagamento } from "@/lib/pedido";

const dataHora = (ts: string) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const PRAZOS = [7, 14, 21, 28, 30];
const FORMAS: FormaPagamento[] = ["pix", "boleto", "a_vista", "a_prazo"];
type Modo = "tenho" | "outra" | "nao";
type Resp = { modo: Modo; qtd: number };

const enderecoTexto = (c: PedidoPublico["comercio"]) =>
  [c.rua && `${c.rua}${c.numero ? `, ${c.numero}` : ""}`, c.complemento, c.bairro, c.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ""}`].filter(Boolean).join(" – ");
const telTexto = (t: string) => {
  const d = digits(t);
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : t;
};
const nomeItem = (i: ItemPublico) => (i.variacao ? `${i.produto} — ${i.variacao}` : i.produto);
const respostasIniciais = (p: PedidoPublico): Record<string, Resp> =>
  Object.fromEntries(p.itens.map((i) => {
    const r = respostaItem(i.qtdEmbalagens, i.qtdConfirmada);
    return [i.id, r == null || (r === "tudo" && i.qtdConfirmada === i.qtdEmbalagens) ? { modo: "tenho", qtd: i.qtdEmbalagens } : r === "nada" ? { modo: "nao", qtd: 0 } : { modo: "outra", qtd: i.qtdConfirmada ?? i.qtdEmbalagens }];
  }));

export function PaginaFornecedor({ token, carregar = carregarPedidoPublico, responder = responderPedido }: {
  token: string; carregar?: (t: string) => Promise<PedidoPublico | null>; responder?: (t: string, r: RespostaFornecedor) => Promise<unknown>;
}) {
  const [estado, setEstado] = useState<{ t: "carregando" } | { t: "invalido" } | { t: "erro" } | { t: "ok"; p: PedidoPublico }>({ t: "carregando" });
  const [editando, setEditando] = useState(false);
  const [feito, setFeito] = useState(false);
  const abrir = () => {
    setEstado({ t: "carregando" });
    carregar(token).then((p) => { setEstado(p ? { t: "ok", p } : { t: "invalido" }); if (p) setEditando(!p.resposta && p.podeResponder); })
      .catch(() => setEstado({ t: "erro" }));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(abrir, [token]);

  return (
    <div className="min-h-dvh bg-app text-foreground">
      <main className="mx-auto max-w-[560px] space-y-4 px-4 pb-10 pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><LogoMark size={28} /> Omni Safe 360</div>
        {estado.t === "carregando" && <p className="py-16 text-center text-base text-muted-foreground">Abrindo o pedido…</p>}
        {estado.t === "invalido" && (
          <Aviso icone={<AlertTriangle size={30} />} titulo="Este link não vale mais"
            texto="O pedido não foi encontrado. Pode ser que o link tenha sido trocado. Peça um link novo para quem fez o pedido." />
        )}
        {estado.t === "erro" && (
          <div className="space-y-3">
            <Aviso icone={<AlertTriangle size={30} />} titulo="Não conseguimos abrir o pedido" texto="Confira a internet e tente de novo." />
            <button type="button" onClick={abrir} className={btnPrimary(true)}>Tentar de novo</button>
          </div>
        )}
        {estado.t === "ok" && (
          <>
            <Cabecalho p={estado.p} />
            {editando ? (
              <Formulario p={estado.p} onCancelar={estado.p.resposta ? () => setEditando(false) : undefined}
                onEnviar={async (r) => {
                  await responder(token, r);
                  const novo = await carregar(token).catch(() => null);
                  if (novo) setEstado({ t: "ok", p: novo });
                  setEditando(false); setFeito(true); window.scrollTo?.({ top: 0 });
                }} />
            ) : (
              <Resumo p={estado.p} feito={feito} onAlterar={() => { setFeito(false); setEditando(true); }} />
            )}
          </>
        )}
        <p className="pt-2 text-center text-xs text-muted-foreground">Esta página mostra só este pedido. Não precisa de cadastro nem de senha.</p>
      </main>
    </div>
  );
}

function Aviso({ icone, titulo, texto }: { icone: ReactNode; titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-secondary/60 px-5 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/15 text-warning">{icone}</span>
      <h1 className="text-lg font-bold">{titulo}</h1>
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

function Cabecalho({ p }: { p: PedidoPublico }) {
  const end = enderecoTexto(p.comercio);
  return (
    <header className="rounded-3xl border border-border bg-secondary/60 p-4">
      <p className="text-sm text-muted-foreground">Pedido de compra</p>
      <h1 className="break-words text-2xl font-bold leading-tight">{p.comercio.nome}</h1>
      <p className="mt-1 text-base font-semibold">Pedido nº {p.numero}{p.fornecedor ? <span className="font-normal text-muted-foreground"> · para {p.fornecedor}</span> : null}</p>
      {p.enviadoEm && <p className="text-sm text-muted-foreground">Enviado em {dataHora(p.enviadoEm)}</p>}
      {end && <p className="mt-3 flex items-start gap-2 text-sm"><MapPin size={17} className="mt-0.5 shrink-0 text-primary" /><span><span className="block text-xs text-muted-foreground">Entregar em</span>{end}</span></p>}
      {p.comercio.telefone && (
        <a href={`tel:${digits(p.comercio.telefone)}`} className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"><Phone size={17} /> {telTexto(p.comercio.telefone)}</a>
      )}
      {p.observacao && <p className="mt-2 rounded-2xl bg-background-deep/50 p-3 text-sm"><span className="block text-xs text-muted-foreground">Recado do comércio</span>{p.observacao}</p>}
    </header>
  );
}

/* ---------- já respondido / fechado ---------- */
function Resumo({ p, feito, onAlterar }: { p: PedidoPublico; feito: boolean; onAlterar: () => void }) {
  const r = p.resposta;
  const recusado = p.situacao === "recusado";
  return (
    <div className="space-y-4">
      {feito && (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-accent/50 bg-accent/10 p-3 text-sm font-semibold text-accent">
          <CheckCircle2 size={20} className="shrink-0" /> Pronto! {p.comercio.nome} já recebeu sua resposta.
        </p>
      )}
      {p.situacao === "cancelado" && <p className="rounded-2xl border border-border bg-secondary/60 p-3 text-sm">Este pedido foi <b>cancelado</b> por {p.comercio.nome}. Não precisa mandar nada.</p>}
      {(p.situacao === "recebido" || p.situacao === "recebido_parcial") && <p className="rounded-2xl border border-border bg-secondary/60 p-3 text-sm">Este pedido já foi <b>recebido</b>. Obrigado!</p>}

      {r && (
        <section aria-label="Sua resposta" className={`rounded-3xl border p-4 ${recusado ? "border-destructive/50 bg-destructive/10" : "border-accent/50 bg-accent/10"}`}>
          <p className={`flex items-center gap-2 text-base font-bold ${recusado ? "text-destructive" : "text-accent"}`}>
            {recusado ? <XCircle size={20} /> : <CheckCircle2 size={20} />} {recusado ? "Você avisou que não pode atender" : "Você confirmou o pedido"}
          </p>
          <p className="text-xs text-muted-foreground">Em {dataHora(r.em)}</p>
          {!recusado && (
            <dl className="mt-3 space-y-1.5 text-sm">
              {r.previsaoEntrega && <Linha t="Entrega prevista" v={dataEntregaTexto(r.previsaoEntrega)} />}
              <Linha t="Valor total" v={r.valorTotal != null ? brl(r.valorTotal) : "Não informado"} />
              <Linha t="Pagamento" v={formaTexto(r.forma, r.prazoDias) || "Não informado"} />
            </dl>
          )}
          {r.recado && <p className="mt-2 text-sm"><span className="block text-xs text-muted-foreground">Seu recado</span>{r.recado}</p>}
        </section>
      )}

      <section aria-label="Produtos" className="rounded-3xl border border-border bg-secondary/60 p-4">
        <h2 className="text-base font-bold">Produtos ({p.itens.length})</h2>
        <ul className="mt-1 divide-y divide-border">
          {p.itens.map((i) => {
            const s = recusado ? null : respostaItem(i.qtdEmbalagens, i.qtdConfirmada);
            return (
              <li key={i.id} className="py-2.5">
                <p className="break-words text-sm font-semibold">{nomeItem(i)}</p>
                <p className="text-xs text-muted-foreground">Pedido: {qtdItemTexto(i, i.qtdEmbalagens)}</p>
                {s === "tudo" && <p className="text-xs font-semibold text-accent">Vai mandar {qtdItemTexto(i, i.qtdConfirmada!)}</p>}
                {s === "parte" && <p className="text-xs font-semibold text-warning">Vai mandar {qtdItemTexto(i, i.qtdConfirmada!)}</p>}
                {s === "nada" && <p className="text-xs font-semibold text-destructive">Não tem</p>}
              </li>
            );
          })}
        </ul>
      </section>

      {p.podeResponder && r && (
        <button type="button" onClick={onAlterar} className={`w-full ${btnGhost}`}>Alterar a resposta</button>
      )}
      {p.podeResponder && !r && (
        <button type="button" onClick={onAlterar} className={btnPrimary(true)}>Responder o pedido</button>
      )}
    </div>
  );
}

function Linha({ t, v }: { t: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t}</dt><dd className="text-right font-semibold">{v}</dd></div>;
}

/* ---------- responder ---------- */
function Formulario({ p, onEnviar, onCancelar }: { p: PedidoPublico; onEnviar: (r: RespostaFornecedor) => Promise<void>; onCancelar?: (() => void) | undefined }) {
  const r0 = p.resposta;
  const [itens, setItens] = useState<Record<string, Resp>>(() => respostasIniciais(p));
  const [previsao, setPrevisao] = useState(r0?.previsaoEntrega ?? "");
  const [valor, setValor] = useState<number | null>(r0?.valorTotal ?? null);
  const [forma, setForma] = useState<FormaPagamento | null>(r0?.forma ?? null);
  const [prazo, setPrazo] = useState(r0?.prazoDias != null ? String(r0.prazoDias) : "");
  const [recado, setRecado] = useState(r0?.recado ?? "");
  const [recusar, setRecusar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const hoje = useHoje();
  const atalhos: [string, string][] = [0, 1, 2].map((n) => { const d = new Date(); d.setDate(d.getDate() + n); return [["Hoje", "Amanhã", "Depois de amanhã"][n]!, hojeISO(d)]; });
  const qtdDe = (i: ItemPublico) => { const x = itens[i.id]!; return x.modo === "tenho" ? i.qtdEmbalagens : x.modo === "nao" ? 0 : x.qtd; };
  const algum = p.itens.some((i) => qtdDe(i) > 0);
  const comPrazo = forma === "boleto" || forma === "a_prazo";
  const faltando = !previsao ? "Informe a data prevista de entrega." : !algum ? "Marque pelo menos um produto que você tem." : "";

  const enviar = async (aceito: boolean) => {
    if (enviando) return;
    if (aceito && faltando) { setErro(faltando); return; }
    setEnviando(true); setErro("");
    try {
      await onEnviar({
        aceito, itens: p.itens.map((i) => ({ id: i.id, qtdConfirmada: qtdDe(i) })), previsaoEntrega: aceito ? previsao : null,
        valorTotal: aceito ? valor : null, forma: aceito ? forma : null, prazoDias: aceito && comPrazo && prazo !== "" ? Number(prazo) : null, recado: recado.trim(),
      });
    } catch (e) {
      setErro(mensagemErro(e).replace("Seus dados continuam no formulário. ", ""));
    } finally { setEnviando(false); }
  };

  return (
    <div className="space-y-4">
      <section aria-label="Produtos" className="rounded-3xl border border-border bg-secondary/60 p-4">
        <h2 className="text-lg font-bold">1. Você tem estes produtos?</h2>
        <p className="text-sm text-muted-foreground">Já deixamos marcado "Tenho". Mude só o que for diferente.</p>
        <ul className="mt-3 space-y-3">
          {p.itens.map((i) => (
            <li key={i.id}><ItemResposta i={i} r={itens[i.id]!} onMudar={(r) => setItens((m) => ({ ...m, [i.id]: r }))} /></li>
          ))}
        </ul>
      </section>

      <section aria-label="Entrega e pagamento" className="space-y-4 rounded-3xl border border-border bg-secondary/60 p-4">
        <h2 className="text-lg font-bold">2. Entrega e pagamento</h2>
        <div role="group" aria-label="Quando vai entregar?" className="space-y-1">
          <span className="flex items-center gap-2 text-sm font-medium"><CalendarDays size={17} className="text-primary" /> Quando vai entregar?</span>
          <span className="grid grid-cols-3 gap-1.5">
            {atalhos.map(([t, d]) => (
              <button key={t} type="button" aria-pressed={previsao === d} onClick={() => setPrevisao(d)}
                className={`min-h-11 rounded-xl border px-1 text-sm font-semibold ${previsao === d ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{t}</button>
            ))}
          </span>
          <input type="date" value={previsao} min={hoje} onChange={(e) => setPrevisao(e.target.value)} aria-label="Data prevista de entrega"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none [color-scheme:dark] focus-visible:border-primary" />
          {previsao && <span className="block text-sm text-muted-foreground">{dataEntregaTexto(previsao)}</span>}
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Valor total do pedido <span className="text-muted-foreground">(opcional)</span></span>
          <input inputMode="numeric" value={valor ? brl(valor) : ""} placeholder="R$ 0,00" aria-label="Valor total"
            onChange={(e) => { const c = Number(digits(e.target.value).slice(0, 10) || 0); setValor(c > 0 ? c : null); }}
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary" />
          <span className="block text-xs text-muted-foreground">Some só o que você vai mandar.</span>
        </label>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Forma de pagamento <span className="text-muted-foreground">(opcional)</span></legend>
          <div className="grid grid-cols-2 gap-2">
            {FORMAS.map((f) => (
              <button key={f} type="button" aria-pressed={forma === f} onClick={() => setForma(forma === f ? null : f)}
                className={`min-h-12 rounded-2xl border px-3 text-base font-semibold transition ${forma === f ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
                {FORMA_TXT[f]}
              </button>
            ))}
          </div>
          {comPrazo && (
            <div className="space-y-1 pt-1">
              <span className="text-sm font-medium">Prazo para pagar (dias depois da entrega)</span>
              <div className="flex flex-wrap gap-2">
                {PRAZOS.map((d) => (
                  <button key={d} type="button" aria-pressed={prazo === String(d)} onClick={() => setPrazo(String(d))}
                    className={`min-h-11 min-w-14 rounded-xl border px-3 text-sm font-semibold ${prazo === String(d) ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{d}</button>
                ))}
                <input inputMode="numeric" value={PRAZOS.includes(Number(prazo)) ? "" : prazo} placeholder="Outro" aria-label="Outro prazo em dias"
                  onChange={(e) => setPrazo(digits(e.target.value).slice(0, 3))}
                  className="h-11 w-20 rounded-xl border border-border bg-background-deep/60 px-3 text-sm text-foreground outline-none focus-visible:border-primary" />
              </div>
            </div>
          )}
        </fieldset>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Recado para {p.comercio.nome} <span className="text-muted-foreground">(opcional)</span></span>
          <textarea value={recado} maxLength={500} rows={2} onChange={(e) => setRecado(e.target.value)} placeholder="Ex.: entrego pela manhã"
            className="w-full rounded-2xl border border-border bg-background-deep/60 px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary" />
        </label>
      </section>

      {erro && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro}</p>}
      {!recusar ? (
        <div className="space-y-2.5">
          <button type="button" onClick={() => enviar(true)} disabled={enviando} className={`flex items-center justify-center gap-2 ${btnPrimary(!faltando && !enviando)}`}>
            <Check size={20} /> {enviando ? "Enviando…" : "Confirmar pedido"}
          </button>
          {faltando && !erro && <p className="text-center text-sm text-muted-foreground">{faltando}</p>}
          <button type="button" onClick={() => { setRecusar(true); setErro(""); }} className={`w-full ${btnGhost}`}>Não posso atender este pedido</button>
          {onCancelar && <button type="button" onClick={onCancelar} className="min-h-12 w-full text-sm font-semibold text-muted-foreground">Voltar sem mudar</button>}
        </div>
      ) : (
        <div className="space-y-2.5 rounded-3xl border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-base font-bold">Não vai atender o pedido?</p>
          <p className="text-sm text-muted-foreground">{p.comercio.nome} vai ver que você não pode atender. Se quiser, explique no recado acima.</p>
          <button type="button" onClick={() => enviar(false)} disabled={enviando}
            className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-destructive/60 px-4 text-base font-semibold text-destructive">
            <X size={18} /> {enviando ? "Enviando…" : "Sim, não posso atender"}
          </button>
          <button type="button" onClick={() => setRecusar(false)} className={`w-full ${btnGhost}`}>Voltar</button>
        </div>
      )}
    </div>
  );
}

function ItemResposta({ i, r, onMudar }: { i: ItemPublico; r: Resp; onMudar: (r: Resp) => void }) {
  const passo = i.embalagem ? 1 : aceitaFracao(i.unidade) ? 0.5 : 1;
  const mudarQtd = (q: number) => onMudar({ modo: "outra", qtd: Math.max(0, Math.round(q * 1000) / 1000) });
  const botoes: [Modo, string][] = [["tenho", "Tenho"], ["outra", "Outra qtd."], ["nao", "Não tenho"]];
  return (
    <div className={`rounded-2xl border p-3 ${r.modo === "nao" ? "border-destructive/40 bg-destructive/5" : r.modo === "outra" ? "border-warning/50 bg-warning/5" : "border-border bg-background-deep/50"}`}>
      <p className="break-words text-base font-semibold leading-snug">{nomeItem(i)}</p>
      <p className="text-sm">Pedido: <b>{qtdItemTexto(i, i.qtdEmbalagens)}</b></p>
      {i.codigo && <p className="text-xs text-muted-foreground">Cód. {i.codigo}</p>}
      <div role="group" aria-label={`Resposta para ${nomeItem(i)}`} className="mt-2 grid grid-cols-3 gap-1.5">
        {botoes.map(([m, t]) => (
          <button key={m} type="button" aria-pressed={r.modo === m}
            onClick={() => onMudar(m === "outra" ? { modo: "outra", qtd: r.modo === "outra" ? r.qtd : Math.max(0, i.qtdEmbalagens - passo) } : { modo: m, qtd: m === "nao" ? 0 : i.qtdEmbalagens })}
            className={`min-h-11 rounded-xl border px-1 text-sm font-semibold transition ${
              r.modo === m ? (m === "nao" ? "border-destructive bg-destructive/15 text-destructive" : m === "outra" ? "border-warning bg-warning/15 text-warning" : "border-accent bg-accent/15 text-accent") : "border-border text-muted-foreground"
            }`}>{t}</button>
        ))}
      </div>
      {r.modo === "outra" && (
        <div className="mt-2 flex items-center gap-3">
          <div className="flex shrink-0 items-center rounded-2xl border border-border">
            <button type="button" aria-label="Diminuir" onClick={() => mudarQtd(r.qtd - passo)} className="flex h-11 w-11 items-center justify-center text-primary"><Minus size={18} /></button>
            <input aria-label={`Quantidade de ${nomeItem(i)} que vai mandar`} inputMode={passo < 1 ? "decimal" : "numeric"} value={fmtQ(r.qtd)}
              onChange={(e) => { const n = Number(e.target.value.replace(/\./g, "").replace(",", ".")); if (Number.isFinite(n) && n >= 0) mudarQtd(i.embalagem ? Math.round(n) : n); }}
              className="h-11 w-14 bg-transparent text-center text-base font-bold tabular-nums outline-none" />
            <button type="button" aria-label="Aumentar" onClick={() => mudarQtd(r.qtd + passo)} className="flex h-11 w-11 items-center justify-center text-primary"><Plus size={18} /></button>
          </div>
          <p className="min-w-0 text-sm text-muted-foreground">Vai mandar {qtdItemTexto(i, r.qtd)}</p>
        </div>
      )}
    </div>
  );
}
