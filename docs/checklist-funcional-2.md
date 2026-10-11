# Checklist funcional 2 — fonte da verdade das correções (11/10/2026)

Pedido do dono: análise ponta a ponta do sistema inteiro para deixá-lo **100% funcional**, **sem inventar funções novas**: só arrumar o que já existe. Este arquivo é a **contraprova** usada em toda correção: antes de corrigir, ler o item; depois, marcar `[x]` com a data e o que foi feito, e anotar no `CLAUDE.md`.

**Como este arquivo se liga ao plano:** o plano geral é o [checklist ponta a ponta](CHECKLIST_PONTA_A_PONTA.md), com as etapas E1 a E8, e as regras ficam na [fonte da verdade](FONTE_DA_VERDADE.md). Este arquivo é a lista detalhada dos defeitos achados na análise 2. Ordem combinada: terminar E2.1 e depois corrigir A1 → A11, B1 → B16 e C1 → C3, um por vez. Em seguida vêm os testes de E2 a E8. A análise foi conferida de novo depois de juntar o `main` até o PR #106.

**Como foi feita a análise:** 5 frentes em paralelo leram o código e as funções do banco: cadastro e estoque; pedidos e fornecedores; app da equipe; caixa, vendas, fiado e diferenças; tela inicial, entrada e navegação. Cada achado foi conferido no código. Os mais graves também foram conferidos no banco oficial, só com leitura. O que não se confirmou foi descartado. Também foi conferido:
- o banco está limpo: sem saldo negativo e sem nada pendente parado;
- o app compila;
- os 828 testes passam.

**Regras para cada correção** (as mesmas do `CLAUDE.md`):
1. Corrigir um item por vez.
2. Rodar `npx tsc --noEmit` e `npx vitest run` duas vezes.
3. Criar um teste que falha sem a correção.
4. Se mexer no banco, simular antes com `begin … rollback` e só então aplicar.
5. Marcar aqui, anotar no `CLAUDE.md` e mesclar no `main`.
6. Avisar o dono se precisa de **Publicar → Atualizar**.

Fora desta lista, a pedido do dono: Omni Conector (caixa no computador) e "Esqueci minha senha".

---

## Etapa A — trava o uso, perde dinheiro ou estoque (fazer primeiro)

- [x] A1. (11/10/2026: o desvio para `/funcionario` só acontece depois de o app confirmar que não há sessão do dono; dono logado fica no app dele. Sem mudança no banco. Teste `src/test/dono-nao-desvia.test.tsx`) **O dono fica preso no app da equipe.** Se o celular já abriu o Omni Operação alguma vez, abrir o app do dono manda sempre para `/funcionario`, mesmo logado. O desvio acontece antes de o app conferir a sessão (`src/routes/index.tsx:479`, `:530-532`).
- [x] A2. (11/10/2026: `responder_pedido` mudada a partir da versão do banco; conta já paga mantém valor e vencimento na recusa; conta que já existe mantém valor e vencimento quando o fornecedor muda a resposta, que só preenche o que estiver vazio. Migração `20261011185148`. Teste `src/test/resposta-fornecedor-conta.test.ts`) **A resposta do fornecedor apaga a conta que o dono corrigiu.**
  - Quando o fornecedor "altera a resposta" pelo link, o banco recalcula o vencimento e troca o valor, até em conta já paga.
  - Na recusa, valor e vencimento somem mesmo com a conta paga; "desfazer pagamento" passa a dar erro.
  - Onde: `responder_pedido`.
- [x] A3. (11/10/2026: `funcionario_reposicao_concluir` mudada a partir da versão do banco; o acerto da gôndola usa a diferença da hora da contagem (contado − esperado), então vendas feitas enquanto o funcionário buscava continuam descontadas e não há diferença falsa. Teste `src/test/reposicao-vendas-meio.test.ts`) **A reposição devolve à gôndola o que foi vendido enquanto o funcionário buscava no depósito.**
  - O acerto usa o saldo da hora de "Coloquei", e não o da hora da contagem. Exemplo: contou 5, vendeu 2 no caixa, a gôndola fica com 2 a mais.
  - Com o caixa ligado, também cria uma diferença falsa.
  - Onde: `funcionario_reposicao_concluir`.
