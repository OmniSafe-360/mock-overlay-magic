import type { Database, Json } from "@/integrations/supabase/types";
/* Acesso ao Supabase do cadastro de produtos. As regras de acesso do banco garantem que só o dono vê o próprio comércio. */
import { supabase } from "@/integrations/supabase/client";
import type { Product, Supplier } from "@/lib/produto";
import { precoUnidade as precoUnidadePedido, type CanalPedido, type FormaPagamento, type LinhaPedido, type Pedido, type RespostaPedido, type SituacaoPedido } from "@/lib/pedido";
import type { Funcao, Funcionario } from "@/lib/funcionario";
import type { Caixa, ItemPendente, ItemVenda, Venda } from "@/lib/vendas";
import type { ItemRecebido, ProdutoFunc, Recebimento, SituacaoItemRecebido } from "@/lib/recebimento";
import type { itemParaEnvio } from "@/lib/recebimento";
import { ehIncerto, enviarCadastro, linhaFornecedor, montarCadastro, montarFornecedores, montarProdutos, type Bruto, type Sessao } from "@/lib/persistencia";
import type { TipoEnvio } from "@/lib/envios";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase;

/** Os nomes e parâmetros seguem as migrações tipadas. Cada endpoint abaixo decodifica seu JSON. */
async function rpc<N extends keyof Database["public"]["Functions"]>(nome: N, args: Database["public"]["Functions"][N]["Args"]) {
  const r = await supabase.rpc(nome, args);
  return { ...r, data: r.data as any };
}


import type { AreaEstoque, Diferenca, MotivoDiferenca, MotivoPerda, Perda } from "@/lib/diferencas";
import type { Contagem } from "@/lib/antifurto";
import type { ItemCatalogo } from "@/lib/catalogo";

async function todos(tabela: keyof Database["public"]["Tables"], colunas: string, filtro: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await filtro(db.from(tabela).select(colunas)).order("id").range(de, de + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function carregarFornecedores(): Promise<Supplier[]> {
  return montarFornecedores(await todos("fornecedores", "id,nome,telefone,email,created_at", (q) => q.eq("ativo", true).order("created_at")));
}

/** Só resolve depois que o banco confirmou a gravação. */
export async function criarFornecedor(id: string, f: { nome: string; tel: string; email: string }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("nao_autenticado");
  const { error } = await db.from("fornecedores").insert({ id, dono_id: u.user.id, ...linhaFornecedor(f) });
  if (error) throw error;
}

/** Atualiza nome, telefone e e-mail. Só resolve se o banco confirmou que alterou o fornecedor (do próprio dono). */
export async function atualizarFornecedor(id: string, f: { nome: string; tel: string; email: string }) {
  const { data, error } = await db.from("fornecedores").update(linhaFornecedor(f)).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("fornecedor_nao_encontrado");
}

/** Código interno (EAN-13 começando com 29) para produto sem código de barras. Só o dono do comércio. */
export async function gerarCodigoInterno(comercioId: string): Promise<string> {
  const { data, error } = await rpc("gerar_codigo_interno", { _comercio: comercioId });
  if (error) throw error;
  if (typeof data !== "string" || !/^29\d{11}$/.test(data)) throw new Error("codigo_interno_invalido");
  return data;
}

export type LocaisCadastrados = { deposito: string[]; venda: string[] };

async function revisaoEstoque(comercioId: string): Promise<number> {
  const { count, error } = await db.from("operacoes").select("id", { count: "exact", head: true }).eq("comercio_id", comercioId);
  if (error) throw error;
  if (typeof count !== "number") throw new Error("revisao_do_estoque_indisponivel");
  return count;
}

/** As operações e suas alterações são confirmadas na mesma transação e nunca apagadas.
 * Se uma operação entrou durante a leitura das tabelas, descarta o conjunto e lê novamente. */
export async function carregarProdutos(comercioId: string, suppliers: Supplier[]): Promise<{ produtos: Product[]; locais: LocaisCadastrados }> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const revisao = await revisaoEstoque(comercioId);
    const r = await lerProdutos(comercioId, suppliers);
    if (await revisaoEstoque(comercioId) === revisao) return r;
  }
  throw new Error("dados_em_atualizacao");
}
async function lerProdutos(comercioId: string, suppliers: Supplier[]): Promise<{ produtos: Product[]; locais: LocaisCadastrados }> {
  const doComercio = (q: any) => q.eq("comercio_id", comercioId);
  const [produtos, variacoes, areas, locais, contagens, saldos, lotes, embalagens] = await Promise.all([
    todos("produtos", "*", (q) => doComercio(q).eq("ativo", true).order("created_at", { ascending: false })),
    todos("produto_variacoes", "*", (q) => doComercio(q).is("removida_em", null)),
    todos("produto_areas", "*", doComercio),
    todos("locais", "id,nome,area,created_at", (q) => doComercio(q).order("created_at")),
    todos("contagens", "produto_id,variacao_id,area,quantidade", doComercio),
    todos("saldos", "*", (q) => doComercio(q).gt("quantidade", 0).order("updated_at")),
    todos("lotes", "id,numero,vencimento", doComercio),
    todos("produto_embalagens", "id,produto_id,tipo,quantidade,codigo_barras,preco_compra,created_at", (q) => doComercio(q).is("removida_em", null)),
  ]);
  const b: Bruto = { produtos, variacoes, areas, locais, contagens, saldos, lotes, embalagens };
  return {
    produtos: montarProdutos(b, suppliers),
    locais: { deposito: locais.filter((l) => l.area === "deposito").map((l) => l.nome), venda: locais.filter((l) => l.area === "venda").map((l) => l.nome) },
  };
}

/** Produto + pendências numa única transação (salvar_cadastro). Envio sem resposta é repetido idêntico. */
export function salvarProduto(s: Sessao, p: Product, antes: Product | undefined, comercioId: string, farm: boolean, suppliers: Supplier[], novoId: () => string) {
  return enviarCadastro(s, () => montarCadastro(p, antes, comercioId, farm, suppliers, novoId),
    async (pedido) => { const { error } = await rpc("salvar_cadastro", { p: pedido as Json }); return { error }; });
}

/** Só confere o envio guardado. Nunca monta uma operação nova nem reaproveita o formulário atual. */
export async function conferirEnvio(s: Sessao, tipo: TipoEnvio) {
  const conferir = () => conferirSemTrava(s, tipo);
  return s.exclusivo ? s.exclusivo(conferir) : conferir();
}
async function conferirSemTrava(s: Sessao, tipo: TipoEnvio) {
  if (!s.incerto) return;
  const { error } = await rpc(tipo === "produto" ? "salvar_cadastro" : "salvar_pedido", { p: s.incerto.pedido as Json });
  if (error) {
    if (!ehIncerto(error)) { s.guardar?.(null); s.incerto = null; }
    throw error;
  }
  s.guardar?.(null); s.incerto = null;
}

