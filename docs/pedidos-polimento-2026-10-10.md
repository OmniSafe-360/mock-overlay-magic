# Polimento de Pedidos — 10/10/2026

Pedido do dono: organizar a área de Pedidos e explicar a compra por embalagem, sem mudar o restante do sistema. O pedido sugerido continua calculado somente pelo depósito.

## Onde aparece

Comércios → selecionar o comércio → Pedidos → selecionar o pedido.

- Lista: número, fornecedor, situação, data e valor identificado como estimativa; resposta do fornecedor e pagamento continuam separados. Filtros Todos, Em andamento, Histórico e Contas a pagar; busca por número ou fornecedor. Histórico inclui recebidos, cancelados e recusados; uma compra recebida ainda pode constar em Contas a pagar.
- Detalhe: primeiro "O que foi pedido", com um cartão por item. Exemplo: quantidade pedida 5 pacotes, cada pacote contém 10 unidades, total 50 unidades, preço estimado por pacote R$ 10,00, subtotal R$ 50,00. Depois vêm os blocos já existentes de resposta, recebimento e pagamento, e as ações anteriores.
- Quantidade pedida, confirmada pelo fornecedor e recebida são mostradas separadamente. A resposta continua visível depois de receber a mercadoria.
- Preço desconhecido aparece como "Não informado"; zero informado continua zero. Havendo preços ausentes, o total é identificado como estimativa parcial e explicado. O valor informado pelo fornecedor não substitui silenciosamente a estimativa original.

## Números de pedidos antigos

Antes, o subtotal do item era calculado com o preço atual do cadastro, embora o total usasse o preço guardado no pedido. A conversão da embalagem também vinha do cadastro atual. A exibição agora usa `pedido_itens.preco_estimado`, `qtd_unidades` e `qtd_embalagens`.

`linhasDoPedido` usa a conversão registrada (`qtd_unidades / qtd_embalagens`) para o detalhe e a mensagem de reenvio. O objeto do produto continua sendo o atual, para que "Ver produto" abra a ficha correta sem trocar seu preço ou embalagem. Os nomes e o tipo da embalagem ainda vêm do cadastro existente, como antes; os números vêm do pedido. Se a embalagem não estiver disponível, o texto diz "embalagem" e mantém a conversão registrada.

## Escopo preservado

Nenhuma migração, tabela, RPC, permissão, fórmula de sugestão de compra, gravação de pedido ou movimento de estoque mudou. Nada foi executado no banco de produção. Cadastro, scanner, caixa, equipe, contagem cega, recebimento, reposição e pagamento mantêm suas regras. Só a leitura e apresentação de Pedidos foram ajustadas.

## Verificação

- `node_modules/.bin/tsc --noEmit`: sem erros.
- `node_modules/.bin/vite build`: aprovado.
- `node_modules/.bin/vitest run`: 715 testes em 68 arquivos, duas execuções completas aprovadas na versão final. São 15 testes novos; os dois testes antigos ajustados verificam os mesmos comportamentos com a nova apresentação.
- Navegador Chromium, telas reais do app com respostas de banco simuladas: login, abrir comércio, lista, filtros, busca, voltar preservando busca, detalhe, estimativa original, conversão original, confirmação parcial, quantidade recebida e valor do fornecedor. Resoluções 320 × 568 e 1280 × 900; sem rolagem horizontal, exceções de tela ou pedido de escrita ao banco.
- O exemplo de depósito zero/máximo 50 e gôndola zero/máximo 100 continua sugerindo cinco pacotes de dez. A gôndola não foi incluída no cálculo.

Não foi feito teste com a conta do dono no endereço publicado nem com o teclado físico de um celular. O teste visual com dados simulados não prova os dados do pedido de produção.

## Teste do dono depois de Publicar → Atualizar

1. Abra o comércio → Pedidos. Use os filtros e procure o pedido pelo número ou pelo fornecedor.
2. Abra o pedido de cinco pacotes. Confira 10 unidades em cada pacote, total de 50 e os valores estimados registrados na compra.
3. Confira a resposta do fornecedor, entrega/recebimento e pagamento em blocos separados.
4. Volte para a lista. O filtro e a busca devem continuar como estavam.

O polimento apenas apresenta os pedidos; não cria compra nem aumenta estoque ao consultar.
