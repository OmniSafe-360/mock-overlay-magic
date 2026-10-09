/* Ponte entre o cadastro (telas) e o banco. Monta pedidos para salvar_produto/resolver_pendencia e reconstrói os produtos ao carregar. */
import type { Product, Supplier, Variation } from "@/components/ProductArea";
import type { Deposito, DepVar } from "@/lib/deposito";
import { CHAVE_PRODUTO, type LinhaVal, type Validade } from "@/lib/validade";

export type AreaDb = "deposito" | "venda";
const AREAS: { db: AreaDb; prod: "deposito" | "areaVenda"; val: "dep" | "ven" }[] = [
  { db: "deposito", prod: "deposito", val: "dep" },
  { db: "venda", prod: "areaVenda", val: "ven" },
];
export const chaveArea = (a: AreaDb, varId: string | null) => `${a}:${varId ?? CHAVE_PRODUTO}`;
const reais = (cents: number) => Math.round(cents) / 100;
const centavos = (v: number | string) => Math.round(Number(v) * 100);

/* ---------- salvar ---------- */
export function montarPedido(p: Product, opId: string, comercioId: string, suppliers: Supplier[]) {
  const id = p.db!.id;
  const roupas = p.variacoes.length > 0;
  const contadas = new Set(p.db?.contadas ?? []);
  const detalhes = Object.fromEntries(Object.entries(p.detalhes).filter(([, v]) => v != null && String(v).trim() !== ""));
  const forn = p.fornecedor == null ? null : suppliers.find((s) => s.id === p.fornecedor)?.dbId ?? null;
  const areas: Record<string, unknown>[] = [];
  for (const a of AREAS) {
    const d = p[a.prod];
    if (!d) continue;
    const local = d.local ? { nome: d.local } : null;
    const itens: { varId: string | null; cfg: { qtd: number | null; min: number | null; max: number | null } }[] = roupas
      ? p.variacoes.map((v) => ({ varId: v.uid!, cfg: d.vars?.[v.uid!] ?? { qtd: 0, min: null, max: null } }))
      : [{ varId: null, cfg: d }];
    for (const { varId, cfg } of itens) {
      const row: Record<string, unknown> = { area: a.db, variacao_id: varId, local, minimo: cfg.min, maximo: cfg.max };
      if (!contadas.has(chaveArea(a.db, varId)) && cfg.qtd != null) {
        const linhas = p.validade?.controla ? p.validade[a.val][varId ?? CHAVE_PRODUTO] ?? [] : [];
        row["contagem"] = {
          quantidade: cfg.qtd,
          partes: cfg.qtd > 0 ? linhas.map((l) => ({ numero: l.lote, vencimento: l.data, quantidade: l.qtd, confirmada: !!l.pendConf })) : [],
        };
      }
      areas.push(row);
    }
  }
  return {
    operacao_id: opId,
    produto: {
      id, comercio_id: comercioId, fornecedor_id: forn, codigo_barras: p.codigo.trim() || null, nome: p.nome.trim(),
      categoria: p.categoria, unidade: p.unidade, preco_compra: reais(p.compra), preco_venda: reais(p.venda),
      marca: (detalhes["marca"] as string | undefined) ?? null, detalhes,
      controla_validade: p.validade ? p.validade.controla : null, avisos_dias: p.validade?.avisos ?? [],
    },
    variacoes: p.variacoes.map((v) => ({ id: v.uid, tamanho: v.tam, cor: v.cor.trim(), codigo_barras: v.codigo?.trim() || null, qtd_informada: v.qtd })),
    areas,
  };
}

/** Pendências já registradas que foram completadas ou divididas nesta edição. */
export function pedidosPendencias(antes: Validade | undefined, depois: Validade | undefined, farm: boolean) {
  const out: { origem: string; partes: { numero: string | null; vencimento: string | null; quantidade: number; confirmada: boolean }[] }[] = [];
  if (!antes?.controla || !depois?.controla) return out;
  for (const a of ["dep", "ven"] as const)
    for (const [k, ls] of Object.entries(antes[a])) {
      const novas = depois[a][k] ?? [];
      for (const o of ls.filter((l) => !l.data || (farm && !l.lote))) {
        const partes = novas.filter((l) => l.id === o.id || l.origem === o.id);
        const igual = partes.length === 1 && partes[0]!.id === o.id && partes[0]!.qtd === o.qtd && partes[0]!.data === o.data && (partes[0]!.lote ?? null) === (o.lote ?? null);
        if (!partes.length || igual) continue;
        out.push({ origem: o.id, partes: partes.map((l) => ({ numero: l.lote, vencimento: l.data, quantidade: l.qtd, confirmada: !!l.pendConf })) });
      }
    }
  return out;
}

