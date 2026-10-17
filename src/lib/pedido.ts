import type { EntityId } from "@/lib/identidade";
/* Pedido de compra (etapa D2a): sugestão do que comprar, quantidade em embalagem fechada, texto da mensagem e totais.
 * O pedido não mexe no estoque. Preços em centavos. */
import type { Product, Supplier, Variation } from "@/lib/produto";
import type { StoreData } from "@/components/StoreSetup";
import { aceitaFracao, fmtQ, qtdUn } from "@/lib/deposito";
import type { Embalagem } from "@/lib/embalagem";
import type { Recebimento } from "@/lib/recebimento";
import { situacaoProduto } from "@/lib/situacao";

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
  /** Conta a pagar (D2c). valor em centavos: o informado pelo fornecedor ou corrigido pelo dono. */
  pagamento?: { situacao: "a_pagar" | "pago" | null; vencimento: string | null; pagoEm: string | null; valor?: number | null | undefined } | undefined;
  /** Recebimento pelo app do funcionário (E2): o em contagem, ou o mais recente. */
  recebimento?: Recebimento | null | undefined;
  /** A4: todas as entregas do pedido, da mais antiga para a mais nova. */
  recebimentos?: Recebimento[] | undefined;
  /** A4: o dono disse que não vem mais nada. */
  entregaEncerrada?: boolean | undefined;
};
/** A4: todas as entregas do pedido (as antigas sem a lista completa só têm a última). */
export const entregasDoPedido = (p: Pick<Pedido, "recebimento" | "recebimentos">): Recebimento[] =>
  p.recebimentos ?? (p.recebimento ? [p.recebimento] : []);
/** A4: quanto ainda falta chegar de cada produto/variação do pedido (unidades de venda). */
function faltaPorProduto(p: Pick<Pedido, "itens">): Map<string, { produtoId: string; falta: number }> {
  const falta = new Map<string, { produtoId: string; falta: number }>();
  for (const i of p.itens) {
    const k = `${i.produtoId}:${i.variacaoId ?? ""}`;
    const esperado = i.qtdConfirmada != null ? (i.qtdConfirmada * i.qtdUnidades) / i.qtdEmbalagens : i.qtdUnidades;
    const atual = falta.get(k) ?? { produtoId: i.produtoId, falta: 0 };
    falta.set(k, { produtoId: i.produtoId, falta: atual.falta + esperado - (i.qtdRecebida ?? 0) });
  }
  return falta;
}
/** A4: o pedido espera o resto: chegou em parte, o dono não encerrou e ainda falta algum produto. */
export function esperaResto(p: Pick<Pedido, "situacao" | "entregaEncerrada" | "itens">): boolean {
  if (p.situacao !== "recebido_parcial" || p.entregaEncerrada) return false;
  return [...faltaPorProduto(p).values()].some((v) => v.falta > 1e-9);
}
/** Produtos que ainda estão pedidos: de pedido aberto; no recebido em parte, só os que ainda faltam chegar (Codex #191). */
export function produtosAindaPedidos(pedidos: Pedido[]): Set<string> {
  return new Set(pedidos.filter(pedidoAberto).flatMap((p) => p.situacao === "recebido_parcial"
    ? (esperaResto(p) ? [...faltaPorProduto(p).values()].filter((v) => v.falta > 1e-9).map((v) => v.produtoId) : [])
    : p.itens.map((i) => i.produtoId)));
}
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
/** Preço estimado de uma unidade de venda (centavos, sem arredondar): o da embalagem dividido, senão o preço de compra.
 * Sem arredondar, o total salvo bate com o da montagem (caixa de R$ 10,00 com 12 = R$ 10,00, não R$ 9,96). */
export const precoUnidade = (l: Pick<LinhaPedido, "p" | "embalagem">) =>
  l.embalagem?.preco ? l.embalagem.preco / l.embalagem.qtd : l.p.compra;
