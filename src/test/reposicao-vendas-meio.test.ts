import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// Checklist 2, item A3: o "Coloquei" acerta a prateleira pela diferença da hora da contagem,
// sem devolver à gôndola o que foi vendido enquanto o funcionário buscava no depósito.
const dir = join(process.cwd(), "supabase/migrations");
const ultima = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  .filter((f) => /function public\.funcionario_reposicao_concluir/i.test(readFileSync(join(dir, f), "utf8"))).pop()!;
const sql = readFileSync(join(dir, ultima), "utf8").replace(/--.*$/gm, "");

it("diferença calculada com o que o sistema tinha na contagem", () => {
  expect(sql).toMatch(/v_esperado\s*:=\s*coalesce\(rp\.esperado, v_atual\)/);
  expect(sql).toMatch(/v_dif\s*:=\s*rp\.contado - v_esperado/);
  expect(sql).not.toMatch(/v_dif\s*:=\s*rp\.contado - v_atual/);
});

it("diferença do dono usa o esperado da contagem e a operação continua registrada", () => {
  expect(sql).toMatch(/_registrar_diferenca\([^)]*v_esperado, rp\.contado/);
  expect(sql).toMatch(/insert into operacoes/);
  expect(sql).toMatch(/SECURITY DEFINER/);
});
