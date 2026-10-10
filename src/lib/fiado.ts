/* Fiado (C4): quanto cada cliente deve, desde quando, e o histórico (compras no caixa do celular, pagamentos, cancelamentos).
 * A compra no fiado soma na conta; pagamento e venda cancelada descontam. Valores em centavos. Não grava nada. */
import { formatarCentavos as brl } from "@/lib/formatacao";
import { normalizar } from "@/lib/vendas";

export type ClienteFiado = { id: string; nome: string; telefone: string | null; ativo: boolean; criadoEm: string };
export type MovimentoFiado = {
  id: string; clienteId: string; tipo: "compra" | "pagamento" | "cancelamento"; valor: number;
  vendaNumero: number | null; forma: "dinheiro" | "pix" | "cartao" | null; observacao: string | null; criadoEm: string;
};
export type ContaFiado = ClienteFiado & {
  deve: number;
  /** Desde quando a conta está aberta (a compra que fez a conta sair do zero). */ desde: string | null;
  ultimaCompra: string | null; ultimoPagamento: string | null;
  movimentos: MovimentoFiado[];
};

const sinal = (m: MovimentoFiado) => (m.tipo === "compra" ? m.valor : -m.valor);

export function contasFiado(clientes: ClienteFiado[], movs: MovimentoFiado[]): ContaFiado[] {
  return clientes.map((c) => {
    const ms = movs.filter((m) => m.clienteId === c.id).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
    let deve = 0; let desde: string | null = null;
    for (const m of ms) {
      const antes = deve;
      deve += sinal(m);
      if (antes <= 0 && deve > 0) desde = m.criadoEm;
      if (deve <= 0) desde = null;
    }
    const ult = (t: MovimentoFiado["tipo"]) => [...ms].reverse().find((m) => m.tipo === t)?.criadoEm ?? null;
    return { ...c, deve: Math.max(0, deve), desde, ultimaCompra: ult("compra"), ultimoPagamento: ult("pagamento"), movimentos: [...ms].reverse() };
  }).sort((a, b) => b.deve - a.deve || (a.desde ?? "9").localeCompare(b.desde ?? "9") || a.nome.localeCompare(b.nome, "pt-BR"));
}

export type ResumoFiado = { total: number; clientes: number; antigos: number };
/** Total a receber, quantos clientes devem e quantos devem há mais de 30 dias. */
export function resumoFiado(contas: ContaFiado[], agora = Date.now()): ResumoFiado {
  const devendo = contas.filter((c) => c.deve > 0);
  return {
    total: devendo.reduce((t, c) => t + c.deve, 0), clientes: devendo.length,
    antigos: devendo.filter((c) => c.desde && agora - Date.parse(c.desde) > DIAS_ANTIGO * 86_400_000).length,
  };
}
export const DIAS_ANTIGO = 30;

/** "há 3 dias", "hoje", "há 2 meses". */
export function haQuantoTempo(iso: string, agora = Date.now()): string {
  const dias = Math.floor((agora - Date.parse(iso)) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 60) return `há ${dias} dias`;
  return `há ${Math.floor(dias / 30)} meses`;
}

export const FORMA_FIADO: Record<"dinheiro" | "pix" | "cartao", string> = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão" };
export function textoMovimento(m: MovimentoFiado): string {
  if (m.tipo === "compra") return `Comprou${m.vendaNumero ? ` (venda nº ${m.vendaNumero})` : ""}`;
  if (m.tipo === "cancelamento") return `Venda cancelada${m.vendaNumero ? ` (nº ${m.vendaNumero})` : ""}`;
  return `Pagou${m.forma ? ` em ${FORMA_FIADO[m.forma].toLowerCase()}` : ""}`;
}

/** Mensagem para cobrar pelo WhatsApp, educada. */
export function mensagemCobranca(c: Pick<ContaFiado, "nome" | "deve">, comercio: string): string {
  return `Olá, ${c.nome.split(" ")[0]}! Tudo bem? Aqui é do ${comercio}. Sua conta do fiado está em ${brl(c.deve)}. Quando puder, passe aqui para acertar. Obrigado!`;
}
/** Link do WhatsApp com o número do Brasil (DDD + número). */
export const linkWhats = (telefone: string | null, texto: string) =>
  `https://wa.me/${telefone ? `55${telefone.replace(/\D/g, "")}` : ""}?text=${encodeURIComponent(texto)}`;

export const buscarConta = (contas: ContaFiado[], q: string) => {
  const t = normalizar(q);
  return t ? contas.filter((c) => normalizar(c.nome).includes(t) || (c.telefone ?? "").includes(t.replace(/\D/g, "") || "§")) : contas;
};
