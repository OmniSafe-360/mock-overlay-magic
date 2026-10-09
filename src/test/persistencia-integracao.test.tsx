import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ProductWizard, type Product } from "@/components/ProductArea";
import { enviarCadastro, montarCadastro, type Rpc, type Sessao } from "@/lib/persistencia";

vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

/* Banco falso com as mesmas garantias de salvar_cadastro: tudo ou nada e id repetido devolve o resultado guardado. */
function bancoFalso() {
  const ops = new Map<string, string>(); let gravacoes = 0; let perderResposta = false;
  const rpc: Rpc = async (pedido: any) => {
    const hash = JSON.stringify({ ...pedido, operacao_id: undefined });
    if (ops.has(pedido.operacao_id)) {
      if (ops.get(pedido.operacao_id) !== hash) return { error: { message: "operacao_reutilizada_com_conteudo_diferente" } };
    } else {
      if (pedido.pendencias.some((x: any) => x.partes.reduce((a: number, p: any) => a + p.quantidade, 0) !== 10)) return { error: { message: "soma_das_partes_diferente_da_pendencia" } };
      if (pedido.produto_pedido.produto.nome === "") return { error: { message: "nome vazio" } };
      ops.set(pedido.operacao_id, hash); gravacoes++;
    }
    if (perderResposta) { perderResposta = false; throw new TypeError("Failed to fetch"); }
    return { error: null };
  };
  return { rpc, ops, get gravacoes() { return gravacoes; }, perder() { perderResposta = true; } };
}
let n = 0; const novoId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const prod = (extra: Partial<Product> = {}): Product => ({
  id: 1, codigo: "789", nome: "Arroz", compra: 1000, venda: 1500, unidade: "Caixa", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: null,
  deposito: { local: null, qtd: 20, min: null, max: null },
  validade: { controla: true, avisos: [], dep: { _: [{ id: "s1", qtd: 10, data: null, lote: null }, { id: "s2", qtd: 10, data: null, lote: "L9" }] }, ven: {} },
  db: { id: "p1", contadas: ["deposito:_"] }, ...extra,
});
const editado = (p2: number, extra: Partial<Product> = {}) => {
  const antes = prod();
  const depois = prod({ nome: "Arroz novo", validade: { ...antes.validade!, dep: { _: [
    { id: "s1", qtd: 4, data: "2027-01-01", lote: null }, { id: "x", qtd: 6, data: null, lote: null, origem: "s1" },
    { id: "s2", qtd: p2, data: "2027-02-02", lote: "L9" }] } }, ...extra });
  return { antes, depois };
};

