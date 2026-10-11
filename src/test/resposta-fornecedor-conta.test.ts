import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// Checklist 2, item A2: a versão mais nova de responder_pedido não pode apagar nem trocar a conta existente.
const dir = join(process.cwd(), "supabase/migrations");
const ultima = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  .filter((f) => /function public\.responder_pedido/i.test(readFileSync(join(dir, f), "utf8"))).pop()!;
const sql = readFileSync(join(dir, ultima), "utf8").replace(/--.*$/gm, "");
const recusa = sql.slice(sql.indexOf("if not v_aceito"), sql.indexOf("return jsonb_build_object('situacao', 'recusado')"));
const aceite = sql.slice(sql.lastIndexOf("update pedidos_compra set situacao = case when v_ajuste"));

it("recusa não apaga valor nem vencimento de conta já paga", () => {
  expect(recusa).toMatch(/valor_total\s*=\s*case when pagamento_situacao = 'pago' then valor_total/);
  expect(recusa).toMatch(/vencimento\s*=\s*case when pagamento_situacao = 'pago' then vencimento/);
});

it("nova resposta mantém valor e vencimento de conta que já existe", () => {
  expect(aceite).toMatch(/valor_total\s*=\s*case when pagamento_situacao is not null then coalesce\(valor_total, v_valor\)/);
  expect(aceite).toMatch(/vencimento\s*=\s*case when pagamento_situacao is not null then coalesce\(vencimento, v_venc\)/);
});

it("mantém a função segura", () => {
  expect(sql).toMatch(/SECURITY DEFINER/);
  expect(sql).toMatch(/SET search_path TO 'public', 'pg_temp'/);
});
