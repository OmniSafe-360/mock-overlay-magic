/* Acesso ao Supabase do cadastro de produtos. As regras de acesso do banco garantem que só o dono vê o próprio comércio. */
import { supabase } from "@/integrations/supabase/client";
import type { Product, Supplier } from "@/components/ProductArea";
import { precoUnidade as precoUnidadePedido, type CanalPedido, type FormaPagamento, type LinhaPedido, type Pedido, type RespostaPedido, type SituacaoPedido } from "@/lib/pedido";
import type { Funcao, Funcionario } from "@/lib/funcionario";
import type { ItemRecebido, ProdutoFunc, Recebimento, SituacaoItemRecebido } from "@/lib/recebimento";
import type { itemParaEnvio } from "@/lib/recebimento";
import { ehIncerto, enviarCadastro, linhaFornecedor, montarCadastro, montarFornecedores, montarProdutos, type Bruto, type Sessao } from "@/lib/persistencia";
import type { TipoEnvio } from "@/lib/envios";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;

async function todos(tabela: string, colunas: string, filtro: (q: any) => any): Promise<any[]> {
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
  const { data, error } = await db.rpc("gerar_codigo_interno", { _comercio: comercioId });
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
    async (pedido) => { const { error } = await db.rpc("salvar_cadastro", { p: pedido }); return { error }; });
}

/** Só confere o envio guardado. Nunca monta uma operação nova nem reaproveita o formulário atual. */
export async function conferirEnvio(s: Sessao, tipo: TipoEnvio) {
  const conferir = () => conferirSemTrava(s, tipo);
  return s.exclusivo ? s.exclusivo(conferir) : conferir();
}
async function conferirSemTrava(s: Sessao, tipo: TipoEnvio) {
  if (!s.incerto) return;
  const { error } = await db.rpc(tipo === "produto" ? "salvar_cadastro" : "salvar_pedido", { p: s.incerto.pedido });
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
  const { error } = await db.rpc("resolver_item_recebimento", { _item: itemId, _acao: acao, _tentativa: tentativa });
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
  const { data, error } = await db.rpc("funcionario_entregas", { _chave: chave });
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
  const { data, error } = await db.rpc("funcionario_abrir_recebimento", { _chave: chave, _id: id, _pedido: pedidoId, _fornecedor: fornecedorId });
  if (error) throw error;
  return {
    id: data.id, rodada: Number(data.rodada), situacao: data.situacao, pedidoId: data.pedido_id ?? null, numero: numOuNull(data.numero), fornecedor: data.fornecedor ?? null,
    produtos: (data.produtos ?? []).map(produtoFunc),
    itens: (data.itens ?? []).map((i: any) => ({ produtoId: i.produto_id, variacaoId: i.variacao_id ?? null, situacao: i.situacao })),
  };
}
export async function buscarProdutoFuncionario(chave: string, texto: string): Promise<ProdutoFunc[]> {
  const { data, error } = await db.rpc("funcionario_buscar_produto", { _chave: chave, _texto: texto });
  if (error) throw error;
  return (data ?? []).map(produtoFunc);
}
export type RespostaRecebimento =
  | { situacao: "recontar"; rodada: number; recontar: { produtoId: string; variacaoId: string | null }[]; faltam: { produtoId: string; variacaoId: string | null }[] }
  | { situacao: "concluido"; rodada: number; produtos: number; avisos: boolean };
