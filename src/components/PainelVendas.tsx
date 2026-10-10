/* Aba Vendas do comércio (Fase 3.2): os caixas do mercado ligados ao Omni e as vendas do dia.
 * Regra do dono: cada venda FINALIZADA no caixa desconta da gôndola na hora (bipar não desconta). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Check, Copy, MonitorSmartphone, PackageSearch, Pencil, Plus, Receipt, RefreshCw, Search, Smartphone } from "lucide-react";
import { Sheet } from "@/components/parts/Sheet";
import { type Product } from "@/components/ProductArea";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import { mensagemErro } from "@/lib/persistencia";
import { nomeVenda } from "@/lib/situacao";
import {
  agruparPendentes, brl, codigoCaixaTexto, codigoVisivel, diaDaVenda, formaPagamento, haQuanto, horaVenda, normalizar, proximoNomeCaixa, resumoVendas, situacaoCaixa,
  textoCaixa, textoItemVenda, validadeCodigoCaixa, type Caixa, type GrupoPendente, type ItemPendente, type Venda,
} from "@/lib/vendas";

export type ApiVendas = {
  caixas: (comercioId: string) => Promise<Caixa[]>;
  vendas: (comercioId: string, desde: string) => Promise<Venda[]>;
  criar: (comercioId: string, nome: string) => Promise<{ id: string; codigo: string }>;
  renomear: (id: string, nome: string) => Promise<unknown>;
  novoCodigo: (id: string) => Promise<string>;
  desligar: (id: string) => Promise<unknown>;
  pendentes: (comercioId: string) => Promise<ItemPendente[]>;
  resolver: (itemId: string, acao: "ligar" | "ignorar", produto: string | null, variacao: string | null, embalagem: string | null) => Promise<{ itens: number; conferir?: number }>;
  /** Caixa no celular (C3): abertura e fechamento de cada funcionário, ver a diferença e cancelar venda. */
  fechamentos?: ((comercioId: string, desde: string) => Promise<banco.FechamentoCaixa[]>) | undefined;
  conferirFechamento?: ((turnoId: string) => Promise<unknown>) | undefined;
  cancelarCelular?: ((vendaId: string, motivo: string) => Promise<unknown>) | undefined;
};
const API_PADRAO: ApiVendas = {
  caixas: banco.carregarCaixas, vendas: banco.carregarVendas, criar: banco.criarCaixa, renomear: banco.renomearCaixa,
  novoCodigo: banco.novoCodigoCaixa, desligar: banco.desligarCaixa, pendentes: banco.carregarPendentesVenda, resolver: banco.resolverItemVenda,
  fechamentos: banco.carregarFechamentos, conferirFechamento: banco.conferirFechamentoCaixa, cancelarCelular: banco.cancelarVendaCelular,
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

export function PainelVendas({ comercioId, tipo, products, api = API_PADRAO, onMudou }: {
  comercioId: string; tipo: string; products: Product[]; api?: ApiVendas | undefined;
  /** Avisa que algo mudou no estoque (item sem cadastro ligado a um produto), para atualizar o resto do app. */
  onMudou?: (() => void) | undefined;
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
  const [pendentes, setPendentes] = useState<ItemPendente[]>([]);
  const [resolvendo, setResolvendo] = useState<string | null>(null);
  const [pronto, setPronto] = useState("");
  const [fechamentos, setFechamentos] = useState<banco.FechamentoCaixa[]>([]);

  const recarregar = useCallback(async () => {
    setAtualizando(true);
    const t = Date.now();
    // Desde o começo de ontem (São Paulo): cobre "Hoje" e "Ontem".
    const desde = new Date(`${diaSP(t - 86_400_000)}T00:00:00-03:00`).toISOString();
    try {
      // O quadro do caixa no celular carrega à parte: se falhar ou demorar, não segura o resto da aba.
      if (api.fechamentos) void api.fechamentos(comercioId, desde).then((f) => setFechamentos(f ?? []), () => {});
      const [cs, vs, ps] = await Promise.all([api.caixas(comercioId), api.vendas(comercioId, desde), api.pendentes(comercioId)]);
      setCaixas(cs); setVendas(vs); setPendentes(ps); setErro(false); setAgora(Date.now());
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
  const grupos = useMemo(() => agruparPendentes(pendentes), [pendentes]);
  const grupoSel = grupos.find((g) => g.codigo === resolvendo);
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
            <b>{resumo.pendentes === 1 ? "1 item vendido" : `${resumo.pendentes} itens vendidos`} sem cadastro no Omni.</b> {resumo.pendentes === 1 ? "Ainda não saiu" : "Ainda não saíram"} do estoque. Veja em "Vendido sem cadastro", logo abaixo.
          </p>
        )}
        {resumo.faltou > 0 && (
          <p className="mt-3 rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">
            <b>{resumo.faltou === 1 ? "1 produto vendido" : `${resumo.faltou} produtos vendidos`} além do que o sistema tinha na {area}.</b> Alguém repôs sem usar o app, ou a contagem estava errada.
          </p>
        )}
        {erro && <p role="alert" className="mt-3 text-sm text-warning">Não foi possível atualizar agora. Os números são da última consulta.</p>}
      </section>

      {pronto && <p role="status" className="flex items-center gap-2 rounded-2xl border border-accent/50 bg-accent/10 p-3 text-sm font-semibold text-accent"><Check size={18} /> {pronto}</p>}

      <Fechamentos lista={fechamentos.filter((f) => !f.fechadoEm || diaSP(Date.parse(f.abertoEm)) === diaSel || (f.diferenca && !f.conferidoEm))}
        vendas={vendas ?? []} onVisto={async (id) => { await (api.conferirFechamento ?? banco.conferirFechamentoCaixa)(id); await recarregar(); }} />

      {/* vendido sem cadastro */}
      {grupos.length > 0 && (
        <section aria-label="Vendido sem cadastro" className="space-y-3 rounded-3xl border border-destructive/50 bg-destructive/5 p-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold"><PackageSearch size={20} className="text-destructive" /> Vendido sem cadastro</h2>
            <p className="text-sm text-muted-foreground">O caixa vendeu, mas o Omni não sabe qual produto é. Diga uma vez e as próximas vendas saem da {area} sozinhas.</p>
          </div>
          <ul className="space-y-2">
            {grupos.map((g) => (
              <li key={g.codigo}>
                <button type="button" onClick={() => { setPronto(""); setResolvendo(g.codigo); }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background/40 p-3 text-left transition hover:border-primary">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{g.descricao}</span>
                    <span className="block text-xs text-muted-foreground">
                      {g.codigoBarras ? `Código ${g.codigoBarras}` : codigoVisivel(g.codigo) === g.codigo ? `Código ${g.codigo}` : "Sem código"} · {g.vendas === 1 ? "1 venda" : `${g.vendas} vendas`}{g.ultimaEm ? ` · última ${haQuanto(g.ultimaEm, agora)}` : ""}
                    </span>
                    {g.conferir && <span className="block text-xs font-semibold text-warning">Vendido em quantidade quebrada: confira o produto</span>}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-primary">Resolver</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
            <p className="flex items-start gap-2 rounded-2xl bg-secondary/50 p-3 text-left text-sm"><Smartphone size={18} className="mt-0.5 shrink-0 text-primary" />
              <span><b>Sem computador?</b> Na Equipe, ligue <b>Caixa</b> no nome de um funcionário: ele vende pelo próprio celular, no app Omni Operação.</span></p>
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
                    <span className="block truncate text-sm font-semibold">{nomeCaixa(v.caixaId)}{v.numero ? ` · ${v.celular ? "Venda" : "Nota"} ${v.numero}` : ""}</span>
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
      {grupoSel && (
        <ResolverPendente g={grupoSel} products={products} area={area} onClose={() => setResolvendo(null)}
          onResolver={async (acao, produto, variacao, embalagem) => {
            const r = await api.resolver(grupoSel.itemId, acao, produto, variacao, embalagem);
            const nome = products.find((p) => (p.db?.id ?? String(p.id)) === produto)?.nome;
            setResolvendo(null);
            setPronto(acao === "ignorar" ? `"${grupoSel.descricao}" não será controlado no estoque.`
              : `${r.itens === 1 ? "1 venda ligada" : `${r.itens} vendas ligadas`} a ${nome ?? "este produto"}. As próximas saem da ${area} sozinhas.`
                + (r.conferir ? ` ${r.conferir} com quantidade quebrada: confira.` : ""));
            await recarregar(); onMudou?.();
          }} />
      )}
      {vendaSel && <DetalheVenda v={vendaSel} caixa={nomeCaixa(vendaSel.caixaId)} products={products} area={area} onClose={() => setVendaAberta(null)}
        onCancelar={vendaSel.celular && vendaSel.situacao === "finalizada" ? async (motivo) => {
          await (api.cancelarCelular ?? banco.cancelarVendaCelular)(vendaSel.id, motivo);
          setPronto(`Venda ${vendaSel.numero ? `nº ${vendaSel.numero} ` : ""}cancelada. Os produtos voltaram para a ${area}.`);
          await recarregar(); onMudou?.();
        } : undefined} />}
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
          {c.tipo === "celular" ? <Smartphone size={22} /> : <MonitorSmartphone size={22} />}
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
        <p className="flex items-start gap-2 rounded-2xl bg-secondary/50 p-3 text-sm"><Smartphone size={18} className="mt-0.5 shrink-0 text-primary" />
          <span>Este é o caixa do <b>computador</b>. Para vender pelo <b>celular</b>, ligue <b>Caixa</b> no nome do funcionário, na Equipe.</span></p>
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
        {s === "celular" && (
          <p className="rounded-2xl border border-border bg-secondary/40 p-3 text-sm">
            Vende pelo celular, no app <b>Omni Operação</b>. Para tirar o caixa deste funcionário, desligue <b>Caixa</b> no nome dele, na Equipe.
          </p>
        )}
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
            {!c.desligadoEm && s !== "celular" && (
              <button type="button" onClick={() => setConfirmar("desligar")} className="flex min-h-12 items-center justify-center gap-2 text-sm font-semibold text-destructive"><Ban size={16} /> Desligar este caixa</button>
            )}
          </div>
        )}
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
      </div>
    </Sheet>
  );
}

function DetalheVenda({ v, caixa, products, area, onClose, onCancelar }: {
  v: Venda; caixa: string; products: Product[]; area: string; onClose: () => void; onCancelar?: ((motivo: string) => Promise<unknown>) | undefined;
}) {
  const prod = (id: string | null) => (id ? products.find((p) => (p.db?.id ?? p.id) === id) : undefined);
  const [cancelar, setCancelar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  return (
    <Sheet title={`${caixa} · ${horaVenda(v)}`} onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-2xl font-bold ${v.situacao === "cancelada" ? "line-through opacity-60" : ""}`}>{brl(v.total)}</p>
          <p className="text-sm text-muted-foreground">{v.numero ? `${v.celular ? "Venda" : "Nota"} ${v.numero}` : ""}</p>
        </div>
        {v.situacao === "cancelada" && <p className="rounded-2xl border border-border p-3 text-sm">
          {v.canceladaPor === "dono" ? "Cancelada por você" : v.canceladaPor === "funcionario" ? "Cancelada no caixa, com o seu PIN" : "Venda cancelada no caixa"}{v.motivoCancelamento ? ` (${v.motivoCancelamento})` : ""}. O que tinha saído voltou para a {area}.</p>}
        {v.pagamentos.length > 0 && (
          <p className="text-sm text-muted-foreground">{v.pagamentos.map((p) => `${formaPagamento(p.forma)} ${brl(p.valor)}`).join(" · ")}{v.troco ? ` · troco ${brl(v.troco)}` : ""}</p>
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
                    <span className="block text-xs text-muted-foreground">{String(i.qtdNota).replace(".", ",")} {i.unidadeNota ?? ""}{i.codigoBarras || !/^(omni|avulso):/.test(i.codigoPdv) ? ` · código ${i.codigoBarras ?? i.codigoPdv}` : ""}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{brl(i.valor)}</span>
                </div>
                <p className={`mt-1 text-xs font-semibold ${COR[t.nivel].texto}`}>{t.texto}</p>
              </li>
            );
          })}
        </ul>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Receipt size={14} /> {v.celular ? "Vendida pelo celular da equipe (sem nota fiscal). Só saiu da gôndola ao finalizar." : "Chegou do caixa depois de finalizada. Bipar sem finalizar não desconta."}</p>
        {onCancelar && (!cancelar ? (
          <button type="button" onClick={() => setCancelar(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-destructive/50 px-4 text-base font-semibold text-destructive"><Ban size={18} /> Cancelar esta venda</button>
        ) : (
          <div className="space-y-2 rounded-2xl border border-destructive/50 bg-destructive/5 p-3">
            <p className="text-sm">Os produtos voltam para a {area}. Se foi no fiado, o valor sai da conta do cliente.</p>
            <input value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" aria-label="Motivo do cancelamento"
              className="h-12 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
            <button type="button" disabled={ocupado} onClick={() => { setOcupado(true); setErro(""); onCancelar(motivo.trim()).then(onClose, (e) => { setErro(erroTexto(e)); setOcupado(false); }); }}
              className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-destructive px-4 text-base font-semibold text-white disabled:opacity-40">{ocupado ? "Cancelando…" : "Sim, cancelar a venda"}</button>
            <button type="button" onClick={() => setCancelar(false)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/** "Qual produto é?": liga o código do caixa a um produto (e embalagem/variação) ou marca para não controlar. */
function ResolverPendente({ g, products, area, onResolver, onClose }: {
  g: GrupoPendente; products: Product[]; area: string; onClose: () => void;
  onResolver: (acao: "ligar" | "ignorar", produto: string | null, variacao: string | null, embalagem: string | null) => Promise<unknown>;
}) {
  const [busca, setBusca] = useState(() => g.codigoBarras ?? "");
  const [sel, setSel] = useState<Product | null>(null);
  const [variacao, setVariacao] = useState<string | null>(null);
  const [embalagem, setEmbalagem] = useState<string | null>(null);
  const [ignorar, setIgnorar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const q = normalizar(busca);
  const achados = (q ? products.filter((p) => normalizar(p.nome ?? "").includes(q) || (p.codigo ?? "").includes(q) || (p.embalagens ?? []).some((e) => e.codigo === q)) : products).slice(0, 30);
  const vars = (sel?.variacoes ?? []).filter((v) => v.uid);
  const embs = (sel?.embalagens ?? []).filter((e) => e.uid);
  const ok = !!sel && (!vars.length || !!variacao) && !salvando;
  const enviar = (acao: "ligar" | "ignorar") => {
    setSalvando(true); setErro("");
    onResolver(acao, acao === "ligar" ? sel?.db?.id ?? String(sel?.id) : null, acao === "ligar" ? variacao : null, acao === "ligar" ? embalagem : null)
      .catch((e) => { setErro(erroTexto(e)); setSalvando(false); });
  };
  return (
    <Sheet title="Qual produto é?" onClose={onClose}>
      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-3">
        <div className="rounded-2xl border border-border p-3 text-sm">
          <p className="text-xs text-muted-foreground">No caixa aparece como</p>
          <p className="text-base font-bold">{g.descricao}</p>
          <p className="text-xs text-muted-foreground">{codigoVisivel(g.codigo) === g.codigo ? `Código ${g.codigo}` : "Sem código"}{g.codigoBarras && g.codigoBarras !== g.codigo ? ` · barras ${g.codigoBarras}` : ""} · {g.vendas === 1 ? "1 venda" : `${g.vendas} vendas`} · {String(g.qtd).replace(".", ",")} {g.unidadeNota ?? ""}</p>
          {g.conferir && <p className="mt-1 text-xs font-semibold text-warning">Foi vendido em quantidade quebrada, mas o produto ligado é contado inteiro. Escolha um produto vendido por Kg, metro ou litro, ou marque para não controlar.</p>}
        </div>

        {!ignorar ? (
          <>
            <label className="relative block">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={busca} onChange={(e) => { setBusca(e.target.value); }} placeholder="Procurar pelo nome ou código" aria-label="Procurar produto"
                className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 pl-11 pr-4 text-base text-foreground outline-none focus-visible:border-primary" />
            </label>
            <ul className="max-h-60 space-y-1.5 overflow-y-auto" aria-label="Produtos">
              {!achados.length && <li className="p-3 text-center text-sm text-muted-foreground">Nenhum produto com esse nome. Se for um produto novo, cadastre na aba Produtos e volte aqui.</li>}
              {achados.map((p) => (
                <li key={String(p.id)}>
                  <button type="button" aria-pressed={sel?.id === p.id} onClick={() => { setSel(p); setVariacao(null); setEmbalagem(null); }}
                    className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border px-3 text-left text-sm transition ${sel?.id === p.id ? "border-primary bg-primary/15" : "border-border"}`}>
                    <span className="min-w-0"><span className="block truncate font-semibold">{p.nome}</span><span className="block text-xs text-muted-foreground">{p.codigo} · {p.unidade}</span></span>
                    {sel?.id === p.id && <Check size={18} className="shrink-0 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
            {sel && vars.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">Qual tamanho e cor?</legend>
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
            {sel && embs.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">O caixa vende este código como:</legend>
                <div className="grid grid-cols-1 gap-2">
                  {[{ uid: null as string | null, txt: `${sel.unidade} (1 de cada vez)` }, ...embs.map((e) => ({ uid: e.uid as string | null, txt: `${e.tipo} com ${e.qtd}` }))].map((o) => (
                    <button key={o.uid ?? "un"} type="button" aria-pressed={embalagem === o.uid} onClick={() => setEmbalagem(o.uid)}
                      className={`flex min-h-12 items-center justify-between rounded-2xl border px-3 text-left text-sm font-semibold ${embalagem === o.uid ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
                      {o.txt} {embalagem === o.uid && <Check size={18} />}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
            <button type="button" disabled={!ok} onClick={() => enviar("ligar")} className={btnPrimary(ok)}>
              {salvando ? "Ligando…" : sel ? `Ligar a ${sel.nome} e tirar da ${area}` : "Escolha o produto"}
            </button>
            <p className="text-center text-xs text-muted-foreground">Vale para {g.vendas === 1 ? "esta venda" : `as ${g.vendas} vendas`} e para as próximas deste código.</p>
            <button type="button" onClick={() => setIgnorar(true)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Não é produto do estoque (ex.: sacola, serviço)</button>
          </>
        ) : (
          <div className="space-y-2 rounded-2xl border border-border p-3">
            <p className="text-sm">"{g.descricao}" deixa de aparecer aqui e não sai do estoque, agora e nas próximas vendas.</p>
            {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
            <button type="button" disabled={salvando} onClick={() => enviar("ignorar")} className={`w-full ${btnGhost}`}>Sim, não controlar</button>
            <button type="button" onClick={() => setIgnorar(false)} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Abertura e fechamento do caixa no celular, com a diferença do dinheiro na gaveta. */
function Fechamentos({ lista, vendas, onVisto }: { lista: banco.FechamentoCaixa[]; vendas: Venda[]; onVisto: (id: string) => Promise<unknown> }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  if (!lista.length) return null;
  const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return (
    <section aria-label="Caixas do celular" className="space-y-2">
      <h2 className="flex items-center gap-2 text-base font-bold"><Smartphone size={18} className="text-primary" /> Caixas do celular</h2>
      <ul className="space-y-2">
        {lista.map((f) => {
          const doTurno = vendas.filter((v) => v.turnoId === f.id && v.situacao === "finalizada");
          const total = doTurno.reduce((t, v) => t + v.total, 0);
          const d = f.diferenca ?? 0;
          const alerta = !!f.fechadoEm && d !== 0 && !f.conferidoEm;
          return (
            <li key={f.id} className={`rounded-3xl border p-4 text-sm ${alerta ? "border-destructive/60 bg-destructive/10" : "border-border bg-secondary/50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-bold">{f.funcionario}</p>
                  <p className="text-xs text-muted-foreground">{f.fechadoEm ? `${dia(f.abertoEm)} · ${hora(f.abertoEm)} até ${hora(f.fechadoEm)}` : `Aberto desde ${hora(f.abertoEm)}`}</p>
                </div>
                <span className="shrink-0 text-right"><b className="block text-base">{brl(total)}</b><span className="text-xs text-muted-foreground">{doTurno.length === 1 ? "1 venda" : `${doTurno.length} vendas`}</span></span>
              </div>
              {f.fechadoEm && f.esperado != null && f.contado != null && (
                <div className="mt-2 space-y-1">
                  <p className="text-muted-foreground">Deveria ter na gaveta <b className="text-foreground">{brl(f.esperado)}</b> · contou <b className="text-foreground">{brl(f.contado)}</b>{f.sangrias ? ` · tirado ${brl(f.sangrias)}` : ""}</p>
                  <p className={`font-bold ${d === 0 ? "text-accent" : d < 0 ? "text-destructive" : "text-warning"}`}>{d === 0 ? "Bateu certinho" : d < 0 ? `Faltaram ${brl(-d)}` : `Sobraram ${brl(d)}`}</p>
                  {f.observacao && <p className="text-xs">Recado: "{f.observacao}"</p>}
                  {alerta && (
                    <button type="button" disabled={ocupado === f.id} onClick={() => { setOcupado(f.id); void onVisto(f.id).finally(() => setOcupado(null)); }}
                      className="mt-1 flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-background/40 px-4 font-semibold"><Check size={16} /> Já vi, tirar o alerta</button>
                  )}
                </div>
              )}
              {!f.fechadoEm && <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-accent"><span className="h-2 w-2 rounded-full bg-accent" /> Vendendo agora</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
