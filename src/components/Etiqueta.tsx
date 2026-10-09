/* Etiqueta de produto (código de barras + nome + preço) para folha A4 ou impressora térmica. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { btnGhost, btnPrimary, digits } from "@/components/StoreSetup";
import { desenharCodigo } from "@/lib/codigoBarras";
import {
  LARGURA_MIN_MODULO, MODELOS, QTD_MAX, folhasA4, larguraModulo, modeloPorId, porFolha, posicaoNaFolha, precoEtiqueta, regraPagina,
  type Modelo,
} from "@/lib/etiqueta";

export type ItemEtiqueta = { nome: string; codigo: string; venda: number; unidade: string };
type Opcao = ItemEtiqueta & { chave: string; rotulo: string };

const CHAVE_MODELO = "omni.etiqueta.modelo";
const lerModelo = () => { try { return modeloPorId(localStorage.getItem(CHAVE_MODELO)); } catch { return modeloPorId(null); } };
const guardarModelo = (id: string) => { try { localStorage.setItem(CHAVE_MODELO, id); } catch { /* sem armazenamento: só não lembra */ } };

/** Barras desenhadas em SVG; ocupam toda a largura do espaço onde estão. */
export function BarrasSvg({ codigo, alturaMm }: { codigo: string; alturaMm: number }) {
  const b = desenharCodigo(codigo);
  if (!b) return null;
  const mods = "0".repeat(b.quietEsq) + b.modulos + "0".repeat(b.quietDir);
  const barras: { x: number; w: number }[] = [];
  for (let i = 0; i < mods.length; i++) {
    if (mods[i] !== "1") continue;
    let j = i;
    while (mods[j + 1] === "1") j++;
    barras.push({ x: i, w: j - i + 1 });
    i = j;
  }
  return (
    <svg viewBox={`0 0 ${mods.length} 10`} preserveAspectRatio="none" role="img" aria-label={`Código de barras ${codigo}`}
      style={{ display: "block", width: "100%", height: `${alturaMm}mm` }} shapeRendering="crispEdges">
      {barras.map((r) => <rect key={r.x} x={r.x} y={0} width={r.w} height={10} fill="#000" />)}
    </svg>
  );
}

/** Uma etiqueta no tamanho real (mm). Preto no branco, para qualquer impressora. */
export function EtiquetaVisual({ item, modelo, mostrarPreco }: { item: ItemEtiqueta; modelo: Modelo; mostrarPreco: boolean }) {
  const a = modelo.alt;
  return (
    <div style={{
      width: `${modelo.larg}mm`, height: `${a}mm`, padding: "1.5mm 2mm", boxSizing: "border-box", background: "#fff", color: "#000",
      fontFamily: "Inter, Arial, sans-serif", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden",
    }}>
      <div style={{ fontSize: `${(a * 0.22).toFixed(1)}pt`, fontWeight: 600, lineHeight: 1.15, maxHeight: "2.3em", overflow: "hidden", wordBreak: "break-word" }}>{item.nome}</div>
      {mostrarPreco && <div style={{ fontSize: `${(a * 0.36).toFixed(1)}pt`, fontWeight: 800, lineHeight: 1.1 }}>{precoEtiqueta(item.venda, item.unidade)}</div>}
      <div>
        <BarrasSvg codigo={item.codigo} alturaMm={a * (mostrarPreco ? 0.3 : 0.42)} />
        <div style={{ fontSize: `${(a * 0.19).toFixed(1)}pt`, textAlign: "center", letterSpacing: "0.08em", lineHeight: 1.2 }}>{item.codigo}</div>
      </div>
    </div>
  );
}

/** Páginas para imprimir, já no tamanho do papel. */
function Paginas({ item, modelo, qtd, comecarEm, mostrarPreco }: { item: ItemEtiqueta; modelo: Modelo; qtd: number; comecarEm: number; mostrarPreco: boolean }) {
  if (modelo.tipo === "termica")
    return <>{Array.from({ length: Math.min(qtd, QTD_MAX) }, (_, i) => (
      <div key={i} style={{ width: `${modelo.larg}mm`, height: `${modelo.alt}mm`, breakAfter: "page", overflow: "hidden" }}>
        <EtiquetaVisual item={item} modelo={modelo} mostrarPreco={mostrarPreco} />
      </div>
    ))}</>;
  return <>{folhasA4(modelo, qtd, comecarEm).map((folha, f) => (
    <div key={f} style={{ position: "relative", width: "210mm", height: "297mm", breakAfter: "page", overflow: "hidden", background: "#fff" }}>
      {folha.map((idx, pos) => {
        if (idx == null) return null;
        const p = posicaoNaFolha(modelo, pos);
        return <div key={pos} style={{ position: "absolute", left: `${p.esq}mm`, top: `${p.topo}mm` }}><EtiquetaVisual item={item} modelo={modelo} mostrarPreco={mostrarPreco} /></div>;
      })}
    </div>
  ))}</>;
}

