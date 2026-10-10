import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Product, Supplier } from "@/components/ProductArea";
import { ReceberMercadoria, type ApiReceber } from "@/components/ReceberMercadoria";
import { PainelPedidos } from "@/components/PainelPedidos";
import { AtencaoHoje } from "@/components/AtencaoHoje";
import type { RecebimentoAberto, RespostaRecebimento } from "@/lib/banco";
import type { Pedido } from "@/lib/pedido";
import { escopoAcesso } from "@/lib/operacaoLocal";
import {
  chaveRascunho, erroContagem, itemParaEnvio, novaContagem, resultadoItem, resumoContagem, resumoRecebimento, totalDaContagem, type ItemRecebido, type ProdutoFunc, type Recebimento,
} from "@/lib/recebimento";

vi.mock("@/components/Scanner", () => ({
  Scanner: ({ onCode }: { onCode: (c: string) => void }) => <button type="button" onClick={() => onCode("7891000432687")}>leitor falso</button>,
}));

const arroz: ProdutoFunc = { produtoId: "p-arroz", variacaoId: null, embalagemId: null, nome: "Arroz 5 kg", unidade: "Unidade", codigo: "7893464100065", variacao: null,
  controlaValidade: false, pedeLote: false, embalagens: [{ id: "e-cx", tipo: "Caixa", quantidade: 10 }] };
const tiss: ProdutoFunc = { ...arroz, produtoId: "p-tiss", nome: "Refrigerante Tiss", codigo: "7896263503203", embalagens: [] };
const cerveja: ProdutoFunc = { ...arroz, produtoId: "p-cerv", nome: "Cerveja", codigo: "7891000432687", embalagens: [] };
const dipirona: ProdutoFunc = { ...arroz, produtoId: "p-dip", nome: "Dipirona", unidade: "Frasco", embalagens: [], controlaValidade: true, pedeLote: true };

describe("regras da contagem", () => {
  it("recusa vencidos como bons e datas inexistentes; aceita vencimento hoje e avaria", () => {
    const c = { ...novaContagem(dipirona), soltas: "2", partes: [{ quantidade: "", vencimento: "2026-10-09", lote: "A" }] };
    expect(erroContagem(c, "2026-10-10")).toMatch(/vencida deve ser informada/);
    expect(erroContagem({ ...c, partes: [{ ...c.partes[0]!, vencimento: "2026-10-10" }] }, "2026-10-10")).toBe("");
    expect(erroContagem({ ...c, partes: [{ ...c.partes[0]!, vencimento: "2027-02-29" }] }, "2026-10-10")).toMatch(/data de validade válida/);
    expect(erroContagem({ ...c, temAvaria: true, avaria: "2" }, "2026-10-10")).toBe("");
    expect(itemParaEnvio({ ...c, temAvaria: true, avaria: "2" })).toMatchObject({ total: 2, avaria: 2, partes: [] });
  });
  it("total: caixas fechadas + soltas", () => {
    const c = { ...novaContagem(arroz), fechadas: { "e-cx": "2" }, soltas: "3" };
    expect(totalDaContagem(c).total).toBe(23);
    expect(resumoContagem(c)).toBe("2 caixas + 3 = 23 unidades");
    expect(totalDaContagem({ ...c, naoVeio: true }).total).toBe(0);
    expect(resumoContagem({ ...c, naoVeio: true })).toBe("Não veio");
  });
  it("erros: vazio, avaria maior, validade e lote", () => {
    expect(erroContagem(novaContagem(arroz))).toMatch(/Conte quanto chegou/);
    expect(erroContagem({ ...novaContagem(tiss), soltas: "5", temAvaria: true, avaria: "6" })).toMatch(/não podem ser mais/);
    const d = { ...novaContagem(dipirona), soltas: "10" };
    expect(erroContagem(d)).toMatch(/data de validade/);
    expect(erroContagem({ ...d, partes: [{ quantidade: "", vencimento: "2027-05-01", lote: "" }] })).toMatch(/lote/);
    expect(erroContagem({ ...d, partes: [{ quantidade: "", vencimento: "2027-05-01", lote: "AB1" }] })).toBe("");
    const duas = { ...d, partes: [{ quantidade: "6", vencimento: "2027-05-01", lote: "A" }, { quantidade: "3", vencimento: "2027-08-01", lote: "B" }] };
    expect(erroContagem(duas)).toMatch(/somam 9, mas chegaram 10/);
    expect(erroContagem({ ...duas, temAvaria: true, avaria: "1" })).toBe("");
    expect(itemParaEnvio({ ...duas, temAvaria: true, avaria: "1" })).toEqual({ produto_id: "p-dip", variacao_id: null, total: 10, avaria: 1,
      partes: [{ quantidade: 6, vencimento: "2027-05-01", lote: "A" }, { quantidade: 3, vencimento: "2027-08-01", lote: "B" }] });
    expect(itemParaEnvio({ ...d, partes: [{ quantidade: "", vencimento: "2027-05-01", lote: "AB1" }] }).partes).toEqual([{ quantidade: 10, vencimento: "2027-05-01", lote: "AB1" }]);
  });
});

