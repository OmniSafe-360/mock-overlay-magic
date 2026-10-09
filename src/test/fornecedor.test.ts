import { describe, expect, it } from "vitest";
import { linhaFornecedor } from "@/lib/persistencia";

describe("linhaFornecedor", () => {
  it("envia o telefone só com números, no formato aceito pelo banco", () => {
    expect(linhaFornecedor({ nome: " Distribuidora Sol ", tel: "(14) 99773-2018", email: "" })).toEqual({
      nome: "Distribuidora Sol",
      telefone: "14997732018",
      email: null,
    });
    expect(linhaFornecedor({ nome: "Fixo", tel: "(14) 3322-1100", email: "" }).telefone).toBe("1433221100");
  });

  it("transforma campos vazios em null e o e-mail em minúsculo", () => {
    expect(linhaFornecedor({ nome: "Sol", tel: "", email: "  Vendas@Sol.COM.br " })).toEqual({
      nome: "Sol",
      telefone: null,
      email: "vendas@sol.com.br",
    });
  });
});
