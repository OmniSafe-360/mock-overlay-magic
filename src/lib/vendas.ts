import { formatarCentavos as brl } from "@/lib/formatacao";
/* Vendas pelo caixa do mercado (Fase 3): situação de cada caixa, resumo do dia e textos dos itens vendidos.
 * Regra do dono: só desconta da gôndola quando a venda é FINALIZADA no caixa (a nota do cupom só existe depois). Não grava nada. */
import { qtdUn } from "@/lib/deposito";

export type Caixa = {
  id: string; nome: string;
  /** Código de 8 números para ligar (some depois de usado). */
  codigo: string | null; codigoGeradoEm: string | null;
  ligadoEm: string | null; desligadoEm: string | null;
  ultimoContatoEm: string | null; ultimaVendaEm: string | null;
  aparelho: string | null;
  /** Caixa no celular de um funcionário (app Omni Operação). */ tipo?: "celular" | undefined;
};
export type SituacaoItemVenda = "baixado" | "sem_cadastro" | "conferir" | "ignorado" | "cancelado";
export type ItemVenda = {
  id: string; n: number; codigoPdv: string; codigoBarras: string | null; descricao: string;
  qtdNota: number; unidadeNota: string | null; valor: number; // valor em centavos
  produtoId: string | null; qtdUnidades: number | null; qtdBaixada: number; qtdFaltou: number;
  situacao: SituacaoItemVenda; motivo: string | null;
};
export type Venda = {
  id: string; caixaId: string; /** Chave da nota (vazia na venda pelo celular). */ chave: string | null; numero: number | null;
  /** Venda feita no caixa do celular (sem nota fiscal). */ celular?: boolean | undefined; troco?: number | undefined;
  emitidaEm: string | null; recebidaEm: string; total: number; // centavos
  situacao: "finalizada" | "cancelada"; canceladaEm: string | null;
  pagamentos: { forma: string; valor: number }[];
  itens: ItemVenda[];
};

/** Horas que o código de ligar vale (igual ao banco). */
export const HORAS_CODIGO_CAIXA = 24;
/** Sem contato do computador do caixa por mais que isso = "parado". */
export const MINUTOS_SEM_CONTATO = 15;

/** "1234 5678". */
export const codigoCaixaTexto = (c: string | null | undefined) => (c ? `${c.slice(0, 4)} ${c.slice(4)}`.trim() : "");

export type SituacaoCaixa = "aguardando" | "codigo_vencido" | "ligado" | "parado" | "desligado" | "celular";
export function situacaoCaixa(c: Caixa, agora = Date.now()): SituacaoCaixa {
  if (c.desligadoEm) return "desligado";
  if (c.tipo === "celular") return "celular";
  if (!c.ligadoEm) {
    const venceu = c.codigoGeradoEm ? agora - Date.parse(c.codigoGeradoEm) > HORAS_CODIGO_CAIXA * 3600_000 : true;
    return venceu ? "codigo_vencido" : "aguardando";
  }
  const contato = c.ultimoContatoEm ? Date.parse(c.ultimoContatoEm) : 0;
  return agora - contato > MINUTOS_SEM_CONTATO * 60_000 ? "parado" : "ligado";
}