/* ---------- pedidos de compra (D2a) ---------- */
const centavosDe = (v: unknown) => (v == null ? null : Math.round(Number(v) * 100));
export async function carregarPedidos(comercioId: string): Promise<Pedido[]> {
  const doComercio = (q: any) => q.eq("comercio_id", comercioId);
  const [ped, itens, recs] = await Promise.all([
    todos("pedidos_compra", "id,numero,fornecedor_id,situacao,canal,enviado_em,observacao,token,created_at,resposta_em,previsao_entrega,valor_total,forma_pagamento,prazo_dias,recado_fornecedor,pagamento_situacao,vencimento,pago_em",
      (q) => doComercio(q).order("created_at", { ascending: false })),
    todos("pedido_itens", "pedido_id,produto_id,variacao_id,embalagem_id,qtd_embalagens,qtd_unidades,preco_estimado,qtd_confirmada,qtd_recebida,created_at", (q) => doComercio(q).order("created_at")),
    carregarRecebimentos(comercioId, true),
  ]);
  return ped.map((r) => ({
    id: r.id, numero: Number(r.numero), fornecedorId: r.fornecedor_id, situacao: r.situacao, canal: r.canal ?? null,
    enviadoEm: r.enviado_em ?? null, observacao: r.observacao ?? "", token: r.token, criadoEm: r.created_at,
    resposta: r.resposta_em ? { em: r.resposta_em, previsaoEntrega: r.previsao_entrega ?? null, valorTotal: centavosDe(r.valor_total), forma: r.forma_pagamento ?? null,
      prazoDias: r.prazo_dias ?? null, recado: r.recado_fornecedor ?? "" } : null,
    pagamento: { situacao: r.pagamento_situacao ?? null, vencimento: r.vencimento ?? null, pagoEm: r.pago_em ?? null, valor: centavosDe(r.valor_total) },
    itens: itens.filter((i) => i.pedido_id === r.id).map((i) => ({
      produtoId: i.produto_id, variacaoId: i.variacao_id ?? null, embalagemId: i.embalagem_id ?? null,
      qtdEmbalagens: Number(i.qtd_embalagens), qtdUnidades: Number(i.qtd_unidades), precoEstimado: centavosDe(i.preco_estimado),
      qtdConfirmada: i.qtd_confirmada == null ? null : Number(i.qtd_confirmada), qtdRecebida: i.qtd_recebida == null ? null : Number(i.qtd_recebida),
    })),
    recebimento: recs.find((x) => x.pedidoId === r.id) ?? null,
  }));
}

/* ---------- recebimento (E2) ---------- */
const numOuNull = (v: unknown) => (v == null ? null : Number(v));
/** Recebimentos concluídos do comércio: com pedido (para os pedidos) ou sem pedido (entregas avulsas). */
export async function carregarRecebimentos(comercioId: string, comPedido: boolean): Promise<Recebimento[]> {
  const doComercio = (q: any) => q.eq("comercio_id", comercioId);
  const [recs, itens, funcs] = await Promise.all([
    todos("recebimentos", "id,pedido_id,fornecedor_id,funcionario_id,situacao,concluido_em,iniciado_em",
      (q) => (comPedido ? doComercio(q).not("pedido_id", "is", null) : doComercio(q).is("pedido_id", null)).eq("situacao", "concluido").order("concluido_em", { ascending: false }).order("id")),
    todos("recebimento_itens", "id,recebimento_id,produto_id,variacao_id,no_pedido,esperado,situacao,quantidade_aceita,avaria,entrou_estoque,tentativas", (q) => doComercio(q).order("id")),
    todos("funcionarios", "id,nome", (q) => doComercio(q).order("id")),
  ]);
  return recs.map((r) => ({
    id: r.id, pedidoId: r.pedido_id ?? null, fornecedorId: r.fornecedor_id ?? null, situacao: r.situacao, concluidoEm: r.concluido_em ?? null,
    funcionario: funcs.find((f) => f.id === r.funcionario_id)?.nome ?? "Funcionário",
    itens: itens.filter((i) => i.recebimento_id === r.id).map((i) => ({
      id: i.id, produtoId: i.produto_id, variacaoId: i.variacao_id ?? null, noPedido: !!i.no_pedido, esperado: numOuNull(i.esperado),
      situacao: i.situacao, quantidadeAceita: numOuNull(i.quantidade_aceita), avaria: Number(i.avaria ?? 0), entrouEstoque: Number(i.entrou_estoque ?? 0),
      tentativas: (Array.isArray(i.tentativas) ? i.tentativas : []).map((t: any) => ({ total: Number(t.total), avaria: Number(t.avaria ?? 0), partes: t.partes ?? [] })),
    })),
  }));
}
/** Dono decide um item: aceitar (escolhendo a contagem, se não fechou) ou recusar (fora do pedido). */
export async function resolverItemRecebimento(itemId: string, acao: "aceitar" | "recusar", tentativa: number | null) {
  const { error } = await rpc("resolver_item_recebimento", { _item: itemId, _acao: acao, _tentativa: tentativa });
  if (error) throw error;
}

/* funcionário (sem login): a chave do celular vai em cada chamada */
const produtoFunc = (x: any): ProdutoFunc => ({
  produtoId: x.produto_id, variacaoId: x.variacao_id ?? null, embalagemId: x.embalagem_id ?? null, nome: x.nome, unidade: x.unidade,
  codigo: x.codigo ?? null, variacao: x.variacao ?? null, controlaValidade: !!x.controla_validade, pedeLote: !!x.pede_lote,
  embalagens: (x.embalagens ?? []).map((e: any) => ({ id: e.id, tipo: e.tipo, quantidade: Number(e.quantidade) })),
});
export type EntregaEsperada = { id: string; numero: number; fornecedor: string; previsaoEntrega: string | null; produtos: number; emContagem: boolean };
export async function entregasFuncionario(chave: string): Promise<{ pedidos: EntregaEsperada[]; fornecedores: { id: string; nome: string }[] }> {
  const { data, error } = await rpc("funcionario_entregas", { _chave: chave });
  if (error) throw error;
  return {
    pedidos: (data?.pedidos ?? []).map((p: any) => ({ id: p.id, numero: Number(p.numero), fornecedor: p.fornecedor ?? "", previsaoEntrega: p.previsao_entrega ?? null,
      produtos: Number(p.produtos ?? 0), emContagem: !!p.em_contagem })),
    fornecedores: (data?.fornecedores ?? []).map((f: any) => ({ id: f.id, nome: f.nome })),
  };
}
export type RecebimentoAberto = {
  id: string; rodada: number; situacao: "contando" | "concluido"; pedidoId: string | null; numero: number | null; fornecedor: string | null;
  produtos: ProdutoFunc[]; itens: { produtoId: string; variacaoId: string | null; situacao: SituacaoItemRecebido }[];
};
export async function abrirRecebimento(chave: string, id: string, pedidoId: string | null, fornecedorId: string | null): Promise<RecebimentoAberto> {
  const { data, error } = await rpc("funcionario_abrir_recebimento", { _chave: chave, _id: id, _pedido: pedidoId, _fornecedor: fornecedorId });
  if (error) throw error;
  return {
    id: data.id, rodada: Number(data.rodada), situacao: data.situacao, pedidoId: data.pedido_id ?? null, numero: numOuNull(data.numero), fornecedor: data.fornecedor ?? null,
    produtos: (data.produtos ?? []).map(produtoFunc),
    itens: (data.itens ?? []).map((i: any) => ({ produtoId: i.produto_id, variacaoId: i.variacao_id ?? null, situacao: i.situacao })),
  };
}
export async function buscarProdutoFuncionario(chave: string, texto: string): Promise<ProdutoFunc[]> {
  const { data, error } = await rpc("funcionario_buscar_produto", { _chave: chave, _texto: texto });
  if (error) throw error;
  return (data ?? []).map(produtoFunc);
}
export type RespostaRecebimento =
  | { situacao: "recontar"; rodada: number; recontar: { produtoId: string; variacaoId: string | null }[]; faltam: { produtoId: string; variacaoId: string | null }[] }
  | { situacao: "concluido"; rodada: number; produtos: number; avisos: boolean };
