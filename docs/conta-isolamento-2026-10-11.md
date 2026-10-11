# E2.1 — isolamento da conta durante o carregamento

Correção de **11/10/2026**, sobre `main` `d6ad326` (PR #104). Entrega no [PR #105](https://github.com/OmniSafe-360/mock-overlay-magic/pull/105), correção `cb572a3`. Parte de E2.1 do [checklist ponta a ponta](CHECKLIST_PONTA_A_PONTA.md); regras em [FONTE_DA_VERDADE.md](FONTE_DA_VERDADE.md). **Pronto no código, falta publicação e o teste do dono.** E2.1 permanece aberta para os demais cenários.

## Falha comprovada

O carregamento da conta usava um indicador compartilhado, sem distinguir as entradas. Ao trocar de A para B, uma consulta de A que terminasse depois podia substituir o perfil ou a lista da tela atual. Uma sessão inicial ou entrada agendada podia também abrir A depois da saída. A entrada direta de B era ignorada enquanto o indicador de A continuava ligado.

Cinco testes falharam no `main` anterior, em checkout separado: troca direta A → B, perfil atrasado após sair/entrar, lista atrasada, sessão inicial atrasada depois de sair e entrada agendada seguida de saída. A simulação de leitura sem filtro considera a sessão ao iniciar a consulta, como a RLS; o defeito está na aplicação de respostas antigas na tela. Isso não comprova exposição de dados pelo banco, cujas políticas não foram alteradas.

## O que mudou

- Trocar de conta, sair ou iniciar recuperação invalida consultas e agendamentos da entrada anterior. Perfil e comércios só chegam à tela se pertencerem à entrada atual, inclusive A → B → A.
- A consulta inicial de comércios também filtra `dono_id` pelo usuário atual, mantendo a RLS existente.
- Perfil e lista são apresentados juntos, depois da leitura confirmada. Erro de perfil/sessão não deixa o app preso carregando nem é tratado como conta sem comércio; o aviso existente agora menciona conta e comércios, com Tentar de novo.
- Entrada repetida/renovação da mesma sessão mantém a tela e a edição em andamento. Consultas começam fora do callback de autenticação e são ignoradas após desmontar a página.

Fluxos de criação, edição, senha, estoque, dinheiro e envios continuam os existentes. Nenhuma tabela, função de negócio, migração ou dado real foi alterado. Banco e avisos não foram reconsultados; a pendência administrativa registrada em R02 permanece.

## Verificação

- **20 testes novos**, cobrindo as cinco falhas e saída imediata, animação, eventos repetidos, renovação, falhas/nova tentativa, perfil ausente, comércio ausente, sessão inicial/evento antigo, retorno para A, desmontagem e invalidação ao iniciar recuperação.
- **43 testes focados**: sessão do dono, perfil, CEP, carga e navegação do comércio. As correções antigas 15, 23 e 24 permanecem registradas no checklist original.
- `npx tsc --noEmit` e `npx vitest run`, **ambos duas vezes**: **924 testes em 78 arquivos**, sem erro. `npm run build` aprovado.
- Chromium com build de produção em **320 × 900 e 1280 × 900**: oito roteiros de entrada/saída, entrada repetida preservando edição, troca de conta, perfil/lista de A atrasados após B e erro no perfil com nova consulta. Perfil/comércio B mantidos após resposta A; nenhuma exceção de página ou corte horizontal nas telas verificadas. Auth/consultas inteiramente simulados, inclusive eventos de outra aba; escritas reais recusadas pelo roteiro.
- O adaptador HTTP local da saída de produção fica fora do checkout. Não há mudança em dependências ou configuração do ambiente para esta correção.

Esses testes não substituem login/Google/e-mail reais, políticas efetivas de produção ou uso no app publicado. Não encerram toda E2.1, E1 nem os testes físicos de E6.

## Roteiro do dono depois de publicar

1. No Lovable, clicar em **Publicar → Atualizar**.
2. Entrar na conta habitual e conferir nome/foto e comércios. Sair: deve voltar à entrada.
3. Se já tiver outra conta de teste, entrar nela no mesmo navegador. Conferir que aparecem somente seu perfil e seus comércios. Voltar à primeira conta e conferir novamente; não precisa criar dados reais para esse teste.
4. Se a conexão falhar ao abrir a conta, deve aparecer o aviso com **Tentar de novo**. Recuperar a conexão e tentar; não deve abrir cadastro de comércio por causa da falha de leitura.
5. Informar se funcionou e em qual aparelho. Publicação e resultado ainda não confirmados nesta entrega.

**Próxima tarefa independente:** continuar E2.1, verificando cadastro/edição de comércio e retorno das telas antes de escolher a próxima correção. Entrega de e-mail, Google e demais serviços reais continua como validação pendente, em conjunto com E5. Teste geral adiado pelo dono, conforme fonte da verdade.
