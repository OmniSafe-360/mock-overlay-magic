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