export async function enviarRecebimento(chave: string, id: string, rodada: number, itens: ReturnType<typeof itemParaEnvio>[]): Promise<RespostaRecebimento> {
  const { data, error } = await rpc("funcionario_enviar_recebimento", { _chave: chave, _id: id, _rodada: rodada, _itens: itens });
  if (error) throw error;
  const par = (x: any) => ({ produtoId: x.produto_id, variacaoId: x.variacao_id ?? null });
  if (data.situacao === "recontar") return { situacao: "recontar", rodada: Number(data.rodada), recontar: (data.recontar ?? []).map(par), faltam: (data.faltam ?? []).map(par) };
  return { situacao: "concluido", rodada: Number(data.rodada ?? rodada + 1), produtos: Number(data.produtos ?? 0), avisos: !!data.avisos };
}
/** Grava o pedido pronto. Repetir com o mesmo id não duplica. Preço estimado vai em reais por unidade de venda. */
export async function salvarPedido(a: { id: string; comercioId: string; fornecedorId: string; observacao: string; linhas: LinhaPedido[] }, sessao?: Sessao): Promise<{ id: string; numero: number; recuperado: boolean }> {
  const montar = () => ({ id: a.id, comercio_id: a.comercioId, fornecedor_id: a.fornecedorId, observacao: a.observacao, itens: a.linhas.map((l) => {
    if (!l.p.db?.id) throw new Error("produto_nao_salvo");
    return { produto_id: l.p.db.id, variacao_id: l.variacao?.uid ?? null, embalagem_id: l.embalagem?.uid ?? null, qtd_embalagens: l.qtd, preco_estimado: precoUnidadePedido(l) / 100 };
  }) });
  let resultado: { id: string; numero: number } | undefined;
  const r = await enviarCadastro(sessao ?? { dbId: a.id, incerto: null }, montar, async (p) => {
    const { data, error } = await rpc("salvar_pedido", { p: p as Json });
    if (!error) resultado = { id: data.id, numero: Number(data.numero) };
    return { error };
  });
  return { ...resultado!, recuperado: r === "anterior_gravado" };
}
export async function marcarPedidoEnviado(id: string, canal: CanalPedido) {
  const { error } = await rpc("marcar_pedido_enviado", { _pedido: id, _canal: canal });
  if (error) throw error;
}
/** Dono: marca como pago (com a data), desfaz (volta para a pagar) ou corrige vencimento e valor. Valor em centavos; undefined = não muda. */
export async function atualizarPagamento(id: string, a: { situacao: "a_pagar" | "pago"; vencimento?: string | null; pagoEm?: string | null; valor?: number | null }) {
  const p: Record<string, unknown> = { situacao: a.situacao, vencimento: a.vencimento ?? null, pago_em: a.pagoEm ?? null };
  if (a.valor !== undefined) p["valor_total"] = a.valor == null ? null : a.valor / 100;
  const { error } = await rpc("atualizar_pagamento", { _pedido: id, p: p as Json });
  if (error) throw error;
}
export async function cancelarPedido(id: string) {
  const { error } = await rpc("cancelar_pedido", { _pedido: id });
  if (error) throw error;
}

/** Dono: troca o link do pedido; o antigo para de funcionar. */
export async function novoLinkPedido(id: string): Promise<string> {
  const { data, error } = await rpc("novo_link_pedido", { _pedido: id });
  if (error) throw error;
  return String(data);
}

/* ---------- página do fornecedor (sem login) ---------- */
export type ItemPublico = {
  id: string; produto: string; codigo: string | null; unidade: string; variacao: string | null; embalagem: string | null; porEmbalagem: number | null;
  qtdEmbalagens: number; qtdUnidades: number; qtdConfirmada: number | null;
};
export type PedidoPublico = {
  numero: number; situacao: SituacaoPedido; fornecedor: string; observacao: string; enviadoEm: string | null; podeResponder: boolean;
  comercio: { nome: string; rua: string; numero: string; bairro: string; cidade: string; uf: string; complemento: string; telefone: string };
  resposta: RespostaPedido | null; itens: ItemPublico[];
};
export async function carregarPedidoPublico(token: string): Promise<PedidoPublico | null> {
  const { data, error } = await rpc("pedido_publico", { _token: token });
  if (error) throw error;
  if (!data) return null;
  const r = data.resposta;
  return {
    numero: Number(data.numero), situacao: data.situacao, fornecedor: data.fornecedor ?? "", observacao: data.observacao ?? "", enviadoEm: data.enviado_em ?? null,
    podeResponder: !!data.pode_responder,
    comercio: { nome: data.comercio?.nome ?? "", rua: data.comercio?.rua ?? "", numero: data.comercio?.numero ?? "", bairro: data.comercio?.bairro ?? "",
      cidade: data.comercio?.cidade ?? "", uf: data.comercio?.uf ?? "", complemento: data.comercio?.complemento ?? "", telefone: data.comercio?.telefone ?? "" },
    resposta: r ? { em: r.em, previsaoEntrega: r.previsao_entrega ?? null, valorTotal: centavosDe(r.valor_total), forma: r.forma_pagamento ?? null, prazoDias: r.prazo_dias ?? null, recado: r.recado ?? "" } : null,
    itens: (data.itens ?? []).map((i: any) => ({
      id: i.id, produto: i.produto, codigo: i.codigo ?? null, unidade: i.unidade, variacao: i.variacao ?? null, embalagem: i.embalagem ?? null,
      porEmbalagem: i.por_embalagem == null ? null : Number(i.por_embalagem), qtdEmbalagens: Number(i.qtd_embalagens), qtdUnidades: Number(i.qtd_unidades),
      qtdConfirmada: i.qtd_confirmada == null ? null : Number(i.qtd_confirmada),
    })),
  };
}
export type RespostaFornecedor = {
  aceito: boolean; itens: { id: string; qtdConfirmada: number }[]; previsaoEntrega: string | null; valorTotal: number | null;
  forma: FormaPagamento | null; prazoDias: number | null; recado: string;
};
export async function responderPedido(token: string, r: RespostaFornecedor): Promise<SituacaoPedido> {
  const { data, error } = await rpc("responder_pedido", { _token: token, r: {
    aceito: r.aceito, itens: r.itens.map((i) => ({ id: i.id, qtd_confirmada: i.qtdConfirmada })), previsao_entrega: r.previsaoEntrega,
    valor_total: r.valorTotal == null ? null : r.valorTotal / 100, forma_pagamento: r.forma, prazo_dias: r.prazoDias, recado: r.recado,
  } });
  if (error) throw error;
  return data?.situacao;
}