/** Abre a tela de impressão do navegador só com as etiquetas. */
function AreaImpressao({ modelo, onFim, children }: { modelo: Modelo; onFim: () => void; children: ReactNode }) {
  const fimRef = useRef(onFim);
  fimRef.current = onFim;
  /* Abre a impressão uma única vez por pedido. */
  useEffect(() => {
    const fim = () => fimRef.current();
    window.addEventListener("afterprint", fim);
    const t = setTimeout(() => window.print(), 150);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", fim); };
  }, []);
  return createPortal(
    <div id="area-impressao">
      <style>{`${regraPagina(modelo)}
@media screen { #area-impressao { display: none; } }
@media print {
  html, body { background: #fff !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
  body > *:not(#area-impressao) { display: none !important; }
  #area-impressao { display: block !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`}</style>
      {children}
    </div>,
    document.body,
  );
}

export function opcoesEtiqueta(p: { nome: string; codigo: string; venda: number; unidade: string; variacoes: { tam: string; cor: string; codigo?: string | undefined }[] }): Opcao[] {
  const base = { venda: p.venda, unidade: p.unidade };
  const ops: Opcao[] = [];
  if (p.codigo.trim()) ops.push({ ...base, chave: "produto", rotulo: "Produto", nome: p.nome, codigo: p.codigo.trim() });
  p.variacoes.forEach((v, i) => {
    if (v.codigo?.trim()) ops.push({ ...base, chave: `var-${i}`, rotulo: `${v.tam} · ${v.cor}`, nome: `${p.nome} · ${v.tam} ${v.cor}`, codigo: v.codigo.trim() });
  });
  return ops;
}

