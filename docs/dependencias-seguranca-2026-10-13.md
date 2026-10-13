# G0.1 — dependências com alertas conhecidos

Entrega de **13/10/2026**, baseada no main `0313eca` (PR #113). O dono aprovou explicitamente a proposta de versões, patch, cinco arquivos e impactos antes de aplicar. Este é um registro de entrega vinculado à [fonte central](FONTE_DA_VERDADE.md) e ao [checklist G0–G8](CHECKLIST_PONTA_A_PONTA.md#plano-para-mercados-grandes-g0-a-g8), não outra fonte de regras.

Entrega: [PR #114](https://github.com/OmniSafe-360/mock-overlay-magic/pull/114), correção `0f9ca43`.

**Estado:** pronto no código; publicação no Lovable e teste do dono pendentes. G0.2 (credenciais) e G0.3 (proteção da publicação/fornecimento) continuam abertas. Zero avisos conhecidos na consulta não é garantia de proteção absoluta.

## Problema e mudança aprovada

A auditoria encontrou versões alcançadas por advisories em cinco nomes de pacotes, principalmente em desenvolvimento/compilação. Exploração no app publicado não foi demonstrada. A atualização modifica **seis resoluções** no `bun.lock`, cada uma com versão e SHA512 do registro npm. As duas linhas de `brace-expansion` permanecem independentes e compatíveis com seus consumidores.

| Pacote | Antes | Depois |
|---|---|---|
| shell-quote | 1.10.0 | 1.11.0 |
| brace-expansion / minimatch 3 | 1.1.16 | 1.1.21 |
| brace-expansion / typescript-eslint e minimatch 10 | 5.0.8 | 5.0.12 |
| js-yaml | 4.3.0 | 4.3.2 |
| nanoid | 3.3.16 | 3.3.18 |
| source-map-js | 1.2.1 | 1.2.2 |

Metadados de dependências e comandos, além das demais resoluções, ficam preservados. `package.json`, `bunfig.toml`, código de telas/regras, autenticação, SQL e dados reais não mudam. Os outros quatro arquivos aprovados são este registro, `docs/FONTE_DA_VERDADE.md`, `docs/CHECKLIST_PONTA_A_PONTA.md` e `CLAUDE.md`.

## Validação e limites

- Antes de aplicar, o patch foi preparado e aprovado após duas rodadas de tipos e 1.019 testes/98 arquivos e build na cópia isolada. A única diferença de arquivos de aplicação nessa cópia foi o lock.
- Aplicado exatamente o patch aprovado; instalação com Bun 1.4.3 em modo **frozen/offline**, cache local e scripts desativados. Não houve atualização ampla nem desativação de verificação de integridade; nenhuma configuração/pin de runtime novo foi adicionada ao projeto.
- O cache veio da instalação isolada. Downloads que o transporte do Bun recusou foram feitos pela mesma origem pública com curl, conferindo SHA512 entre registro, lock e artefato, antes de preparar o cache. Não houve bypass de TLS/checksum nem uso de pacote com verificação falha.
- Versões efetivamente instaladas conferidas no projeto, incluindo ambas as linhas de `brace-expansion`. Todas as versões corrigidas tinham mais de 24 horas de publicação; a guarda existente permanece.
- **Depois de aplicar no projeto:** `npx tsc --noEmit` e `npx vitest run` passaram duas vezes, **1.019 testes em 98 arquivos por rodada**; `npm run build` passou. Nenhum teste ignorado/desativado ou código de negócio alterado.
- Nova consulta bulk npm de **554 nomes do lock**, HTTP200, retornou **zero avisos conhecidos**. A auditoria anterior tinha cinco nomes atingidos. Referências e alcance anterior estão no [relatório histórico](auditoria-mercados-seguranca-2026-10-13.md#dependências-consultadas-em-13102026).
- Verificação do build de produção local: `/`, `/caixa`, `/funcionario` e `/sw-funcionario.js` responderam 200; worker traz **30 arquivos JS/CSS**, todos presentes e não vazios. A suíte inclui regressões de fila/PWA/contagem/caixa; esta verificação de abertura não é teste completo de navegador, câmera ou atualização no celular.
- Diff confere exatamente seis substituições de resolução; nenhum outro arquivo de aplicação modificado. Registros documentais e links conferidos.

Não foi feita consulta administrativa ao Supabase, migração, benchmark, ataque externo, operação financeira ou alteração de estoque. A configuração do projeto publicado e o aparelho real continuam sujeitos ao roteiro abaixo.

## Publicar e testar

1. No Lovable, usar **Publicar → Atualizar**, para o build/publicação usar o lock corrigido. Merge no GitHub sozinho não comprova essa publicação.
2. Abrir o app do dono, entrar e conferir que as telas/carregamento continuam normais.
3. Abrir Omni Operação e Caixa no celular, confirmar PIN/navegação/câmera ou busca manual, sem criar uma venda real apenas para testar a atualização.
4. Atualizar/reabrir o app instalado, verificar que rascunhos/carrinho/filas existentes continuam disponíveis. Caso haja pendência de envio, preservar seu ID e seguir o fluxo existente; não apagar para forçar atualização.
5. Se possível no ambiente de teste, verificar abertura sem rede após uma visita online e nova venda recusada até reconectar, conforme C6. Isso não altera a regra de conclusão online.
6. Registrar versão publicada, aparelho/data e resultado funcionou/não funcionou; só então fechar o aceite G0.1. E3/E4/E6 e demais etapas não são encerradas por esse roteiro pequeno.

## Se a atualização causar problema

Registrar erro, versão e cenário; retornar o lock anterior por **novo commit/PR**, sem force/rebase/amend, reconstruir/publicar e preservar rascunhos/filas/dados. G0.1 volta a pendente com o risco conhecido explicitado. Não trocar indiscriminadamente versões de Lovable/TanStack ou ignorar integridade para resolver o erro.

**Próxima pendência:** G0.2 — revogar/substituir credenciais compartilhadas no canal seguro, sem informar valores em chat/documentos. Esta entrega não revogou credenciais e não encerra G0.
