/* Pedido de compra (etapa D2a): sugestão do que comprar, quantidade em embalagem fechada, texto da mensagem e totais.
 * O pedido não mexe no estoque. Preços em centavos. */
import type { Product, Supplier, Variation } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";
import { aceitaFracao, fmtQ, qtdUn } from "@/lib/deposito";
import type { Embalagem } from "@/lib/embalagem";

export type SituacaoPedido = "rascunho" | "enviado" | "aceito" | "aceito_ajustes" | "recusado" | "recebido_parcial" | "recebido" | "cancelado";
export type CanalPedido = "whatsapp" | "email" | "copiado";

export type ItemPedido = {
  produtoId: string; variacaoId: string | null; embalagemId: string | null;
  qtdEmbalagens: number; qtdUnidades: number; precoEstimado: number | null;
  qtdConfirmada: number | null; qtdRecebida: number | null;
};
export type FormaPagamento = "a_vista" | "pix" | "boleto" | "a_prazo";
/** Resposta do fornecedor pelo link (D2b). Valor em centavos; datas AAAA-MM-DD. */
export type RespostaPedido = { em: string; previsaoEntrega: string | null; valorTotal: number | null; forma: FormaPagamento | null; prazoDias: number | null; recado: string };
export type Pedido = {
  id: string; numero: number; fornecedorId: string; situacao: SituacaoPedido; canal: CanalPedido | null;
  enviadoEm: string | null; observacao: string; token: string; criadoEm: string; itens: ItemPedido[];
  resposta?: RespostaPedido | null | undefined;
  pagamento?: { situacao: "a_pagar" | "pago" | null; vencimento: string | null; pagoEm: string | null } | undefined;
};
export const FORMA_TXT: Record<FormaPagamento, string> = { a_vista: "À vista", pix: "Pix", boleto: "Boleto", a_prazo: "A prazo" };
/** "Boleto 30 dias", "Pix". */
export const formaTexto = (forma: FormaPagamento | null, prazo: number | null) =>
  !forma ? "" : (forma === "boleto" || forma === "a_prazo") && prazo ? `${FORMA_TXT[forma]} ${prazo} dias` : FORMA_TXT[forma];
/** Endereço do link do fornecedor. */
export const linkPedido = (token: string, origem = typeof window === "undefined" ? "https://mock-overlay-magic.lovable.app" : window.location.origin) =>
  `${origem}/pedido/${token}`;

export const SITUACAO_TXT: Record<SituacaoPedido, string> = {
  rascunho: "Não enviado", enviado: "Aguardando resposta", aceito: "Aceito", aceito_ajustes: "Aceito com ajustes", recusado: "Recusado",
  recebido_parcial: "Recebido em parte", recebido: "Recebido", cancelado: "Cancelado",
};
export const CANAL_TXT: Record<CanalPedido, string> = { whatsapp: "pelo WhatsApp", email: "por e-mail", copiado: "texto copiado" };
/** Pedido que ainda vai chegar: o produto não deve ser sugerido de novo. */
export const pedidoAberto = (p: Pick<Pedido, "situacao">) => ["rascunho", "enviado", "aceito", "aceito_ajustes", "recebido_parcial"].includes(p.situacao);
export const pedidoFechado = (p: Pick<Pedido, "situacao">) => ["recebido", "cancelado"].includes(p.situacao);

/** Linha do pedido em montagem, na tela. `qtd` = quantas embalagens (ou unidades de venda, sem embalagem). */
export type LinhaPedido = { chave: string; p: Product; variacao: Variation | null; embalagem: Embalagem | null; qtd: number };

const arredonda = (n: number, unidade: string) => (aceitaFracao(unidade) ? Math.ceil(n * 1000) / 1000 : Math.ceil(n));

/** Quanto falta para o depósito voltar ao máximo (sem máximo: dobro do mínimo). null = não dá para sugerir. */
export function faltaParaMaximo(qtd: number | null, min: number | null, max: number | null): number | null {
  if (qtd == null) return null;
  const alvo = max ?? (min != null ? min * 2 : null);
  if (alvo == null) return null;
  const f = Math.round((alvo - qtd) * 1000) / 1000;
  return f > 0 ? f : null;
}

/** Escolhe a embalagem e a quantidade: a maior embalagem que cabe no que falta; se nenhuma cabe, a menor. Sempre fechada. */
export function sugerirQuantidade(falta: number, unidade: string, embalagens: Embalagem[]): { embalagem: Embalagem | null; qtd: number } {
  if (!embalagens.length) return { embalagem: null, qtd: Math.max(arredonda(falta, unidade), aceitaFracao(unidade) ? 0.001 : 1) };
  const ordem = [...embalagens].sort((a, b) => b.qtd - a.qtd);
  const e = ordem.find((x) => x.qtd <= falta) ?? ordem[ordem.length - 1]!;
  return { embalagem: e, qtd: Math.max(1, Math.ceil(falta / e.qtd - 1e-9)) };
}

