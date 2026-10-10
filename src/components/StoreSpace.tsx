import { useHoje } from "@/hooks/useHoje";
import { useMemo, useState } from "react";
import { ArrowLeft, Store } from "lucide-react";
import { nomeAreaVenda, textoDoTipo } from "@/lib/exemplos";
import { TIPOS, type StoreData } from "@/components/StoreSetup";
import { ProductDetail, SavedBanner, type Product, type Supplier } from "@/components/ProductArea";
import { ListaProdutos } from "@/components/ListaProdutos";
import { PainelLocais } from "@/components/PainelLocais";
import { AtencaoHoje } from "@/components/AtencaoHoje";
import { PainelFornecedores } from "@/components/PainelFornecedores";
import { PainelEquipe } from "@/components/PainelEquipe";
import { PainelVendas } from "@/components/PainelVendas";
import { PainelDiferencas } from "@/components/PainelDiferencas";
import { PainelPedidos, type DadosPagamento, type SalvarPedido } from "@/components/PainelPedidos";
import { resumoPagamentos } from "@/lib/pagamento";
import type { Recebimento } from "@/lib/recebimento";
import { entregasParaDecidir, produtosJaPedidos } from "@/lib/resumoGeral";
import { hojeEm } from "@/lib/validade";
import type { CanalPedido, Pedido } from "@/lib/pedido";
import type { LocaisCadastrados } from "@/lib/banco";
import type { AlertasAntifurto } from "@/lib/antifurto";

const TABS = ["Produtos", "Depósito", "Gôndolas", "Pedidos", "Fornecedores", "Equipe", "Vendas", "Diferenças"] as const;

/** Por onde o comércio abre quando vem do menu Alertas: um produto (a ficha), ou a aba Pedidos (montar um pedido ou só as contas a pagar). */
export type InicioComercio = { produtoId: Product["id"] } | { pedidos: "montar" | "contas" | "lista" } | { aba: "Vendas" | "Diferenças" } | { relatorio: true };

