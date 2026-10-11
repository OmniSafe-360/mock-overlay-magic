# Item 9 — tamanho ou cor removidos depois do pedido

Correção aplicada em 11/10/2026 no Supabase oficial `bvwjprxfthhreuhovgbk`, depois da comparação e da simulação com rollback. As três funções resultantes são idênticas ao arquivo, e a migração `20261011120000` está registrada no histórico. Avisos do Supabase conferidos por outro acesso em 11/10/2026 às 07h57 UTC, conforme relato do dono: nenhum aviso novo causado pelo item 9. O dono autorizou marcar o item como feito, com a pendência **falta o teste do dono no app publicado**. A aplicação alterou somente as funções e o registro da migração; não acertou quantidades nem resolveu entregas reais.

O pedido conserva a variação histórica, mas o recebimento recusava qualquer contagem dela com `variacao_invalida`, inclusive zero. Os demais produtos ficavam aguardando a conclusão da entrega.

Agora a equipe pode contar a variação que consta no pedido:

- Se não veio, duas contagens iguais de zero continuam confirmando a falta, pelo critério existente. Nenhuma variação é restaurada e nenhum estoque é criado.
- Se chegou, fica na decisão existente do dono, com a orientação de manter separado. A entrega pode concluir e os outros itens aceitos entram normalmente.
- O dono pode devolver ou escolher a contagem e aceitar. O botão informa que aceitar peças boas restaura o tamanho e a cor antes da entrada. Código original já ocupado ou combinação de tamanho/cor já ativa impedem o aceite, sem gravação parcial.
- Avarias não entram no estoque. Devolver conserva a remoção, registra zero aceito no pedido e mantém um aviso de diferença no resumo.
- Se a remoção ocorreu depois de uma contagem parcial aceita, o item também passa para a decisão do dono antes da conclusão.

Não foram criadas tabelas, colunas, funções de banco ou módulos. Foram ajustadas três funções existentes: `funcionario_enviar_recebimento`, `_entrar_no_deposito` e `resolver_item_recebimento`. Cada entrada continua gravando `operacoes` e `movimentos` na mesma transação. RLS e permissões foram preservadas. A identificação da variação fica no JSON de tentativas que já existe, para o histórico do dono continuar mostrando tamanho e cor.

## Aplicação no banco oficial

Arquivo: [`supabase/migrations/20261011120000_recebimento_variacao_removida.sql`](../supabase/migrations/20261011120000_recebimento_variacao_removida.sql).

Aplicação autorizada pelo dono e executada pela API administrativa do Supabase em 11/10/2026:

1. Comparadas as três definições reais, a configuração de segurança e as permissões. `_entrar_no_deposito` e `resolver_item_recebimento` eram idênticas às versões anteriores no Git. `funcionario_enviar_recebimento` tinha somente formatação/comentários diferentes: os 1.560 tokens SQL eram idênticos, incluindo os literais. A proteção passou a aceitar os dois corpos anteriores conhecidos; continua recusando qualquer outro corpo/configuração.
2. Simulada a migração inteira entre `begin;` e `rollback;` no projeto oficial, sem dados fictícios de recebimento. Sem login, identidade sem acesso ao comércio, chave de equipe ausente e gravação direta foram recusados. RLS e acesso à função interna conferidos. Após o rollback, as três definições e permissões eram exatamente as de antes.
3. Aplicadas as três substituições e o registro de `20261011120000` em `supabase_migrations.schema_migrations` na mesma transação. Conferidas as definições resultantes e preservadas as permissões e RLS. Nenhuma entrega, contagem ou quantidade real foi modificada.
4. As consultas de avisos por este acesso retornaram HTTP 403 (`advisors_read` ausente). O dono informou que a conferência por outro acesso em 11/10/2026 às 07h57 UTC confirmou a mesma lista anterior: funções SECURITY DEFINER executáveis por anon/authenticated, dois informativos de RLS ligada sem política (`catalogo_produtos` e `dono_pin`, leitura direta intencionalmente fechada) e proteção contra senhas vazadas desligada, que o dono liga no painel. Nenhum aviso novo causado pela correção.
5. **Pendente:** Publicar → Atualizar no Lovable e executar o roteiro abaixo. Por orientação expressa do dono, item 9 marcado como feito com a anotação "falta o teste do dono no app publicado"; o teste geral continua previsto para o fim das correções.

Corpos atuais conferidos após a aplicação (MD5, usado para comparação de definições): `funcionario_enviar_recebimento` = `865a390a6371d675f205e67f67a3a68c`; `_entrar_no_deposito` = `7be8991bd73215d05479ce34ff3b2b4b`; `resolver_item_recebimento` = `569e0a092d7380da5267cdba2892f040`. Não reaplicar a migração: a proteção reconhece somente as versões anteriores, e o histórico já contém esta versão.

O arquivo `docs/persistencia/teste/012_recebimento_variacao_removida.sql` é **exclusivamente para banco local descartável**: cria dados fictícios e desfaz tudo. Nunca executar esse arquivo de teste em produção.

## Verificação local

- `npx tsc --noEmit` e `npx vitest run`: duas execuções finais, 767 testes em 70 arquivos. Repetidas e aprovadas após conferir a variante de formatação em produção; testes operacionais locais também aprovados novamente.
- PostgreSQL 17 descartável: cadeia de migrações, simulação da alteração e seus casos antes de aplicar, tudo entre `begin … rollback`. Contagem positiva, Não veio, reenvio sem duplicar, remoção após envio parcial, aceite/restauração, avaria, devolução, código ocupado, combinação duplicada, outra equipe/comércio, outro dono, sem login e gravação direta recusada.
- Cópia local com função alterada diretamente: a migração recusou a divergência sem substituir nenhuma das três funções.
- RLS e restrições de entrada interna conferidas. Histórico dos movimentos fecha com o saldo.
- Navegador Chromium em 320 e 1280 px: identificação histórica, orientação, aceite com restauração e devolução sem rolagem horizontal, exceções de tela ou chamadas reais ao Supabase.
- `npm run build`.

A opção `--sem-catalogo` do executor local dispensa apenas as três migrações de importação HTTP externa, que não participam do recebimento nem do estoque. Não representa auditoria de produção.

## Roteiro do dono depois da aplicação

1. Em uma loja de roupas de teste, faça um pedido de dois tamanhos/cores, ainda sem saldo. Remova um deles do cadastro depois do pedido.
2. Na equipe, conte o que chegou. A variação removida deve ficar separada e a entrega deve terminar quando os demais itens forem conferidos.
3. Em Pedidos, confira tamanho/cor e o aviso. Aceite a quantidade escolhida: o cadastro deve voltar a mostrar a variação, e só as peças boas devem entrar no depósito.
4. Repita com outra entrega, escolhendo Devolver: não deve entrar estoque e o resumo deve mostrar a diferença.
5. Repita com Não veio: confirme zero quando o app pedir, conclua sem restaurar o cadastro nem criar estoque.
