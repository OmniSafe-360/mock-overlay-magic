/* Fiado no app do dono (C4): quem deve, quanto e desde quando; "Recebeu" para dar baixa; cobrar pelo WhatsApp.
 * As compras no fiado vêm do caixa do celular; pagamento e venda cancelada descontam da conta. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookUser, ChevronRight, HandCoins, MessageCircle, Pencil, Search } from "lucide-react";
import { Sheet } from "@/components/parts/Sheet";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import { centavosDigitados, mascaraDinheiro } from "@/lib/caixa";
import { newUid } from "@/lib/deposito";
import {
  DIAS_ANTIGO, FORMA_FIADO, buscarConta, contasFiado, haQuantoTempo, linkWhats, mensagemCobranca, resumoFiado, textoMovimento,
  type ClienteFiado, type ContaFiado, type MovimentoFiado,
} from "@/lib/fiado";
import { digits, formatarCentavos as brl, maskPhone } from "@/lib/formatacao";
import { mensagemErro } from "@/lib/persistencia";

export type ApiFiado = {
  carregar: (comercioId: string) => Promise<{ clientes: ClienteFiado[]; movimentos: MovimentoFiado[] }>;
  receber: (id: string, clienteId: string, valorCentavos: number, forma: "dinheiro" | "pix" | "cartao", observacao: string) => Promise<unknown>;
  salvarCliente: (id: string, comercioId: string, nome: string, telefone: string | null) => Promise<unknown>;
};
/** F8: limite do fiado e bloqueio do cliente (só o dono). */
function LimiteFiado({ cliente, onSalvo }: { cliente: { id: string; limite?: number | null | undefined; bloqueado?: boolean | undefined }; onSalvo: () => void }) {
  const [limite, setLimite] = useState(cliente.limite != null ? (cliente.limite / 100).toFixed(2).replace(".", ",") : "");
  const [bloq, setBloq] = useState(!!cliente.bloqueado);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const salvar = async () => {
    const t = limite.trim();
    const cent = t ? Math.round(Number(t.replace(/\./g, "").replace(",", ".")) * 100) : null;
    if (cent != null && (!Number.isFinite(cent) || cent < 0)) { setMsg("Confira o valor do limite."); return; }
    setSalvando(true); setMsg("");
    try { await banco.definirLimiteFiado(cliente.id, cent, bloq); cliente.limite = cent; cliente.bloqueado = bloq; onSalvo(); }
    catch { setMsg("Não foi possível salvar agora. Confira a internet e tente de novo."); }
    finally { setSalvando(false); }
  };
  return (
    <div className="mt-2 space-y-2 rounded-2xl border border-border p-3 text-sm">
      <p className="font-semibold">Limite do fiado</p>
      <input value={limite} onChange={(e) => setLimite(e.target.value.replace(/[^0-9,.]/g, ""))} inputMode="decimal" placeholder="Sem limite" aria-label="Limite do fiado"
        className="h-11 w-full rounded-xl border border-border bg-background-deep/60 px-3 text-base text-foreground outline-none focus-visible:border-primary" />
      <label className="flex items-center gap-2"><input type="checkbox" checked={bloq} onChange={(e) => setBloq(e.target.checked)} /> Bloquear: não vender mais fiado para este cliente</label>
      {msg && <p role="alert" className="text-destructive">{msg}</p>}
      <button type="button" disabled={salvando} onClick={() => void salvar()} className="h-11 w-full rounded-xl border border-primary/60 font-semibold text-primary disabled:opacity-50">{salvando ? "Salvando…" : "Salvar limite"}</button>
      <p className="text-xs text-muted-foreground">Vazio = sem limite. O caixa não deixa vender fiado acima do limite. Pagamentos continuam aceitos.</p>
    </div>
  );
}

const API_PADRAO: ApiFiado = { carregar: banco.carregarFiado, receber: banco.receberFiado, salvarCliente: banco.salvarClienteFiado };
const erroTexto = (e: unknown) => {
  const m = String((e as { message?: string } | null)?.message ?? e ?? "");
  if (m.includes("valor_maior_que_a_conta")) return "O valor é maior do que o cliente deve.";
  if (m.includes("telefone_cliente_invalido")) return "Telefone inválido: use DDD + número.";
  if (m.includes("nome_cliente_invalido")) return "Escreva o nome do cliente (pelo menos 2 letras).";
  return mensagemErro(e).replace("Seus dados continuam no formulário. ", "");
};
const dataTxt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

