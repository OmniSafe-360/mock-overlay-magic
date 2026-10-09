import type { EntityId } from "@/lib/identidade";
/* Aba Fornecedores: quem fornece o quê, contato com um toque (WhatsApp, ligar, e-mail) e o que está para comprar. */
import { useMemo, useState } from "react";
import { ChevronDown, Mail, MessageCircle, Pencil, Phone, Plus, Truck } from "lucide-react";
import { SupplierSheet, type Product, type Supplier } from "@/components/ProductArea";
import { btnPrimary, maskPhone } from "@/components/StoreSetup";
import { situacaoProduto } from "@/lib/situacao";
import { hojeEm } from "@/lib/validade";

type DadosFornecedor = Omit<Supplier, "id">;
const so = (s: string) => s.replace(/\D/g, "");
/** Link do WhatsApp: número com DDD vira +55. */
export const linkWhatsApp = (tel: string, texto?: string) => {
  const d = so(tel);
  if (d.length < 10) return "";
  const n = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
};

type ItemProd = { p: Product; compra: boolean; acabou: boolean };

export function PainelFornecedores({ products, tipo, suppliers, onOpen, onAdd, onUpdate }: {
  products: Product[]; tipo: string; suppliers: Supplier[]; onOpen: (p: Product) => void;
  onAdd: (f: DadosFornecedor) => Promise<unknown>; onUpdate: (s: Supplier, f: DadosFornecedor) => Promise<unknown>;
}) {
  const hoje = useMemo(() => hojeEm(), []);
  const [sheet, setSheet] = useState<Supplier | "novo" | null>(null);
  const porFornecedor = useMemo(() => {
    const m = new Map<EntityId | null, ItemProd[]>();
    for (const p of [...products].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
      const t = situacaoProduto(p, tipo, hoje).alertas.map((a) => a.tipo);
      const k = suppliers.some((s) => s.id === p.fornecedor) ? p.fornecedor : null;
      m.set(k, [...(m.get(k) ?? []), { p, compra: t.includes("comprar") || t.includes("acabou"), acabou: t.includes("acabou") }]);
    }
    return m;
  }, [products, tipo, hoje, suppliers]);
  const lista = [...suppliers].sort((a, b) => {
    const ca = (porFornecedor.get(a.id) ?? []).filter((i) => i.compra).length, cb = (porFornecedor.get(b.id) ?? []).filter((i) => i.compra).length;
    return cb - ca || a.nome.localeCompare(b.nome, "pt-BR");
  });
  const semFornecedor = porFornecedor.get(null) ?? [];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-bold">{suppliers.length === 1 ? "1 fornecedor" : `${suppliers.length} fornecedores`}</p>
          <p className="text-sm text-muted-foreground">Valem para todos os seus comércios.</p>
        </div>
        <button type="button" onClick={() => setSheet("novo")} className={`flex items-center justify-center gap-2 sm:w-64 ${btnPrimary(true)}`}><Plus size={20} /> Novo fornecedor</button>
      </div>

      {!suppliers.length && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-4 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/60 text-primary"><Truck size={30} /></span>
          <p className="text-base font-bold">Nenhum fornecedor ainda</p>
          <p className="text-sm text-muted-foreground">Cadastre de quem você compra. Depois, os pedidos saem prontos para o WhatsApp ou e-mail dele.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {lista.map((s) => <Cartao key={s.id} s={s} itens={porFornecedor.get(s.id) ?? []} onOpen={onOpen} onEditar={() => setSheet(s)} />)}
        {semFornecedor.length > 0 && <SemFornecedor itens={semFornecedor} onOpen={onOpen} />}
      </div>

      {sheet && (
        <SupplierSheet tipo={tipo} inicial={sheet === "novo" ? undefined : sheet} onClose={() => setSheet(null)}
          onSave={async (f) => { if (sheet === "novo") await onAdd(f); else await onUpdate(sheet, f); setSheet(null); }} />
      )}
    </div>
  );
}

