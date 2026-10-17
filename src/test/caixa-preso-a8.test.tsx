import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// A8 (checklist funcional 3): caixa que ficou aberto quando o funcionário perdeu o Caixa ou foi bloqueado.
describe("A8 — o dono fecha o caixa preso", () => {
  const montar = (semAcesso: boolean) => {
    const hoje = new Date().toISOString();
    let fechado = false;
    const fecharTurno = vi.fn(async () => { fechado = true; });
    const api = {
      caixas: vi.fn(async () => [{ id: "cx", nome: "Celular · Maria", tipo: "celular" as const, codigo: null, codigoGeradoEm: null, ligadoEm: hoje, desligadoEm: null, ultimoContatoEm: hoje, ultimaVendaEm: hoje, aparelho: null }]),
      vendas: vi.fn(async () => []), criar: vi.fn(), renomear: vi.fn(), novoCodigo: vi.fn(), desligar: vi.fn(), pendentes: vi.fn(async () => []), resolver: vi.fn(),
      fechamentos: vi.fn(async () => [fechado
        ? { id: "t1", caixaId: "cx", funcionario: "Maria", abertoEm: hoje, fechadoEm: hoje, trocoInicial: 5000, esperado: 7000, contado: 6500,
            diferenca: -500, observacao: "Fechado pelo dono: gaveta", conferidoEm: null, sangrias: 0 }
        : { id: "t1", caixaId: "cx", funcionario: "Maria", abertoEm: hoje, fechadoEm: null, trocoInicial: 5000, esperado: null, contado: null,
            diferenca: null, observacao: null, conferidoEm: null, sangrias: 0, semAcesso }]),
      conferirFechamento: vi.fn(async () => {}), cancelarCelular: vi.fn(), fecharTurno,
    };
    return { api, fecharTurno };
  };

  it("funcionário ainda com o Caixa: continua 'Vendendo agora', sem botão de fechar", async () => {
    const { PainelVendas } = await import("@/components/PainelVendas");
    const { api } = montar(false);
    render(<PainelVendas comercioId="c1" tipo="mercado" products={[]} api={api as never} />);
    expect(await screen.findByText(/Vendendo agora/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Fechar este caixa/ })).toBeNull();
  });

  it("sem acesso: o dono conta a gaveta e fecha", async () => {
    const { PainelVendas } = await import("@/components/PainelVendas");
    const { api, fecharTurno } = montar(true);
    render(<PainelVendas comercioId="c1" tipo="mercado" products={[]} api={api as never} />);
    expect(await screen.findByText(/Maria não tem mais acesso ao caixa/)).toBeTruthy();
    expect(screen.queryByText(/Vendendo agora/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Fechar este caixa/ }));
    const botao = screen.getByRole("button", { name: "Fechar o caixa" }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Quanto tem na gaveta/), { target: { value: "1.2.3" } });
    expect(screen.getByText(/Digite o valor em reais/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Quanto tem na gaveta/), { target: { value: "65,00" } });
    fireEvent.change(screen.getByLabelText(/Recado/), { target: { value: "gaveta" } });
    fireEvent.click(screen.getByRole("button", { name: "Fechar o caixa" }));
    await waitFor(() => expect(fecharTurno).toHaveBeenCalledWith("t1", 6500, "gaveta"));
    expect(await screen.findByText("Faltaram R$ 5,00")).toBeTruthy();
  });
});
