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

/** Detalhes com opções fixas, por tipo. Também no banco (validar_tipo confere cada chave). */
export const OPCOES_DETALHE: Record<string, Record<string, string[]>> = {
  mercado: {},
  farmacia: { tarja: ["Sem tarja (venda livre)", "Tarja vermelha", "Tarja vermelha (retém receita)", "Tarja preta"] },
  roupas: { publico: ["Feminino", "Masculino", "Unissex", "Infantil"] },
  construcao: { voltagem: ["110 V", "220 V", "Bivolt", "Não se aplica"] },
  pet: {
    especie: ["Cão", "Gato", "Pássaro", "Peixe", "Roedor", "Outros"],
    porte: ["Pequeno", "Médio", "Grande", "Todos"],
    fase: ["Filhote", "Adulto", "Sênior", "Todas"],
  },
  autopecas: {
    veiculo: ["Carro", "Moto", "Caminhão ou utilitário", "Todos"],
    posicao: ["Dianteira", "Traseira", "Esquerda", "Direita", "Não se aplica"],
  },
};

/** `opcional`: fica em "Mais detalhes (opcional)", fechado por padrão, para a tela não precisar rolar. */
export type DField = { k: string; label: string; hint: string; ph?: string; opts?: string[]; opcional?: boolean };
const op = (tipo: string, k: string) => OPCOES_DETALHE[tipo]![k]!;

/** Campos da etapa "Detalhes do produto", na ordem da tela. Todos podem ficar em branco. */
export const DETALHES: Record<string, DField[]> = {
  mercado: [
    { k: "marca", label: "Marca", hint: "Fabricante do produto.", ph: "Ex.: Camil" },
    { k: "peso", label: "Peso ou volume da embalagem", hint: "Como aparece no rótulo.", ph: "Ex.: 1 kg, 500 ml" },
  ],
  farmacia: [
    { k: "principio", label: "Princípio ativo", hint: "Substância principal.", ph: "Ex.: Dipirona" },
    { k: "apresentacao", label: "Apresentação", hint: "Forma e quantidade.", ph: "Ex.: 10 comprimidos 500 mg" },
    { k: "marca", label: "Marca", hint: "Laboratório ou marca.", ph: "Ex.: EMS" },
    { k: "tarja", label: "Tarja", hint: "A faixa colorida da caixa. Tarja preta e a que retém receita são controlados.", opts: op("farmacia", "tarja") },
    { k: "registro", label: "Registro na Anvisa", hint: "O número \"Reg. MS\" impresso na caixa.", ph: "Ex.: 1.0235.0045", opcional: true },
  ],
  roupas: [
    { k: "marca", label: "Marca", hint: "Marca da peça.", ph: "Ex.: Hering" },
    { k: "publico", label: "Para quem é", hint: "Ajuda a separar as peças.", opts: op("roupas", "publico") },
    { k: "tecido", label: "Tecido", hint: "Material principal.", ph: "Ex.: Algodão", opcional: true },
  ],
  construcao: [
    { k: "marca", label: "Marca", hint: "Fabricante.", ph: "Ex.: Tigre" },
    { k: "medida", label: "Medida / especificação", hint: "Tamanho, bitola ou tipo.", ph: "Ex.: Cano PVC 25 mm" },
    { k: "cor", label: "Cor", hint: "Para tintas, pisos, louças.", ph: "Ex.: Branco gelo", opcional: true },
    { k: "voltagem", label: "Voltagem", hint: "Para elétricos e ferramentas.", opts: op("construcao", "voltagem") },
  ],
  pet: [
    { k: "marca", label: "Marca", hint: "Fabricante.", ph: "Ex.: Golden" },
    { k: "especie", label: "Espécie", hint: "Para qual animal.", opts: op("pet", "especie") },
    { k: "porte", label: "Porte", hint: "Tamanho do animal.", opts: op("pet", "porte") },
    { k: "fase", label: "Fase da vida", hint: "Idade do animal.", opts: op("pet", "fase") },
    { k: "peso", label: "Peso da embalagem", hint: "Como no rótulo.", ph: "Ex.: 15 kg" },
  ],
  autopecas: [
    { k: "referencia", label: "Código do fabricante", hint: "Referência da peça.", ph: "Ex.: KYB-334" },
    { k: "oem", label: "Código original da montadora", hint: "O número da peça original do veículo.", ph: "Ex.: 51350-SNA-A01", opcional: true },
    { k: "marca", label: "Marca", hint: "Fabricante da peça.", ph: "Ex.: Bosch" },
    { k: "aplicacao", label: "Aplicação", hint: "Marca, modelo e ano do veículo.", ph: "Ex.: Fiat Uno 2015" },
    { k: "veiculo", label: "Tipo de veículo", hint: "Para qual veículo é a peça.", opts: op("autopecas", "veiculo") },
    { k: "posicao", label: "Posição", hint: "Onde vai no veículo.", opts: op("autopecas", "posicao") },
  ],
};

/** Unidades que aceitam vírgula (1,5 Kg). Também no banco: função unidade_fracionada. */
export const FRACAO = ["Kg", "Metro", "m²", "m³", "Litro"];

/** Nome do tipo no app → nome no banco. */
export const TIPO_BANCO: Record<string, string> = {
  mercado: "mercado", farmacia: "farmacia", roupas: "loja_roupas", construcao: "material_construcao", pet: "pet_shop", autopecas: "autopecas",
};
