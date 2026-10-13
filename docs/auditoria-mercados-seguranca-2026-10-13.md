# Auditoria de operação e segurança para mercados grandes

Revisão de **13/10/2026**, solicitada pelo dono. Alvo confirmado: **várias lojas e vários caixas**. Código analisado: `main`, `d35a6020ead28fbf5d8241d8519835210beb0486` (PR #112), conferido com o remoto. Este é um **relatório de evidências**; as regras continuam em [FONTE_DA_VERDADE](FONTE_DA_VERDADE.md) e a execução por etapas no [CHECKLIST_PONTA_A_PONTA](CHECKLIST_PONTA_A_PONTA.md#plano-para-mercados-grandes-g0-a-g8). Não cria outra fonte de regras nem renumera as entregas anteriores.

## Resultado e alcance

A base possui fluxos extensos, proteção transacional de estoque, isolamento por comércio, contagens cegas, reenvios idempotentes e validação autoritativa das vendas móveis. **Ainda não há evidência suficiente para liberar uma rede de mercados grandes:** faltam fechamento integrado dos fluxos, investigação clara da mercadoria, provas de capacidade, proteção contra abuso e ensaios de recuperação/serviços reais. Segurança de 100% contra ataques não pode ser prometida.

Esta auditoria leu interface, acesso, persistência, filas/PWA, funções SQL efetivas versionadas e testes, com três frentes de revisão (funcional, segurança e escala). As definições relevantes foram conferidas por assinatura e última migração, sem usar uma versão antiga como comportamento atual. Foi consulta de código e execução **local**, não nova auditoria administrativa de toda a produção.

Nesta entrega somente quatro arquivos de documentação mudam: este relatório, a fonte, o checklist e `CLAUDE.md`. Nenhuma alteração funcional/SQL, permissão, configuração externa ou dado de comércio. O pedido anterior de apresentar código/arquivos/impactos **antes de aplicar correções** continua válido.

## Evidências executadas nesta revisão

| Verificação | Resultado | Limite da prova |
|---|---|---|
| `npx tsc --noEmit`, duas rodadas | Passou nas duas | Tipagem não demonstra ausência de falhas de segurança |
| `npx vitest run`, duas rodadas | **1.019 testes em 98 arquivos**, todos passaram em ambas | Inclui serviços simulados; não substitui app publicado/aparelho real |
| `npm run build` | Passou | Não comprova que esse build esteja publicado |
| `docs/persistencia/teste/rodar_caixa_estoque.sh` | C6, regra anterior de contagem, regressões de recebimento/validade e **quatro disputas entre conexões PostgreSQL reais** passaram | Banco descartável com dados fictícios; não é carga nem consulta à produção |
| Avisos de dependências do `bun.lock` | HTTP 200 do endpoint bulk de advisories do registro npm; **554 nomes de pacotes** consultados, cinco nomes retornaram avisos | Advisory alcança versões do lock; exploração no app não foi demonstrada |
| Repositório/GitHub | Remoto conferido; repositório público; nenhum workflow versionado e lista de runs sem resultado | API de proteção do main respondeu **403 por permissão da integração**; não comprova proteção desligada |
| Cabeçalhos do app publicado | Consulta HEAD impedida por **403 do proxy de rede** | HTTPS/CSP/referrer/caches efetivos não verificados; não afirmar que não existam no gateway |
| Supabase administrativo, restauração, carga, hardware e teste de ataque externo | **Não executados** nesta auditoria | Configurações reais, capacidade, RPO/RTO e teste adversarial completo continuam pendentes |

O `npm audit` inicial respondeu ENOLOCK porque o projeto usa `bun.lock`. A consulta foi feita sobre nomes/versões reais desse lock, sem gerar/substituir lockfile ou atualizar pacotes. Nenhuma indisponibilidade de painel foi ocultada como aprovação.

## Proteções já existentes — preservar

- `saldos` é a quantidade atual; marcador de contagem distingue desconhecido de zero. Estoque e `operacoes` permanentes são alterados na mesma transação; a leitura verifica revisão ([banco.ts](../src/lib/banco.ts#L69)).
- `pode_acessar_comercio` exige sessão e vínculo de dono; migrações de estoque/recebimento/caixa usam RLS, revogam escrita direta e EXECUTE de helpers sensíveis. Endpoints públicos de negócio validam chave/token e escopo. `SECURITY DEFINER` autorizado não é defeito isoladamente ([base](../supabase/migrations/20261009045406_ce96a560-fa3a-44e3-9abe-f3e00d5c1354.sql#L66)).
- Chaves de aparelho/Conector são aleatórias e armazenadas como hash no banco; PIN servidor tem bcrypt, cinco erros/15 minutos e janela de 12 horas. Funcionário precisa permissão do módulo. Bloqueio/novo acesso revoga aparelhos anteriores ([PIN](../supabase/migrations/20261009220759_funcionario_pin_ao_abrir.sql)).
- C5/C6 limitam venda móvel ao saldo conhecido, agrupam linhas/embalagens/variações, preservam carrinho/ID, validam na transação e vinculam contagem da área/deposito. Conhecido divergente não é ajustado pela equipe. Cancelamento/reenvio conservam idempotência ([C6](../supabase/migrations/20261012055317_caixa_estoque_contagens.sql)).
- PWA guarda telas/arquivos públicos por versão, não APIs e páginas privadas. Nova venda móvel exige confirmação online; cache/rascunho offline não autorizam estoque extra. Conector importa venda externa **já finalizada**, com outro papel operacional.
- React escapa texto de usuário; não foi demonstrado XSS nas telas de negócio. Middleware CSRF de server functions existe ([start.ts](../src/start.ts#L23)); catálogo HTTP usa host fixo/GTIN validado, sem URL arbitrária nesse caminho.
- As chaves presentes no `.env` versionado foram classificadas como **anon**, não `service_role`. Scan de padrões fortes nos arquivos tracked não encontrou segredo administrativo. **Histórico integral não foi aprovado** por esse scan; é preciso guarda contínua.

Não reabrir A1–C6/R01–R05 como se estivessem sem correção. Os prints demonstram partes do fluxo; E2–E8 continuam sem aceite integrado publicado.

## Achados priorizados e tratamento

### Segurança

| ID / etapa | Evidência atual | Natureza e prioridade | O que falta comprovar/corrigir |
|---|---|---|---|
| S01 / G0.2 | Token administrativo foi compartilhado na conversa; valor deliberadamente omitido | Exposição conhecida; P0 | Dono revoga/substitui pelo canal seguro, privilégio mínimo/validade; não revogamos durante auditoria |
| S02 / G0.1 | Versões do lock atingidas pelos avisos na tabela abaixo | Advisory confirmado; exploração condicionada; P0 para triagem | Atualização mínima compatível e prova da exposição em desenvolvimento/build/produção, sem atualização geral |
| S03 / G1.2 | RPC de código de funcionário distingue acesso novo/PIN; primeiro PIN com código de seis dígitos dentro de 48h ([equipe](../supabase/migrations/20261009173744_equipe_funcionarios.sql#L132), [entrada](../supabase/migrations/20261009220759_funcionario_pin_ao_abrir.sql#L24)) | Comportamento no código confirmado; abuso depende do perímetro; P1 | Proteção contra enumeração/apropriação de convite e limites na **API Supabase direta**, não só no domínio do app; validar também código de ligação do caixa |
| S04 / G1.3 | Fluxo MFA/AAL2/step-up não encontrado no app/SQL; proteção de senha vazada anteriormente relatada desligada | Lacuna de app/config externa não confirmada; P1 | Definir MFA/recuperação do dono, ações sensíveis, sessões e teste real de Auth/Google/SMTP/redirects |
| S05 / G1.4 | Chaves bearer no storage do PWA e PIN offline de quatro dígitos ([funcionario.ts](../src/lib/funcionario.ts#L61), [acessoLocal.ts](../src/lib/acessoLocal.ts#L20)) | Limite do desenho; exploração exige extração/XSS/aparelho comprometido; P1 | CSP, revogação/rotação, proteção física do aparelho, avaliar armazenamento seguro sem prometer que hash torna PIN curto impenetrável |
| S06 / G1.4 | Telemetria monta `pathname` completo; `/pedido` e `/fiado` usam token no caminho ([lovable-error-reporting.ts](../src/lib/lovable-error-reporting.ts#L33)); captura serializa erros ([error-capture.ts](../src/lib/error-capture.ts#L18)) | Payload no código confirmado; envio externo depende de hooks ativos; P1 | Mascarar tokens/PII/queries, verificar referrer/no-store/caches/indexação; manter renovação de links existente |
| S07 / G1.1, G6 | RLS/ACL das migrações, workflows/painéis e backups sem auditoria administrativa atual completa | Verificação pendente; P1 | Inventariar banco real, schemas expostos/CREATE/helpers/storage/realtime e contas administrativas; CI/proteção do main, backup restaurável, incidentes e acessos mínimos |
| S08 / G4.3–G4.4 | Conector aceita conteúdo vindo da chave e pasta autorizadas; valida formato/CNPJ/itens/idempotência, não há verificação independente da origem fiscal na Sefaz nesse fluxo | Fronteira de confiança condicionada; P1 | Proteger chave/PC/pasta, revogar, correlacionar origem/hash e conciliar ao PDV real; não bloquear registro de venda fiscal legítima já ocorrida |

**Não há ataque/invasão demonstrado.** Aviso “função pública SECURITY DEFINER” não substitui análise de autorização, e “RLS ligada sem política” pode ser bloqueio direto intencional. Uma revisão anterior dos avisos do item 9 não valida toda a segurança futura nem precisa ser reaberta sem mudança pertinente.

### Dependências consultadas em 13/10/2026

| Pacote / versões do lock | Referência retornada / gravidade | Caminho observado e alcance | Versão mínima candidata para proposta |
|---|---|---|---|
| `shell-quote` 1.10.0 | [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv), crítica | Lovable config → TanStack devtools → launch-editor; ferramenta de desenvolvimento, execução publicada não comprovada | 1.11.0 compatível |
| `brace-expansion` 1.1.16 e 5.0.8 | [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895), [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), entre outros; alta/moderada | ESLint/minimatch/typescript-eslint; expansão de padrões em ferramenta | 1.1.21 e 5.0.12, cada linha compatível |
| `js-yaml` 4.3.0 | [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh), alta | ESLint/TanStack plugin/xmlbuilder2; YAML de usuário no negócio não identificado | 4.3.2 compatível |
| `nanoid` 3.3.16 | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8), alta | PostCSS/Vite; gerador customizado com tamanho zero não identificado no negócio | 3.3.18 compatível |
| `source-map-js` 1.2.1 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), alta | PostCSS/Tailwind/Vite; mapas de código no build | 1.2.2 compatível |

São **candidatas para validação**, não atualizações aplicadas nem garantia de compatibilidade. Reconsultar avisos e verificar versões resolvidas ao executar G0.1. A guarda de publicação de pacotes de 24h em `bunfig.toml` não corrige versões antigas vulneráveis. Não usar `audit fix --force`.

### Fluxos e investigação física

| ID / etapa | Evidência | Pendência e critério |
|---|---|---|
| F01 / G3.1 | [AppFuncionario.tsx:455–460](../src/components/AppFuncionario.tsx#L455): Repor e conferir depósito com contador zero; conferência de gôndola está dentro de Repor | Botões/contadores reais por tarefa; conferir não cria transferência nem usa rascunho de Repor; urgências e aguarda dono visíveis |
| F02 / G3.2 | Esperado calculado ao enviar rodada ([C6:334](../supabase/migrations/20261012055317_caixa_estoque_contagens.sql#L334)); carrinho não finalizado não baixa | Início/revisão da contagem e tratamento de movimentos no intervalo. Carrinho físico/mercadoria separada e vendas externas atrasadas precisam protocolo. Trava SQL não é uma fotografia física durante minutos |
| F03 / G3.3–G3.4 | Tentativas guardam números, sem autor/hora de cada rodada; [PainelDiferencas.tsx:223](../src/components/PainelDiferencas.tsx#L223) ajusta e explica em chamadas separadas | Trilha por evento, caso desde solicitação preventiva e justificativa/ajuste atômicos; preservar explicações anteriores e não inventar histórico antigo |
| F04 / G3.4 | Área desconhecida ganha referência pela equipe ([C6:369](../supabase/migrations/20261012055317_caixa_estoque_contagens.sql#L369), [C6:470](../supabase/migrations/20261012055317_caixa_estoque_contagens.sql#L470)); perda física hoje baixa antes da confirmação do dono | Nova exigência de confirmação precisa proposta sobre inicial/perda; não reinterpretar vendas/recebimentos/transferências legítimas nem alterar silenciosamente comportamento anterior |
| F05 / G3.1, G5.1 | Meta depósito `5 + produtos visados` e identificação de aberta só em `contando` ([C6:523](../supabase/migrations/20261012055317_caixa_estoque_contagens.sql#L523)) | Urgente separado de rotina, identificação de solicitação mesmo bloqueada, cobertura de catálogo adequada à equipe |
| F06 / G4, G7 | E2–E8 com aceites abertos; comprovante móvel não é nota fiscal ([CaixaCelular.tsx:1282](../src/components/CaixaCelular.tsx#L1282)) | Jornada integrada real e escolha PDV/fiscal/hardware; não declarar fiscal/TEF ou todos os aparelhos aprovados |

A investigação distingue quantidade confirmada, diferença entre locais, falta/sobra total e informação ainda incompleta. **Não determina automaticamente furto, causa ou culpado.** Total preservado não prova transferência não registrada. Dono precisa revisar contexto/movimentos e aprovar o ajuste, não apenas escolher uma contagem sem justificativa.

### Escala e continuidade

| ID / etapa | Evidência arquitetural | Prova necessária antes de liberar porte grande |
|---|---|---|
| E01 / G5.2 | [banco.ts:69–96](../src/lib/banco.ts#L69): COUNT exact de todas operações, oito coleções integrais, até três tentativas | Leitura coerente sob vendas contínuas, sem depender de silêncio em toda loja. Paginação técnica de 1.000 acumula tudo; não é paginação da tela nem snapshot entre requests |
| E02 / G5.2 | [persistencia.ts:277](../src/lib/persistencia.ts#L277): relações filtradas por produto; listas completas renderizadas no navegador | Medir memória/rolagem/busca em aparelho modesto; corrigir gargalo medido sem mudar os totais |
| E03 / G5.2 | `caixa_produtos` agrega catálogo completo; [CaixaCelular.tsx:194](../src/components/CaixaCelular.tsx#L194) atualiza a cada 120s | Banda/CPU/latência com vários aparelhos; preço/cadastro chega no prazo sem mudar carrinho |
| E04 / G5.3 | Venda trava linha do comércio e produtos ([C6:133](../supabase/migrations/20261012055317_caixa_estoque_contagens.sql#L133)) | Medir espera/p95/p99 com caixas concorrentes. Não remover trava sem preservar número único, estoque, fiado e ausência de deadlock |
| E05 / G5.2 | Compras, conferências e fiado carregam históricos extensos ([banco.ts:128](../src/lib/banco.ts#L128), [550](../src/lib/banco.ts#L550), [814](../src/lib/banco.ts#L814)); dono lê vários comércios | Resumos/páginas sem totais parciais falsos ou ocultar pendências antigas; planos SQL com volume representativo |
| E06 / G5.1 | Limites versionados 50 funcionários/50 caixas por comércio e 200 itens por pedido | Definir envelope de lojas/SKUs/caixas/pico/linhas/histórico. Limite de cadastro não é capacidade de atendimento comprovada |
| E07 / G4.4 | [OmniConector.tsx:72](../src/components/OmniConector.tsx#L72): varredura 20s, envio sequencial e histórico local limitado; pasta/cache têm limites | Backlog prolongado, suspensão/reinício e nota recusada visível/recuperável. Fonte fiscal e banco conciliados antes de encerrar investigação |
| E08 / G6 | Console/captura de erros existem; backup/pipeline/monitoramento administrativo sem prova atual | Alertas reais, responsáveis, RPO/RTO, restauração isolada, versão publicada e reversão compatível; plano de internet/energia/contingência |

Esses caminhos são comprovados no código; **a falha de capacidade em volume-alvo ainda não foi reproduzida**. Carga e otimização devem ocorrer em ambiente isolado, sem usar estoque real como massa ou afrouxar garantias de integridade.

## Escopo comercial a decidir

O dono confirmou rede, mas não volumes exatos. Antes de declarar uma grande loja atendida, registrar lojas/SKUs/variações/lotes/caixas/equipe/pico, PDV/fiscal/TEF/balança/impressora e contingência. Gerente, transferências entre lojas, promoções, devoluções de clientes, produção de açougue/padaria não são módulos automaticamente disponíveis. Açougue/padaria estão fora do escopo atual; se indispensáveis ao cliente-alvo, precisam de desenho próprio ou integração comprovada. Não impor ERP novo se o PDV existente atende essa fronteira.

## Como encerrar a análise em execução

Usar G0–G8 do checklist, uma correção por PR, proposta antes do código. Registrar problema/cenário, prioridade, reprodução, arquivos afetados, impacto, provas executadas, banco/publicação, teste do dono e próxima tarefa. E1–E8 anteriores continuam com seus critérios; não fechar pelo número de testes.

Primeiro: **G0.1, proposta para dependências**, e G0.2 pelo canal seguro. Depois acesso/integração, investigação e fluxos, capacidade, recuperação, aparelhos e piloto de rede. Liberar somente o escopo aprovado, manter revisão periódica de segurança/capacidade e não usar o termo “imune a hackers”.
