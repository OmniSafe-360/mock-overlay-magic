# Correção de segurança 1 — comércio desativado (14/10/2026)

Situação: **preparada e testada em banco descartável; NÃO aplicada em produção.** Aguarda autorização do dono.

## O que estava errado
Com `comercios.ativo = false`, a equipe e o caixa do celular continuavam entrando e operando. Só o Omni Conector (computador) conferia.

## Comparação com o banco real (só leitura, 14/10/2026)
- As 23 funções da equipe/caixa passam pela checagem central `_funcionario_da_chave`: direto ou por `_funcionario_caixa`, `_funcionario_recebe` e `_funcionario_repoe`.
- Também precisam da checagem: `conferir_codigo_funcionario`, `entrar_funcionario` e `funcionario_desbloquear`, que leem a tabela sozinhas.
- `funcionario_inicio` transformava qualquer erro em NULL. O app entende NULL como "o celular saiu do app" e apaga a chave, perdendo o acesso às vendas guardadas. Por isso esse erro agora é repassado.
- `sair_funcionario` não mudou: sair do celular continua permitido.

## O que muda
- Banco: `docs/persistencia/016_comercio_desativado.sql` contém o SQL exato. São 4 funções substituídas com o corpo de produção mais uma linha cada, e 1 trecho trocado em `funcionario_inicio`. Antes de trocar, o SQL confere que a versão é a esperada. Sem tabela nova, sem mudança em políticas/RLS, permissões preservadas (`CREATE OR REPLACE`).
- App: mensagem `comercio_desativado` em `caixa.ts`, `funcionario.ts` e `persistencia.ts`, e tela "Comércio desativado" em `AppFuncionario.tsx`, que não apaga a chave.
- Vendas guardadas sem internet: o erro não está na lista de recusas definitivas. A venda continua na fila do celular e sobe sem duplicar quando o dono reativar. A chave do celular não é encerrada.
- Sem internet, o celular ainda abre o caixa com a cópia guardada (comportamento atual). Ao reconectar, o envio é recusado e a venda fica guardada.

## Testes
- `docs/persistencia/teste/rodar_comercio_desativado.sh` usa PostgreSQL descartável, todas as migrações do repositório, a proposta e os casos de `016_comercio_desativado.sql`:
  - comércio ativo: código, entrada com PIN, início, abrir caixa, venda, cancelar e sangria com PIN do dono, produtos, reposição, entregas e perda;
  - comércio desativado com sessão já aberta: as 26 funções recusam com `comercio_desativado`, sem mudar estoque, vendas, perdas ou operações;
  - a chave continua preservada;
  - o comércio B de outro dono continua funcionando;
  - o dono vê o comércio, as vendas e a equipe, não vê B e reativa;
  - a venda guardada é aceita depois da reativação, o reenvio volta "repetida" e o caixa fecha;
  - as regressões 014, 015, 005 e 011 passam;
  - a reversão foi aplicada e o teste 015 passou de novo.
- Tipos: 2 vezes, sem erro. Vitest: 2 vezes, 1.103/1.103 testes em 109 arquivos aprovados. Nas duas rodadas apareceu 1 "erro não tratado" `document is not defined`, vindo de um temporizador que dispara depois do fim do teste em arquivos de tela sem relação com esta correção (`vocabulario-tipo`/`ProductArea`). É a mesma instabilidade já registrada antes e não foi escondida.
- Build: aprovado.

## Reversão
`docs/persistencia/016_comercio_desativado_reverter.sql` volta os corpos anteriores. Foi testado no banco descartável.

## Backup
Não confirmado: este ambiente não tem acesso ao painel de backups do Supabase. Antes de aplicar, o dono deve confirmar no painel (Database → Backups) que existe um backup recente. A mudança só troca funções, sem apagar dados, e a reversão está pronta.

## Pendências
- Branch/PR separados: este ambiente não permite criar branch. As alterações ficam no editor sincronizado com o GitHub.
- Aplicar em produção, publicar e fazer o teste do dono: tudo só com autorização.

## Revisão do dono (14/10/2026, 2ª rodada) — segurança da migração e compatibilidade

