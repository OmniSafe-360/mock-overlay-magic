# C5 / E3 — contagem cega e decisão do dono

Pedido autorizado pelo dono após o print `71840.png`. [PR #110](https://github.com/OmniSafe-360/mock-overlay-magic/pull/110), correção `aa6728c` e texto complementar `7a54665`; mudanças recentes do fiado preservadas por merge. Banco atualizado; código pronto para publicação. Falta **Publicar → Atualizar** no Lovable e o teste do dono. E3 continua aberta para validação conjunta.

## O que aconteceu com o Nescau

A leitura do banco oficial confirmou depósito e gôndola inicialmente zerados. Em 11/10/2026, às 14h36 UTC, foram enviadas contagens de **3** e depois **1** na gôndola, com zero transferido. As funções antigas fizeram ajustes de **+3** e **−2**, deixando **1**. Às 14h38 UTC, o recebimento acrescentou **1.000** ao depósito. A conferência posterior do depósito bateu em 1.000. O histórico registra os números enviados, sem comprovar a quantidade física ou o motivo de terem sido informados.

O fluxo antigo da gôndola aceitava o número diretamente e só registrava diferença com caixa ligado; este comércio não tinha caixa ligado. No depósito, duas contagens iguais divergentes também ajustavam o saldo, e uma pendência de três contagens diferentes podia ser contornada com outro ID. Os três problemas foram reproduzidos usando funções reais em um banco local fictício antes da correção.

**O Nescau não foi ajustado nesta entrega:** continua com depósito **1.000** e gôndola **1**. Corrigir esse saldo exige verificar o físico e a decisão do dono; não foi criada diferença retroativa nem alteração de histórico.

## Regra aprovada e implementação

- O funcionário nunca vê o esperado. Quando a quantidade coincide com o saldo conhecido, conclui a contagem.
- Se divergir, pede nova contagem **em branco**, até três tentativas. Duas iguais com diferença, ou três diferentes, ficam **bloqueadas, aguardando o dono**; não ajustam automaticamente nem liberam a reposição.
- O dono abre **Diferenças**, escolhe uma quantidade informada ou **Manter o número do sistema**. A decisão ajusta somente a diferença da fotografia, preservando entradas/saídas posteriores; pode ser aplicada uma única vez.
- Bloqueio por produto/variação/área no banco. Outro ID, aparelho ou dia não contorna. Contagem aberta pode ser retomada no mesmo ID/rodada, inclusive de outro dia. Reenvio da mesma rodada não vira nova tentativa.
- Contagem que nunca teve referência inicial mantém o critério de inicialização existente. Zero já contado não é desconhecido. Critério do recebimento permanece como antes.
- Reposição conta primeiro e só indica quanto buscar após confirmação. Mantém disponibilidade, lotes/validade, mínimo/máximo e vendas/saídas posteriores. Duas reposições diferentes também respeitam o espaço atual da gôndola; dois envios iguais não transferem duas vezes.
- Reposições antigas já concluídas permanecem intactas. Uma reposição antiga ainda aberta exige nova contagem antes de transferir. Apps antigos sem rodada recebem pedido de atualização na contagem; publicar a interface é necessário para continuar esse caminho.
- O bloqueio vale para contagem/reposição da área pendente; recebimentos, vendas e perdas legítimos continuam sendo registrados. Não há bloqueio geral do produto ou da conta do funcionário.

Migração **`20261012003349_contagem_cega_decisao_dono.sql`**, versão efetivamente registrada pela API do Supabase. Altera seis funções existentes; a contagem da reposição ganha o argumento de rodada. Reutiliza `conferencias`, `diferencas` e `reposicoes`, sem tabela/coluna nova. Funções auxiliares, permissões existentes, `SECURITY DEFINER`, proprietário, `search_path` e RLS preservados. A nova assinatura de contagem permite apenas anon/authenticated/service_role, protegida pela chave/PIN existente. Ajustes e transferências têm `operacoes` na mesma transação.

## Evidências e limites

- Nove testes novos de tela: recontagem vazia, ID/rodada, duas iguais e três diferentes, retomada, lista bloqueada de ambas as áreas, reposição legada e escolhas do dono. Três casos falharam antes da mudança.
- Tipos e **990 testes em 94 arquivos**, ambos duas vezes após a última alteração; build aprovado.
- **41 asserções/recusas SQL**: diferenças sem estoque automático, contorno/reenvio/rodada, outro dono conhecendo o ID, escolha inválida, decisão única, movimentos posteriores, transferência sem duplicação, legado, troca de dia, produto desativado e RLS/permissões. Regressões de validade e recebimento também aprovadas.
- **Seis disputas entre conexões PostgreSQL reais**: dois IDs, reenvio da rodada, duas decisões, dois “Coloquei”, duas reposições ocupando a mesma gôndola e decisão versus nova contagem. Banco local descartável, só dados fictícios.
- Chromium de produção em **320 e 1280 px**, seis roteiros de gôndola/depósito, contagem vazia/mesmo ID/rodada e bloqueio sem corte horizontal ou exceção. Respostas de API simuladas; imagens inspecionadas. Teste do dono no app publicado continua pendente.
- Funções oficiais comparadas antes, com nova conferência antes da aplicação. Simulação com `begin … rollback`, dados fictícios e texto permitido pelo dono aprovada no banco oficial. A primeira tentativa recusou comércio fictício incompleto; o exemplo recebeu os campos obrigatórios reais e a simulação completa passou. Nenhum exemplo ficou gravado.
- Aplicação pela API nativa de migrações, seguida de comparação: **seis corpos iguais ao arquivo**, auxiliares/permissões preservados e hashes de todas as linhas de `saldos`, `movimentos`, `operacoes`, `contagens`, `conferencias`, `reposicoes`, `diferencas` iguais imediatamente antes/depois da migração. Uma venda de outro produto ocorreu durante a investigação por outro acesso; foi identificada e preservada. Saldo Nescau reconferido sem alteração.
- Leitura automática dos avisos de segurança/desempenho tentada após aplicar: **HTTP 403, falta `advisors_read`** no acesso disponível. Metadados e recusas de segurança foram conferidos diretamente; não foi afirmado que os avisos automáticos passaram ou mudaram.

Roteiro reproduzível: `bash docs/persistencia/teste/rodar_contagem_cega.sh`, com PostgreSQL 17 (`initdb`, `pg_ctl`, `psql`) e Python 3 no ambiente. Cria servidor privado temporário, aplica migrações, verifica casos/concorrência e descarta tudo. Nunca recebe chave ou URL do banco oficial. Exclui somente as três migrações de catálogo que dependem de HTTP externo.

## Teste do dono

1. No Lovable, **Publicar → Atualizar**; fechar e reabrir o app da equipe.
2. Em uma contagem controlada de produto com saldo conhecido, informar número diferente: deve pedir nova contagem sem mostrar o esperado e sem conservar o número anterior no campo. Repetir o número: deve mostrar **bloqueada, aguardando o dono**, sem indicar quanto buscar ou ajustar o saldo.
3. Voltar/reabrir ou usar outro aparelho: a pendência continua. No painel do dono, abrir **Diferenças**, conferir o físico e escolher o número correto ou **Manter o número do sistema**. Apenas então a contagem é liberada.
4. Conferir também o caso de três números diferentes e o caso que bate com o saldo. Fazer contagens deliberadamente divergentes somente de forma controlada; a decisão do dono pode alterar estoque.

Não retirar automaticamente a unidade antiga do Nescau. Próxima verificação independente de E2.1 preservada; demais itens/etapas não são encerrados por esta entrega.
