import { createFileRoute } from "@tanstack/react-router";
import { StoreSpace } from "@/components/StoreSpace";
const base = (id: number, nome: string, extra: object = {}) => ({ id, codigo: "789" + id, nome, compra: 1000, venda: 1500, unidade: "Pacote", categoria: "Mercearia", detalhes: {}, variacoes: [], fornecedor: 1, validade: { controla: false, avisos: [], dep: {}, ven: {} }, deposito: { local: "A", qtd: 40, min: 10, max: null }, areaVenda: { local: "G", qtd: 12, min: 5, max: null }, ...extra });
const f = async () => undefined as never;
function B() {
  const vazio = typeof window !== "undefined" && location.search.includes("vazio");
  const ps = vazio ? [] : [base(1, "Arroz Tio João 5 kg"), base(2, "Feijão Carioca Camil 1 kg", { areaVenda: { local: "G", qtd: 3, min: 5, max: null } }), base(3, "Nescau lata 350 g", { deposito: { local: "A", qtd: 0, min: 10, max: null }, areaVenda: { local: "G", qtd: 0, min: 5, max: null } })];
  const p = { store: { id: "c1", tipo: "mercado", nome: "Mercado Teste", cidade: "Jacarezinho", uf: "PR", rua: "r", numero: "1", bairro: "b" }, products: ps, suppliers: [{ id: 1, nome: "Distribuidora Sol", tel: "", email: "" }], saved: false, locais: [], onSalvarPedido: f, onPedidoEnviado: f, onCancelarPedido: f, onNovoLinkPedido: f, onPagamentoPedido: f, onAddSupplier: f, onUpdateSupplier: f, onBack: () => {}, onNew: () => {}, onEdit: () => {}, onDismissSaved: () => {}, diferencasDecidir: 1 };
  return <div className="min-h-screen bg-background p-4 text-foreground"><StoreSpace {...(p as unknown as Parameters<typeof StoreSpace>[0])} /></div>;
}
export const Route = createFileRoute("/m08-bancada")({ component: B });
