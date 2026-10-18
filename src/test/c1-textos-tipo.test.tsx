import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PainelEquipe, type ApiEquipe } from "@/components/PainelEquipe";
import { falaDoTipo } from "@/lib/exemplos";
import { funcaoTexto, type Funcionario } from "@/lib/funcionario";
import { primeirosPassos } from "@/lib/primeirosPassos";

/* C1 (checklist 3): farmácia, roupas, construção e autopeças dizem "estoque" e "área de venda";
 * mercado e pet shop continuam com "depósito" e "gôndola". */

describe("C1 — falaDoTipo", () => {
  it("troca depósito e gôndola nos tipos que falam estoque", () => {
    const f = falaDoTipo("farmacia");
    expect(f("Os produtos voltaram para a gôndola.")).toBe("Os produtos voltaram para a área de venda.");
    expect(f("Aguarda a conferência do depósito. Resolva o depósito na lista antes de aceitar a diferença da gôndola."))
      .toBe("Aguarda a conferência do estoque. Resolva o estoque na lista antes de aceitar a diferença da área de venda.");
    expect(f("Gôndolas e Depósito")).toBe("Áreas de venda e Estoque");
  });
  it("mercado, pet e tipo desconhecido não mudam", () => {
    for (const t of ["mercado", "pet", undefined]) expect(falaDoTipo(t)("Saiu da gôndola e do depósito.")).toBe("Saiu da gôndola e do depósito.");
  });
});

describe("C1 — função do funcionário", () => {
  it("repor diz área de venda fora do mercado e do pet shop", () => {
    expect(funcaoTexto("repor", "farmacia")).toBe("Repõe área de venda");
    expect(funcaoTexto("repor", "roupas")).toBe("Repõe área de venda");
    expect(funcaoTexto("repor", "mercado")).toBe("Repõe gôndola");
    expect(funcaoTexto("repor", "pet")).toBe("Repõe gôndola");
    expect(funcaoTexto("repor")).toBe("Repõe gôndola");
    expect(funcaoTexto("receber", "farmacia")).toBe("Recebe mercadoria");
  });
});

describe("C1 — Primeiros passos", () => {
  const base = { produtos: 0, locais: undefined, produtoComLocal: false, fornecedores: 0, funcionarios: 0, caixas: 0 };
  it("a ajuda dos lugares não fala gôndola na farmácia", () => {
    const p = primeirosPassos({ ...base, deposito: "Estoque", venda: "Área de venda" }).find((x) => x.id === "lugares")!;
    expect(p.ajuda).toBe("No cadastro do produto, diga em que lugar do estoque e da área de venda ele fica");
  });
  it("no mercado continua igual", () => {
    const p = primeirosPassos({ ...base, deposito: "Depósito", venda: "Gôndolas" }).find((x) => x.id === "lugares")!;
    expect(p.ajuda).toBe("No cadastro do produto, diga em que prateleira e gôndola ele fica");
  });
});

describe("C1 — Equipe", () => {
  const func: Funcionario = {
    id: "f1", nome: "Maria", funcao: "repor", codigo: "481516", codigoGeradoEm: new Date().toISOString(), primeiroAcessoEm: null,
    bloqueadoEm: null, ultimoAcesso: null, travadoAte: null, celulares: 0,
  };
  const api: ApiEquipe = {
    carregar: vi.fn(async () => [func]), criar: vi.fn(), atualizar: vi.fn(), bloquear: vi.fn(), novoAcesso: vi.fn(),
  };
  it("farmácia: explicação e função falam área de venda", async () => {
    render(<PainelEquipe comercioId="c1" comercioNome="Farmavida" tipo="farmacia" api={api} />);
    expect(await screen.findByText(/Repõe área de venda/)).toBeInTheDocument();
    expect(screen.getByText(/repor a área de venda e vender no caixa/)).toBeInTheDocument();
    expect(screen.queryByText(/gôndola/)).toBeNull();
  });
  it("mercado: continua gôndola", async () => {
    render(<PainelEquipe comercioId="c1" comercioNome="Mercado" tipo="mercado" api={api} />);
    expect(await screen.findByText(/Repõe gôndola/)).toBeInTheDocument();
    expect(screen.getByText(/repor a gôndola e vender no caixa/)).toBeInTheDocument();
  });
});
