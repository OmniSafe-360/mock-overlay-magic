/* Leitura das notas do cupom que o sistema do caixa guarda na pasta (Fase 3.3).
 * NFC-e (modelo 65, todo o Brasil) e CF-e SAT (modelo 59, São Paulo). Também os cancelamentos.
 * A nota só existe depois que a venda é FINALIZADA no caixa: é isso que garante a regra do dono (bipar não desconta). */

export type ItemNota = { n: number; codigo: string; ean: string | null; descricao: string; qtd: number; unidade: string; valor: number };
export type NotaVenda = {
  chave: string; numero: number | null; serie: number | null; emitida_em: string; total: number;
  pagamentos: { forma: string; valor: number }[]; itens: ItemNota[];
  /** CNPJ de quem emitiu (para conferir com o comércio). */
  cnpj: string | null;
};
export type LidoDaNota =
  | { tipo: "venda"; nota: NotaVenda }
  | { tipo: "cancelamento"; chave: string; quando: string | null }
  | { tipo: "rejeitada"; chave: string | null; motivo: string }
  | { tipo: "outro" };

/* Procura pelo nome da tag sem se importar com o "namespace" do XML. */
const todos = (el: Element | Document, nome: string) => [...el.getElementsByTagName("*")].filter((e) => e.localName === nome);
const um = (el: Element | Document | null | undefined, nome: string): Element | null => (el ? todos(el, nome)[0] ?? null : null);
const txt = (el: Element | Document | null | undefined, nome: string) => um(el, nome)?.textContent?.trim() ?? "";
const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const soDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Data do SAT ("20261010" + "143200") para ISO com o fuso de Brasília. */
function dataSat(d: string, h: string): string {
  if (!/^\d{8}$/.test(d)) return "";
  const hh = /^\d{6}$/.test(h) ? h : "000000";
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${hh.slice(0, 2)}:${hh.slice(2, 4)}:${hh.slice(4, 6)}-03:00`;
}

function itens(raiz: Element): ItemNota[] {
  return todos(raiz, "det").map((det, i) => {
    const prod = um(det, "prod");
    const ean = soDigitos(txt(prod, "cEAN"));
    const valor = num(txt(prod, "vProd")) - num(txt(prod, "vDesc"));
    return {
      n: Number(det.getAttribute("nItem")) || i + 1,
      codigo: txt(prod, "cProd") || ean || `item ${i + 1}`,
      ean: ean.length >= 8 ? ean : null,
      descricao: txt(prod, "xProd"),
      qtd: num(txt(prod, "qCom")),
      unidade: txt(prod, "uCom"),
      valor: Math.max(0, Math.round(valor * 100) / 100),
    };
  });
}

/** Lê o texto de um arquivo .xml da pasta das notas. */
export function lerNota(xml: string): LidoDaNota {
  let doc: Document;
  try { doc = new DOMParser().parseFromString(xml, "application/xml"); } catch { return { tipo: "outro" }; }
  if (doc.getElementsByTagName("parsererror").length) return { tipo: "outro" };

  // Cancelamento de NFC-e (evento 110111, ou 110112 por substituição).
  const infEvento = um(doc, "infEvento");
  if (infEvento) {
    const tp = txt(infEvento, "tpEvento");
    const ch = soDigitos(txt(infEvento, "chNFe"));
    if ((tp === "110111" || tp === "110112") && ch.length === 44) {
      const ret = um(doc, "retEvento");
      const st = ret ? txt(ret, "cStat") : "";
      if (st && !["135", "136", "155"].includes(st)) return { tipo: "rejeitada", chave: ch, motivo: `cancelamento recusado pela Sefaz (${st})` };
      return { tipo: "cancelamento", chave: ch, quando: txt(infEvento, "dhEvento") || null };
    }
    return { tipo: "outro" };
  }

  // Cancelamento do SAT.
  const cfeCanc = um(doc, "CFeCanc");
  if (cfeCanc) {
    const inf = um(cfeCanc, "infCFe");
    const ch = soDigitos(inf?.getAttribute("chCanc"));
    if (ch.length === 44) return { tipo: "cancelamento", chave: ch, quando: dataSat(txt(inf, "dEmi"), txt(inf, "hEmi")) || null };
    return { tipo: "outro" };
  }

  // NFC-e (modelo 65).
  const infNFe = um(doc, "infNFe");
  if (infNFe) {
    const chave = soDigitos(infNFe.getAttribute("Id"));
    const ide = um(infNFe, "ide");
    if (txt(ide, "mod") !== "65") return { tipo: "outro" }; // NF-e de compra (modelo 55) não é venda do caixa
    const prot = um(doc, "infProt");
    const st = prot ? txt(prot, "cStat") : "";
    if (st && !["100", "150"].includes(st)) return { tipo: "rejeitada", chave: chave || null, motivo: `nota não autorizada pela Sefaz (${st})` };
    const nota: NotaVenda = {
      chave,
      numero: Number(txt(ide, "nNF")) || null,
      serie: Number(txt(ide, "serie")) || null,
      emitida_em: txt(ide, "dhEmi"),
      total: num(txt(um(infNFe, "ICMSTot"), "vNF")),
      pagamentos: todos(infNFe, "detPag").map((p) => ({ forma: txt(p, "tPag"), valor: num(txt(p, "vPag")) })),
      itens: itens(infNFe),
      cnpj: soDigitos(txt(um(infNFe, "emit"), "CNPJ")) || null,
    };
    return chave.length === 44 && nota.itens.length ? { tipo: "venda", nota } : { tipo: "outro" };
  }

  // CF-e SAT (modelo 59).
  const cfe = um(doc, "CFe");
  if (cfe) {
    const inf = um(cfe, "infCFe");
    if (!inf) return { tipo: "outro" };
    const chave = soDigitos(inf.getAttribute("Id"));
    const ide = um(inf, "ide");
    const nota: NotaVenda = {
      chave,
      numero: Number(txt(ide, "nCFe")) || null,
      serie: Number(txt(ide, "numeroCaixa")) || null,
      emitida_em: dataSat(txt(ide, "dEmi"), txt(ide, "hEmi")),
      total: num(txt(um(inf, "total"), "vCFe")),
      pagamentos: todos(inf, "MP").map((p) => ({ forma: txt(p, "cMP"), valor: num(txt(p, "vMP")) })),
      itens: itens(inf),
      cnpj: soDigitos(txt(um(inf, "emit"), "CNPJ")) || null,
    };
    return chave.length === 44 && nota.itens.length ? { tipo: "venda", nota } : { tipo: "outro" };
  }
  return { tipo: "outro" };
}

/** O que vai para o banco (sem o CNPJ, que o banco tira da própria chave). */
export const notaParaEnvio = ({ cnpj: _c, ...n }: NotaVenda) => n;
