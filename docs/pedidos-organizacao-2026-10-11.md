# Organização da tela de Pedidos — 11/10/2026

Pedido do dono: deixar a tela mais objetiva e fácil de entender, preservando o fluxo e o que já funciona.

## Apresentação

- Busca e filtros aparecem antes do resumo financeiro. Os filtros existentes continuam Todos, Em andamento, Histórico e Contas a pagar, com uma explicação curta do que aparece em cada um.
- Cartões destacam o fornecedor e mantêm número, situação, data e quantidade de produtos. Entrega e pagamento ficam em linhas identificadas. Estimativa original e valor informado pelo fornecedor ficam separados; a forma de pagamento informada continua visível.
- Cada pedido mostra uma orientação curta conforme os dados: enviar, aguardar resposta, acompanhar entrega, conferir ajustes, decidir sobre produtos separados ou acompanhar pagamento.
- O detalhe começa com “Acompanhe este pedido” e “O que fazer agora”. Resposta do fornecedor e recebimento aparecem antes da lista de produtos, para que as pendências não fiquem escondidas depois de um pedido longo.
- A apresentação de um recebimento com situação `contando`, quando fornecido ao componente, diz “Conferência em andamento”; não anuncia entrega concluída. A consulta existente do banco continua trazendo apenas recebimentos concluídos: nenhum acesso ou consulta foi ampliado nesta entrega.
- Uma entrega recebida continua podendo ter pagamento pendente. A tela não confunde conta ainda não registrada com pagamento feito.

## Funcionamento preservado

Nenhuma tabela, migração, função do banco, permissão, consulta, fórmula ou gravação mudou. Criar pedido, adicionar produtos, enviar, reenviar, copiar texto/link, gerar link, cancelar com confirmação, decidir recebimento e registrar/corrigir/desfazer pagamento mantêm os mesmos eventos e condições de exibição. Compra continua calculada somente pelo depósito. Quantidades e preços de pedidos antigos continuam vindo do pedido salvo. Não há SQL para aplicar nesta entrega.

## Verificação

- Tipos e build sem erros.
- 754 testes em 69 arquivos, duas execuções completas aprovadas na versão final. Os 12 novos testes verificam orientações nos oito estados, conferência em andamento, decisão pendente e pagamento separado do recebimento. O teste anterior da resposta do fornecedor mantém as verificações de entrega, valor e forma na nova organização.
- Simulação no PostgreSQL descartável: cadeia operacional, isolamento entre donos, recusas de acesso, repetição de operações e concorrência aprovados; dados desfeitos. Usado `rodar_operacionais.sh --sem-catalogo`, pois a extensão HTTP do catálogo externo não está instalada no ambiente. Nenhuma migração desta entrega e nenhuma escrita em produção.
- Chromium, app real com respostas de banco simuladas, em 320 × 568 e 1280 × 900: lista, filtros, busca, retorno preservando a busca, quantidades/preços históricos, resposta do fornecedor, recebido em parte e recebimento com decisão pendente. Sem rolagem horizontal, exceções de tela ou pedidos de escrita ao banco.

## Depois de Publicar → Atualizar no Lovable

1. Abra o comércio → Pedidos. Confira os cartões e use busca e filtros.
2. Abra um pedido aguardando resposta e outro já recebido. Confira a orientação e as linhas de entrega e pagamento.
3. Se houver recebimento com pendência, confira se aparece antes dos produtos e se as mesmas opções de decisão continuam disponíveis.

Falta o teste do dono com os dados reais no endereço publicado.