/** Total em unidades de venda de uma linha. */
export const unidadesDaLinha = (l: Pick<LinhaPedido, "embalagem" | "qtd">) => Math.round(l.qtd * (l.embalagem?.qtd ?? 1) * 1000) / 1000;
/** Preço estimado de uma unidade de venda (centavos): o da embalagem dividido, senão o preço de compra. */
export const precoUnidade = (l: Pick<LinhaPedido, "p" | "embalagem">) =>
  l.embalagem?.preco ? Math.round(l.embalagem.preco / l.embalagem.qtd) : l.p.compra;
export const totalLinha = (l: Pick<LinhaPedido, "p" | "embalagem" | "qtd">) =>
  l.embalagem?.preco ? Math.round(l.embalagem.preco * l.qtd) : Math.round(l.p.compra * unidadesDaLinha(l));
export const totalLinhas = (ls: LinhaPedido[]) => ls.reduce((s, l) => s + totalLinha(l), 0);

/** "2 caixas (24 frascos)" ou "10 pacotes". */
const PLURAL_EMB: Record<string, string> = { Caixa: "caixas", Fardo: "fardos", Pacote: "pacotes", Display: "displays", Saco: "sacos", Pallet: "pallets", Milheiro: "milheiros" };
/** "1 caixa", "3 caixas". */
export const embalagensTexto = (n: number, tipo: string) => `${fmtQ(n)} ${n === 1 ? tipo.toLowerCase() : PLURAL_EMB[tipo] ?? tipo.toLowerCase()}`;
export function quantidadeTexto(l: Pick<LinhaPedido, "p" | "embalagem" | "qtd">): string {
  if (!l.embalagem) return qtdUn(l.qtd, l.p.unidade);
  return `${embalagensTexto(l.qtd, l.embalagem.tipo)} (${qtdUn(unidadesDaLinha(l), l.p.unidade)})`;
}
/** Quantidade de um item na página do fornecedor ou na resposta: "2 caixas com 12 (24 frascos)" ou "10 pacotes". */
export function qtdItemTexto(i: { unidade: string; embalagem: string | null; porEmbalagem: number | null }, qtd: number): string {
  if (!i.embalagem || !i.porEmbalagem) return qtdUn(qtd, i.unidade);
  return `${embalagensTexto(qtd, i.embalagem)} com ${fmtQ(i.porEmbalagem)} (${qtdUn(Math.round(qtd * i.porEmbalagem * 1000) / 1000, i.unidade)})`;
}
/** Como o fornecedor respondeu um item: tudo, parte ou nada. */
export const respostaItem = (pedida: number, confirmada: number | null): "tudo" | "parte" | "nada" | null =>
  confirmada == null ? null : confirmada <= 0 ? "nada" : confirmada >= pedida ? "tudo" : "parte";
