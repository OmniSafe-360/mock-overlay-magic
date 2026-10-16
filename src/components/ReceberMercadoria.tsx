import { Contador } from "@/components/parts/Contador";
import { useHoje } from "@/hooks/useHoje";
/* Receber mercadoria no app do funcionário (E2). Conferência cega: o funcionário bipa e conta o que chegou, sem nunca ver
 * quanto foi pedido. Ao enviar as contagens, o servidor compara e pede para contar de novo o que não bateu. */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Camera, Check, CheckCircle2, Keyboard, Minus, PackageCheck, PackageX, Plus, RefreshCw, Search, Truck } from "lucide-react";
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
  totalDaContagem, estadoRecebido, textoEstado, type Contagem, type EstadoItem, type ProdutoFunc, type Rascunho,
  ERRO_GUARDAR_RASCUNHO, ERRO_LER_RASCUNHO, ERRO_RASCUNHO_ILEGIVEL, textoMotivo, type MotivoInfo,
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
  ["rascunho_atualizado", "Esta contagem mudou em outra tela. Volte às entregas e abra novamente."],
  ["envio_sem_confirmacao", "Há um envio sem confirmação. Continue a contagem e confirme o envio anterior antes de descartar."],
  ["contagem_ja_enviada", "Esta entrega já tem contagens enviadas. Continue para conferir o resultado; ela não pode ser descartada aqui."],
  ["rascunho_de_outra_entrega", "Este rascunho pertence a outra entrega. Volte às entregas e escolha o fornecedor da contagem anterior."],
];
const erroTexto = (e: unknown) => {
  const m = String((e as { message?: string } | null)?.message ?? e ?? "");
  if ([ERRO_GUARDAR_RASCUNHO, ERRO_LER_RASCUNHO, ERRO_RASCUNHO_ILEGIVEL, ERRO_REGISTRO].includes(m)) return m;
  return MSG_RECEBER.find(([k]) => m.includes(k))?.[1] ?? mensagemErro(e).replace("Seus dados continuam no formulário. ", "").replace("Não foi possível salvar agora. ", "Não foi possível enviar agora. ");
};

type Tela =
  | { t: "lista" }
  | { t: "retomar"; aberto: banco.RecebimentoAberto; kr: string; fornecedorId: string | null; rascunho: Rascunho; pendente: boolean }
  | { t: "contando"; aberto: banco.RecebimentoAberto; kr: string; fornecedorId: string | null }
  | { t: "pronto"; avisos: boolean; produtos: number };

type PedidoEnvio = { rodada: number; itens: ReturnType<typeof itemParaEnvio>[]; chaves: string[] };
const validarEnvio = (p: unknown): p is PedidoEnvio => {
  const x = p as PedidoEnvio | null;
  return !!x && Number.isInteger(x.rodada) && x.rodada >= 0 && Array.isArray(x.itens) && Array.isArray(x.chaves)
    && x.itens.length === x.chaves.length && x.itens.every((i) => typeof i.produto_id === "string" && Number.isFinite(i.total));
};
const temEnvioPendente = (kr: string, id: string) => !!operacaoLocal(kr, `receber:${id}`, validarEnvio).pendente();

/** M18: grupos da lista de contagem, na ordem em que a pessoa trabalha. */
const GRUPOS_LISTA: { id: string; titulo: string; nota?: string; estados: EstadoItem[] }[] = [
  { id: "contar", titulo: "Para contar", estados: ["recontar", "falta"] },
  { id: "pronto", titulo: "Pronto para enviar", nota: "Ainda não foi enviado: use o botão no fim da tela.", estados: ["contado"] },
  { id: "enviado", titulo: "Já enviado", nota: "O que for aceito só entra no depósito quando a entrega for concluída.", estados: ["aguardando_dono", "enviado", "recusado", "conferido"] },
];

export function ReceberMercadoria({ chave, onVoltar, api: apiDada, mercado = false }: { chave: string; onVoltar: () => void; api?: ApiReceber | undefined; mercado?: boolean }) {
  return <ReceberPorAcesso key={chave} mercado={mercado} chave={chave} onVoltar={onVoltar} apiDada={apiDada} />;
}

