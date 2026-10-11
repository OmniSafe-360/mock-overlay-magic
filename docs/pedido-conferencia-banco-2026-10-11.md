# E1/R02 — pedido protegido durante a conferência

Correção autorizada em 11/10/2026 sobre o `main` `51232f2069a85b2dcf2bf561d8c6ccfef0bf425f` (PR #100). **Corrigido no código e aplicado no Supabase oficial; falta Publicar → Atualizar no Lovable e o teste do dono no app publicado.** Próxima correção: R03, mostrar falha de consulta do fiado.

## Problema comprovado e resultado

O item antigo 11 esconde os controles quando a tela identifica a contagem, mas uma aba antiga ainda podia enviar a ação. Antes desta correção, o teste local abriu uma conferência e `cancelar_pedido` aceitou o cancelamento: a recusa esperada `recebimento_em_contagem` não existia.

Agora cancelar, marcar como enviado, renovar o link e responder pelo fornecedor recusam alterações enquanto há recebimento em `contando`. A verificação ocorre **depois do bloqueio do pedido na transação**, o mesmo bloqueio usado para abrir a conferência. Se outra ação estiver terminando, a segunda conexão espera e confere o estado atualizado. Pedido recebido/parcial/cancelado também não permite renovar o link.

O link continua legível durante a contagem e explica por que não permite responder. Um formulário antigo recebe a recusa em português. O reenvio pelo dono só anuncia “Marcado como enviado” depois da confirmação do banco; a recusa de conferência pede para esperar terminar. A abertura do WhatsApp ou a cópia do texto já realizada no aparelho não é desfeita pela recusa do banco.

Pagamento continua independente da entrega. A equipe conclui pela mesma função de recebimento; repetir os mesmos dados não faz nova entrada de estoque. Nenhuma tabela, função de negócio ou etapa de trabalho foi criada.

## Banco: comparação, simulação e aplicação

Migração: [20261011144500_pedido_em_conferencia.sql](../supabase/migrations/20261011144500_pedido_em_conferencia.sql). Projeto oficial: `bvwjprxfthhreuhovgbk`.

Antes da alteração, as oito funções consultadas coincidiam com os arquivos mais recentes. As cinco alteradas também tinham o corpo idêntico, incluindo comentários/espaços. A migração confere todas as cinco definições antes de substituir qualquer uma; uma divergência interrompe a aplicação.

| Função existente | Hash do corpo antes | Mudança |
|---|---|---|
| `cancelar_pedido(uuid)` | `aed6ad8953922d5a3fea8372a4781a9f` | Recusa durante contagem |
| `marcar_pedido_enviado(uuid,text)` | `844e85c840e78378a31680c088ca3b7e` | Recusa durante contagem |
| `novo_link_pedido(uuid)` | `f67a0465b14ff32b6fda431e78069114` | Recusa durante contagem e após fechamento |
| `responder_pedido(text,jsonb)` | `8f130cb124efdb8c0c501b44a3c668ee` | Recusa durante contagem |
| `pedido_publico(text)` | `8b501e00fe8a235d7010a48d1b25953c` | Informa contagem e impede nova resposta na página |

`funcionario_abrir_recebimento`, `funcionario_enviar_recebimento` e `_fechar_pedido_recebido` foram comparadas e permaneceram intactas.

A simulação oficial usou `begin … rollback`, sem a palavra proibida pelo dono no SQL. Substituiu temporariamente as funções, verificou corpos, permissões, RLS, políticas e recusas de acesso/link inválido, e desfez tudo. A fotografia após o rollback ficou exatamente igual à anterior. **Sem criação de comércio, funcionário, pedido ou estoque de teste no banco oficial.** Os cenários completos com dados e duas conexões foram executados somente no banco local descartável.

A aplicação oficial substituiu as cinco funções e registrou a versão `20261011144500`, nome `pedido_em_conferencia`, na mesma transação. Depois, os cinco corpos conferiram com o arquivo; as permissões das oito funções, as políticas e a RLS das **35 tabelas públicas** ficaram iguais. No banco oficial, pedidos têm privilégios de tabela, mas apenas política de leitura; não há política de escrita direta nas quatro tabelas consultadas (`pedidos_compra`, `pedido_itens`, `recebimentos`, `saldos`). Não confundir isso com ausência de privilégio de tabela: o banco local de testes também restringe os privilégios.

**Limitação da consulta de avisos:** as consultas aos avisos de segurança e desempenho, antes e depois, retornaram HTTP 403, por falta da permissão `advisors_read` no token disponível. Não foi comprovada ausência de avisos novos pelo painel. RLS, políticas, permissões e definições foram conferidas diretamente; a lista automática do painel continua pendente de acesso autorizado. Não remover permissões gerais das funções para eliminar avisos já intencionais.

## Verificações executadas

- `npx tsc --noEmit` e `npx vitest run`: **duas rodadas aprovadas, 851 testes em 74 arquivos em cada uma**. `npm run build` aprovado. Cinco testes novos cobrem a página em contagem, formulário antigo, recusa do reenvio nas duas formas de erro e confirmação atrasada; o teste existente do fluxo normal espera a confirmação antes de clicar em “Pronto”.
- [Teste SQL funcional](persistencia/teste/013_pedido_em_conferencia.sql): cancelamento aceito antes da correção; após a correção, todas as recusas esperadas, nenhum pedido/item/link/conta alterado por recusa, pagamento independente, recebimento concluído e repetido com estoque 5 e uma operação, isolamento e RLS.
- [Teste de concorrência](persistencia/teste/014_pedido_concorrencia.py): **13 disputas com duas conexões PostgreSQL reais**; o teste observa a espera por bloqueio, não apenas chamadas sucessivas. Abrir/concluir contra as quatro ações; cancelar/recusar antes de abrir; ajuste de quantidade antes da abertura; link renovado contra resposta antiga; abertura desfeita permite cancelamento sem recebimento órfão. Sem deadlock, alteração parcial ou entrada duplicada nos cenários verificados.
- [Roteiro operacional](persistencia/teste/rodar_operacionais.sh) em PostgreSQL 17 local descartável, com `--sem-catalogo`: cadeia de migrações, simulação antes da aplicação, recusa de versão divergente sem substituir nenhuma das cinco funções, testes funcionais e concorrentes aprovados. A importação HTTP do catálogo externo foi a exclusão explícita; ela não participa desta correção.
- Chromium com serviços simulados em **320 e 1280 px**: link em contagem legível/sem resposta, formulário antigo recusado em português sem sucesso falso e recebido somente leitura. Sem corte horizontal ou exceção de tela. Nenhuma gravação no Supabase real pelos testes de navegador.

Esses resultados não substituem publicação, testes em aparelhos reais nem a validação conjunta das etapas E2–E8. R02 permanece com `[ ]` para o teste do dono.

## Roteiro do dono, após publicar

Usar um pedido destinado à validação; não mudar uma entrega real só para testar.

1. No Lovable, clicar em **Publicar → Atualizar**. Abrir o pedido no acesso do dono e manter uma aba antiga com a confirmação de cancelamento ou reenvio aberta; manter também o link do fornecedor aberto antes da contagem.
2. Em outro acesso/aparelho, a equipe inicia a conferência dessa entrega. Na aba antiga, tentar cancelar, reenviar ou renovar link. Deve explicar que a equipe está conferindo e recusar; pedido, link, quantidades e conta devem permanecer iguais. Quando atualizar, os controles devem sumir, como no item 11.
3. No formulário antigo do fornecedor, tentar responder. Deve recusar sem dizer que a resposta foi salva. Ao recarregar o link, deve mostrar a conferência em andamento e permitir apenas consultar o pedido.
4. A equipe termina a conferência. Conferir depósito e histórico: uma entrada, mesmo que precise repetir o envio após uma resposta perdida. O pedido passa a recebido/parcial conforme a entrega; link permanece somente leitura. Pagamento continua com seu próprio estado.
5. Informar o aparelho, pedido usado e resultado de cada caso. Só então registrar a validação do dono no checklist.
