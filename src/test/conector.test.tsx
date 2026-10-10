import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OmniConector, type ApiOmniConector } from "@/components/OmniConector";
import { lerFeitos, marcarFeito, processarArquivo, type ApiConector } from "@/lib/conector";
import { lerNota } from "@/lib/nfce";

const CH = "35261012345678000199650010000045211123456785";
const nfce = (extra = "", cStat = "100", mod = "65") => `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${CH}" versao="4.00">
<ide><cUF>35</cUF><mod>${mod}</mod><serie>1</serie><nNF>4521</nNF><dhEmi>2026-10-10T14:32:00-03:00</dhEmi></ide>
<emit><CNPJ>12345678000199</CNPJ><xNome>MERCADO BOM PRECO</xNome></emit>
<det nItem="1"><prod><cProd>101</cProd><cEAN>7893464100065</cEAN><xProd>ARROZ TIO JOAO 5KG</xProd><uCom>UN</uCom><qCom>2.0000</qCom><vProd>51.80</vProd></prod></det>
<det nItem="2"><prod><cProd>2001</cProd><cEAN>SEM GTIN</cEAN><xProd>BANANA PRATA KG</xProd><uCom>KG</uCom><qCom>1.2350</qCom><vProd>7.41</vProd><vDesc>0.41</vDesc></prod></det>
${extra}<total><ICMSTot><vProd>59.21</vProd><vNF>58.80</vNF></ICMSTot></total>
<pag><detPag><tPag>17</tPag><vPag>58.80</vPag></detPag></pag></infNFe></NFe>
<protNFe versao="4.00"><infProt><chNFe>${CH}</chNFe><cStat>${cStat}</cStat></infProt></protNFe></nfeProc>`;
const cancelamento = `<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe"><evento><infEvento Id="ID110111${CH}01"><chNFe>${CH}</chNFe>
<dhEvento>2026-10-10T14:40:00-03:00</dhEvento><tpEvento>110111</tpEvento></infEvento></evento><retEvento><infEvento><cStat>135</cStat></infEvento></retEvento></procEventoNFe>`;
const CH_SAT = "35261012345678000199590001234560000012345671";
const sat = `<CFe><infCFe Id="CFe${CH_SAT}"><ide><nCFe>000123</nCFe><dEmi>20261010</dEmi><hEmi>143200</hEmi><numeroCaixa>002</numeroCaixa></ide>
<emit><CNPJ>12345678000199</CNPJ></emit><det nItem="1"><prod><cProd>101</cProd><cEAN>7893464100065</cEAN><xProd>ARROZ</xProd><uCom>UN</uCom><qCom>3.0000</qCom><vProd>77.70</vProd></prod></det>
<total><vCFe>77.70</vCFe></total><pgto><MP><cMP>01</cMP><vMP>100.00</vMP></MP></pgto></infCFe></CFe>`;
const satCanc = `<CFeCanc><infCFe Id="CFe35261012345678000199590001234560000012399999" chCanc="CFe${CH_SAT}"><ide><dEmi>20261010</dEmi><hEmi>150000</hEmi></ide></infCFe></CFeCanc>`;

describe("ler as notas do caixa", () => {
  it("NFC-e autorizada vira venda com itens, desconto, total e pagamento", () => {
    const r = lerNota(nfce());
    expect(r.tipo).toBe("venda");
    if (r.tipo !== "venda") return;
    expect(r.nota).toMatchObject({ chave: CH, numero: 4521, serie: 1, emitida_em: "2026-10-10T14:32:00-03:00", total: 58.8, cnpj: "12345678000199", pagamentos: [{ forma: "17", valor: 58.8 }] });
    expect(r.nota.itens).toEqual([
      { n: 1, codigo: "101", ean: "7893464100065", descricao: "ARROZ TIO JOAO 5KG", qtd: 2, unidade: "UN", valor: 51.8 },
      { n: 2, codigo: "2001", ean: null, descricao: "BANANA PRATA KG", qtd: 1.235, unidade: "KG", valor: 7 },
    ]);
  });
  it("nota recusada pela Sefaz e nota de compra (modelo 55) não contam", () => {
    expect(lerNota(nfce("", "302"))).toMatchObject({ tipo: "rejeitada", chave: CH });
    expect(lerNota(nfce("", "100", "55"))).toEqual({ tipo: "outro" });
    expect(lerNota("isto não é xml")).toEqual({ tipo: "outro" });
  });
  it("cancelamento da NFC-e e SAT (venda e cancelamento)", () => {
    expect(lerNota(cancelamento)).toEqual({ tipo: "cancelamento", chave: CH, quando: "2026-10-10T14:40:00-03:00" });
    const s = lerNota(sat);
    expect(s).toMatchObject({ tipo: "venda", nota: { chave: CH_SAT, numero: 123, emitida_em: "2026-10-10T14:32:00-03:00", total: 77.7, pagamentos: [{ forma: "01", valor: 100 }] } });
    expect(lerNota(satCanc)).toEqual({ tipo: "cancelamento", chave: CH_SAT, quando: "2026-10-10T15:00:00-03:00" });
  });
});

