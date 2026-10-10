# Correção ao abrir o Caixa — 10/10/2026

Pedido: corrigir somente o erro ao tocar em Caixa no Omni Operação.

## Causa e mudança

O botão já abre `CaixaCelular`. A tela solicita `caixa_estado` e `caixa_produtos`.
`caixa_produtos` foi declarada `STABLE`, mas a validação da chave chama
`_funcionario_da_chave`, que registra `ultimo_uso` e `ultimo_acesso`.
O PostgREST executa uma RPC `STABLE` em transação somente leitura e recusa esse
registro com SQLSTATE `25006`. A tela traduz a recusa para a mensagem genérica
mostrada no celular. `caixa_clientes_fiado` tinha a mesma classificação e falha.

A migração `20261010161000_corrigir_carregamento_caixa.sql` muda somente essas
duas classificações para `VOLATILE` e solicita a atualização do cache do
PostgREST. Não substitui o corpo das funções nem muda permissões, PIN, vínculo
com o comércio, vendas, cálculos, estoque, scanner, fluxo ou aparência.

## Verificação

- PostgreSQL 17 descartável e PostgREST 16.4 reais: antes da correção, o início
  e o estado carregam, mas produtos e clientes retornam HTTP 405 / `25006`.
  Depois, ambas as consultas carregam normalmente.
- Regressão HTTP: preços, unidade fracionada, códigos principal/embalagem/PDV,
  variações, listas vazias, isolamento entre comércios e abertura/retomada do
  mesmo turno. Chave inválida, função Caixa desligada, PIN expirado,
  funcionário bloqueado e aparelho revogado continuam recusados nas duas RPCs.
- Comparação antes/depois: corpos, permissões e configuração de segurança das
  funções iguais; produtos, variações, saldos, movimentos, contagens, lotes,
  operações e vendas iguais. O estoque inicial continuou em 60 unidades.
- Chromium, tela real em 320 × 568, com as RPCs encaminhadas à API local real:
  PIN → início → Caixa reproduziu a mensagem original antes da correção.
  Depois, abriu com R$ 100 de troco, buscou Nescau, adicionou ao carrinho e abriu
  os clientes do fiado. Nenhuma venda real foi registrada.
- Tipos e compilação aprovados. Suíte do app: 700 testes aprovados duas vezes.

Os testes de regressão estão em `docs/persistencia/teste/rodar_caixa.sh`.
Exigem PostgreSQL 17, PostgREST e Python 3 no PATH. Criam uma instância privada,
aplicam a cadeia operacional do repositório, reproduzem a falha antes da
migração e verificam a correção depois. As três migrações do catálogo externo
são omitidas porque não participam do Caixa e exigem a extensão HTTP do
Supabase. A instância inteira é descartada ao terminar. Os arquivos de teste
nunca devem ser enviados ao banco oficial.

## Aplicação no banco oficial e teste do dono

**Migração preparada e testada; não aplicada ao Supabase nesta entrega.** O
ambiente não tem o vínculo administrativo `SUPABASE_ACCESS_TOKEN` configurado.
A chave pública disponível permite as chamadas do app, mas não alterar funções
do banco. Não foram usados dados ou chaves de funcionários reais.

Após conectar o Supabase nas configurações seguras do ambiente, conferir as
duas funções no projeto `bvwjprxfthhreuhovgbk`, aplicar somente a nova migração
versionada e verificar a classificação e o cache da API. Publicar o site sozinho
não aplica esta correção no banco.

Depois da aplicação, no celular:

1. Entre no Omni Operação com o PIN e toque em **Caixa**. Deve mostrar a abertura
   com o troco da gaveta ou a tela de venda, se o caixa já estiver aberto.
2. Busque um produto pelo nome ou código. Confira nome e preço.
3. Saia para o início e abra o Caixa novamente. Deve retomar o mesmo turno.