/* ---------- vendas pelo caixa (Fase 3) ---------- */
const centavos = (v: unknown) => Math.round(Number(v ?? 0) * 100);
export async function carregarCaixas(comercioId: string): Promise<Caixa[]> {
  const cs = await todos("caixas", "id,nome,tipo,codigo,codigo_gerado_em,ligado_em,desligado_em,ultimo_contato_em,ultima_venda_em,aparelho,created_at",
    (q) => q.eq("comercio_id", comercioId).order("created_at"));
  return cs.map((c) => ({
    id: c.id, nome: c.nome, codigo: c.codigo ?? null, codigoGeradoEm: c.codigo_gerado_em ?? null, ligadoEm: c.ligado_em ?? null,
    desligadoEm: c.desligado_em ?? null, ultimoContatoEm: c.ultimo_contato_em ?? null, ultimaVendaEm: c.ultima_venda_em ?? null, aparelho: c.aparelho ?? null,
    ...(c.tipo === "celular" ? { tipo: "celular" as const } : {}),
  }));
}
/** Vendas a partir de uma data (ISO), com os itens. */
export async function carregarVendas(comercioId: string, desde: string): Promise<Venda[]> {
  const vs = await todos("vendas", "id,caixa_id,chave_nota,numero,emitida_em,recebida_em,total,situacao,cancelada_em,pagamentos,origem,troco,turno_id,cancelada_por,motivo_cancelamento",
    (q) => q.eq("comercio_id", comercioId).gte("recebida_em", desde));
  const ids = vs.map((v) => v.id);
  const its: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    its.push(...await todos("venda_itens", "id,venda_id,n_item,codigo_pdv,codigo_barras,descricao,qtd_nota,unidade_nota,valor,produto_id,qtd_unidades,qtd_baixada,qtd_faltou,situacao,motivo",
      (q) => q.in("venda_id", ids.slice(i, i + 200))));
  }
  const item = (x: any): ItemVenda => ({
    id: x.id, n: x.n_item, codigoPdv: x.codigo_pdv, codigoBarras: x.codigo_barras ?? null, descricao: x.descricao, qtdNota: Number(x.qtd_nota),
    unidadeNota: x.unidade_nota ?? null, valor: centavos(x.valor), produtoId: x.produto_id ?? null, qtdUnidades: x.qtd_unidades == null ? null : Number(x.qtd_unidades),
    qtdBaixada: Number(x.qtd_baixada ?? 0), qtdFaltou: Number(x.qtd_faltou ?? 0), situacao: x.situacao, motivo: x.motivo ?? null,
  });
  return vs.map((v) => ({
    id: v.id, caixaId: v.caixa_id, chave: v.chave_nota ?? null, numero: v.numero ?? null, emitidaEm: v.emitida_em ?? null, recebidaEm: v.recebida_em,
    ...(v.origem === "celular" ? { celular: true, troco: centavos(v.troco), turnoId: v.turno_id ?? null, canceladaPor: v.cancelada_por ?? null, motivoCancelamento: v.motivo_cancelamento ?? null } : {}),
    total: centavos(v.total), situacao: v.situacao, canceladaEm: v.cancelada_em ?? null,
    pagamentos: (Array.isArray(v.pagamentos) ? v.pagamentos : []).map((p: any) => ({ forma: String(p?.forma ?? ""), valor: centavos(p?.valor) })),
    itens: its.filter((i) => i.venda_id === v.id).map(item).sort((a, b) => a.n - b.n),
  })).sort((a, b) => (b.emitidaEm ?? b.recebidaEm).localeCompare(a.emitidaEm ?? a.recebidaEm));
}
export async function criarCaixa(comercioId: string, nome: string): Promise<{ id: string; codigo: string }> {
  const { data, error } = await rpc("criar_caixa", { _comercio: comercioId, _nome: nome });
  if (error) throw error;
  return { id: data.id, codigo: data.codigo };
}
export async function renomearCaixa(id: string, nome: string) {
  const { error } = await rpc("renomear_caixa", { _id: id, _nome: nome });
  if (error) throw error;
}
export async function novoCodigoCaixa(id: string): Promise<string> {
  const { data, error } = await rpc("novo_codigo_caixa", { _id: id });
  if (error) throw error;
  return String(data);
}
/** Itens vendidos (vendas não canceladas) que o Omni ainda não sabe qual produto é, ou com quantidade a conferir. */
export async function carregarPendentesVenda(comercioId: string): Promise<ItemPendente[]> {
  const rs = await todos("venda_itens", "id,codigo_pdv,codigo_barras,descricao,qtd_nota,unidade_nota,valor,situacao,motivo,produto_id,vendas!inner(situacao,emitida_em,recebida_em)",
    (q) => q.eq("comercio_id", comercioId).in("situacao", ["sem_cadastro", "conferir"]).eq("vendas.situacao", "finalizada"));
  return rs.map((r) => ({
    id: r.id, codigoPdv: r.codigo_pdv, codigoBarras: r.codigo_barras ?? null, descricao: r.descricao, qtdNota: Number(r.qtd_nota),
    unidadeNota: r.unidade_nota ?? null, valor: centavos(r.valor), situacao: r.situacao, motivo: r.motivo ?? null, produtoId: r.produto_id ?? null,
    vendidoEm: r.vendas?.emitida_em ?? r.vendas?.recebida_em ?? null,
  }));
}
/** Liga o código do caixa a um produto (desconta agora as vendas pendentes desse código e passa a ser automático) ou "não controlar". */
export async function resolverItemVenda(itemId: string, acao: "ligar" | "ignorar", produtoId: string | null, variacaoId: string | null, embalagemId: string | null): Promise<{ itens: number; conferir?: number }> {
  const { data, error } = await rpc("resolver_item_venda", { _item: itemId, _acao: acao, _produto: produtoId, _variacao: variacaoId, _embalagem: embalagemId });
  if (error) throw error;
  return data;
}
export async function desligarCaixa(id: string) {
  const { error } = await rpc("desligar_caixa", { _id: id });
  if (error) throw error;
}

