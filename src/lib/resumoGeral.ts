/* Resumo de todos os comércios para a tela inicial e o menu Alertas do dono.
 * Usa as mesmas regras do "Atenção hoje" de cada comércio (situacao.ts, pagamento.ts, recebimento.ts): nunca inventa número. */
import type { Product } from "@/components/ProductArea";
import { atencaoHoje, type GrupoAtencao } from "@/lib/situacao";
import { pedidoAberto, type Pedido } from "@/lib/pedido";
import { resumoPagamentos } from "@/lib/pagamento";
import { precisaDecidir } from "@/lib/recebimento";

export type ResumoComercio = {
  produtos: number;
  /** Produtos com aviso vermelho (vencido, acabou, preço, lugar errado). */
  urgentes: number;
  /** Produtos para repor na gôndola/área de venda. */
  repor: number;
  /** Produtos para comprar (já pedidos não entram). */
  comprar: number;
  /** Produtos que vencem em breve. */
  vencendo: number;
  contasAtrasadas: number;
  contasHoje: number;
  /** Itens recebidos esperando o dono decidir. */
  entregasDecidir: number;
  /** Códigos vendidos no caixa que o Omni não sabe qual produto é. */
  vendidoSemCadastro: number;
  /** Perdas para confirmar + diferenças para explicar (aba Diferenças). */
  diferencasDecidir: number;
  /** Alertas de antifurto: produtos visados, lugares com muitas faltas e limite do mês. */
  antifurto: number;
  /** Vendas finalizadas hoje (centavos). */
  vendasHojeN: number;
  vendasHojeTotal: number;
};

/** Produtos (id do banco) que estão num pedido em andamento. */
export const produtosJaPedidos = (pedidos: Pedido[]) => new Set(pedidos.filter(pedidoAberto).flatMap((p) => p.itens.map((i) => i.produtoId)));

export const entregasParaDecidir = (pedidos: Pedido[]) => pedidos.reduce((n, p) => n + (p.recebimento?.itens.filter(precisaDecidir).length ?? 0), 0);

export function resumoComercio(products: Product[], tipo: string, hoje: string, pedidos: Pedido[],
  vendas: { semCadastro?: number | undefined; hojeN?: number | undefined; hojeTotal?: number | undefined } = {}, diferencas = 0, antifurto = 0): ResumoComercio {
  const grupos = atencaoHoje(products, tipo, hoje, () => undefined, produtosJaPedidos(pedidos));
  const distintos = (fil: (g: GrupoAtencao) => boolean) => new Set(grupos.filter(fil).flatMap((g) => g.itens.map((i) => i.p.id))).size;
  const contas = resumoPagamentos(pedidos, hoje);
  return {
    produtos: products.length,
    urgentes: distintos((g) => g.nivel === "urgente"),
    repor: distintos((g) => g.tipo === "repor"),
    comprar: distintos((g) => g.tipo === "comprar"),
    vencendo: distintos((g) => g.tipo === "vencendo"),
    contasAtrasadas: contas.atrasados.n,
    contasHoje: contas.hoje.n,
    entregasDecidir: entregasParaDecidir(pedidos),
    vendidoSemCadastro: vendas.semCadastro ?? 0,
    diferencasDecidir: diferencas,
    antifurto,
    vendasHojeN: vendas.hojeN ?? 0,
    vendasHojeTotal: vendas.hojeTotal ?? 0,
  };
}

/** Assuntos para resolver agora: produtos em vermelho, contas atrasadas, entregas esperando decisão, vendidos sem cadastro e perdas/diferenças. */
export const paraResolver = (r: ResumoComercio) => r.urgentes + r.contasAtrasadas + r.entregasDecidir + r.vendidoSemCadastro + r.diferencasDecidir;
/** Assuntos para ficar de olho. */
export const deOlho = (r: ResumoComercio) => r.repor + r.comprar + r.vencendo + r.contasHoje + r.antifurto;

export function somaResumos(rs: ResumoComercio[]): ResumoComercio {
  const z: ResumoComercio = { produtos: 0, urgentes: 0, repor: 0, comprar: 0, vencendo: 0, contasAtrasadas: 0, contasHoje: 0, entregasDecidir: 0,
    vendidoSemCadastro: 0, diferencasDecidir: 0, antifurto: 0, vendasHojeN: 0, vendasHojeTotal: 0 };
  for (const r of rs) for (const k of Object.keys(z) as (keyof ResumoComercio)[]) z[k] += r[k];
  return z;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Frase curta do cartão do comércio, com a cor. `extra` = o que é para ficar de olho, quando também há algo vermelho. */
export function fraseComercio(r: ResumoComercio): { nivel: "urgente" | "atencao" | "ok" | "vazio"; texto: string; extra?: string | undefined } {
  if (!r.produtos && !paraResolver(r) && !deOlho(r)) return { nivel: "vazio", texto: "Nenhum produto cadastrado ainda" };
  const partes = [
    r.repor && `${r.repor} para repor`,
    r.comprar && `${r.comprar} para comprar`,
    r.vencendo && plural(r.vencendo, "vence em breve", "vencem em breve"),
    r.contasHoje && plural(r.contasHoje, "conta vence hoje", "contas vencem hoje"),
    r.antifurto && plural(r.antifurto, "alerta de falta", "alertas de falta"),
  ].filter(Boolean).join(" · ");
  const resolver = paraResolver(r);
  if (resolver) return { nivel: "urgente", texto: `${resolver} para resolver agora`, ...(partes ? { extra: partes } : {}) };
  if (partes) return { nivel: "atencao", texto: partes };
  return { nivel: "ok", texto: "Tudo certo" };
}
