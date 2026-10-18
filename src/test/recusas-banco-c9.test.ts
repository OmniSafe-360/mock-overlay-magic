import { describe, expect, it } from "vitest";
import { mensagemAcao, mensagemErro, mensagemFornecedor } from "@/lib/persistencia";
import { erroCaixa } from "@/lib/caixa";

// C9: recusas do banco que caíam na mensagem genérica ("tente de novo") ou na de outra tela.
const GENERICA = /Não foi possível|Quantidade inválida para esta unidade|monte o pedido/;
const CODIGOS = ["itens_demais", "quantidade_grande_demais", "quantidade_negativa", "quantidade_vazia", "quantidade_zero", "quantidade_invalida",
  "pedido_incompleto", "id_obrigatorio", "variacao_invalida", "variacao_obrigatoria", "operacao_repetida_com_outros_dados", "observacao_obrigatoria",
  "resposta_resolucao_invalida", "acao_invalida", "produto_nao_muda_de_comercio", "produto_de_outro_comercio", "variacao_removida_recebimento",
  "variacao_igual_ativa_recebimento"];

describe("C9 — recusas do banco com mensagem própria", () => {
  it.each(CODIGOS)("%s", (c) => {
    expect(mensagemErro(new Error(c))).not.toMatch(GENERICA);
    expect(mensagemAcao(new Error(c))).not.toMatch(GENERICA);
  });
  it("quantidades dizem o que está errado", () => {
    expect(mensagemErro(new Error("quantidade_grande_demais"))).toBe("Esse número é grande demais. Confira a contagem.");
    expect(mensagemErro(new Error("quantidade_zero"))).toBe("A quantidade precisa ser maior que zero.");
    expect(mensagemErro(new Error("itens_demais"))).toMatch(/no máximo 300/);
    expect(mensagemErro(new Error("pedido_itens_demais"))).toMatch(/200 produtos/);
  });
  it("variação removida na entrega não fala de pendência", () => {
    expect(mensagemErro(new Error("variacao_removida_recebimento"))).toMatch(/Avise o dono/);
    expect(mensagemErro(new Error("variacao_removida"))).toMatch(/pendência/);
  });
  it("fornecedor: quantidade fora do limite diz o limite (zero vale)", () => {
    expect(mensagemFornecedor(new Error("quantidade_invalida"))).toMatch(/100 vezes/);
    expect(mensagemFornecedor(new Error("previsao_obrigatoria"))).toBe("Informe a data prevista de entrega.");
    expect(mensagemAcao(new Error("quantidade_invalida"))).toMatch(/maiores que zero/);
  });
  it("caixa: cliente de outro comércio", () => {
    expect(erroCaixa(new Error("sem_permissao"))).toMatch(/cliente não é deste comércio/);
  });
});
