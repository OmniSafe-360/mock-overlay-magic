/* Garante que as listas do app (src/lib/listas.ts) são as mesmas que o banco aceita (função validar_tipo na
 * migração mais recente que a define). Se alguém mudar só um dos lados, este teste falha. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIAS, FRACAO, TIPO_BANCO, UNIDADES } from "@/lib/listas";

const pasta = join(process.cwd(), "supabase/migrations");
const ultimaCom = (trecho: string) =>
  readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort().reverse()
    .map((f) => readFileSync(join(pasta, f), "utf8")).find((t) => t.includes(trecho))!;

/** Lê um array do Postgres escrito como '{a,"b c",d}'. */
const lerArray = (s: string) => [...s.matchAll(/"([^"]+)"|([^,{}"]+)/g)].map((m) => (m[1] ?? m[2]!).trim());

describe("listas do app = listas do banco", () => {
  const sql = ultimaCom("function public.validar_tipo");
  it.each(Object.entries(TIPO_BANCO))("%s", (app, banco) => {
    const m = sql.match(new RegExp(`when '${banco}' then u := '([^']+)';\\s*c := '([^']+)'`));
    expect(m, `tipo ${banco} não encontrado na migração`).toBeTruthy();
    expect(lerArray(m![1]!)).toEqual(UNIDADES[app]);
    expect(lerArray(m![2]!)).toEqual(CATEGORIAS[app]);
  });
  it("unidades que aceitam vírgula", () => {
    const m = ultimaCom("function public.unidade_fracionada").match(/_u in \(([^)]+)\)/)!;
    expect([...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1])).toEqual(FRACAO);
  });
  it("todo tipo tem 'Outros' por último", () => {
    for (const c of Object.values(CATEGORIAS)) expect(c.at(-1)).toBe("Outros");
  });
  it("nenhuma opção antiga sumiu", () => {
    const antes: Record<string, [string[], string[]]> = {
      mercado: [["Unidade", "Kg", "Litro", "Pacote", "Caixa"], ["Mercearia", "Bebidas", "Hortifrúti", "Frios e laticínios", "Limpeza", "Higiene"]],
      farmacia: [["Caixa", "Cartela", "Frasco", "Unidade"], ["Medicamentos", "Genéricos", "Higiene", "Dermocosméticos", "Infantil", "Suplementos"]],
      roupas: [["Peça", "Par"], ["Camisetas", "Calças", "Vestidos", "Calçados", "Íntima", "Acessórios"]],
      construcao: [["Unidade", "Metro", "m²", "Kg", "Saco", "Caixa", "Lata"], ["Básico", "Hidráulica", "Elétrica", "Pintura", "Ferramentas", "Acabamento"]],
      pet: [["Unidade", "Kg", "Litro", "Pacote", "Caixa"], ["Ração", "Petiscos", "Higiene", "Acessórios", "Farmácia pet", "Brinquedos"]],
      autopecas: [["Unidade", "Par", "Jogo", "Kit"], ["Motor", "Freios", "Suspensão", "Elétrica", "Filtros", "Acessórios"]],
    };
    for (const [t, [u, c]] of Object.entries(antes)) {
      expect(UNIDADES[t]).toEqual(expect.arrayContaining(u));
      expect(CATEGORIAS[t]).toEqual(expect.arrayContaining(c));
    }
  });
});
