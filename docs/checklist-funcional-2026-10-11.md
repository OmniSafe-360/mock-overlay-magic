# Checklist funcional — 11/10/2026

Análise ponta a ponta pedida pelo dono: só o que **já existe e não funciona direito**. Nada de função nova.
Fora desta lista, a pedido do dono: caixa no computador (Omni Conector) e "Esqueci minha senha".

Conferido e **sem problema**: os 59 comandos que o app manda ao banco existem com os nomes certos; todas as tabelas e colunas lidas existem; nenhum teste desligado; sem erros no banco nas últimas 24 h.

## Prioridade 1 — perde dinheiro ou estoque errado
- [x] 1. (corrigido em 11/10/2026: código novo a cada "Recebeu", o mesmo ao reenviar depois de falhar; nenhum pagamento real tinha se perdido) **Fiado:** o 2º pagamento do mesmo cliente diz "Recebido", mas não é salvo (`PainelFiado.tsx`, código do pagamento repetido).
- [x] 2. (corrigido em 11/10/2026, migração `20261011061907_conferencia_rodada.sql`: o celular manda a rodada; reenvio da mesma não conta de novo; a lista diz em que contagem uma conferência começada parou. depois da publicação, a versão antiga sem rodada passou a recusar com `app_desatualizado` (migração `20261011062322`)) **Conferir depósito:** se a internet falhar e o funcionário tocar "Confirmar" de novo, o mesmo número conta como 2ª contagem e o estoque muda sem recontagem de verdade (`funcionario_conferencia_contar` sem rodada).
- [x] 3. (corrigido em 11/10/2026, migração `20261011062555_cancelar_pedido_limpa_conta.sql`: cancelar tira a conta; o pago continua; o app também ignora conta de pedido cancelado/recusado) **Pedido cancelado continua como "Conta a pagar"** (e vira "Conta atrasada" no Atenção hoje) (`cancelar_pedido`).
- [x] 4. (corrigido em 11/10/2026, migração `20261011063431_contagem_inicial_absorve_recebido.sql`: a primeira contagem passa a ser o total — o que entrou antes sai com "ajuste" na mesma operação; sem dobro. Enquanto a área não é contada, o app continua mostrando "não contado", pela regra de nunca inventar número) **Mercadoria recebida some quando o depósito nunca foi contado**; contar depois soma de novo (fica em dobro) (`_entrar_no_deposito` não marca a contagem).
- [x] 5. (corrigido em 11/10/2026: a trava de 5 minutos mostra o PIN por cima e mantém a tela de trabalho aberta embaixo; ao destravar volta no mesmo ponto — vale para repor, receber, conferir, perda e caixa. Se o app for fechado de vez no meio, a reposição ainda se perde) **Repor gôndola:** se o celular travar (5 min) depois de "Busque no depósito X", a reposição fica perdida; ao refazer, a gôndola sobe e o depósito não desce.
- [x] 6. (corrigido em 11/10/2026: sem internet, o app usa a última tela inicial guardada, confere o PIN no celular — 5 erros travam até a internet voltar — e vai direto ao caixa; as vendas guardadas sobem quando a internet volta ou ao abrir o início, mesmo fora do caixa. O caixa precisa já estar aberto para vender sem internet) **Caixa no celular sem internet:** não abre (vai para "Sem conexão") e as vendas guardadas só sobem com o caixa aberto.
- [x] 7. (corrigido em 11/10/2026: botão "Tentar enviar de novo" em cada venda não aceita; o relógio do celular adiantado não recusa mais a venda — migração `20261011065323`; ao fechar o caixa, as não aceitas aparecem na tela e vão na anotação que o dono vê, com o dinheiro que ficou na gaveta) **Venda guardada recusada pelo banco** fica presa para sempre e fica fora do fechamento ("Sobraram R$ X" falso).

