/* Acesso ao Supabase do cadastro de produtos. As regras de acesso do banco garantem que só o dono vê o próprio comércio. */
import { supabase } from "@/integrations/supabase/client";
import type { Product, Supplier } from "@/components/ProductArea";
import { enviarCadastro, linhaFornecedor, montarCadastro, montarFornecedores, montarProdutos, type Bruto, type Sessao } from "@/lib/persistencia";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;

async function todos(tabela: string, colunas: string, filtro: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await filtro(db.from(tabela).select(colunas)).range(de, de + 999);
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

/** Código interno (EAN-13 começando com 29) para produto sem código de barras. Só o dono do comércio. */
export async function gerarCodigoInterno(comercioId: string): Promise<string> {
  const { data, error } = await db.rpc("gerar_codigo_interno", { _comercio: comercioId });
  if (error) throw error;
  if (typeof data !== "string" || !/^29\d{11}$/.test(data)) throw new Error("codigo_interno_invalido");
  return data;
}

export type LocaisCadastrados = { deposito: string[]; venda: string[] };

export async function carregarProdutos(comercioId: string, suppliers: Supplier[]): Promise<{ produtos: Product[]; locais: LocaisCadastrados }> {
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
