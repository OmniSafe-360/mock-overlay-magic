# Checklist funcional 3 — análise ponta a ponta de 17/10/2026

Pedido do dono: "Faça uma análise ponta a ponta, veja o que está faltando para que o sistema fique 100% funcional e coerente".

Como foi feita a análise:
- Quatro revisões só de leitura, uma para cada área: dono e compras, app da equipe, caixa/vendas/fiado, painel e coerência entre telas.
- Cada revisão olhou o código e as funções do banco em vigor.
- Os achados mais graves foram conferidos no código antes de entrar aqui.

**Regra:** um item por vez, na ordem. Ao terminar um item, marcar `[x]` com a data e o que foi feito. Itens que mudam o banco seguem o roteiro abaixo:
1. Comparar com a versão do banco.
2. Simular com `begin … rollback`.
3. Testar num banco descartável.
4. Aplicar.
5. Conferir depois de aplicado.

Este arquivo não repete o que já está no [checklist ponta a ponta](CHECKLIST_PONTA_A_PONTA.md): publicação, testes no celular, dados de teste, piloto e etapas de segurança G0–G8.

## Etapa A — perde estoque ou dinheiro, ou trava

- [x] **A1. Lote vencido saía primeiro (F02).** — 17/10/2026.
  - **Problema:** na venda, na perda e no acerto de contagem para menos, o sistema dava baixa primeiro no lote vencido. O alerta "vencido à venda" sumia, mas o produto vencido continuava na prateleira.
  - **Correção:** migração `20261017043532_vencido_sai_por_ultimo.sql`.
    - Nova função interna `_tirar_saldo_ordem`, fechada para o app.
    - A ordem de saída passa a ser: lotes dentro da validade, o que vence primeiro sai primeiro (vence hoje ainda vale); depois os sem data; os vencidos por último.
    - Exceção: a perda com motivo "venceu" tira primeiro o que já venceu.
    - `_tirar_saldo` mantém a mesma assinatura. `_lancar_perda` teve só a linha da baixa trocada, conferindo o trecho.
  - **O que não mudou:** reposição (já não levava vencido) e cancelamento de venda (devolve ao mesmo lote).
  - **Verificação antes de aplicar:**
    - Antes: funções do banco iguais ao arquivo (md5).
    - Banco descartável: sem a correção o teste falha no 1º caso; com a correção passam os 7 casos de `docs/persistencia/teste/018_vencido_por_ultimo.sql` — baixa comum, vence hoje, perda quebrou/venceu, repetição, acerto de contagem, venda e cancelamento pelo caixa, funções fechadas. O teste entrou em `rodar_caixa_estoque.sh`, que o GitHub roda.
    - Banco oficial com `begin … rollback`: mesmo resultado e mesmas permissões, depois desfeito.
  - **Depois de aplicar:** funções iguais às testadas. Não havia nenhum saldo vencido no banco, então nenhum número atual mudou. Os avisos de segurança do Supabase continuam só com os tipos de sempre.
  - **Tela:** não muda. Não precisa Publicar.
  - **Falta:** o teste do dono, no final, com um produto de teste com dois lotes.
  - **Fica para outra etapa:** o limite do caixa ainda conta unidades vencidas como vendáveis; a sobra de uma contagem a mais pode cair num lote vencido (item C, raro).
