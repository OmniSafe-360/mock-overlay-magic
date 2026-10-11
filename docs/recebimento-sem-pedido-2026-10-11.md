# Item 10 — recebimento sem pedido por fornecedor

O botão “Chegou sem pedido” usava um único rascunho por acesso do funcionário. Ao escolher outro fornecedor, o app mandava ao banco o identificador da entrega antiga e recebia a contagem dela. “Não sei” também podia herdar o fornecedor anterior.

A correção separa os rascunhos por acesso e fornecedor; “Não sei” tem seu próprio rascunho. Ao reencontrar uma entrega começada, o app mostra **Continuar contagem** e, quando ainda não houve envio, **Descartar contagem e começar outra**. A escolha de descarte explica que elimina as contagens ainda não enviadas, sem alterar o estoque.

## Proteções preservadas

- O rascunho antigo continua recuperável apenas ao escolher seu fornecedor original. Sua chave de armazenamento é mantida até a conclusão, pois um envio sem resposta pode estar guardado nela.
- Um envio sem resposta impede descarte: **Continuar contagem → Confirmar envio anterior** repete os dados originais, mesmo que o banco já tenha concluído a entrega. Não cria outra entrada no estoque.
- Antes do descarte, o app consulta a entrega novamente e confere que ela continua aberta, na rodada zero e sem itens enviados. Também verifica novamente o rascunho e os envios pendentes do aparelho.
- Contagens já enviadas não podem ser descartadas nessa escolha. Registros concluídos ficam no histórico; um rascunho já concluído e sem envio pendente não contamina a entrega seguinte.
- O identificador da nova entrega é guardado antes de pedir a abertura ao banco. Se a resposta se perder, a próxima tentativa retoma esse mesmo identificador.
- Uma tela antiga não sobrescreve nem envia um rascunho substituído. Enquanto o descarte abre a nova entrega, a lista impede outra abertura.

A correção está em `ReceberMercadoria.tsx` e na chave do rascunho em `recebimento.ts`. Não exige SQL, migração, função de banco ou tabela nova. As funções existentes continuam responsáveis pela autorização, contagem cega, entrada de estoque e registro de `operacoes` na mesma transação. Não houve limpeza dos dados reais do item 28: um registro vazio de abertura pode permanecer no banco quando seu rascunho local é descartado; ele não recebe quantidade nem é marcado como entrega concluída.

## Verificação

- `npx tsc --noEmit` e `npx vitest run`: duas execuções finais aprovadas, 779 testes em 71 arquivos.
- Regressões em `src/test/recebimento-sem-pedido.test.tsx`: fornecedor diferente, “Não sei”, retomada do rascunho antigo, descarte seguido de envio só da nova quantidade, fechamento da escolha sem perda, envio incerto, alteração por outra aba, contagem enviada no banco, falha na abertura inicial e depois do descarte, tela antiga e entrega já concluída.
- Chromium em 320 e 1280 px: escolha de retomada, fornecedor diferente e descarte; sem rolagem horizontal nem exceções de tela. Chamadas ao Supabase simuladas, sem operação de estoque real.
- `npm run build`: aprovado.

## Roteiro do dono no app publicado

Falta o teste do dono no app publicado; continua previsto para o fim das correções.

1. **Receber mercadoria → Chegou sem pedido → fornecedor A.** Conte um produto e salve a contagem, sem concluir a entrega.
2. Volte às entregas e escolha **fornecedor B**. A tela deve mostrar B e começar vazia. Repita com **Não sei**: não deve herdar A.
3. Escolha A novamente. Toque em **Continuar contagem**: a contagem anterior deve voltar.
4. Volte e escolha A outra vez. Toque em **Descartar contagem e começar outra**: a entrega nova deve começar vazia. Conte apenas o que chegou nessa nova entrega e conclua; o estoque deve receber somente essa quantidade.
5. Se a internet falhar durante um envio, reabra pelo mesmo fornecedor. Deve oferecer continuar e confirmar o envio anterior, sem permitir descartar enquanto falta a resposta.
