# Checklist funcional — 11/10/2026

Análise ponta a ponta pedida pelo dono: só o que **já existe e não funciona direito**. Nada de função nova.
Fora desta lista, a pedido do dono: caixa no computador (Omni Conector) e "Esqueci minha senha".

Conferido e **sem problema**: os 59 comandos que o app manda ao banco existem com os nomes certos; todas as tabelas e colunas lidas existem; nenhum teste desligado; sem erros no banco nas últimas 24 h.

## Prioridade 1 — perde dinheiro ou estoque errado
- [ ] 1. **Fiado:** o 2º pagamento do mesmo cliente diz "Recebido", mas não é salvo (`PainelFiado.tsx`, código do pagamento repetido).
- [ ] 2. **Conferir depósito:** se a internet falhar e o funcionário tocar "Confirmar" de novo, o mesmo número conta como 2ª contagem e o estoque muda sem recontagem de verdade (`funcionario_conferencia_contar` sem rodada).
- [ ] 3. **Pedido cancelado continua como "Conta a pagar"** (e vira "Conta atrasada" no Atenção hoje) (`cancelar_pedido`).
- [ ] 4. **Mercadoria recebida some quando o depósito nunca foi contado**; contar depois soma de novo (fica em dobro) (`_entrar_no_deposito` não marca a contagem).
- [ ] 5. **Repor gôndola:** se o celular travar (5 min) depois de "Busque no depósito X", a reposição fica perdida; ao refazer, a gôndola sobe e o depósito não desce.
- [ ] 6. **Caixa no celular sem internet:** não abre (vai para "Sem conexão") e as vendas guardadas só sobem com o caixa aberto.
- [ ] 7. **Venda guardada recusada pelo banco** fica presa para sempre e fica fora do fechamento ("Sobraram R$ X" falso).

## Prioridade 2 — fluxo trava ou some
- [ ] 8. **Conferência do depósito começada pode sumir da lista** e nunca fechar; ao voltar, conta contagens de dias antigos.
- [ ] 9. **Recebimento não termina** se uma variação de roupa foi apagada depois do pedido.
- [ ] 10. **"Chegou sem pedido"** reabre a contagem abandonada de outro fornecedor, sem como descartar.
- [ ] 11. **"Conferência em andamento" nunca aparece para o dono**; enquanto a equipe conta, ainda aparecem "Enviar de novo" e "Cancelar pedido".
- [ ] 12. **Fechamento de caixa com falta de 2+ dias atrás some** da aba Vendas sem o dono ver.
- [ ] 13. **Painel do fiado não atualiza** (cancelamento, venda nova, primeiro cliente) até sair e voltar.
- [ ] 14. **"Sem cadastro" sem código no caixa do celular:** cada venda vira um item separado para resolver (30 sacolas = 30 toques).
- [ ] 15. **Depois de salvar/editar produto** volta para o lugar errado (lista de Produtos ou até "Novo pedido").
- [ ] 16. **PIN do dono na Equipe:** se a leitura falhar, o quadro fica sem botão.

## Prioridade 3 — texto ou detalhe errado
- [ ] 17. "Tentar de novo" (sem internet) no Omni Operação entra **sem pedir o PIN**.
- [ ] 18. Atualização de 1 em 1 minuto falhando joga o funcionário para "Sem conexão".
- [ ] 19. Tela inicial do funcionário conta "repor" de variação apagada (não bate com a lista).
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
