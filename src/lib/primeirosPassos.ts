/* "Primeiros passos" da tela inicial do dono: o que falta para o comércio funcionar por inteiro.
 * Calculado só com o que o app já lê (produtos, lugares, fornecedores, equipe e caixas); nada muda no banco. */
export type Passo = { id: "comercio" | "produto" | "lugares" | "fornecedor" | "equipe" | "caixa"; titulo: string; ajuda: string; feito: boolean };

export type DadosPassos = {
  produtos: number;
  locais: { deposito: string[]; venda: string[] } | undefined;
  /** Algum produto já tem lugar definido (o lugar também nasce no cadastro do produto). */
  produtoComLocal: boolean;
  fornecedores: number;
  /** null = não deu para ler (o passo não aparece como feito nem some). */
  funcionarios: number | null;
  caixas: number | null;
  /** "Depósito" ou "Estoque"; "gôndolas" ou "área de venda". */
  deposito: string; venda: string;
};

export function primeirosPassos(d: DadosPassos): Passo[] {
  const lugares = d.produtoComLocal || !!d.locais && (d.locais.deposito.length > 0 || d.locais.venda.length > 0);
  return [
    { id: "comercio", titulo: "Cadastrar o comércio", ajuda: "Pronto!", feito: true },
    { id: "produto", titulo: "Cadastrar o primeiro produto", ajuda: "Bipe o código de barras e siga os passos", feito: d.produtos > 0 },
    { id: "lugares", titulo: `Dizer onde fica: ${d.deposito.toLowerCase()} e ${d.venda.toLowerCase()}`, ajuda: "No cadastro do produto, diga em que prateleira e gôndola ele fica", feito: lugares },
    { id: "fornecedor", titulo: "Cadastrar um fornecedor", ajuda: "Para fazer pedidos de compra com um toque", feito: d.fornecedores > 0 },
    { id: "equipe", titulo: "Adicionar um funcionário", ajuda: "Ele recebe mercadoria, repõe e confere pelo celular", feito: (d.funcionarios ?? 0) > 0 },
    { id: "caixa", titulo: "Ligar o caixa", ajuda: "No computador do caixa ou no próprio celular", feito: (d.caixas ?? 0) > 0 },
  ];
}

/** C1: só conta caixa ligado de verdade — com o computador conectado (ou do celular) e não desligado pelo dono. */
export const caixaLigado = (c: { tipo?: string | undefined; ligadoEm: string | null; desligadoEm: string | null }) =>
  !c.desligadoEm && (c.tipo === "celular" || !!c.ligadoEm);

export const passosFeitos = (ps: Passo[]) => ps.filter((p) => p.feito).length;

const CHAVE = "omni.passos.ocultos.v1";
export function passosOcultos(): string[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
export function ocultarPassos(comercioId: string) {
  try { localStorage.setItem(CHAVE, JSON.stringify([...new Set([...passosOcultos(), comercioId])])); } catch { /* sem armazenamento: só some nesta tela */ }
}