/** Preço por unidade de venda para o banco (reais, 8 casas) e de volta (centavos, sem arredondar o centavo). */
export const precoParaBanco = (centavos: number) => Math.round(centavos * 1e6) / 1e8;
export const precoDoBanco = (v: unknown): number | null => (v == null ? null : Math.round(Number(v) * 1e8) / 1e6);
export const totalLinha = (l: Pick<LinhaPedido, "p" | "embalagem" | "qtd">) =>
  l.embalagem?.preco ? Math.round(l.embalagem.preco * l.qtd) : Math.round(l.p.compra * unidadesDaLinha(l));
export const totalLinhas = (ls: LinhaPedido[]) => ls.reduce((s, l) => s + totalLinha(l), 0);

/** "2 caixas (24 frascos)" ou "10 pacotes". */
const PLURAL_EMB: Record<string, string> = { Caixa: "caixas", Fardo: "fardos", Pacote: "pacotes", Display: "displays", Saco: "sacos", Pallet: "pallets", Milheiro: "milheiros", Embalagem: "embalagens" };
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

/** Sugestão de pedido: produtos que chegaram ao mínimo do depósito ou acabaram, agrupados por fornecedor.
 *  B4: a mesma regra dos quadros "Comprar" e "Acabaram" do "Atenção hoje" (`situacaoProduto`): mínimo do depósito
 *  (precisa ter mínimo) ou o produto todo zerado. Produtos já num pedido aberto não entram. Roupas: por variação. */