### SQL refeito
- A aplicação e a reversão agora são **um único comando** (um bloco). No PostgreSQL, um comando é atômico: qualquer erro desfaz tudo o que ele fez.
- **Fase 1** confere as 5 funções antes de alterar qualquer uma delas: a impressão digital (md5) tem de ser igual à do banco real, o trecho de referência precisa aparecer 1 vez e a correção ainda não pode estar lá. **Fase 2** aplica as alterações. **Fase 3** confere o resultado. A reversão confere que cada função voltou ao md5 original.
- md5 lidos no banco real (só leitura, conferidos 2 vezes, iguais ao banco de teste):

| Função | md5 |
|---|---|
| `_funcionario_da_chave` | 2dac2c30… |
| `conferir_codigo_funcionario` | 3c9142aa… |
| `entrar_funcionario` | 317ea1ff… |
| `funcionario_desbloquear` | 3c25e1b2… |
| `funcionario_inicio` | a0070580… |

### Falhas simuladas
Script `teste/016_falha_compatibilidade.sh`. Em cada caso, as funções públicas inteiras foram comparadas por md5 antes e depois, e o resultado foi **IGUAL**:
- a 2ª função estava diferente;
- a **última** função estava diferente (prova de que as 4 primeiras não são trocadas antes da conferência);
- a correção foi aplicada duas vezes;
- a reversão rodou sem a correção aplicada;
- a reversão rodou com a última função alterada depois;
- erro dentro de uma transação maior: o "commit" virou desfazer, inclusive do comando anterior.

O roteiro completo rodou 2 vezes sem erro (falhas, casos, regressões e reversão até o md5 do banco real).

### PR #124 (rascunho antigo)
- Ele altera as mesmas 4 funções, mas reaproveita erros antigos:
  - `acesso_encerrado`: o app apaga a chave do celular, e as vendas guardadas sem internet ficam inacessíveis;
  - `codigo_invalido` e resposta vazia: mensagens enganosas.
- Também não corrige `funcionario_inicio`, que devolve vazio, e o app apaga a chave.
- **Recomendação:** fechar o #124 sem mesclar. Se ele for mesclado depois, a migração dele sobrescreveria esta correção. A proposta atual recusaria rodar sobre ele (md5 diferente), e seria preciso revisar.

### Celulares com versão antiga do app
- Vendas guardadas: `comercio_desativado` não está na lista de recusas definitivas, então a venda **continua na fila** e é reenviada depois. Nada é apagado.
- Tela inicial: com a correção, a versão antiga recebe erro em vez de vazio, mostra "Sem conexão" e **não apaga a chave**. Sem a correção do banco, o comportamento continua o de hoje.
- Entrar, código e PIN: a versão antiga mostra a mensagem genérica "Não foi possível entrar agora".
- PIN sem internet: o erro não é falta de internet, então a versão antiga não abre o caixa com a cópia guardada.

### Sequência segura
1. Fechar o PR #124 sem mesclar.
2. Publicar o app (Publicar → Atualizar). As mensagens novas não mudam nada enquanto o banco não muda.
3. Confirmar o backup (abaixo).
4. Com autorização, rodar a mesma conferência de md5 só por leitura e então aplicar `016_comercio_desativado.sql` como uma migração.
5. Conferir os 5 md5 novos, as permissões e a busca por `comercio_desativado` (1 vez em cada função).
6. Teste do dono: desativar um comércio de teste, ver a mensagem no celular, reativar e ver as vendas guardadas subirem.
7. Se algo der errado: `016_comercio_desativado_reverter.sql`.

### Como conferir o backup no Supabase (feito pelo dono)
1. Painel do Supabase → projeto `omnisafe-360-oficial` → **Database → Backups**.
2. Ver o plano: no gratuito não há backup diário restaurável pelo painel. No Pro há cópias diárias dos últimos 7 dias; com o complemento PITR, é possível restaurar a qualquer minuto.
3. Conferir que existe uma cópia com data de hoje ou de ontem e o botão **Restore** disponível.
4. Restaurar substitui o banco inteiro e apaga o que entrou depois. Por isso, para esta correção, o caminho de volta preferido é o script de reversão, que só troca as 5 funções.
5. Se não houver backup restaurável, considere antes um dump manual pelo **SQL Editor/CLI** ou ativar o plano com backup.
