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

it("A2: a versão de 11/10 mantinha valor e vencimento de conta que já existe (B5 ajusta depois)", () => {
  expect(aceite).toMatch(/valor_total\s*=\s*case when pagamento_situacao is not null then coalesce\(valor_total, v_valor\)/);
  expect(aceite).toMatch(/vencimento\s*=\s*case when pagamento_situacao is not null then coalesce\(vencimento, v_venc\)/);
});

// Checklist 3, item B5: a conta a pagar passa a seguir a nova resposta (menos o que o dono corrigiu); a paga não muda.
const b5 = readFileSync(join(dir, readdirSync(dir).find((f) => f.endsWith("_conta_segue_resposta.sql"))!), "utf8").replace(/--.*$/gm, "");
it("B5: conta paga não muda; a pagar segue a resposta, menos o que o dono corrigiu", () => {
  expect(b5).toMatch(/valor_total = case when pagamento_situacao = 'pago' then coalesce\(valor_total, v_valor\)/);
  expect(b5).toMatch(/valor_total is distinct from v\.valor_fornecedor then valor_total/);
  expect(b5).toMatch(/vencimento = case when pagamento_situacao = 'pago' then coalesce\(vencimento, v_venc\)/);
  expect(b5).toMatch(/md5\(d\) <> 'b1fe60daeac6785f31c1df2c7cbcf3e2'/);
});

it("mantém a função segura", () => {
  expect(sql).toMatch(/SECURITY DEFINER/);
  expect(sql).toMatch(/SET search_path TO 'public', 'pg_temp'/);
});