export async function enviarRecebimento(chave: string, id: string, rodada: number, itens: ReturnType<typeof itemParaEnvio>[]): Promise<RespostaRecebimento> {
  const { data, error } = await db.rpc("funcionario_enviar_recebimento", { _chave: chave, _id: id, _rodada: rodada, _itens: itens });
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
    const { data, error } = await db.rpc("salvar_pedido", { p });
    if (!error) resultado = { id: data.id, numero: Number(data.numero) };
    return { error };
  });
  return { ...resultado!, recuperado: r === "anterior_gravado" };
}
export async function marcarPedidoEnviado(id: string, canal: CanalPedido) {
  const { error } = await db.rpc("marcar_pedido_enviado", { _pedido: id, _canal: canal });
  if (error) throw error;
}
/** Dono: marca como pago (com a data), desfaz (volta para a pagar) ou corrige vencimento e valor. Valor em centavos; undefined = não muda. */
export async function atualizarPagamento(id: string, a: { situacao: "a_pagar" | "pago"; vencimento?: string | null; pagoEm?: string | null; valor?: number | null }) {
  const p: Record<string, unknown> = { situacao: a.situacao, vencimento: a.vencimento ?? null, pago_em: a.pagoEm ?? null };
  if (a.valor !== undefined) p["valor_total"] = a.valor == null ? null : a.valor / 100;
  const { error } = await db.rpc("atualizar_pagamento", { _pedido: id, p });
  if (error) throw error;
}
export async function cancelarPedido(id: string) {
  const { error } = await db.rpc("cancelar_pedido", { _pedido: id });
  if (error) throw error;
}

/** Dono: troca o link do pedido; o antigo para de funcionar. */
export async function novoLinkPedido(id: string): Promise<string> {
  const { data, error } = await db.rpc("novo_link_pedido", { _pedido: id });
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
  const { data, error } = await db.rpc("pedido_publico", { _token: token });
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
  const { data, error } = await db.rpc("responder_pedido", { _token: token, r: {
    aceito: r.aceito, itens: r.itens.map((i) => ({ id: i.id, qtd_confirmada: i.qtdConfirmada })), previsao_entrega: r.previsaoEntrega,
    valor_total: r.valorTotal == null ? null : r.valorTotal / 100, forma_pagamento: r.forma, prazo_dias: r.prazoDias, recado: r.recado,
  } });
  if (error) throw error;
  return data?.situacao;
}

/* ---------- equipe (E1) ---------- */
export async function carregarFuncionarios(comercioId: string): Promise<Funcionario[]> {
  const [fs, aps] = await Promise.all([
    todos("funcionarios", "id,nome,funcao,codigo,codigo_gerado_em,pin_criado_em,bloqueado_em,ultimo_acesso,travado_ate,created_at", (q) => q.eq("comercio_id", comercioId).order("created_at")),
    todos("funcionario_aparelhos", "funcionario_id", (q) => q.eq("comercio_id", comercioId).is("encerrado_em", null)),
  ]);
  return fs.map((f) => ({
    id: f.id, nome: f.nome, funcao: f.funcao, codigo: f.codigo, codigoGeradoEm: f.codigo_gerado_em, primeiroAcessoEm: f.pin_criado_em ?? null,
    bloqueadoEm: f.bloqueado_em ?? null, ultimoAcesso: f.ultimo_acesso ?? null, travadoAte: f.travado_ate ?? null,
    celulares: aps.filter((a) => a.funcionario_id === f.id).length,
  }));
}
export async function criarFuncionario(comercioId: string, nome: string, funcao: Funcao): Promise<{ id: string; codigo: string }> {
  const { data, error } = await db.rpc("criar_funcionario", { _comercio: comercioId, _nome: nome, _funcao: funcao });
  if (error) throw error;
  return { id: data.id, codigo: data.codigo };
}
export async function atualizarFuncionario(id: string, nome: string, funcao: Funcao) {
  const { error } = await db.rpc("atualizar_funcionario", { _id: id, _nome: nome, _funcao: funcao });
  if (error) throw error;
}
/** Bloquear desliga os celulares; desbloquear devolve um código novo (o funcionário cria outro PIN). */
export async function bloquearFuncionario(id: string, bloquear: boolean): Promise<string | null> {
  const { data, error } = await db.rpc("bloquear_funcionario", { _id: id, _bloquear: bloquear });
  if (error) throw error;
  return data?.codigo ?? null;
}
export async function novoAcessoFuncionario(id: string): Promise<string> {
  const { data, error } = await db.rpc("novo_acesso_funcionario", { _id: id });
  if (error) throw error;
  return String(data.codigo);
}