export function ImprimirEtiquetaSheet({ produto, onClose }: {
  produto: Parameters<typeof opcoesEtiqueta>[0]; onClose: () => void;
}) {
  const opcoes = useMemo(() => opcoesEtiqueta(produto), [produto]);
  const [chave, setChave] = useState(opcoes[0]?.chave ?? "");
  const [modelo, setModelo] = useState<Modelo>(lerModelo);
  const [qtd, setQtd] = useState("1");
  const [comecar, setComecar] = useState("1");
  const [mostrarPreco, setMostrarPreco] = useState(true);
  const [imprimindo, setImprimindo] = useState(false);
  const item = opcoes.find((o) => o.chave === chave) ?? opcoes[0];
  const n = Math.min(Number(qtd) || 0, QTD_MAX);
  const ini = Math.min(Math.max(Number(comecar) || 1, 1), porFolha(modelo));
  const barras = item ? desenharCodigo(item.codigo) : null;
  const fina = barras ? larguraModulo(modelo, barras.modulos.length + barras.quietEsq + barras.quietDir) : 0;
  const aviso = !item ? "" : !barras ? "Este código tem acento ou símbolo especial: a etiqueta sai sem código de barras, só com o número."
    : fina < LARGURA_MIN_MODULO ? "Código longo para este tamanho de etiqueta: o leitor pode ter dificuldade. Prefira uma etiqueta maior." : "";
  const folhas = modelo.tipo === "a4" && n > 0 ? folhasA4(modelo, n, ini).length : 0;
  const ok = !!item && n > 0;
  const escala = Math.min(1, 280 / (modelo.larg * 3.78));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-background-deep/70 animate-in fade-in duration-200" />
      <div role="dialog" aria-modal="true" aria-label="Imprimir etiqueta" className="relative flex max-h-[90%] w-full max-w-[480px] flex-col rounded-t-3xl border border-b-0 border-border bg-background animate-in slide-in-from-bottom duration-300" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="flex shrink-0 items-center justify-between px-5 pt-4">
          <h2 className="text-base font-semibold">Imprimir etiqueta</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-12 w-12 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        {!item ? (
          <p className="px-5 py-4 text-base text-muted-foreground">Este produto ainda não tem código. Edite o produto e escolha "Não tem código" para o sistema criar um.</p>
        ) : (
          <>
            <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-3">
              <div className="flex justify-center rounded-2xl border border-border bg-background-deep/60 p-3">
                <div style={{ transform: `scale(${escala})`, transformOrigin: "top center", height: `${modelo.alt * 3.78 * escala}px` }} className="shadow-lg">
                  <EtiquetaVisual item={item} modelo={modelo} mostrarPreco={mostrarPreco} />
                </div>
              </div>
              {aviso && <p role="alert" className="text-sm text-warning">{aviso}</p>}

              {opcoes.length > 1 && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-muted-foreground">Etiqueta de</legend>
                  <div className="flex flex-wrap gap-2">
                    {opcoes.map((o) => (
                      <button key={o.chave} type="button" aria-pressed={o.chave === item.chave} onClick={() => setChave(o.chave)}
                        className={`min-h-12 rounded-2xl border px-4 text-base font-semibold ${o.chave === item.chave ? "border-accent bg-accent/10" : "border-border bg-background-deep/60"}`}>{o.rotulo}</button>
                    ))}
                  </div>
                </fieldset>
              )}

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-muted-foreground">Papel</legend>
                <div className="grid grid-cols-1 gap-2">
                  {MODELOS.map((m) => (
                    <button key={m.id} type="button" aria-pressed={m.id === modelo.id} onClick={() => { setModelo(m); guardarModelo(m.id); }}
                      className={`min-h-13 rounded-2xl border px-4 py-2 text-left ${m.id === modelo.id ? "border-accent bg-accent/10" : "border-border bg-background-deep/60"}`}>
                      <span className="block text-base font-semibold">{m.nome}</span>
                      <span className="block text-xs text-muted-foreground">{m.descricao}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-muted-foreground">Quantidade</span>
                  <input inputMode="numeric" value={qtd} onChange={(e) => setQtd(digits(e.target.value).slice(0, 3))} aria-label="Quantidade de etiquetas"
                    className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base outline-none focus-visible:border-primary" />
                </label>
                {modelo.tipo === "a4" && (
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-muted-foreground">Começar na etiqueta</span>
                    <input inputMode="numeric" value={comecar} onChange={(e) => setComecar(digits(e.target.value).slice(0, 2))} aria-label="Começar na etiqueta número"
                      className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base outline-none focus-visible:border-primary" />
                  </label>
                )}
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                {modelo.tipo === "a4"
                  ? `Folha já usada? Diga em qual etiqueta começar (1 a ${porFolha(modelo)}, contando da esquerda para a direita).${folhas ? ` Vai usar ${folhas} folha${folhas > 1 ? "s" : ""}.` : ""}`
                  : `Máximo de ${QTD_MAX} por vez.`}
              </p>

              <button type="button" aria-pressed={mostrarPreco} onClick={() => setMostrarPreco(!mostrarPreco)}
                className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-base font-semibold ${mostrarPreco ? "border-accent bg-accent/10" : "border-border bg-background-deep/60"}`}>
                Mostrar o preço <span className="text-sm text-muted-foreground">{mostrarPreco ? "Sim" : "Não"}</span>
              </button>
              <p className="text-xs text-muted-foreground">Na tela de impressão, escolha o tamanho de papel certo e escala 100% (tamanho real), sem margens.</p>
            </div>
            <div className="flex gap-2 px-5 pt-2">
              <button type="button" onClick={onClose} className={btnGhost}>Fechar</button>
              <button type="button" disabled={!ok} onClick={() => setImprimindo(true)} className={`flex flex-1 items-center justify-center gap-2 ${btnPrimary(ok)}`}>
                <Printer size={18} /> Imprimir {n > 1 ? `${n} etiquetas` : "etiqueta"}
              </button>
            </div>
          </>
        )}
      </div>
      {imprimindo && item && (
        <AreaImpressao modelo={modelo} onFim={() => setImprimindo(false)}>
          <Paginas item={item} modelo={modelo} qtd={n} comecarEm={ini} mostrarPreco={mostrarPreco} />
        </AreaImpressao>
      )}
    </div>
  );
}
