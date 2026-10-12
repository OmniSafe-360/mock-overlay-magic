/* Página do cliente do fiado (P2): link + PIN. Só leitura. */
import { supabase } from "@/integrations/supabase/client";

export type EstadoFiado =
  | { estado: "invalido" }
  | { estado: "novo" | "pin"; comercio: string; cliente: string; temTelefone: boolean; travadoAte: string | null };

export type MovFiado = {
  tipo: string; valor: number; forma: string | null; criadoEm: string; vendaNumero: number | null;
  itens: { descricao: string; qtd: number; valor: number }[];
};
export type ExtratoFiado = {
  cliente: string; comercio: string; telefoneComercio: string; whatsapp: boolean;
  deve: number; desde: string | null; limite: number | null; bloqueado: boolean; movimentos: MovFiado[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (nome: string, args: Record<string, unknown>) => (supabase.rpc as any)(nome, args);

export async function fiadoEstado(token: string): Promise<EstadoFiado> {
  const { data, error } = await rpc("fiado_publico_estado", { _token: token });
  if (error) throw error;
  if (!data || data.estado === "invalido") return { estado: "invalido" };
  return { estado: data.estado, comercio: data.comercio ?? "", cliente: data.cliente ?? "", temTelefone: !!data.tem_telefone, travadoAte: data.travado_ate ?? null };
}

export type ResultadoEntrar = { ok: true; sessao: string } | { ok: false; erro: string; restam?: number };

export async function fiadoEntrar(token: string, finalTel: string, pin: string): Promise<ResultadoEntrar> {
  const { data, error } = await rpc("fiado_publico_entrar", { _token: token, _final_tel: finalTel, _pin: pin });
  if (error) {
    const m = String(error.message ?? "");
    for (const c of ["travado", "pin_facil", "pin_formato", "link_invalido"]) if (m.includes(c)) return { ok: false, erro: c };
    throw error;
  }
  return data?.ok ? { ok: true, sessao: data.sessao } : { ok: false, erro: data?.erro ?? "erro", restam: data?.restam };
}

export async function fiadoExtrato(token: string, sessao: string): Promise<ExtratoFiado | "pin"> {
  const { data, error } = await rpc("fiado_publico_extrato", { _token: token, _sessao: sessao });
  if (error) {
    if (String(error.message ?? "").includes("pin_necessario")) return "pin";
    throw error;
  }
  return {
    cliente: data.cliente, comercio: data.comercio, telefoneComercio: data.telefone_comercio ?? "", whatsapp: !!data.whatsapp,
    deve: Number(data.deve ?? 0), desde: data.desde ?? null, limite: data.limite == null ? null : Number(data.limite), bloqueado: !!data.bloqueado,
    movimentos: (data.movimentos ?? []).map(// eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => ({
      tipo: String(m.tipo), valor: Number(m.valor), forma: (m.forma as string) ?? null, criadoEm: String(m.criado_em),
      vendaNumero: (m.venda_numero as number) ?? null,
      itens: ((m.itens ?? []) as any[]).map((i: any) => ({ descricao: String(i.descricao), qtd: Number(i.qtd), valor: Number(i.valor) })),
    })),
  };
}

export const mensagemEntrarFiado = (erro: string, restam?: number) =>
  erro === "pin_errado" ? `PIN errado.${restam != null ? ` Ainda tem ${restam} tentativa${restam === 1 ? "" : "s"}.` : ""}`
  : erro === "telefone_errado" ? `Os números do telefone não conferem.${restam != null ? ` Ainda tem ${restam} tentativa${restam === 1 ? "" : "s"}.` : ""}`
  : erro === "travado" ? "Muitas tentativas. Espere 15 minutos e tente de novo."
  : erro === "pin_facil" ? "Esse PIN é fácil demais. Escolha outro (não use 1111, 1234…)."
  : erro === "pin_formato" ? "O PIN tem 4 números."
  : erro === "link_invalido" ? "Este link não vale mais. Peça um novo ao comércio."
  : "Não deu certo. Tente de novo.";

export const textoMov = (m: MovFiado) =>
  m.tipo === "compra" ? `Comprou${m.vendaNumero ? ` (venda nº ${m.vendaNumero})` : ""}`
  : m.tipo === "pagamento" ? `Pagou${m.forma ? ` em ${m.forma === "dinheiro" ? "dinheiro" : m.forma === "pix" ? "Pix" : m.forma === "cartao" ? "cartão" : m.forma}` : ""}`
  : m.tipo === "cancelamento" ? "Compra cancelada" : m.tipo;

/** P3: dono pega o link do cliente (cria se ainda não existir). */
export async function linkClienteDono(clienteId: string): Promise<string> {
  const { data, error } = await rpc("fiado_cliente_link", { _cliente: clienteId });
  if (error) throw error;
  return String(data);
}
/** P3: caixa pega o link do cliente. */
export async function linkClienteCaixa(chave: string, clienteId: string): Promise<string> {
  const { data, error } = await rpc("caixa_fiado_cliente_link", { _chave: chave, _cliente: clienteId });
  if (error) throw error;
  return String(data);
}

/** P4: avisos da página do cliente. `vistoEm` = última vez que ele abriu a conta neste aparelho (null = primeira vez). */
export function avisosFiado(x: Pick<ExtratoFiado, "deve" | "desde" | "movimentos">, vistoEm: string | null, agora = Date.now()) {
  const avisos: { tipo: "compra" | "pagamento" | "antiga"; texto: string }[] = [];
  if (vistoEm) {
    const novos = x.movimentos.filter((m) => Date.parse(m.criadoEm) > Date.parse(vistoEm));
    const compras = novos.filter((m) => m.tipo === "compra");
    const pags = novos.filter((m) => m.tipo === "pagamento");
    const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (compras.length) avisos.push({ tipo: "compra", texto: `${compras.length === 1 ? "1 compra nova" : `${compras.length} compras novas`} desde a sua última visita: ${brl(compras.reduce((t, m) => t + m.valor, 0))}.` });
    if (pags.length) avisos.push({ tipo: "pagamento", texto: `${pags.length === 1 ? "Pagamento recebido" : `${pags.length} pagamentos recebidos`}: ${brl(pags.reduce((t, m) => t + m.valor, 0))}. Obrigado!` });
  }
  if (x.deve > 0 && x.desde) {
    const dias = Math.floor((agora - Date.parse(x.desde)) / 86400000);
    if (dias > 30) avisos.push({ tipo: "antiga", texto: `Sua conta está aberta há ${dias} dias. Quando puder, passe no comércio para acertar.` });
  }
  return avisos;
}
export const chaveVisto = (token: string) => `omni.fiado.visto:${token.slice(0, 16)}`;

/** P5: controles do dono sobre o acesso do cliente. */
export type InfoAcesso = { temLink: boolean; temPin: boolean; ultimoAcesso: string | null };
export async function acessoInfo(clienteId: string): Promise<InfoAcesso> {
  const { data, error } = await rpc("fiado_acesso_info", { _cliente: clienteId });
  if (error) throw error;
  return { temLink: !!data?.tem_link, temPin: !!data?.tem_pin, ultimoAcesso: data?.ultimo_acesso ?? null };
}
export async function novoLinkCliente(clienteId: string): Promise<string> {
  const { data, error } = await rpc("fiado_novo_link", { _cliente: clienteId });
  if (error) throw error;
  return String(data);
}
export async function zerarPinCliente(clienteId: string): Promise<void> {
  const { error } = await rpc("fiado_zerar_pin", { _cliente: clienteId });
  if (error) throw error;
}
