# E1/R04 — falha ao guardar contagem de recebimento visível

Entrega no [PR #103](https://github.com/OmniSafe-360/mock-overlay-magic/pull/103), correção `f7453a2`. Correção autorizada em 11/10/2026 sobre o `main` `8ccc857f7dd7376698ed2617801efcc5acb4e981` (PR #102), branch `fix/r04-recebimento-rascunho`. **Pronto, falta Publicar → Atualizar no Lovable e o teste do dono no app publicado.** Próxima tarefa: **R05 — verificar a reabertura do Caixa sem internet em aparelhos reais**, junto de E6/item antigo 29. R05 ainda é um cenário a verificar, não uma falha já comprovada em produção.

## Problema comprovado e resultado

Três testes reproduziram as falhas antes da correção: contagem com gravação recusada por armazenamento cheio sem aviso; rascunho ilegível tratado como ausente e substituído; armazenamento inacessível tratado como ausência de rascunho, chegando a abrir uma entrega no servidor.

`guardarRascunho` agora informa falha e confere a leitura do texto gravado antes de considerar a gravação aprovada. Na contagem aparece **“Não foi possível guardar a contagem neste aparelho”**, explicando que as últimas alterações podem se perder ao sair/fechar. O aviso também aparece na ficha aberta do produto. **Tentar guardar de novo** tenta apenas guardar os números atuais no aparelho; não envia mercadoria ao servidor. Uma gravação conferida limpa o aviso.

Rascunho inexistente, ilegível e armazenamento inacessível são situações distintas. O app valida o formato dos produtos, contagens, estados e rodada antes de usar os dados. Se não consegue recuperar, avisa e preserva os bytes existentes, sem criar outra entrega nem sobrescrever a contagem. Nenhuma limpeza automática foi acrescentada. Se a leitura inicial da tela falha após a abertura no servidor, a tela também não substitui dados que não recuperou; é necessário voltar às entregas e reabrir após resolver o acesso ao armazenamento. Um envio novo fica bloqueado nessa situação.

**Rascunho e fila de envio continuam separados:** a fila em `operacaoLocal` mantém os dados originais de um envio sem resposta. Falhar ao guardar mudanças posteriores do rascunho não altera essa fila; a confirmação repete o mesmo recebimento, rodada e itens. Se o armazenamento da fila também falha, nenhum envio novo sai. Um rascunho ilegível impede sua abertura e mantém o envio pendente intacto; não é descartado para iniciar outro.

Separação por acesso, pedido e fornecedor, incluindo **“Não sei”**, chave antiga, conferência cega, rodada, produtos já conferidos e proteção contra aba antiga dos itens 9–10 preservadas. A abertura avulsa continua guardando seu ID antes da rede. Os números ainda em edição na ficha seguem dependendo de **Salvar contagem**, como no fluxo existente; esta entrega não acrescenta salvamento automático de um formulário ainda não confirmado.

Nenhum SQL, tabela, função de negócio, regra de estoque ou dado real alterado. Banco e avisos do Supabase não foram reconsultados nesta entrega; a limitação da consulta de avisos registrada em R02 permanece.

## Verificações executadas

- **20 testes novos** em [recebimento-rascunho.test.tsx](../src/test/recebimento-rascunho.test.tsx): armazenamento cheio/inacessível; escrita sem conservar o texto; aviso na ficha; nova tentativa com os números atuais; fechamento e recuperação da última gravação aprovada; JSON ilegível e formato inválido sem descarte; separação por pedido/fornecedor/acesso; abertura avulsa sem ID guardado recusada; fila pendente preservada e reenvio dos dados originais; falha da fila recusando envio; falhas de leitura durante a contagem, no envio avulso e após a abertura no servidor sem derrubar a tela ou substituir dados não lidos.
- **61 testes focados aprovados**, incluindo as regras e telas existentes de recebimento, fornecimento avulso e operação local. Tipos dos testes corrigidos durante o desenvolvimento; nenhum teste removido ou desligado.
- `npx tsc --noEmit` e `npx vitest run` passaram **duas vezes**, com **879 testes em 76 arquivos** em cada rodada. `npm run build` aprovado.
- Chromium em **320 e 1280 px**, com todas as chamadas ao Supabase interceptadas: aviso na lista/ficha, botão de nova tentativa, gravação recuperada, PIN após recarga, retomada da contagem salva e confirmação anterior usando os mesmos dados. Duas chamadas de envio geraram uma única operação **na simulação**. Rascunho ilegível preservou a fila original sem abrir outra entrega. Sem corte horizontal/exceção de tela; ficha dentro da altura disponível.

Esses resultados não comprovam publicação, fechamento real do aplicativo instalado ou o funcionamento geral das etapas E2–E8. R04 permanece com `[ ]` até publicação/aceite do dono.

## Roteiro do dono, após publicar

Usar uma entrega destinada à validação, sem contagens fictícias de mercadoria real.

1. Clicar **Publicar → Atualizar** no Lovable. No app do funcionário, entrar pelo PIN, abrir **Receber mercadoria**, contar um produto e tocar **Salvar contagem**. Fechar/reabrir com internet, entrar pelo PIN e abrir a mesma entrega: a contagem gravada deve voltar.
2. Em um aparelho de teste com armazenamento de rascunho bloqueado/cheio, conferir o aviso de que as últimas alterações podem se perder, inclusive na ficha. Não fechar a tela esperando recuperar o que não conseguiu guardar. Resolver o armazenamento sem apagar dados do app e tocar **Tentar guardar de novo**; o aviso deve sair somente após a gravação conferida. Esse botão não envia a entrega.
3. Não provocar corrupção nem limpar armazenamento no aparelho que tenha envios reais pendentes. O caso ilegível já foi simulado: deve avisar, manter a mercadoria separada e preservar rascunho/fila para análise, sem começar outra entrega silenciosamente.
4. Conferir uma entrega avulsa de um fornecedor e outra em **Não sei**: não devem misturar as contagens. Envio sem resposta deve mostrar **Confirmar envio anterior**, sem oferecer descarte. Ao confirmar, conferir um único recebimento/estoque no painel do dono.
5. Informar aparelho, entrega usada e resultado para registrar o aceite. A abertura do Caixa instalado após fechar sem internet pertence à próxima tarefa R05; não foi aprovada por esta entrega.
