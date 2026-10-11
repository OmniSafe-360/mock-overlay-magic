# Omni Safe 360 — checklist ponta a ponta

Plano de execução pedido pelo dono em **11/10/2026**. As regras continuam em [FONTE_DA_VERDADE.md](FONTE_DA_VERDADE.md); este arquivo detalha suas etapas. O histórico permanece em [CLAUDE.md](../CLAUDE.md). Não há uma segunda fonte de regras.

**Etapa atual: E1 — confiabilidade. Próxima tarefa: R01, retomada da reposição após fechar o app.** Esta entrega organiza o trabalho; não aplica as correções abaixo nem altera dados reais.

## Ponto de partida e limites da análise

- Código revisado: `main`, commit `a8f05ad2894a7c8862374033a9e52da21cf5925e` (PR #98, item 25). Se o GitHub avançar, revisar a diferença antes de seguir.
- O [checklist original de 30 itens](checklist-funcional-2026-10-11.md) tem **1–25 marcados como corrigidos**. Restam 26–28 (dados que dependem do dono) e 29–30 (aparelhos reais). Os números antigos continuam valendo; R01–R05 são pendências adicionais desta revisão.
- Verificação desta revisão: `npx tsc --noEmit` e `npx vitest run` passaram **duas vezes**, com **828 testes em 73 arquivos** em cada rodada; `npm run build` passou. Registro da entrega no `CLAUDE.md`.
- A análise combina código, migrações, testes e registros existentes. Não foi uma nova auditoria direta de cada função, dado ou configuração do Supabase oficial, nem um teste completo do app publicado. Aplicações de SQL anteriores e a revisão de segurança das 07h57 UTC são registros anteriores, conforme o histórico e o relato do dono.
- Testes automatizados incluem serviços simulados: aprovação não comprova câmera real, e-mail entregue, atualização do Lovable, queda de internet ou fechamento de caixa no mercadinho.
- A meta de “100% funcional” é **todos os fluxos previstos aprovados, sem defeitos conhecidos que bloqueiem o uso ou alterem dinheiro/estoque incorretamente**. Não é uma garantia de nunca surgir um erro.

## Como consultar e executar

Antes de cada tarefa, ler nesta ordem: fonte da verdade (principalmente seção 0), histórico recente do `CLAUDE.md`, este checklist e o checklist original quando relacionado. Conferir o `main` atual. Executar **um item por vez, em um PR**, preservando os fluxos que funcionam. Encontrou outra falha? Registrá-la com evidência e prioridade; não ampliar a correção silenciosamente.

Estados obrigatórios no registro de cada item:

| Estado | O que comprova |
|---|---|
| A verificar | Há um cenário ainda sem evidência suficiente; não é defeito confirmado. |
| Pendente de correção | A limitação foi identificada; falta reproduzir e corrigir. |
| Corrigido no código | Mudança mesclada, com tipos e testes aprovados. |
| Publicado | A versão foi atualizada no Lovable; SQL necessário foi aplicado e conferido no banco oficial. |
| Validado pelo dono | O roteiro foi aprovado no app publicado, no aparelho/ambiente informado. |
| Depende do dono/serviço | Falta dado, decisão, configuração externa ou teste físico identificado. |

O `[x]` das **etapas deste arquivo** só é marcado com o critério cumprido e evidência registrada. Os `[x]` da lista antiga indicam correção entregue e não substituem a validação no app. Uma etapa implementada, mas sem teste real, fica **“pronta, falta o teste do dono”**. O dono já autorizou deixar o teste geral para depois das correções.

Ao encerrar uma tarefa, registrar: ID, problema e cenário, PR/commit, testes executados, migração e comparação com banco quando aplicável, publicação confirmada ou pendente, roteiro do dono, resultado e próxima tarefa. Atualizar este arquivo, a fonte da verdade se mudar etapa/regra e o checklist original se o item vier dele. Não substituir registros históricos por uma aprovação atual não comprovada.

## Ordem das etapas

| Etapa | Objetivo | Situação em 11/10/2026 |
|---|---|---|
| E1 | Fechar as pendências de confiabilidade identificadas nesta revisão | Próxima; R01 primeiro |
| E2 | Validar a jornada do dono, dos cadastros às compras e pagamentos | Implementada em grande parte; validação completa pendente |
| E3 | Validar recebimento, estoque, reposição, perdas e diferenças juntos | Implementada; teste completo pendente |
| E4 | Validar vendas, caixa, fiado e integração usada no piloto | Implementada; teste real pendente |
| E5 | Completar acesso, recuperação e preparação para lançamento | Configurações e validações pendentes |
| E6 | Aprovar uso em Android, iPhone, tablet e computador | Itens antigos 29–30 incluídos; teste real pendente |
| E7 | Organizar dados reais e rascunhos autorizados pelo dono | Itens antigos 26–28 pendentes |
| E8 | Rodar piloto e decidir liberação com evidência | Não iniciado nesta revisão |

E2–E4 verificam o que já existe; não reconstroem os módulos. E5 inclui pendências de lançamento já previstas na fonte da verdade. Omni Conector e recuperação de senha ficaram fora das **30 correções originais** por decisão do dono: sua preparação/teste aparece aqui, sem autorização automática para alterar seu desenho. Recursos futuros da seção final não bloqueiam a conclusão do escopo atual.

## E1 — fechar falhas de confiabilidade

### R01 — retomar reposição depois de fechar o app

- [ ] **Corrigir e validar.** Limitação confirmada no código e no item antigo 5: o PIN por cima preserva a tela, mas fechar o app perde a etapa da reposição. `ReporGondola.tsx` mantém a tela/ID em estado de memória e cria novo ID ao iniciar outra vez.
- Critério: fechar/reabrir antes de contar, depois de contar e depois de levar a mercadoria retoma a operação correta. Envio sem resposta recupera os mesmos dados e ID antes de começar outro. Dois cliques, duas abas e resposta atrasada não transferem em dobro. Conferir depósito, área de venda e `operacoes` na mesma transação.
- Estado: **pendente de correção**. Próxima entrega; a persistência existente deve ser reaproveitada, sem criar tabela sem aprovação.

### R02 — proteger pedido em conferência também no banco

- [ ] **Reproduzir o cenário concorrente e corrigir se necessário.** O item 11 esconde cancelar/reenviar/link quando a consulta mostra conferência. A versão de `cancelar_pedido` em `20261011062555_cancelar_pedido_limpa_conta.sql` recusa situações fechadas, mas não consulta recebimento em contagem. Não está comprovado que os demais caminhos impeçam a corrida em produção.
- Critério: dono com tela antiga não cancela ou altera indevidamente um pedido após a equipe começar a contar. Testar cancelar, reenviar, renovar link e responder pelo link antigo junto com abrir/concluir recebimento. Recusas devem ser claras; nenhum estado parcial, conta indevida ou estoque alterado por uma ação recusada.
- Estado: **a verificar no fluxo completo**; antes de SQL, comparar as definições atuais do banco com os arquivos. Não retirar permissões de todas as funções nem alterar o fluxo público do fornecedor.

### R03 — mostrar falha de consulta do fiado

- [ ] **Corrigir e validar.** Em `PainelFiado.tsx`, a falha de `api.carregar` é ignorada; sem dados, o quadro desaparece. Consulta que falhou pode parecer ausência de fiado; atualização posterior pode deixar valor antigo sem aviso.
- Critério: diferenciar “não há clientes” de “não foi possível consultar”; oferecer nova tentativa e identificar dados anteriores. Testar primeira consulta, atualização, surgimento do primeiro cliente, pagamento e cancelamento; resposta antiga não substitui consulta mais recente nem dados de outro comércio.
- Estado: **pendente de correção**. O item 13 corrigiu a frequência da leitura; não encerrou esta falha de comunicação.

### R04 — não esconder falha ao guardar rascunho de recebimento

- [ ] **Corrigir e validar.** `guardarRascunho` em `src/lib/recebimento.ts` ignora erro de armazenamento; a contagem ainda não enviada pode deixar de ser recuperável sem aviso. A fila de operações já enviadas tem outra proteção; não confundir os dois casos.
- Critério: simular armazenamento indisponível/cheio, rascunho ilegível e fechamento do app. Informar quando não foi possível guardar; não anunciar recuperação garantida. Preservar separação por acesso, pedido e fornecedor, inclusive “Não sei”, e nunca descartar envio sem resposta.
- Estado: **pendente de correção**; preservar as garantias dos itens 9–10.

### R05 — confirmar abertura do Caixa sem internet após fechar o app

- [ ] **Testar em aparelhos reais; corrigir se falhar.** O Caixa tem dados e fila locais, mas `public/sw-funcionario.js` não mantém os arquivos do app em cache. Trabalhar offline com tela já aberta não comprova reabrir o app instalado offline.
- Critério: com acesso validado e turno já aberto online, fechar completamente, desligar internet, reabrir, passar pelo PIN, vender e reconectar. A fila é enviada uma vez; não se abre outro turno indevidamente. Mostrar quais ações exigem conexão. Não estender promessa de escrita offline a todos os módulos.
- Estado: **a verificar**. Executar com E6 e item antigo 29; a ausência de cache no service worker, isoladamente, não comprova falha em todos os navegadores.

**Saída de E1:** R01, R03 e R04 corrigidos; R02/R05 com cenário aprovado ou falha corrigida. Qualquer teste físico adiado permanece explicitamente pendente e impede encerrar a validação geral.

## E2 — jornada do dono, cadastro e pedidos

- [ ] **E2.1 Conta e comércio:** entrar, sair, criar conta, e-mail repetido, editar nome/foto, cadastrar e editar comércio, CEP válido/inválido/sem conexão. Conferir isolamento ao trocar comércio ou usuário; voltar da ficha/cadastro para a mesma aba/pedido.
- [ ] **E2.2 Produtos nos seis tipos:** testar ao menos um cadastro completo de Mercado, Farmácia, Roupas, Construção, Pet e Autopeças. Nomes/unidades corretos; exigências próprias de validade/tarja/tamanho/cor; preço e prejuízo; embalagem e código; limites e locais; salvar, editar, desistir, duplicidade e envio sem resposta. Não reusar dados reais como massa de teste.
- [ ] **E2.3 Estoque inicial e ficha:** área não contada permanece “não contado”; contagem inicial não soma novamente uma entrada anterior. Lista, ficha, locais e avisos concordam com `saldos`; quantidade, validade e unidade corretas. Impressão A4/térmica e leitura da etiqueta devem corresponder ao produto/variação.
- [ ] **E2.4 Fornecedor e compra:** criar/editar fornecedor; montar pedido pelo depósito; custo por embalagem/unidade e total arredondado iguais antes/depois de salvar, incluindo o caso 12 × R$ 0,83333333 = R$ 10,00. Enviar link, fornecedor aceitar/recusar/ajustar, entrega parcial, recebido, cancelamento e histórico coerentes.
- [ ] **E2.5 Pagamento de compra:** entrega e pagamento independentes; conta aberta, paga, vencida, pedido recusado/cancelado e pagamento já realizado exibidos corretamente. Alertas, filtros e resumo do comércio concordam; cancelamento não apaga pagamento histórico.

**Saída de E2:** um roteiro completo por tipo com evidência e todas as condições relevantes de compra aprovadas. Não exigir que o dono repita os mesmos testes para cada pequeno ajuste visual.

## E3 — operação e fechamento do estoque

- [ ] **E3.1 Equipe:** código/QR, PIN, instalar, bloquear/desbloquear, trocar acesso, sair, tentativas erradas e vencimento da sessão. Ao destravar voltar ao trabalho; acesso revogado não continua gravando. Funcionário não vê quantidade esperada na contagem cega.
- [ ] **E3.2 Receber com pedido:** contar por embalagem/unidade; validade/lote; avaria; “Não veio”; envio parcial; recontagens até três; concluir e pendência para o dono. Quantidade contada, conferência, conclusão e entrada no estoque nunca aparecem como a mesma coisa.
- [ ] **E3.3 Receber sem pedido:** fornecedor A, B e “Não sei” com rascunhos separados; retomar/desistir de contagens não enviadas; proteger envio sem resposta e acesso por outra aba. Entrega avulsa concluída chega ao dono; em contagem não vira entrada liberada.
- [ ] **E3.4 Decisão do dono:** produto fora do pedido, divergência, variação removida/restaurada e código ocupado. Aceitar entra somente mercadoria boa e liberada; devolver/recusar não entra. Decisão repetida ou simultânea não duplica quantidade, lote ou operação.
- [ ] **E3.5 Repor:** contar área de venda antes de indicar quanto buscar; respeitar mínimo/máximo, disponibilidade e validade, usando primeiro os lotes que vencem antes. Zero levado não anuncia transferência. Retomar interrupções conforme R01. Depósito cai exatamente o que a área recebe.
- [ ] **E3.6 Conferir depósito:** seleção diária e produto visado, contagem cega, rodada, duas iguais/três diferentes, escolha do dono, troca de dia e perda de resposta. Reenvio da mesma rodada não vale como outra contagem; revisão escolhe o saldo correto uma vez.
- [ ] **E3.7 Perdas e diferenças:** dono/equipe registrar cada motivo; impedir quantidade inválida ou acima do disponível; confirmar ou “Não aconteceu”; explicar diferença e escolher contagem. Cada efeito em estoque tem `operacoes` na mesma transação, com origem verificável.
- [ ] **E3.8 Antifurto e alertas:** falta em reais pelo custo, erro de contagem à parte, limites mensais, produto visado, lugar, mês/fuso, relatório por comércio e soma de todos. Quem contou não é apresentado como culpado; intervalo de descoberta não inventa hora do furto.
- [ ] **E3.9 Dois aparelhos:** receber/repor/vender/conferir o mesmo produto em horários próximos; nenhum saldo misturado, transferência em dobro ou atualização perdida. Tela antiga deve atualizar ou recusar com orientação, sem sucesso falso.

**Roteiro mínimo com números conhecidos, em ambiente de teste:** começar com depósito 20/área de venda 10; aceitar 8 boas → 28/10; repor 5 → 23/15; vender 3 → 23/12; cancelar essa venda → 23/15; perda de 2 na área → 23/13. Conferir saldos, lotes e registros após cada passo. Testar depois embalagem e variação. “Não contado” tem roteiro separado; não inventar zero para iniciar essa conta.

**Saída de E3:** a cadeia física e a conta do sistema fecham, com estados e registros verificáveis; nenhuma falha conhecida de duplicação, omissão ou acesso cruzado permanece aberta.

## E4 — vendas, caixa e fiado

- [ ] **E4.1 Caixa no celular:** ligar caixa, abrir turno, fundo inicial, bipar/buscar, unidade/embalagem/variação e avulso. Finalizar em dinheiro, Pix, cartão e pagamento misto; troco e valores iguais no comprovante, lista e fechamento. Bipar/desistir antes de finalizar não desconta estoque.
- [ ] **E4.2 Fila e cancelamento:** perder resposta após finalizar, reenviar, fechar/reabrir com pendências, reconectar e cancelar venda autorizada. Uma venda e uma baixa por ID; cancelamento devolve somente o que saiu, uma vez; recusas definitivas explicadas em português.
- [ ] **E4.3 Fiado:** cliente novo/existente, venda fiada, dois recebimentos seguidos, pagamento parcial/total, valor acima da dívida, cancelamento e outro comércio. Dívida e recebimentos batem e atualizam sem esconder erro (R03). Confirmar movimentação financeira no lugar correto, sem contar recebimento duas vezes.
- [ ] **E4.4 Fechamento:** retirada da gaveta, valor esperado × contado, sobra/falta, PIN do dono, autorização e histórico. Dinheiro separado de Pix/cartão/fiado; fechamento antigo com diferença não resolvida continua visível; ausência de vendas antigas carregadas não vira zero falso.
- [ ] **E4.5 Vendido sem cadastro:** mesmo nome sem código agrupa; código do caixa ligado a produto/embalagem/variação, ou “não controlar”; correção repercute nas vendas pendentes e próximas como previsto. Roupa sem tamanho/cor pede a escolha correta; quantidade fracionada tem orientação própria.
- [ ] **E4.6 Omni Conector, se usado pelo piloto:** testar XML real compatível do PDV em computador com Chrome, venda finalizada e cancelamento. Mesma chave fiscal de 44 números não duplica; código de ligação tem 8 números; revogação bloqueia. Conferir leitura da pasta, retomada e fila com internet interrompida. Não presumir compatibilidade com qualquer marca de caixa nem criar integração nova nesta etapa.

**Conta mínima em teste:** fundo R$ 50 + venda em dinheiro R$ 20 − retirada R$ 10 = gaveta R$ 60; venda Pix R$ 15 não aumenta gaveta. Acrescentar cenários de troco, cancelamento e recebimento de fiado, conferindo o movimento previsto em cada caso.

**Saída de E4:** fechamento de dinheiro e baixa de estoque conciliados. O piloto registra se usa Caixa móvel, Conector ou ambos; caminho não testado não é anunciado como aprovado.

## E5 — acesso, recuperação e lançamento

- [ ] **E5.1 E-mail:** confirmar configuração atual de envio e limites; completar o serviço de e-mail próprio já previsto se necessário. Receber confirmação/reenvio/recuperação de verdade; abrir link válido, expirado e reutilizado; salvar nova senha e entrar com ela. A interface já existe: falta comprovar entrega e fluxo completo, não criar outra recuperação.
- [ ] **E5.2 Google:** verificar modo atual, consentimento, domínio e redirecionamentos de produção; o histórico informa modo de teste. Testar conta que não seja apenas usuário de teste antes de liberar ao público.
- [ ] **E5.3 Senhas e acessos:** dono conferir/ativar proteção contra senhas vazadas no painel, se continuar desligada. Testar dois donos, dois comércios, funcionário bloqueado, chave vencida e link revogado; escrita direta no estoque recusada e RLS preservada. Funções públicas protegidas por chave/token não são retiradas indiscriminadamente. A revisão dos avisos do item 9 já foi encerrada; nova verificação é necessária quando uma nova mudança de banco a exigir.
- [ ] **E5.4 Termos e Privacidade:** completar os documentos e pontos de acesso previstos na Fase 6; conteúdo e contato aprovados pelo dono. Não criar módulo novo de negócio para isso.
- [ ] **E5.5 Recuperação operacional:** verificar política real de backup/retenção do projeto; registrar como recuperar dados, acesso e versão do app; testar restauração em ambiente separado. Não restaurar por cima da produção durante o teste e não presumir recurso pago habilitado.
- [ ] **E5.6 Banco e publicação:** nas funções alteradas, comparar banco × arquivo, simular recusas e efeitos com rollback, aplicar/registrar migração e verificar resultado. Anotar versão publicada; não confundir PR mesclado com app atualizado. Verificar erros observáveis após a publicação e orientar como o dono os informa.

**Saída de E5:** usuário consegue entrar e recuperar acesso; procedimentos e condições externas de lançamento documentados. Falta de acesso a painel não vira item marcado como concluído. E-mail/Google/termos pendentes devem aparecer na decisão de piloto e ser encerrados antes de abertura pública.

## E6 — aparelhos e clareza das telas

- [ ] **E6.1 Android:** dono, Omni Operação e Caixa com instalação distinta, abrir pela tela inicial, câmera/permissão recusada/digitação, PIN, teclado, voltar, fechar/reabrir. Executar recebimento/reposição/conferência/perda e caixa (itens antigos 29–30).
- [ ] **E6.2 iPhone:** repetir fluxos de operação e caixa, instalação pelo Safari, áreas seguras e câmera; testar retorno após suspensão. Aprovação em navegador de computador não substitui esta prova.
- [ ] **E6.3 Tablet/computador:** cadastro, leitura das abas, pedido/link do fornecedor, decisões do dono, vendas, impressão; sem botões escondidos ou navegação perdida. Conector somente no ambiente compatível verificado.
- [ ] **E6.4 Tela pequena e teclado:** 320 px de largura, aparelho do piloto e tablet; sem corte horizontal, campo encoberto ou ação inacessível. Telas informam tarefa, estado, próximo passo e efeito da ação; “falta contar”, “contado”, “enviado”, “concluído”, “aguarda dono” e “entrou no estoque” usados com precisão.
- [ ] **E6.5 Internet e versão:** interromper rede durante ação e atualização; manter últimos dados com aviso, recuperar IDs e não mostrar sucesso antes da confirmação. Testar R05 com app fechado, atualização da versão instalada e mensagem de app desatualizado sem perda de operação pendente.

**Saída de E6:** registrar modelo/aparelho, navegador, data, versão publicada e resultado. Qualquer aparelho não testado permanece pendente; não marcar Android/iPhone juntos com evidência de apenas um.

## E7 — dados, somente com confirmação específica do dono

- [ ] **E7.1 Item antigo 26:** verificar se “Supermercado bom preço”, “Mercado bom preço”, “Molines” e “Mercado são judas” ainda são testes. Mostrar ao dono a lista concreta e vínculos antes de qualquer alteração; manter ou desativar pelos mecanismos existentes conforme decisão. Não executar limpeza em massa.
- [ ] **E7.2 Item antigo 27:** obter código físico correto do Arroz e consultar situação atual da Dipirona/Farmavida. O vencimento de 05/10 é registro anterior, não nova consulta. Se ainda houver produto vencido à venda, separar fisicamente e registrar pelo fluxo de perda/devolução adequado. Não inventar código ou validade para retirar alerta.
- [ ] **E7.3 Item antigo 28:** consultar as duas contagens avulsas de Estilo e cia/Supermercado União; identificar enviado, pendente sem resposta e rascunho vazio. Só descartar o que puder ser descartado com segurança e autorização; preservar entregas, estoque aceito e histórico.
- [ ] **E7.4 Base do piloto:** conferir catálogo, códigos reais, embalagens, custo/preço, fornecedores, validade e locais; fazer contagem inicial física de depósito e área de venda. Identificar dados de teste e reais sem mudar saldos silenciosamente.

**Saída de E7:** base conferida e cada alteração aprovada com relação exata do que mudou. Nenhuma ação nos dados é autorizada apenas por estar escrita neste checklist.

## E8 — piloto no mercadinho e aprovação final

- [ ] **E8.1 Preparar:** escolher o mercadinho, aparelhos, equipe, caixa utilizado e pequeno conjunto de produtos reais com unidades/embalagens/validade representativas. Dono aprovar início e limitações externas explicitadas. R01–R04 e qualquer falha de estoque/dinheiro/acesso têm de estar resolvidas antes de usar o caminho afetado.
- [ ] **E8.2 Executar:** no app publicado, cadastro → pedido/link → recebimento → depósito → reposição → venda → cancelamento/fiado → perda/conferência → decisão do dono → alertas → fechamento. Incluir entrega parcial, contagem diferente, internet interrompida e acesso bloqueado; não provocar dano real para testar recusas.
- [ ] **E8.3 Conciliar:** comparar contagem física, `saldos`, movimentos, `operacoes`, compras/pagamentos, vendas/fiado e dinheiro da gaveta. Diferenças legítimas devem ter origem e resolução; nenhum número inexplicado é aceito como “está funcionando”.
- [ ] **E8.4 Registrar:** dono responde por cenário “funcionou/não funcionou”; anexar evidência sem credenciais ou dados pessoais desnecessários. Falha vira tarefa específica, com reprodução e novo teste do trecho afetado.
- [ ] **E8.5 Liberar:** todos os itens obrigatórios aplicáveis aprovados, nenhum defeito conhecido que bloqueie fluxo/estoque/dinheiro/acesso, configuração de lançamento concluída para abertura pública e aceite do dono registrado. Itens fora do caminho do piloto continuam visíveis como não validados; recursos opcionais não viram obrigação escondida.

**Conclusão permitida:** “escopo atual aprovado nos cenários e aparelhos registrados”. Não declarar todo o sistema concluído se houver item crítico pendente, SQL só preparado, atualização não confirmada ou teste real sem resultado.

## Futuro — não é correção nem condição automática do piloto

Gerente com permissões novas, integração direta por API com marcas de PDV, balança específica e avisos automáticos por WhatsApp/e-mail dependem de desenho e autorização próprios. O **Caixa no celular já existe**; eventual caixa adicional no computador não deve ser confundido com ele. Não criar essas funções para aumentar a lista de “o que falta”.

## Registro das etapas

| ID | Código/testes | Banco/publicação | Teste do dono | Próximo passo |
|---|---|---|---|---|
| E1 / R01 | Pendente | Não alterados nesta revisão | Pendente | Reproduzir fechamento e implementar retomada |
| R02 | Cenário a verificar | Comparação atual pendente antes de mudar SQL | Pendente | Testar corrida entre pedido e conferência |
| R03 | Pendente | Sem mudança preparada | Pendente | Explicar falha de consulta do fiado |
| R04 | Pendente | Sem mudança preparada | Pendente | Tratar falha de rascunho local |
| R05 | Teste real pendente | Sem mudança preparada | Pendente | Testar reabertura offline com E6 |
| E2–E4 | Módulos existentes; validação conjunta pendente | Publicação atual não confirmada nesta revisão | Pendente | Executar roteiros após correções |
| E5 | Parte existe; configuração/validação pendente | Depende de painel/serviços quando aplicável | Pendente | Conferir situação e concluir lançamento |
| E6 | Automatizados não substituem aparelhos | Versão a registrar no teste | Pendente | Android, iPhone, tablet e computador |
| E7 | Dados antigos não reconsultados nesta revisão | Nenhum dado alterado | Depende do dono | Lista concreta e base do piloto |
| E8 | Não iniciado | Nenhuma liberação feita nesta revisão | Pendente | Piloto e conciliação |

Quando uma tarefa avançar, atualizar sua linha com data e link do PR/registro. Se o próximo item mudar por gravidade de uma falha nova ou orientação do dono, atualizar a indicação no início deste arquivo e na seção 13 da fonte da verdade.
