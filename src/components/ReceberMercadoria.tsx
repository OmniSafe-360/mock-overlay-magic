import { Contador } from "@/components/parts/Contador";
import { useHoje } from "@/hooks/useHoje";
/* Receber mercadoria no app do funcionário (E2). Conferência cega: o funcionário bipa e conta o que chegou, sem nunca ver
 * quanto foi pedido. Ao tocar em "Terminei", o servidor compara e pede para contar de novo o que não bateu. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Camera, Check, CheckCircle2, Keyboard, Minus, PackageCheck, PackageX, Plus, Search, Truck } from "lucide-react";
import { Scanner } from "@/components/Scanner";
import { Sheet } from "@/components/parts/Sheet";
import { btnGhost, btnPrimary, digits } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import { aceitaFracao, fmtQ, newUid, parseNum, qtdUn, unPlural } from "@/lib/deposito";
import { mensagemErro } from "@/lib/persistencia";
import { dataEntregaTexto } from "@/lib/pedido";
import { escopoAcesso, operacaoLocal } from "@/lib/operacaoLocal";
import { ERRO_REGISTRO } from "@/lib/envios";
import {
  apagarRascunho, chaveProduto, chaveRascunho, erroContagem, guardarRascunho, itemParaEnvio, lerRascunho, nomeProdutoFunc, novaContagem, resumoContagem,
  totalDaContagem, type Contagem, type EstadoItem, type ProdutoFunc,
} from "@/lib/recebimento";

export type ApiReceber = {
  entregas: typeof banco.entregasFuncionario;
  abrir: typeof banco.abrirRecebimento;
  buscar: typeof banco.buscarProdutoFuncionario;
  enviar: typeof banco.enviarRecebimento;
};
const API_PADRAO: ApiReceber = { entregas: banco.entregasFuncionario, abrir: banco.abrirRecebimento, buscar: banco.buscarProdutoFuncionario, enviar: banco.enviarRecebimento };

const MSG_RECEBER: [string, string][] = [
  ["validades_nao_somam", "As quantidades das validades não somam o que chegou. Confira."],
  ["validade_obrigatoria", "Informe a data de validade dos produtos."],
  ["recebimento_vencido_como_bom", "Separe os vencidos e informe em “Veio quebrado ou vencido”. Eles não entram como produtos bons."],
  ["operacao_repetida_com_outros_dados", "Esta rodada já foi enviada com outros dados. Abra a entrega novamente para conferir o resultado."],
  ["lote_obrigatorio", "Informe o lote dos remédios."],
  ["lote_com_datas_diferentes", "Esse lote já está registrado com outra validade. Confira a data na caixa."],
  ["avaria_maior_que_total", "Os quebrados ou vencidos não podem ser mais que o total."],
  ["pedido_ja_recebido", "Esta entrega já foi recebida."],
  ["pedido_fechado", "Este pedido foi cancelado ou já recebido."],
  ["rodada_desatualizada", "A contagem foi atualizada em outro celular. Abra a entrega de novo."],
  ["acesso_encerrado", "Este celular saiu do app. Entre de novo com o código do dono."],
  ["pin_necessario", "Por segurança, o app travou. Volte ao início e digite seu PIN."],
  ["funcao_nao_permite_receber", "Sua função não inclui receber mercadoria. Fale com o dono."],
];
const erroTexto = (e: unknown) => {
  const m = String((e as { message?: string } | null)?.message ?? e ?? "");
  return MSG_RECEBER.find(([k]) => m.includes(k))?.[1] ?? mensagemErro(e).replace("Seus dados continuam no formulário. ", "").replace("Não foi possível salvar agora. ", "Não foi possível enviar agora. ");
};

type Tela =
  | { t: "lista" }
  | { t: "contando"; aberto: banco.RecebimentoAberto; kr: string; fornecedorId: string | null }
  | { t: "pronto"; avisos: boolean; produtos: number };

export function ReceberMercadoria({ chave, onVoltar, api: apiDada, mercado = false }: { chave: string; onVoltar: () => void; api?: ApiReceber | undefined; mercado?: boolean }) {
  return <ReceberPorAcesso key={chave} mercado={mercado} chave={chave} onVoltar={onVoltar} apiDada={apiDada} />;
}

function ReceberPorAcesso({ chave, onVoltar, apiDada, mercado }: { chave: string; onVoltar: () => void; apiDada?: ApiReceber | undefined; mercado: boolean }) {
  const api = apiDada ?? API_PADRAO;
  const [tela, setTela] = useState<Tela>({ t: "lista" });
  const [erro, setErro] = useState("");
  const abrir = async (pedidoId: string | null, fornecedorId: string | null) => {
    setErro("");
    try {
      const kr = chaveRascunho(pedidoId, await escopoAcesso(chave));
      const rasc = lerRascunho(kr);
      const aberto = await api.abrir(chave, rasc?.id ?? newUid(), pedidoId, fornecedorId ?? rasc?.fornecedorId ?? null);
      setTela({ t: "contando", aberto, kr, fornecedorId: fornecedorId ?? rasc?.fornecedorId ?? null });
    } catch (e) { setErro(erroTexto(e)); }
  };
  if (tela.t === "contando")
    return <Contando mercado={mercado} chave={chave} api={api} aberto={tela.aberto} kr={tela.kr} fornecedorId={tela.fornecedorId} onSair={() => setTela({ t: "lista" })} onPronto={(avisos, produtos) => setTela({ t: "pronto", avisos, produtos })} />;
  if (tela.t === "pronto")
    return (
      <div className="m-auto flex w-full flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/15 text-accent"><CheckCircle2 size={44} /></span>
        <p className="text-2xl font-bold">Pronto!</p>
        <p className="text-base">Mercadoria recebida. {tela.produtos === 1 ? "1 produto conferido" : `${tela.produtos} produtos conferidos`} e já no estoque.</p>
        {tela.avisos && <p className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">Algumas diferenças foram avisadas ao dono. Deixe separado o que veio fora do pedido.</p>}
        <button type="button" onClick={onVoltar} className={btnPrimary(true)}>Voltar ao início</button>
      </div>
    );
  return <ListaEntregas chave={chave} api={api} erroAbrir={erro} onVoltar={onVoltar} onAbrir={abrir} />;
}

/* ---------- lista de entregas ---------- */
function ListaEntregas({ chave, api, erroAbrir, onVoltar, onAbrir }: {
  chave: string; api: ApiReceber; erroAbrir: string; onVoltar: () => void; onAbrir: (pedidoId: string | null, fornecedorId: string | null) => Promise<void>;
}) {
  const [dados, setDados] = useState<Awaited<ReturnType<ApiReceber["entregas"]>> | null>(null);
  const [erro, setErro] = useState("");
  const [semPedido, setSemPedido] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const carregar = useCallback(() => { setErro(""); api.entregas(chave).then(setDados).catch((e) => setErro(erroTexto(e))); }, [api, chave]);
  useEffect(carregar, [carregar]);
  const hoje = useHoje();
  const ir = (pedidoId: string | null, fornecedorId: string | null) => { setAbrindo(pedidoId ?? "sem"); void onAbrir(pedidoId, fornecedorId).finally(() => setAbrindo(null)); };
  return (
    <div className="space-y-4">
      <button type="button" onClick={onVoltar} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Início</button>
      <div>
        <h1 className="text-2xl font-bold">Receber mercadoria</h1>
        <p className="text-sm text-muted-foreground">Escolha a entrega que chegou. Você vai bipar e contar cada produto.</p>
      </div>
      {(erro || erroAbrir) && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro || erroAbrir}</p>}
      {!dados && !erro && <p className="py-8 text-center text-muted-foreground">Carregando entregas…</p>}
      {dados && !dados.pedidos.length && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nenhuma entrega esperada agora.</p>}
      <ul className="space-y-3">
        {dados?.pedidos.map((p) => (
          <li key={p.id}>
            <button type="button" disabled={!!abrindo} onClick={() => ir(p.id, null)}
              className={`flex w-full items-center gap-3 rounded-3xl border-2 p-4 text-left transition active:scale-[0.99] ${p.previsaoEntrega && p.previsaoEntrega <= hoje ? "border-warning/60 bg-warning/10" : "border-border bg-secondary/60"}`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Truck size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-lg font-bold leading-snug">{p.fornecedor}</span>
                <span className="block text-sm text-muted-foreground">Pedido nº {p.numero} · {p.produtos === 1 ? "1 produto" : `${p.produtos} produtos`}</span>
                <span className="block text-sm font-semibold">
                  {p.emContagem ? <span className="text-primary">Contagem em andamento — continuar</span>
                    : p.previsaoEntrega ? (p.previsaoEntrega <= hoje ? <span className="text-warning">Previsto para hoje</span> : `Previsto: ${dataEntregaTexto(p.previsaoEntrega)}`) : "Sem data prevista"}
                </span>
              </span>
              {abrindo === p.id && <span className="text-sm text-muted-foreground">Abrindo…</span>}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" disabled={!!abrindo} onClick={() => setSemPedido(true)} className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}><PackageCheck size={18} /> Chegou sem pedido</button>
      {semPedido && dados && (
        <Sheet title="De qual fornecedor?" onClose={() => setSemPedido(false)}>
          <div className="min-h-0 space-y-2 overflow-y-auto px-5 py-3">
            <p className="text-sm text-muted-foreground">Escolha quem entregou. Se não souber, toque em "Não sei".</p>
            {dados.fornecedores.map((f) => (
              <button key={f.id} type="button" onClick={() => { setSemPedido(false); ir(null, f.id); }} className="flex min-h-13 w-full items-center rounded-2xl border border-border px-4 text-left text-base font-semibold">{f.nome}</button>
            ))}
            <button type="button" onClick={() => { setSemPedido(false); ir(null, null); }} className="flex min-h-13 w-full items-center rounded-2xl border border-dashed border-border px-4 text-left text-base font-semibold text-muted-foreground">Não sei</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ---------- contagem ---------- */
function Contando({ chave, api, aberto, kr, fornecedorId, onSair, onPronto, mercado }: {
  chave: string; api: ApiReceber; aberto: banco.RecebimentoAberto; onSair: () => void; onPronto: (avisos: boolean, produtos: number) => void;
  kr: string; fornecedorId: string | null; mercado: boolean;
}) {
  const inicial = useMemo(() => {
    const r = lerRascunho(kr);
    const mesmo = r && r.id === aberto.id && r.rodada === aberto.rodada ? r : null;
    const estados: Record<string, EstadoItem> = {};
    const contagens: Record<string, Contagem> = { ...(mesmo?.contagens ?? {}) };
    for (const p of aberto.produtos) estados[chaveProduto(p)] = "falta";
    for (const [k, c] of Object.entries(contagens)) if (!(k in estados) || estados[k] === "falta") estados[k] = erroContagem(c) ? "falta" : "contado";
    for (const i of aberto.itens) {
      const k = chaveProduto(i);
      estados[k] = i.situacao === "recontar" ? "recontar" : "conferido";
      if (i.situacao === "recontar" && contagens[k] && mesmo?.estados[k] !== "contado") delete contagens[k];
      if (i.situacao === "recontar" && mesmo?.estados[k] === "contado" && contagens[k]) estados[k] = "contado";
    }
    return { estados, contagens, rodada: aberto.rodada };
  }, [aberto, kr]);
  const [estados, setEstados] = useState(inicial.estados);
  const [contagens, setContagens] = useState(inicial.contagens);
  const [produtos, setProdutos] = useState<Record<string, ProdutoFunc>>(() => {
    const m: Record<string, ProdutoFunc> = {};
    for (const p of aberto.produtos) m[chaveProduto(p)] = p;
    for (const [k, c] of Object.entries(inicial.contagens)) m[k] ??= c.p;
    return m;
  });
  const [rodada, setRodada] = useState(inicial.rodada);
  const [aberta, setAberta] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const [busca, setBusca] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  type PedidoEnvio = { rodada: number; itens: ReturnType<typeof itemParaEnvio>[]; chaves: string[] };
  const [registro] = useState(() => {
    try { return operacaoLocal(kr, `receber:${aberto.id}`, (p: unknown): p is PedidoEnvio => {
      const x = p as PedidoEnvio | null;
      return !!x && Number.isInteger(x.rodada) && x.rodada >= 0 && Array.isArray(x.itens) && Array.isArray(x.chaves)
        && x.itens.length === x.chaves.length && x.itens.every((i) => typeof i.produto_id === "string" && Number.isFinite(i.total));
    }); } catch { return null; }
  });
  const envioPendente = !!registro?.pendente();
  const noPedido = useMemo(() => new Set(aberto.produtos.map(chaveProduto)), [aberto.produtos]);

  useEffect(() => {
    guardarRascunho(kr, { id: aberto.id, pedidoId: aberto.pedidoId, fornecedorId, contagens, estados, rodada });
  }, [kr, aberto.id, aberto.pedidoId, fornecedorId, contagens, estados, rodada]);

  const chaves = Object.keys(produtos);
  const ordem = (k: string) => ({ recontar: 0, falta: 1, contado: 2, conferido: 3 })[estados[k] ?? "falta"];
  const lista = [...chaves].sort((a, b) => ordem(a) - ordem(b));
  const contados = chaves.filter((k) => estados[k] === "contado");
  const pendentes = chaves.filter((k) => estados[k] === "recontar" || (estados[k] === "falta" && noPedido.has(k)));
  const podeTerminar = !!registro && (envioPendente || (contados.length > 0 && !chaves.some((k) => estados[k] === "recontar"))) && !enviando;

  const escolher = (p: ProdutoFunc) => {
    const k = chaveProduto(p);
    setProdutos((m) => ({ ...m, [k]: m[k] ?? p }));
    setEstados((m) => ({ ...m, [k]: m[k] ?? "falta" }));
    if (estados[k] === "conferido") { setAviso(`${nomeProdutoFunc(p)} já foi conferido nesta entrega.`); return; }
    setAviso("");
    setContagens((m) => {
      if (m[k]) {
        // Bipou a caixa de novo: soma 1 caixa fechada daquela embalagem.
        if (p.embalagemId) { const c = m[k]!; return { ...m, [k]: { ...c, fechadas: { ...c.fechadas, [p.embalagemId]: String(Number(c.fechadas[p.embalagemId] || 0) + 1) } } }; }
        return m;
      }
      const c = novaContagem(p);
      if (p.embalagemId) c.fechadas[p.embalagemId] = "1";
      return { ...m, [k]: c };
    });
    setAberta(k);
  };
  const lerCodigo = async (codigo: string) => {
    setAviso("");
    try {
      const r = await api.buscar(chave, codigo);
      if (!r.length) { setAviso(`Nenhum produto com o código ${codigo}. Separe e avise o dono para cadastrar.`); return; }
      escolher(r[0]!);
    } catch (e) { setAviso(erroTexto(e)); }
  };

  const terminar = async () => {
    if (!podeTerminar || !registro) return;
    setEnviando(true); setErro("");
    try {
      const confirmado = await registro.enviar(() => ({ rodada, itens: contados.map((k) => itemParaEnvio(contagens[k]!)), chaves: contados }),
        (p) => api.enviar(chave, aberto.id, p.rodada, p.itens));
      const r = confirmado.resultado;
      if (r.situacao === "concluido") { apagarRascunho(kr); onPronto(r.avisos, r.produtos); return; }
      const recontar = new Set(r.recontar.map(chaveProduto));
      setEstados((m) => {
        const n = { ...m };
        for (const k of confirmado.pedido.chaves) n[k] = recontar.has(k) ? "recontar" : "conferido";
        return n;
      });
      // Recontagem cega: a contagem anterior some da tela.
      setContagens((m) => { const n = { ...m }; for (const k of recontar) delete n[k]; return n; });
      setRodada(r.rodada);
      const faltam = r.faltam.map((x) => produtos[chaveProduto(x)]).filter(Boolean).map((p) => nomeProdutoFunc(p!));
      setAviso([
        recontar.size ? `Conte de novo ${recontar.size === 1 ? "1 produto (marcado em amarelo)" : `${recontar.size} produtos (marcados em amarelo)`}. Conte com calma.` : "",
        faltam.length ? `Ainda falta contar: ${faltam.join(", ")}. Se não veio, abra e toque em "Não veio".` : "",
      ].filter(Boolean).join(" "));
    } catch (e) { setErro(erroTexto(e)); }
    finally { setEnviando(false); }
  };

  const sel = aberta ? produtos[aberta] : undefined;
  return (
    <div className="space-y-4 pb-28">
      {!registro && <p role="alert" className="text-sm text-destructive">{ERRO_REGISTRO}</p>}
      {envioPendente && <p role="status" className="rounded-2xl border border-warning/50 p-3 text-sm">Contagem enviada sem confirmação. Toque em Terminei para repetir os dados originais, sem duplicar.</p>}
      <button type="button" onClick={onSair} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Entregas</button>
      <div>
        <h1 className="break-words text-2xl font-bold leading-tight">{aberto.fornecedor ?? "Entrega sem pedido"}</h1>
        <p className="text-sm text-muted-foreground">{aberto.numero ? `Pedido nº ${aberto.numero}` : "Sem pedido"} · bipe cada produto e conte o que chegou.</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <button type="button" onClick={() => setScan(true)} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><Camera size={22} /> Bipar produto</button>
        <button type="button" onClick={() => setBusca(true)} className={`flex items-center justify-center gap-2 ${btnGhost}`}><Keyboard size={18} /> Digitar código ou nome</button>
      </div>
      {aviso && <p role="status" className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">{aviso}</p>}

      <ul className="space-y-2">
        {lista.map((k) => {
          const p = produtos[k]!;
          const e = estados[k] ?? "falta";
          const c = contagens[k];
          const fora = !!aberto.pedidoId && !noPedido.has(k);
          return (
            <li key={k}>
              <button type="button" onClick={() => (e === "conferido" ? setAviso(`${nomeProdutoFunc(p)} já foi conferido.`) : (setContagens((m) => ({ ...m, [k]: m[k] ?? novaContagem(p) })), setAberta(k)))}
                aria-label={`${nomeProdutoFunc(p)}: ${e === "falta" ? "falta contar" : e === "recontar" ? "conte de novo" : e === "conferido" ? "conferido" : "contado"}`}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${e === "recontar" ? "border-warning bg-warning/10" : e === "conferido" ? "border-accent/50 bg-accent/5" : e === "contado" ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/50"}`}>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-base font-semibold leading-snug">{nomeProdutoFunc(p)}</span>
                  <span className={`block text-sm ${e === "recontar" ? "font-semibold text-warning" : e === "conferido" ? "text-accent" : "text-muted-foreground"}`}>
                    {e === "falta" ? "Falta contar" : e === "recontar" ? "Conte de novo" : e === "conferido" ? "Conferido" : c ? resumoContagem(c) : ""}
                  </span>
                  {fora && e !== "conferido" && <span className="block text-xs font-semibold text-warning">Não está no pedido — deixe separado</span>}
                </span>
                {e === "conferido" ? <Check size={22} className="shrink-0 text-accent" /> : e === "recontar" ? <AlertTriangle size={22} className="shrink-0 text-warning" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {!lista.length && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Bipe o primeiro produto para começar.</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background-deep/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-[480px] space-y-1">
          {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
          <button type="button" disabled={!podeTerminar} onClick={() => void terminar()} className={`flex items-center justify-center gap-2 ${btnPrimary(podeTerminar)}`}>
            <PackageCheck size={20} /> {enviando ? "Conferindo…" : "Terminei"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            {chaves.some((k) => estados[k] === "recontar") ? "Conte de novo os produtos em amarelo." : pendentes.length ? `${pendentes.length === 1 ? "Falta 1 produto" : `Faltam ${pendentes.length} produtos`} do pedido.` : contados.length ? "Tudo contado? Toque em Terminei." : "Bipe e conte os produtos."}
          </p>
        </div>
      </div>

      {scan && <Scanner mercado={mercado} onClose={() => setScan(false)} onType={() => { setScan(false); setBusca(true); }} onDenied={() => { setScan(false); setBusca(true); }}
        onCode={(c) => { setScan(false); void lerCodigo(c); }} />}
      {busca && <BuscarProduto chave={chave} api={api} onClose={() => setBusca(false)} onEscolher={(p) => { setBusca(false); escolher(p); }} />}
      {sel && aberta && contagens[aberta] && (
        <ContarProduto c={contagens[aberta]!} recontagem={estados[aberta] === "recontar"} noPedido={!aberto.pedidoId || noPedido.has(aberta)} temPedido={!!aberto.pedidoId}
          onClose={() => setAberta(null)}
          onSalvar={(c) => { setContagens((m) => ({ ...m, [aberta]: c })); setEstados((m) => ({ ...m, [aberta]: "contado" })); setAberta(null); }}
          onTirar={estados[aberta] === "recontar" || noPedido.has(aberta) ? undefined : () => {
            setContagens((m) => { const n = { ...m }; delete n[aberta]; return n; });
            setProdutos((m) => { const n = { ...m }; delete n[aberta]; return n; });
            setEstados((m) => { const n = { ...m }; delete n[aberta]; return n; });
            setAberta(null);
          }} />
      )}
    </div>
  );
}

function BuscarProduto({ chave, api, onClose, onEscolher }: { chave: string; api: ApiReceber; onClose: () => void; onEscolher: (p: ProdutoFunc) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ProdutoFunc[] | null>(null);
  const [erro, setErro] = useState("");
  const procurar = async () => {
    if (q.trim().length < 2) return;
    setErro("");
    try { setRes(await api.buscar(chave, q.trim())); } catch (e) { setErro(erroTexto(e)); }
  };
  return (
    <Sheet title="Achar o produto" onClose={onClose}>
      <form className="min-h-0 space-y-3 overflow-y-auto px-5 py-3" onSubmit={(e) => { e.preventDefault(); void procurar(); }}>
        <label className="relative block">
          <span className="sr-only">Código ou nome</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código de barras ou nome" enterKeyHint="search"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 pl-11 pr-4 text-base text-foreground outline-none focus-visible:border-primary" />
        </label>
        <button type="submit" disabled={q.trim().length < 2} className={btnPrimary(q.trim().length >= 2)}>Procurar</button>
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
        {res && !res.length && <p className="text-center text-sm text-muted-foreground">Nada encontrado. Separe o produto e avise o dono.</p>}
        <ul className="divide-y divide-border">
          {res?.map((p) => (
            <li key={chaveProduto(p) + (p.embalagemId ?? "")}>
              <button type="button" onClick={() => onEscolher(p)} className="flex min-h-13 w-full items-center justify-between gap-3 py-2 text-left">
                <span className="min-w-0">
                  <span className="block break-words text-base font-semibold">{nomeProdutoFunc(p)}</span>
                  {p.codigo && <span className="block text-xs text-muted-foreground">Cód. {p.codigo}</span>}
                </span>
                <Plus size={18} className="shrink-0 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      </form>
    </Sheet>
  );
}

export { Contador } from "@/components/parts/Contador";
function ContarProduto({ c: inicial, recontagem, noPedido, temPedido, onClose, onSalvar, onTirar }: {
  c: Contagem; recontagem: boolean; noPedido: boolean; temPedido: boolean; onClose: () => void; onSalvar: (c: Contagem) => void; onTirar?: (() => void) | undefined;
}) {
  const [c, setC] = useState(inicial);
  const p = c.p;
  const fracao = aceitaFracao(p.unidade);
  const { total } = totalDaContagem(c);
  const erro = erroContagem(c);
  const mudar = (f: (x: Contagem) => Contagem) => setC((x) => f({ ...x, naoVeio: false }));
  const plural = unPlural(p.unidade).toLowerCase();
  return (
    <Sheet title={nomeProdutoFunc(p)} onClose={onClose}>
      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-3">
        {p.codigo && <p className="-mt-2 text-xs text-muted-foreground">Cód. {p.codigo}</p>}
        {recontagem && <p className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">Conte de novo, com calma, tudo o que chegou deste produto.</p>}
        {temPedido && !noPedido && <p className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">Este produto <b>não está no pedido</b>. Conte e deixe separado: o dono vai decidir.</p>}

        <section aria-label="Quanto chegou" className="space-y-3 rounded-2xl border border-border p-3">
          <p className="text-base font-bold">Quanto chegou?</p>
          {p.embalagens.map((e) => (
            <Contador key={e.id} rotulo={`${e.tipo}s com ${fmtQ(e.quantidade)}`}
              valor={c.fechadas[e.id] ?? ""} onMudar={(v) => mudar((x) => ({ ...x, fechadas: { ...x.fechadas, [e.id]: v } }))} />
          ))}
          <Contador rotulo={p.embalagens.length ? `Sem embalagem (${plural})` : `Quantidade (${plural})`} valor={c.soltas} fracao={fracao}
            onMudar={(v) => mudar((x) => ({ ...x, soltas: v }))} />
          {total != null && !c.naoVeio && <p className="text-right text-base font-bold">= {qtdUn(total, p.unidade)}</p>}
        </section>

        <section aria-label="Quebrados ou vencidos" className="space-y-2">
          <label className="flex min-h-12 items-center gap-3 text-base">
            <input type="checkbox" checked={c.temAvaria} onChange={(e) => mudar((x) => ({ ...x, temAvaria: e.target.checked }))} className="h-6 w-6 accent-primary" />
            Veio quebrado ou vencido
          </label>
          {c.temAvaria && <Contador rotulo={`Quantos (${plural})`} valor={c.avaria} fracao={fracao} onMudar={(v) => mudar((x) => ({ ...x, avaria: v }))} />}
          {c.temAvaria && <p className="text-xs text-muted-foreground">Conte junto no total acima. Estes não entram no estoque; deixe separados para devolver.</p>}
        </section>

        {p.controlaValidade && (
          <section aria-label="Validade" className="space-y-2 rounded-2xl border border-border p-3">
            <p className="text-base font-bold">Validade{p.pedeLote ? " e lote" : ""}</p>
            {c.partes.map((pt, i) => (
              <div key={i} className="space-y-2 rounded-xl bg-background-deep/40 p-2">
                {c.partes.length > 1 && (
                  <input aria-label={`Quantos com esta validade (${i + 1})`} inputMode="numeric" value={pt.quantidade} placeholder={`Quantos (${plural})`}
                    onChange={(e) => mudar((x) => ({ ...x, partes: x.partes.map((y, j) => (j === i ? { ...y, quantidade: e.target.value.replace(/[^\d,]/g, "") } : y)) }))}
                    className="h-12 w-full rounded-xl border border-border bg-background-deep/60 px-3 text-base text-foreground outline-none" />
                )}
                <input type="date" aria-label={`Validade ${i + 1}`} value={pt.vencimento}
                  onChange={(e) => mudar((x) => ({ ...x, partes: x.partes.map((y, j) => (j === i ? { ...y, vencimento: e.target.value } : y)) }))}
                  className="h-12 w-full rounded-xl border border-border bg-background-deep/60 px-3 text-base text-foreground outline-none [color-scheme:dark]" />
                {p.pedeLote && (
                  <input aria-label={`Lote ${i + 1}`} value={pt.lote} maxLength={40} placeholder="Lote (ex.: AB123)" autoCapitalize="characters"
                    onChange={(e) => mudar((x) => ({ ...x, partes: x.partes.map((y, j) => (j === i ? { ...y, lote: e.target.value } : y)) }))}
                    className="h-12 w-full rounded-xl border border-border bg-background-deep/60 px-3 text-base text-foreground outline-none" />
                )}
              </div>
            ))}
            <button type="button" onClick={() => mudar((x) => ({ ...x, partes: [...x.partes, { quantidade: "", vencimento: "", lote: "" }] }))} className="min-h-11 text-sm font-semibold text-primary">
              + Tem outra validade
            </button>
          </section>
        )}
        {erro && !c.naoVeio && total != null && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
      </div>
      <div className="space-y-2 px-5 pt-2">
        <button type="button" disabled={!!erro} onClick={() => onSalvar(c)} className={`flex items-center justify-center gap-2 ${btnPrimary(!erro)}`}><Check size={20} /> Salvar contagem</button>
        {temPedido && noPedido && (
          <button type="button" onClick={() => onSalvar({ ...c, naoVeio: true })} className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}><PackageX size={18} /> Não veio</button>
        )}
        {onTirar && <button type="button" onClick={onTirar} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Bipei errado: tirar da lista</button>}
      </div>
    </Sheet>
  );
}