/** Data AAAA-MM-DD no fuso do aparelho. */
export const hojeISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** "sexta, 10/10". */
export const dataEntregaTexto = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a!, (m ?? 1) - 1, d ?? 1);
  return `${dt.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "")}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};
/** Resumo curto da resposta para o cartão do pedido: "Entrega sex., 10/10 · R$ 120,00 · Boleto 30 dias". */
export function resumoResposta(r: RespostaPedido, brl: (c: number) => string): string {
  return [r.previsaoEntrega && `Entrega ${dataEntregaTexto(r.previsaoEntrega)}`, r.valorTotal != null && brl(r.valorTotal), formaTexto(r.forma, r.prazoDias)].filter(Boolean).join(" · ");
}
export const nomeLinha = (l: Pick<LinhaPedido, "p" | "variacao">) => (l.variacao ? `${l.p.nome} — ${l.variacao.tam} · ${l.variacao.cor}` : l.p.nome);
export const chaveLinha = (p: Product, v: Variation | null) => `${p.id}:${v?.uid ?? "_"}`;

/** Sugestão de pedido: produtos que chegaram ao mínimo do depósito (ou acabaram), agrupados por fornecedor.
 *  Produtos já num pedido aberto não entram. Roupas: por variação. */
export function sugerirPedido(products: Product[], suppliers: Supplier[], jaPedidos: Set<string>): { porFornecedor: Map<number, LinhaPedido[]>; semFornecedor: Product[] } {
  const porFornecedor = new Map<number, LinhaPedido[]>();
  const semFornecedor: Product[] = [];
  for (const p of [...products].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
    if (!p.db?.id || jaPedidos.has(p.db.id) || !p.deposito) continue;
    const d = p.deposito;
    const alvos: { v: Variation | null; qtd: number | null; min: number | null; max: number | null }[] = d.vars && p.variacoes.length
      ? p.variacoes.map((v) => ({ v, qtd: d.vars?.[v.uid ?? ""]?.qtd ?? null, min: d.vars?.[v.uid ?? ""]?.min ?? null, max: d.vars?.[v.uid ?? ""]?.max ?? null }))
      : [{ v: null, qtd: d.qtd, min: d.min, max: d.max }];
    const linhas: LinhaPedido[] = [];
    for (const a of alvos) {
      const precisa = a.qtd != null && (a.qtd <= 0 || (a.min != null && a.qtd <= a.min));
      if (!precisa) continue;
      const falta = faltaParaMaximo(a.qtd, a.min, a.max) ?? (a.min && a.min > 0 ? a.min : 1);
      const s = sugerirQuantidade(falta, p.unidade, a.v ? [] : p.embalagens ?? []);
      linhas.push({ chave: chaveLinha(p, a.v), p, variacao: a.v, embalagem: s.embalagem, qtd: s.qtd });
    }
    if (!linhas.length) continue;
    if (p.fornecedor == null || !suppliers.some((s) => s.id === p.fornecedor)) { semFornecedor.push(p); continue; }
    porFornecedor.set(p.fornecedor, [...(porFornecedor.get(p.fornecedor) ?? []), ...linhas]);
  }
  return { porFornecedor, semFornecedor };
}

/** Linha manual (botão "Adicionar produto"): uma embalagem fechada, ou 1 unidade de venda. */
export function linhaManual(p: Product, v: Variation | null = null): LinhaPedido {
  const falta = faltaParaMaximo(p.deposito?.qtd ?? null, p.deposito?.min ?? null, p.deposito?.max ?? null) ?? 1;
  const s = sugerirQuantidade(falta, p.unidade, v ? [] : p.embalagens ?? []);
  return { chave: chaveLinha(p, v), p, variacao: v, embalagem: s.embalagem, qtd: s.qtd };
}

/** Texto do pedido para WhatsApp e e-mail. */
export function textoPedido(a: { numero: number; comercio: StoreData; fornecedor: string; linhas: LinhaPedido[]; observacao?: string; link?: string | undefined }): string {
  const c = a.comercio;
  const endereco = [c.rua && `${c.rua}${c.numero ? `, ${c.numero}` : ""}`, c.bairro, c.cidade && `${c.cidade}/${c.uf}`].filter(Boolean).join(" – ");
  const itens = a.linhas.map((l) => `• ${nomeLinha(l)} — ${quantidadeTexto(l)}`).join("\n");
  const linhas = [`Olá, ${a.fornecedor}! Segue o pedido nº ${a.numero} de ${c.nome}:`, "", itens, ""];
  if (endereco) linhas.push(`Entrega: ${endereco}`);
  if (a.observacao?.trim()) linhas.push(`Recado: ${a.observacao.trim()}`);
  linhas.push(a.link ? `Veja e confirme o pedido aqui: ${a.link}` : "Por favor, confirme o preço e a previsão de entrega. Obrigado!");
  return linhas.join("\n");
}

/** Linhas de um pedido salvo, para mostrar e reenviar (produto removido depois aparece com aviso). */
export function linhasDoPedido(pedido: Pedido, products: Product[]): LinhaPedido[] {
  return pedido.itens.map((i, k) => {
    const p = products.find((x) => x.db?.id === i.produtoId);
    const prod: Product = p ?? { id: -1 - k, codigo: "", nome: "Produto removido", compra: 0, venda: 0, unidade: "Unidade", categoria: "", detalhes: {}, variacoes: [], fornecedor: null };
    const v = i.variacaoId ? prod.variacoes.find((x) => x.uid === i.variacaoId) ?? null : null;
    const e = i.embalagemId ? prod.embalagens?.find((x) => x.uid === i.embalagemId) ?? null : null;
    const embalagem = e ?? (i.embalagemId ? { uid: i.embalagemId, tipo: "Caixa", qtd: i.qtdUnidades / i.qtdEmbalagens, codigo: "", preco: 0 } : null);
    return { chave: `${i.produtoId}:${i.variacaoId ?? "_"}:${k}`, p: prod, variacao: v, embalagem, qtd: i.qtdEmbalagens };
  });
}
export const totalPedido = (pedido: Pedido) => pedido.itens.reduce((s, i) => s + (i.precoEstimado ?? 0) * i.qtdUnidades, 0);