describe("salvar edição com pendências", () => {
  it("tudo vai num único pedido; falha numa pendência não grava nenhuma parte", async () => {
    const b = bancoFalso(); const s: Sessao = { dbId: "p1", incerto: null };
    const { antes, depois } = editado(7);
    const rpc = vi.fn(b.rpc);
    await expect(enviarCadastro(s, () => montarCadastro(depois, antes, "c1", false, [], novoId), rpc)).rejects.toMatchObject({ message: "soma_das_partes_diferente_da_pendencia" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect((rpc.mock.calls[0]![0] as any).pendencias).toHaveLength(2);
    expect(b.gravacoes).toBe(0);
    expect(s.incerto).toBeNull();
  });
  it("repetição após perda da resposta reenvia o mesmo pedido e não duplica; formulário alterado não é enviado antes", async () => {
    const b = bancoFalso(); const s: Sessao = { dbId: "p1", incerto: null };
    const { antes, depois } = editado(10, { confirmarVencimento: true });
    const rpc = vi.fn(b.rpc);
    b.perder();
    await expect(enviarCadastro(s, () => montarCadastro(depois, antes, "c1", false, [], novoId), rpc)).rejects.toThrow("Failed to fetch");
    expect(s.incerto).not.toBeNull();
    const montar2 = vi.fn(() => montarCadastro({ ...depois, nome: "Outro nome" }, antes, "c1", false, [], novoId));
    await expect(enviarCadastro(s, montar2, rpc)).resolves.toBe("anterior_gravado");
    expect(rpc.mock.calls[1]![0]).toBe(rpc.mock.calls[0]![0]);
    expect(montar2).not.toHaveBeenCalled();
    expect(b.gravacoes).toBe(1);
  });
  it("correção após recusa usa operação nova e salva", async () => {
    const b = bancoFalso(); const s: Sessao = { dbId: "p1", incerto: null };
    const rpc = vi.fn(b.rpc);
    const { antes, depois } = editado(7);
    await expect(enviarCadastro(s, () => montarCadastro(depois, antes, "c1", false, [], novoId), rpc)).rejects.toBeTruthy();
    const ok = editado(10, { confirmarVencimento: true });
    await expect(enviarCadastro(s, () => montarCadastro(ok.depois, ok.antes, "c1", false, [], novoId), rpc)).resolves.toBe("gravado");
    expect((rpc.mock.calls[1]![0] as any).operacao_id).not.toBe((rpc.mock.calls[0]![0] as any).operacao_id);
    expect(b.gravacoes).toBe(1);
  });
  it("confirmação de vencimento não é inventada", () => {
    const { antes, depois } = editado(10);
    const sem = montarCadastro(depois, antes, "c1", false, [], novoId);
    expect(sem.pendencias.every((x) => !("confirmar_vencimento" in x))).toBe(true);
    const com = montarCadastro({ ...depois, confirmarVencimento: true }, antes, "c1", false, [], novoId);
    expect(com.pendencias.find((x) => x.origem_id === "s2")).toMatchObject({ confirmar_vencimento: true });
    expect(com.pendencias.find((x) => x.origem_id === "s1")).not.toHaveProperty("confirmar_vencimento");
  });
});

const base = (extra: Partial<Product> = {}): Product => ({
  id: 1, codigo: "789", nome: "Item", compra: 1000, venda: 1500, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: null, ...extra,
});
const submit = () => fireEvent.submit(document.querySelector("form")!);

describe("tela", () => {
  it("fornecedor lento não é selecionado antes de gravar; erro não vira vínculo", async () => {
    let rejeitar!: (e: Error) => void;
    const onAddSupplier = vi.fn(() => new Promise<number>((_, rej) => { rejeitar = rej; }));
    const onSave = vi.fn();
    render(<ProductWizard store={{ id: "s", nome: "Loja", tipo: "mercado" } as never} products={[]} initial={base({ fornecedor: null })} suppliers={[]}
      onAddSupplier={onAddSupplier} onCancel={() => {}} onSave={onSave} />);
    for (let i = 0; i < 3; i++) submit();
    fireEvent.click(screen.getByRole("button", { name: /Novo fornecedor/ }));
    fireEvent.change(screen.getByPlaceholderText("Ex.: Distribuidora Sol"), { target: { value: "Sol" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar fornecedor" }));
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeTruthy();
    await act(async () => { rejeitar(new Error("Não foi possível guardar o fornecedor.")); });
    expect(screen.getByRole("alert").textContent).toMatch(/Não foi possível guardar o fornecedor/);
    expect(screen.getByPlaceholderText("Ex.: Distribuidora Sol")).toBeTruthy(); // continua aberto e preenchido
  });
  it("fornecedor confirmado é selecionado só depois da gravação", async () => {
    let resolver!: (id: number) => void;
    const onAddSupplier = vi.fn(() => new Promise<number>((res) => { resolver = res; }));
    const { rerender } = render(<ProductWizard store={{ id: "s", nome: "Loja", tipo: "mercado" } as never} products={[]} initial={base()} suppliers={[]}
      onAddSupplier={onAddSupplier} onCancel={() => {}} onSave={() => {}} />);
    for (let i = 0; i < 3; i++) submit();
    fireEvent.click(screen.getByRole("button", { name: /Novo fornecedor/ }));
    fireEvent.change(screen.getByPlaceholderText("Ex.: Distribuidora Sol"), { target: { value: "Sol" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar fornecedor" }));
    expect(screen.queryByPlaceholderText("Ex.: Distribuidora Sol")).toBeTruthy();
    rerender(<ProductWizard store={{ id: "s", nome: "Loja", tipo: "mercado" } as never} products={[]} initial={base()} suppliers={[{ id: 55, nome: "Sol", tel: "", email: "" }]}
      onAddSupplier={onAddSupplier} onCancel={() => {}} onSave={() => {}} />);
    await act(async () => { resolver(55); });
    expect(screen.queryByPlaceholderText("Ex.: Distribuidora Sol")).toBeNull();
  });
  it("local cadastrado sem produto aparece só na área certa", () => {
    render(<ProductWizard store={{ id: "s", nome: "Loja", tipo: "mercado" } as never} products={[]} initial={base()} suppliers={[]}
      locaisCadastrados={{ deposito: ["Corredor Vazio"], venda: ["Gôndola Vazia"] }} onAddSupplier={() => 1} onCancel={() => {}} onSave={() => {}} />);
    for (let i = 0; i < 4; i++) submit();
    expect(screen.getByText("Corredor Vazio")).toBeTruthy();
    expect(screen.queryByText("Gôndola Vazia")).toBeNull();
    fireEvent.click(screen.getByText("Corredor Vazio")); submit();
    fireEvent.change(screen.getByLabelText(/Quanto você contou/), { target: { value: "1" } }); submit(); submit();
    expect(screen.getByText("Gôndola Vazia")).toBeTruthy();
    expect(screen.queryByText("Corredor Vazio")).toBeNull();
  });
});
