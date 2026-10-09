/* Opções do cadastro de produto por tipo de comércio. A MESMA lista está no banco (função validar_tipo);
 * o teste src/test/listas-banco.test.ts confere que as duas continuam iguais. Mudou aqui, mude a migração. */

export const UNIDADES: Record<string, string[]> = {
  mercado: ["Unidade", "Kg", "Litro", "Pacote", "Caixa", "Dúzia", "Bandeja"],
  farmacia: ["Caixa", "Cartela", "Frasco", "Unidade", "Tubo", "Ampola", "Sachê", "Pacote", "Lata"],
  roupas: ["Peça", "Par", "Kit"],
  construcao: ["Unidade", "Peça", "Metro", "m²", "m³", "Kg", "Saco", "Caixa", "Lata", "Galão", "Barra", "Rolo", "Milheiro"],
  pet: ["Unidade", "Kg", "Litro", "Pacote", "Caixa", "Saco", "Lata", "Sachê"],
  autopecas: ["Unidade", "Par", "Jogo", "Kit", "Caixa", "Litro", "Metro"],
};

export const CATEGORIAS: Record<string, string[]> = {
  mercado: [
    "Mercearia", "Bebidas", "Bebidas alcoólicas", "Hortifrúti", "Frios e laticínios", "Congelados", "Biscoitos e doces",
    "Café e matinais", "Limpeza", "Higiene", "Bebê", "Pet", "Bazar e utilidades", "Descartáveis", "Outros",
  ],
  farmacia: [
    "Medicamentos", "Genéricos", "Similares", "Higiene", "Dermocosméticos", "Perfumaria", "Infantil", "Suplementos",
    "Primeiros socorros", "Ortopedia", "Conveniência", "Outros",
  ],
  roupas: [
    "Camisetas", "Blusas", "Camisas", "Calças", "Shorts e bermudas", "Saias", "Vestidos", "Casacos e jaquetas", "Moda praia",
    "Fitness", "Íntima", "Meias", "Infantil", "Calçados", "Acessórios", "Outros",
  ],
  construcao: [
    "Básico", "Madeiras", "Telhas e coberturas", "Ferragens e fixação", "Hidráulica", "Elétrica", "Iluminação", "Pintura",
    "Pisos e revestimentos", "Louças e metais", "Acabamento", "Ferramentas", "Jardim", "EPI e segurança", "Outros",
  ],
  pet: ["Ração", "Petiscos", "Higiene", "Acessórios", "Camas e casinhas", "Brinquedos", "Farmácia pet", "Aquarismo", "Outros"],
  autopecas: [
    "Motor", "Óleos e lubrificantes", "Filtros", "Freios", "Suspensão", "Embreagem e transmissão", "Arrefecimento", "Escapamento",
    "Elétrica", "Ignição", "Iluminação", "Carroceria", "Acessórios", "Outros",
  ],
};

/** Unidades que aceitam vírgula (1,5 Kg). Também no banco: função unidade_fracionada. */
export const FRACAO = ["Kg", "Metro", "m²", "m³", "Litro"];

/** Nome do tipo no app → nome no banco. */
export const TIPO_BANCO: Record<string, string> = {
  mercado: "mercado", farmacia: "farmacia", roupas: "loja_roupas", construcao: "material_construcao", pet: "pet_shop", autopecas: "autopecas",
};
