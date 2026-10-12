# C6 — caixa respeita a gôndola e solicita contagem

Pedido do dono em 12/10/2026, após o print `72034.png`. A investigação encontrou uma venda de teste de 7 sobre saldo 5 sendo registrada pela função antiga, com baixa de 5 e falta de 2. Esse resultado foi reproduzido em banco privado e revertido. O print sozinho mostrava o carrinho; não provava uma venda finalizada nem autoriza corrigir os saldos reais da Bala de banana.

**Situação:** corrigido no código e aplicado no banco oficial; falta **Publicar → Atualizar** no Lovable e o teste do dono. E3/E4 continuam abertas até a validação conjunta. [PR #111](https://github.com/OmniSafe-360/mock-overlay-magic/pull/111), correção `c78ac23`. Migração oficial: `supabase/migrations/20261012055317_caixa_estoque_contagens.sql`.

## Comportamento entregue

- O Caixa no celular compara a quantidade com a **área de venda**, somando linhas, códigos e embalagens do mesmo produto/variação. Depósito não autoriza venda direta. Saldo não contado continua desconhecido; cadastro ausente, embalagem/variação removida ou produto desativado não contornam a proteção.
- Câmera, leitor que digita código, busca, botão Mais, peso e embalagem usam a mesma regra. O banco confere novamente no envio final, sob trava, antes de registrar venda, dinheiro, fiado ou baixar qualquer item. Se um item não cabe, a venda inteira é recusada.
- Quando a tentativa excede o saldo conhecido ou a gôndola ainda precisa de referência, o caixa solicita a conferência cega existente. Reenvios, dois caixas e novas tentativas enquanto há conferência pendente reaproveitam a solicitação. O carrinho continua guardado e a tela diz o próximo passo.
- A equipe vê **Contagem solicitada pelo caixa** nas listas existentes. Não vê o esperado. Duas contagens iguais divergentes pedem conferência do depósito e aguardam o dono. Três diferentes esperam o dono escolher: se a escolha divergir, solicita depósito antes de ajustar a gôndola. Contagem que bate segue o fluxo existente.
- O dono resolve em **Diferenças**. Aceitar a diferença da gôndola espera o depósito concluído; manter o número esperado continua permitido. Não há transferência/acerto automático. Ajustes preservam movimentos legítimos posteriores à fotografia da contagem e gravam `operacoes` na mesma transação.
- Enquanto as conferências vinculadas estão em revisão, não viram falta confirmada no antifurto. Quando a soma dos ajustes dos dois locais é zero, fica registrado que o total foi preservado. Isso não prova uma transferência sem registro nem acusa alguém; o dono investiga e explica.
- **Venda finalizada** aparece só após a resposta registrada/repetida do banco. Resposta perdida ou inválida mantém o envio e seu ID; reabrir/repetir confirma o mesmo envio, sem segunda venda/baixa. Recusa definitiva permite revisar o carrinho e o pagamento.
- **Sem internet:** abre com a cópia disponível e guarda o carrinho; novas vendas precisam reconectar para confirmar estoque/finalização. Sem cadastro exige que o dono cadastre/confira antes de vender no Caixa móvel. São mudanças autorizadas para evitar venda sem saldo verificável.
- **Fila antiga:** uma venda já recebida na versão antiga, recusada por estoque, permanece no aparelho e no aviso de fechamento, marcada para conciliação do dono. Não é apagada nem enviada automaticamente depois para descontar mercadoria nova. O dono precisa conciliar dinheiro/fiado, mercadoria e comprovante; esta entrega não inventa um estorno ou um novo módulo para essa situação.
- **Omni Conector:** mantém a importação das vendas externas já finalizadas e a informação de quantidade faltante. A função compartilhada `_baixar_item_venda`, suas auxiliares e o Conector não foram alterados. A proteção de autorizar uma nova venda pertence ao Caixa móvel.

## Estrutura e verificação

Reutiliza `conferencias`, `diferencas`, `operacoes`, `saldos`, `contagens`, turnos e vendas. Nenhuma tabela, coluna, função SQL de negócio ou permissão nova. O modo de conferência usa a função existente `caixa_registrar_venda`, sem registrar venda. Solicitações são operações permanentes, com registro separado para vincular depósito; históricos imutáveis não são reescritos.

Oito funções existentes atualizadas: `caixa_produtos`, `caixa_registrar_venda`, `funcionario_reposicao_contar` (seis argumentos), `funcionario_conferencia_contar` (seis argumentos), as duas listas, `resolver_conferencia` e `_produtos_visados`. A variante legada de cinco argumentos e auxiliares compartilhadas permanecem iguais.

Evidência da entrega:

- Tipos sem erro e **1.019 testes em 98 arquivos**, ambos duas vezes; build aprovado. O teste de navegador também reproduziu uma disputa: o envio do início retirava a confirmação pendente antes do caixa mostrar o comprovante. Corrigida com dois testes de integração; o início não envia confirmações novas e conserva recusas legadas. Um teste antigo do fiado fazia consulta real de acesso à página do cliente: o teste passou a simular essa dependência, mantendo as verificações de atualização/erro do painel. Nenhuma falha foi ocultada.
- Testes novos de estoque agregado, desconhecido, scanner/Mais, conferência antes do pagamento, carrinho travado durante conferência, resposta pendente/perdida/inválida, recusa definitiva, fila antiga, envio automático do início sem retirar confirmação pendente, contrato HTTP e total preservado.
- 36 asserções/recusas SQL C6 em banco privado descartável: excesso, deduplicação, duas linhas, embalagem, cadastro ausente, área desconhecida/ausente, venda com dois produtos inteiramente recusada, gôndola→depósito→dono, três diferentes, outro dono/sem sessão, PIN vencido, idempotência, RLS e regressões da contagem anterior/recebimento/reposição. Quatro disputas entre conexões reais: dois caixas, mesmo envio, mesma solicitação e venda durante a conferência; sem dupla baixa ou deadlock.
- Chromium com o aplicativo de produção em **320 e 1280 px**, RPC/REST reais de PostgreSQL/PostgREST **locais**: recusa 6 sobre 5, contagem da gôndola 7 duas vezes, depósito 998/18 duas vezes, dono resolve depósito antes de gôndola, venda de 7 após confirmação. Saldo final 0 na gôndola e 998/18 no depósito; uma venda por roteiro. Auth/perfil são simulados para o dono; somente os dados fictícios do banco privado foram usados. No build final, uma resposta inválida foi simulada depois do commit real local; recarga + Conferir envio retornaram repetida com o mesmo ID e mostraram Venda finalizada, com uma só baixa. Não substitui câmera/leitor físico, app instalado ou celular real.
- Funções oficiais comparadas antes com a versão de partida; simulação oficial `begin … rollback` com recusas e texto permitido. Resumo de **36 tabelas** idêntico antes/depois do rollback. Depois da aplicação, conferir corpos/ACL/dono/search_path e RLS, versão registrada e resumos dos dados novamente. Oito corpos iguais ao arquivo, oito auxiliares/sobrecargas inalterados, ACL/dono/search_path/RLS preservados e os dados das 36 tabelas iguais imediatamente antes/depois da aplicação. A leitura automática dos avisos foi tentada após a aplicação e recusada com HTTP 403 por falta de `advisors_read`; não há afirmação de que os avisos atuais foram lidos.

Os testes reproduzíveis de banco estão em `docs/persistencia/teste/015_*` e `rodar_caixa_estoque.sh`. O roteiro cria servidor privado descartável, sem aceitar URL/credencial do banco oficial. Precisa PostgreSQL e Python no PATH; não cria dados no projeto oficial.

## Teste do dono depois de publicar

Usar um produto de teste com quantidades físicas conhecidas. Não informar números fictícios para acertar um produto real.

1. Com cinco unidades na gôndola, colocar cinco no carrinho. Tentar a sexta por código e Mais: mantém cinco, avisa bloqueio/contagem. Nenhuma venda/baixa por essa tentativa.
2. Em Omni Operação → Repor gôndola, abrir a solicitação. Cada recontagem começa vazia e não revela saldo. Duas iguais com diferença bloqueiam e solicitam depósito; três diferentes aguardam escolha do dono.
3. Conferir o depósito e abrir Diferenças no app do dono. Antes da conferência/decisão do depósito, não aceitar a diferença da gôndola. Resolver números fisicamente confirmados, primeiro depósito e depois gôndola. Conferir os dois saldos e o total; explicar o que aconteceu.
4. Reabrir/atualizar o caixa e vender até o novo saldo confirmado. Conferir baixa, comprovante, lista, dinheiro/fiado e fechamento. Cancelar venda autorizada: só devolve o que saiu e atualiza a quantidade disponível.
5. Cortar a internet: o carrinho permanece, mas não conclui uma nova venda. Se um envio ficou sem resposta, usar Conferir envio/reabrir com internet; confirma o mesmo ID sem duplicar. Conferir dois caixas simultâneos e uma embalagem/variação.
6. Se houver venda antiga não aceita, mostrar o registro ao dono antes de fechar e conciliar fisicamente/financeiramente; não limpar dados do navegador/aparelho enquanto houver pendência.

Registrar resultado e aparelhos em E3/E4/E6. Publicação e teste real permanecem pendentes; esta entrega não declara o piloto ou o sistema 100% validados.
