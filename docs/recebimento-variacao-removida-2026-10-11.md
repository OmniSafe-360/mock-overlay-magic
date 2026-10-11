# Item 9 — tamanho ou cor removidos depois do pedido

Correção preparada em 11/10/2026. **Ainda falta comparar e aplicar no Supabase oficial e testar no app publicado.** O item 9 permanece aberto no checklist até essa conferência. Nenhum dado de produção foi alterado neste ambiente.

O pedido conserva a variação histórica, mas o recebimento recusava qualquer contagem dela com `variacao_invalida`, inclusive zero. Os demais produtos ficavam aguardando a conclusão da entrega.

Agora a equipe pode contar a variação que consta no pedido:

- Se não veio, duas contagens iguais de zero continuam confirmando a falta, pelo critério existente. Nenhuma variação é restaurada e nenhum estoque é criado.
- Se chegou, fica na decisão existente do dono, com a orientação de manter separado. A entrega pode concluir e os outros itens aceitos entram normalmente.
- O dono pode devolver ou escolher a contagem e aceitar. O botão informa que aceitar peças boas restaura o tamanho e a cor antes da entrada. Código original já ocupado ou combinação de tamanho/cor já ativa impedem o aceite, sem gravação parcial.
- Avarias não entram no estoque. Devolver conserva a remoção, registra zero aceito no pedido e mantém um aviso de diferença no resumo.
- Se a remoção ocorreu depois de uma contagem parcial aceita, o item também passa para a decisão do dono antes da conclusão.

Não foram criadas tabelas, colunas, funções de banco ou módulos. Foram ajustadas três funções existentes: `funcionario_enviar_recebimento`, `_entrar_no_deposito` e `resolver_item_recebimento`. Cada entrada continua gravando `operacoes` e `movimentos` na mesma transação. RLS e permissões foram preservadas. A identificação da variação fica no JSON de tentativas que já existe, para o histórico do dono continuar mostrando tamanho e cor.

## Aplicação pendente no banco

Arquivo: [`supabase/migrations/20261011120000_recebimento_variacao_removida.sql`](../supabase/migrations/20261011120000_recebimento_variacao_removida.sql).

Este ambiente tem acesso ao GitHub e à chave pública do app, mas não tem uma conexão administrativa com o Supabase `bvwjprxfthhreuhovgbk`. Por isso não foi possível comparar as definições reais, aplicar a migração nem consultar os avisos de segurança e velocidade. A versão está preparada; não há afirmação de aplicação em produção.

Quem tiver esse acesso deve:

1. Ler as definições reais de `funcionario_enviar_recebimento(text,uuid,integer,jsonb)`, `_entrar_no_deposito(uuid,jsonb,uuid,uuid)` e `resolver_item_recebimento(uuid,text,integer)` e compará-las às versões anteriores no Git. São, respectivamente, as migrações `20261010183000`, `20261010150241` e `20261009205326`.
2. Simular a migração entre `begin;` e `rollback;`. O arquivo contém uma comparação dos corpos e da configuração de segurança antes de substituir qualquer função. Se aparecer `funcao_diverge_do_arquivo`, parar e revisar a diferença; não retirar a proteção.
3. Aplicar a migração inteira em uma transação, registrar a versão no histórico do Supabase, conferir as três definições resultantes e os avisos de segurança e velocidade.
4. Publicar → Atualizar no Lovable e fazer o roteiro abaixo. Só então marcar a aplicação e o resultado real no checklist e no histórico.

O arquivo `docs/persistencia/teste/012_recebimento_variacao_removida.sql` é **exclusivamente para banco local descartável**: cria dados fictícios e desfaz tudo. Nunca executar esse arquivo de teste em produção.

## Verificação local

- `npx tsc --noEmit` e `npx vitest run`: duas execuções finais, 767 testes em 70 arquivos.
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
