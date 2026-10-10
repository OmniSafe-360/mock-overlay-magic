/* Receber mercadoria (etapa E2). O funcionário conta às cegas (nunca vê quanto foi pedido); o servidor compara e
 * pede recontagem. Aqui ficam as contas da tela do funcionário e os textos do resultado para o dono. */
import { fmtQ, parseNum, qtdUn } from "@/lib/deposito";
import { totalContado } from "@/lib/embalagem";
import { fmtData, hojeEm, parseData } from "@/lib/validade";

/* ---------- funcionário ---------- */
export type ProdutoFunc = {
  produtoId: string; variacaoId: string | null; embalagemId: string | null; nome: string; unidade: string; codigo: string | null;
  variacao: string | null; controlaValidade: boolean; pedeLote: boolean; embalagens: { id: string; tipo: string; quantidade: number }[];
};
export type ParteValidade = { quantidade: string; vencimento: string; lote: string };
export type Contagem = {
  p: ProdutoFunc; fechadas: Record<string, string>; soltas: string; naoVeio: boolean;
  temAvaria: boolean; avaria: string; partes: ParteValidade[];
};
/** Como o produto aparece na lista do funcionário. */
export type EstadoItem = "falta" | "contado" | "recontar" | "conferido";

export const chaveProduto = (p: { produtoId: string; variacaoId: string | null }) => `${p.produtoId}:${p.variacaoId ?? "_"}`;
export const nomeProdutoFunc = (p: Pick<ProdutoFunc, "nome" | "variacao">) => (p.variacao ? `${p.nome} — ${p.variacao}` : p.nome);

export function novaContagem(p: ProdutoFunc): Contagem {
  const fechadas: Record<string, string> = {};
  if (p.embalagemId) fechadas[p.embalagemId] = "";
  return { p, fechadas, soltas: "", naoVeio: false, temAvaria: false, avaria: "", partes: [{ quantidade: "", vencimento: "", lote: "" }] };
}

/** Total contado em unidades de venda (embalagens fechadas × quantidade + soltas). */
export function totalDaContagem(c: Contagem): { total: number | null; err: string } {
  if (c.naoVeio) return { total: 0, err: "" };
  const linhas = c.p.embalagens.map((e) => ({ e: { qtd: e.quantidade }, fechadas: c.fechadas[e.id] ?? "" }));
  return totalContado(linhas, c.soltas, c.p.unidade);
}

/** Erros que impedem salvar a contagem de um produto. "" = pode salvar. */
export function erroContagem(c: Contagem, hoje = hojeEm()): string {
  if (c.naoVeio) return "";
  const { total, err } = totalDaContagem(c);
  if (err) return err;
  if (total == null) return "Conte quanto chegou (ou toque em \"Não veio\").";
  let avaria = 0;
  if (c.temAvaria) {
    const a = parseNum(c.avaria, c.p.unidade, false);
    if (a.err) return `Quebrados ou vencidos: ${a.err}`;
    avaria = a.v ?? 0;
    if (avaria > total) return "Os quebrados ou vencidos não podem ser mais que o total que chegou.";
  }
  const bons = Math.round((total - avaria) * 1000) / 1000;
  if (c.p.controlaValidade && bons > 0) {
    const partes = partesFinais(c, bons);
    if (partes.some((x) => !x.vencimento)) return "Informe a data de validade.";
    if (partes.some((x) => !/^\d{4}-\d{2}-\d{2}$/.test(x.vencimento) || parseData(fmtData(x.vencimento)).err)) return "Informe uma data de validade válida.";
    if (partes.some((x) => x.vencimento < hoje)) return "Mercadoria vencida deve ser informada em “Veio quebrado ou vencido”. Separe dos produtos bons.";
    if (c.p.pedeLote && partes.some((x) => !x.lote.trim())) return "Informe o lote (está impresso na caixa, perto da validade).";
    if (partes.some((x) => !(x.quantidade > 0))) return "Informe quantos de cada validade.";
    const soma = Math.round(partes.reduce((s, x) => s + x.quantidade, 0) * 1000) / 1000;
    if (soma !== bons) return `As validades somam ${fmtQ(soma)}, mas chegaram ${fmtQ(bons)} bons. Confira.`;
  }
  return "";
}

/** Com uma validade só, ela vale para tudo o que chegou bom. */
function partesFinais(c: Contagem, bons: number): { quantidade: number; vencimento: string; lote: string }[] {
  if (c.partes.length <= 1) return [{ quantidade: bons, vencimento: c.partes[0]?.vencimento ?? "", lote: c.partes[0]?.lote ?? "" }];
  return c.partes.map((x) => ({ quantidade: parseNum(x.quantidade, c.p.unidade, true).v ?? 0, vencimento: x.vencimento, lote: x.lote }));
}

/** O que vai para o servidor. Só chame quando erroContagem(c) === "". */
export function itemParaEnvio(c: Contagem) {
  const total = totalDaContagem(c).total ?? 0;
  const avaria = !c.naoVeio && c.temAvaria ? parseNum(c.avaria, c.p.unidade, false).v ?? 0 : 0;
  const bons = Math.round((total - avaria) * 1000) / 1000;
  return {
    produto_id: c.p.produtoId, variacao_id: c.p.variacaoId, total, avaria,
    partes: c.p.controlaValidade && bons > 0
      ? partesFinais(c, bons).map((x) => ({ quantidade: x.quantidade, vencimento: x.vencimento, lote: x.lote.trim() || null }))
      : [],
  };
}

