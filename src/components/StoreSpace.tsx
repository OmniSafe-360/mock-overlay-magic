import { useHoje } from "@/hooks/useHoje";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ClipboardList, LayoutGrid, MoreHorizontal, Package, Receipt, RefreshCw, Scale, Store, Truck, Users, Warehouse, type LucideIcon } from "lucide-react";
import { nomeAreaVenda, textoDoTipo } from "@/lib/exemplos";
import { TIPOS, type StoreData } from "@/components/StoreSetup";
import { Sheet } from "@/components/ProductArea";
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
/** As 4 partes do dia a dia ficam na barra; as outras ficam em "Mais". */
const PRINCIPAIS: Aba[] = ["Produtos", "Depósito", "Gôndolas", "Pedidos"];
const OUTRAS: Aba[] = ["Fornecedores", "Equipe", "Vendas", "Diferenças"];
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
  const [menu, setMenu] = useState(false);
  const nomeAba = (t: Aba) => (t === "Gôndolas" ? nomeAreaVenda(store.tipo) : textoDoTipo(store.tipo)(t));
  /** Nome curto na barra ("Área de venda" não cabe: vira "À venda"). */
  const curtoAba = (t: Aba) => (t === "Gôndolas" && nomeAreaVenda(store.tipo) !== "Gôndolas" ? "À venda" : nomeAba(t));
  const irPara = (t: Aba) => { setTab(t); setMontar(0); setVerPagar(0); setVerRelatorio(0); setMenu(false); };
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
  const avisosMais = OUTRAS.reduce((n, t) => n + (avisos[t]?.n ?? 0), 0);
  const maisUrgente = OUTRAS.some((t) => avisos[t]?.urgente);
  const naMais = OUTRAS.includes(tab);
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

      <nav aria-label="Partes do comércio" className="grid grid-cols-5 gap-0.5 rounded-2xl border border-border bg-secondary/40 p-1">
        {PRINCIPAIS.map((t) => (
          <BotaoBarra key={t} on={tab === t} Icon={SECOES[t].Icon} rotulo={curtoAba(t)} aviso={avisos[t]} onClick={() => irPara(t)} />
        ))}
        <BotaoBarra on={naMais} Icon={naMais ? SECOES[tab].Icon : MoreHorizontal} rotulo={naMais ? curtoAba(tab) : "Mais"} mais
          aviso={avisosMais ? { n: avisosMais, urgente: maisUrgente } : undefined} onClick={() => setMenu(true)} />
      </nav>

      {menu && (
        <Sheet title="Mais opções" onClose={() => setMenu(false)}>
          <ul className="min-h-0 space-y-1 overflow-y-auto px-3 pb-2" aria-label="Mais partes do comércio">
            {OUTRAS.map((t) => {
              const { Icon: I, ajuda } = SECOES[t];
              const on = tab === t;
              const a = avisos[t];
              return (
                <li key={t}>
                  <button type="button" onClick={() => irPara(t)} aria-current={on ? "page" : undefined}
                    className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${on ? "bg-primary/15" : "hover:bg-secondary/60"}`}>
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${on ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}><I size={22} /></span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-base font-semibold ${on ? "text-primary" : ""}`}>{nomeAba(t)}</span>
                      <span className="block text-xs text-muted-foreground">{textoDoTipo(store.tipo)(ajuda)}</span>
                    </span>
                    {a && a.n > 0 && <span className={`flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-sm font-bold ${a.urgente ? "bg-destructive text-white" : "bg-warning text-background"}`}>{a.n}</span>}
                    {on && <Check size={18} className="shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Sheet>
      )}

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

/** Um botão da barra de navegação do comércio: ícone, nome curto e número de aviso. */
function BotaoBarra({ on, Icon, rotulo, aviso, mais = false, onClick }: {
  on: boolean; Icon: LucideIcon; rotulo: string; aviso?: { n: number; urgente: boolean } | undefined; mais?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? "page" : undefined} aria-haspopup={mais ? "dialog" : undefined}
      aria-label={`${mais && !on ? "Mais" : rotulo}${aviso && aviso.n > 0 ? ` (${aviso.n} ${aviso.n === 1 ? "aviso" : "avisos"})` : ""}`}
      className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0 py-1.5 transition ${on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}>
      <Icon size={20} />
      <span className="flex max-w-full items-center gap-0.5 truncate text-[11px] font-semibold leading-none tracking-tight">
        <span className="truncate">{rotulo}</span>{mais && <ChevronDown size={12} className="shrink-0" />}
      </span>
      {aviso && aviso.n > 0 && (
        <span aria-hidden className={`absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${aviso.urgente ? "bg-destructive text-white" : "bg-warning text-background"}`}>{aviso.n > 99 ? "99+" : aviso.n}</span>
      )}
    </button>
  );
}
