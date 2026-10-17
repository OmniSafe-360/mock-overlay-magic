import { describe, expect, it } from "vitest";
import { lerReais } from "@/lib/caixa";

// A7 (checklist funcional 3): "15.5" virava R$ 155 e "15.50" virava R$ 1.550 no "Recebeu pagamento" do fiado no caixa
// (e no limite do fiado do dono), porque todo ponto era apagado antes de ler.
describe("lerReais — valor digitado em reais", () => {
  it.each([
    ["15.5", 1550], ["15.50", 1550], ["15,5", 1550], ["15,50", 1550], ["15", 1500], ["0,99", 99], [" 20 ", 2000],
    ["1.500", 150000], ["1.500,00", 150000], ["123.456,78", 12345678], ["1000000,00", 100000000], ["1.000.000", 100000000], ["1.50", 150],
  ])("%s → %i centavos", (txt, cent) => expect(lerReais(txt)).toBe(cent));
  it.each(["", "abc", "15,555", "1,500.00", "1.5.0", "-5", "15.", ",5", "1.234,5,6"])("%s é recusado", (txt) => expect(lerReais(txt)).toBeNull());
  it("acima de R$ 1.000.000,00 é recusado (Codex #194: o banco aceita até esse valor)", () => expect(lerReais("1000000,01")).toBeNull());
});
