/* Caixa no celular (C2), no app da equipe "Omni Operação": o carrinho, o pagamento e o troco.
 * Regra do dono: só sai da gôndola quando a venda é FINALIZADA (o banco desconta ao receber a venda).
 * Valores em centavos (números inteiros), para não errar centavo no troco. Não grava nada. */
import { formatarCentavos } from "@/lib/formatacao";
import { normalizar } from "@/lib/vendas";

export const brl = formatarCentavos;

export type CodigoCaixa = { codigo: string; variacaoId: string | null; embalagemId: string | null };
export type ProdutoCaixa = {
  id: string; nome: string; unidade: string; fracionado: boolean;
  /** Preço de venda da unidade, em centavos. */ preco: number;
  codigos: CodigoCaixa[];
  variacoes: { id: string; nome: string }[];
  embalagens: { id: string; tipo: string; quantidade: number }[];
};

/** Uma linha da venda. Produto sem cadastro tem `produtoId` vazio e o preço digitado. */
export type ItemCarrinho = {
  id: string;
  produtoId: string | null; variacaoId: string | null; embalagemId: string | null;
  codigo: string | null;
  nome: string; detalhe: string;
  unidade: string; fracionado: boolean;
  qtd: number; /** centavos por unidade (ou por kg/metro/litro) */ preco: number;
};

export type FormaCaixa = "dinheiro" | "pix" | "cartao" | "fiado";
export const FORMA_TXT: Record<FormaCaixa, string> = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão", fiado: "Fiado" };
export type PagamentoCaixa = { forma: FormaCaixa; valor: number };

/** O mesmo código escrito de outro jeito (UPC com 12 números, GTIN-14 começando com 0). */
export function variantesCodigo(c: string): string[] {
  const t = c.trim();
  const v = new Set([t]);
  if (/^\d{12}$/.test(t)) v.add(`0${t}`);
  if (/^0\d{12}$/.test(t)) v.add(t.slice(1));
  if (/^0\d{13}$/.test(t)) { v.add(t.slice(1)); if (t.startsWith("00")) v.add(t.slice(2)); }
  return [...v];
}

export type Achado = { produto: ProdutoCaixa; variacaoId: string | null; embalagemId: string | null };
/** O produto do código bipado ou digitado (do produto, da variação ou da embalagem). */
export function acharPorCodigo(produtos: ProdutoCaixa[], codigo: string): Achado | null {
  const vs = variantesCodigo(codigo);
  for (const p of produtos)
    for (const c of p.codigos)
      if (vs.includes(c.codigo)) return { produto: p, variacaoId: c.variacaoId, embalagemId: c.embalagemId };
  return null;
}

/** Busca pelo nome (sem acento) ou pelo começo do código. */
export function buscarProdutos(produtos: ProdutoCaixa[], texto: string, limite = 20): ProdutoCaixa[] {
  const q = normalizar(texto);
  if (q.length < 2) return [];
  const palavras = q.split(/\s+/);
  return produtos.filter((p) => {
    const n = normalizar(p.nome);
    return palavras.every((w) => n.includes(w)) || p.codigos.some((c) => c.codigo.startsWith(q));
  }).slice(0, limite);
}

/** "Fardo com 12" / "M · Azul". */
export function detalheItem(p: ProdutoCaixa, variacaoId: string | null, embalagemId: string | null): string {
  const e = embalagemId ? p.embalagens.find((x) => x.id === embalagemId) : undefined;
  if (e) return `${e.tipo} com ${String(e.quantidade).replace(".", ",")}`;
  return (variacaoId ? p.variacoes.find((x) => x.id === variacaoId)?.nome : undefined) ?? "";
}
/** Preço da linha: a embalagem vale a quantidade dela × o preço da unidade. */
export function precoDe(p: ProdutoCaixa, embalagemId: string | null): number {
  const e = embalagemId ? p.embalagens.find((x) => x.id === embalagemId) : undefined;
  return Math.round(p.preco * (e?.quantidade ?? 1));
}

export function itemDoProduto(id: string, a: Achado, codigo: string | null, qtd = 1): ItemCarrinho {
  return {
    id, produtoId: a.produto.id, variacaoId: a.variacaoId, embalagemId: a.embalagemId, codigo,
    nome: a.produto.nome, detalhe: detalheItem(a.produto, a.variacaoId, a.embalagemId),
    unidade: a.embalagemId ? "Unidade" : a.produto.unidade, fracionado: !a.embalagemId && a.produto.fracionado,
    qtd, preco: precoDe(a.produto, a.embalagemId),
  };
}

