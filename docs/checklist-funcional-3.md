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
  - **Depende da A3:** o dono ainda não tem o botão "Devolver" nem o texto do motivo para decidir esse produto separado.
- [ ] **A3. Contagem de recebimento que não bateu 3 vezes.** O dono só pode escolher uma contagem: não há "Devolver". Se a validade passar, o item fica pendente para sempre, e o erro aparece em código, sem tradução.
- [ ] **A4. Entrega parcial impossível.** Recebida metade, o pedido vira "recebido" e a segunda parte não pode entrar nele.
- [ ] **A5. Gaveta com falta falsa.** O dinheiro devolvido ao cliente do fiado no cancelamento sai da gaveta, mas não é descontado do esperado.
- [ ] **A6. Cancelamento pelo dono com o caixa aberto.** Gera "sobra" falsa, e o caixa não avisa para devolver o dinheiro.
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