const apiNota = (over: Partial<ApiConector> = {}): ApiConector => ({
  enviar: vi.fn(async () => ({ situacao: "registrada", sem_cadastro: 0 })),
  cancelar: vi.fn(async () => ({ situacao: "cancelada" })),
  ...over,
});
describe("mandar ao Omni", () => {
  it("venda, sem cadastro, repetida, anterior e cancelamento", async () => {
    const a = apiNota();
    expect(await processarArquivo(nfce(), "k", a)).toMatchObject({ ok: true, nivel: "ok", texto: expect.stringMatching(/^Nota 4521 · 2 itens · R\$\s58,80$/) });
    expect(vi.mocked(a.enviar).mock.calls[0]![1]).not.toHaveProperty("cnpj");
    vi.mocked(a.enviar).mockResolvedValueOnce({ situacao: "registrada", sem_cadastro: 1 });
    expect((await processarArquivo(nfce(), "k", a)).texto).toMatch(/1 sem cadastro no Omni/);
    vi.mocked(a.enviar).mockResolvedValueOnce({ situacao: "repetida" });
    expect((await processarArquivo(nfce(), "k", a)).texto).toBe("Nota 4521: já tinha sido enviada");
    vi.mocked(a.enviar).mockResolvedValueOnce({ situacao: "anterior" });
    expect((await processarArquivo(nfce(), "k", a)).texto).toMatch(/antes de ligar o caixa/);
    expect((await processarArquivo(cancelamento, "k", a, { area: "área de venda" })).texto).toBe("Venda cancelada: os produtos voltaram para a área de venda");
  });
  it("erro de internet tenta de novo; nota de outro CNPJ e caixa desligado não", async () => {
    expect(await processarArquivo(nfce(), "k", apiNota({ enviar: vi.fn(async () => { throw new Error("Failed to fetch"); }) }))).toMatchObject({ ok: false, tentarDeNovo: true });
    expect(await processarArquivo(nfce(), "k", apiNota(), { cnpj: "99999999000199" })).toMatchObject({ ok: false, tentarDeNovo: false, texto: /outro CNPJ/ });
    expect(await processarArquivo(nfce(), "k", apiNota({ enviar: vi.fn(async () => { throw new Error("caixa_desligado"); }) }))).toMatchObject({ ok: false, desligado: true });
  });
  it("lista de arquivos já enviados guarda só os últimos 15 dias", () => {
    localStorage.clear();
    const t = Date.parse("2026-10-10T12:00:00Z");
    marcarFeito("velho", t - 20 * 86_400_000);
    marcarFeito("novo", t);
    expect(Object.keys(lerFeitos())).toEqual(["novo"]);
  });
});

const estado = { caixa: "Caixa 1", comercio: { nome: "Mercado Bom Preço", tipo: "mercado", documento: "12345678000199" }, ultimaVendaEm: null, desde: "2026-10-01T00:00:00Z", hoje: { vendas: 3, total: 15990 } };
function apiTela(over: Partial<ApiOmniConector> = {}) {
  return {
    ligar: vi.fn(async () => ({ chave: "c".repeat(64), caixa: "Caixa 1", comercio: { nome: "Mercado Bom Preço", tipo: "mercado" } })),
    estado: vi.fn(async (): Promise<typeof estado | null> => estado),
    enviar: vi.fn(async () => ({ situacao: "registrada", sem_cadastro: 0 })),
    cancelar: vi.fn(async () => ({ situacao: "cancelada" })),
    ...over,
  };
}