export function StoreSpace({ store, products, suppliers, saved, locais, pedidos = [], pedidosProntos = true, pedidosCarregados = true, atualizando = false, onAtualizar, onSalvarPedido, onPedidoEnviado, onCancelarPedido, onNovoLinkPedido, onPagamentoPedido, onResolverRecebimento, onCarregarSemPedido, onAddSupplier, onUpdateSupplier, onBack, onNew, onEdit, onDismissSaved, inicio, vendidoSemCadastro = 0, onVendasMudou, diferencasDecidir = 0, onDiferencasMudou, antifurto }: {
  store: StoreData; products: Product[]; suppliers: Supplier[]; saved: boolean; locais?: LocaisCadastrados | undefined;
  pedidos?: Pedido[] | undefined; onSalvarPedido: SalvarPedido; onPedidoEnviado: (id: string, canal: CanalPedido) => Promise<unknown>; onCancelarPedido: (id: string) => Promise<unknown>; onNovoLinkPedido: (id: string) => Promise<string>; onPagamentoPedido: (id: string, d: DadosPagamento) => Promise<unknown>;
  onResolverRecebimento?: ((itemId: string, acao: "aceitar" | "recusar", tentativa: number | null) => Promise<unknown>) | undefined;
  onCarregarSemPedido?: (() => Promise<Recebimento[]>) | undefined;
  pedidosProntos?: boolean; pedidosCarregados?: boolean; atualizando?: boolean; onAtualizar?: () => void;
  onAddSupplier: (f: Omit<Supplier, "id">) => Promise<unknown>; onUpdateSupplier: (s: Supplier, f: Omit<Supplier, "id">) => Promise<unknown>;
  onBack: () => void; onNew: () => void; onEdit: (p: Product) => void; onDismissSaved: () => void;
  inicio?: InicioComercio | undefined;
  /** Códigos vendidos no caixa sem produto (do resumo geral). */ vendidoSemCadastro?: number | undefined;
  /** Um item vendido foi ligado a um produto: o estoque mudou. */ onVendasMudou?: (() => void) | undefined;
  /** Perdas para confirmar + diferenças para explicar (do resumo geral). */ diferencasDecidir?: number | undefined;
  /** Uma perda ou diferença foi resolvida: o estoque e o resumo mudaram. */ onDiferencasMudou?: (() => void) | undefined;
  /** Alertas de antifurto (Fase 5.2). */ antifurto?: AlertasAntifurto | undefined;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>(inicio && "pedidos" in inicio ? "Pedidos" : inicio && "aba" in inicio ? inicio.aba : inicio && "relatorio" in inicio ? "Diferenças" : "Produtos");
  /** Muda a cada toque num alerta de antifurto para abrir a aba Diferenças já no Relatório. */
  const [verRelatorio, setVerRelatorio] = useState(inicio && "relatorio" in inicio ? 1 : 0);
  const [view, setView] = useState<Product | null>(() => (inicio && "produtoId" in inicio ? products.find((p) => p.id === inicio.produtoId) ?? null : null));
  const entregasDecidir = useMemo(() => entregasParaDecidir(pedidos), [pedidos]);
  /** Muda a cada "Fazer pedido" para abrir a aba Pedidos já na montagem. */
  const [montar, setMontar] = useState(inicio && "pedidos" in inicio && inicio.pedidos === "montar" ? 1 : 0);
  /** Muda a cada toque nas contas do "Atenção hoje" para abrir a aba Pedidos em "Só a pagar". */
  const [verPagar, setVerPagar] = useState(inicio && "pedidos" in inicio && inicio.pedidos === "contas" ? 1 : 0);
  const hoje = useHoje();
  const contas = useMemo(() => resumoPagamentos(pedidos, hoje), [pedidos, hoje]);
  const jaPedidos = useMemo(() => produtosJaPedidos(pedidos), [pedidos]);
  const Icon = TIPOS.find((t) => t.id === store.tipo)?.Icon ?? Store;
  const current = view ? products.find((p) => p.id === view.id) ?? null : null;

  if (current)
    return <ProductDetail p={current} tipo={store.tipo} suppliers={suppliers} onBack={() => setView(null)} onEdit={() => onEdit(current)} />;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-300">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Voltar" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/60 text-foreground hover:border-primary"><ArrowLeft size={20} /></button>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon size={24} /></span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{store.nome}</h1>
          <p className="truncate text-sm text-muted-foreground">{store.cidade} - {store.uf}</p>
        </div>
        {onAtualizar && <button type="button" disabled={atualizando} onClick={onAtualizar} className="ml-auto min-h-12 rounded-2xl border border-border px-3 text-sm font-semibold disabled:opacity-50">{atualizando ? "Atualizando…" : "Atualizar"}</button>}
      </div>

      <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none]">
        <div className="flex w-max gap-2">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => { setTab(t); setMontar(0); setVerPagar(0); setVerRelatorio(0); }} aria-current={tab === t ? "page" : undefined}
              className={`min-h-12 rounded-2xl px-4 text-base font-semibold transition ${tab === t ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>{t === "Gôndolas" ? nomeAreaVenda(store.tipo) : textoDoTipo(store.tipo)(t)}</button>
          ))}
        </div>
      </div>

      {tab === "Produtos" ? (
        <>
          {saved && <SavedBanner onAnother={() => { onDismissSaved(); onNew(); }} onList={onDismissSaved} />}
          <AtencaoHoje products={products} tipo={store.tipo} suppliers={suppliers} onOpen={(p) => { onDismissSaved(); setView(p); }}
            jaPedidos={jaPedidos} onFazerPedido={pedidosProntos ? () => { onDismissSaved(); setVerPagar(0); setMontar((n) => n + 1); setTab("Pedidos"); } : undefined}
            contas={pedidosProntos ? contas : undefined} onVerContas={() => { onDismissSaved(); setMontar(0); setVerPagar((n) => n + 1); setTab("Pedidos"); }}
            entregasDecidir={entregasDecidir} onVerEntregas={() => { onDismissSaved(); setMontar(0); setVerPagar(0); setTab("Pedidos"); }}
            semCadastro={vendidoSemCadastro} onVerSemCadastro={() => { onDismissSaved(); setTab("Vendas"); }}
            diferencas={diferencasDecidir} onVerDiferencas={() => { onDismissSaved(); setVerRelatorio(0); setTab("Diferenças"); }}
            antifurto={antifurto} onVerAntifurto={() => { onDismissSaved(); setVerRelatorio((n) => n + 1); setTab("Diferenças"); }} />
          <ListaProdutos products={products} tipo={store.tipo} suppliers={suppliers} onNew={onNew} onOpen={(p) => { onDismissSaved(); setView(p); }} />
        </>
      ) : tab === "Depósito" || tab === "Gôndolas" ? (
        <PainelLocais products={products} tipo={store.tipo} area={tab === "Depósito" ? "dep" : "ven"}
          locaisCadastrados={tab === "Depósito" ? locais?.deposito : locais?.venda} onOpen={(p) => { onDismissSaved(); setView(p); }} />
      ) : tab === "Pedidos" ? (
        <>
          {!pedidosProntos && <p role="status" className="rounded-2xl border border-warning/60 p-4 text-sm">{atualizando ? "Atualizando pedidos…" : "Atualize os dados e confira os envios pendentes para usar os pedidos."}</p>}
          {pedidosCarregados && <div inert={!pedidosProntos} aria-busy={!pedidosProntos}>
            <PainelPedidos key={`${montar}-${verPagar}`} products={products} store={store} suppliers={suppliers} pedidos={pedidos} montarAgora={montar > 0} soAPagar={verPagar > 0}
              onSalvar={onSalvarPedido} onEnviado={onPedidoEnviado} onCancelar={onCancelarPedido} onNovoLink={onNovoLinkPedido} onPagamento={onPagamentoPedido} onResolverRecebimento={onResolverRecebimento} onCarregarSemPedido={onCarregarSemPedido} onOpenProduto={(p) => { onDismissSaved(); setView(p); }} />
          </div>}
        </>
      ) : tab === "Fornecedores" ? (
        <PainelFornecedores products={products} tipo={store.tipo} suppliers={suppliers} onOpen={(p) => { onDismissSaved(); setView(p); }}
          onAdd={onAddSupplier} onUpdate={onUpdateSupplier} />
      ) : tab === "Equipe" && store.id ? (
        <PainelEquipe comercioId={store.id} comercioNome={store.nome} />
      ) : tab === "Vendas" && store.id ? (
        <PainelVendas comercioId={store.id} tipo={store.tipo} products={products} onMudou={onVendasMudou} />
      ) : tab === "Diferenças" && store.id ? (
        <PainelDiferencas key={verRelatorio} comercioId={store.id} tipo={store.tipo} products={products} onMudou={onDiferencasMudou} vistaInicial={verRelatorio > 0 ? "relatorio" : "resolver"} />
      ) : (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <p className="text-xl font-bold">{tab}</p>
          <p className="text-muted-foreground">Em breve</p>
        </div>
      )}
    </div>
  );
}
