# Melhorias da base — 10/10/2026

Entrega autorizada pelo dono em três etapas, preservando os fluxos existentes. Não acrescenta módulos, passos ao cadastro nem tabelas. Mantém UUIDs, variações, códigos, preços, contagens iniciais, movimentações e permissões.

## 1. Confiabilidade

- `OwnerHome`: todos os hooks ficam antes de qualquer retorno condicional. Abrir e cancelar “Adicionar comércio” não muda a ordem dos hooks.
- Tela inicial, Comércios, Alertas e Antifurto distinguem consulta incompleta de zero confirmado. Dados antigos continuam visíveis com aviso; não recebem um “Tudo certo” indevido.
- Visão geral e abas reutilizam o mesmo conjunto de produtos e fornecedores. A geração de cada leitura começa antes de esperar pela rede; uma consulta antiga não sobrescreve a nova. Falhar ao ler fornecedores impede editar com informações incompletas. Pedidos mantêm seu controle de carregamento separado.
- Perdas do dono e da equipe guardam a intenção antes da rede. Sem resposta, repetem o mesmo identificador e conteúdo após fechar a tela. Uma recusa conclusiva libera uma nova tentativa. Armazenamento indisponível ou envio pendente em outra aba bloqueia a substituição do pedido.
- Recebimento guarda separadamente o rascunho e a intenção enviada. Recuperar a resposta de uma rodada não reaproveita a contagem anterior como uma nova conferência cega. O fornecedor sem pedido permanece no rascunho.
- Rascunhos da equipe são separados por SHA-256 do acesso, pedido e módulo. A chave de acesso não é copiada para eles. Rascunhos antigos sem esse escopo **não são importados automaticamente**, para não misturar funcionários ou comércios no mesmo aparelho. Sair de um acesso não permite enviar a operação em outro.
- Telas abertas atualizam o dia de Brasília ao mudar a data, voltar ao primeiro plano ou recuperar a conexão. Validades continuam sendo datas de calendário.

## 2. Organização sem mudar contratos

- Tipos de produto, fornecedor e variação passam a morar em `src/lib/produto.ts`; os exports antigos continuam compatíveis.
- Formatação de telefone, moeda e identidade de local fica em `src/lib/formatacao.ts`. Centavos e reais têm funções distintas. Locais seguem a normalização do banco: espaços nas pontas e maiúsculas, preservando espaços internos.
- `Contador` e `Sheet` são componentes pequenos em `src/components/parts`. Receber, repor e conferir não precisam importar o cadastro completo para utilizá-los.
- Login, comércio e produto compartilham um único observador de teclado, com remoção de listeners e timers ao sair.
- As chamadas ao Supabase usam nomes de tabela e parâmetros de função tipados. Os contratos operacionais complementares vieram das migrações aplicadas no PostgreSQL descartável; **não são uma geração nova do banco de produção**. A decodificação dos resultados JSON continua centralizada em `banco.ts`, com os adaptadores existentes.

## 3. Clareza e apresentação

- O resumo das roupas mostra tamanho/cor, código e quantidade do cadastro em linhas separadas. Essa quantidade continua distinta do saldo.
- O botão Editar do resumo tem área de toque de 48 px. As janelas mantêm o foco dentro delas, aceitam Escape e devolvem o foco ao botão de origem. Janelas sobrepostas preservam o próprio fechamento.
- Preço, unidade e categoria incompletos explicam por que Continuar está bloqueado; as validações não foram relaxadas.
- Mensagens de erro e página não encontrada aparecem em português.
- Textos antigos que diziam que nenhum alerta funcionava foram corrigidos: há avisos no painel, sem envio externo de mensagens. Reposição continua sendo confirmada pela equipe.

## Correção do banco: pronta, pendente de aplicação em produção

Migração: `supabase/migrations/20261010150241_consolidar_reposicao_e_reenvios.sql`.

- Reposição usa somente quantidade conferida, sem pendência e dentro da validade, preservando lote e FEFO. Vencidos permanecem no saldo físico; perdas e ajustes continuam podendo retirá-los.
- O banco recusa levar mais que a sugestão, a capacidade atual ou o saldo elegível. Contar/concluir com o mesmo identificador e conteúdo não duplica; mudar o conteúdo é recusado.
- Perda com o mesmo identificador repete o resultado apenas com o mesmo produto, área, quantidade e motivo; chamadas concorrentes ficam serializadas.
- Recebimento recusa produtos vencidos declarados como bons. Declarar avaria continua permitido. A repetição de uma rodada compara o pedido original; entregas antigas sem hash mantêm a compatibilidade.
- Helpers novos ficam fechados para visitantes e usuários comuns. As permissões das funções públicas existentes são preservadas. Não há tabelas novas nem alteração do saldo por migração.

**Esta sessão não aplicou SQL no Supabase de produção nem consultou os avisos atuais do projeto.** Antes de aplicar, conferir versões/definições no projeto oficial, executar a migração pelo mecanismo versionado e verificar permissões/advisors. Não aplicar fixtures de teste em produção.

O código de interface funciona com as funções atuais; as proteções adicionais do servidor só entram em vigor após aplicar a migração. Não apresentar essa parte como implantada.

## Verificação reproduzível

- `node_modules/.bin/tsc --noEmit`.
- `node_modules/.bin/vitest run`, duas execuções completas antes da entrega.
- `node_modules/.bin/vite build`.
- PostgreSQL 17: `bash docs/persistencia/teste/rodar.sh` para cadastro, pendências, segurança e concorrência; `bash docs/persistencia/teste/rodar_operacionais.sh` para aplicar todas as migrações num banco novo e testar reposição/perdas/recebimento. A instância operacional usa somente socket privado; os testes terminam com rollback e a instância é encerrada.
- Navegador Chromium com componentes reais e leituras do Supabase simuladas: cadastro/resumo/ficha em 320×568, 480×854 e 1024×768, resumo das roupas, abertura de comércio, foco/Escape e altura de teclado simulada. Nenhum salvamento real foi feito por esse roteiro.
- Verificação semântica das mudanças sem erros. O lint completo do repositório ainda contém diferenças de formatação e erros de `any` em testes antigos, anteriores à entrega; não foi feita uma reformatação geral do core.

## Teste do dono após publicar

1. Adicionar e cancelar um comércio. Conferir o resumo e os alertas.
2. Editar um produto de cada tipo, atualizar e conferir códigos, variações, fornecedor e saldos.
3. Interromper a internet ao registrar uma perda ou terminar um recebimento; fechar, reabrir e confirmar o envio original. Não deve duplicar nem usar mudanças posteriores.
4. Testar teclado e scanner no Android. A câmera real não foi testada nesta sessão.
5. **Depois da migração:** repor um produto com lotes bons, vencidos e pendentes; só os bons devem ir para a venda, mantendo o total físico e o histórico.

GitHub: a API para criar PR estava indisponível nesta sessão. Se a entrega usar Git nativo, registrar explicitamente o merge no `main`, sem afirmar que houve criação de PR.
