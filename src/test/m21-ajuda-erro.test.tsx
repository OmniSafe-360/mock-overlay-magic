/* M21: em cada campo (Field), a mensagem de erro — ou, sem erro, a ajuda — fica ligada ao campo
   por aria-describedby, com id único; o leitor de tela lê junto. Quando validar não muda. */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "@/components/StoreSetup";

const descricao = (el: HTMLElement) => (el.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean)
  .map((id) => document.getElementById(id)?.textContent);

describe("M21 — ajuda e erro ligados ao campo", () => {
  it("ajuda ligada; com erro, o erro ligado (e a ajuda some, como antes)", () => {
    const { rerender } = render(<Field label="CEP" name="cep" hint="Só números." onChange={() => {}} value="" />);
    const campo = screen.getByLabelText("CEP");
    expect(descricao(campo)).toEqual(["Só números."]);
    expect(campo.getAttribute("aria-invalid")).toBe("false");
    rerender(<Field label="CEP" name="cep" hint="Só números." error="CEP incompleto." onChange={() => {}} value="1" />);
    expect(descricao(screen.getByLabelText("CEP"))).toEqual(["CEP incompleto."]);
    expect(screen.getByLabelText("CEP").getAttribute("aria-invalid")).toBe("true");
  });
  it("sem ajuda nem erro, nada ligado; descrição recebida de fora é mantida", () => {
    render(<><Field label="Nome" name="nome" onChange={() => {}} value="" /><span id="extra">Extra</span>
      <Field label="Cidade" name="cidade" hint="Ex.: Curitiba" aria-describedby="extra" onChange={() => {}} value="" /></>);
    expect(screen.getByLabelText("Nome").hasAttribute("aria-describedby")).toBe(false);
    expect(descricao(screen.getByLabelText("Cidade"))).toEqual(["Extra", "Ex.: Curitiba"]);
  });
  it("dois campos com o mesmo nome não repetem o id da mensagem", () => {
    render(<><Field label="A" name="x" id="a" hint="Ajuda A" onChange={() => {}} value="" /><Field label="B" name="x" id="b" hint="Ajuda B" onChange={() => {}} value="" /></>);
    expect(descricao(screen.getByLabelText("A"))).toEqual(["Ajuda A"]);
    expect(descricao(screen.getByLabelText("B"))).toEqual(["Ajuda B"]);
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("campo sem id nem name ganha id para o rótulo e a ajuda", () => {
    render(<Field label="Recado" hint="Opcional" onChange={() => {}} value="" />);
    expect(descricao(screen.getByLabelText("Recado"))).toEqual(["Opcional"]);
  });
});
