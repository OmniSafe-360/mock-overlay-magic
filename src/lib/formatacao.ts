/** Entradas e apresentação. Centavos e reais têm funções diferentes para evitar conversões em dobro. */
export const digits = (v: string) => v.replace(/\D/g, "");
export const maskPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
export const formatarReais = (reais: number) => reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const formatarCentavos = (centavos: number) => formatarReais(centavos / 100);
/** Mesma identidade de local usada pelo índice do banco: ignora caixa e espaços nas pontas. */
export const normLocal = (s: string) => s.trim().toLowerCase();