const item = (x: Partial<ItemRecebido>): ItemRecebido => ({ id: "i1", produtoId: "p-arroz", variacaoId: null, noPedido: true, esperado: 20, situacao: "aceito",
  quantidadeAceita: 20, avaria: 0, entrouEstoque: 20, tentativas: [{ total: 20, avaria: 0, partes: [] }], ...x });
describe("resultado para o dono", () => {
  it("textos de cada caso", () => {
    expect(resultadoItem(item({}), "Unidade").texto).toBe("Chegou tudo (20 unidades)");
    expect(resultadoItem(item({ quantidadeAceita: 18 }), "Unidade")).toEqual({ tipo: "falta", texto: "Chegaram 18 de 20 unidades · faltaram 2" });
    expect(resultadoItem(item({ quantidadeAceita: 22 }), "Unidade").tipo).toBe("sobra");
    expect(resultadoItem(item({ quantidadeAceita: 0 }), "Unidade").texto).toBe("Não veio (eram 20 unidades)");
    expect(resultadoItem(item({ situacao: "inconsistente", quantidadeAceita: null, tentativas: [1, 2, 4].map((t) => ({ total: t, avaria: 0, partes: [] })) }), "Unidade").texto)
      .toBe("A contagem não fechou (1, 2 e 4). Escolha a certa.");
    expect(resultadoItem(item({ situacao: "fora_do_pedido", esperado: null, quantidadeAceita: 12 }), "Unidade").tipo).toBe("fora");
  });
  it("resumo do cartão", () => {
    const r: Recebimento = { id: "r", pedidoId: "ped", fornecedorId: null, funcionario: "Maria Souza", concluidoEm: "2026-10-09T15:00:00Z", situacao: "concluido", itens: [item({})] };
    expect(resumoRecebimento(r)).toEqual({ texto: "Recebido por Maria em 09/10 · tudo certo", alerta: null });
    expect(resumoRecebimento({ ...r, itens: [item({ quantidadeAceita: 18 })] }).alerta).toBe("diferenca");
    expect(resumoRecebimento({ ...r, itens: [item({ situacao: "inconsistente" })] }).texto).toMatch(/1 produto para você decidir/);
  });
});

/* ---------- tela do funcionário ---------- */
const aberto: RecebimentoAberto = { id: "rec-1", rodada: 0, situacao: "contando", pedidoId: "ped-1", numero: 14, fornecedor: "Distribuidora Sol", produtos: [arroz, tiss], itens: [] };
function apiReceber(over: Partial<ApiReceber> = {}) {
  const respostas: RespostaRecebimento[] = [
    { situacao: "recontar", rodada: 1, recontar: [{ produtoId: "p-arroz", variacaoId: null }], faltam: [{ produtoId: "p-tiss", variacaoId: null }] },
    { situacao: "concluido", rodada: 2, produtos: 3, avisos: true },
  ];
  return {
    entregas: vi.fn(async () => ({ pedidos: [{ id: "ped-1", numero: 14, fornecedor: "Distribuidora Sol", previsaoEntrega: null, produtos: 2, emContagem: false }], fornecedores: [{ id: "f1", nome: "Distribuidora Sol" }] })),
    abrir: vi.fn(async () => aberto),
    buscar: vi.fn(async () => [cerveja]),
    enviar: vi.fn(async () => respostas.shift()!),
    ...over,
  };
}
const linha = (nome: RegExp) => screen.getByRole("button", { name: nome });
const contar = (valores: Record<string, string>) => {
  const dlg = within(screen.getByRole("dialog"));
  for (const [rotulo, v] of Object.entries(valores)) fireEvent.change(dlg.getByLabelText(rotulo), { target: { value: v } });
  fireEvent.click(dlg.getByRole("button", { name: /Salvar contagem/ }));
};

