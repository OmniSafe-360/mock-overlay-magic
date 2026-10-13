# G0.3 — verificações e publicação segura

Entrega aprovada pelo dono em 13/10/2026 (“Sim”), sobre `main 2f610b2` (PR #116). **Oito arquivos aplicados e enviados no [PR #117](https://github.com/OmniSafe-360/mock-overlay-magic/pull/117), código `9830590`; primeira execução remota aprovada. Proteções/alertas administrativos e compatibilidade das regras com o Lovable permanecem pendentes.** Este relatório apoia a fonte da verdade; não substitui suas regras.

## Evidência atual

- API da branch: `protected=false`; consulta de rulesets: lista vazia. Nenhum workflow rastreado e nenhuma execução de Actions encontrada.
- Permissões administrativas de Actions/workflows: HTTP 403 por escopo da integração. Esses ajustes e alertas nativos de dependências/segredos continuam sem verificação administrativa.
- Revogação G0.2 informada pelo dono; confirmação de consumidores/app normal ainda pendente. G0.1 aguarda publicação e teste do dono.

## Código aprovado e arquivos exatos

1. `.github/workflows/verificacao.yml` — novo workflow, sem publicação ou acesso de produção.
2. `.github/dependabot.yml` — propostas semanais de atualização do lock Bun e Actions; não habilita mesclagem automática.
3. `scripts/verificar-seguranca.mjs` — scanner de padrões fortes, consulta de avisos e preparação descartável da instalação.
4. `scripts/verificar-seguranca.test.mjs` — seis testes das recusas, histórico, sigilo da saída e integridade da instalação.
5. `docs/FONTE_DA_VERDADE.md` — registrar G0.3 como aplicada no código/pendente no GitHub, mantendo os demais aceites.
6. `docs/CHECKLIST_PONTA_A_PONTA.md` — evidências, critérios e pendências de G0.3, sem marcar concluída.
7. `CLAUDE.md` — histórico da aprovação/entrega e limites.
8. `docs/publicacao-seguranca-2026-10-13.md` — este registro.

Não há mudança em aplicativo, package.json, bun.lock oficial, SQL, permissões do banco ou dados.

## Funcionamento

Em PR para main, push no main, execução manual e toda segunda-feira: checkout completo sem credencial persistida, busca de padrões fortes no código e histórico acessível; instalação frozen sem scripts dos pacotes; testes dos verificadores; consulta de avisos conhecidos; tipos e suite existente duas vezes; build; testes SQL existentes em PostgreSQL privado descartável. Actions fixadas por SHA, Node 24.19.0 e Bun 1.4.3. Token do job só tem contents:read; nenhuma chave administrativa ou de publicação usada. Variáveis Supabase do job são fictícias. Não há pull_request_target ou runner próprio.

Doze pacotes do lock apontam para o cache Lovable, inacessível pelo proxy deste ambiente. Para não depender desse cache no CI, somente uma **cópia descartável** da instalação recebe os URLs públicos npm. Antes, os metadados oficiais devem confirmar o mesmo nome, versão e SHA512. O Bun ainda verifica o SHA512 do arquivo instalado. O lock oficial continua igual, a guarda de 24h do bunfig é preservada. Nenhum pacote é atualizado por esse preparo.

Aviso de qualquer gravidade, erro de leitura/rede/formato ou integridade diferente reprova a verificação; não se transforma falha em aprovação. Segredos são classificados por tipo e caminho/ID de objeto, sem imprimir o valor. Chaves públicas anon/publicáveis são preservadas. O scanner por padrões não reconhece toda forma possível de segredo; a revisão humana e proteções nativas ainda são necessárias. A consulta npm não detecta toda vulnerabilidade desconhecida.

## Impactos e configuração administrativa separada

Adicionar o workflow só cria verificações: **não torna o main protegido e não bloqueia mesclagens/publicação sozinho**. Antes de exigir `Verificacao` na proteção do main, confirmar que a primeira execução no GitHub passou e validar o modo de integração do Lovable. Bloquear push direto sem esse cuidado pode interromper a sincronização dele e acessos de manutenção. Não ativar regras, bypass, aprovadores ou segredos novos sem validar os atores reais.

Depois da aplicação: verificar Actions habilitado, restrição de Actions aprovadas, permissões de token, alertas de dependências e detecção/proteção de segredos disponíveis no plano do repositório. Configurar PR/check obrigatório com histórico preservado e sem force push. Exigir revisão humana das mudanças de workflow, verificadores e dependências; um check cujo próprio código pode ser editado pelo PR não é proteção inviolável. O fluxo manual de publicação do Lovable deve usar a versão validada. Não há deploy automático nesta proposta.

## Validação e aceite

Validação isolada da proposta e repetida após aplicação: tipos duas vezes; 1.019 testes em 98 arquivos duas vezes; build; seis testes dos verificadores; scan de 1.522 blobs do histórico acessível sem ocorrências fortes; consulta npm de 554 nomes sem avisos conhecidos; instalação frozen/offline da cópia normalizada com cache verificado; regressões SQL e quatro disputas simultâneas em PostgreSQL 17 descartável, aprovados. Nenhum dado ou serviço de produção usado. YAML interpretado sem erros. O [CI remoto aprovado](https://github.com/OmniSafe-360/mock-overlay-magic/actions/runs/38381015645) confirmou no runner hospedado a instalação online das mesmas versões, scanner, consulta de avisos, seis testes dos verificadores, tipos/testes duas vezes, build e SQL descartável/concorrente. A revisão final dos registros no PR também passa pelo check; não tratar o sucesso como configuração de proteção obrigatória. Não exige atualização do aplicativo no Lovable por si só. A pendência de atualização de G0.1 permanece.

G0.3 só fecha depois de: código aprovado/aplicado em PR; primeiro check remoto verde; proteções/alertas administrativos verificados e configurados; Lovable/manutenção compatíveis; ensaio de um PR com falha recusado por check obrigatório. Até lá G0.3 e G0 permanecem abertas. G1 é a próxima análise após essa entrega técnica, respeitando pendências de produção anteriores.


## Estado da entrega no GitHub

Aprovação explícita recebida. Entrega no [PR #117](https://github.com/OmniSafe-360/mock-overlay-magic/pull/117), código `9830590`, [CI remoto aprovado](https://github.com/OmniSafe-360/mock-overlay-magic/actions/runs/38381015645); check executado com sucesso em pull_request. Revisão final documental em validação no mesmo PR. Não foi configurado bloqueio de push direto, bypass, requisito obrigatório ou segredo novo. Falta acesso administrativo/verificação das proteções e alertas nativos, validar a sincronização Lovable e ensaiar recusa de PR com falha por check obrigatório. **G0.3/G0 continuam abertas** para esses critérios; a próxima análise independente é G1.1 (isolamento de lojas/pessoas), mantendo G0.1/G0.2 pendentes. Esta entrega não exige Publicar → Atualizar por si só.
