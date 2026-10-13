import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerApp } from "@/components/OwnerHome";
import type { Product } from "@/components/ProductArea";
import type { StoreData } from "@/components/StoreSetup";
import type { Pedido } from "@/lib/pedido";
import { hojeEm } from "@/lib/validade";

const banco = vi.hoisted(() => ({
  carregarFornecedores: vi.fn(), carregarProdutos: vi.fn(), carregarPedidos: vi.fn(), conferirEnvio: vi.fn(),
  carregarVendas: vi.fn(), carregarPendentesVenda: vi.fn(), carregarDiferencas: vi.fn(),
  carregarLimiteFaltas: vi.fn(), carregarContagensAntifurto: vi.fn(), carregarCaixas: vi.fn(), carregarFuncionarios: vi.fn(),
}));
vi.mock("@/lib/banco", async (original) => ({ ...await original<object>(), ...banco }));
vi.mock("@/components/Scanner", () => ({ Scanner: () => null }));

const produto = (id: string, nome: string, dep: number, ven: number): Product => ({
  id, db: { id, contadas: ["deposito:_", "venda:_"] }, nome, codigo: `789${id}`,
  unidade: "Unidade", categoria: "Mercearia", compra: 1000, venda: 1500, fornecedor: null, detalhes: {}, variacoes: [],
  deposito: { local: "A", qtd: dep, min: 5, max: 40 },
  areaVenda: { local: "G", qtd: ven, min: 3, max: 12 },
}) as Product;
const repor = produto("p1", "Feijão", 20, 2);
const comprar = produto("p2", "Açúcar", 2, 10);
const acabou = produto("p3", "Café", 0, 0);
const emDia = produto("p4", "Arroz", 20, 10);
const vencimentoProximo = () => {
  const data = new Date(`${hojeEm()}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + 10);
  return { ...produto("p5", "Leite", 20, 10), validade: {
    controla: true, avisos: [30], dep: {}, ven: { _: [{ id: "l1", qtd: 10, data: data.toISOString().slice(0, 10), lote: "A1" }] },
  } } as Product;
};
const a: StoreData = { id: "c1", tipo: "mercado", nome: "Mercado Alfa", cidade: "Bauru", uf: "SP", rua: "R", numero: "1", bairro: "C" };
const b: StoreData = { ...a, id: "c2", nome: "Farmácia Beta", tipo: "farmacia" };
const produtos = (id: string): Product[] => id === "c1" ? [repor, comprar, acabou, vencimentoProximo()] : [emDia];
const abrirAssunto = async (nome: RegExp) => {
  const resumo = within(await screen.findByRole("region", { name: "Resumo geral" }));
  const botao = resumo.getByRole("button", { name: nome });
  await waitFor(() => expect(botao.textContent).not.toMatch(/^…|^—/));
  fireEvent.click(botao);
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  banco.carregarFornecedores.mockResolvedValue([]);
  banco.carregarProdutos.mockImplementation(async (id: string) => ({ produtos: produtos(id), locais: { deposito: [], venda: [] } }));
  banco.carregarPedidos.mockResolvedValue([]);
  banco.carregarVendas.mockResolvedValue([]);
  banco.carregarPendentesVenda.mockResolvedValue([]);
  banco.carregarDiferencas.mockResolvedValue({ diferencas: [], perdas: [] });
  banco.carregarLimiteFaltas.mockResolvedValue(20000);
  banco.carregarContagensAntifurto.mockResolvedValue([]);
  banco.carregarCaixas.mockResolvedValue([]);
  banco.carregarFuncionarios.mockResolvedValue([]);
});


describe("C4-C1 — proposta, alerta global com leitura confirmada", () => {
  const ready = async () => await waitFor(() => expect(screen.getByText("2 comércios cadastrados · 2 com dados completos")).toBeTruthy());
  const setup = () => render(<OwnerApp userId="u1" owner="M" initial={[a, b]} />);
  it("o sino não conta urgência antiga depois de falha na unidade", async () => {
    banco.carregarProdutos.mockImplementation(async id => ({ produtos: id === "c2" ? [acabou] : [emDia], locais: { deposito: [], venda: [] } }));
    setup(); await ready(); expect(screen.getByRole("button", { name: "Alertas: 1 para resolver agora" })).toBeTruthy();
    banco.carregarProdutos.mockImplementation(async id => { if(id === "c2")throw Error("offline");return {produtos:[emDia],locais:{deposito:[],venda:[]}}; });
    fireEvent(window, new Event("online"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Alertas; consulta incompleta" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /1 para resolver agora/ })).toBeNull();
  });
  it("lista geral não trata produtos antigos como confirmação e permite repetir", async () => {
    banco.carregarProdutos.mockImplementation(async () => ({ produtos: [repor], locais: { deposito: [], venda: [] } }));
    setup();await ready();fireEvent.click(screen.getAllByRole("button",{name:"Alertas"})[0]!);
    expect(screen.getByRole("region",{name:"Farmácia Beta"})).toBeTruthy();
    banco.carregarProdutos.mockImplementation(async id => {if(id==='c2')throw Error('offline');return{produtos:[repor],locais:{deposito:[],venda:[]}};});
    fireEvent(window,new Event('online'));
    await screen.findByText(/Consulta incompleta: Farmácia Beta/);
    expect(screen.queryByRole('region',{name:'Farmácia Beta'})).toBeNull();
    expect(screen.getByRole('region',{name:'Mercado Alfa'})).toBeTruthy();
    expect(screen.queryByText(/Tudo certo!/)).toBeNull();
    banco.carregarProdutos.mockResolvedValue({produtos:[repor],locais:{deposito:[],venda:[]}});
    fireEvent.click(screen.getByRole('button',{name:'Tentar de novo'}));
    await screen.findByRole('region',{name:'Farmácia Beta'});
  });
  it("Atualizar reutiliza a leitura e bloqueia clique enquanto aguarda",async()=>{
    setup();await ready();let resolve:any;const promessa=new Promise<any>(r=>resolve=r);
    banco.carregarProdutos.mockImplementation(async()=>promessa);
    const button=screen.getByRole('button',{name:'Atualizar painel'});
    fireEvent.click(button);await waitFor(()=>expect(button).toBeDisabled());
    expect(screen.getByRole('button',{name:'Alertas; atualizando'})).toBeTruthy();
    resolve({produtos:[emDia],locais:{deposito:[],venda:[]}});
    await waitFor(()=>expect(button).not.toBeDisabled());
  });
  it("produto confirmado continua visível mesmo sem vendas confirmadas",async()=>{
    banco.carregarProdutos.mockResolvedValue({produtos:[repor],locais:{deposito:[],venda:[]}});
    banco.carregarVendas.mockRejectedValue(Error('offline'));
    setup();await screen.findByRole('alert');fireEvent.click(screen.getAllByRole('button',{name:'Alertas'})[0]!);
    expect(screen.getByRole('region',{name:'Mercado Alfa'})).toBeTruthy();
    expect(screen.getByRole('region',{name:'Farmácia Beta'})).toBeTruthy();
    expect(screen.getByText(/Consulta incompleta:/)).toBeTruthy();
    expect(screen.queryByText(/Tudo certo!/)).toBeNull();
  });
  it("não cria Atualizar para uma conta sem comércios",()=>{
    render(<OwnerApp userId='u1' owner='M' initial={[]}/>);
    expect(screen.queryByRole('button',{name:'Atualizar painel'})).toBeNull();
    expect(screen.getByRole('button',{name:'Ir para Comércios'})).toBeTruthy();
  });
});