## Prioridade 2 — fluxo trava ou some
- [x] 8. (corrigido em 11/10/2026, migração `20261011070050_conferencia_aberta_primeiro.sql`: a começada hoje aparece sempre, mesmo com a meta do dia batida; a de outro dia é deixada de lado e o produto é contado do zero; a rodada certa já vinha do item 2) **Conferência do depósito começada pode sumir da lista** e nunca fechar; ao voltar, conta contagens de dias antigos.
- [x] 9. **Recebimento não termina** se uma variação de roupa foi apagada depois do pedido. Correção testada e aplicada no Supabase em 11/10/2026: [registro e roteiro](recebimento-variacao-removida-2026-10-11.md), migração `20261011120000` registrada; três funções conferidas, RLS/permissões preservadas. Avisos do Supabase conferidos por outro acesso em 11/10/2026 às 07h57 UTC, conforme relato do dono: nenhum aviso novo causado pelo item 9. **Falta o teste do dono no app publicado.**
- [x] 10. **"Chegou sem pedido"** reabre a contagem abandonada de outro fornecedor, sem como descartar. Corrigido em 11/10/2026: rascunhos separados por fornecedor (inclusive "Não sei"), escolha de continuar ou descartar só as contagens não enviadas; envio sem resposta continua protegido. Sem SQL; [registro e roteiro](recebimento-sem-pedido-2026-10-11.md). **Falta o teste do dono no app publicado.**
- [x] 11. **"Conferência em andamento" nunca aparece para o dono**; enquanto a equipe conta, ainda aparecem "Enviar de novo" e "Cancelar pedido". Corrigido em 11/10/2026: pedidos carregam também conferências abertas; controles de envio/cancelamento somem ao atualizar, inclusive confirmações já abertas; decisões do dono só após conclusão. Sem SQL; [registro e roteiro](pedidos-conferencia-2026-10-11.md). **Falta o teste do dono no app publicado.**
- [x] 12. (corrigido em 11/10/2026: o app busca também os fechamentos com falta ou sobra que o dono ainda não viu, de qualquer dia; nos antigos, o total de vendas não aparece para não mostrar "R$ 0,00" falso; nenhuma falta real estava escondida) **Fechamento de caixa com falta de 2+ dias atrás some** da aba Vendas sem o dono ver.
- [x] 13. (corrigido em 11/10/2026: o fiado lê de novo a cada atualização da aba Vendas — sozinha a cada minuto, no botão Atualizar e depois de cancelar venda; o primeiro cliente aparece sem sair da tela) **Painel do fiado não atualiza** (cancelamento, venda nova, primeiro cliente) até sair e voltar.
- [x] 14. (corrigido em 11/10/2026, migração `20261011122600_caixa_sem_codigo_pelo_nome.sql`: a venda sem código usa o nome digitado como chave — "Sacola" junta todas num item só, e a decisão do dono vale para as próximas; nenhuma venda antiga precisou de conserto) **"Sem cadastro" sem código no caixa do celular:** cada venda vira um item separado para resolver (30 sacolas = 30 toques).
- [x] 15. (corrigido em 11/10/2026: o cadastro de produto abre por cima da tela do comércio, e a ficha do produto por cima das abas, sem desmontar o que estava aberto; ao salvar, cancelar ou voltar, tudo continua onde estava — aba, ficha, pedido aberto) **Depois de salvar/editar produto** volta para o lugar errado (lista de Produtos ou até "Novo pedido").
- [x] 16. (corrigido em 11/10/2026: se não der para conferir, aparece "Não foi possível conferir o seu PIN agora. Confira a internet." com "Tentar de novo"; enquanto confere, "Conferindo…") **PIN do dono na Equipe:** se a leitura falhar, o quadro fica sem botão.

## Prioridade 3 — texto ou detalhe errado
- [x] 17. (corrigido junto com o item 6) "Tentar de novo" (sem internet) no Omni Operação entra **sem pedir o PIN**.
- [x] 18. (corrigido em 11/10/2026: a tela inicial continua aberta com os números de antes e mostra "Sem conexão com o Omni agora… o app tenta de novo sozinho"; resposta atrasada não tira o funcionário de outra tela) Atualização de 1 em 1 minuto falhando joga o funcionário para "Sem conexão".
- [x] 19. (corrigido em 11/10/2026: o número "Repor" da tela inicial usa o mesmo filtro da lista de reposição — tamanho/cor apagado não conta; migração `20261011125553`) Tela inicial do funcionário conta "repor" de variação apagada (não bate com a lista).
- [ ] 20. Roupa vendida sem tamanho/cor mostra texto de "quantidade quebrada / Kg".
- [ ] 21. Mensagens do caixa dizem "A venda não foi enviada" ao abrir, sangria e fechar.
- [ ] 22. Total do pedido salvo difere alguns centavos do mostrado na montagem.
- [ ] 23. Mudar o CEP do comércio para um que falha mantém o endereço antigo.
- [ ] 24. Criar conta com e-mail que já existe diz "Confirme seu e-mail" em vez de "já cadastrado".
- [ ] 25. Algumas recusas mostram "tente de novo" quando tentar de novo nunca vai dar certo.

## Dados para arrumar (com autorização do dono)
- [ ] 26. Comércios de teste ("Supermercado bom preço", "Mercado bom preço", "Molines", "Mercado são judas").
- [ ] 27. Código do Arroz errado; Dipirona da Farmavida vencida na gôndola desde 05/10.
- [ ] 28. 2 contagens de recebimento "sem pedido" abandonadas (Estilo e cia, Supermercado União).

## Teste em aparelho real (depois das correções)
- [ ] 29. Caixa no celular: câmera bipando, sem internet, fechar o caixa.
- [ ] 30. Omni Operação no Android e no iPhone: receber, repor, conferir, perda.