- [x] **A2. Recebimento da farmácia preso em "Conte de novo".** — 17/10/2026.
  - **Problema:** quando o lote já estava cadastrado com outra validade (motivo `lote_outra_data`), a equipe recontava com os mesmos dados verdadeiros, o item era aceito e voltava de novo para "Conte de novo". O laço não tinha fim: a entrega nunca concluía e nada entrava no depósito.
  - **Correção no banco:** migração `20261017044457_recebimento_lote_outra_data.sql`. Troca só dois trechos do bloco A4 de `funcionario_enviar_recebimento`, conferindo o md5 e cada trecho antes de trocar.
  - **Como fica:** se o item já voltou uma vez por validade/lote, na segunda vez ele fica separado para o dono decidir ("inconsistente"), como as contagens que não batem. A entrega conclui e os outros produtos entram no depósito. A validade cadastrada do lote não muda. Se a equipe corrige a data na segunda vez, o item entra normalmente.
  - **Correção no app:** o texto da equipe passou a ser: "Se estiver certo, envie de novo sem mudar: o produto fica separado para o dono decidir" (`textoMotivo` em `src/lib/recebimento.ts`; teste `recebimento-motivo`).
  - **Verificação:**
    - Banco descartável: `docs/persistencia/teste/019_lote_outra_data.sql` tem 5 casos e falha sem a correção, na 2ª contagem igual. Ele entrou em `rodar_caixa_estoque.sh`, que o CI roda.
    - Banco oficial: simulação com `begin … rollback` deu o mesmo md5 e as mesmas permissões. Nenhuma entrega real estava presa nesse caso; as 4 contagens abertas são as vazias de teste da F-16H.
    - Depois de aplicar: a função ficou igual à testada e os avisos de segurança não mudaram.
    - Tipos 2×, 1.267 testes 2×.
  - **Publicação e testes:** precisa Publicar → Atualizar, por causa do texto. Falta o teste do dono, no final.
  - **Decisão do dono (achado do Codex no PR #189):** o produto separado por validade/lote mostra ao dono o motivo ("O lote AB1 já está no estoque com validade 16/12/2026, mas veio com outra data…") e o botão **Devolver** (`resolver_item_recebimento` com "recusar", que o banco já aceitava). Escolher contagem não aparece nesse caso, porque daria o mesmo erro. Os erros do banco ao decidir aparecem em português (`lote_com_datas_diferentes`, `recebimento_vencido_como_bom` e os de `mensagemErro`). `textoMotivoDono` e `validadeRecontar` em `src/lib/recebimento.ts`, `LinhaRecebida` em `PainelPedidos.tsx`. Teste `src/test/recebimento-lote-dono.test.tsx` (falha sem a correção). Tipos e 1.272 testes duas vezes. Sem mudança no banco.
  - **Completada na A3:** "Devolver" na contagem comum e contagem vencida.
- [x] **A3. Contagem de recebimento que não bateu 3 vezes.** — 17/10/2026.
  - **Problema:** o dono só podia escolher uma das contagens; não havia "Devolver". Se a validade passasse, aceitar dava erro e o item ficava pendente para sempre, com o erro em código.
  - **Correção no app (sem mudança no banco; `resolver_item_recebimento` já aceitava "recusar" em qualquer item separado):** todo produto separado na aba Pedidos tem o botão **Devolver**. A contagem cuja validade já passou aparece como "· vencida", não pode ser escolhida e mostra o aviso "Produto vencido não entra no estoque como bom: escolha outra contagem ou devolva" (`contagemVencida` em `src/lib/recebimento.ts`, `LinhaRecebida` em `PainelPedidos.tsx`). A tradução dos erros veio na A2.
  - **Verificação:** 2 testes novos em `src/test/recebimento-lote-dono.test.tsx`, que falham sem a correção; `recebimento.test.tsx` ajustado para o Devolver de cada produto. Tipos e 1.273 testes passaram duas vezes. Precisa Publicar → Atualizar; falta o teste do dono (no final).
- [x] **A4. Entrega parcial impossível.** — 17/10/2026. Decisão do dono: "Pedido espera o resto".
  - **Problema:** recebida metade, o pedido virava "recebido" e a segunda parte não podia entrar nele.
  - **Correção no banco:** migração `20261017111929_entrega_parcial.sql`, aplicada depois de comparar o md5 das 5 funções, testar em banco descartável e simular com rollback no oficial. Coluna nova `pedidos_compra.entrega_encerrada_em`; funções internas fechadas `_pedido_resto`, `_pedido_grupo_conta`, `_pedido_recebe_resto`; função do dono `encerrar_entrega_pedido`. Faltou produto → o pedido fica "recebido_parcial" e volta para a lista da equipe; a próxima entrega confere só o que falta; enquanto há produto separado para o dono decidir, a equipe não abre outra entrega (para não contar em dobro). Os 3 pedidos que já tinham entrega concluída ficaram como estavam (marcados como encerrados).
  - **Correção no app:** o detalhe do pedido mostra cada entrega ("Entrega 1 de 2") e o quadro "Falta chegar parte do pedido", com **Não vem mais nada** (com confirmação). O cartão diz "falta chegar o resto"; o "Atenção hoje" conta as decisões de todas as entregas (`entregasDoPedido`, `esperaResto` em `src/lib/pedido.ts`).
  - **Ajustes do Codex (PR #191):** produto que veio fora do pedido e espera o dono também impede outra entrega; o cartão da equipe conta só os produtos que faltam (migração `20261017114546_entrega_parcial_ajustes.sql`, aplicada depois de simular); produto que já chegou todo deixa de contar como "já pedido" e volta para Comprar quando for o caso (`produtosAindaPedidos` em `src/lib/pedido.ts`).
  - **Verificação:** `docs/persistencia/teste/020_entrega_parcial.sql` (5 cenários, falha sem a migração) em `rodar_caixa_estoque.sh`; `src/test/entrega-parcial.test.tsx` (3, falham sem a correção). Tipos e 1.275 testes 2×. Avisos do Supabase iguais. Precisa Publicar → Atualizar; falta o teste do dono (no final).
- [x] **A5. Gaveta com falta falsa.** — 17/10/2026.
  - **Problema:** ao cancelar no caixa uma venda de fiado já paga, o app manda devolver o valor ao cliente e o dinheiro sai da gaveta, mas o fechamento não descontava essa saída: aparecia falta que não existe.
  - **Correção no banco:** migração `20261017120231_devolucao_fiado_gaveta.sql`, aplicada depois de comparar o md5, testar em banco descartável e simular com rollback no oficial. `caixa_cancelar_venda` registra a devolução como dinheiro tirado da gaveta (`caixa_sangrias`, motivo "Devolvido ao cliente do fiado (venda nº X cancelada)") no caixa aberto de quem cancelou, na mesma transação; o fechamento já desconta o que foi tirado. Repetir o cancelamento não registra de novo. Nenhuma devolução antiga existia.
  - **Ajuste do Codex (PR #192):** se a resposta do cancelamento se perder e o caixa repetir, a resposta "repetida" traz de novo o valor a devolver e a saída da gaveta (id fixo por venda, nunca registra duas vezes). Migração `20261017120641_devolucao_fiado_repetida.sql`, aplicada depois de simular.
  - **Correção no app:** o caixa diz "Tire R$ X da gaveta e devolva ao cliente… Essa saída já foi descontada do caixa." (`textoDevolver`, campo `gaveta`).
  - **Verificação:** `docs/persistencia/teste/021_devolucao_fiado_gaveta.sql` (falha sem a migração) em `rodar_caixa_estoque.sh`; teste novo em `src/test/caixa.test.tsx`. Tipos e 1.279 testes 2×. Cancelamento pelo dono com o caixa aberto fica para a A6. Precisa Publicar → Atualizar; falta o teste do dono (no final).
- [x] **A6. Cancelamento pelo dono com o caixa aberto.** — 17/10/2026. Decisão do dono: "O caixa, da gaveta".
  - **Problema:** o dono cancelava pelo app uma venda do caixa aberto; o fechamento deixava de contar o dinheiro da venda, mas ninguém avisava o caixa para devolver ao cliente, e aparecia "sobra".
  - **Correção no banco:** migração `20261017122449_cancelamento_dono_caixa.sql`, aplicada depois de comparar o md5, testar em banco descartável e simular com rollback no oficial. `cancelar_venda_celular` trava o turno e, com o caixa aberto, responde `caixa_aberto` e `devolver_gaveta` (dinheiro da venda menos o troco, mais o que o cliente já tinha pago no fiado); a parte do fiado fica registrada como dinheiro tirado da gaveta (mesmo id fixo da A5). `caixa_estado` passa a trazer `cancelada_por` e `devolver_gaveta` de cada venda. Função interna fechada `_devolver_gaveta_venda`. Caixa já fechado: nada muda. Nenhuma venda antiga cancelada pelo dono existia.
  - **Correção no app:** o caixa vê "O dono cancelou a venda nº X. Tire R$ Y da gaveta e devolva ao cliente." com **Já devolvi** (guardado no celular); o caixa relê as vendas a cada 2 min, ao voltar ao app e quando a internet volta. O dono lê "O caixa foi avisado para tirar R$ Y da gaveta e devolver ao cliente."
  - **Verificação:** `docs/persistencia/teste/022_cancelamento_dono_caixa.sql` (falha sem a migração) em `rodar_caixa_estoque.sh`: fechamento bate depois das devoluções; repetir não tira de novo; caixa fechado não muda. 2 testes de tela em `src/test/caixa.test.tsx` (falham sem a correção). Tipos e 1.281 testes 2×. Precisa Publicar → Atualizar; falta o teste do dono (no final).
- [ ] **A7. "Recebeu pagamento" do fiado no caixa lê o ponto como milhar.** "15.5" vira R$ 155; "15.50" vira R$ 1.550.
- [ ] **A8. Caixa preso aberto.** Se o dono desliga o "Caixa" do funcionário (ou o bloqueia) com o caixa aberto, ninguém consegue fechar.
- [ ] **A9. Fila do caixa travada.** Recusas fora da lista de definitivas (`turno_fechado`, limite/bloqueio do fiado, comércio desativado) travam a fila e impedem fechar o caixa.
- [ ] **A10. Contagem de recebimento abandonada.** O dono não tem como encerrar, e o pedido fica bloqueado.

## Etapa B — número errado ou tela incoerente

- [ ] **B1.** "Repor" da equipe ≠ "Para repor" do dono. O contador da equipe também não bate com a lista dela.
- [ ] **B2.** Produto "já pedido" continua como "Comprar" na lista de Produtos e em Fornecedores.
- [ ] **B3.** "Para repor"/"Para comprar" das abas Depósito e Gôndolas ≠ Início e Atenção hoje.
- [ ] **B4.** "Novo pedido" e o quadro "Comprar" sugerem produtos diferentes, nos dois sentidos.
- [ ] **B5.** Conta a pagar não acompanha a alteração da resposta do fornecedor (valor e vencimento).
- [ ] **B6.** "Corrigir vencimento ou valor" promete um valor e usa outro.
- [ ] **B7.** Cadastrar de novo um comércio que já existe aparece como "adicionado" e ele entra em dobro na lista.
- [ ] **B8.** Mercadoria recebida fica invisível quando o produto não tem área de depósito.
- [ ] **B9.** Contagem do depósito começada em outro dia volta a ser retomada (desfaz o item 8 do checklist 1).
- [ ] **B10.** Item "não controlar" (sacola, serviço) não pode ser vendido no caixa do celular.
- [ ] **B11.** Erros do recebimento de fiado no caixa sem tradução; o mesmo código de envio é reaproveitado e o funcionário fica preso.
- [ ] **B12.** Omni Conector: roupa sem tamanho gera "faltou" falso; cancelamento de nota antiga cria uma venda cancelada fantasma.
- [ ] **B13.** Tocar num produto em Alertas às vezes abre a lista em vez da ficha.
- [ ] **B14 (decisão do dono).** A reposição revela à equipe quanto há no depósito, o que enfraquece a contagem cega.

## Etapa C — textos e detalhes

- [ ] **C1.** "Depósito"/"gôndola" escritos fixos onde farmácia, roupas, construção e autopeças dizem "Estoque"/"Área de venda". Aparece no app da equipe, em Diferenças, em Pedidos, nos Primeiros passos, na Equipe e no caixa.
- [ ] **C2.** Pedido recusado ainda mostra os produtos como "confirmado"/"vai mandar".
- [ ] **C3.** Página do fornecedor contraditória quando a recarga falha logo depois de responder.
- [ ] **C4.** "Seus dados continuam no formulário" em ações sem formulário (cancelar, pagar).
- [ ] **C5.** Relatório antifurto com erro, sem botão "Tentar de novo".
- [ ] **C6.** Números do dia que não viram à meia-noite (aba Produtos; Vendas hoje/Faltou com um comércio aberto).
- [ ] **C7.** PIN do fiado do cliente: depois da primeira trava, um erro já trava de novo, com a mensagem "0 tentativas".
- [ ] **C8.** Conferir depósito: Voltar não atualiza a lista depois de um envio sem resposta.
- [ ] **C9.** Recusas do banco com tradução errada ou ausente (`quantidade_grande_demais`, `itens_demais`, `valor_maior_que_a_conta` etc.).
- [ ] **C10.** Sobra de contagem pode cair num lote vencido (raro; mesma família da A1).