- [x] A4. (11/10/2026: `funcionario_enviar_recebimento` mudada a partir da versão do banco; ao concluir, produto conferido com validade vencida, sem data, sem lote na farmácia ou com lote que já existe com outra data volta para "Conte de novo" (amarelo) em vez de travar a entrega; decisão do dono. Sem tabela nova) (complemento 11/10/2026: o app da equipe mostra o motivo do 'Conte de novo') **Recebimento que nunca termina.** O conflito de lote/validade e o produto que venceu antes de concluir só aparecem no fim. A essa altura o item "Conferido" não pode mais ser corrigido pela equipe nem pelo dono (`_entrar_no_deposito`, `funcionario_enviar_recebimento`, `ReceberMercadoria.tsx:322-330`).
- [x] A5. (11/10/2026: o cancelamento tira da conta no máximo o que o cliente deve; já estava no banco, registrado na migração 20261011194500) **Cancelar uma venda fiado que o cliente já pagou cria um crédito escondido.**
  - O saldo fica negativo e a tela mostra "Em dia".
  - As próximas compras fiado somem da conta, e receber é recusado.
  - Onde: `_cancelar_venda_celular`, `src/lib/fiado.ts:31`.
- [x] A6. (11/10/2026: número reservado com trava no mesmo comando e índice único por comércio) **Dois caixas podem gerar o mesmo número de venda.** O número é lido sem trava e não há índice único. Conferido no banco oficial (`caixa_registrar_venda`).
- [x] A7 (11/10/2026: `caixa_registrar_venda` trava o turno e recusa com `turno_fechado` se já foi fechado; o app já mostra "Este caixa já foi fechado"). **Venda entra num caixa já fechado sem mudar a conta da gaveta.** O banco não confere se o turno está aberto, e o fechamento fica com números que não batem (`caixa_registrar_venda`).
- [x] A8 (11/10/2026: o caixa aberto busca de novo os produtos e preços a cada 2 min, ao voltar ao app e quando a internet volta, sem mexer no carrinho; sem internet mantém a lista guardada). **Preços e produtos do caixa não se atualizam com o caixa aberto.** O dono muda o preço e o celular continua vendendo pelo antigo; produto novo aparece como "sem cadastro" (`CaixaCelular.tsx:125`, `:132`).
- [x] A9 (11/10/2026: ao ligar a validade, a quantidade já contada aparece como "sem data" e as datas preenchidas são gravadas como pendência resolvida; `salvar_produto` marca o saldo sem lote como pendência ao ligar; desligar só é bloqueado quando a validade já estava ligada). **Ligar a validade num produto já contado perde as datas.**
  - O app pede as datas e diz que salvou, mas não grava.
  - Depois, preencher dá sempre "pendência já resolvida", e desligar a validade é bloqueado.
  - Onde: `persistencia.ts:36-41`, `:69`; `ProductArea.tsx:1116`, `:1122`; `validade.ts:146`.