/** "agora", "há 5 min", "há 2 h", "ontem às 18:40", "03/10 às 09:12". */
export function haQuanto(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  const min = Math.floor((agora - t) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 12) return `há ${h} h`;
  const d = new Date(t);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const ontem = new Date(agora - 86_400_000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const hoje = new Date(agora).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return dia === hoje ? `hoje às ${hora}` : dia === ontem ? `ontem às ${hora}` : `${dia} às ${hora}`;
}

/** Hora da venda: "14:32". */
export const horaVenda = (v: Pick<Venda, "emitidaEm" | "recebidaEm">) =>
  new Date(v.emitidaEm ?? v.recebidaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Frase curta da situação do caixa, com a cor. */
export function textoCaixa(c: Caixa, agora = Date.now()): { nivel: "ok" | "atencao" | "urgente" | "info"; titulo: string; detalhe: string } {
  const s = situacaoCaixa(c, agora);
  const ultima = c.ultimaVendaEm ? `Última venda ${haQuanto(c.ultimaVendaEm, agora)}` : "Nenhuma venda ainda";
  switch (s) {
    case "ligado": return { nivel: "ok", titulo: "Ligado", detalhe: ultima };
    case "celular": return { nivel: "ok", titulo: "Caixa no celular", detalhe: ultima };
    case "parado": return { nivel: "atencao", titulo: "Sem contato", detalhe: `O computador do caixa não fala com o Omni ${haQuanto(c.ultimoContatoEm, agora)}. ${ultima}.` };
    case "aguardando": return { nivel: "info", titulo: "Aguardando ligar", detalhe: `Código ${codigoCaixaTexto(c.codigo)}` };
    case "codigo_vencido": return { nivel: "urgente", titulo: "Código venceu", detalhe: "Gere um código novo para ligar este caixa." };
    case "desligado": return { nivel: "info", titulo: "Desligado", detalhe: "Este caixa não manda vendas. Gere um código novo para religar." };
  }
}

/** "Válido até hoje às 18:40" / "amanhã às 09:12". */
export function validadeCodigoCaixa(c: Pick<Caixa, "codigoGeradoEm">, agora = Date.now()): string {
  if (!c.codigoGeradoEm) return "";
  const fim = Date.parse(c.codigoGeradoEm) + HORAS_CODIGO_CAIXA * 3600_000;
  const d = new Date(fim);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const dia = (x: number) => new Date(x).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return dia(fim) === dia(agora) ? `hoje às ${hora}` : dia(fim) === dia(agora + 86_400_000) ? `amanhã às ${hora}` : `${dia(fim)} às ${hora}`;
}

/** Próximo nome livre: "Caixa 1", "Caixa 2"… */
export function proximoNomeCaixa(caixas: Pick<Caixa, "nome">[]): string {
  const usados = new Set(caixas.map((c) => c.nome.trim().toLowerCase()));
  for (let i = 1; ; i++) if (!usados.has(`caixa ${i}`)) return `Caixa ${i}`;
}

/** Vendas do dia (data no fuso de São Paulo, "AAAA-MM-DD"). */
export const diaDaVenda = (v: Pick<Venda, "emitidaEm" | "recebidaEm">) =>
  new Date(v.emitidaEm ?? v.recebidaEm).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export type ResumoVendas = {
  n: number; total: number; canceladas: number;
  porCaixa: { caixaId: string; n: number; total: number }[];
  /** Itens vendidos que o Omni ainda não sabe qual produto é (ou quantidade quebrada). */
  pendentes: number;
  /** Unidades vendidas além do que o sistema tinha na gôndola (sinal para o antifurto). */
  faltou: number;
};
export function resumoVendas(vendas: Venda[], dia: string): ResumoVendas {
  const r: ResumoVendas = { n: 0, total: 0, canceladas: 0, porCaixa: [], pendentes: 0, faltou: 0 };
  const caixa = new Map<string, { caixaId: string; n: number; total: number }>();
  for (const v of vendas) {
    if (diaDaVenda(v) !== dia) continue;
    if (v.situacao === "cancelada") { r.canceladas += 1; continue; }
    r.n += 1; r.total += v.total;
    const c = caixa.get(v.caixaId) ?? { caixaId: v.caixaId, n: 0, total: 0 };
    c.n += 1; c.total += v.total; caixa.set(v.caixaId, c);
    for (const i of v.itens) {
      if (i.situacao === "sem_cadastro" || i.situacao === "conferir") r.pendentes += 1;
      if (i.qtdFaltou > 0) r.faltou += 1;
    }
  }
  r.porCaixa = [...caixa.values()].sort((a, b) => b.total - a.total);
  return r;
}

/** O que aconteceu com um item vendido, em português. */
export function textoItemVenda(i: ItemVenda, unidadeProduto?: string, area = "gôndola"): { nivel: "ok" | "atencao" | "info" | "urgente"; texto: string } {
  const un = unidadeProduto ?? "Unidade";
  switch (i.situacao) {
    case "baixado":
      return i.qtdFaltou > 0
        ? { nivel: "atencao", texto: `Saiu da ${area}: ${qtdUn(i.qtdBaixada, un)}. Faltou ${qtdUn(i.qtdFaltou, un)} (o sistema não tinha)` }
        : { nivel: "ok", texto: `Saiu da ${area}: ${qtdUn(i.qtdBaixada, un)}` };
    case "sem_cadastro": return { nivel: "urgente", texto: "Vendido sem cadastro: diga qual produto é" };
    case "conferir": return { nivel: "urgente", texto: i.motivo === "quantidade_quebrada" ? "Quantidade quebrada para este produto: confira" : "Confira este item" };
    case "ignorado": return { nivel: "info", texto: "Não controlado no estoque" };
    case "cancelado": return { nivel: "info", texto: `Venda cancelada: voltou para a ${area}` };
  }
}

export { brl };

const FORMAS: Record<string, string> = {
  "01": "Dinheiro", "02": "Cheque", "03": "Cartão de crédito", "04": "Cartão de débito", "05": "Crédito loja", "10": "Vale-alimentação",
  "11": "Vale-refeição", "12": "Vale-presente", "13": "Vale-combustível", "15": "Boleto", "16": "Depósito", "17": "Pix", "18": "Transferência",
  "19": "Fidelidade", "90": "Sem pagamento", "99": "Outros",
  dinheiro: "Dinheiro", pix: "Pix", credito: "Cartão de crédito", debito: "Cartão de débito", cartao: "Cartão", fiado: "Fiado",
};
/** Forma de pagamento da nota (código da Receita ou texto) em português. */
export const formaPagamento = (f: string) => FORMAS[f.trim().toLowerCase()] ?? FORMAS[f.trim().padStart(2, "0")] ?? f;

/* ---------- vendido sem cadastro (Fase 3.4) ---------- */
export type ItemPendente = {
  id: string; codigoPdv: string; codigoBarras: string | null; descricao: string; qtdNota: number; unidadeNota: string | null;
  valor: number; situacao: "sem_cadastro" | "conferir"; motivo: string | null; produtoId: string | null; vendidoEm: string | null;
};
/** Um código do caixa ainda sem produto: resolver uma vez vale para todas as vendas dele (e para as próximas). */
export type GrupoPendente = {
  codigo: string; codigoBarras: string | null; descricao: string; unidadeNota: string | null; itemId: string;
  vendas: number; qtd: number; valor: number; ultimaEm: string | null; conferir: boolean; motivo: string | null;
};
/** Código do caixa para mostrar ("Sem código" no produto vendido pelo celular sem código). */
export const codigoVisivel = (c: string) => (c.startsWith("avulso:") ? "Sem código" : c);
export function agruparPendentes(itens: ItemPendente[]): GrupoPendente[] {
  const g = new Map<string, GrupoPendente>();
  for (const i of itens) {
    const x = g.get(i.codigoPdv) ?? { codigo: i.codigoPdv, codigoBarras: i.codigoBarras, descricao: i.descricao, unidadeNota: i.unidadeNota, itemId: i.id,
      vendas: 0, qtd: 0, valor: 0, ultimaEm: null, conferir: i.situacao === "conferir", motivo: i.motivo };
    x.vendas += 1; x.qtd = Math.round((x.qtd + i.qtdNota) * 1000) / 1000; x.valor += i.valor;
    if (i.vendidoEm && (!x.ultimaEm || i.vendidoEm > x.ultimaEm)) x.ultimaEm = i.vendidoEm;
    g.set(i.codigoPdv, x);
  }
  return [...g.values()].sort((a, b) => b.vendas - a.vendas || (b.ultimaEm ?? "").localeCompare(a.ultimaEm ?? ""));
}
/** Busca de produto pelo nome ou pelo código (sem acento, sem diferença de maiúscula). */
export const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