/** Quadro do fiado na aba Vendas. Sem clientes, só aparece enquanto consulta ou se a leitura falhar.
 * `atualizadoEm` muda a cada atualização da aba Vendas (sozinha, botão, venda cancelada): o fiado lê de novo junto. */
type PropsFiado = {
  comercioId: string; comercioNome: string; api?: ApiFiado; agora?: number; atualizadoEm?: number | undefined;
};
export function PainelFiado(props: PropsFiado) {
  // Trocar comércio descarta a leitura e o formulário anteriores antes de renderizar a nova conta.
  return <FiadoDoComercio key={props.comercioId} {...props} />;
}
function FiadoDoComercio({ comercioId, comercioNome, api = API_PADRAO, agora = Date.now(), atualizadoEm }: PropsFiado) {
  const [dados, setDados] = useState<{ clientes: ClienteFiado[]; movimentos: MovimentoFiado[] } | null>(null);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState(false);
  const [consultando, setConsultando] = useState(true);
  const consulta = useRef(0);
  const recarregar = useCallback(async () => {
    const atual = ++consulta.current;
    setConsultando(true);
    try {
      const novos = await api.carregar(comercioId);
      if (atual !== consulta.current) return;
      setDados(novos); setErro(false);
    } catch {
      if (atual === consulta.current) setErro(true);
    } finally {
      if (atual === consulta.current) setConsultando(false);
    }
  }, [api, comercioId]);
  useEffect(() => {
    void recarregar();
    return () => { consulta.current++; };
  }, [recarregar, atualizadoEm]);
  const contas = useMemo(() => (dados ? contasFiado(dados.clientes, dados.movimentos) : []), [dados]);
  const r = resumoFiado(contas, agora);
  if (dados && !dados.clientes.length && !erro) return null;
  const aviso = <AvisoConsultaFiado erro={erro} consultando={consultando} temDados={!!dados} onTentar={recarregar} />;
  return (
    <section aria-label="Fiado" className="space-y-2">
      {!aberto && aviso}
      {!!dados?.clientes.length && <button type="button" onClick={() => setAberto(true)}
        className={`flex w-full items-center gap-3 rounded-3xl border p-4 text-left transition hover:border-primary ${r.antigos ? "border-warning/60 bg-warning/10" : "border-border bg-secondary/50"}`}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><BookUser size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-muted-foreground">Fiado · a receber</span>
          <span className="block text-2xl font-bold tabular-nums">{brl(r.total)}</span>
          <span className="block text-xs text-muted-foreground">
            {r.clientes === 0 ? "Ninguém devendo" : r.clientes === 1 ? "1 cliente deve" : `${r.clientes} clientes devem`}
            {r.antigos > 0 && <b className="text-warning"> · {r.antigos === 1 ? "1 há" : `${r.antigos} há`} mais de {DIAS_ANTIGO} dias</b>}
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-muted-foreground" />
      </button>}
      {aberto && <ContasFiado contas={contas} comercioId={comercioId} comercioNome={comercioNome} api={api} agora={agora} aviso={aviso} onMudou={recarregar} onClose={() => setAberto(false)} />}
    </section>
  );
}

function AvisoConsultaFiado({ erro, consultando, temDados, onTentar }: {
  erro: boolean; consultando: boolean; temDados: boolean; onTentar: () => Promise<unknown>;
}) {
  if (erro) return (
    <div role="alert" className="space-y-2 rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">
      <p className="font-semibold">Não foi possível consultar o fiado agora.</p>
      <p>{temDados ? "Os dados são da última consulta; podem ter mudado." : "Confira a conexão e tente de novo."}</p>
      <button type="button" disabled={consultando} onClick={() => void onTentar()} className="min-h-11 font-semibold text-primary disabled:opacity-50">
        {consultando ? "Consultando…" : "Tentar de novo"}
      </button>
    </div>
  );
  if (consultando) return <p role="status" className="rounded-2xl border border-border p-3 text-sm text-muted-foreground">
    {temDados ? "Atualizando o fiado… Os dados são da última consulta." : "Consultando o fiado…"}
  </p>;
  return null;
}