/* ---------- Omni Conector, no computador do caixa (sem login, com a chave do caixa) ---------- */
export type EstadoConector = {
  caixa: string; comercio: { nome: string; tipo: string; documento: string | null };
  ultimaVendaEm: string | null; desde: string | null; hoje: { vendas: number; total: number };
};
export async function conectorLigar(codigo: string, aparelho: string): Promise<{ chave: string; caixa: string; comercio: { nome: string; tipo: string } }> {
  const { data, error } = await rpc("conector_ligar", { _codigo: codigo, _aparelho: aparelho });
  if (error) throw error;
  return { chave: String(data.chave), caixa: data.caixa, comercio: { nome: data.comercio?.nome ?? "", tipo: data.comercio?.tipo ?? "" } };
}
/** null = este caixa foi desligado pelo dono (ou a chave não vale mais). */
export async function conectorEstado(chave: string): Promise<EstadoConector | null> {
  const { data, error } = await rpc("conector_estado", { _chave: chave });
  if (error) throw error;
  if (!data) return null;
  return {
    caixa: data.caixa, comercio: { nome: data.comercio?.nome ?? "", tipo: data.comercio?.tipo ?? "", documento: data.comercio?.documento ?? null },
    ultimaVendaEm: data.ultima_venda_em ?? null, desde: data.desde ?? null,
    hoje: { vendas: Number(data.hoje?.vendas ?? 0), total: centavos(data.hoje?.total) },
  };
}
export async function conectorEnviarVenda(chave: string, nota: object): Promise<{ situacao: string; sem_cadastro?: number; itens?: number }> {
  const { data, error } = await rpc("conector_enviar_venda", { _chave: chave, _nota: nota as Json });
  if (error) throw error;
  return data;
}
export async function conectorCancelarVenda(chave: string, chaveNota: string): Promise<{ situacao: string }> {
  const { data, error } = await rpc("conector_cancelar_venda", { _chave: chave, _chave_nota: chaveNota });
  if (error) throw error;
  return data;
}

/* ---------- equipe (E1) ---------- */
export async function carregarFuncionarios(comercioId: string): Promise<Funcionario[]> {
  const [fs, aps] = await Promise.all([
    todos("funcionarios", "id,nome,funcao,caixa,codigo,codigo_gerado_em,pin_criado_em,bloqueado_em,ultimo_acesso,travado_ate,created_at", (q) => q.eq("comercio_id", comercioId).order("created_at")),
    todos("funcionario_aparelhos", "funcionario_id", (q) => q.eq("comercio_id", comercioId).is("encerrado_em", null)),
  ]);
  return fs.map((f) => ({
    id: f.id, nome: f.nome, funcao: f.funcao, caixa: !!f.caixa, codigo: f.codigo, codigoGeradoEm: f.codigo_gerado_em, primeiroAcessoEm: f.pin_criado_em ?? null,
    bloqueadoEm: f.bloqueado_em ?? null, ultimoAcesso: f.ultimo_acesso ?? null, travadoAte: f.travado_ate ?? null,
    celulares: aps.filter((a) => a.funcionario_id === f.id).length,
  }));
}
export async function criarFuncionario(comercioId: string, nome: string, funcao: Funcao): Promise<{ id: string; codigo: string }> {
  const { data, error } = await rpc("criar_funcionario", { _comercio: comercioId, _nome: nome, _funcao: funcao });
  if (error) throw error;
  return { id: data.id, codigo: data.codigo };
}
export async function atualizarFuncionario(id: string, nome: string, funcao: Funcao) {
  const { error } = await rpc("atualizar_funcionario", { _id: id, _nome: nome, _funcao: funcao });
  if (error) throw error;
}
/** Bloquear desliga os celulares; desbloquear devolve um código novo (o funcionário cria outro PIN). */
export async function bloquearFuncionario(id: string, bloquear: boolean): Promise<string | null> {
  const { data, error } = await rpc("bloquear_funcionario", { _id: id, _bloquear: bloquear });
  if (error) throw error;
  return data?.codigo ?? null;
}
/** Liga ou desliga a função Caixa (vender pelo celular, no app da equipe). */
export async function definirCaixaFuncionario(id: string, caixa: boolean) {
  const { error } = await rpc("definir_caixa_funcionario", { _id: id, _caixa: caixa });
  if (error) throw error;
}
export async function novoAcessoFuncionario(id: string): Promise<string> {
  const { data, error } = await rpc("novo_acesso_funcionario", { _id: id });
  if (error) throw error;
  return String(data.codigo);
}

/* ---------- app do funcionário (sem login) ---------- */
export type InicioFuncionario = {
  nome: string; funcao: Funcao; comercio: { nome: string; tipo: string };
  /** Opera o caixa no celular (o dono liga na Equipe). */ caixa?: boolean | undefined;
  avisos: { entregas: number; entregasHoje: number; repor: number; caixaAberto?: boolean | undefined };
  /** O app travou: precisa digitar o PIN neste celular (os avisos vêm zerados). */
  pinNecessario?: boolean | undefined;
};
/** 'novo' (criar PIN), 'pin', 'expirado' ou null (código não vale). */
export async function conferirCodigoFuncionario(codigo: string): Promise<"novo" | "pin" | "expirado" | null> {
  const { data, error } = await rpc("conferir_codigo_funcionario", { _codigo: codigo });
  if (error) throw error;
  return data ?? null;
}
/** Devolve a chave do celular. PIN errado vem como erro com a mensagem do banco (pin_errado:N / muitas_tentativas:N). */
export async function entrarFuncionario(codigo: string, pin: string, aparelho: string): Promise<string> {
  const { data, error } = await rpc("entrar_funcionario", { _codigo: codigo, _pin: pin, _aparelho: aparelho });
  if (error) throw error;
  if (data?.erro) throw new Error(String(data.erro));
  return String(data.chave);
}
/** null = este celular foi desligado (bloqueio ou novo acesso). */
export async function inicioFuncionario(chave: string): Promise<InicioFuncionario | null> {
  const { data, error } = await rpc("funcionario_inicio", { _chave: chave });
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data.pin_necessario ? { pinNecessario: true } : {}),
    nome: data.nome, funcao: data.funcao, comercio: { nome: data.comercio?.nome ?? "", tipo: data.comercio?.tipo ?? "" },
    ...(data.caixa ? { caixa: true } : {}),
    avisos: { entregas: Number(data.avisos?.entregas ?? 0), entregasHoje: Number(data.avisos?.entregas_hoje ?? 0), repor: Number(data.avisos?.repor ?? 0),
      ...(data.avisos?.caixa_aberto ? { caixaAberto: true } : {}) },
  };
}
/** Destrava o app com o PIN. PIN errado vem como erro (pin_errado:N / muitas_tentativas:N). */
export async function desbloquearFuncionario(chave: string, pin: string) {
  const { data, error } = await rpc("funcionario_desbloquear", { _chave: chave, _pin: pin });
  if (error) throw error;
  if (data?.erro) throw new Error(String(data.erro));
}
export async function sairFuncionario(chave: string) {
  const { error } = await rpc("sair_funcionario", { _chave: chave });
  if (error) throw error;
}

