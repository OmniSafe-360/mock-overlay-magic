import { useState } from "react";
import { ArrowLeft, Store } from "lucide-react";
import { nomeAreaVenda } from "@/lib/exemplos";
import { TIPOS, type StoreData } from "@/components/StoreSetup";
import { ProductDetail, ProductsTab, SavedBanner, type Product, type Supplier } from "@/components/ProductArea";

const TABS = ["Produtos", "Depósito", "Gôndolas", "Fornecedores", "Equipe", "Vendas"] as const;

export function StoreSpace({ store, products, suppliers, saved, onBack, onNew, onEdit, onDismissSaved }: {
  store: StoreData; products: Product[]; suppliers: Supplier[]; saved: boolean;
  onBack: () => void; onNew: () => void; onEdit: (p: Product) => void; onDismissSaved: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Produtos");
  const [view, setView] = useState<Product | null>(null);
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
            <button key={t} type="button" onClick={() => setTab(t)} aria-current={tab === t ? "page" : undefined}
              className={`min-h-12 rounded-2xl px-4 text-base font-semibold transition ${tab === t ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>{t === "Gôndolas" ? nomeAreaVenda(store.tipo) : t}</button>
          ))}
        </div>
      </div>

      {tab === "Produtos" ? (
        <>
          {saved && <SavedBanner onAnother={() => { onDismissSaved(); onNew(); }} onList={onDismissSaved} />}
          <ProductsTab products={products} onNew={onNew} onOpen={(p) => { onDismissSaved(); setView(p); }} />
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <p className="text-xl font-bold">{tab === "Gôndolas" ? nomeAreaVenda(store.tipo) : tab}</p>
          <p className="text-muted-foreground">Em breve</p>
        </div>
      )}
    </div>
  );
}
