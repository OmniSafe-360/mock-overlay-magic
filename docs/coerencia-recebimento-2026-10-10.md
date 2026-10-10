# Coerência do recebimento e da reposição — 10/10/2026

O dono mostrou os prints do Kapo 200 ml e autorizou corrigir as incoerências entre contagem, conferência da entrega, entrada no depósito e reposição. Os prints estavam fora de ordem e não mostravam a conclusão da entrega. Eles não comprovam perda de estoque.

## O que mudou

- O botão mostra **Enviar contagens** enquanto faltam produtos, **Conferir e concluir entrega** quando tudo foi contado e **Confirmar envio anterior** quando a resposta se perdeu. Enviar uma parte continua permitido e não significa entrega concluída.
- O aviso de recontagem vem dos estados atuais. Depois de guardar uma nova contagem, aparece **Nova contagem pronta para enviar**, sem o aviso antigo; os produtos que faltam continuam indicados.
- **Conferido** é somente um item aceito pelo banco. A tela explica que a quantidade aguarda a conclusão da entrega para entrar no depósito. **Inconsistente** e **fora do pedido** aparecem aguardando decisão do dono; **recusado** não aparece como conferido. Não se mostram números esperados.
- Respostas antigas sem os estados são consultadas pelo recebimento aberto. Se essa consulta falhar, a tela informa **Contagem enviada**, sem inventar aceite e sem reenviar automaticamente uma operação já confirmada.
- A conclusão da entrega informa que somente produtos bons e aceitos entram no depósito. A mensagem não afirma que todos os itens conferidos, inclusive avariados e pendentes, entraram no estoque.
- Sem reposição, aparece **Contagem registrada. Reposição não realizada**, em amarelo. O verde e **Reposição concluída** ficam para transferência positiva. A indicação acima do sugerido não afirma que faltou espaço: o depósito também pode limitar a sugestão.
- O banco passa a informar o motivo da indisponibilidade: entrega em conferência, produto aguardando liberação ou sem validade disponível, depósito sem estoque ou depósito ainda não contado. Quantidade desconhecida não é tratada como zero.
- Toda recontagem pendente no recebimento bloqueia sua conclusão, inclusive produtos ausentes do último envio. Antes, o banco verificava apenas as recontagens daquele envio e podia concluir com uma recontagem anterior em aberto.

Cadastro, detalhes, preços, embalagens, cálculo de compra somente pelo depósito, limites, validação de validade, operação permanente de estoque e reenvio exato permanecem com as regras existentes.

**Critério de recebimento preservado:** aceita quando o total bate com o pedido ou repete uma tentativa anterior; três números diferentes sem nenhum bater viram inconsistência para o dono. Sem pedido para comparar, aceita a quantidade informada. A documentação foi alinhada ao critério existente, sem mudar essa regra do banco.

## Banco e publicação

Migração: `supabase/migrations/20261010183000_coerencia_recebimento.sql`. Altera três RPCs existentes e acrescenta um helper interno sem acesso para visitante ou usuário comum. Não altera tabelas nem estoque antigo. As respostas para a equipe incluem apenas identificação e situação, nunca quantidade esperada.

**Preparada e testada, ainda não aplicada ao Supabase:** este ambiente não tem a conexão administrativa com o projeto oficial. A correção das recontagens omitidas e os motivos detalhados dependem dessa aplicação. Até lá, a interface aceita as respostas antigas e usa uma mensagem genérica quando não recebe o motivo. Os avisos de segurança e desempenho do Supabase também não foram consultados neste ambiente.

Após aplicar a migração e mesclar o código, publicar pelo Lovable em **Publicar → Atualizar**.

## Validação

- `npx tsc --noEmit` e `npm run build` aprovados.
- 742 testes em 69 arquivos passaram duas vezes após os ajustes; 16 novos casos cobrem estados, mensagens, resposta antiga, indisponibilidade e ausência de falso sucesso.
- PostgreSQL 17 descartável: `bash docs/persistencia/teste/rodar_operacionais.sh --sem-catalogo`, com as migrações operacionais e transações de teste desfeitas. A opção explícita dispensa somente as três migrações do catálogo externo, que exigem a extensão HTTP e não participam do estoque.
- Falha original reproduzida substituindo temporariamente, apenas na base descartável, o corpo de `funcionario_enviar_recebimento` pela versão anterior: o teste de envio apenas do bicarbonato falhou porque ignorava a recontagem do Kapo. Com a migração nova, passou.
- Cenário de banco: pedido de 50 Kapo + 5 bicarbonatos; Kapo 110; envio somente dos 5 bicarbonatos; Kapo 0; Kapo 50. A entrega continua aberta até resolver a recontagem; nenhum estoque entra parcialmente. A conclusão registra 50 e 5 uma vez. Reposição de 50 Kapo deixa depósito 0 e venda 50, conserva validade e fecha com o histórico. Reenvios não duplicam entrada nem transferência.
- Três tentativas divergentes, confirmação por repetição de zero, estoque vencido, estoque desconhecido, respostas cegas, outro comércio, outro dono e permissões também foram verificados.
- Chromium em 320 × 568 e 1280 × 900, com respostas e escritas simuladas: contagem, recontagem, envio parcial, conclusão da entrega, indisponibilidade e reposição positiva. Sem exceções de tela ou rolagem horizontal.

## Teste do dono depois de aplicar e publicar

1. Abrir uma entrega com dois produtos. Contar só um: o botão deve dizer **Enviar contagens**. Após enviar, a entrega permanece aberta e esse estoque ainda não está disponível para repor.
2. Quando pedir recontagem, abrir o produto: o campo deve começar vazio. Guardar a nova contagem: o aviso antigo deve desaparecer e aparecer **Nova contagem pronta para enviar**.
3. Contar o outro produto ou marcar **Não veio**. Enviar, resolver as recontagens indicadas e concluir a entrega. Item aguardando decisão do dono deve ficar separado, sem aparecer como conferido nem entrar no estoque.
4. Tentar repor antes e depois da conclusão. Sem estoque disponível, deve explicar o motivo e registrar apenas a contagem. Com produto liberado no depósito, deve indicar quanto buscar e confirmar reposição apenas após informar o que foi colocado.
5. Conferir no app do dono: depósito diminui pelo que foi reposto; área de venda aumenta pelo mesmo valor; validade continua igual; repetir um envio não duplica estoque.
