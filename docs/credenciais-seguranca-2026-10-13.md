# G0.2 — inventário e troca segura de credenciais

Revisão de **13/10/2026**, base `main 2c379f0` (PR #114). Vinculada à [fonte central](FONTE_DA_VERDADE.md) e ao [checklist](CHECKLIST_PONTA_A_PONTA.md#plano-para-mercados-grandes-g0-a-g8). Documento de evidências e procedimento; não cria outra fonte de regras.

Entrega documental: [PR #115](https://github.com/OmniSafe-360/mock-overlay-magic/pull/115), inventário `dc2c005`.

**Estado: inventário concluído e revogação confirmada pelo dono em 13/10/2026; validação operacional pendente.** O dono respondeu “Revoguei” após orientação para remover o token identificado. Não foi teste independente da chave antiga por API. Ainda falta confirmar que o token era exclusivo da manutenção e que o app continua normal; se houver consumidor externo, substituir/validar pelo canal seguro. Atualização somente documental, sem aplicativo, permissões, banco ou dados.

## Confirmação da revogação

Registro da confirmação: [PR #116](https://github.com/OmniSafe-360/mock-overlay-magic/pull/116), `ff3faab`.

Em **13/10/2026**, o dono informou **“Revoguei”** em resposta à orientação sobre o token **Codex Omni Safe 360**. Responsável pela ação: dono, no painel da própria conta. A data registra a confirmação; o horário efetivo da revogação não foi informado.

Essa confirmação é a evidência humana da revogação. O assistente não usou o valor exposto, não testou a rejeição do token antigo por API, não criou outro token e não alterou chaves do projeto. O acesso administrativo `SUPABASE_ACCESS_TOKEN` continua ausente no runtime; manutenção de código pelo GitHub permanece disponível. Novo token não é necessário para esta atualização documental nem para a verificação independente G0.3; será preparado pelo canal seguro quando houver tarefa administrativa no Supabase.

Verificações desta atualização documental: tipos e **1.019 testes/98 arquivos passaram duas vezes** no mesmo código da G0.1; diff e referências conferidos. Nenhuma verificação do token antigo ou teste real do app foi inferido desses testes.

**Para encerrar os critérios restantes de G0.2:** confirmar se o token tinha apenas uso de manutenção e se o app continua abrindo normalmente. Se houver outra integração que dependia dele, a substituição/validação continua pendente. Pergunta feita ao dono; ainda não há resultado registrado nesta atualização. Não marcar funcionamento do app publicado, consumidores externos ou configuração de token novo como comprovados só pela frase “Revoguei”.

## O que foi verificado antes da revogação

- Main remoto conferido, checkout limpo antes da revisão; repositório Git não é shallow.
- **626 commits acessíveis por refs locais, 1.509 blobs únicos e 42.719.336 bytes** de conteúdo Git examinados, incluindo arquivos que saíram da versão atual mas permanecem nesse histórico. Nenhuma ocorrência dos padrões fortes pesquisados de PAT Supabase/GitHub, chave secreta Supabase, identificador AWS ou chave privada PEM; nenhum JWT `service_role` encontrado. JWTs em duas versões de blobs foram classificados como `anon`.
- Arquivos tracked atuais e **634 arquivos dos artefatos/relatórios locais selecionados** examinados sem ocorrência desses padrões de segredo administrativo. Diretórios: `.output`, proposta G0.1, auditoria de 13/10 e investigação anterior. Arquivos binários/archives, dependências/cache e arquivos maiores de 15MB não entram nessa varredura de artefatos.
- `.env` versionado tem URLs/identificadores públicos e duas entradas de chave pública com papel `anon`, usadas nos caminhos de navegador/SSR. Valores não foram exibidos nem copiados para este registro.
- Aplicativo não referencia `SUPABASE_ACCESS_TOKEN`. O módulo `client.server.ts` declara uso server-side de `SUPABASE_SERVICE_ROLE_KEY`, mas não foi encontrado consumidor/importação ativa desse cliente administrativo no código do app. Isso não comprova configurações externas ou chamadas fora do repositório.
- Ambiente atual: autenticação GitHub disponibilizada pela plataforma, sem leitura/divulgação do seu valor; nenhuma variável Supabase administrativa ativa. Configuração segura consultada: `SUPABASE_ACCESS_TOKEN` já declarado para `api.supabase.com`, **sem valor salvo** (`has_saved_binding=false`). Nenhum segredo/escopo/configuração foi criado ou alterado nesta tarefa.
- Na verificação inicial, nenhuma credencial foi enviada à API para testar validade, revogada ou substituída pelo assistente. A revogação posterior foi informada pelo dono na seção acima. Não usar novamente o valor compartilhado na conversa nem pedir outro pelo chat.

Verificação de publicação documental: `npx tsc --noEmit` e `npx vitest run` passaram duas vezes, com **1.019 testes em 98 arquivos por rodada**. O aplicativo é o mesmo da G0.1; não houve nova mudança funcional nem novo build/publicação por esta documentação.

**Limites:** busca por padrões conhecidos não comprova ausência de qualquer segredo, senha curta ou credencial sem prefixo. A prova cobre o histórico alcançável das refs disponíveis localmente, não refs remotas não baixadas, objetos inacessíveis, forks/caches, sessões/contas externas ou logs do provedor. Não foi consulta administrativa da conta Supabase/GitHub/Lovable. Status de revogação informado pelo dono; rejeição da chave antiga por API não verificada independentemente. Dados de sessão e chaves de aparelhos legítimos têm tratamento próprio em G1, sem revogação coletiva por esta auditoria.

## Inventário por finalidade

| Credencial/acesso | Onde aparece/é usado | Tratamento nesta etapa |
|---|---|---|
| PAT do Supabase compartilhado, identificado pelo nome **Codex Omni Safe 360** | Conversa anterior e manutenção administrativa; não é a chave do app | Revogação informada pelo dono em 13/10/2026; confirmar consumidores externos e acesso necessário antes de encerrar a etapa. Não registrar valor/final do token |
| `SUPABASE_ACCESS_TOKEN` | Segredo previsto nas configurações seguras do ambiente, sem valor salvo; documentação de manutenção | Novo token só quando necessário, prazo curto/projeto oficial/menor escopo suficiente, salvo pelo canal seguro. Não adicionar ao `.env` público, código ou commit |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` e cliente público/SSR, papel `anon` | São públicas por desenho; preservar RLS e checagem das funções. Trocar/revogar PAT não exige girar chave pública nem o segredo JWT do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Referência em módulo somente servidor; valor não disponível neste ambiente | Nunca expor ao navegador/telemetria/Git. Confirmar se há uso real em painel externo antes de qualquer rotação |
| Autenticação GitHub da plataforma | Acesso Git/CLI deste ambiente; não consta no código versionado | Preservar a credencial gerenciada. Não confundir com token pessoal compartilhado ou revogar acessos de outras integrações por dedução |
| Sessão do dono, chave de funcionário/caixa e links de fornecedor/fiado | Fluxos existentes e armazenamento por acesso | São credenciais do produto, distintas do PAT administrativo. Não desligar toda a equipe/caixas ou alterar PIN/links nesta etapa; revisão específica em G1 |

## Procedimento concreto para o dono

1. Abrir **[tokens de acesso do Supabase](https://supabase.com/dashboard/account/tokens)** na conta que criou o token compartilhado.
2. Localizar **Codex Omni Safe 360**, verificando nome, projeto, finalidade e data. Não apagar todos os tokens nem trocar as chaves API/JWT do projeto por engano.
3. Confirmar se alguma integração de manutenção externa usa esse token. Se usar, preparar a substituição pelo canal seguro naquele serviço e validar o acesso necessário; essa dependência não pode ser inferida só do repositório. Se não houver consumidor ativo, não criar outro token sem necessidade.
4. Revogar/remover o token compartilhado pelo controle do painel. Registrar somente nome/finalidade e horário UTC; nenhum valor secreto em conversa, print público ou documento.
5. Se for necessário novo acesso administrativo, gerar token com expiração curta, acesso apenas ao projeto oficial e permissões suficientes à tarefa. Preencher **`SUPABASE_ACCESS_TOKEN` nas configurações seguras do ambiente**, já previstas; nunca enviar o valor aqui. Aguardar ativação e verificar a operação administrativa necessária com leitura, sem modificar dados para testar.
6. Confirmar a revogação pelo painel e registrar o resultado da substituição/validação quando aplicável. O relato do dono e uma verificação independente são evidências diferentes; não afirmar rejeição da chave antiga por API sem teste realizado.
7. Abrir o app publicado e conferir entrada/carregamento e acessos normais da equipe/caixa. O código não depende do PAT; configurações externas ainda devem ser conferidas antes de prometer que qualquer integração permanecerá conectada.

## Para encerrar G0.2

- [x] Revogação informada pelo dono em 13/10/2026; evidência humana registrada, sem teste independente por API.
- Consumidores reais identificados, substituídos e acesso necessário validado, ou ausência de necessidade de token novo registrada explicitamente.
- Novo segredo, se necessário, somente no canal seguro, com escopo/validade mínimos; nenhum valor publicado.
- App e integração afetada funcionando; inventário/resultados e limites registrados.

G0.2 permanece com **confirmação operacional pendente**, sem nova solicitação de revogar o mesmo token. G0.3 pode ter verificações independentes preparadas, sem marcar G0.2/G0 ou prontidão geral como fechadas. Esta entrega documental não exige Publicar → Atualizar no Lovable; a publicação pendente de G0.1 continua separada.
