# Item 11 — conferência da entrega visível para o dono

O painel de pedidos consultava apenas recebimentos concluídos. Quando a equipe abria uma conferência, o dono continuava vendo o pedido sem recebimento e os botões de reenvio e cancelamento.

A consulta dos pedidos agora inclui recebimentos em contagem e concluídos, sempre do comércio escolhido. A lista e o detalhe mostram **Conferência em andamento por [funcionário]** e orientam a aguardar a conclusão. O histórico de entregas sem pedido continua mostrando somente as concluídas.

Ao carregar a conferência, os controles de reenvio, cancelamento e link deixam de aparecer. Uma janela de reenvio ou confirmação de cancelamento já aberta também deixa de oferecer essas ações. Enquanto a equipe conta, decisões de aceitar/devolver e alertas de decisão do dono ficam aguardando; após a conclusão, os controles existentes voltam para os itens que precisam deles. Isso respeita a regra já existente no banco, que recusa decidir um recebimento ainda em contagem.

Não há SQL, migração ou mudança de estoque. As regras do banco, permissões e RLS permanecem as existentes. A tela continua usando a atualização já disponível: abrir o comércio, tocar em **Atualizar**, voltar ao app ou recuperar a internet. Não foi acrescentada atualização periódica.

## Verificação

- `npx tsc --noEmit` e `npx vitest run`: duas execuções finais aprovadas, 784 testes em 72 arquivos.
- Regressões em `pedidos-conferencia.test.tsx`: leitura filtrada do banco ligada à tela, abertura sem itens enviados, detalhe já aberto, confirmação de cancelamento, janela de reenvio, decisões após conclusão, alertas, separação por comércio, histórico avulso e erro de consulta.
- Chromium em 320 e 1280 px, com Supabase simulado: pedido antes da conferência, retomada do app durante contagem e atualização após conclusão. Sem rolagem horizontal, exceções ou gravação no banco real.
- `npm run build`: aprovado.

## Roteiro do dono no app publicado

**Falta o teste do dono no app publicado.** O teste geral continua previsto para o fim das correções. Para esta entrega, use **Publicar → Atualizar** no Lovable.

1. Na equipe, abra uma entrega com pedido, sem concluir a contagem.
2. No dono, abra **Comércios → comércio → Pedidos** e toque em **Atualizar**. Deve mostrar quem está conferindo.
3. Abra o pedido: deve orientar a aguardar e esconder **Enviar de novo** e **Cancelar pedido**. Não deve oferecer aceitar/devolver enquanto a contagem estiver aberta.
4. Termine a entrega na equipe e atualize no dono. Deve mostrar a mercadoria recebida e oferecer decisões somente para os produtos que ficaram pendentes.
5. Confira um pedido que ainda não começou a ser recebido: envio e cancelamento continuam disponíveis conforme as regras anteriores.