function ContasFiado({ contas, comercioId, comercioNome, api, agora, aviso, onMudou, onClose }: {
  contas: ContaFiado[]; comercioId: string; comercioNome: string; api: ApiFiado; agora: number; aviso: ReactNode; onMudou: () => Promise<unknown>; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const achadas = buscarConta(contas, q);
  const devendo = achadas.filter((c) => c.deve > 0);
  const emDia = achadas.filter((c) => c.deve === 0);
  const conta = contas.find((c) => c.id === sel);
  if (conta) return <DetalheConta c={conta} comercioId={comercioId} comercioNome={comercioNome} api={api} agora={agora} aviso={aviso} onMudou={onMudou} onVoltar={() => setSel(null)} onClose={onClose} />;
  return (
    <Sheet title="Fiado" onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        {aviso}
        <label className="relative block">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar pelo nome ou telefone" aria-label="Procurar cliente"
            className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 pl-11 pr-4 text-base text-foreground outline-none focus-visible:border-primary" />
        </label>
        {!devendo.length && <p className="rounded-2xl bg-accent/10 p-3 text-center text-sm font-semibold text-accent">Ninguém devendo{q ? " com esse nome" : ""}.</p>}
        <ul className="space-y-2" aria-label="Clientes que devem">
          {devendo.map((c) => {
            const antigo = !!c.desde && agora - Date.parse(c.desde) > DIAS_ANTIGO * 86_400_000;
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setSel(c.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${antigo ? "border-warning/60 bg-warning/5" : "border-border bg-secondary/50"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-base font-semibold">{c.nome}</span>
                    <span className={`block text-xs ${antigo ? "font-semibold text-warning" : "text-muted-foreground"}`}>{c.desde ? `Devendo desde ${dataTxt(c.desde)} (${haQuantoTempo(c.desde, agora)})` : ""}</span>
                  </span>
                  <b className="shrink-0 text-base tabular-nums">{brl(c.deve)}</b>
                </button>
              </li>
            );
          })}
        </ul>
        {emDia.length > 0 && (
          <details className="rounded-2xl border border-border p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-muted-foreground">Em dia ({emDia.length})</summary>
            <ul className="mt-2 space-y-1">
              {emDia.map((c) => (
                <li key={c.id}><button type="button" onClick={() => setSel(c.id)} className="flex min-h-11 w-full items-center justify-between text-left"><span>{c.nome}</span><span className="text-xs text-accent">em dia</span></button></li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Sheet>
  );
}

function DetalheConta({ c, comercioId, comercioNome, api, agora, aviso, onMudou, onVoltar, onClose }: {
  c: ContaFiado; comercioId: string; comercioNome: string; api: ApiFiado; agora: number; aviso: ReactNode; onMudou: () => Promise<unknown>; onVoltar: () => void; onClose: () => void;
}) {
  const [modo, setModo] = useState<"ver" | "receber" | "editar">("ver");
  /** Um código por pagamento: novo a cada "Recebeu"; o mesmo se reenviar depois de falhar (não conta duas vezes). */
  const [id, setId] = useState(newUid);
  const [valor, setValor] = useState(c.deve);
  const [forma, setForma] = useState<"dinheiro" | "pix" | "cartao">("dinheiro");
  const [obs, setObs] = useState("");
  const [nome, setNome] = useState(c.nome);
  const [tel, setTel] = useState(c.telefone ? maskPhone(c.telefone) : "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState("");
  const okReceber = valor > 0 && valor <= c.deve && !ocupado;
  const telOk = !tel || /^\d{10,11}$/.test(digits(tel));
  const fazer = (f: () => Promise<unknown>, msg: string) => {
    setOcupado(true); setErro("");
    f().then(() => onMudou()).then(() => { setPronto(msg); setModo("ver"); }, (e) => setErro(erroTexto(e))).finally(() => setOcupado(false));
  };
  return (
    <Sheet title={c.nome} onClose={onClose}>
      <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-3">
        <button type="button" onClick={onVoltar} className="text-sm font-semibold text-primary">← Todas as contas</button>
        {aviso}
        {pronto && <p role="status" className="rounded-2xl bg-accent/10 p-3 text-sm font-semibold text-accent">{pronto}</p>}
        <div className="rounded-3xl border border-border bg-secondary/40 p-4">
          <p className="text-sm text-muted-foreground">{c.deve > 0 ? "Deve" : "Conta em dia"}</p>
          <p className={`text-3xl font-bold tabular-nums ${c.deve > 0 ? "" : "text-accent"}`}>{brl(c.deve)}</p>
          {c.desde && <p className="text-xs text-muted-foreground">Desde {dataTxt(c.desde)} ({haQuantoTempo(c.desde, agora)})</p>}
          {c.telefone && <p className="mt-1 text-sm">{maskPhone(c.telefone)}</p>}
        </div>

        {modo === "ver" && (
          <div className="grid grid-cols-1 gap-2">
            {c.deve > 0 && <button type="button" onClick={() => { setModo("receber"); setValor(c.deve); setObs(""); setId(newUid()); setPronto(""); }} className={`flex items-center justify-center gap-2 ${btnPrimary(true)}`}><HandCoins size={20} /> Recebeu</button>}
            <CompartilharFiado telefone={c.telefone} rotulo={c.deve > 0 ? "Cobrar pelo WhatsApp" : "Mandar a conta no WhatsApp"}
              montar={async (link) => mensagemFiadoCompleta(c, comercioNome, c.movimentos, link(await linkClienteDono(c.id)))} />
            <button type="button" onClick={() => { setModo("editar"); setPronto(""); }} className="flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground"><Pencil size={16} /> Mudar nome ou telefone</button>
            <LimiteFiado key={c.id} cliente={c} onSalvo={() => setPronto("Limite do fiado salvo.")} />
          </div>
        )}

        {modo === "receber" && (
          <div className="space-y-3 rounded-3xl border border-primary/50 p-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-muted-foreground">Quanto recebeu?</span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">R$</span>
                <input inputMode="numeric" aria-label="Quanto recebeu?" value={mascaraDinheiro(valor)} onChange={(e) => setValor(centavosDigitados(e.target.value))}
                  className="h-14 w-full rounded-2xl border border-border bg-background-deep/60 pl-14 pr-4 text-right text-2xl font-bold tabular-nums text-foreground outline-none focus-visible:border-primary" />
              </span>
              {valor > c.deve && <span className="block text-xs font-semibold text-destructive">É mais do que ele deve ({brl(c.deve)}).</span>}
              {valor > 0 && valor < c.deve && <span className="block text-xs text-muted-foreground">Vai continuar devendo {brl(c.deve - valor)}.</span>}
            </label>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Forma de pagamento">
              {(["dinheiro", "pix", "cartao"] as const).map((f) => (
                <button key={f} type="button" aria-pressed={forma === f} onClick={() => setForma(f)}
                  className={`min-h-12 rounded-2xl border text-sm font-semibold ${forma === f ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{FORMA_FIADO[f]}</button>
              ))}
            </div>
            <input value={obs} maxLength={200} onChange={(e) => setObs(e.target.value)} placeholder="Anotação (opcional)" aria-label="Anotação"
              className="h-12 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            <button type="button" disabled={!okReceber} className={btnPrimary(okReceber)}
              onClick={() => fazer(() => api.receber(id, c.id, valor, forma, obs.trim()), `Recebido ${brl(valor)} de ${c.nome.split(" ")[0]}.`)}>
              {ocupado ? "Salvando…" : `Confirmar ${valor ? brl(valor) : ""}`}
            </button>
            <button type="button" onClick={() => setModo("ver")} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
          </div>
        )}

        {modo === "editar" && (
          <div className="space-y-3 rounded-3xl border border-border p-4">
            <input value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} aria-label="Nome do cliente"
              className="h-12 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            <input inputMode="tel" value={tel} onChange={(e) => setTel(maskPhone(e.target.value))} placeholder="(43) 99999-9999" aria-label="Telefone do cliente"
              className="h-12 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            {!telOk && <p className="text-xs font-semibold text-destructive">Use DDD + número.</p>}
            <button type="button" disabled={nome.trim().length < 2 || !telOk || ocupado} className={btnPrimary(nome.trim().length >= 2 && telOk && !ocupado)}
              onClick={() => fazer(() => api.salvarCliente(c.id, comercioId, nome.trim(), digits(tel) || null), "Dados do cliente salvos.")}>Salvar</button>
            <button type="button" onClick={() => setModo("ver")} className="min-h-11 w-full text-sm font-semibold text-muted-foreground">Voltar</button>
          </div>
        )}
        {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}

        <div>
          <p className="mb-1 text-sm font-bold">Histórico</p>
          <ul className="divide-y divide-border rounded-2xl border border-border px-3">
            {c.movimentos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0"><span className="block">{textoMovimento(m)}</span><span className="block text-xs text-muted-foreground">{dataTxt(m.criadoEm)}{m.observacao ? ` · ${m.observacao}` : ""}</span></span>
                <b className={`shrink-0 tabular-nums ${m.tipo === "compra" ? "" : "text-accent"}`}>{m.tipo === "compra" ? "+" : "−"}{brl(m.valor)}</b>
              </li>
            ))}
            {!c.movimentos.length && <li className="py-3 text-center text-sm text-muted-foreground">Sem movimentos.</li>}
          </ul>
        </div>
      </div>
    </Sheet>
  );
}

