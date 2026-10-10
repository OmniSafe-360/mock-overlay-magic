/* Aba Vendas do comércio (Fase 3.2): os caixas do mercado ligados ao Omni e as vendas do dia.
 * Regra do dono: cada venda FINALIZADA no caixa desconta da gôndola na hora (bipar não desconta). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Check, Copy, MonitorSmartphone, Pencil, Plus, Receipt, RefreshCw } from "lucide-react";
import { Sheet, type Product } from "@/components/ProductArea";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import { mensagemErro } from "@/lib/persistencia";
import { nomeVenda } from "@/lib/situacao";
import {
  brl, codigoCaixaTexto, diaDaVenda, formaPagamento, horaVenda, proximoNomeCaixa, resumoVendas, situacaoCaixa, textoCaixa, textoItemVenda,
  validadeCodigoCaixa, type Caixa, type Venda,
} from "@/lib/vendas";

export type ApiVendas = {
  caixas: (comercioId: string) => Promise<Caixa[]>;
  vendas: (comercioId: string, desde: string) => Promise<Venda[]>;
  criar: (comercioId: string, nome: string) => Promise<{ id: string; codigo: string }>;
  renomear: (id: string, nome: string) => Promise<unknown>;
  novoCodigo: (id: string) => Promise<string>;
  desligar: (id: string) => Promise<unknown>;
};
const API_PADRAO: ApiVendas = {
  caixas: banco.carregarCaixas, vendas: banco.carregarVendas, criar: banco.criarCaixa, renomear: banco.renomearCaixa,
  novoCodigo: banco.novoCodigoCaixa, desligar: banco.desligarCaixa,
};
const erroTexto = (e: unknown) => mensagemErro(e).replace("Seus dados continuam no formulário. ", "");
const COR = {
  ok: { bolinha: "bg-accent", texto: "text-accent" },
  atencao: { bolinha: "bg-warning", texto: "text-warning" },
  urgente: { bolinha: "bg-destructive", texto: "text-destructive" },
  info: { bolinha: "bg-muted-foreground", texto: "text-muted-foreground" },
} as const;
const diaSP = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
/** Endereço do Omni Conector, que fica aberto no computador do caixa. */
export const enderecoConector = () => `${typeof window !== "undefined" ? window.location.origin : ""}/conector`;

