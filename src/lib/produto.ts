import type { EntityId } from "@/lib/identidade";
import type { Deposito } from "@/lib/deposito";
import type { AreaVenda } from "@/lib/areaVenda";
import type { Validade } from "@/lib/validade";
import type { Embalagem } from "@/lib/embalagem";

export type Supplier = { id: EntityId; nome: string; tel: string; email: string; dbId?: string | undefined };
/** `uid` liga a variação à sua configuração de depósito, sem depender da posição na lista. */
export type Variation = { tam: string; cor: string; qtd: number; codigo?: string | undefined; uid?: string | undefined };
export type Product = {
  id: EntityId; codigo: string; nome: string; compra: number; venda: number; unidade: string; categoria: string;
  detalhes: Record<string, string>; variacoes: Variation[]; fornecedor: EntityId | null;
  deposito?: Deposito | undefined;
  /** Área de venda (gôndola, prateleira, arara...). Não confundir com `venda`, que é o preço. */
  areaVenda?: AreaVenda | undefined;
  /** Controle de validade e divisão das contagens confirmadas por vencimento/lote. */
  validade?: Validade | undefined;
  /** Como chega do fornecedor (caixa, fardo...). Vazio = por unidade. Não vale para loja de roupas. */
  embalagens?: Embalagem[] | undefined;
  /** Vínculo com o banco: id real e áreas cuja contagem inicial já foi registrada ("deposito:_", "venda:<uid>"). */
  db?: { id: string; contadas: string[] } | undefined;
  /** Só true depois que o usuário marcou a confirmação do vencimento do lote. */
  confirmarVencimento?: boolean | undefined;
};