/** Bipar de novo o mesmo produto soma 1 na mesma linha (o que é pesado sempre vira linha nova). */
export function adicionar(carrinho: ItemCarrinho[], item: ItemCarrinho): ItemCarrinho[] {
  if (item.produtoId && !item.fracionado) {
    const i = carrinho.findIndex((x) => x.produtoId === item.produtoId && x.variacaoId === item.variacaoId
      && x.embalagemId === item.embalagemId && !x.fracionado && x.preco === item.preco);
    if (i >= 0) return carrinho.map((x, k) => (k === i ? { ...x, qtd: x.qtd + item.qtd } : x));
  }
  return [...carrinho, item];
}
/** Quantidade × preço, arredondado ao centavo como o banco (meio centavo sobe), sem erro de vírgula do computador. */
export const subtotal = (i: Pick<ItemCarrinho, "qtd" | "preco">) => Math.floor((Math.round(i.qtd * 1000) * Math.round(i.preco) + 500) / 1000);
export const totalCarrinho = (c: ItemCarrinho[]) => c.reduce((t, i) => t + subtotal(i), 0);
export const contarItens = (c: ItemCarrinho[]) => c.reduce((t, i) => t + (i.fracionado ? 1 : i.qtd), 0);

export type SituacaoPagamento = { pago: number; falta: number; troco: number; pronto: boolean };
/** Quanto falta, o troco (só o dinheiro pode passar do total) e se já dá para finalizar. */
export function situacaoPagamento(total: number, pags: PagamentoCaixa[]): SituacaoPagamento {
  const pago = pags.reduce((t, p) => t + p.valor, 0);
  const outros = pags.filter((p) => p.forma !== "dinheiro").reduce((t, p) => t + p.valor, 0);
  const falta = Math.max(0, total - pago);
  const troco = Math.max(0, pago - total);
  return { pago, falta, troco, pronto: total > 0 && pago >= total && outros <= total };
}

/** Atalhos do "Quanto o cliente deu?": o valor exato e as notas que passam dele. */
export function atalhosDinheiro(falta: number): number[] {
  if (falta <= 0) return [];
  const out = [falta];
  for (const nota of [500, 1000, 2000, 5000, 10000, 20000]) if (nota > falta && out.length < 4) out.push(nota);
  if (out.length < 4) { const r = Math.ceil(falta / 10000) * 10000; if (!out.includes(r)) out.push(r); }
  return out.slice(0, 4);
}

/** Dinheiro digitado como na máquina: "1250" → 1250 centavos (R$ 12,50). */
export const centavosDigitados = (txt: string) => Math.min(Number(txt.replace(/\D/g, "").slice(0, 9) || "0"), 99_999_999);
export const mascaraDinheiro = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "0,350" → 0.35 (no máximo 3 casas). null se não for um número maior que zero. */
export function lerQuantidade(txt: string): number | null {
  const t = txt.trim().replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= 100000 ? n : null;
}
export const qtdTexto = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/** O que vai para o banco (valores em reais). */
export function montarVenda(id: string, turnoId: string, carrinho: ItemCarrinho[], pags: PagamentoCaixa[],
  cliente: { id: string; nome?: string; telefone?: string } | null, feitaEm = new Date().toISOString()) {
  return {
    id, turno_id: turnoId, feita_em: feitaEm,
    itens: carrinho.map((i) => ({
      produto_id: i.produtoId, variacao_id: i.variacaoId, embalagem_id: i.embalagemId, codigo: i.codigo,
      descricao: i.produtoId ? null : i.nome, qtd: i.qtd, preco: i.preco / 100,
    })),
    pagamentos: pags.map((p) => ({ forma: p.forma, valor: p.valor / 100 })),
    ...(cliente ? { cliente } : {}),
  };
}

/** Mensagens do caixa em português. */
export function erroCaixa(e: unknown): string {
  const m = String((e as { message?: string } | null)?.message ?? e ?? "");
  if (m.includes("pin_necessario")) return "Por segurança, o app travou. Volte ao início e digite seu PIN.";
  if (m.includes("acesso_encerrado")) return "Este celular saiu do app. Entre de novo com o código do dono.";
  if (m.includes("funcao_nao_permite_caixa")) return "O dono ainda não liberou o caixa para você. Peça para ele ligar \"Caixa\" no seu nome, na Equipe.";
  if (m.includes("caixa_desligado")) return "O dono desligou este caixa.";
  if (m.includes("pagamento_menor_que_total")) return "O pagamento não cobre o total da venda.";
  if (m.includes("pagamento_maior_que_total")) return "Pix, cartão e fiado não podem passar do total. Só o dinheiro tem troco.";
  if (m.includes("telefone_cliente_invalido")) return "Telefone do cliente inválido: use DDD + número.";
  if (m.includes("nome_cliente_invalido")) return "Escreva o nome do cliente (pelo menos 2 letras).";
  if (/fetch|network|Failed to|Load failed/i.test(m)) return "Sem internet. A venda não foi enviada: confira a conexão e toque em tentar de novo.";
  return "Não foi possível concluir agora. Tente de novo.";
}

/** Toque curto de "bip" e vibração ao ler um código. */
let audio: AudioContext | null = null;
export function bip() {
  try {
    navigator.vibrate?.(40);
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const o = audio.createOscillator(); const g = audio.createGain();
    o.frequency.value = 1900; g.gain.value = 0.08;
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.08);
  } catch { /* sem som: segue */ }
}
