# E1/R03 — falha de consulta do fiado visível

Correção autorizada em 11/10/2026 sobre o `main` `947feb2daca97a883dbc08cd8aafdd6afac0b95d` (PR #101). **Corrigido no código; falta Publicar → Atualizar no Lovable e o teste do dono no app publicado.** Próxima correção: R04, avisar quando o rascunho de recebimento não puder ser guardado.

## Problema comprovado e resultado

`PainelFiado` ignorava a falha de `api.carregar`. Sem uma consulta anterior aprovada, o quadro desaparecia; depois de uma atualização que falhava, mostrava a dívida antiga sem aviso. Uma resposta atrasada também podia substituir a mais recente; trocar o comércio mantinha temporariamente dados e formulário do anterior.

Três testes reproduziram essas falhas antes da correção: primeira consulta sem aviso, resposta antiga sobrescrevendo a dívida mais recente e formulário anterior ainda aberto após trocar comércio.

Agora a tela mostra **“Não foi possível consultar o fiado agora”**, com **Tentar de novo**. Sem dados conhecidos, não inventa saldo zero nem anuncia “Ninguém devendo”. Com leitura anterior, mantém os dados com o aviso **“Os dados são da última consulta; podem ter mudado”**. O aviso e a nova tentativa também aparecem na lista e na conta aberta. Durante a leitura, identifica a consulta e desabilita o botão de nova tentativa.

Uma leitura aprovada limpa o aviso e atualiza os valores. A ausência de clientes confirmada mantém o quadro oculto, como antes; uma falha de leitura fica visível. O primeiro cliente aparece na atualização seguinte, conforme o item antigo 13.

Só a consulta mais recente pode alterar dados, erro ou estado de consulta. Trocar comércio desmonta o estado anterior antes de renderizar a nova conta, fecha seu formulário e invalida leituras pendentes. A consulta continua filtrada pelo comércio na API existente.

**Pagamento e consulta têm resultados distintos:** se o pagamento foi confirmado e a leitura posterior falhou, continua mostrando a confirmação do pagamento e avisa que o saldo visível é anterior. Tentar consultar novamente não grava outro pagamento. Os mesmos IDs e regras de reenvio, valor acima da dívida, pagamentos parciais, cobrança, edição do cliente e cancelamento de venda continuam existentes.

Nenhuma tabela, função de negócio, regra de estoque ou pagamento foi criada. Não houve SQL, alteração de banco, dados reais ou nova consulta aos avisos automáticos do Supabase nesta entrega. A limitação de acesso aos avisos registrada em R02 permanece.

## Verificações executadas

- Oito testes novos em [fiado-consulta.test.tsx](../src/test/fiado-consulta.test.tsx): primeira leitura com erro seguida de ausência confirmada; tentativa pendente e cliques repetidos; primeiro cliente; aviso na lista/conta aberta e atualização sem perder a seleção; resposta antiga; erro atrasado; outro comércio; pagamento confirmado seguido de leitura com erro e recuperação sem novo pagamento; cancelamento refletido na dívida e falha posterior identificada.
- Testes existentes do fiado preservados: pagamento parcial, cobrança, dois pagamentos com IDs diferentes e reenvio do pagamento recusado com o mesmo ID. Os 14 testes focados passaram.
- `npx tsc --noEmit` e `npx vitest run` aprovados **duas vezes**, com **859 testes em 75 arquivos** em cada rodada. `npm run build` aprovado; nenhum teste desligado para obter aprovação.
- Chromium em **320 e 1280 px**, com todas as chamadas ao Supabase interceptadas: primeira leitura com erro visível sem saldo inventado; nova consulta vazia confirmada; primeiro cliente; pagamento de R$ 20 confirmado e falha de leitura avisada; saldo de R$ 100 anterior identificado; consulta recuperada para R$ 80 sem repetir o pagamento. Sem corte horizontal ou exceção de tela. Os serviços eram simulados; nenhuma gravação no banco oficial.

A validação automatizada e de navegador não comprova publicação, funcionamento em aparelhos reais nem a conclusão das etapas E2–E8. R03 permanece com `[ ]` para publicação e teste do dono.

## Roteiro do dono, após publicar

Usar contas destinadas à validação; não simular pagamentos em dívida real.

1. Clicar em **Publicar → Atualizar** no Lovable. Abrir **Comércio → Vendas**. Com internet, conferir se o fiado mostra a dívida certa. Sem clientes cadastrados, o quadro continua oculto.
2. Com a aba Vendas já aberta, desligar a internet e clicar no botão de atualização das vendas. A aba avisa a falha geral. Se conseguir simular uma falha específica da leitura do fiado ou reabrir Vendas com o restante já carregado, o quadro deve mostrar a falha do fiado, sem dizer que não há dívidas.
3. Se o fiado já tinha dados quando a própria consulta falhou, conferir o aviso de dados da última consulta na lista e dentro da conta. Restabelecer a conexão e clicar **Tentar de novo**; o aviso deve sair apenas depois da consulta aprovada e o saldo deve atualizar. Clicar no botão de atualização geral também continua funcionando.
4. Em uma conta de teste, registrar pagamento parcial e conferir dívida/histórico; a nova tentativa de leitura não deve registrar outro pagamento. Registrar outro pagamento deve usar uma operação nova. Cancelar uma venda de teste deve retirar seu valor da dívida após atualizar.
5. Trocar de comércio: não devem aparecer clientes, valores ou formulário do anterior. Informar aparelho, comércio usado e resultado para registrar o aceite.

Desligar a internet antes de carregar a aba inteira pode mostrar apenas a falha geral de Vendas. Isso, sozinho, não exercita a consulta específica do fiado; os testes automatizados e o navegador simularam essa falha isoladamente.
