# Códigos do Mercado — primeira entrega

Autorizada pelo dono em 10/10/2026 após a análise dos códigos. Escopo desta entrega: ITF-14 e equivalência UPC-A/EAN-13. Balanças e catálogos externos ficam para as próximas entregas.

## Comportamento

- O scanner do Mercado também lê ITF de exatamente 14 dígitos, usado em caixas e fardos. As tentativas curtas ou maiores são ignoradas; a leitura continua. Os formatos anteriores continuam habilitados.
- A preferência de câmera, recorte, intervalo, foco, lanterna, desligamento e entrega única continuam funcionando como antes. A biblioteca é carregada junto com a câmera, sem dependência nova.
- O Mercado compara UPC-A válido de 12 dígitos com EAN-13 válido de 13 dígitos acrescentando zero somente à **chave de comparação**. Exemplo: `036000291452` corresponde a `0036000291452`.
- O código original permanece no produto, na embalagem e na etiqueta. Nenhum código é reescrito para fazer essa correspondência.
- Os códigos de 14 dígitos, EAN-8/UPC-E, códigos curtos, códigos com letras e códigos com verificador errado continuam com comparação exata. O prefixo 29 não é interpretado como balança.
- A verificação vale no cadastro e na edição, inclusive pelo resumo: principal versus outros produtos, embalagens de outros produtos e embalagens do próprio produto. Uma caixa não pode receber um UPC equivalente ao código da unidade.
- O scanner da equipe recebe o contexto de Mercado em Receber, Repor, Conferir e Registrar perda. As contagens e os pedidos enviados são os mesmos de antes.
- Os outros cinco tipos mantêm os formatos e a comparação anteriores.

## Banco — migração preparada, ainda não aplicada em produção

Arquivo: `supabase/migrations/20261010123000_codigos_mercado_ean_upc.sql`.

A migração acrescenta uma chave de comparação em `codigos_barras`, preenchida somente para Mercado. O índice único protege cadastros simultâneos. A busca do funcionário e a identificação da venda usam essa chave e continuam respeitando a chave/PIN e o comércio. Vínculos explícitos dos códigos do caixa continuam tendo prioridade. Nenhuma tabela nova, mudança de saldo ou movimentação é criada pela migração.

Se dois códigos antigos forem equivalentes dentro do mesmo Mercado, a migração para com `codigos_ean_upc_equivalentes_existentes`. Aplicada em uma transação, ela é desfeita inteira. O teste provou a preservação dos dois produtos, códigos e dez unidades de estoque. A resolução exige revisar os cadastros reais; não há fusão nem exclusão automática.

O acesso ao Supabase de produção não está disponível nesta sessão. A configuração do ambiente já declara `SUPABASE_ACCESS_TOKEN`, mas ainda não tem um vínculo salvo. O token deve ser configurado nas configurações seguras do ambiente, nunca em mensagens ou no navegador. Antes de aplicar: conferir versões, duplicados existentes e permissões no projeto oficial. Não aplicar fixtures de `docs/persistencia/teste`.

Enquanto a migração não for aplicada, o scanner ITF e a validação de equivalentes na tela podem funcionar após publicar o app; a busca da equipe, as vendas e a proteção de equivalentes no banco continuam usando as regras antigas.

## Verificação

- Suíte completa do app: **654 testes em 63 arquivos aprovados, duas vezes**, após a última alteração de código. Verificação de tipos e build sem erros.
- Revisão semântica dos arquivos alterados: nenhum erro; oito avisos de Fast Refresh que já existiam. A suíte SQL antiga e o roteiro operacional com todas as migrações também passaram.
- Imagens de barras geradas e lidas pelo ZXing real: ITF-14 reconhecido; ITF curto recusado; ITF maior ignorado; EAN com zero devolvido como UPC reconhecido como equivalente.
- Tela real do cadastro em testes: código escaneado equivalente bloqueado; edição mantém o código original; edição pelo resumo bloqueia código equivalente ao da caixa.
- PostgreSQL 17 descartável: salvamento pela RPC, repetição sem duplicação, equivalentes recusados entre produto e embalagem, leitura do conferente, identificação da nota, prioridade do vínculo do caixa, outros tipos, outro comércio, chave inválida e escrita direta recusados.
- Contagem inicial de dez unidades preservada após repetição, buscas e edição, com uma contagem e um movimento.
- Duas conexões reais: a segunda espera e recebe `codigo_em_uso` com SQLSTATE `23505`, sem produto nem operação parcial.
- Migração com duplicados antigos recusada e desfeita, sem perda de dados.
- `rodar_operacionais.sh` executa essas provas junto com os testes operacionais anteriores. A suíte antiga de cadastro e concorrência continua em `rodar.sh`.
- A câmera física e as etiquetas de fornecedores precisam do teste do dono. Nenhuma velocidade de leitura em celular foi prometida pelos testes com imagens.

## Roteiro do dono

Após **Publicar → Atualizar**:

1. Num Mercado, escanear o código de uma unidade comum. Deve preencher o mesmo campo de antes.
2. No cadastro da embalagem, escanear uma caixa/fardo com ITF-14. Deve preencher só o código da embalagem. Conferir quantas unidades vêm dentro, salvar e atualizar a página.
3. Tentar cadastrar UPC de 12 dígitos equivalente a um EAN com zero inicial já salvo. A tela deve avisar que o código já existe.
4. Editar o produto sem trocar seu código. Conferir depois que saldo, lote e quantidades continuam iguais.
5. **Depois de aplicar a migração**, no app da equipe, ler a unidade por UPC/EAN e a embalagem por ITF. Devem abrir o produto/embalagem corretos do mesmo comércio. Conferir também uma nota de venda com o código equivalente.