/** Resumo da contagem para a lista do funcionário ("2 caixas + 3 = 27 unidades"). */
export function resumoContagem(c: Contagem): string {
  if (c.naoVeio) return "Não veio";
  const { total } = totalDaContagem(c);
  if (total == null) return "";
  const partes = c.p.embalagens.filter((e) => Number(c.fechadas[e.id] || 0) > 0).map((e) => `${c.fechadas[e.id]} ${e.tipo.toLowerCase()}${Number(c.fechadas[e.id]) === 1 ? "" : "s"}`);
  const soltas = parseNum(c.soltas, c.p.unidade, true).v;
  const conta = partes.length ? `${partes.join(" + ")}${soltas ? ` + ${fmtQ(soltas)}` : ""} = ` : "";
  return `${conta}${qtdUn(total, c.p.unidade)}`;
}

/* ---------- rascunho guardado no celular (a contagem não se perde se o app fechar) ---------- */
const RASCUNHO = "omni.recebimento.";
export type Rascunho = { id: string; pedidoId: string | null; fornecedorId: string | null; contagens: Record<string, Contagem>; estados: Record<string, EstadoItem>; rodada: number };
export function lerRascunho(chaveRascunho: string): Rascunho | null {
  try { const t = localStorage.getItem(RASCUNHO + chaveRascunho); return t ? (JSON.parse(t) as Rascunho) : null; } catch { return null; }
}
export function guardarRascunho(chaveRascunho: string, r: Rascunho) { try { localStorage.setItem(RASCUNHO + chaveRascunho, JSON.stringify(r)); } catch { /* sem armazenamento: segue sem rascunho */ } }
export function apagarRascunho(chaveRascunho: string) { try { localStorage.removeItem(RASCUNHO + chaveRascunho); } catch { /* nada */ } }
/** Rascunho por acesso e entrega. Nunca reutiliza a contagem de outro funcionário/comércio. */
export const chaveRascunho = (pedidoId: string | null, escopo: string) => `${escopo}:${pedidoId ?? "sem-pedido"}`;

/* ---------- dono ---------- */
export type SituacaoItemRecebido = "recontar" | "aceito" | "inconsistente" | "fora_do_pedido" | "recusado";
export type TentativaRecebida = { total: number; avaria: number; partes: { quantidade: number; vencimento: string; lote: string | null }[] };
export type ItemRecebido = {
  id: string; produtoId: string; variacaoId: string | null; noPedido: boolean; esperado: number | null; situacao: SituacaoItemRecebido;
  quantidadeAceita: number | null; avaria: number; entrouEstoque: number; tentativas: TentativaRecebida[];
};
export type Recebimento = {
  id: string; pedidoId: string | null; fornecedorId: string | null; funcionario: string; concluidoEm: string | null;
  situacao: "contando" | "concluido"; itens: ItemRecebido[];
};

export type TipoResultado = "ok" | "falta" | "sobra" | "nao_veio" | "inconsistente" | "fora" | "recusado" | "contando";
/** Como o dono lê cada produto recebido. */
export function resultadoItem(i: ItemRecebido, unidade: string): { tipo: TipoResultado; texto: string } {
  if (i.situacao === "recontar") return { tipo: "contando", texto: "Ainda sendo contado" };
  if (i.situacao === "inconsistente") {
    const ns = i.tentativas.map((t) => fmtQ(t.total));
    return { tipo: "inconsistente", texto: `A contagem não fechou (${ns.slice(0, -1).join(", ")} e ${ns[ns.length - 1]}). Escolha a certa.` };
  }
  if (i.situacao === "fora_do_pedido") return { tipo: "fora", texto: `Veio sem estar no pedido: ${qtdUn(i.quantidadeAceita ?? 0, unidade)}. Ficou separado.` };
  if (i.situacao === "recusado") return { tipo: "recusado", texto: "Fora do pedido: recusado (não entrou no estoque)" };
  const q = i.quantidadeAceita ?? 0;
  if (i.esperado == null) return { tipo: "ok", texto: `Chegou ${qtdUn(q, unidade)}` };
  if (q === 0 && i.esperado > 0) return { tipo: "nao_veio", texto: `Não veio (eram ${qtdUn(i.esperado, unidade)})` };
  if (q < i.esperado) return { tipo: "falta", texto: `Chegaram ${fmtQ(q)} de ${qtdUn(i.esperado, unidade)} · faltaram ${fmtQ(Math.round((i.esperado - q) * 1000) / 1000)}` };
  if (q > i.esperado) return { tipo: "sobra", texto: `Veio a mais: ${fmtQ(q)} de ${qtdUn(i.esperado, unidade)}` };
  return { tipo: "ok", texto: `Chegou tudo (${qtdUn(q, unidade)})` };
}
/** Itens que esperam o dono decidir. */
export const precisaDecidir = (i: Pick<ItemRecebido, "situacao">) => i.situacao === "inconsistente" || i.situacao === "fora_do_pedido";
/** Resumo para o cartão do pedido: "Recebido por Maria em 09/10 · faltou 1 produto". */
export function resumoRecebimento(r: Recebimento): { texto: string; alerta: "decidir" | "diferenca" | null } {
  const quando = r.concluidoEm ? ` em ${new Date(r.concluidoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : "";
  const decidir = r.itens.filter(precisaDecidir).length;
  const dif = r.itens.filter((i) => i.situacao === "aceito" && i.esperado != null && i.quantidadeAceita !== i.esperado).length;
  const avaria = r.itens.filter((i) => i.avaria > 0).length;
  const extra = decidir ? ` · ${decidir === 1 ? "1 produto" : `${decidir} produtos`} para você decidir`
    : dif ? ` · ${dif === 1 ? "1 produto" : `${dif} produtos`} com diferença` : avaria ? " · veio produto quebrado ou vencido" : " · tudo certo";
  return { texto: `Recebido por ${r.funcionario.split(" ")[0]}${quando}${extra}`, alerta: decidir ? "decidir" : dif || avaria ? "diferenca" : null };
}