function Cartao({ s, itens, onOpen, onEditar }: { s: Supplier; itens: ItemProd[]; onOpen: (p: Product) => void; onEditar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const comprar = itens.filter((i) => i.compra).length;
  const wa = linkWhatsApp(s.tel);
  return (
    <section aria-label={s.nome} className={`rounded-3xl border bg-secondary/60 p-4 ${comprar ? "border-warning/50" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Truck size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-base font-bold leading-snug">{s.nome}</h2>
          <p className="text-sm text-muted-foreground">{s.tel ? maskPhone(s.tel) : "Sem telefone"}</p>
          {s.email && <p className="break-all text-sm text-muted-foreground">{s.email}</p>}
        </div>
        <button type="button" onClick={onEditar} aria-label={`Editar ${s.nome}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-primary hover:bg-secondary"><Pencil size={18} /></button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Contato href={wa} rotulo="WhatsApp" Icone={MessageCircle} externo />
        <Contato href={so(s.tel).length >= 10 ? `tel:${so(s.tel)}` : ""} rotulo="Ligar" Icone={Phone} />
        <Contato href={s.email ? `mailto:${s.email}` : ""} rotulo="E-mail" Icone={Mail} />
      </div>
      {!s.tel && !s.email && <p className="mt-2 text-xs text-warning">Toque no lápis e informe o WhatsApp ou o e-mail para poder enviar pedidos.</p>}

      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} disabled={!itens.length}
        className="mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl bg-background-deep/50 px-3 text-left text-sm disabled:opacity-70">
        <span>
          {itens.length ? (itens.length === 1 ? "1 produto neste comércio" : `${itens.length} produtos neste comércio`) : "Nenhum produto neste comércio"}
          {comprar > 0 && <span className="block font-semibold text-warning">{comprar} para comprar</span>}
        </span>
        {itens.length > 0 && <ChevronDown size={18} className={`shrink-0 transition ${aberto ? "rotate-180" : ""}`} />}
      </button>
      {aberto && <ListaItens itens={itens} onOpen={onOpen} />}
    </section>
  );
}

function SemFornecedor({ itens, onOpen }: { itens: ItemProd[]; onOpen: (p: Product) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <section aria-label="Sem fornecedor" className="rounded-3xl border border-dashed border-border p-4">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left">
        <span>
          <span className="block text-base font-bold">Sem fornecedor</span>
          <span className="block text-sm text-muted-foreground">{itens.length === 1 ? "1 produto" : `${itens.length} produtos`} sem fornecedor definido</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 transition ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <>
          <p className="mt-2 text-xs text-muted-foreground">Abra o produto e toque em Editar para escolher o fornecedor.</p>
          <ListaItens itens={itens} onOpen={onOpen} />
        </>
      )}
    </section>
  );
}

function ListaItens({ itens, onOpen }: { itens: ItemProd[]; onOpen: (p: Product) => void }) {
  return (
    <ul className="mt-2 divide-y divide-border">
      {itens.map((i) => (
        <li key={i.p.id}>
          <button type="button" onClick={() => onOpen(i.p)} className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm">
            <span className="min-w-0 break-words font-medium">{i.p.nome}</span>
            {i.compra && <span className={`shrink-0 text-xs font-semibold ${i.acabou ? "text-destructive" : "text-warning"}`}>{i.acabou ? "Acabou" : "Comprar"}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Contato({ href, rotulo, Icone, externo }: { href: string; rotulo: string; Icone: typeof Phone; externo?: boolean }) {
  const cls = "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl border text-xs font-semibold";
  if (!href) return <span aria-disabled className={`${cls} border-border text-muted-foreground/50`}><Icone size={18} /> {rotulo}</span>;
  return (
    <a href={href} {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={`${cls} border-border text-primary hover:border-primary`}>
      <Icone size={18} /> {rotulo}
    </a>
  );
}