describe("Receber mercadoria (funcionário)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  it("recupera o envio exato após fechar e não reaproveita a contagem na rodada seguinte", async () => {
    const api = apiReceber({
      abrir: vi.fn().mockResolvedValueOnce(aberto).mockResolvedValue({ ...aberto, rodada: 1, itens: [{ produtoId: "p-arroz", variacaoId: null, situacao: "recontar" }] }),
      enviar: vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue({ situacao: "recontar", rodada: 1, recontar: [{ produtoId: "p-arroz", variacaoId: null }], faltam: [{ produtoId: "p-tiss", variacaoId: null }] }),
    });
    const tela = render(<ReceberMercadoria chave={"c".repeat(64)} api={api} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Arroz 5 kg: falta contar/ }));
    contar({ "Sem embalagem (unidades)": "18" });
    fireEvent.click(screen.getByRole("button", { name: /Terminei/ }));
    await screen.findByRole("alert");
    fireEvent.click(linha(/Arroz 5 kg: contado/));
    contar({ "Sem embalagem (unidades)": "20" });
    tela.unmount();
    render(<ReceberMercadoria chave={"c".repeat(64)} api={api} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
    await screen.findByText(/Contagem enviada sem confirmação/);
    fireEvent.click(screen.getByRole("button", { name: /Terminei/ }));
    await screen.findByText(/Conte de novo 1 produto/);
    expect(vi.mocked(api.enviar).mock.calls[1]).toEqual(vi.mocked(api.enviar).mock.calls[0]);
    expect(vi.mocked(api.enviar).mock.calls[1]![3][0]).toMatchObject({ total: 18 });
    fireEvent.click(linha(/Arroz 5 kg: conte de novo/));
    expect(within(screen.getByRole("dialog")).getByLabelText("Sem embalagem (unidades)")).toHaveValue("");
  });
  it("conta às cegas, reconta o que não bateu, marca o que não veio e conclui", async () => {
    const api = apiReceber();
    const voltar = vi.fn();
    render(<ReceberMercadoria chave={"c".repeat(64)} api={api} onVoltar={voltar} />);
    fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
    expect(await screen.findByText("Pedido nº 14 · bipe cada produto e conte o que chegou.")).toBeTruthy();
    expect(api.abrir).toHaveBeenCalledWith("c".repeat(64), expect.any(String), "ped-1", null);
    expect((screen.getByRole("button", { name: /Terminei/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(linha(/Arroz 5 kg: falta contar/));
    contar({ "Caixas com 10": "1", "Sem embalagem (unidades)": "8" });
    expect(screen.getByText("1 caixa + 8 = 18 unidades")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Terminei/ }));
    await waitFor(() => expect(api.enviar).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.enviar).mock.calls[0]!.slice(2)).toEqual([0, [{ produto_id: "p-arroz", variacao_id: null, total: 18, avaria: 0, partes: [] }]]);
    expect(await screen.findByText(/Conte de novo 1 produto/)).toBeTruthy();
    expect(screen.getByText(/Ainda falta contar: Refrigerante Tiss/)).toBeTruthy();
    expect(screen.queryByText("1 caixa + 8 = 18 unidades")).toBeNull();
    expect((screen.getByRole("button", { name: /Terminei/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(linha(/Arroz 5 kg: conte de novo/));
    expect(screen.getByText(/Conte de novo, com calma/)).toBeTruthy();
    expect((within(screen.getByRole("dialog")).getByLabelText("Caixas com 10") as HTMLInputElement).value).toBe("");
    contar({ "Caixas com 10": "1", "Sem embalagem (unidades)": "8" });
    fireEvent.click(linha(/Refrigerante Tiss: falta contar/));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Não veio/ }));
    fireEvent.click(screen.getByRole("button", { name: /Terminei/ }));
    await waitFor(() => expect(api.enviar).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.enviar).mock.calls[1]![2]).toBe(1);
    expect(vi.mocked(api.enviar).mock.calls[1]![3]).toEqual([
      { produto_id: "p-arroz", variacao_id: null, total: 18, avaria: 0, partes: [] },
      { produto_id: "p-tiss", variacao_id: null, total: 0, avaria: 0, partes: [] },
    ]);
    expect(await screen.findByText("Pronto!")).toBeTruthy();
    expect(screen.getByText(/diferenças foram avisadas ao dono/)).toBeTruthy();
    expect(localStorage.getItem(chaveRascunho("ped-1", await escopoAcesso("c".repeat(64))))).toBeNull();
  });
  it("bipar produto fora do pedido avisa para separar; quebrados não passam do total", async () => {
    render(<ReceberMercadoria chave={"c".repeat(64)} api={apiReceber()} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Bipar produto/ }));
    fireEvent.click(screen.getByRole("button", { name: "leitor falso" }));
    const dlg = within(await screen.findByRole("dialog", { name: "Cerveja" }));
    expect(dlg.getByText(/não está no pedido/)).toBeTruthy();
    expect(dlg.queryByRole("button", { name: /Não veio/ })).toBeNull();
    fireEvent.change(dlg.getByLabelText("Quantidade (unidades)"), { target: { value: "12" } });
    fireEvent.click(dlg.getByLabelText("Veio quebrado ou vencido"));
    fireEvent.change(dlg.getByLabelText("Quantos (unidades)"), { target: { value: "13" } });
    expect(dlg.getByRole("alert").textContent).toMatch(/não podem ser mais/);
    expect((dlg.getByRole("button", { name: /Salvar contagem/ }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("farmácia: pede validade e lote", async () => {
    const api = apiReceber({ abrir: vi.fn(async () => ({ ...aberto, produtos: [dipirona] })) });
    render(<ReceberMercadoria chave={"c".repeat(64)} api={api} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Dipirona: falta contar/ }));
    const dlg = within(screen.getByRole("dialog"));
    fireEvent.change(dlg.getByLabelText("Quantidade (frascos)"), { target: { value: "10" } });
    expect(dlg.getByRole("alert").textContent).toMatch(/data de validade/);
    fireEvent.change(dlg.getByLabelText("Validade 1"), { target: { value: "2027-05-01" } });
    expect(dlg.getByRole("alert").textContent).toMatch(/lote/);
    fireEvent.change(dlg.getByLabelText("Lote 1"), { target: { value: "AB1" } });
    expect((dlg.getByRole("button", { name: /Salvar contagem/ }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("a contagem fica guardada no celular se o app fechar", async () => {
    const api = apiReceber();
    const { unmount } = render(<ReceberMercadoria chave={"c".repeat(64)} api={api} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Refrigerante Tiss: falta contar/ }));
    contar({ "Quantidade (unidades)": "12" });
    unmount();
    render(<ReceberMercadoria chave={"c".repeat(64)} api={api} onVoltar={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Distribuidora Sol/ }));
    expect(await screen.findByText("12 unidades")).toBeTruthy();
    expect(vi.mocked(api.abrir).mock.calls[1]![1]).toBe("rec-1");
  });
});

/* ---------- dono ---------- */
const sol: Supplier = { id: 1, nome: "Distribuidora Sol", tel: "", email: "", dbId: "f-sol" };
const prod = (id: string, nome: string): Product => ({ id: Number(id.length), codigo: id, nome, compra: 100, venda: 200, unidade: "Unidade", categoria: "", detalhes: {}, variacoes: [], fornecedor: 1, db: { id, contadas: [] } });
const pedido: Pedido = {
  id: "ped-1", numero: 14, fornecedorId: "f-sol", situacao: "recebido_parcial", canal: "whatsapp", enviadoEm: "2026-10-08T12:00:00Z", observacao: "", token: "t".repeat(64), criadoEm: "2026-10-08T11:00:00Z",
  itens: [{ produtoId: "p-arroz", variacaoId: null, embalagemId: null, qtdEmbalagens: 20, qtdUnidades: 20, precoEstimado: 100, qtdConfirmada: null, qtdRecebida: 18 },
    { produtoId: "p-tiss", variacaoId: null, embalagemId: null, qtdEmbalagens: 6, qtdUnidades: 6, precoEstimado: 100, qtdConfirmada: null, qtdRecebida: null }],
  recebimento: { id: "rec-1", pedidoId: "ped-1", fornecedorId: "f-sol", funcionario: "Maria Souza", concluidoEm: "2026-10-09T15:00:00Z", situacao: "concluido", itens: [
    item({ id: "i-arroz", quantidadeAceita: 18, avaria: 2, entrouEstoque: 16 }),
    item({ id: "i-tiss", produtoId: "p-tiss", esperado: 6, situacao: "inconsistente", quantidadeAceita: null, entrouEstoque: 0, tentativas: [1, 2, 4].map((t) => ({ total: t, avaria: 0, partes: [] })) }),
    item({ id: "i-cerv", produtoId: "p-cerv", noPedido: false, esperado: null, situacao: "fora_do_pedido", quantidadeAceita: 12, entrouEstoque: 0 }),
  ] },
};
describe("recebimento no app do dono", () => {
  it("cartão, detalhe e decisões", async () => {
    const onResolver = vi.fn(async () => {});
    render(<PainelPedidos products={[prod("p-arroz", "Arroz 5 kg"), prod("p-tiss", "Refrigerante Tiss"), prod("p-cerv", "Cerveja")]} store={{ id: "c1", tipo: "mercado", nome: "Mercado", cidade: "", uf: "", rua: "", numero: "", bairro: "" }}
      suppliers={[sol]} pedidos={[pedido]} onSalvar={vi.fn()} onEnviado={vi.fn()} onCancelar={vi.fn()} onNovoLink={vi.fn()} onPagamento={vi.fn()} onOpenProduto={vi.fn()}
      onResolverRecebimento={onResolver} />);
    const card = screen.getByRole("button", { name: /Pedido nº 14/ });
    expect(card.textContent).toMatch(/Recebido por Maria em 09\/10 · 2 produtos para você decidir/);
    fireEvent.click(card);
    const sec = within(screen.getByRole("region", { name: "Recebimento" }));
    expect(sec.getByText("Chegaram 18 de 20 unidades · faltaram 2")).toBeTruthy();
    expect(sec.getByText(/2 unidades quebrado\(s\) ou vencido\(s\)/)).toBeTruthy();
    expect(sec.getByText("A contagem não fechou (1, 2 e 4). Escolha a certa.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Cancelar pedido/ })).toBeNull();
    fireEvent.click(sec.getByRole("button", { name: "2 unidades" }));
    fireEvent.click(sec.getByRole("button", { name: /Confirmar 2 unidades/ }));
    await waitFor(() => expect(onResolver).toHaveBeenCalledWith("i-tiss", "aceitar", 1));
    fireEvent.click(sec.getByRole("button", { name: /Devolver/ }));
    await waitFor(() => expect(onResolver).toHaveBeenCalledWith("i-cerv", "recusar", null));
  });
  it("Atenção hoje mostra entregas para decidir", () => {
    const onVer = vi.fn();
    render(<AtencaoHoje products={[]} tipo="mercado" suppliers={[]} onOpen={() => {}} entregasDecidir={2} onVerEntregas={onVer} />);
    fireEvent.click(screen.getByRole("button", { name: /Entregas para decidir/ }));
    expect(onVer).toHaveBeenCalled();
  });
});
