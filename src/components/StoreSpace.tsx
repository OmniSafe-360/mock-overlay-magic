import { useHoje } from "@/hooks/useHoje";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ClipboardList, LayoutGrid, Package, Receipt, RefreshCw, Scale, Store, Truck, Users, Warehouse, type LucideIcon } from "lucide-react";
import { nomeAreaVenda, textoDoTipo } from "@/lib/exemplos";
import { TIPOS, type StoreData } from "@/components/StoreSetup";
import { atencaoHoje } from "@/lib/situacao";
import { nAlertas } from "@/lib/antifurto";
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
type Aba = (typeof TABS)[number];
/** Ícone e frase de cada parte do comércio. */
const SECOES: Record<Aba, { Icon: LucideIcon; ajuda: string }> = {
  Produtos: { Icon: Package, ajuda: "Lista, cadastro e o que precisa de atenção" },
  "Depósito": { Icon: Warehouse, ajuda: "O que está guardado, em cada lugar" },
  "Gôndolas": { Icon: LayoutGrid, ajuda: "O que está à venda, em cada lugar" },
  Pedidos: { Icon: ClipboardList, ajuda: "Compras, contas a pagar e entregas" },
  Fornecedores: { Icon: Truck, ajuda: "Contatos e o que comprar de cada um" },
  Equipe: { Icon: Users, ajuda: "Funcionários e acesso ao Omni Operação" },
  Vendas: { Icon: Receipt, ajuda: "Caixas ligados e vendas do dia" },
  "Diferenças": { Icon: Scale, ajuda: "Perdas, faltas e relatório antifurto" },
};

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
  const [tab, setTab] = useState<Aba>(inicio && "pedidos" in inicio ? "Pedidos" : inicio && "aba" in inicio ? inicio.aba : inicio && "relatorio" in inicio ? "Diferenças" : "Produtos");
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
  const nomeAba = (t: Aba) => (t === "Gôndolas" ? nomeAreaVenda(store.tipo) : textoDoTipo(store.tipo)(t));
  /** Nome curto na barra ("Área de venda" não cabe: vira "À venda"). */
  const curtoAba = (t: Aba) => (t === "Gôndolas" && nomeAreaVenda(store.tipo) !== "Gôndolas" ? "À venda" : nomeAba(t));
  const irPara = (t: Aba) => { setTab(t); setMontar(0); setVerPagar(0); setVerRelatorio(0); };
  /** Números de cada parte no menu: quantos assuntos esperam o dono (vermelho = urgente). */
  const avisos = useMemo(() => {
    const grupos = atencaoHoje(products, store.tipo, hojeEm(), () => undefined, jaPedidos);
    const ids = (f: (n: string) => boolean) => new Set(grupos.filter((g) => f(g.nivel)).flatMap((g) => g.itens.map((i) => i.p.id))).size;
    const urgentes = ids((n) => n === "urgente");
    const m: Partial<Record<Aba, { n: number; urgente: boolean }>> = {
      Produtos: { n: ids((n) => n !== "info"), urgente: urgentes > 0 },
      Pedidos: { n: contas.atrasados.n + contas.hoje.n + entregasDecidir, urgente: contas.atrasados.n + entregasDecidir > 0 },
      Vendas: { n: vendidoSemCadastro, urgente: vendidoSemCadastro > 0 },
      "Diferenças": { n: diferencasDecidir + nAlertas(antifurto), urgente: diferencasDecidir > 0 },
    };
    return m;
  }, [products, store.tipo, jaPedidos, contas, entregasDecidir, vendidoSemCadastro, diferencasDecidir, antifurto]);
  /* Faixa que corre para os lados: ao escolher uma parte, ela vai para o meio e as seguintes aparecem. */
  const faixa = useRef<HTMLDivElement>(null);
  const [bordas, setBordas] = useState({ esq: false, dir: false });
  const medir = useCallback(() => {
    const el = faixa.current;
    if (!el) return;
    setBordas({ esq: el.scrollLeft > 4, dir: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = faixa.current;
    const b = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && b && typeof el.scrollTo === "function") el.scrollTo({ left: b.offsetLeft - (el.clientWidth - b.offsetWidth) / 2, behavior: "smooth" });
    medir();
  }, [tab, medir]);
  useEffect(() => { window.addEventListener("resize", medir); return () => window.removeEventListener("resize", medir); }, [medir]);
  const current = view ? products.find((p) => p.id === view.id) ?? null : null;

  if (current)
    return <ProductDetail p={current} tipo={store.tipo} suppliers={suppliers} onBack={() => setView(null)} onEdit={() => onEdit(current)} />;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-300">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Voltar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/60 text-foreground hover:border-primary"><ArrowLeft size={20} /></button>
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 text-lg font-bold leading-tight" title={store.nome}>{store.nome}</h1>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Icon size={13} className="shrink-0 text-primary" /> {store.cidade} - {store.uf}</p>
        </div>
        {onAtualizar && (
          <button type="button" disabled={atualizando} onClick={onAtualizar} aria-label={atualizando ? "Atualizando" : "Atualizar"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60">
            <RefreshCw size={19} className={atualizando ? "animate-spin" : ""} />
          </button>
        )}
      </header>

      <nav aria-label="Partes do comércio" className="relative -mx-5">
        <div ref={faixa} onScroll={medir} className="flex snap-x snap-proximity gap-2 overflow-x-auto scroll-smooth px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <BotaoBarra key={t} on={tab === t} Icon={SECOES[t].Icon} rotulo={curtoAba(t)} aviso={avisos[t]} onClick={() => irPara(t)} />
          ))}
        </div>
        {bordas.esq && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent" />}
        {bordas.dir && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />}
      </nav>

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
        <PainelVendas comercioId={store.id} comercioNome={store.nome} tipo={store.tipo} products={products} onMudou={onVendasMudou} />
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

/** Um botão da faixa de navegação do comércio: ícone, nome curto e número de aviso. */
function BotaoBarra({ on, Icon, rotulo, aviso, onClick }: {
  on: boolean; Icon: LucideIcon; rotulo: string; aviso?: { n: number; urgente: boolean } | undefined; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? "page" : undefined}
      aria-label={`${rotulo}${aviso && aviso.n > 0 ? ` (${aviso.n} ${aviso.n === 1 ? "aviso" : "avisos"})` : ""}`}
      className={`relative flex min-h-16 w-[92px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-2 transition ${on ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30" : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/60 hover:text-foreground"}`}>
      <Icon size={22} />
      <span className="max-w-full truncate text-xs font-semibold leading-none">{rotulo}</span>
      {aviso && aviso.n > 0 && (
        <span aria-hidden className={`absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none ${aviso.urgente ? "bg-destructive text-white" : "bg-warning text-background"}`}>{aviso.n > 99 ? "99+" : aviso.n}</span>
      )}
    </button>
  );
}
