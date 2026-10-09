-- Detalhes com opções fixas por tipo de comércio (Entrega 2, aprovada pelo dono em 09/10/2026).
-- validar_tipo passa a conferir VÁRIOS detalhes de opção fixa por tipo (antes era só um).
-- Farmácia: "tarja" substitui "controlado" (não havia produto de farmácia cadastrado).
-- Pet: mais espécies, porte e fase. Roupas: público. Construção: voltagem. Autopeças: tipo de veículo.
-- As mesmas listas estão em src/lib/listas.ts; o teste src/test/listas-banco.test.ts confere que são iguais.

create or replace function public.validar_tipo(_tipo public.tipo_comercio, _un text, _cat text, _det jsonb) returns void
language plpgsql immutable set search_path = public, pg_temp as $$
declare u text[]; c text[]; o jsonb := '{}'; k text; v text;
begin
  case _tipo
    when 'mercado' then u := '{Unidade,Kg,Litro,Pacote,Caixa,Dúzia,Bandeja}';
      c := '{Mercearia,Bebidas,"Bebidas alcoólicas",Hortifrúti,"Frios e laticínios",Congelados,"Biscoitos e doces","Café e matinais",Limpeza,Higiene,Bebê,Pet,"Bazar e utilidades",Descartáveis,Outros}';
    when 'farmacia' then u := '{Caixa,Cartela,Frasco,Unidade,Tubo,Ampola,Sachê,Pacote,Lata}';
      c := '{Medicamentos,Genéricos,Similares,Higiene,Dermocosméticos,Perfumaria,Infantil,Suplementos,"Primeiros socorros",Ortopedia,Conveniência,Outros}';
      o := '{"tarja": ["Sem tarja (venda livre)", "Tarja vermelha", "Tarja vermelha (retém receita)", "Tarja preta"]}';
    when 'loja_roupas' then u := '{Peça,Par,Kit}';
      c := '{Camisetas,Blusas,Camisas,Calças,"Shorts e bermudas",Saias,Vestidos,"Casacos e jaquetas","Moda praia",Fitness,Íntima,Meias,Infantil,Calçados,Acessórios,Outros}';
      o := '{"publico": ["Feminino", "Masculino", "Unissex", "Infantil"]}';
    when 'material_construcao' then u := '{Unidade,Peça,Metro,m²,m³,Kg,Saco,Caixa,Lata,Galão,Barra,Rolo,Milheiro}';
      c := '{Básico,Madeiras,"Telhas e coberturas","Ferragens e fixação",Hidráulica,Elétrica,Iluminação,Pintura,"Pisos e revestimentos","Louças e metais",Acabamento,Ferramentas,Jardim,"EPI e segurança",Outros}';
      o := '{"voltagem": ["110 V", "220 V", "Bivolt", "Não se aplica"]}';
    when 'pet_shop' then u := '{Unidade,Kg,Litro,Pacote,Caixa,Saco,Lata,Sachê}';
      c := '{Ração,Petiscos,Higiene,Acessórios,"Camas e casinhas",Brinquedos,"Farmácia pet",Aquarismo,Outros}';
      o := '{"especie": ["Cão", "Gato", "Pássaro", "Peixe", "Roedor", "Outros"], "porte": ["Pequeno", "Médio", "Grande", "Todos"], "fase": ["Filhote", "Adulto", "Sênior", "Todas"]}';
    when 'autopecas' then u := '{Unidade,Par,Jogo,Kit,Caixa,Litro,Metro}';
      c := '{Motor,"Óleos e lubrificantes",Filtros,Freios,Suspensão,"Embreagem e transmissão",Arrefecimento,Escapamento,Elétrica,Ignição,Iluminação,Carroceria,Acessórios,Outros}';
      o := '{"veiculo": ["Carro", "Moto", "Caminhão ou utilitário", "Todos"], "posicao": ["Dianteira", "Traseira", "Esquerda", "Direita", "Não se aplica"]}';
  end case;
  if _un is null or not (_un = any (u)) then raise exception 'unidade_incompativel: %', _un using errcode = '23514'; end if;
  if _cat is null or not (_cat = any (c)) then raise exception 'categoria_incompativel: %', _cat using errcode = '23514'; end if;
  -- Cada detalhe de opção fixa, se preenchido, precisa ser uma das opções.
  for k in select jsonb_object_keys(o) loop
    v := nullif(btrim(coalesce(_det->>k, '')), '');
    if v is not null and not (o->k ? v) then raise exception '%_invalido: %', k, v using errcode = '23514'; end if;
  end loop;
end $$;
