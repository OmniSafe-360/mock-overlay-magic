import { describe, expect, it } from "vitest";
import { erroCaixa, erroDefinitivo } from "@/lib/caixa";
import { mensagemEntrada } from "@/lib/funcionario";
import { mensagemErro } from "@/lib/persistencia";

const e = { message: "comercio_desativado" };

describe("comércio desativado", () => {
  it("caixa explica e não descarta a venda guardada", () => {
    expect(erroCaixa(e)).toMatch(/desativado/);
    expect(erroCaixa(e)).toMatch(/vendas guardadas/);
    // Não é recusa definitiva: a venda continua na fila e sobe quando o dono reativar.
    expect(erroDefinitivo(e)).toBe(false);
  });
  it("entrada e telas da equipe mostram mensagem clara", () => {
    expect(mensagemEntrada(e)).toMatch(/desativado pelo dono/);
    expect(mensagemErro(e)).toMatch(/desativado pelo dono/);
  });
});
