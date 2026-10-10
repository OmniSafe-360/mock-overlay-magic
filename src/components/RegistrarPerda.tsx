/* Registrar perda no app do funcionário (Fase 4.2): quebrou, venceu, usado na loja ou devolvido ao fornecedor.
 * Sai do estoque na hora; o dono confirma depois (se recusar, vira uma diferença para investigar). */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, CheckCircle2, PackageX, Search } from "lucide-react";
import { Scanner } from "@/components/Scanner";
import { Contador } from "@/components/parts/Contador";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";
import * as banco from "@/lib/banco";
import { aceitaFracao, newUid, parseNum, qtdUn, unPlural } from "@/lib/deposito";
import { textoDoTipo } from "@/lib/exemplos";
import { mensagemErro } from "@/lib/persistencia";
import { nomeProdutoFunc, type ProdutoFunc } from "@/lib/recebimento";
import { nomeVenda } from "@/lib/situacao";
import { escopoAcesso, operacaoLocal } from "@/lib/operacaoLocal";
import { ERRO_REGISTRO } from "@/lib/envios";

type EnvioPerda = { dados: banco.NovaPerda; resumo: string };
const envioValido = (p: unknown): p is EnvioPerda => {
  const x = p as EnvioPerda | null;
  return !!x && typeof x.resumo === "string" && !!x.dados && typeof x.dados.id === "string"
    && typeof x.dados.produtoId === "string" && ["deposito", "venda"].includes(x.dados.area)
    && Number.isFinite(x.dados.quantidade) && x.dados.quantidade > 0
    && MOTIVOS_PERDA.some((m) => m.id === x.dados.motivo) && typeof x.dados.observacao === "string";
};

export type ApiPerda = {
  buscar: typeof banco.buscarProdutoFuncionario;
  registrar: typeof banco.registrarPerdaFuncionario;
};
const API_PADRAO: ApiPerda = { buscar: banco.buscarProdutoFuncionario, registrar: banco.registrarPerdaFuncionario };

export const MOTIVOS_PERDA: { id: banco.MotivoPerda; txt: string; ajuda: string }[] = [
  { id: "quebrou", txt: "Quebrou ou estragou", ajuda: "Caiu, amassou, vazou, embalagem rasgada." },
  { id: "venceu", txt: "Venceu", ajuda: "Passou da validade e não pode ser vendido." },
  { id: "consumo", txt: "Usado na loja", ajuda: "Limpeza, café, uso da equipe." },
  { id: "devolvido", txt: "Devolvido ao fornecedor", ajuda: "Saiu para troca ou devolução." },
  { id: "outro", txt: "Outro motivo", ajuda: "Escreva o que aconteceu." },
];
const MSG: [string, string][] = [
  ["acesso_encerrado", "Este celular saiu do app. Entre de novo com o código do dono."],
  ["pin_necessario", "Por segurança, o app travou. Volte ao início e digite seu PIN."],
  ["variacao_obrigatoria", "Escolha o tamanho e a cor do produto."],
  ["unidade_exige_inteiro", "Este produto é contado inteiro (sem vírgula)."],
];
const erroTexto = (e: unknown) => {
  const m = String((e as { message?: string } | null)?.message ?? e ?? "");
  return MSG.find(([k]) => m.includes(k))?.[1] ?? mensagemErro(e).replace("Seus dados continuam no formulário. ", "").replace("Não foi possível salvar agora. ", "Não foi possível enviar agora. ");
};

export function RegistrarPerda({ chave, tipo, onVoltar, api: apiDada }: { chave: string; tipo: string; onVoltar: () => void; api?: ApiPerda | undefined }) {
  return <FormularioPerda key={chave} chave={chave} tipo={tipo} onVoltar={onVoltar} api={apiDada} />;
}

