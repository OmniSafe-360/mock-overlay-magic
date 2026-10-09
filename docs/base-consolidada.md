# Base antes do recebimento — 09/10/2026

Esta etapa consolida o cadastro, a leitura dos saldos e a recuperação de envios de produtos e pedidos de compra. O recebimento e a reposição continuam para uma etapa separada.

## Identidade e saldo

- Produtos e fornecedores carregados usam seu UUID do banco na tela. Reordenar uma lista não muda o produto aberto nem seu fornecedor. IDs numéricos continuam aceitos apenas para compatibilidade com dados legados em memória.
- `contagens` informa se a área/variação foi contada inicialmente. Sua quantidade não é o saldo atual.
- `saldos` é a fonte das quantidades atuais. As parcelas são somadas em milésimos, por produto, variação e área. A ficha, os locais, a validade e as sugestões de compra usam o mesmo objeto reconstruído.
- Uma área contada sem saldo tem zero. Uma área ou variação não contada tem `null`. Um total com parte não contada fica incompleto, sem inventar zero.
- Produtos, variações, locais, limites, lotes e saldos são publicados juntos. A contagem de `operacoes` é lida antes e depois das consultas: se mudar, o conjunto é descartado e lido novamente, até três tentativas. Uma falha mantém os dados antigos com aviso.
- A paginação usa também o ID como desempate. Respostas de consultas antigas não substituem a consulta mais recente nem o estado de outro comércio.

## Envios sem confirmação

- O cadastro continua usando `salvar_cadastro`, com produto e pendências numa transação. Pedidos continuam usando `salvar_pedido` e seu UUID original.
- Antes de chamar o banco, o pedido exato é guardado no navegador, separado por usuário, comércio e módulo. O registro não contém credenciais nem tokens de acesso.
- Uma resposta perdida, um erro genérico do servidor ou uma sessão expirada mantém o registro. Atualizar a página ou fechar o cadastro não o elimina.
- A recuperação repete exclusivamente o pedido original. Se ele já foi confirmado, nenhum formulário novo é enviado. Uma recusa conclusiva permite corrigir e tentar novamente.
- O aviso “Conferir envio de produto/pedido” permite recuperar sem reconstruir o formulário. Ao confirmar, as telas são recarregadas. Pedidos pendentes bloqueiam novas compras naquele módulo até a conferência.
- Web Locks serializa os envios entre abas nos navegadores que oferecem a API. A verificação do registro evita sobrescrever ou apagar o envio de outra aba. Falha de armazenamento impede um novo envio.
- Um pedido recuperado não abre o envio ao fornecedor com o texto do formulário alterado: ele deve ser conferido na lista.

## Atualização e falhas

- Falha de pedidos não equivale a “nenhum pedido”. As ações ficam indisponíveis até atualizar; os dados anteriores continuam guardados em memória.
- Uma gravação confirmada com falha na atualização da lista é informada como salva. Não é oferecida como gravação que precisa ser repetida.
- “Atualizar”, recuperar a internet e voltar ao app recarregam os dados do comércio aberto. O cadastro aberto não é reinicializado por essas atualizações.

## Contrato para a próxima etapa

Cada recebimento, transferência ou ajuste deverá usar os mesmos UUIDs e inserir uma operação permanente junto das alterações de saldo, numa única transação. Essa operação é também a revisão observada pela leitura. A contagem inicial nunca deve ser reenviada em uma edição. Estoque e histórico não podem ser alterados por escrita direta do navegador.

Esta etapa não cria movimentação de estoque offline. Sem conexão, o saldo exibido pode ser o da última consulta; só o servidor confirma uma gravação. A recuperação guarda envios de cadastro e pedidos de compra, não uma fila de todas as ações do aplicativo. Outros cadastros e ações continuam exigindo conexão. Limpar os dados do navegador apaga o registro local, e outro aparelho não compartilha esse registro.

Nenhuma migração foi necessária: a leitura e o salvamento usam as tabelas e funções existentes. Os testes novos simulam respostas e transações; não substituem um teste conectado ao Supabase de produção.

## Teste no celular após integrar

1. Abrir dois comércios e conferir produtos, fornecedores, locais e quantidades separados. Cadastrar e editar; atualizar a página e conferir o mesmo produto.
2. Conferir ficha, Depósito, Área de venda, validade e sugestão de compra: todos devem mostrar o mesmo saldo. Roupas ainda não contadas não devem aparecer zeradas.
3. Falhar uma atualização: a lista antiga deve permanecer com aviso. Pedidos indisponíveis não devem aparecer como uma lista vazia válida.
4. Perder a conexão durante um envio, atualizar a página e usar “Conferir envio”. Conferir no banco/lista que o cadastro ou pedido aparece uma única vez. Uma simples queda antes do envio não prova o cenário de resposta perdida depois da gravação.
5. Repetir com um pedido de compra e conferir o fornecedor e as quantidades originais. Só enviar ao fornecedor depois de conferir o pedido recuperado.
6. Voltar a conexão e ao aplicativo: o botão Atualizar e os saldos devem refletir o banco. Conferir também teclado, rolagem e scanner no Android.
