# E2.1 — cadastro de comércio com confirmação coerente

Correção de **11/10/2026**, sobre `main` `2b7cb57` (PR #105), branch `fix/e21-cadastro-confirmacao`. Entrega no [PR #106](https://github.com/OmniSafe-360/mock-overlay-magic/pull/106), correção `9edf169`. Parte de E2.1 do [checklist ponta a ponta](CHECKLIST_PONTA_A_PONTA.md); regras em [FONTE_DA_VERDADE.md](FONTE_DA_VERDADE.md). Publicação e teste do dono ainda pendentes. E2.1 continua aberta.

## Falhas comprovadas

Cinco testes falharam antes da mudança: era possível voltar, editar ou cancelar durante o salvamento; dois envios no mesmo evento iniciavam duas inserções; a confirmação do primeiro comércio dizia “Modo de demonstração: nenhum dado foi salvo”; resposta sem ID passava pela confirmação; sair da tela enquanto a sessão era consultada ainda permitia iniciar a inserção depois.

Esses testes reproduziram o comportamento da interface com serviços simulados. Não criaram comércios reais nem comprovaram duplicidade efetivamente aceita pelo banco oficial.

## O que mudou

- Enquanto salva, o formulário bloqueia envio repetido, Voltar, Editar e Cancelar, inclusive antes de o estado visual atualizar.
- A sessão precisa corresponder ao dono que abriu o cadastro. Ausência/troca de sessão recusa o envio com orientação. O primeiro cadastro reinicia ao trocar usuário.
- Somente uma resposta sem erro e com ID preenchido confirma o cadastro. A mensagem agora diz **“Cadastro salvo na sua conta.”**; painel e confirmação recebem os mesmos dados normalizados enviados.
- Erros liberam os controles e mantêm os campos preenchidos. O aviso fica no fluxo da tela, sem sobrepor os botões no celular.
- Desmontar a tela durante a consulta de sessão impede iniciar uma gravação atrasada. Resposta de uma inserção já iniciada não chama a tela antiga; isso não cancela uma operação já recebida pelo servidor.

O cadastro existente, a revisão dos dados antes de enviar e a inserção em `comercios` foram preservados. Nenhuma migração, tabela, função de negócio ou dado real foi alterado. Banco/RLS/avisos não reconsultados nesta entrega; pendência administrativa de R02 preservada.

## Verificação

- **13 testes novos**, cobrindo os cinco defeitos, sessão ausente/diferente/com erro, documento repetido, falha de envio, dados revisados, resposta atrasada depois de desmontar e ID ausente/vazio.
- **43 testes focados** de salvamento, CEP, sessão do dono, carga e navegação do comércio aprovados. Itens antigos 15, 23 e 24 preservados.
- `npx tsc --noEmit` e `npx vitest run`, **ambos duas vezes**: **937 testes em 79 arquivos**, sem erros. `npm run build` aprovado.
- Chromium com build de produção em **320 × 900 e 1280 × 900**: oito roteiros de primeiro cadastro, comércio adicional, erro de documento e sessão diferente. Revisão antes de salvar preservada; um envio mesmo ao disparar dois submits durante a espera; controles bloqueados/liberados conforme o resultado; confirmação/painel com nome correto. Avisos e botões cabem nas telas verificadas, sem corte horizontal ou exceção. Auth/Supabase/CEP simulados; nenhuma escrita real.
- Dois roteiros extras em **320 × 568**: erro de documento e sessão diferente, com campos preservados, Cancelar/Editar disponíveis e aviso/botões dentro da tela. Imagens de sucesso e erros inspecionadas após a animação.
- Adaptador HTTP local da saída de produção fora do checkout, sem mudança em scripts ou dependências. Testes simulados não comprovam RLS efetiva, entrega de resposta pelo serviço real ou uso no app publicado.

## Limites e próxima tarefa

O bloqueio cobre envios simultâneos neste formulário. Perda da resposta depois de o banco gravar, retomada após recarregar/fechar e cadastro em duas abas **ainda precisam ser investigados em E2.1**; não se afirma idempotência nesses cenários.

Não foi encontrado um editor de comércio já cadastrado na interface; “Editar” desta entrega é a revisão anterior ao cadastro. Registrar essa diferença do critério de E2.1 e discutir o desenho antes de acrescentar uma função nova. Não implementar um editor silenciosamente.

Serviços reais, publicação, aparelhos e aceite geral continuam pendentes. O teste geral segue adiado por decisão do dono.

## Roteiro do dono depois de publicar

1. No Lovable, clicar em **Publicar → Atualizar**.
2. No próximo cadastro de comércio que realmente precisar fazer, revisar os dados e tocar em **Cadastrar meu comércio**. Enquanto aparece “Salvando...”, os controles devem ficar bloqueados; ao concluir, o nome correto deve aparecer no painel. No primeiro comércio, a confirmação deve dizer que o cadastro foi salvo.
3. Se aparecer erro, os dados devem continuar preenchidos e os botões devem permitir corrigir ou sair. Informar a mensagem e o aparelho usado. Não criar comércios reais extras apenas para testar.

**Próxima tarefa independente:** continuar E2.1 verificando perda de resposta e retomada do cadastro antes de escolher a próxima correção. E1/E6 e demais cenários de E2.1 permanecem abertos.
