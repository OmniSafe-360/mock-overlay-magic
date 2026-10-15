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



describe("C4-C2 — proposta, valores com leitura atual",()=>{
 const carga={produtos:[emDia],locais:{deposito:[],venda:[]}};
 const venda=()=>({id:'v',caixaId:'cx',total:1000,situacao:'finalizada',emitidaEm:new Date().toISOString(),recebidaEm:new Date().toISOString(),itens:[],pagamentos:[]});
 const falta=(valor=-1000)=>({id:'d',produtoId:'p4',variacaoId:null,area:'deposito',origem:'contagem',esperado:10,contado:9,diferenca:-1,valor,funcionario:null,situacao:'explicada',motivo:'sumiu',observacao:null,tentativas:[],resolvida:false,motivoInformado:null,criadaEm:new Date().toISOString()});
 const setup=()=>{banco.carregarProdutos.mockResolvedValue(carga);banco.carregarVendas.mockImplementation(async()=>[venda()]);banco.carregarDiferencas.mockResolvedValue({diferencas:[falta()],perdas:[]});render(<OwnerApp userId='u1' owner='M' initial={[a,b]}/>);};
 const ready=async()=>await screen.findByText('2 comércios cadastrados · 2 com resumo completo');
 const card=(label:string)=>screen.getByRole('button',{name:new RegExp('^'+label+':')});
 it('não apresenta valores anteriores enquanto aguarda a atualização',async()=>{
  setup();await ready();expect(card('Vendas hoje')).toHaveTextContent(/R\$\s*20,00/);expect(card('Faltou este mês')).toHaveTextContent(/R\$\s*20,00/);
  let resolve:any;const promise=new Promise<any>(r=>resolve=r);banco.carregarProdutos.mockImplementation(async()=>promise);
  fireEvent.click(screen.getByRole('button',{name:'Atualizar painel'}));
  await waitFor(()=>expect(card('Vendas hoje')).toHaveTextContent('Consultando…'));
  for(const label of ['Vendas hoje','Faltou este mês'])expect(card(label)).not.toHaveTextContent(/R\$/);
  expect(card('Faltou este mês')).toHaveTextContent('Consultando…');
  resolve(carga);await ready();expect(card('Vendas hoje')).toHaveTextContent(/R\$\s*20,00/);
 });
 it('relatório usa só a loja confirmada enquanto outra aguarda; retorna sem mudar destino',async()=>{
  setup();await ready();let resolve:any;const promise=new Promise<any>(r=>resolve=r);
  banco.carregarProdutos.mockImplementation(async id=>id==='c2'?promise:carga);
  fireEvent.click(screen.getByRole('button',{name:'Atualizar painel'}));
  await waitFor(()=>expect(card('Faltou este mês')).toHaveTextContent(/R\$\s*10,00/));
  fireEvent.click(card('Faltou este mês'));
  expect(await screen.findByText('Consultando: 1 de 2 comércios confirmados')).toBeTruthy();
  const lista=within(screen.getByRole('list',{name:'Comércios com faltas'}));
  expect(lista.getByRole('button',{name:/Mercado Alfa/})).toBeTruthy();expect(lista.queryByRole('button',{name:/Farmácia Beta/})).toBeNull();
  resolve(carga);await waitFor(()=>expect(lista.getByRole('button',{name:/Farmácia Beta/})).toBeTruthy());
  fireEvent.click(screen.getAllByRole('button',{name:'Início'})[1]!);expect(await screen.findByRole('region',{name:'Resumo geral'})).toBeTruthy();
 });
 it('zero confirmado continua zero; zero antigo não vira confirmação durante leitura',async()=>{
  banco.carregarProdutos.mockResolvedValue(carga);render(<OwnerApp userId='u1' owner='M' initial={[a,b]}/>);await ready();
  expect(card('Vendas hoje')).toHaveTextContent(/R\$\s*0,00/);expect(card('Faltou este mês')).toHaveTextContent(/R\$\s*0,00/);
  let resolve:any;const promise=new Promise<any>(r=>resolve=r);banco.carregarProdutos.mockImplementation(async()=>promise);
  fireEvent.click(screen.getByRole('button',{name:'Atualizar painel'}));await waitFor(()=>expect(card('Vendas hoje')).not.toHaveTextContent(/R\$/));
  expect(card('Faltou este mês')).not.toHaveTextContent(/R\$/);resolve(carga);await ready();expect(card('Faltou este mês')).toHaveTextContent(/R\$\s*0,00/);
 });
 it('falha das diferenças mantém vendas atuais e mostra subtotal no relatório',async()=>{
  setup();await ready();banco.carregarDiferencas.mockImplementation(async id=>{if(id==='c2')throw Error('offline');return{diferencas:[falta()],perdas:[]};});
  fireEvent.click(screen.getByRole('button',{name:'Atualizar painel'}));await screen.findByRole('alert');
  expect(card('Vendas hoje')).toHaveTextContent(/R\$\s*20,00/);expect(card('Faltou este mês')).toHaveTextContent(/R\$\s*10,00/);
  fireEvent.click(card('Faltou este mês'));expect(await screen.findByText('Subtotal de 1 de 2 comércios · consulta incompleta')).toBeTruthy();
  expect(screen.getByText(/Não foi possível atualizar: Farmácia Beta/)).toBeTruthy();
 });
 it('falha de todas as leituras não mostra zero falso e permite recuperar',async()=>{
  setup();await ready();banco.carregarProdutos.mockRejectedValue(Error('offline'));
  fireEvent.click(screen.getByRole('button',{name:'Atualizar painel'}));await screen.findByRole('alert');
  for(const label of ['Vendas hoje','Faltou este mês']){expect(card(label)).toHaveTextContent('—');expect(card(label)).not.toHaveTextContent(/R\$/);}
  banco.carregarProdutos.mockResolvedValue(carga);fireEvent.click(screen.getByRole('button',{name:'Atualizar painel'}));await ready();expect(card('Vendas hoje')).toHaveTextContent(/R\$\s*20,00/);
 });
});
