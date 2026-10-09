/* Acesso ao Supabase do cadastro de produtos. As regras de acesso do banco garantem que só o dono vê o próprio comércio. */
import { supabase } from "@/integrations/supabase/client";
import type { Product, Supplier } from "@/components/ProductArea";
import { montarFornecedores, montarPedido, montarProdutos, pedidosPendencias, type Bruto } from "@/lib/persistencia";

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

export async function criarFornecedor(id: string, f: { nome: string; tel: string; email: string }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("nao_autenticado");
  const { error } = await db.from("fornecedores").insert({ id, dono_id: u.user.id, nome: f.nome, telefone: f.tel || null, email: f.email || null });
  if (error) throw error;
}

export async function carregarProdutos(comercioId: string, suppliers: Supplier[]): Promise<Product[]> {
  const doComercio = (q: any) => q.eq("comercio_id", comercioId);
  const [produtos, variacoes, areas, locais, contagens, saldos, lotes] = await Promise.all([
    todos("produtos", "*", (q) => doComercio(q).eq("ativo", true).order("created_at", { ascending: false })),
    todos("produto_variacoes", "*", (q) => doComercio(q).is("removida_em", null)),
    todos("produto_areas", "*", doComercio),
    todos("locais", "id,nome,area", doComercio),
    todos("contagens", "produto_id,variacao_id,area,quantidade", doComercio),
    todos("saldos", "*", (q) => doComercio(q).gt("quantidade", 0).order("updated_at")),
    todos("lotes", "id,numero,vencimento", doComercio),
  ]);
  const b: Bruto = { produtos, variacoes, areas, locais, contagens, saldos, lotes };
  return montarProdutos(b, suppliers);
}

/** Salva o produto (uma transação) e depois as pendências completadas/divididas. Repetir com os mesmos ids não grava de novo. */
export async function salvarProduto(p: Product, antes: Product | undefined, comercioId: string, farm: boolean, suppliers: Supplier[],
  ops: { salvar: string; pend: Record<string, string> }, novoId: () => string) {
  const { error } = await db.rpc("salvar_produto", { p: montarPedido(p, ops.salvar, comercioId, suppliers) });
  if (error) throw error;
  for (const r of pedidosPendencias(antes?.validade, p.validade, farm)) {
    ops.pend[r.origem] ??= novoId();
    const { error: e2 } = await db.rpc("resolver_pendencia", {
      p: { operacao_id: ops.pend[r.origem], comercio_id: comercioId, produto_id: p.db!.id, origem_id: r.origem, partes: r.partes, confirmar_vencimento: true },
    });
    if (e2) throw e2;
  }
}