export function PainelVendas({ comercioId, tipo, products, api = API_PADRAO }: {
  comercioId: string; tipo: string; products: Product[]; api?: ApiVendas | undefined;
}) {
  const [caixas, setCaixas] = useState<Caixa[] | null>(null);
  const [vendas, setVendas] = useState<Venda[] | null>(null);
  const [erro, setErro] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const [dia, setDia] = useState<"hoje" | "ontem">("hoje");
  const [novo, setNovo] = useState(false);
  const [caixaAberto, setCaixaAberto] = useState<string | null>(null);
  const [vendaAberta, setVendaAberta] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setAtualizando(true);
    const t = Date.now();
    // Desde o começo de ontem (São Paulo): cobre "Hoje" e "Ontem".
    const desde = new Date(`${diaSP(t - 86_400_000)}T00:00:00-03:00`).toISOString();
    try {
      const [cs, vs] = await Promise.all([api.caixas(comercioId), api.vendas(comercioId, desde)]);
      setCaixas(cs); setVendas(vs); setErro(false); setAgora(Date.now());
    } catch { setErro(true); }
    setAtualizando(false);
  }, [api, comercioId]);
  useEffect(() => { void recarregar(); }, [recarregar]);
  // Com a aba aberta, atualiza sozinha a cada minuto (vendas novas e a bolinha de cada caixa).
  useEffect(() => { const t = setInterval(() => { void recarregar(); }, 60_000); return () => clearInterval(t); }, [recarregar]);

  const diaSel = diaSP(dia === "hoje" ? agora : agora - 86_400_000);
  const resumo = useMemo(() => resumoVendas(vendas ?? [], diaSel), [vendas, diaSel]);
  const doDia = (vendas ?? []).filter((v) => diaDaVenda(v) === diaSel);
  const nomeCaixa = (id: string) => caixas?.find((c) => c.id === id)?.nome ?? "Caixa";
  const area = nomeVenda(tipo).toLowerCase();
  const caixaSel = caixas?.find((c) => c.id === caixaAberto);
  const vendaSel = vendas?.find((v) => v.id === vendaAberta);
  const ativos = (caixas ?? []).filter((c) => !c.desligadoEm);
  const desligados = (caixas ?? []).filter((c) => c.desligadoEm);

  if (caixas === null && !erro) return <p className="py-10 text-center text-sm text-muted-foreground">Carregando as vendas…</p>;
  if (caixas === null) {
    return (
      <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm">
        Não foi possível carregar as vendas. <button type="button" onClick={() => void recarregar()} className="font-semibold text-primary underline">Tentar de novo</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* resumo do dia */}
      <section aria-label="Vendas do dia" className="rounded-3xl border border-border bg-secondary/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2" role="group" aria-label="Dia">
            {(["hoje", "ontem"] as const).map((d) => (
              <button key={d} type="button" aria-pressed={dia === d} onClick={() => setDia(d)}
                className={`min-h-11 rounded-2xl px-4 text-sm font-semibold transition ${dia === d ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
                {d === "hoje" ? "Hoje" : "Ontem"}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void recarregar()} disabled={atualizando} aria-label="Atualizar"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border text-muted-foreground disabled:opacity-50">
            <RefreshCw size={18} className={atualizando ? "animate-spin" : ""} />
          </button>
        </div>
        <p className="mt-3 text-3xl font-bold tracking-tight">{brl(resumo.total)}</p>
        <p className="text-sm text-muted-foreground">
          {resumo.n === 0 ? "Nenhuma venda" : resumo.n === 1 ? "1 venda" : `${resumo.n} vendas`}
          {resumo.canceladas > 0 && ` · ${resumo.canceladas === 1 ? "1 cancelada" : `${resumo.canceladas} canceladas`}`}
        </p>
        {resumo.porCaixa.length > 1 && (
          <ul className="mt-3 space-y-1 text-sm">
            {resumo.porCaixa.map((c) => (
              <li key={c.caixaId} className="flex justify-between gap-2"><span className="text-muted-foreground">{nomeCaixa(c.caixaId)} · {c.n} {c.n === 1 ? "venda" : "vendas"}</span><b>{brl(c.total)}</b></li>
            ))}
          </ul>
        )}
        {resumo.pendentes > 0 && (
          <p className="mt-3 rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <b>{resumo.pendentes === 1 ? "1 item vendido" : `${resumo.pendentes} itens vendidos`} sem cadastro no Omni.</b> {resumo.pendentes === 1 ? "Ainda não saiu" : "Ainda não saíram"} do estoque. Toque na venda para ver qual é.
          </p>
        )}
        {resumo.faltou > 0 && (
          <p className="mt-3 rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">
            <b>{resumo.faltou === 1 ? "1 produto vendido" : `${resumo.faltou} produtos vendidos`} além do que o sistema tinha na {area}.</b> Alguém repôs sem usar o app, ou a contagem estava errada.
          </p>
        )}
        {erro && <p role="alert" className="mt-3 text-sm text-warning">Não foi possível atualizar agora. Os números são da última consulta.</p>}
      </section>

      {/* caixas */}
      <section aria-label="Caixas" className="space-y-3">
        <div>
          <h2 className="text-base font-bold">Caixas</h2>
          <p className="text-xs text-muted-foreground">A {area} só desconta quando a venda é finalizada no caixa.</p>
        </div>
        {!caixas.length && (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-4 py-7 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/60 text-primary"><MonitorSmartphone size={26} /></span>
            <p className="text-base font-bold">Ligue os caixas do comércio</p>
            <p className="text-sm text-muted-foreground">
              Cada venda finalizada no caixa chega ao Omni e sai da {area} na hora. Ligue um caixa de cada vez: o Omni mostra um código para digitar no computador do caixa.
            </p>
          </div>
        )}
        {ativos.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {ativos.map((c) => <CartaoCaixa key={c.id} c={c} agora={agora} hoje={resumoVendas(vendas ?? [], diaSP(agora)).porCaixa.find((x) => x.caixaId === c.id)} onClick={() => setCaixaAberto(c.id)} />)}
          </ul>
        )}
        <button type="button" onClick={() => setNovo(true)} className={`flex w-full items-center justify-center gap-2 ${caixas.length ? btnGhost : btnPrimary(true)}`}>
          <Plus size={20} /> Ligar {caixas.length ? "outro caixa" : "um caixa"}
        </button>
        {desligados.length > 0 && (
          <details className="rounded-2xl border border-border p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-muted-foreground">{desligados.length === 1 ? "1 caixa desligado" : `${desligados.length} caixas desligados`}</summary>
            <ul className="mt-2 space-y-2">
              {desligados.map((c) => <CartaoCaixa key={c.id} c={c} agora={agora} onClick={() => setCaixaAberto(c.id)} />)}
            </ul>
          </details>
        )}
      </section>

      {/* vendas */}
      <section aria-label="Lista de vendas" className="space-y-3">
        <h2 className="text-base font-bold">{dia === "hoje" ? "Vendas de hoje" : "Vendas de ontem"}</h2>
        {!doDia.length && <p className="rounded-2xl border border-border p-4 text-center text-sm text-muted-foreground">{caixas.length ? "Nenhuma venda chegou neste dia." : "As vendas aparecem aqui assim que um caixa for ligado."}</p>}
        <ul className="space-y-2">
          {doDia.map((v) => {
            const pend = v.itens.filter((i) => i.situacao === "sem_cadastro" || i.situacao === "conferir").length;
            const falta = v.itens.some((i) => i.qtdFaltou > 0);
            return (
              <li key={v.id}>
                <button type="button" onClick={() => setVendaAberta(v.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border border-border bg-secondary/50 p-3 text-left transition hover:border-primary ${v.situacao === "cancelada" ? "opacity-60" : ""}`}>
                  <span className="w-12 shrink-0 text-sm font-bold">{horaVenda(v)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{nomeCaixa(v.caixaId)}{v.numero ? ` · Nota ${v.numero}` : ""}</span>
                    <span className="block text-xs text-muted-foreground">
                      {v.situacao === "cancelada" ? "Cancelada" : `${v.itens.length} ${v.itens.length === 1 ? "item" : "itens"}`}
                      {pend > 0 && <span className="font-semibold text-destructive"> · {pend} sem cadastro</span>}
                      {falta && pend === 0 && <span className="font-semibold text-warning"> · faltou na {area}</span>}
                    </span>
                  </span>
                  <span className={`shrink-0 text-sm font-bold ${v.situacao === "cancelada" ? "line-through" : ""}`}>{brl(v.total)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {novo && (
        <NovoCaixa sugestao={proximoNomeCaixa(caixas)} onClose={() => setNovo(false)}
          onCriar={async (nome) => { const r = await api.criar(comercioId, nome); await recarregar(); setNovo(false); setCaixaAberto(r.id); }} />
      )}
      {caixaSel && <DetalheCaixa c={caixaSel} agora={agora} api={api} onMudou={recarregar} onClose={() => setCaixaAberto(null)} />}
      {vendaSel && <DetalheVenda v={vendaSel} caixa={nomeCaixa(vendaSel.caixaId)} products={products} area={area} onClose={() => setVendaAberta(null)} />}
    </div>
  );
}

function CartaoCaixa({ c, agora, hoje, onClick }: { c: Caixa; agora: number; hoje?: { n: number; total: number } | undefined; onClick: () => void }) {
  const t = textoCaixa(c, agora);
  return (
    <li>
      <button type="button" onClick={onClick} aria-label={`${c.nome}: ${t.titulo}`}
        className="flex w-full items-center gap-3 rounded-3xl border border-border bg-secondary/60 p-4 text-left transition hover:border-primary">
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <MonitorSmartphone size={22} />
          <span aria-hidden className={`absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${COR[t.nivel].bolinha}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold">{c.nome}</span>
          <span className={`block text-sm font-semibold ${COR[t.nivel].texto}`}>{t.titulo}</span>
          <span className="block text-xs text-muted-foreground">{t.detalhe}</span>
        </span>
        {hoje && <span className="shrink-0 text-right text-xs text-muted-foreground"><b className="block text-sm text-foreground">{brl(hoje.total)}</b>hoje</span>}
      </button>
    </li>
  );
}

function NovoCaixa({ sugestao, onCriar, onClose }: { sugestao: string; onCriar: (nome: string) => Promise<unknown>; onClose: () => void }) {
  const [nome, setNome] = useState(sugestao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const ok = nome.trim().length >= 1 && !salvando;
  return (
    <Sheet title="Ligar um caixa" onClose={onClose}>
      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nome do caixa</span>
          <input value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Caixa 1"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
          <span className="block text-xs text-muted-foreground">Use o mesmo nome ou número que está no caixa, para não confundir.</span>
        </label>
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
      </div>
      <div className="px-5 pt-2">
        <button type="button" disabled={!ok} className={btnPrimary(ok)}
          onClick={() => { setSalvando(true); setErro(""); onCriar(nome.trim()).catch((e) => { setErro(erroTexto(e)); setSalvando(false); }); }}>
          {salvando ? "Gerando o código…" : "Gerar o código"}
        </button>
      </div>
    </Sheet>
  );
}

/** Código e passo a passo para ligar o computador do caixa. */
function CodigoLigar({ c, agora }: { c: Caixa; agora: number }) {
  const [copiado, setCopiado] = useState(false);
  const end = enderecoConector();
  const instrucoes = `Ligar o ${c.nome} ao Omni:\n1. No computador do caixa, abra o Chrome e entre em ${end}\n2. Digite o código ${codigoCaixaTexto(c.codigo)}\n3. Escolha a pasta onde o sistema do caixa guarda as notas`;
  return (
    <div className="space-y-3 rounded-3xl border border-primary/50 bg-primary/10 p-4">
      <p className="text-sm font-semibold">Código para ligar</p>
      <p className="text-center text-4xl font-bold tracking-[0.2em]" aria-label={`Código ${codigoCaixaTexto(c.codigo)}`}>{codigoCaixaTexto(c.codigo)}</p>
      <p className="text-center text-xs text-muted-foreground">Vale até {validadeCodigoCaixa(c, agora)} e só uma vez.</p>
      <ol className="space-y-2 text-sm">
        <li className="flex gap-2"><b className="text-primary">1.</b><span>No <b>computador do caixa</b>, abra o Chrome e entre em <b className="break-all">{end}</b></span></li>
        <li className="flex gap-2"><b className="text-primary">2.</b><span>Digite o código acima.</span></li>
        <li className="flex gap-2"><b className="text-primary">3.</b><span>Escolha a <b>pasta onde o sistema do caixa guarda as notas</b>. O técnico do caixa sabe qual é.</span></li>
        <li className="flex gap-2"><b className="text-primary">4.</b><span>Pronto: aparece "{c.nome} ligado" e a bolinha fica verde aqui.</span></li>
      </ol>
      <button type="button" className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}
        onClick={() => { void navigator.clipboard?.writeText(instrucoes).then(() => setCopiado(true)).catch(() => setCopiado(false)); }}>
        {copiado ? <><Check size={18} /> Copiado!</> : <><Copy size={18} /> Copiar as instruções</>}
      </button>
    </div>
  );
}

function DetalheCaixa({ c, agora, api, onMudou, onClose }: { c: Caixa; agora: number; api: ApiVendas; onMudou: () => Promise<unknown>; onClose: () => void }) {
  const [renomear, setRenomear] = useState(false);
  const [nome, setNome] = useState(c.nome);
  const [confirmar, setConfirmar] = useState<"desligar" | "codigo" | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const s = situacaoCaixa(c, agora);
  const t = textoCaixa(c, agora);
  const fazer = (f: () => Promise<unknown>, depois?: () => void) => {
    setOcupado(true); setErro("");
    f().then(() => onMudou()).then(() => { setConfirmar(null); setRenomear(false); depois?.(); })
      .catch((e) => setErro(erroTexto(e))).finally(() => setOcupado(false));
  };
  const gerar = () => fazer(() => api.novoCodigo(c.id));
  return (
    <Sheet title={c.nome} onClose={onClose}>
      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-3">
        <p className="flex items-center gap-2 text-base font-bold"><span className={`h-3 w-3 rounded-full ${COR[t.nivel].bolinha}`} /> <span className={COR[t.nivel].texto}>{t.titulo}</span></p>
        <p className="text-sm text-muted-foreground">{t.detalhe}</p>
        {c.ligadoEm && c.aparelho && <p className="text-xs text-muted-foreground">Computador: {c.aparelho}</p>}
        {s === "parado" && (
          <p className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">
            Confira se o computador do caixa está ligado, com internet e com a página do Omni aberta. Venda que não chega vira "furto falso" no antifurto.
          </p>
        )}
        {c.codigo && !c.desligadoEm && s !== "codigo_vencido" && <CodigoLigar c={c} agora={agora} />}

        {renomear ? (
          <div className="space-y-2">
            <input value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} aria-label="Novo nome do caixa"
              className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            <button type="button" disabled={!nome.trim() || ocupado} className={btnPrimary(!!nome.trim() && !ocupado)} onClick={() => fazer(() => api.renomear(c.id, nome.trim()))}>Salvar o nome</button>
          </div>
        ) : confirmar === "desligar" ? (
          <div className="space-y-2 rounded-2xl border border-destructive/50 p-3">
            <p className="text-sm">O {c.nome} para de mandar vendas na hora. As vendas que já chegaram continuam guardadas.</p>
            <button type="button" disabled={ocupado} onClick={() => fazer(() => api.desligar(c.id))} className={`w-full ${btnGhost} border-destructive/60 text-destructive`}>Sim, desligar</button>
            <button type="button" onClick={() => setConfirmar(null)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
          </div>
        ) : confirmar === "codigo" ? (
          <div className="space-y-2 rounded-2xl border border-border p-3">
            <p className="text-sm">Use quando trocar o computador do caixa. O computador atual continua mandando vendas até o código novo ser usado.</p>
            <button type="button" disabled={ocupado} onClick={gerar} className={btnPrimary(!ocupado)}>Gerar código novo</button>
            <button type="button" onClick={() => setConfirmar(null)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {(s === "codigo_vencido" || s === "desligado") && (
              <button type="button" disabled={ocupado} onClick={gerar} className={btnPrimary(!ocupado)}>{s === "desligado" ? "Religar (gerar código)" : "Gerar código novo"}</button>
            )}
            {(s === "ligado" || s === "parado") && (
              <button type="button" onClick={() => setConfirmar("codigo")} className={`flex items-center justify-center gap-2 ${btnGhost}`}><MonitorSmartphone size={18} /> Trocou o computador do caixa?</button>
            )}
            <button type="button" onClick={() => setRenomear(true)} className={`flex items-center justify-center gap-2 ${btnGhost}`}><Pencil size={18} /> Mudar o nome</button>
            {!c.desligadoEm && (
              <button type="button" onClick={() => setConfirmar("desligar")} className="flex min-h-12 items-center justify-center gap-2 text-sm font-semibold text-destructive"><Ban size={16} /> Desligar este caixa</button>
            )}
          </div>
        )}
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
      </div>
    </Sheet>
  );
}

function DetalheVenda({ v, caixa, products, area, onClose }: { v: Venda; caixa: string; products: Product[]; area: string; onClose: () => void }) {
  const prod = (id: string | null) => (id ? products.find((p) => (p.db?.id ?? p.id) === id) : undefined);
  return (
    <Sheet title={`${caixa} · ${horaVenda(v)}`} onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-2xl font-bold ${v.situacao === "cancelada" ? "line-through opacity-60" : ""}`}>{brl(v.total)}</p>
          <p className="text-sm text-muted-foreground">{v.numero ? `Nota ${v.numero}` : ""}</p>
        </div>
        {v.situacao === "cancelada" && <p className="rounded-2xl border border-border p-3 text-sm">Venda cancelada no caixa. O que tinha saído voltou para a {area}.</p>}
        {v.pagamentos.length > 0 && (
          <p className="text-sm text-muted-foreground">{v.pagamentos.map((p) => `${formaPagamento(p.forma)} ${brl(p.valor)}`).join(" · ")}</p>
        )}
        <ul className="space-y-2">
          {v.itens.map((i) => {
            const p = prod(i.produtoId);
            const t = textoItemVenda(i, p?.unidade, area);
            return (
              <li key={i.id} className="rounded-2xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{p?.nome ?? i.descricao}</span>
                    {p && p.nome.toLowerCase() !== i.descricao.toLowerCase() && <span className="block text-xs text-muted-foreground">No caixa: {i.descricao}</span>}
                    <span className="block text-xs text-muted-foreground">{String(i.qtdNota).replace(".", ",")} {i.unidadeNota ?? ""} · código {i.codigoBarras ?? i.codigoPdv}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{brl(i.valor)}</span>
                </div>
                <p className={`mt-1 text-xs font-semibold ${COR[t.nivel].texto}`}>{t.texto}</p>
              </li>
            );
          })}
        </ul>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Receipt size={14} /> Chegou do caixa depois de finalizada. Bipar sem finalizar não desconta.</p>
      </div>
    </Sheet>
  );
}
