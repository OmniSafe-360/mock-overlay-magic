import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { CampoQtd } from "@/components/CampoQtd";

function Caixa({ inteiro = false, onValor }: { inteiro?: boolean; onValor: (n: number) => void }) {
  const [v, setV] = useState(2);
  return <CampoQtd aria-label="qtd" inputMode="decimal" valor={v} inteiro={inteiro} minimo={0} onValor={(n) => { setV(n); onValor(n); }} />;
}

describe("B4: campo de quantidade com vírgula", () => {
  it("deixa digitar 2,5 sem a vírgula sumir", () => {
    const f = vi.fn();
    render(<Caixa onValor={f} />);
    const i = screen.getByLabelText("qtd") as HTMLInputElement;
    fireEvent.focus(i);
    fireEvent.change(i, { target: { value: "2," } });
    expect(i.value).toBe("2,");
    fireEvent.change(i, { target: { value: "2,5" } });
    expect(i.value).toBe("2,5");
    expect(f).toHaveBeenLastCalledWith(2.5);
  });
  it("embalagem só aceita número inteiro", () => {
    const f = vi.fn();
    render(<Caixa inteiro onValor={f} />);
    const i = screen.getByLabelText("qtd") as HTMLInputElement;
    fireEvent.focus(i);
    fireEvent.change(i, { target: { value: "3,5" } });
    expect(f).toHaveBeenLastCalledWith(35);
  });
});