/* ---------- app do funcionário (sem login) ---------- */
export type InicioFuncionario = {
  nome: string; funcao: Funcao; comercio: { nome: string; tipo: string };
  avisos: { entregas: number; entregasHoje: number; repor: number };
};
/** 'novo' (criar PIN), 'pin', 'expirado' ou null (código não vale). */
export async function conferirCodigoFuncionario(codigo: string): Promise<"novo" | "pin" | "expirado" | null> {
  const { data, error } = await db.rpc("conferir_codigo_funcionario", { _codigo: codigo });
  if (error) throw error;
  return data ?? null;
}
/** Devolve a chave do celular. PIN errado vem como erro com a mensagem do banco (pin_errado:N / muitas_tentativas:N). */
export async function entrarFuncionario(codigo: string, pin: string, aparelho: string): Promise<string> {
  const { data, error } = await db.rpc("entrar_funcionario", { _codigo: codigo, _pin: pin, _aparelho: aparelho });
  if (error) throw error;
  if (data?.erro) throw new Error(String(data.erro));
  return String(data.chave);
}
/** null = este celular foi desligado (bloqueio ou novo acesso). */
export async function inicioFuncionario(chave: string): Promise<InicioFuncionario | null> {
  const { data, error } = await db.rpc("funcionario_inicio", { _chave: chave });
  if (error) throw error;
  if (!data) return null;
  return {
    nome: data.nome, funcao: data.funcao, comercio: { nome: data.comercio?.nome ?? "", tipo: data.comercio?.tipo ?? "" },
    avisos: { entregas: Number(data.avisos?.entregas ?? 0), entregasHoje: Number(data.avisos?.entregas_hoje ?? 0), repor: Number(data.avisos?.repor ?? 0) },
  };
}
export async function sairFuncionario(chave: string) {
  const { error } = await db.rpc("sair_funcionario", { _chave: chave });
  if (error) throw error;
}

/* ---------- reposição (E3) ---------- */
export type ItemReposicao = ProdutoFunc & { local: string | null; localDeposito: string | null; depositoVazio: boolean };
export async function listaReposicao(chave: string): Promise<{ tipo: string; produtos: ItemReposicao[] }> {
  const { data, error } = await db.rpc("funcionario_reposicao_lista", { _chave: chave });
  if (error) throw error;
  return {
    tipo: data?.tipo ?? "",
    produtos: (data?.produtos ?? []).map((x: any) => ({ ...produtoFunc(x), local: x.local ?? null, localDeposito: x.local_deposito ?? null, depositoVazio: !!x.deposito_vazio })),
  };
}
export type RespostaContagemPrateleira = { sugerido: number; cheio: boolean; depositoVazio: boolean; localDeposito: string | null; situacao: "contado" | "concluido" };
/** O funcionário contou a prateleira; o servidor devolve só quanto buscar no depósito. */
export async function contarPrateleira(chave: string, id: string, produtoId: string, variacaoId: string | null, contado: number): Promise<RespostaContagemPrateleira> {
  const { data, error } = await db.rpc("funcionario_reposicao_contar", { _chave: chave, _id: id, _produto: produtoId, _variacao: variacaoId, _contado: contado });
  if (error) throw error;
  return { sugerido: Number(data.sugerido), cheio: !!data.cheio, depositoVazio: !!data.deposito_vazio, localDeposito: data.local_deposito ?? null, situacao: data.situacao };
}
export async function concluirReposicao(chave: string, id: string, levado: number) {
  const { error } = await db.rpc("funcionario_reposicao_concluir", { _chave: chave, _id: id, _levado: levado });
  if (error) throw error;
}