/* ---------- fechar a conta no app do funcionário (Fase 4.2) ---------- */
export type ItemConferencia = ProdutoFunc & { local: string | null; conferenciaId: string | null };
/** Produtos para conferir hoje no depósito (sem quantidades). */
export async function listaConferencia(chave: string): Promise<{ tipo: string; feitosHoje: number; meta: number; produtos: ItemConferencia[] }> {
  const { data, error } = await rpc("funcionario_conferencia_lista", { _chave: chave });
  if (error) throw error;
  return {
    tipo: data?.tipo ?? "", feitosHoje: Number(data?.feitos_hoje ?? 0), meta: Number(data?.meta ?? 5),
    produtos: (data?.produtos ?? []).map((x: any) => ({ ...produtoFunc(x), local: x.local ?? null, conferenciaId: x.conferencia_id ?? null })),
  };
}
/** Uma contagem cega do depósito: "recontar", "concluida" ou "inconsistente" (nunca quanto o sistema tinha). */
export async function contarConferencia(chave: string, id: string, produtoId: string, variacaoId: string | null, contado: number): Promise<{ situacao: "recontar" | "concluida" | "inconsistente"; rodada?: number }> {
  const { data, error } = await rpc("funcionario_conferencia_contar", { _chave: chave, _id: id, _produto: produtoId, _variacao: variacaoId, _contado: contado });
  if (error) throw error;
  return { situacao: data.situacao, ...(data.rodada ? { rodada: Number(data.rodada) } : {}) };
}
export type { MotivoPerda };
export type NovaPerda = { id: string; produtoId: string; variacaoId: string | null; area: "deposito" | "venda"; quantidade: number; motivo: MotivoPerda; observacao: string };
/** Perda registrada pelo funcionário: sai do estoque na hora; o dono confirma depois. Repetir o mesmo id não duplica. */
export async function registrarPerdaFuncionario(chave: string, p: NovaPerda) {
  const { error } = await rpc("funcionario_registrar_perda", { _chave: chave, _id: p.id, _produto: p.produtoId, _variacao: p.variacaoId, _area: p.area,
    _quantidade: p.quantidade, _motivo: p.motivo, _observacao: p.observacao });
  if (error) throw error;
}

/* ---------- reposição (E3) ---------- */
export type ItemReposicao = ProdutoFunc & { local: string | null; localDeposito: string | null; depositoVazio: boolean };
export async function listaReposicao(chave: string): Promise<{ tipo: string; produtos: ItemReposicao[] }> {
  const { data, error } = await rpc("funcionario_reposicao_lista", { _chave: chave });
  if (error) throw error;
  return {
    tipo: data?.tipo ?? "",
    produtos: (data?.produtos ?? []).map((x: any) => ({ ...produtoFunc(x), local: x.local ?? null, localDeposito: x.local_deposito ?? null, depositoVazio: !!x.deposito_vazio })),
  };
}
export type RespostaContagemPrateleira = { sugerido: number; cheio: boolean; depositoVazio: boolean; localDeposito: string | null; situacao: "contado" | "concluido" };
/** O funcionário contou a prateleira; o servidor devolve só quanto buscar no depósito. */
export async function contarPrateleira(chave: string, id: string, produtoId: string, variacaoId: string | null, contado: number): Promise<RespostaContagemPrateleira> {
  const { data, error } = await rpc("funcionario_reposicao_contar", { _chave: chave, _id: id, _produto: produtoId, _variacao: variacaoId, _contado: contado });
  if (error) throw error;
  return { sugerido: Number(data.sugerido), cheio: !!data.cheio, depositoVazio: !!data.deposito_vazio, localDeposito: data.local_deposito ?? null, situacao: data.situacao };
}
export async function concluirReposicao(chave: string, id: string, levado: number) {
  const { error } = await rpc("funcionario_reposicao_concluir", { _chave: chave, _id: id, _levado: levado });
  if (error) throw error;
}

/* ---------- Diferenças (Fase 4.3): perdas para confirmar e diferenças para explicar ---------- */
const nomeFunc = (r: { funcionarios?: { nome?: string } | null }) => r.funcionarios?.nome ?? null;
/** Abertas/aguardando sempre; o resto desde `desde` (ISO). */
export async function carregarDiferencas(comercioId: string, desde: string): Promise<{ diferencas: Diferenca[]; perdas: Perda[] }> {
  const [ds, ps] = await Promise.all([
    todos("diferencas", "id,produto_id,variacao_id,area,origem,esperado,contado,diferenca,valor,situacao,motivo,observacao,detalhes,created_at,funcionarios(nome)",
      (q) => q.eq("comercio_id", comercioId).or(`situacao.eq.aberta,created_at.gte.${desde}`)),
    todos("perdas", "id,produto_id,variacao_id,area,quantidade,baixado,motivo,observacao,registrado_por,situacao,created_at,funcionarios(nome)",
      (q) => q.eq("comercio_id", comercioId).or(`situacao.eq.aguardando,created_at.gte.${desde}`)),
  ]);
  return {
    diferencas: ds.map((r) => ({
      id: r.id, produtoId: r.produto_id, variacaoId: r.variacao_id ?? null, area: r.area, origem: r.origem,
      esperado: Number(r.esperado), contado: Number(r.contado), diferenca: Number(r.diferenca), valor: centavos(r.valor),
      funcionario: nomeFunc(r), situacao: r.situacao, motivo: r.motivo ?? null, observacao: r.observacao ?? null,
      tentativas: Array.isArray(r.detalhes?.tentativas) ? r.detalhes.tentativas.map(Number) : [], resolvida: !!r.detalhes?.resolvida,
      motivoInformado: r.detalhes?.motivo_informado ?? null, criadaEm: r.created_at,
    })),
    perdas: ps.map((r) => ({
      id: r.id, produtoId: r.produto_id, variacaoId: r.variacao_id ?? null, area: r.area, quantidade: Number(r.quantidade), baixado: Number(r.baixado),
      motivo: r.motivo, observacao: r.observacao ?? null, funcionario: nomeFunc(r), peloDono: !!r.registrado_por, situacao: r.situacao, criadaEm: r.created_at,
    })),
  };
}
export async function decidirPerda(id: string, aceitar: boolean) {
  const { error } = await rpc("decidir_perda", { _id: id, _aceitar: aceitar });
  if (error) throw error;
}
export async function explicarDiferenca(id: string, motivo: MotivoDiferenca, observacao: string) {
  const { error } = await rpc("explicar_diferenca", { _id: id, _motivo: motivo, _observacao: observacao });
  if (error) throw error;
}
/** Contagem inconsistente: o dono escolhe o número certo (uma das contagens ou o do sistema). */
export async function resolverConferencia(id: string, contado: number): Promise<{ diferenca: number }> {
  const { data, error } = await rpc("resolver_conferencia", { _diferenca: id, _contado: contado });
  if (error) throw error;
  return { diferenca: Number(data?.diferenca ?? 0) };
}
export type PerdaDono = { id: string; comercioId: string; produtoId: string; variacaoId: string | null; area: AreaEstoque; quantidade: number; motivo: MotivoPerda; observacao: string };
/** O dono registra uma perda (já confirmada). */
export async function registrarPerdaDono(p: PerdaDono) {
  const { error } = await rpc("registrar_perda", { p: { id: p.id, comercio_id: p.comercioId, produto_id: p.produtoId, variacao_id: p.variacaoId,
    area: p.area, quantidade: p.quantidade, motivo: p.motivo, observacao: p.observacao } });
  if (error) throw error;
}

