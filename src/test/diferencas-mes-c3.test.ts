import { describe, it, expect } from "vitest";
import { desdeDiferencas } from "@/components/PainelDiferencas";
describe("C3 — Faltou este mês lê o mês inteiro", () => {
  it("no dia 31 começa no dia 1º", () => {
    const agora = new Date("2026-10-31T15:00:00-03:00").getTime();
    expect(desdeDiferencas("2026-10-31", agora)).toBe(new Date("2026-10-01T00:00:00-03:00").toISOString());
  });
  it("no começo do mês continua com 30 dias", () => {
    const agora = new Date("2026-10-05T15:00:00-03:00").getTime();
    expect(desdeDiferencas("2026-10-05", agora)).toBe(new Date(agora - 30 * 86_400_000).toISOString());
  });
});
