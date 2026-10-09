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
import { PainelPedidos, type DadosPagamento, type SalvarPedido } from "@/components/PainelPedidos";
import { resumoPagamentos } from "@/lib/pagamento";
import { hojeEm } from "@/lib/validade";
import { pedidoAberto, type CanalPedido, type Pedido } from "@/lib/pedido";
import type { LocaisCadastrados } from "@/lib/banco";

const TABS = ["Produtos", "Depósito", "Gôndolas", "Pedidos", "Fornecedores", "Equipe", "Vendas"] as const;

export function StoreSpace({ store, products, suppliers, saved, locais, pedidos = [], onSalvarPedido, onPedidoEnviado, onCancelarPedido, onNovoLinkPedido, onPagamentoPedido, onAddSupplier, onUpdateSupplier, onBack, onNew, onEdit, onDismissSaved }: {
  store: StoreData; products: Product[]; suppliers: Supplier[]; saved: boolean; locais?: LocaisCadastrados | undefined;
  pedidos?: Pedido[] | undefined; onSalvarPedido: SalvarPedido; onPedidoEnviado: (id: string, canal: CanalPedido) => Promise<unknown>; onCancelarPedido: (id: string) => Promise<unknown>; onNovoLinkPedido: (id: string) => Promise<string>; onPagamentoPedido: (id: string, d: DadosPagamento) => Promise<unknown>;
  onAddSupplier: (f: Omit<Supplier, "id">) => Promise<unknown>; onUpdateSupplier: (s: Supplier, f: Omit<Supplier, "id">) => Promise<unknown>;
  onBack: () => void; onNew: () => void; onEdit: (p: Product) => void; onDismissSaved: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Produtos");
  const [view, setView] = useState<Product | null>(null);
  /** Muda a cada "Fazer pedido" para abrir a aba Pedidos já na montagem. */
  const [montar, setMontar] = useState(0);
  /** Muda a cada toque nas contas do "Atenção hoje" para abrir a aba Pedidos em "Só a pagar". */
  const [verPagar, setVerPagar] = useState(0);
  const contas = useMemo(() => resumoPagamentos(pedidos, hojeEm()), [pedidos]);
  const jaPedidos = useMemo(() => new Set(pedidos.filter(pedidoAberto).flatMap((p) => p.itens.map((i) => i.produtoId))), [pedidos]);
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
      </div>

      <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none]">
        <div className="flex w-max gap-2">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => { setTab(t); setMontar(0); setVerPagar(0); }} aria-current={tab === t ? "page" : undefined}
              className={`min-h-12 rounded-2xl px-4 text-base font-semibold transition ${tab === t ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>{t === "Gôndolas" ? nomeAreaVenda(store.tipo) : textoDoTipo(store.tipo)(t)}</button>
          ))}
        </div>
      </div>

      {tab === "Produtos" ? (
        <>
          {saved && <SavedBanner onAnother={() => { onDismissSaved(); onNew(); }} onList={onDismissSaved} />}
          <AtencaoHoje products={products} tipo={store.tipo} suppliers={suppliers} onOpen={(p) => { onDismissSaved(); setView(p); }}
            jaPedidos={jaPedidos} onFazerPedido={() => { onDismissSaved(); setVerPagar(0); setMontar((n) => n + 1); setTab("Pedidos"); }}
            contas={contas} onVerContas={() => { onDismissSaved(); setMontar(0); setVerPagar((n) => n + 1); setTab("Pedidos"); }} />
          <ListaProdutos products={products} tipo={store.tipo} suppliers={suppliers} onNew={onNew} onOpen={(p) => { onDismissSaved(); setView(p); }} />
        </>
      ) : tab === "Depósito" || tab === "Gôndolas" ? (
        <PainelLocais products={products} tipo={store.tipo} area={tab === "Depósito" ? "dep" : "ven"}
          locaisCadastrados={tab === "Depósito" ? locais?.deposito : locais?.venda} onOpen={(p) => { onDismissSaved(); setView(p); }} />
      ) : tab === "Pedidos" ? (
        <PainelPedidos key={`${montar}-${verPagar}`} products={products} store={store} suppliers={suppliers} pedidos={pedidos} montarAgora={montar > 0} soAPagar={verPagar > 0}
          onSalvar={onSalvarPedido} onEnviado={onPedidoEnviado} onCancelar={onCancelarPedido} onNovoLink={onNovoLinkPedido} onPagamento={onPagamentoPedido} onOpenProduto={(p) => { onDismissSaved(); setView(p); }} />
      ) : tab === "Fornecedores" ? (
        <PainelFornecedores products={products} tipo={store.tipo} suppliers={suppliers} onOpen={(p) => { onDismissSaved(); setView(p); }}
          onAdd={onAddSupplier} onUpdate={onUpdateSupplier} />
      ) : tab === "Equipe" && store.id ? (
        <PainelEquipe comercioId={store.id} comercioNome={store.nome} />
      ) : (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <p className="text-xl font-bold">{tab}</p>
          <p className="text-muted-foreground">Em breve</p>
        </div>
      )}
    </div>
  );
}
