# R01 — retomar a reposição ao reabrir o app

Entrega de **11/10/2026**, na etapa E1 do [checklist ponta a ponta](CHECKLIST_PONTA_A_PONTA.md). Regras em [FONTE_DA_VERDADE.md](FONTE_DA_VERDADE.md). Relacionada à limitação restante do item 5 do [checklist original](checklist-funcional-2026-10-11.md).

**Estado: corrigido no código; falta Publicar → Atualizar no Lovable e o teste do dono no app publicado.** O teste geral continua adiado conforme a decisão do dono. Entrega no [PR #100](https://github.com/OmniSafe-360/mock-overlay-magic/pull/100), correção `98638da`, branch `fix/r01-retomar-reposicao`.

## Problema confirmado

O PIN sobreposto já preservava a tela enquanto o app continuava aberto. Ao fechar completamente ou recarregar, porém, `ReporGondola.tsx` perdia a etapa, o número digitado e o ID da reposição. A proteção existente do banco contra reenvio depende de receber o mesmo ID e os mesmos dados; começar outra operação após perder esses dados não recuperava a anterior.

Três testes de fechamento foram executados antes da alteração e falharam: chegada ao local, contagem ainda não enviada e reposição após a contagem. A correção mantém o fluxo existente, sem mudar as regras de contagem ou transferência.

## O que mudou

- O aparelho guarda o produto/variação, a etapa, os números digitados e o ID da operação. Ao voltar a **Repor**, recupera a etapa anterior automaticamente, inclusive antes de enviar a contagem.
- Antes de chamar o banco, guarda os dados exatos do envio. Quando falta a resposta, mostra **Confirmar envio anterior**, mantém a quantidade bloqueada e pede para não contar ou levar mercadoria novamente. O reenvio usa o mesmo ID e os mesmos dados.
- Recusa definitiva do banco permite corrigir a quantidade. Falta de resposta ou erro ao guardar/limpar o registro mantém o envio anterior. Falha de armazenamento impede um novo envio; registro ilegível não é apagado silenciosamente.
- Cada acesso tem seu próprio registro, identificado pelo resumo da chave existente, sem copiá-la para o rascunho. Não guarda saldo esperado nem a lista de estoque. O PIN continua sendo exigido ao reabrir o app.
- Cliques repetidos são bloqueados. Web Locks, quando disponíveis, e a comparação da revisão guardada impedem que uma aba desatualizada sobrescreva ou envie a cópia antiga. Resposta atrasada também não substitui uma etapa mais recente.
- Zero colocado continua indicando contagem registrada, sem transferência. Uma operação já concluída não pede para buscar produto novamente. Nomes da farmácia e dos demais tipos continuam corretos ao retomar.

Implementação em `src/components/ReporGondola.tsx` e `src/lib/reposicaoLocal.ts`, usando a identificação de acesso e o tratamento de respostas incertas já existentes. Nenhuma função de negócio, tabela ou migração nova. As chamadas continuam sendo `funcionario_reposicao_contar` e `funcionario_reposicao_concluir`; RLS, permissões e a gravação de `operacoes` permanecem nas funções existentes.

## Verificações executadas

- `npx tsc --noEmit`: duas rodadas sem erros.
- `npx vitest run`: **846 testes em 74 arquivos**, aprovados em cada uma das duas rodadas. Incluem 18 cenários novos de retomada, sem retirar os testes anteriores de reposição/PIN.
- `npm run build`: aprovado.
- Chromium com serviços simulados, em **320 × 568** e **1280 × 900**: recarga em cada etapa, PIN ao reabrir, quantidade preservada, outra aba recusada e envio confirmado após perda da resposta. Sem corte horizontal ou erro de execução. Na simulação, depósito 20 → 15, gôndola 7 → 12 e **uma operação**, mesmo com o reenvio.
- Testes operacionais existentes em PostgreSQL 17 local descartável, com `docs/persistencia/teste/rodar_operacionais.sh --sem-catalogo`: migrações operacionais, conclusão repetida sem duplicar estoque/`operacoes`, RLS e recusas aprovadas. O catálogo externo foi omitido explicitamente nesse teste; não houve alteração ou envio de dados ao banco oficial.

Isso verifica a correção no código e os mecanismos existentes, sem declarar aprovação em Android/iPhone reais ou auditoria integral de produção. Os avisos do Supabase não foram reconsultados: não houve mudança no banco.

## Roteiro para o dono, depois de publicar

Use um produto separado para teste e anote a quantidade física no depósito e na gôndola. Não repita a movimentação física para testar um reenvio.

1. No Lovable, clique em **Publicar → Atualizar**. Abra o Omni Operação conectado à internet, entre com o PIN e toque em **Repor**.
2. Escolha o produto. Feche o app antes de contar e reabra. Entre com o PIN e toque em **Repor**: deve voltar ao mesmo produto e local.
3. Vá para a contagem, digite um número e feche antes de confirmar. Reabra, PIN → Repor: o número digitado deve continuar lá. Fechar, por si só, não envia contagem nem muda estoque.
4. Confirme a contagem. Pegue e coloque uma quantidade permitida **uma única vez**, digite o que colocou e feche antes de concluir. Ao reabrir, PIN → Repor deve mostrar essa mesma quantidade, sem pedir uma nova contagem.
5. Conclua e confira no sistema: o depósito diminui exatamente o que a gôndola recebe. Não deve aparecer outra transferência para a mesma reposição.
6. Se ocorrer falta de resposta durante o envio, reabra e use **Confirmar envio anterior**. Não conte nem leve produtos novamente. A quantidade fica bloqueada até o resultado desse envio; deve haver uma única transferência.

Registrar aparelho, navegador, data, versão publicada e resultado. **Resultado do dono: pendente. Publicação: pendente.** Não marcar R01/E1 como totalmente validados antes dessa evidência.

## Limites e próxima tarefa

A retomada funciona no **mesmo aparelho, navegador e acesso**, enquanto seus dados locais forem preservados. Limpar dados do navegador, trocar de aparelho/acesso ou usar outro navegador não transfere o rascunho. Operações que já haviam sido perdidas antes desta atualização não podem ser reconstruídas pelo registro novo. Reabrir o app instalado sem internet continua sendo o cenário separado **R05**; esta entrega não amplia a promessa de funcionamento offline.

Próxima correção: **R02 — verificar e proteger a concorrência entre pedido e recebimento em conferência**. Consultar a fonte da verdade e comparar as funções reais do banco com os arquivos antes de mudar SQL. R02 não foi implementado nesta entrega.
