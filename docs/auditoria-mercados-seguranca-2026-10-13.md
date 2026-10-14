# Auditoria de operação e segurança para mercados grandes

Revisão de **13/10/2026**, solicitada pelo dono. Alvo confirmado: **várias lojas e vários caixas**. Código analisado: `main`, `d35a6020ead28fbf5d8241d8519835210beb0486` (PR #112), conferido com o remoto. Este é um **relatório de evidências**; as regras continuam em [FONTE_DA_VERDADE](FONTE_DA_VERDADE.md) e a execução por etapas no [CHECKLIST_PONTA_A_PONTA](CHECKLIST_PONTA_A_PONTA.md#plano-para-mercados-grandes-g0-a-g8). Não cria outra fonte de regras nem renumera as entregas anteriores. Entrega documental: [PR #113](https://github.com/OmniSafe-360/mock-overlay-magic/pull/113), conteúdo inicial `307a952`.

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


## G1.4-A — proposta de relatórios de erro sem links secretos (14/10/2026 UTC)

Pedido do dono: “Pode fazer as etapas de segurança”, depois “Continue”. Base inicial `main 4a85d74` (PR #138 mesclado); durante a preparação chegou o PR #140 do painel compacto. A branch foi atualizada por fast-forward para `main 5fc81e6`, preservando essa entrega e repetindo as verificações. O módulo de telemetria e a fronteira de erro não mudaram nessa atualização. A regra de proposta prévia da seção 0 continua válida; não é autorização para aplicar silenciosamente código ainda não apresentado.

**Continuidade:** G0.1/CI entregues não são refeitos. G0.2 revogação já informada; aceite operacional pendente. G0.3 proteções administrativas/Lovable e G1.1 banco real continuam pendentes. O PR #124 de G1.2 permanece **aberto em rascunho**, já com proposta aprovada/aplicada na branch, aguardando comparação das quatro funções/permissões do Supabase real. A análise de primeiro PIN/convite também consta desse PR e não é implementação oficial. Nesta execução foi verificada somente a presença da variável administrativa: `SUPABASE_ACCESS_TOKEN` ausente. Nenhum token anterior reutilizado, nenhuma alteração em produção e nenhuma exigência de enviar segredo em conversa. Não mesclar/aplicar SQL sem a comparação requerida.

Para avançar independentemente dessa dependência, tratar o achado S06/G1.4 já registrado: conteúdo sensível em relatórios de erro. Não substitui G1.2, não fecha G1.4 completa e não cria outra fonte/checklist.

### Reprodução e risco confirmado

`src/lib/lovable-error-reporting.ts` encaminha o erro original para `captureException`, `window.location.pathname` para `route`/`filename`, contexto arbitrário, mensagem/stack brutos e, em Response, URL. Em `/pedido/$token` ou `/fiado/$token`, o caminho contém o segredo do link. `src/routes/__root.tsx` também usa `console.error(error)` na fronteira de erro. Rotas de fornecedor/cliente já têm meta `no-referrer`: isso não mascara o campo explicitamente entregue aos hooks.

Contraprova com **tokens fictícios e hooks espiados, sem rede**: os dois casos de pedido/fiado falham no módulo original, pois o próprio Error contendo token/PIN é encaminhado. Não comprova incidente anterior ou envio real ao provedor; demonstra o conteúdo do payload produzido pelo código.

### Proposta e impactos para aprovação

- Encaminhar um **novo erro seguro**, conservando somente classe conhecida e mensagem genérica, ou status HTTP de Response. Não enviar mensagem/stack/cause/detalhes/URL originais.
- Classificar a rota por lista conhecida: `/`, `/funcionario`, `/caixa`, `/conector`, `/pedido/:token`, `/fiado/:token`; demais caminhos recebem `[outra_rota]`. Não usar query/hash.
- O contexto do único chamador atual é conhecido: enviar somente `source`, rota classificada e identificador fixo da fronteira. Não encaminhar propriedades arbitrárias do argumento nem permitir substituir a rota segura por contexto bruto.
- Usar o mesmo erro seguro no `console.error` dessa fronteira. Preservar chamadas e opções dos hooks; preservar os botões de recuperação e toda interface/negócio.
- **Impacto de diagnóstico:** deixa de enviar mensagem detalhada e stack original nesses canais. Mantém tipo, HTTP quando houver, tela e origem; a análise de falhas poderá exigir reprodução local controlada. Esse limite é intencional e precisa ser aprovado. Um texto que pareça comum também pode conter chave/PIN/dados de cliente; não usar apenas regex como garantia.
- Nenhuma mudança de autenticação, sessão, vendas, estoque, SQL, permissões, publicação, configuração externa ou dependências. Não revoga links existentes.
- **Limite:** protege os payloads explícitos desta fronteira. SDKs/scripts externos podem adicionar URL/metadados ou capturar erros por conta própria; seus hooks, coleta automática, retenção e tráfego da versão publicada **ainda precisam ser verificados**. Não equivale a proteção de todos os logs, headers, CSP, XSS/CSRF, abuso/DDoS, senhas ou imunidade a ataques.

### Arquivos exatos de futura aplicação (sete)

1. `src/lib/lovable-error-reporting.ts`: substituir envio bruto pelo módulo proposto abaixo.
2. `src/routes/__root.tsx`: somente importar helper e trocar argumento de `console.error`, conforme diff abaixo.
3. `src/test/telemetria-segura.test.ts`: novo teste proposto abaixo, preservando testes existentes.
4. `docs/auditoria-mercados-seguranca-2026-10-13.md`.
5. `docs/FONTE_DA_VERDADE.md`.
6. `docs/CHECKLIST_PONTA_A_PONTA.md`.
7. `CLAUDE.md`.

**Módulo completo proposto para `src/lib/lovable-error-reporting.ts`:**

```ts
type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  track?: (event: string, properties?: Record<string, unknown>) => string | null;
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

// Telemetria recebe só classificação e rota conhecida; nunca o erro bruto.
export function erroParaTelemetria(error: unknown): Error {
  let message = "Falha de execução na interface.";
  let name = "Error";
  try {
    if (error instanceof Response) message = `Resposta HTTP ${error.status}.`;
    if (error instanceof Error && ["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "EvalError"].includes(error.name)) name = error.name;
  } catch {
    // Um objeto lançado pode ter getters que falham; não inspecionar seus dados.
  }
  const safe = new Error(message);
  safe.name = name;
  Object.defineProperty(safe, "stack", { value: undefined, configurable: true, writable: true });
  return safe;
}

function rotaParaTelemetria(pathname: string): string {
  if (["/", "/funcionario", "/caixa", "/conector"].includes(pathname)) return pathname;
  if (pathname.startsWith("/pedido/")) return "/pedido/:token";
  if (pathname.startsWith("/fiado/") || pathname.startsWith("/api/public/fiado-manifest.")) return "/fiado/:token";
  return "[outra_rota]";
}

export function reportLovableError(error: unknown, _context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const safe = erroParaTelemetria(error);
  const route = rotaParaTelemetria(window.location.pathname);
  window.__lovableEvents?.captureException?.(
    safe,
    { source: "react_error_boundary", route, boundary: "tanstack_root_error_component" },
    { mechanism: "react_error_boundary", handled: false, severity: "error" },
  );
  window.__lovableReportRuntimeError?.({ message: safe.message, filename: route });
}

```

**Diff exato proposto em `src/routes/__root.tsx`:**

```diff
- import { reportLovableError } from "../lib/lovable-error-reporting";
+ import { erroParaTelemetria, reportLovableError } from "../lib/lovable-error-reporting";

-   console.error(error);
+   console.error(erroParaTelemetria(error));
```

**Novo `src/test/telemetria-segura.test.ts`:**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { erroParaTelemetria, reportLovableError } from "@/lib/lovable-error-reporting";
const secret = "token_ficticio_exclusivo_123456";
const capture = vi.fn();
const runtime = vi.fn();
beforeEach(() => {
  capture.mockClear(); runtime.mockClear();
  window.__lovableEvents = { captureException: capture };
  window.__lovableReportRuntimeError = runtime;
});
afterEach(() => {
  delete window.__lovableEvents; delete window.__lovableReportRuntimeError;
  window.history.replaceState(null, "", "/");
});
describe("G1.4 — relatórios sem dados secretos", () => {
  it.each(["/pedido/", "/fiado/"])("não envia token da rota %s, erro ou contexto", (prefix) => {
    window.history.replaceState(null, "", prefix + secret + "?pin=1234#segredo");
    const original = new TypeError(`Falha ${secret} PIN 1234`);
    original.stack = `stack ${secret}`;
    reportLovableError(original, { token: secret, pin: "1234", route: prefix + secret, nested: { chave: secret } });
    const [error, context, options] = capture.mock.calls[0]!;
    expect(error).not.toBe(original);
    expect(error.message).toBe("Falha de execução na interface.");
    expect(error.name).toBe("TypeError");
    expect(error.stack).toBeUndefined();
    expect(context.route).toBe(prefix + ":token");
    expect(options.mechanism).toBe("react_error_boundary");
    expect(JSON.stringify([context, runtime.mock.calls])).not.toContain(secret);
    expect(runtime.mock.calls[0]![0]).not.toHaveProperty("stack");
    expect(original.message).toContain(secret);
  });
  it.each(["/", "/funcionario", "/caixa", "/conector", "/desconhecida/segredo", "/api/public/fiado-manifest.segredo"])("classifica rota %s", (path) => {
    window.history.replaceState(null, "", path);
    reportLovableError(new Error(secret));
    const expected = path.startsWith("/api/") ? "/fiado/:token" : path.startsWith("/desconhecida/") ? "[outra_rota]" : path;
    expect(capture.mock.calls[0]![1].route).toBe(expected);
    expect(runtime.mock.calls[0]![0].filename).toBe(expected);
  });
  it.each([secret, { message: secret, details: secret }, null, 123, { toJSON() { throw Error(secret); } }])("não serializa valor bruto %#", (input) => {
    reportLovableError(input);
    expect(capture.mock.calls[0]![0].message).toBe("Falha de execução na interface.");
    expect(runtime.mock.calls[0]![0].message).not.toContain(secret);
  });
  it("Response conserva status sem URL ou corpo", () => {
    const response = new Response(secret, { status: 403 });
    Object.defineProperty(response, "url", { value: "/pedido/" + secret });
    reportLovableError(response);
    expect(capture.mock.calls[0]![0].message).toBe("Resposta HTTP 403.");
    expect(runtime.mock.calls[0]![0]).toEqual({ message: "Resposta HTTP 403.", filename: "/" });
  });
  it("classe de erro arbitrária não vira dado de telemetria", () => {
    const error = new Error(secret); error.name = secret;
    expect(erroParaTelemetria(error).name).toBe("Error");
  });
  it("console da fronteira pode usar o mesmo erro seguro, sem mutar o original", () => {
    const original = new Error(secret); const safe = erroParaTelemetria(original);
    expect(safe.message).not.toContain(secret); expect(safe.stack).toBeUndefined();
    expect(original.message).toBe(secret);
  });
  it("funciona quando hooks não estão presentes", () => {
    delete window.__lovableEvents; delete window.__lovableReportRuntimeError;
    expect(() => reportLovableError(new Error(secret))).not.toThrow();
  });
  it("um hook ausente não impede chamar o outro", () => {
    delete window.__lovableEvents;
    reportLovableError(new Error(secret));
    expect(runtime).toHaveBeenCalledOnce();
  });
});

```

### Evidências desta preparação

- Base inicial oficial: tipos e **1.073 testes/106 arquivos duas vezes aprovados**. Depois da atualização para `main 5fc81e6`: tipos **duas vezes** e **1.083 testes/107 arquivos duas vezes aprovados**. Não houve novo build oficial nesta entrega documental.
- Cópia isolada `/tmp/omni-g14-proposta`: tipo do módulo/teste aprovados e **18 testes duas vezes**, sem rede. Testes inspecionam diretamente os argumentos dos dois hooks: rotas, token/PIN fictícios em mensagem/stack/contexto, valores não Error, status sem URL, erro bruto preservado, classe arbitrária, console por helper e hooks ausentes.
- Contraprova final: dois casos falham no módulo anterior; os 16 não selecionados ficam explicitamente fora dessa execução. Isso é esperado para reprodução, não falha escondida dos testes da base.
- A primeira tipagem do protótipo encontrou declaração genérica de mocks incompatível; corrigida **somente na cópia** para inferência de `vi.fn`, repetindo tipagem/testes com sucesso. Código oficial não tocado.
- Não é ensaio do SDK real, tráfego publicado, navegador autenticado ou banco oficial. Integração/tipos/regressão/build oficiais terão de ser repetidos após aplicação autorizada.

**Situação:** proposta concreta pronta, aplicação aguarda validação do dono conforme seção 0. Nesta entrega somente os quatro documentos existentes são alterados. Não exige Publicar → Atualizar. Próximo: aprovação do código/arquivos/impactos; aplicar uma etapa por PR, validar e publicar; verificar canais/metadata reais antes de encerrar G1.4. G1.1/G1.2 e demais frentes mantêm seus critérios pendentes.