/* ---------- mensagens em português ---------- */
const MSG: [string, string][] = [
  ["nao_autenticado", "Sua sessão expirou. Entre novamente para salvar."],
  ["sem_acesso_ao_comercio", "Você não tem acesso a este comércio."],
  ["operacao_reutilizada", "Este envio já foi registrado com outro conteúdo. Feche o cadastro e tente de novo."],
  ["codigo_em_uso", "Este código de barras já está cadastrado neste comércio."],
  ["codigo_igual_ao_principal", "O código da variação precisa ser diferente do código principal."],
  ["unidade_incompativel", "Unidade incompatível com este comércio. Escolha uma opção válida."],
  ["categoria_incompativel", "Categoria incompatível com este comércio. Escolha uma opção válida."],
  ["controlado_invalido", "Escolha Sim ou Não para informar se o medicamento é controlado."],
  ["especie_invalido", "Escolha Cão, Gato ou Outros para informar a espécie."],
  ["posicao_invalido", "Escolha uma das opções disponíveis para informar a posição."],
  ["unidade_travada", "Este produto já tem quantidades registradas. A unidade não pode ser alterada."],
  ["fornecedor_de_outro_dono", "Este fornecedor não pertence a você. Escolha outro."],
  ["farmacia_exige_validade", "Na farmácia o controle de validade é obrigatório."],
  ["desligar_validade_bloqueado", "Há quantidade registrada com validade ou pendência. Desligar o controle não é permitido."],
  ["remocao_bloqueada", "Esta variação tem quantidade registrada. Removê-la não é permitido."],
  ["roupas_exige_variacao", "Adicione pelo menos uma variação."],
  ["tamanho_invalido", "Escolha um tamanho da lista."],
  ["cor_obrigatoria", "Informe a cor de cada variação."],
  ["codigo_da_variacao_obrigatorio", "Informe o código de barras de cada variação."],
  ["quantidade_informada_obrigatoria", "Informe a quantidade de cada variação."],
  ["combinacao_repetida", "Já existe uma variação com este tamanho e cor."],
  ["tipo_sem_variacoes", "Este tipo de comércio não usa variações."],
  ["troca_de_local_exige_transferencia", "Há quantidade neste local. Mudar de local exigirá uma transferência, que virá numa etapa futura."],
  ["maximo_menor_que_minimo", "O máximo precisa ser igual ou maior que o mínimo."],
  ["contagem_ja_registrada", "A contagem inicial deste produto já foi registrada."],
  ["soma_diferente_da_contagem", "As validades não somam a quantidade contada. Revise as validades."],
  ["soma_das_partes", "As partes precisam somar exatamente a pendência original."],
  ["pendencia_sem_confirmacao", "Confirme o registro como pendente de conferência."],
  ["lote_com_datas_diferentes", "Este lote já está registrado com outro vencimento. Revise as validades."],
  ["datas_diferentes_para_o_mesmo_lote", "O mesmo lote recebeu vencimentos diferentes. Revise as validades."],
  ["lote_conhecido_alterado", "O número de lote já registrado não pode ser trocado."],
  ["vencimento_conhecido_alterado", "O vencimento já registrado não pode ser trocado."],
  ["partes_em_area_sem_estoque", "Esta área não tem estoque. Remova as validades dela."],
  ["quantidade", "Quantidade inválida para esta unidade."],
];
export function mensagemErro(e: unknown): string {
  const m = String((e as { message?: string } | null)?.message ?? e ?? "");
  if (/fetch|network|Failed to/i.test(m)) return "Sem conexão. Seus dados continuam no formulário. Tente salvar de novo.";
  return MSG.find(([k]) => m.includes(k))?.[1] ?? "Não foi possível salvar agora. Seus dados continuam no formulário. Tente de novo.";
}

