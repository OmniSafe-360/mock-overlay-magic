/* Controle de pagamento dos pedidos (D2c): a pagar, vence hoje, atrasado, pago. Valores em centavos; datas AAAA-MM-DD. */
import { totalPedido, type Pedido } from "@/lib/pedido";

export type EstadoPagamento = "pago" | "atrasado" | "hoje" | "em_breve" | "a_pagar";

const dia = (iso: string) => { const [a, m, d] = iso.split("-").map(Number); return Date.UTC(a!, (m ?? 1) - 1, d ?? 1) / 86400000; };
/** Dias de `de` até `ate` (negativo = já passou). */
export const diasEntre = (de: string, ate: string) => Math.round(dia(ate) - dia(de));
export const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** Soma dias a uma data AAAA-MM-DD. */
export const somaDias = (iso: string, n: number) => new Date((dia(iso) + n) * 86400000).toISOString().slice(0, 10);

/** Valor da conta: o informado (fornecedor ou dono); sem isso, o total estimado do pedido. */
export function valorConta(p: Pedido): { valor: number; estimado: boolean } {
  const v = p.pagamento?.valor ?? p.resposta?.valorTotal ?? null;
  return v != null ? { valor: v, estimado: false } : { valor: totalPedido(p), estimado: true };
}

/** null = pedido sem conta registrada. */
export function estadoPagamento(p: Pedido, hoje: string): { estado: EstadoPagamento; dias: number | null } | null {
  const pg = p.pagamento;
  if (!pg?.situacao) return null;
  if (pg.situacao === "pago") return { estado: "pago", dias: null };
  if (!pg.vencimento) return { estado: "a_pagar", dias: null };
  const d = diasEntre(hoje, pg.vencimento);
  return { estado: d < 0 ? "atrasado" : d === 0 ? "hoje" : d <= 7 ? "em_breve" : "a_pagar", dias: d };
}

/** "Atrasado há 3 dias", "Vence hoje", "Vence amanhã", "Vence em 5 dias (14/10)", "Vence em 20/10", "Pago em 12/10". */
export function textoPagamento(p: Pedido, hoje: string): string {
  const e = estadoPagamento(p, hoje);
  if (!e) return "";
  const venc = p.pagamento?.vencimento;
  switch (e.estado) {
    case "pago": return p.pagamento?.pagoEm ? `Pago em ${dataBR(p.pagamento.pagoEm)}` : "Pago";
    case "atrasado": return `Atrasado há ${-e.dias! === 1 ? "1 dia" : `${-e.dias!} dias`} (venceu ${dataBR(venc!)})`;
    case "hoje": return "Vence hoje";
    case "em_breve": return e.dias === 1 ? "Vence amanhã" : `Vence em ${e.dias} dias (${dataBR(venc!)})`;
    default: return venc ? `Vence em ${dataBR(venc)}` : "A pagar";
  }
}

type Soma = { n: number; total: number };
export type ResumoPagamentos = { aPagar: Soma; atrasados: Soma; hoje: Soma; semana: Soma; esteMes: Soma; pagoEsteMes: Soma };
const zero = (): Soma => ({ n: 0, total: 0 });

/** Totais para a aba Pedidos e o "Atenção hoje". "Este mês" = vence até o fim do mês (inclui atrasados); "semana" = próximos 7 dias, sem hoje. */
export function resumoPagamentos(pedidos: Pedido[], hoje: string): ResumoPagamentos {
  const r: ResumoPagamentos = { aPagar: zero(), atrasados: zero(), hoje: zero(), semana: zero(), esteMes: zero(), pagoEsteMes: zero() };
  const mes = hoje.slice(0, 7);
  const soma = (s: Soma, v: number) => { s.n += 1; s.total += v; };
  for (const p of pedidos) {
    const e = estadoPagamento(p, hoje);
    if (!e) continue;
    const { valor } = valorConta(p);
    if (e.estado === "pago") { if (p.pagamento?.pagoEm?.slice(0, 7) === mes) soma(r.pagoEsteMes, valor); continue; }
    soma(r.aPagar, valor);
    if (e.estado === "atrasado") soma(r.atrasados, valor);
    if (e.estado === "hoje") soma(r.hoje, valor);
    if (e.estado === "em_breve") soma(r.semana, valor);
    const v = p.pagamento?.vencimento;
    if (!v || v.slice(0, 7) <= mes) soma(r.esteMes, valor);
  }
  return r;
}

/** Ordem da lista "A pagar": atrasados primeiro, depois por vencimento. */
export const ordemPagamento = (a: Pedido, b: Pedido) => (a.pagamento?.vencimento ?? "9999").localeCompare(b.pagamento?.vencimento ?? "9999");