describe("tela do Omni Conector", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  it("liga com o código de 8 números e mostra o caixa", async () => {
    const a = apiTela();
    render(<OmniConector api={a} />);
    fireEvent.change(await screen.findByLabelText("Digite o código do caixa"), { target: { value: "4815 1623" } });
    await waitFor(() => expect(a.ligar).toHaveBeenCalledWith("48151623", expect.any(String)));
    expect(await screen.findByText("Caixa 1 · Mercado Bom Preço")).toBeTruthy();
    expect(screen.getByText(/R\$\s?159,90/)).toBeTruthy();
    expect(screen.getByText("3 vendas")).toBeTruthy();
    expect(localStorage.getItem("omni.conector.chave")).toBe("c".repeat(64));
    // Sem o Chrome/Edge (aqui não há como ler pastas): explica e ainda deixa mandar arquivos.
    expect(screen.getByText(/Este navegador não consegue ler pastas/)).toBeTruthy();
  });
  it("código errado ou vencido", async () => {
    const a = apiTela({ ligar: vi.fn(async () => { throw new Error("codigo_expirado"); }) });
    render(<OmniConector api={a} />);
    fireEvent.change(await screen.findByLabelText("Digite o código do caixa"), { target: { value: "11112222" } });
    expect(await screen.findByText(/Este código venceu/)).toBeTruthy();
  });
  it("escolher notas manda cada venda e mostra o que foi enviado", async () => {
    localStorage.setItem("omni.conector.chave", "c".repeat(64));
    const a = apiTela();
    render(<OmniConector api={a} />);
    const input = await screen.findByLabelText("Escolher notas");
    const arq = new File([nfce()], "35261012345678000199650010000045211123456785-nfe.xml", { type: "text/xml" });
    fireEvent.change(input, { target: { files: [arq] } });
    expect(await screen.findByText(/^Nota 4521 · 2 itens · R\$\s58,80$/)).toBeTruthy();
    expect(a.enviar).toHaveBeenCalledWith("c".repeat(64), expect.objectContaining({ chave: CH, numero: 4521 }));
  });
  it("caixa desligado pelo dono volta para o código com aviso", async () => {
    localStorage.setItem("omni.conector.chave", "c".repeat(64));
    render(<OmniConector api={apiTela({ estado: vi.fn(async () => null) })} />);
    expect(await screen.findByText(/Este caixa foi desligado pelo dono/)).toBeTruthy();
    expect(localStorage.getItem("omni.conector.chave")).toBeNull();
  });
});

describe("ler a pasta das notas", () => {
  type No = { kind: "file"; arquivo: File } | { kind: "directory"; filhos: Record<string, No> };
  const arquivo = (nome: string, quando: number, texto = "<x/>"): No => ({ kind: "file", arquivo: Object.assign(new File([texto], nome, { lastModified: quando }), { text: async () => texto }) });
  const pasta = (filhos: Record<string, No>): FileSystemDirectoryHandle => ({
    kind: "directory", name: "Notas",
    async *entries() {
      for (const [nome, n] of Object.entries(filhos)) {
        yield [nome, n.kind === "directory" ? pasta(n.filhos) : { kind: "file", getFile: async () => n.arquivo }];
      }
    },
  }) as unknown as FileSystemDirectoryHandle;
  it("acha os .xml novos, também nas subpastas, do mais antigo para o mais novo, sem repetir", async () => {
    const { arquivosNovos, idArquivo } = await import("@/lib/conector");
    const raiz = pasta({
      "velha.xml": arquivo("velha.xml", 1_000),
      "leia-me.txt": arquivo("leia-me.txt", 9_000),
      "2026-10": { kind: "directory", filhos: { "b.xml": arquivo("b.xml", 8_000), "a.XML": arquivo("a.XML", 7_000) } },
      "c.xml": arquivo("c.xml", 9_500),
    });
    const lista = await arquivosNovos(raiz, 5_000, { [idArquivo("c.xml", 4, 9_500)]: 1 });
    expect(lista.map((a) => a.nome)).toEqual(["2026-10/a.XML", "2026-10/b.xml"]);
    expect(await lista[0]!.ler()).toBe("<x/>");
  });
});
