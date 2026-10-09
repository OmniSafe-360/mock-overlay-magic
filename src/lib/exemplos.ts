/* Exemplos dos campos (o texto apagadinho dentro do campo), um jeito para cada tipo de comércio.
   Regra: nunca mostrar exemplo de um tipo em outro (ex.: "Arroz" numa farmácia). */
export type Exemplos = { produto: string; comercio: string; fornecedor: string };

export const EXEMPLOS: Record<string, Exemplos> = {
  mercado: { produto: "Arroz branco 5 kg", comercio: "Mercado Bom Preço", fornecedor: "Distribuidora Sol" },
  farmacia: { produto: "Dipirona 500 mg 10 comprimidos", comercio: "Farmácia Saúde", fornecedor: "Distribuidora de Medicamentos Vida" },
  roupas: { produto: "Camiseta básica de algodão", comercio: "Loja Estilo", fornecedor: "Confecções Aurora" },
  construcao: { produto: "Cimento CP II 50 kg", comercio: "Casa do Construtor", fornecedor: "Distribuidora Forte" },
  pet: { produto: "Ração para cães adultos 15 kg", comercio: "Pet Amigo", fornecedor: "Distribuidora Pet Sul" },
  autopecas: { produto: "Pastilha de freio dianteira", comercio: "Auto Peças Central", fornecedor: "Distribuidora Motor Peças" },
};
/** Sem tipo conhecido: exemplos que servem para qualquer comércio. */
const NEUTRO: Exemplos = { produto: "Nome como está na embalagem", comercio: "Nome que os clientes conhecem", fornecedor: "Nome da empresa" };

export const exemplos = (tipo: string | undefined): Exemplos => (tipo && EXEMPLOS[tipo]) || NEUTRO;

/** Nome da aba da área de venda: "Gôndolas" só onde se fala assim (mercado e pet shop). */
export const nomeAreaVenda = (tipo: string) => (tipo === "mercado" || tipo === "pet" ? "Gôndolas" : "Área de venda");

/** Mercado e pet shop falam "depósito"; farmácia, roupas, construção e autopeças falam "estoque". Só muda o texto da tela. */
export const usaEstoque = (tipo: string | undefined) => !!tipo && !["mercado", "pet"].includes(tipo);
/** Troca "depósito" por "estoque" num texto, quando o tipo fala assim ("no depósito" vira "no estoque"). */
export const textoDoTipo = (tipo: string | undefined) => (s: string) =>
  usaEstoque(tipo) ? s.replace(/depósito/g, "estoque").replace(/Depósito/g, "Estoque") : s;

/** Nomes de local que o comerciante toca para começar (depois completa: "Gôndola 3"). */
export const LOCAIS_SUGERIDOS: Record<string, { dep: string[]; ven: string[] }> = {
  mercado: { dep: ["Depósito", "Câmara fria", "Freezer"], ven: ["Gôndola", "Ilha", "Geladeira", "Freezer", "Perto do caixa"] },
  farmacia: { dep: ["Estoque", "Gaveteiro", "Geladeira"], ven: ["Gôndola", "Atrás do balcão", "Armário de controlados", "Geladeira"] },
  roupas: { dep: ["Estoque", "Prateleira", "Caixa organizadora"], ven: ["Arara", "Vitrine", "Prateleira", "Manequim"] },
  construcao: { dep: ["Pátio", "Galpão", "Prateleira"], ven: ["Loja", "Expositor", "Pátio"] },
  pet: { dep: ["Depósito", "Prateleira"], ven: ["Gôndola", "Balcão", "Aquário", "Ilha"] },
  autopecas: { dep: ["Prateleira", "Gaveta", "Mezanino"], ven: ["Balcão", "Expositor", "Vitrine"] },
};