function FormularioPerda({ chave, tipo, onVoltar, api: apiDada }: { chave: string; tipo: string; onVoltar: () => void; api?: ApiPerda | undefined }) {
  const api = apiDada ?? API_PADRAO;
  const t = textoDoTipo(tipo);
  const venda = nomeVenda(tipo).toLowerCase();
  const [produto, setProduto] = useState<ProdutoFunc | null>(null);
  const [area, setArea] = useState<"deposito" | "venda" | null>(null);
  const [motivo, setMotivo] = useState<banco.MotivoPerda | null>(null);
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const registro = useRef<ReturnType<typeof operacaoLocal<EnvioPerda>> | null>(null);
  const ocupado = useRef(false);
  const [pendente, setPendente] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  useEffect(() => {
    let ativo = true;
    void escopoAcesso(chave).then((escopo) => {
      if (!ativo) return;
      registro.current = operacaoLocal(escopo, "perda", envioValido);
      setPendente(!!registro.current.pendente()); setPronto(true);
    }).catch(() => { if (ativo) setErro(ERRO_REGISTRO); });
    return () => { ativo = false; };
  }, [chave]);
  const n = produto ? parseNum(valor, produto.unidade, false) : { v: null, err: "" };
  const ok = pronto && !enviando && (pendente || (!!produto && !!area && !!motivo && n.v != null && !n.err && (motivo !== "outro" || obs.trim().length >= 3)));

  const enviar = async () => {
    if (!ok || ocupado.current || !registro.current) return;
    ocupado.current = true;
    setEnviando(true); setErro("");
    try {
      const r = await registro.current.enviar(() => ({
        dados: { id: newUid(), produtoId: produto!.produtoId, variacaoId: produto!.variacaoId, area: area!, quantidade: n.v!, motivo: motivo!, observacao: obs.trim() },
        resumo: `${nomeProdutoFunc(produto!)}: ${qtdUn(n.v!, produto!.unidade)} (${MOTIVOS_PERDA.find((m) => m.id === motivo)!.txt.toLowerCase()}).`,
      }), (pedido) => api.registrar(chave, pedido.dados));
      setFeito(`${r.pedido.resumo}${r.recuperado ? " O envio original foi confirmado; mudanças feitas depois não foram enviadas." : ""}`);
      setProduto(null); setArea(null); setMotivo(null); setValor(""); setObs("");
    } catch (e) { setErro(erroTexto(e)); }
    finally { setPendente(!!registro.current.pendente()); setEnviando(false); ocupado.current = false; }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <button type="button" onClick={onVoltar} className="flex min-h-12 items-center gap-2 pr-3 text-base font-semibold text-primary"><ArrowLeft size={18} /> Início</button>
      <div>
        <h1 className="text-2xl font-bold">Registrar perda</h1>
        <p className="text-sm text-muted-foreground">Produto que quebrou, venceu, foi usado na loja ou devolvido. Sai do estoque agora e o dono confere depois.</p>
      </div>
      {feito && (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-accent/50 bg-accent/10 p-3 text-sm font-semibold text-accent">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> Registrado! {feito} O dono vai confirmar.
        </p>
      )}

      {/* 1. produto */}
      <section className="space-y-2 rounded-3xl border border-border p-4">
        <p className="text-base font-bold">1. Qual produto?</p>
        {produto ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-primary/50 bg-primary/10 p-3">
            <span className="min-w-0 break-words font-semibold">{nomeProdutoFunc(produto)}</span>
            <button type="button" onClick={() => { setProduto(null); setValor(""); }} className="shrink-0 text-sm font-semibold text-primary">Trocar</button>
          </div>
        ) : (
          <EscolherProduto mercado={tipo === "mercado"} chave={chave} api={api} onEscolher={(p) => { setProduto(p); setFeito(""); }} />
        )}
      </section>

      {produto && (
        <>
          {/* 2. onde */}
          <section className="space-y-2 rounded-3xl border border-border p-4">
            <p className="text-base font-bold">2. Onde estava?</p>
            <div className="grid grid-cols-2 gap-2">
              {([["deposito", t("No depósito")], ["venda", `Na ${venda}`]] as const).map(([k, txt]) => (
                <button key={k} type="button" aria-pressed={area === k} onClick={() => setArea(k)}
                  className={`min-h-13 rounded-2xl border px-3 text-base font-semibold ${area === k ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{txt}</button>
              ))}
            </div>
          </section>

          {/* 3. motivo */}
          <section className="space-y-2 rounded-3xl border border-border p-4">
            <p className="text-base font-bold">3. O que aconteceu?</p>
            <div className="grid grid-cols-1 gap-2">
              {MOTIVOS_PERDA.map((m) => (
                <button key={m.id} type="button" aria-pressed={motivo === m.id} onClick={() => setMotivo(m.id)}
                  className={`flex min-h-13 flex-col justify-center rounded-2xl border px-4 py-2 text-left ${motivo === m.id ? "border-primary bg-primary/15" : "border-border"}`}>
                  <span className={`text-base font-semibold ${motivo === m.id ? "text-primary" : ""}`}>{m.txt}</span>
                  <span className="text-xs text-muted-foreground">{m.ajuda}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 4. quantidade */}
          <section className="space-y-2 rounded-3xl border border-border p-4">
            <p className="text-base font-bold">4. Quantos?</p>
            <Contador rotulo={`Perdidos (${unPlural(produto.unidade).toLowerCase()})`} valor={valor} fracao={aceitaFracao(produto.unidade)} onMudar={setValor} />
            {valor && n.err && <p role="alert" className="text-sm font-semibold text-destructive">{n.err}</p>}
            <label className="block space-y-1">
              <span className="text-sm font-medium">{motivo === "outro" ? "O que aconteceu? (obrigatório)" : "Recado para o dono (opcional)"}</span>
              <input value={obs} maxLength={300} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: caiu da prateleira"
                className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary" />
            </label>
          </section>
        </>
      )}

      {erro && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{erro}</p>}
      {pendente && <p role="status" className="rounded-2xl border border-warning/50 p-3 text-sm">Há uma perda sem confirmação. O próximo envio repete os dados originais, sem duplicar. Confira antes de registrar outra perda.</p>}
      {(produto || pendente) && (
        <button type="button" disabled={!ok} onClick={() => void enviar()} className={`mt-auto flex items-center justify-center gap-2 ${btnPrimary(ok)}`}>
          <PackageX size={20} /> {enviando ? "Registrando…" : pendente ? "Confirmar envio pendente" : "Registrar perda"}
        </button>
      )}
    </div>
  );
}

function EscolherProduto({ chave, api, onEscolher, mercado }: { chave: string; api: ApiPerda; onEscolher: (p: ProdutoFunc) => void; mercado: boolean }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ProdutoFunc[] | null>(null);
  const [scan, setScan] = useState(false);
  const [erro, setErro] = useState("");
  const procurar = async (texto: string) => {
    if (texto.trim().length < 2) return;
    setErro("");
    try {
      // Embalagem bipada: a perda é contada em unidades do produto.
      const r = (await api.buscar(chave, texto.trim())).map((p) => ({ ...p, embalagemId: null }));
      const unicos = r.filter((p, i) => r.findIndex((x) => x.produtoId === p.produtoId && x.variacaoId === p.variacaoId) === i);
      if (unicos.length === 1) onEscolher(unicos[0]!); else setRes(unicos);
    } catch (e) { setErro(erroTexto(e)); }
  };
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void procurar(q); }}>
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
          <li key={`${p.produtoId}:${p.variacaoId ?? "_"}`}>
            <button type="button" onClick={() => onEscolher(p)} className="flex min-h-13 w-full items-center gap-2 py-2 text-left text-base font-semibold"><Check size={16} className="text-primary" /> {nomeProdutoFunc(p)}</button>
          </li>
        ))}
      </ul>
      {scan && <Scanner mercado={mercado} onClose={() => setScan(false)} onType={() => setScan(false)} onDenied={() => setScan(false)} onCode={(c) => { setScan(false); setQ(c); void procurar(c); }} />}
    </form>
  );
}