- [x] A10 (11/10/2026: as validades que já vieram do banco numa área ainda sem contagem não bloqueiam mais a edição; só linhas novas pedem a contagem). **Produto com validade que recebeu mercadoria com o depósito em "Definir depois" não pode mais ser editado**, nem o nome nem o preço. Aparece um erro "remova essas linhas" sem botão para remover (`ProductArea.tsx:327`, `:353`, `:549-556`, `:618`; `persistencia.ts:302-307`).
- [x] A11 (11/10/2026: `decidir_perda` não cria diferença quando nada tinha saído do estoque; diferença de zero que já existia fecha ao tocar em salvar). **Perda recusada quando o sistema tinha 0 fica presa em "Diferenças para explicar".** Aparece "Explicação salva", mas nada é gravado, e o aviso nunca zera (`decidir_perda`, `PainelDiferencas.tsx:217`, `:307`).
- [x] A12. (resolvido pela correção R01, [PR #100](https://github.com/OmniSafe-360/mock-overlay-magic/pull/100): a tela "Busque no depósito" ganhou o botão Início e a reposição é retomada ao reabrir) **Repor: a tela "Busque no depósito" não tem botão de voltar.** Com PIN vencido, acesso encerrado ou envio repetido, o funcionário fica preso e só sai fechando o app (`ReporGondola.tsx:200-249`).

## Etapa B — números errados ou telas que confundem

- [x] B1. (11/10/2026, ver registro no fim) **"Valor informado pelo fornecedor" mostra o valor que o dono digitou.** A resposta e o pagamento usam a mesma coluna `valor_total` (`banco.ts:136-138`, `PainelPedidos.tsx:509`, `PaginaFornecedor.tsx:134`).
- [x] B2. (11/10/2026, ver registro no fim) **Pedido novo pode ser enviado sem o link do fornecedor.** Se a recarga logo depois de salvar falha, a mensagem sai sem link e o pedido é marcado como enviado (`OwnerHome.tsx:311-312`, `PainelPedidos.tsx:358`).
- [x] B3. (11/10/2026, ver registro no fim) **"Gerar novo link" pode deixar na tela o link antigo, que não vale mais** (`PainelPedidos.tsx:493`, `:593`).
- [x] B4. (11/10/2026, ver registro no fim) **Não dá para digitar quantidade quebrada (ex.: 2,5 kg).** A vírgula some ao digitar, tanto na página do fornecedor quanto na montagem do pedido (`PaginaFornecedor.tsx:313-314`, `PainelPedidos.tsx:384-385`).
- [ ] B5. **Trocar a embalagem na montagem do pedido muda muito a quantidade sem avisar.** Exemplo: 2 caixas de 12 viram 2 unidades (`PainelPedidos.tsx:393`).
- [ ] B6. **A conta estimada soma itens que o fornecedor disse que não tem.** Acontece quando ele aceita com ajustes e não informa o valor (`pagamento.ts:190-193`, `pedido.ts:176`).
- [ ] B7. **Boleto ou "a prazo" sem prazo informado vence no dia da entrega.** Aparece "Vence hoje" ou "Atrasado" numa conta a prazo (`PaginaFornecedor.tsx:191`, `:200`; `responder_pedido`).
- [ ] B8. **Dois funcionários contando a mesma entrega: o segundo perde o que contou.** O rascunho dele é descartado sem aviso (`ReceberMercadoria.tsx:267`, `funcionario_enviar_recebimento`).
- [ ] B9. **A busca por nome da equipe mostra no máximo 12 resultados**, contando cada tamanho e cor. Os outros tamanhos de roupa sem código ficam inalcançáveis (`funcionario_buscar_produto`).
- [ ] B10. **A tela inicial diz "Tudo certo!" com conta vencendo hoje ou alerta de antifurto** (`OwnerHome.tsx:549-555`).
- [ ] B11. **Dentro do comércio, os avisos de Vendas e Diferenças não se atualizam.** Nem o botão Atualizar nem voltar ao app trazem perdas e vendas sem cadastro novas (`OwnerHome.tsx:184`, `:449`, `:457-459`).
- [ ] B12. **A tela do comércio pode ficar presa em "Atualizando".** Se a atualização do resumo falhar depois de ligar uma venda ou resolver uma diferença, o botão fica girando e o cadastro de produto fica bloqueado (`OwnerHome.tsx:142-145`, `:176-177`, `:458`, `:460`).
- [ ] B13. (em andamento no plano ponta a ponta, etapa **E2.1**; o [PR #106](https://github.com/OmniSafe-360/mock-overlay-magic/pull/106) já bloqueou o envio duplo e a confirmação falsa; falta a perda de resposta e o 2º comércio aparecer sem recarregar) **Comércio salvo, mas a internet caiu na resposta: o dono fica travado.**
  - Ao tentar de novo: "já cadastrou um comércio com este CNPJ".
  - No primeiro cadastro não há como sair.
  - O 2º comércio só aparece depois de recarregar a página.
  - Onde: `StoreSetup.tsx:210-229`, `OwnerHome.tsx:62`.
- [ ] B14. **Depois de "Conferir envio", a loja volta ao ponto de entrada do alerta.** Reabre "Fazer pedido" ou a ficha do produto, e o dono perde o que estava vendo (`OwnerHome.tsx:217`, `:261`, `:443`, `:456`).
- [ ] B15. **Produto contado só numa área aparece como "não contado" e nunca entra em "Acabaram".** Ao mesmo tempo, a aba da área de venda mostra "acabou": as telas se contradizem (`situacao.ts:35`, `:94`; `ListaProdutos.tsx:117-123`).
- [ ] B16. **Caixa: diminuir a venda depois de escolher o pagamento deixa a tela Receber confusa.** Mostra "Troco" no Pix e "Finalizar venda" fica desligado sem explicar (`caixa.ts:100-105`, `CaixaCelular.tsx:588-613`).

## Etapa C — menores

- [ ] C1. **"Ligar o caixa" aparece como feito sem caixa ligado.** Conta caixas que só têm código gerado, ou que estão desligados (`OwnerHome.tsx:159`, `primeirosPassos.ts:26`).
- [ ] C2. **A tela "Não foi possível carregar seus comércios" não tem como sair da conta** (`src/routes/index.tsx:534-543`).
- [ ] C3. **"Faltou este mês" da aba Diferenças diverge do Relatório no dia 31.** A aba lê só os últimos 30 dias (`PainelDiferencas.tsx:52`, `:70`, `:84`).

## Pendências do checklist 1 (continuam valendo)

- [ ] D1. Dados para arrumar, com autorização do dono:
  - comércios de teste;
  - código do Arroz (falta o número certo);
  - Dipirona vencida na gôndola (registrar a perda pelo app);
  - 2 contagens abandonadas vazias. Apagar foi barrado pelo ambiente; fazer pelo painel do Supabase, ou deixar como está, porque são inofensivas.
- [ ] D2. Teste no celular de verdade, pelo dono: caixa no celular e Omni Operação no Android e no iPhone. Roteiro em [roteiro-teste-celular-2026-10-11.md](roteiro-teste-celular-2026-10-11.md).

- 11/10/2026: **B1 feito** — nova coluna `pedidos_compra.valor_fornecedor` guarda só o que o fornecedor informou (`responder_pedido` grava; recusa limpa; `pedido_publico` mostra esse valor). `valor_total` continua sendo o valor da conta a pagar. Pedidos já respondidos copiaram o valor atual. App lê `valor_fornecedor` na resposta. Precisa Publicar → Atualizar; falta o teste do dono.

- 11/10/2026: **B2 feito** — se a recarga depois de salvar falha, o app busca o link direto do pedido (`tokenDoPedido`); sem link, não abre o envio nem marca como enviado: avisa "O pedido nº X foi salvo, mas o link não carregou. Abra o pedido na lista para enviar." Sem mudança no banco. Precisa Publicar → Atualizar; falta o teste do dono.

- 11/10/2026: **B3 feito** — depois de "Confirmar novo link", o detalhe usa na hora o link devolvido pelo banco (copiar e enviar), mesmo se a recarga da lista falhar; falha da recarga não vira erro. Sem mudança no banco. Precisa Publicar → Atualizar; falta o teste do dono.

- 11/10/2026: **B4 feito** — novo campo `CampoQtd` guarda o que é digitado (com vírgula) enquanto o campo está em uso; usado na página do fornecedor ("Outra qtd.") e na montagem do pedido. Embalagem continua só número inteiro. Sem mudança no banco. Teste `src/test/campo-qtd.test.tsx`. Precisa Publicar → Atualizar; falta o teste do dono.