/* ---------- Antifurto (Fase 5.1): quando cada produto foi contado (começo do intervalo de uma falta) ---------- */
export async function carregarContagensAntifurto(comercioId: string, desde: string): Promise<Contagem[]> {
  const [cf, rp, ct] = await Promise.all([
    todos("conferencias", "produto_id,variacao_id,area,concluida_em", (q) => q.eq("comercio_id", comercioId).eq("situacao", "concluida").gte("concluida_em", desde)),
    todos("reposicoes", "produto_id,variacao_id,concluido_em", (q) => q.eq("comercio_id", comercioId).eq("situacao", "concluido").gte("concluido_em", desde)),
    todos("contagens", "produto_id,variacao_id,area,created_at", (q) => q.eq("comercio_id", comercioId).gte("created_at", desde)),
  ]);
  return [
    ...cf.map((r) => ({ produtoId: r.produto_id, variacaoId: r.variacao_id ?? null, area: r.area, em: r.concluida_em })),
    ...rp.map((r) => ({ produtoId: r.produto_id, variacaoId: r.variacao_id ?? null, area: "venda" as const, em: r.concluido_em })),
    ...ct.map((r) => ({ produtoId: r.produto_id, variacaoId: r.variacao_id ?? null, area: r.area, em: r.created_at })),
  ];
}
/** Limite do aviso "faltou no mês" do comércio (centavos). */
export async function carregarLimiteFaltas(comercioId: string): Promise<number> {
  const { data, error } = await db.from("comercios").select("limite_faltas_mes").eq("id", comercioId).maybeSingle();
  if (error) throw error;
  return data?.limite_faltas_mes == null ? 20000 : centavos(data.limite_faltas_mes);
}
export async function definirLimiteFaltas(comercioId: string, centavosValor: number) {
  const { error } = await rpc("definir_limite_faltas", { _comercio: comercioId, _valor: centavosValor / 100 });
  if (error) throw error;
}

/* ---------- Catálogo por código de barras: sugere o nome ao bipar um código novo ---------- */
export async function buscarCatalogo(codigo: string): Promise<ItemCatalogo | null> {
  const { data, error } = await rpc("buscar_catalogo", { _codigo: codigo });
  if (error) throw error;
  if (!data) return null;
  return { codigo: data.codigo, nome: data.nome, marca: data.marca ?? null, quantidade: data.quantidade ?? null, imagemUrl: data.imagem_url ?? null, fonte: data.fonte };
}

/* ---------- caixa no celular (C2), no app da equipe, com a chave do celular ---------- */
const numero = (v: unknown) => Number(v ?? 0);
export type TurnoCaixa = {
  id: string; abertoEm: string; trocoInicial: number; vendas: number; canceladas: number; total: number;
  porForma: Record<"dinheiro" | "pix" | "cartao" | "fiado", number>; trocoDado: number; sangrias: number; dinheiroEsperado: number;
  fechado?: boolean | undefined; dinheiroContado?: number | undefined; diferenca?: number | undefined;
};
export type VendaDoCaixa = { id: string; numero: number | null; feitaEm: string; total: number; situacao: "finalizada" | "cancelada";
  pagamentos: { forma: string; valor: number }[]; troco: number; cliente: string | null; itens: { descricao: string; qtd: number; valor: number }[] };