function ReceberPorAcesso({ chave, onVoltar, apiDada, mercado }: { chave: string; onVoltar: () => void; apiDada?: ApiReceber | undefined; mercado: boolean }) {
  const api = apiDada ?? API_PADRAO;
  const [tela, setTela] = useState<Tela>({ t: "lista" });
  const [erro, setErro] = useState("");
  const [descartando, setDescartando] = useState(false);
  const abrirNovaSemPedido = async (kr: string, fornecedorId: string | null) => {
    const rascunho: Rascunho = { id: newUid(), pedidoId: null, fornecedorId, contagens: {}, estados: {}, rodada: 0 };
    // A abertura também pode perder a resposta: conserve o id para retomar a mesma entrega.
    guardarRascunho(kr, rascunho);
    if (lerRascunho(kr)?.id !== rascunho.id) throw new Error(ERRO_REGISTRO);
    setTela({ t: "lista" });
    const aberto = await api.abrir(chave, rascunho.id, null, fornecedorId);
    setTela({ t: "contando", aberto, kr, fornecedorId });
  };
  const abrir = async (pedidoId: string | null, fornecedorId: string | null) => {
    setErro("");
    try {
      const escopo = await escopoAcesso(chave);
      let kr = chaveRascunho(pedidoId, escopo, fornecedorId);
      let rasc = lerRascunho(kr);
      if (!pedidoId && !rasc) {
        const antiga = chaveRascunho(null, escopo);
        const anterior = lerRascunho(antiga);
        // Não mova a chave antiga: um envio sem resposta pode estar guardado nela.
        if (anterior?.pedidoId === null && anterior.fornecedorId === fornecedorId) { kr = antiga; rasc = anterior; }
      }
      if (rasc && (rasc.pedidoId !== pedidoId || (!pedidoId && rasc.fornecedorId !== fornecedorId)))
        throw new Error("rascunho_de_outra_entrega");
      if (!pedidoId && !rasc) { await abrirNovaSemPedido(kr, fornecedorId); return; }
      const aberto = await api.abrir(chave, rasc?.id ?? newUid(), pedidoId, fornecedorId);
      if (!pedidoId && rasc) {
        const pendente = temEnvioPendente(kr, rasc.id);
        if (aberto.situacao === "concluido" && !pendente) {
          await abrirNovaSemPedido(kr, fornecedorId); return;
        }
        setTela({ t: "retomar", aberto, kr, fornecedorId, rascunho: rasc, pendente });
      } else setTela({ t: "contando", aberto, kr, fornecedorId });
    } catch (e) { setErro(erroTexto(e)); }
  };
  const descartar = async () => {
    if (tela.t !== "retomar" || descartando) return;
    setDescartando(true); setErro("");
    try {
      const confereRascunho = () => {
        if (JSON.stringify(lerRascunho(tela.kr)) !== JSON.stringify(tela.rascunho))
          throw new Error("rascunho_atualizado");
        if (temEnvioPendente(tela.kr, tela.aberto.id))
          throw new Error("envio_sem_confirmacao");
      };
      confereRascunho();
      const atual = await api.abrir(chave, tela.aberto.id, null, tela.fornecedorId);
      if (atual.situacao !== "contando" || atual.rodada !== 0 || atual.itens.length)
        throw new Error("contagem_ja_enviada");
      confereRascunho();
      await abrirNovaSemPedido(tela.kr, tela.fornecedorId);
    } catch (e) { setErro(erroTexto(e)); }
    finally { setDescartando(false); }
  };
  if (tela.t === "retomar") {
    const podeDescartar = !tela.pendente && tela.aberto.situacao === "contando" && tela.aberto.rodada === 0 && !tela.aberto.itens.length;
    return <div className="space-y-4">
      <h1 className="text-2xl font-bold">Receber mercadoria</h1>
      <Sheet title="Contagem em andamento" onClose={() => { if (!descartando) { setErro(""); setTela({ t: "lista" }); } }}>
        <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
          <p className="break-words text-base font-semibold">{tela.aberto.fornecedor ?? "Fornecedor não informado"}</p>
          <p className="text-sm">Você começou uma entrega sem pedido deste fornecedor.</p>
          <p className="text-sm text-muted-foreground">{podeDescartar
            ? "Continue de onde parou ou descarte as contagens ainda não enviadas e comece outra entrega. Descartar não altera o estoque."
            : tela.pendente ? "Há um envio sem resposta. Continue para confirmar o envio anterior, sem duplicar."
              : "Esta entrega já tem contagens enviadas. Continue para conferir o resultado."}</p>
          {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
          <button type="button" disabled={descartando} className={btnPrimary(true)} onClick={() => { setErro(""); setTela({ t: "contando", aberto: tela.aberto, kr: tela.kr, fornecedorId: tela.fornecedorId }); }}>Continuar contagem</button>
          {podeDescartar && <button type="button" disabled={descartando} className={btnGhost} onClick={() => void descartar()}>{descartando ? "Abrindo nova entrega…" : "Descartar contagem e começar outra"}</button>}
        </div>
      </Sheet>
    </div>;
  }
  if (tela.t === "contando")
    return <Contando mercado={mercado} chave={chave} api={api} aberto={tela.aberto} kr={tela.kr} fornecedorId={tela.fornecedorId} onSair={() => setTela({ t: "lista" })} onPronto={(avisos, produtos) => setTela({ t: "pronto", avisos, produtos })} />;
  if (tela.t === "pronto")
    return (
      <div className="m-auto flex w-full flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/15 text-accent"><CheckCircle2 size={44} /></span>
        <p className="text-2xl font-bold">Pronto!</p>
        <p className="text-base">Recebimento concluído. Somente as quantidades boas e aceitas foram registradas no depósito.</p>
        {tela.avisos && <p className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">Há diferenças para o dono conferir. Produtos aguardando decisão, fora do pedido, quebrados ou vencidos devem ficar separados.</p>}
        <button type="button" onClick={onVoltar} className={btnPrimary(true)}>Voltar ao início</button>
      </div>
    );
  return <ListaEntregas chave={chave} api={api} erroAbrir={erro} ocupado={descartando} onVoltar={onVoltar} onAbrir={abrir} />;
}

/* ---------- lista de entregas ---------- */
function ListaEntregas({ chave, api, erroAbrir, ocupado, onVoltar, onAbrir }: {
  chave: string; api: ApiReceber; erroAbrir: string; ocupado: boolean; onVoltar: () => void; onAbrir: (pedidoId: string | null, fornecedorId: string | null) => Promise<void>;
}) {
  const [dados, setDados] = useState<Awaited<ReturnType<ApiReceber["entregas"]>> | null>(null);
  const [erro, setErro] = useState("");
  const [semPedido, setSemPedido] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const bloqueado = ocupado || !!abrindo;
  const [atualizando, setAtualizando] = useState(false);
  const carregar = useRef<() => void>(() => {});
  useEffect(() => {
    let ativo = true;
    let emCurso = false;
    const buscar = async () => {
      if (!ativo || emCurso) return;
      emCurso = true;
      setAtualizando(true); setErro("");
      try {
        const d = await api.entregas(chave);
        if (ativo) setDados(d);
      } catch (e) { if (ativo) setErro(erroTexto(e)); }
      finally { emCurso = false; if (ativo) setAtualizando(false); }
    };
    carregar.current = () => { void buscar(); };
    const atualizar = () => {
      if (document.visibilityState !== "hidden" && navigator.onLine !== false) void buscar();
    };
    void buscar();
    const timer = window.setInterval(atualizar, 30_000);
    document.addEventListener("visibilitychange", atualizar);
    window.addEventListener("focus", atualizar);
    window.addEventListener("online", atualizar);
    return () => {
      ativo = false; carregar.current = () => {};
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", atualizar);
      window.removeEventListener("focus", atualizar);
      window.removeEventListener("online", atualizar);
    };
  }, [api, chave]);
  const hoje = useHoje();
  const ir = (pedidoId: string | null, fornecedorId: string | null) => { setAbrindo(pedidoId ?? "sem"); void onAbrir(pedidoId, fornecedorId).finally(() => setAbrindo(null)); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onVoltar} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Início</button>
        <button type="button" disabled={atualizando || bloqueado} onClick={() => carregar.current()} aria-label="Atualizar entregas"
          className="flex min-h-12 items-center gap-2 rounded-2xl border border-border px-3 text-sm font-semibold text-primary disabled:opacity-60">
          <RefreshCw size={18} className={atualizando ? "animate-spin" : ""} /> {atualizando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Receber mercadoria</h1>
        <p className="text-sm text-muted-foreground">Escolha a entrega que chegou. Você vai bipar e contar cada produto.</p>
      </div>
      {(erro || erroAbrir) && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro || erroAbrir}</p>}
      {!dados && !erro && <p className="py-8 text-center text-muted-foreground">Carregando entregas…</p>}
      {dados && !dados.pedidos.length && !erro && <div className="space-y-2 rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        <p>Nenhuma entrega esperada agora.</p>
        <p>Os pedidos aparecem aqui depois de enviados ao fornecedor pelo dono, neste comércio.</p>
      </div>}
      <ul className="space-y-3">
        {dados?.pedidos.map((p) => (
          <li key={p.id}>
            <button type="button" disabled={bloqueado} onClick={() => ir(p.id, null)}
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
      <button type="button" disabled={bloqueado} onClick={() => setSemPedido(true)} className={`flex w-full items-center justify-center gap-2 ${btnGhost}`}><PackageCheck size={18} /> Chegou sem pedido</button>
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
    let r: Rascunho | null = null;
    let erroLeitura = "";
    try { r = lerRascunho(kr); } catch (e) { erroLeitura = erroTexto(e); }
    const mesmo = r && r.id === aberto.id && r.rodada === aberto.rodada ? r : null;
    // B8: outro celular enviou esta entrega antes. Guarda o que este celular contou e o servidor ainda não recebeu.
    const outraRodada = r && r.id === aberto.id && r.rodada !== aberto.rodada ? r : null;
    const jaNoServidor = new Set(aberto.itens.map((i) => chaveProduto(i)));
    const mantidas = outraRodada ? Object.fromEntries(Object.entries(outraRodada.contagens).filter(([k]) => !jaNoServidor.has(k))) : {};
    const perdidas = outraRodada ? Object.keys(outraRodada.contagens).length - Object.keys(mantidas).length : 0;
    const avisoOutro = outraRodada ? `Outra pessoa enviou contagens desta entrega enquanto você contava. ${Object.keys(mantidas).length ? "Guardamos o que só você contou." : ""}${perdidas ? ` ${perdidas === 1 ? "1 produto já tinha" : `${perdidas} produtos já tinham`} contagem dela e ${perdidas === 1 ? "segue" : "seguem"} a situação da lista.` : ""}`.trim() : "";
    const estados: Record<string, EstadoItem> = {};
    const contagens: Record<string, Contagem> = { ...(mesmo?.contagens ?? mantidas) };
    for (const p of aberto.produtos) estados[chaveProduto(p)] = "falta";
    for (const [k, c] of Object.entries(contagens)) if (!(k in estados) || estados[k] === "falta") estados[k] = erroContagem(c) ? "falta" : "contado";
    for (const i of aberto.itens) {
      const k = chaveProduto(i);
      estados[k] = estadoRecebido(i.situacao);
      if (i.situacao === "recontar" && contagens[k] && mesmo?.estados[k] !== "contado") delete contagens[k];
      if (i.situacao === "recontar" && mesmo?.estados[k] === "contado" && contagens[k]) estados[k] = "contado";
    }
    const motivos: Record<string, MotivoInfo> = {};
    for (const [k, m] of Object.entries(mesmo?.motivos ?? {})) if (estados[k] === "recontar" && m.motivo) motivos[k] = m;
    return { estados, contagens, rodada: aberto.rodada, erroLeitura, motivos, avisoOutro };
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
  const [motivos, setMotivos] = useState<Record<string, MotivoInfo>>(inicial.motivos);
  const [recontagens, setRecontagens] = useState(() => new Set(aberto.itens.filter((i) => i.situacao === "recontar").map(chaveProduto)));
  const [aberta, setAberta] = useState<string | null>(null);
  /* M18: ao salvar, o produto muda de grupo e o botão é recriado; o foco volta para ele no grupo novo. */
  const focarProduto = useRef<string | null>(null);
  useEffect(() => {
    const k = focarProduto.current;
    if (!k || aberta) return;
    focarProduto.current = null;
    Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-chave]")).find((b) => b.dataset["chave"] === k)?.focus();
  });
  const [scan, setScan] = useState(false);
  const [busca, setBusca] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroRascunho, setErroRascunho] = useState(inicial.erroLeitura);
  const [registro] = useState(() => {
    try { return operacaoLocal(kr, `receber:${aberto.id}`, validarEnvio); } catch { return null; }
  });
  const envioPendente = !!registro?.pendente();
  const noPedido = useMemo(() => new Set(aberto.produtos.map(chaveProduto)), [aberto.produtos]);

  const tentarGuardar = () => {
    try {
      // Se a leitura inicial falhou, reabra a entrega antes de substituir dados que não foram vistos.
      if (inicial.erroLeitura) throw new Error(inicial.erroLeitura);
      const atual = lerRascunho(kr);
      // Uma tela antiga não pode recriar o rascunho descartado nem substituir a entrega nova.
      if (!aberto.pedidoId && atual?.id !== aberto.id) throw new Error("rascunho_atualizado");
      guardarRascunho(kr, { id: aberto.id, pedidoId: aberto.pedidoId, fornecedorId, contagens, estados, rodada, ...(Object.keys(motivos).length ? { motivos } : {}) });
      setErroRascunho("");
    } catch (e) {
      const mensagem = erroTexto(e);
      setErroRascunho([ERRO_LER_RASCUNHO, ERRO_RASCUNHO_ILEGIVEL].includes(mensagem)
        ? `${ERRO_GUARDAR_RASCUNHO} ${mensagem}` : mensagem);
    }
  };
  useEffect(() => {
    tentarGuardar();
  }, [kr, aberto.id, aberto.pedidoId, fornecedorId, contagens, estados, rodada, motivos]);

  const chaves = Object.keys(produtos);
  const ordem = (k: string) => ({ recontar: 0, falta: 1, contado: 2, aguardando_dono: 3, enviado: 4, recusado: 5, conferido: 6 })[estados[k] ?? "falta"];
  const lista = [...chaves].sort((a, b) => ordem(a) - ordem(b));
  const contados = chaves.filter((k) => estados[k] === "contado");
  const pendentes = chaves.filter((k) => estados[k] === "recontar" || (estados[k] === "falta" && noPedido.has(k)));
  const podeTerminar = !!registro && (envioPendente || (!inicial.erroLeitura && contados.length > 0 && !chaves.some((k) => estados[k] === "recontar"))) && !enviando;
  const paraRecontar = chaves.filter((k) => estados[k] === "recontar");
  const faltam = chaves.filter((k) => estados[k] === "falta" && noPedido.has(k));
  const orientacao = [
    paraRecontar.length ? `Conte de novo ${paraRecontar.length === 1 ? "1 produto" : `${paraRecontar.length} produtos`} em amarelo, com calma.` : "",
    faltam.length ? `Ainda falta contar: ${faltam.map((k) => nomeProdutoFunc(produtos[k]!)).join(", ")}. Se não veio, abra e toque em "Não veio".` : "",
  ].filter(Boolean).join(" ");
  const envioTexto = envioPendente ? "Confirmar envio anterior" : pendentes.length ? "Enviar contagens" : "Conferir e concluir entrega";
  const encerrado = (e: EstadoItem | undefined) => !!e && !["falta", "contado", "recontar"].includes(e);
  const explicar = (p: ProdutoFunc, e: EstadoItem) => setAviso(e === "conferido"
    ? `${nomeProdutoFunc(p)} já foi conferido. A entrega ainda não terminou e esta quantidade ainda não entrou no depósito.`
    : `${nomeProdutoFunc(p)}: ${textoEstado[e]}.`);

  const escolher = (p: ProdutoFunc) => {
    const k = chaveProduto(p);
    setProdutos((m) => ({ ...m, [k]: m[k] ?? p }));
    setEstados((m) => ({ ...m, [k]: m[k] ?? "falta" }));
    if (encerrado(estados[k])) { explicar(p, estados[k]!); return; }
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
      if (!aberto.pedidoId && lerRascunho(kr)?.id !== aberto.id) throw new Error("rascunho_atualizado");
      const confirmado = await registro.enviar(() => ({ rodada, itens: contados.map((k) => itemParaEnvio(contagens[k]!)), chaves: contados }),
        (p) => api.enviar(chave, aberto.id, p.rodada, p.itens));
      const r = confirmado.resultado;
      if (r.situacao === "concluido") { apagarRascunho(kr); onPronto(r.avisos, r.produtos); return; }
      const recontar = new Set(r.recontar.map(chaveProduto));
      // Respostas antigas não incluem os estados. Consulte a entrega, sem inferir aceite.
      let itens = r.itens;
      if (!itens && confirmado.pedido.chaves.some((k) => !recontar.has(k))) {
        try { itens = (await api.abrir(chave, aberto.id, aberto.pedidoId, fornecedorId)).itens; }
        catch { /* envio já confirmado: não repetir nem declarar aceite sem resposta */ }
      }
      const recebidos = new Map(itens?.map((i) => [chaveProduto(i), estadoRecebido(i.situacao)]));
      setEstados((m) => {
        const n = { ...m };
        for (const k of confirmado.pedido.chaves) n[k] = recebidos.get(k) ?? (recontar.has(k) ? "recontar" : "enviado");
        for (const k of recontar) n[k] = "recontar";
        return n;
      });
      setRecontagens(recontar);
      setMotivos(() => { const n: Record<string, MotivoInfo> = {}; for (const x of r.recontar) if (x.motivo) n[chaveProduto(x)] = { motivo: x.motivo, ...(x.lote ? { lote: x.lote } : {}), ...(x.loteData ? { loteData: x.loteData } : {}) }; return n; });
      // Recontagem cega: a contagem anterior some da tela.
      setContagens((m) => { const n = { ...m }; for (const k of recontar) delete n[k]; return n; });
      setRodada(r.rodada);
      setAviso("");
    } catch (e) { setErro(erroTexto(e)); }
    finally { setEnviando(false); }
  };

  const sel = aberta ? produtos[aberta] : undefined;
  return (
    <div className="space-y-4 pb-28">
      {!registro && <p role="alert" className="text-sm text-destructive">{ERRO_REGISTRO}</p>}
      {inicial.avisoOutro && <p role="status" className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">{inicial.avisoOutro}</p>}
      {erroRascunho && erroRascunho !== erro && <div role="alert" aria-label="Contagem não guardada" className="space-y-2 rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">
        <p>{erroRascunho}</p>
        {erroRascunho === ERRO_GUARDAR_RASCUNHO && <button type="button" onClick={tentarGuardar} className="min-h-11 font-semibold text-primary">Tentar guardar de novo</button>}
      </div>}
      {envioPendente && <p role="status" className="rounded-2xl border border-warning/50 p-3 text-sm">Contagem enviada sem confirmação. Toque em Confirmar envio anterior para repetir os dados originais, sem duplicar.</p>}
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
      {orientacao && <p role="status" className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">{orientacao}</p>}

      {/* M18: a mesma lista, separada pelos estados que já existem (sem conta nova). */}
      {GRUPOS_LISTA.map((g) => {
        const doGrupo = lista.filter((k) => g.estados.includes(estados[k] ?? "falta"));
        if (!doGrupo.length) return null;
        return (
      <section key={g.id} aria-label={g.titulo} className="space-y-2">
        <h2 className="flex items-baseline justify-between gap-2 text-sm font-semibold text-muted-foreground"><span>{g.titulo}</span><span className="tabular-nums">{doGrupo.length}</span></h2>
        {g.nota && <p className="-mt-1 text-xs text-muted-foreground">{g.nota}</p>}
      <ul className="space-y-2">
        {doGrupo.map((k) => {
          const p = produtos[k]!;
          const e = estados[k] ?? "falta";
          const c = contagens[k];
          const fora = !!aberto.pedidoId && !noPedido.has(k);
          return (
            <li key={k}>
              <button type="button" data-chave={k} onClick={() => (encerrado(e) ? explicar(p, e) : (setContagens((m) => ({ ...m, [k]: m[k] ?? novaContagem(p) })), setAberta(k)))}
                aria-label={`${nomeProdutoFunc(p)}: ${e === "contado" ? "contado" : textoEstado[e].toLowerCase()}`}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${e === "recontar" || e === "aguardando_dono" ? "border-warning bg-warning/10" : e === "conferido" ? "border-accent/50 bg-accent/5" : e === "contado" ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/50"}`}>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-base font-semibold leading-snug">{nomeProdutoFunc(p)}</span>
                  <span className={`block text-sm ${e === "recontar" || e === "aguardando_dono" ? "font-semibold text-warning" : e === "conferido" ? "text-accent" : "text-muted-foreground"}`}>
                    {e === "contado" ? `${recontagens.has(k) ? "Nova contagem pronta para enviar" : textoEstado[e]}${c ? ` · ${resumoContagem(c)}` : ""}` : textoEstado[e]}
                  </span>
                  {e === "recontar" && textoMotivo(motivos[k]) && <span className="mt-1 block text-sm leading-snug text-foreground">{textoMotivo(motivos[k])}</span>}
                  {fora && e !== "conferido" && <span className="block text-xs font-semibold text-warning">Não está no pedido — deixe separado</span>}
                </span>
                {e === "conferido" ? <Check size={22} className="shrink-0 text-accent" /> : e === "recontar" || e === "aguardando_dono" ? <AlertTriangle size={22} className="shrink-0 text-warning" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      </section>
        );
      })}
      {!lista.length && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Bipe o primeiro produto para começar.</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background-deep/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-[480px] space-y-1">
          {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
          <button type="button" disabled={!podeTerminar} onClick={() => void terminar()} className={`flex items-center justify-center gap-2 ${btnPrimary(podeTerminar)}`}>
            <PackageCheck size={20} /> {enviando ? "Conferindo…" : envioTexto}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            {paraRecontar.length ? "Conte de novo os produtos em amarelo." : pendentes.length ? `${pendentes.length === 1 ? "Falta 1 produto" : `Faltam ${pendentes.length} produtos`} do pedido. Enviar contagens ainda não conclui a entrega.` : contados.length ? "Tudo contado? Envie para conferir e concluir a entrega." : "Bipe e conte os produtos."}
          </p>
        </div>
      </div>

      {scan && <Scanner mercado={mercado} onClose={() => setScan(false)} onType={() => { setScan(false); setBusca(true); }} onDenied={() => { setScan(false); setBusca(true); }}
        onCode={(c) => { setScan(false); void lerCodigo(c); }} />}
      {busca && <BuscarProduto chave={chave} api={api} onClose={() => setBusca(false)} onEscolher={(p) => { setBusca(false); escolher(p); }} />}
      {sel && aberta && contagens[aberta] && (
        <ContarProduto c={contagens[aberta]!} recontagem={estados[aberta] === "recontar"} motivo={estados[aberta] === "recontar" ? textoMotivo(motivos[aberta]) : ""} noPedido={!aberto.pedidoId || noPedido.has(aberta)} temPedido={!!aberto.pedidoId}
          erroRascunho={erroRascunho}
          onClose={() => setAberta(null)}
          onSalvar={(c) => { focarProduto.current = aberta; setContagens((m) => ({ ...m, [aberta]: c })); setEstados((m) => ({ ...m, [aberta]: "contado" })); setAviso(""); setAberta(null); }}
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
function ContarProduto({ c: inicial, recontagem, motivo, noPedido, temPedido, erroRascunho, onClose, onSalvar, onTirar }: {
  c: Contagem; recontagem: boolean; motivo: string; noPedido: boolean; temPedido: boolean; onClose: () => void; onSalvar: (c: Contagem) => void; onTirar?: (() => void) | undefined;
  erroRascunho: string;
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
        {erroRascunho && <p role="alert" className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">{erroRascunho}</p>}
        {p.codigo && <p className="-mt-2 text-xs text-muted-foreground">Cód. {p.codigo}</p>}
        {recontagem && <p className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">{motivo || "Conte de novo, com calma, tudo o que chegou deste produto."}</p>}
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
