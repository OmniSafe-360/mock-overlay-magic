import { describe, expect, it } from "vitest";
import { mensagemAcao, mensagemErro } from "@/lib/persistencia";

describe("C4 — mensagem de ações sem formulário", () => {
  it("sem internet não fala em formulário", () => {
    expect(mensagemAcao(new Error("Failed to fetch"))).toBe("Sem conexão. Tente de novo.");
  });
  it("erro desconhecido diz que não foi concluído", () => {
    expect(mensagemAcao(new Error("algo"))).toBe("Não foi possível concluir agora. Tente de novo.");
  });
  it("recusa conhecida continua igual", () => {
    expect(mensagemAcao(new Error("sem_permissao"))).toBe(mensagemErro(new Error("sem_permissao")));
  });
  it("formulários continuam com o aviso de que os dados ficaram", () => {
    expect(mensagemErro(new Error("Failed to fetch"))).toMatch(/Seus dados continuam no formulário/);
  });
});