export function sugerirPedido(products: Product[], suppliers: Supplier[], jaPedidos: Set<string>): { porFornecedor: Map<EntityId, LinhaPedido[]>; semFornecedor: Product[] } {
  const porFornecedor = new Map<EntityId, LinhaPedido[]>();
  const semFornecedor: Product[] = [];
  const m = (n: number) => Math.round(n * 1000);
  for (const p of [...products].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
    if (!p.db?.id || jaPedidos.has(p.db.id)) continue;
    const s = situacaoProduto(p, "", hojeISO());
    const alvos = s.variacoes.length
      ? s.variacoes.map((x) => ({ v: p.variacoes.find((v) => (v.uid ?? "") === x.uid) ?? null, ...x }))
      : [{ v: null, ...s.qtd }];
    const linhas: LinhaPedido[] = [];
    for (const a of alvos) {
      const zerado = a.total != null && m(a.total) === 0;
      const comprar = a.dep != null && a.depMin != null && m(a.dep) <= m(a.depMin);
      if (!zerado && !comprar) continue;
      /* Sem área de depósito, a quantidade sai da área de venda (o que cabe nela). */
      const falta = p.deposito
        ? faltaParaMaximo(a.dep ?? 0, a.depMin, a.depMax) ?? (a.depMin && a.depMin > 0 ? a.depMin : 1)
        : faltaParaMaximo(a.ven ?? 0, a.venMin, a.venMax) ?? (a.venMin && a.venMin > 0 ? a.venMin : 1);
      const q = sugerirQuantidade(falta, p.unidade, a.v ? [] : p.embalagens ?? []);
      linhas.push({ chave: chaveLinha(p, a.v), p, variacao: a.v, embalagem: q.embalagem, qtd: q.qtd });
    }
    if (!linhas.length) continue;
    if (p.fornecedor == null || !suppliers.some((f) => f.id === p.fornecedor)) { semFornecedor.push(p); continue; }
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

/** Texto do pedido para WhatsApp e e-mail (negrito/itálico do WhatsApp). Só usa dados reais do pedido. */
export function textoPedido(a: { numero: number; comercio: StoreData; fornecedor: string; linhas: LinhaPedido[]; observacao?: string; link?: string | undefined }): string {
  const c = a.comercio;
  const endereco = [c.rua && `${c.rua}${c.numero ? `, ${c.numero}` : ""}`, c.bairro, c.cidade && `${c.cidade}/${c.uf}`].filter(Boolean).join(" – ");
  const itens = a.linhas.flatMap((l, k) => [`${k + 1}. ${nomeLinha(l)}`, `   Quantidade: ${quantidadeTexto(l)}`, ""]);
  const t = [
    "📦 *PEDIDO DE COMPRA*", "", "*OMNISAFE 360°*", "",
    `Olá, ${a.fornecedor}!`, "",
    `Você recebeu um pedido de compra de *${c.nome}*.`, "",
    `*PEDIDO Nº ${a.numero}*`, "",
    "*PRODUTOS SOLICITADOS*", "",
    ...itens,
  ];
  if (endereco) t.push("📍 *LOCAL DE ENTREGA*", "", endereco, "");
  if (a.observacao?.trim()) t.push("*RECADO*", "", a.observacao.trim(), "");
  if (a.link) t.push("✅ *VISUALIZAR E CONFIRMAR PEDIDO*", "", "Acesse o link abaixo para consultar os detalhes:", "", a.link, "");
  else t.push("Por favor, confirme o preço e a previsão de entrega.", "");
  t.push("Agradecemos pela parceria!", "", `*${c.nome}*`, "_Organizado pelo OmniSafe 360°_");
  return t.join("\n");
}

/** Linhas de um pedido salvo, para mostrar e reenviar. A conversão é a registrada
 * no pedido; mudar a embalagem no cadastro não muda uma compra anterior.
 * `p` continua sendo o produto atual, para abrir sua ficha sem alterar o cadastro. */
export function linhasDoPedido(pedido: Pedido, products: Product[]): LinhaPedido[] {
  return pedido.itens.map((i, k) => {
    const p = products.find((x) => x.db?.id === i.produtoId);
    const prod: Product = p ?? { id: -1 - k, codigo: "", nome: "Produto removido", compra: 0, venda: 0, unidade: "Unidade", categoria: "", detalhes: {}, variacoes: [], fornecedor: null };
    const v = i.variacaoId ? prod.variacoes.find((x) => x.uid === i.variacaoId) ?? null : null;
    const e = i.embalagemId ? prod.embalagens?.find((x) => x.uid === i.embalagemId) ?? null : null;
    const embalagem = i.embalagemId ? {
      uid: i.embalagemId, tipo: e?.tipo ?? "Embalagem", qtd: i.qtdUnidades / i.qtdEmbalagens,
      codigo: e?.codigo ?? "", preco: e?.preco ?? 0,
    } : null;
    return { chave: `${i.produtoId}:${i.variacaoId ?? "_"}:${k}`, p: prod, variacao: v, embalagem, qtd: i.qtdEmbalagens };
  });
}
/** Valor estimado guardado no item, em centavos. Ausente não é preço zero. */
export const valorItemPedido = (i: ItemPedido): number | null => i.precoEstimado == null ? null : Math.round(i.precoEstimado * i.qtdUnidades);
export const totalPedido = (pedido: Pedido) => pedido.itens.reduce((s, i) => s + (valorItemPedido(i) ?? 0), 0);

/** B5: troca a embalagem mantendo o total em unidades de venda. Embalagem fechada arredonda para cima (mínimo 1).
 * `mudou` = o total em unidades ficou diferente (o app avisa). */
export function trocarEmbalagem(l: LinhaPedido, emb: Embalagem | null): { linha: LinhaPedido; antes: number; depois: number; mudou: boolean } {
  const antes = unidadesDaLinha(l);
  const qtd = emb ? Math.max(1, Math.ceil(antes / emb.qtd - 1e-9)) : Math.max(arredonda(antes, l.p.unidade), aceitaFracao(l.p.unidade) ? 0.001 : 1);
  const linha = { ...l, embalagem: emb, qtd };
  const depois = unidadesDaLinha(linha);
  return { linha, antes, depois, mudou: Math.abs(depois - antes) > 1e-9 };
}

/** B6: total estimado do que o fornecedor vai mandar. Com resposta, usa a quantidade confirmada (em embalagens);
 * item que ele não tem conta zero. Sem resposta, igual a `totalPedido`. */
export function totalConfirmado(pedido: Pedido): number {
  return pedido.itens.reduce((s, i) => {
    const v = valorItemPedido(i); if (v == null) return s;
    if (i.qtdConfirmada == null || !i.qtdEmbalagens) return s + v;
    return s + Math.round(v * (i.qtdConfirmada / i.qtdEmbalagens));
  }, 0);
}