/* ---------- carregar ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
export type Bruto = { produtos: Row[]; variacoes: Row[]; areas: Row[]; locais: Row[]; contagens: Row[]; saldos: Row[]; lotes: Row[] };

export function montarProdutos(b: Bruto, suppliers: Supplier[]): Product[] {
  const local = new Map(b.locais.map((l) => [l.id as string, l.nome as string]));
  const lote = new Map(b.lotes.map((l) => [l.id as string, l]));
  return b.produtos.map((pr, i) => {
    const vars: Variation[] = b.variacoes.filter((v) => v.produto_id === pr.id)
      .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))
      .map((v) => ({ tam: v.tamanho ?? "", cor: v.cor ?? "", codigo: v.codigo_barras ?? "", qtd: Number(v.qtd_informada ?? 0), uid: v.id }));
    const roupas = vars.length > 0;
    const conts = b.contagens.filter((c) => c.produto_id === pr.id);
    const qtdDe = (a: AreaDb, v: string | null) => { const c = conts.find((x) => x.area === a && (x.variacao_id ?? null) === v); return c ? Number(c.quantidade) : null; };
    const area = (a: AreaDb): Deposito | undefined => {
      const rows = b.areas.filter((r) => r.produto_id === pr.id && r.area === a && (!roupas || vars.some((v) => v.uid === r.variacao_id)));
      if (!rows.length) return undefined;
      const n = (x: unknown) => (x == null ? null : Number(x));
      const nomeLocal = rows[0]!.local_id ? local.get(rows[0]!.local_id) ?? null : null;
      if (!roupas) { const r = rows[0]!; return { local: nomeLocal, qtd: qtdDe(a, null), min: n(r.minimo), max: n(r.maximo) }; }
      const vs: Record<string, DepVar> = {};
      for (const r of rows) vs[r.variacao_id] = { qtd: qtdDe(a, r.variacao_id) ?? 0, min: n(r.minimo), max: n(r.maximo) };
      return { local: nomeLocal, qtd: null, min: null, max: null, vars: vs };
    };
    let validade: Validade | undefined;
    if (pr.controla_validade === false) validade = { controla: false, avisos: [], dep: {}, ven: {} };
    else if (pr.controla_validade === true) {
      validade = { controla: true, avisos: (pr.avisos_dias ?? []).map(Number).sort((a: number, c: number) => a - c), dep: {}, ven: {} };
      for (const s of b.saldos.filter((x) => x.produto_id === pr.id && Number(x.quantidade) > 0)) {
        const l = s.lote_id ? lote.get(s.lote_id) : undefined;
        const linha: LinhaVal = { id: s.id, qtd: Number(s.quantidade), data: l?.vencimento ?? null, lote: l?.numero ?? null, ...(s.pendencia_confirmada ? { pendConf: true } : {}) };
        const alvo = validade[s.area === "deposito" ? "dep" : "ven"];
        (alvo[s.variacao_id ?? CHAVE_PRODUTO] ??= []).push(linha);
      }
    }
    const forn = pr.fornecedor_id ? suppliers.find((s) => s.dbId === pr.fornecedor_id)?.id ?? null : null;
    const det = Object.fromEntries(Object.entries((pr.detalhes ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
    return {
      id: i + 1, codigo: pr.codigo_barras ?? "", nome: pr.nome, compra: centavos(pr.preco_compra), venda: centavos(pr.preco_venda),
      unidade: pr.unidade, categoria: pr.categoria ?? "", detalhes: det, variacoes: vars, fornecedor: forn,
      deposito: area("deposito"), areaVenda: area("venda"), validade,
      db: { id: pr.id, contadas: conts.map((c) => chaveArea(c.area, c.variacao_id ?? null)) },
    };
  });
}

export const montarFornecedores = (rows: Row[]): Supplier[] =>
  rows.map((r, i) => ({ id: i + 1, nome: r.nome, tel: r.telefone ?? "", email: r.email ?? "", dbId: r.id }));