export type EstadoCaixa = {
  nome: string; comercio: { nome: string; tipo: string; telefone: string | null; endereco: string | null };
  donoTemPin: boolean; turno: TurnoCaixa | null; vendas: VendaDoCaixa[];
};
const turno = (t: any): TurnoCaixa => ({
  id: t.id, abertoEm: t.aberto_em, trocoInicial: centavos(t.troco_inicial), vendas: numero(t.vendas), canceladas: numero(t.canceladas), total: centavos(t.total),
  porForma: { dinheiro: centavos(t.por_forma?.dinheiro), pix: centavos(t.por_forma?.pix), cartao: centavos(t.por_forma?.cartao), fiado: centavos(t.por_forma?.fiado) },
  trocoDado: centavos(t.troco_dado), sangrias: centavos(t.sangrias), dinheiroEsperado: centavos(t.dinheiro_esperado),
  ...(t.situacao === "fechado" ? { fechado: true, dinheiroContado: centavos(t.dinheiro_contado), diferenca: centavos(t.diferenca) } : {}),
});
export async function caixaEstado(chave: string): Promise<EstadoCaixa> {
  const { data, error } = await rpc("caixa_estado", { _chave: chave });
  if (error) throw error;
  return {
    nome: data.nome, comercio: { nome: data.comercio?.nome ?? "", tipo: data.comercio?.tipo ?? "", telefone: data.comercio?.telefone ?? null, endereco: data.comercio?.endereco ?? null },
    donoTemPin: !!data.dono_tem_pin, turno: data.turno ? turno(data.turno) : null,
    vendas: (data.vendas ?? []).map((v: any) => ({
      id: v.id, numero: v.numero ?? null, feitaEm: v.feita_em, total: centavos(v.total), situacao: v.situacao, troco: centavos(v.troco), cliente: v.cliente ?? null,
      pagamentos: (v.pagamentos ?? []).map((p: any) => ({ forma: String(p.forma), valor: centavos(p.valor) })),
      itens: (v.itens ?? []).map((i: any) => ({ descricao: i.descricao, qtd: Number(i.qtd), valor: centavos(i.valor) })),
    })),
  };
}
export async function caixaProdutos(chave: string): Promise<import("@/lib/caixa").ProdutoCaixa[]> {
  const { data, error } = await rpc("caixa_produtos", { _chave: chave });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id, nome: p.nome, unidade: p.unidade, fracionado: !!p.fracionado, preco: centavos(p.preco),
    codigos: (p.codigos ?? []).map((c: any) => ({ codigo: String(c.codigo), variacaoId: c.variacao_id ?? null, embalagemId: c.embalagem_id ?? null })),
    variacoes: (p.variacoes ?? []).map((v: any) => ({ id: v.id, nome: v.nome || "Sem nome" })),
    embalagens: (p.embalagens ?? []).map((e: any) => ({ id: e.id, tipo: e.tipo, quantidade: Number(e.quantidade) })),
  }));
}
export type ClienteFiado = { id: string; nome: string; telefone: string | null };
export async function caixaClientesFiado(chave: string): Promise<ClienteFiado[]> {
  const { data, error } = await rpc("caixa_clientes_fiado", { _chave: chave });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({ id: c.id, nome: c.nome, telefone: c.telefone ?? null }));
}
/** Abre o caixa com o troco da gaveta (em centavos). Se já estava aberto, devolve o mesmo. */
export async function caixaAbrir(chave: string, id: string, trocoCentavos: number): Promise<TurnoCaixa> {
  const { data, error } = await rpc("caixa_abrir", { _chave: chave, _id: id, _troco: trocoCentavos / 100 });
  if (error) throw error;
  return turno(data.turno);
}
/** Venda finalizada. Repetir o mesmo id não conta de novo (devolve "repetida"). */
export async function caixaRegistrarVenda(chave: string, venda: ReturnType<typeof import("@/lib/caixa").montarVenda>): Promise<{ situacao: "registrada" | "repetida"; numero: number | null; troco: number; semCadastro: number }> {
  const { data, error } = await rpc("caixa_registrar_venda", { _chave: chave, _venda: venda as unknown as Json });
  if (error) throw error;
  return { situacao: data.situacao, numero: data.numero ?? null, troco: centavos(data.troco), semCadastro: numero(data.sem_cadastro) };
}

/** O banco devolve {erro} (sem desfazer) quando o PIN do dono está errado, para a contagem de tentativas ficar gravada. */
const comErro = (data: any) => { if (data?.erro) throw new Error(String(data.erro)); return data; };
/** Cancelar uma venda do celular com o PIN do dono: os produtos voltam para a gôndola. */
export async function caixaCancelarVenda(chave: string, vendaId: string, pinDono: string, motivo: string): Promise<"cancelada" | "repetida"> {
  const { data, error } = await rpc("caixa_cancelar_venda", { _chave: chave, _venda: vendaId, _pin_dono: pinDono, _motivo: motivo });
  if (error) throw error;
  return comErro(data).situacao;
}
/** Tirar dinheiro da gaveta (sangria) com o PIN do dono. Repetir o mesmo id não tira duas vezes. */
export async function caixaSangria(chave: string, id: string, turnoId: string, valorCentavos: number, motivo: string, pinDono: string): Promise<TurnoCaixa> {
  const { data, error } = await rpc("caixa_sangria", { _chave: chave, _id: id, _turno: turnoId, _valor: valorCentavos / 100, _motivo: motivo, _pin_dono: pinDono });
  if (error) throw error;
  return turno(comErro(data).turno);
}
/** Fechar o caixa com o dinheiro contado na gaveta. Devolve o esperado e a diferença. */
export async function caixaFechar(chave: string, turnoId: string, contadoCentavos: number, observacao: string): Promise<TurnoCaixa> {
  const { data, error } = await rpc("caixa_fechar", { _chave: chave, _turno: turnoId, _contado: contadoCentavos / 100, _observacao: observacao });
  if (error) throw error;
  return turno(data.turno);
}

/* ---------- dono: PIN, cancelamento e fechamentos do caixa do celular ---------- */
export async function temPinDono(): Promise<boolean> {
  const { data, error } = await rpc("tem_pin_dono", {});
  if (error) throw error;
  return !!data;
}
export async function definirPinDono(pin: string) {
  const { error } = await rpc("definir_pin_dono", { _pin: pin });
  if (error) throw error;
}
export async function cancelarVendaCelular(vendaId: string, motivo: string) {
  const { error } = await rpc("cancelar_venda_celular", { _venda: vendaId, _motivo: motivo });
  if (error) throw error;
}
export async function conferirFechamentoCaixa(turnoId: string) {
  const { error } = await rpc("conferir_fechamento_caixa", { _turno: turnoId });
  if (error) throw error;
}
export type FechamentoCaixa = {
  id: string; caixaId: string; funcionario: string; abertoEm: string; fechadoEm: string | null; trocoInicial: number;
  esperado: number | null; contado: number | null; diferenca: number | null; observacao: string | null; conferidoEm: string | null;
  sangrias: number;
};
/** Turnos do caixa do celular abertos desde a data (ISO) e os que ainda estão abertos. */
export async function carregarFechamentos(comercioId: string, desde: string): Promise<FechamentoCaixa[]> {
  const ts = await todos("caixa_turnos", "id,caixa_id,aberto_em,fechado_em,troco_inicial,dinheiro_esperado,dinheiro_contado,diferenca,observacao,conferido_em,situacao,funcionarios(nome)",
    (q) => q.eq("comercio_id", comercioId).or(`aberto_em.gte.${desde},situacao.eq.aberto`));
  const ids = ts.map((t) => t.id);
  const sg = ids.length ? await todos("caixa_sangrias", "id,turno_id,valor", (q) => q.in("turno_id", ids)) : [];
  const ct = (v: unknown) => (v == null ? null : centavos(v));
  return ts.map((t) => ({
    id: t.id, caixaId: t.caixa_id, funcionario: t.funcionarios?.nome ?? "Funcionário", abertoEm: t.aberto_em, fechadoEm: t.fechado_em ?? null,
    trocoInicial: centavos(t.troco_inicial), esperado: ct(t.dinheiro_esperado), contado: ct(t.dinheiro_contado), diferenca: ct(t.diferenca),
    observacao: t.observacao ?? null, conferidoEm: t.conferido_em ?? null,
    sangrias: sg.filter((x) => x.turno_id === t.id).reduce((a, x) => a + centavos(x.valor), 0),
  })).sort((a, b) => b.abertoEm.localeCompare(a.abertoEm));
}
