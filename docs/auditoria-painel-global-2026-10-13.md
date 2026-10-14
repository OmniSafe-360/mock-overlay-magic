# Auditoria do painel global do dono — 13/10/2026

Registro complementar da **seção 16 da FONTE_DA_VERDADE.md**, frente RMC do CHECKLIST_PONTA_A_PONTA.md. Não constitui checklist concorrente. Base inspecionada: `e169e89477b7c602ccef8c3d551a1344e9b55a37` (main). Pedido: analisar e organizar em etapas; nenhuma mudança funcional aplicada nesta entrega.

## Decisão do dono e objetivo

**Início é o painel global do proprietário**, tenha ele um único comércio ou seis de tipos diferentes (mercado, farmácia, roupas, construção, pet shop e autopeças). A aba **Comércios** já é a entrada para cadastrar/abrir cada unidade. Preservar essa separação, o menu de cinco destinos e os fluxos dentro das unidades.

O painel deve responder: **quanto vendi, o que precisa de atenção e em qual comércio devo agir**. Usar “comércios” e “área de venda” no consolidado; dentro de cada unidade manter os nomes do respectivo tipo. O painel agrega informações, não mistura permissões, estoque ou operações das lojas. Ações de escrita continuam vinculadas ao comércio correto e às confirmações existentes do dono.

## O que existe e deve ser aproveitado

| Parte atual | Comportamento verificado | Direção proposta |
| --- | --- | --- |
| Cabeçalho global | Saudação, sino, quantidade de comércios e quantidade com dados completos | Identificar “Seus comércios”, período e atualização; reduzir títulos repetidos |
| Vendas hoje | Soma vendas finalizadas do dia, em centavos, com data de referência America/Sao_Paulo | Preservar cálculo; chamar de vendas, nunca de lucro ou dinheiro disponível |
| Ver vendas | Um comércio abre suas Vendas; vários abrem seleção na aba Comércios | Preservar entrada/retorno; futuramente mostrar contribuição por comércio sem misturar operações |
| Faltou este mês | Soma de `faltouMes` das diferenças aceitas por `ehFalta`, com acesso ao relatório geral | Explicar o período e a origem; não apresentar como prova de furto ou resultado financeiro |
| Resolver agora | Soma assuntos diferentes: produtos urgentes, contas atrasadas, recebimentos para decidir, códigos sem cadastro e diferenças/perdas pendentes | Usar “pendências”; discriminar assunto e comércio no destino. Não dizer “N produtos” |
| Repor / Comprar / Validade | Mesmas regras de produtos e pedidos da unidade; já pedidos não entram em Comprar | Manter regras e mostrar produtos por comércio; não somar unidades, kg, litros e metros como um estoque global |
| Alertas | Seções por comércio, mais urgentes primeiro; acessos a produtos, contas, pedidos, vendas e diferenças | Reaproveitar para o detalhamento dos indicadores, levando ao assunto tocado |
| Comércios | Lista/grade, cadastro, primeiros passos, entrada em cada unidade | Manter aqui; não duplicar a lista inteira no Início |
| Equipe / Conta | Destinos existentes no menu global | Não alterar nesta frente; organização de Equipe tem etapa RMC-03 própria |
| Consulta parcial | Quatro indicadores menores distinguem total/subtotal/indisponível; Tentar de novo | Preservar C2 e estender coerência visual aos demais contextos, em etapa própria |
| Sem comércio | Orientação com botão Ir para Comércios | Preservar, sem números de exemplo apresentados como reais |

Referências: `src/components/OwnerHome.tsx` (`OwnerApp`, `HomeContent`, `disponibilidade`, `Alertas`), `src/lib/resumoGeral.ts`, `src/components/AtencaoHoje.tsx`, `src/lib/vendas.ts`. Os relatórios e as regras operacionais permanecem nos módulos atuais.

## Problemas confirmados

### 1. Sobreposição de títulos — prioridade imediata

No Chromium, com um ou seis comércios, o cabeçalho global termina em **y=129** e o título “Resumo de hoje” começa em **y=113** (390 px). O `className="-mb-4"` no cabeçalho permite invasão de 16 px. É um defeito visual reproduzido, não somente impressão da captura do dono.

Os dois cartões financeiros usam `h-full` dentro de um contêiner que também contém seu título. O cartão ocupa a altura inteira do contêiner e soma o espaço do título por fora: na simulação 390 px, o cartão Vendas termina em **y=295,5**, enquanto o título seguinte começa em **y=283,5**. Em 1280 px, os cartões terminam em **y=303,5** e o título Pendências começa em **y=295,5**. Remover a altura indevida e a margem negativa é a primeira correção proposta, sem mudar cálculos ou destinos.

### 2. Valores grandes e tablet estreito

Seis comércios fictícios somaram **R$ 7.407.407,34**. Em 320 px, o texto do valor vai até **x=247,89**, enquanto o texto lateral começa em **x=217,16**, com faixas verticais coincidentes. Em 768 px, a barra lateral de 240 px e a grade de dois cartões deixam espaço insuficiente: o valor atravessa o limite do cartão. `min-w-0` sozinho não faz o valor caber.

Precisamos de uma segunda correção pequena: arranjo vertical do conteúdo em espaço estreito, status/ação em linha própria e decisão de colunas baseada no espaço útil. Não ocultar centavos, truncar valores ou abreviar milhões sem mostrar o valor completo. Validar ampliação de texto e não apenas largura da página; ausência de rolagem horizontal não garante ausência de sobreposição.

### 3. Botões de assuntos diferentes levam ao mesmo destino genérico

Os quatro indicadores menores chamam `onAlertas` sem passar assunto. No navegador, tocar “Para repor” abriu Alertas com seis seções de comércios, sem seleção do tema. O acesso existe, mas obriga o dono a procurar novamente o que acabou de tocar.

Proposta para C4/RMC-04: passar contexto de leitura (assunto e, quando escolhido, comércio), reaproveitar Alertas/AtencaoHoje e seus destinos. Com uma unidade, mostrar suas pendências daquele assunto; com várias, somente as unidades pertinentes, sempre identificadas. “Ver todos os alertas” deve permanecer acessível e Voltar deve restaurar a origem. Nenhum toque em indicador executa reposição, compra ou ajuste.

### 4. Escopo, período e atualização podem ser mais claros

**Inconsistência de descrição confirmada:** o texto do cartão diz “Faltas e perdas de mercadoria registradas no mês”, mas `totalAntifurto` soma `alertas.faltouMes`, calculado apenas a partir de diferenças aceitas por `ehFalta`. A lista de perdas é tratada separadamente no relatório e não é somada diretamente a esse indicador. Ajustar a descrição ao cálculo em C4-A; não somar perdas por conta própria (poderia duplicar fatos e mudar a regra). Preservar a distinção entre diferença ainda em revisão, falta considerada pela regra e perda registrada.

“Resumo de hoje” abrange também “Faltou este mês”. Há repetição entre “Visão geral”, “Resumo” e “Resultado”. Propor um único título global e períodos em cada bloco; não alterar o intervalo de cálculo.

Hoje não há botão geral de atualizar sempre disponível nem horário explícito da última leitura concluída. Há atualização ao entrar, voltar à aba/ficar visível e recuperar conexão; “Tentar de novo” aparece em erro. Propor um comando Atualizar usando o carregamento existente e informar atualização/consulta incompleta com precisão. Não rotular todo o painel como atualizado se uma unidade falhou. Isso não equivale a monitoramento em tempo real.

Os quatro indicadores menores excluem saldos de leitura antiga durante atualização/falha. O sino e a lista Alertas usam `visao.total`/`visao.resumos`, que podem manter produtos da última leitura quando uma atualização falha. Existe aviso de consulta incompleta, mas a política de subtotal não é uniforme. Tratar em C4, com reprodução automatizada de falha após sucesso antes de corrigir; não declarar toda informação antiga como confirmada nem apagá-la como se fosse zero.

### 5. Crescimento exige uma etapa separada de medição

`carregarGeral` chama fornecedores uma vez e oito funções de leitura por comércio (produtos, pedidos, vendas, pendências de venda, diferenças, limite, funcionários e caixas). Seis unidades iniciam **49 chamadas de funções do cliente**; algumas podem gerar mais requisições internas. Isso não é medição de 49 chamadas HTTP nem comprovação de lentidão em produção.

Funcionários/caixas atendem Primeiros passos em Comércios, mas são consultados junto do painel. Avaliar carregamento sob demanda e resumo paginado/agregado na frente G5, após medir com volume representativo. Não criar função SQL de resumo, mudar consultas ou banco junto de uma correção de layout. O ensaio visual com seis unidades não prova capacidade para grandes redes.

## Organização recomendada para a tela

1. **Cabeçalho:** saudação curta; “Visão geral dos seus comércios”; “6 comércios” ou “1 comércio”; situação da atualização; sino com significado consistente.
2. **Vendas de hoje:** valor e quantidade de vendas confirmadas; data; Ver vendas com a seleção já existente. Valor completo e legível.
3. **Precisa da sua atenção:** Resolver agora, Repor, Comprar e Validade. Contagem com unidade clara, cor com texto/ícone, cada botão leva ao assunto correspondente e identifica o comércio.
4. **Faltou este mês:** valor das faltas conforme a regra vigente, período e acesso ao relatório existente; apresentação secundária, sem confundir perda de mercadoria com lucro/prejuízo contábil.
5. **Menu global existente:** Início, Comércios, Alertas, Equipe, Conta. Abrir uma unidade mostra nome/tipo e Voltar retorna ao contexto correto.

A mudança de ordem acima é **proposta**, não aplicada. Primeiro corrigir a legibilidade dos blocos atuais; só depois revisar prioridade/ordem com o dono.

### O que vale acrescentar depois, sem lotar o Início

- **Pendências aguardando o dono**, detalhadas por assunto/comércio, reaproveitando recebimentos, diferenças e contas existentes. Antes de destacar número novo, confirmar precisamente quais registros compõem a contagem e evitar duplicar Resolver agora.
- **Conferências pendentes**, se a auditoria do fluxo confirmar fonte confiável, separadas de reposições e de divergências já abertas. Não inferir contagem pendente apenas por estoque baixo ou chamar toda diferença de falta confirmada. Desenho e arquivos precisam ser apresentados antes.
- **Comparação simples por comércio** ao abrir o detalhe das vendas, usando leituras existentes, se o dono desejar. Evitar classificação de “melhor/pior” comparando lojas de tamanhos e tipos diferentes sem contexto.
- Contas a pagar/fiado, situação dos caixas, gráficos, filtro global de comércio/período: avaliar em entregas próprias somente se houver necessidade e fonte completa. Não acrescentar quatro painéis financeiros para repetir módulos atuais; não chamar faturamento de lucro; não criar um filtro que mude silenciosamente o escopo de Equipe/Conta.

A tela inicial deve continuar útil com uma unidade e permanecer curta com seis: a quantidade de cartões principais não cresce seis vezes. Detalhes ficam por assunto/unidade, com busca ou paginação quando o volume exigir.

## Etapas pequenas na frente RMC

| Ordem | Identificador | Entrega e aceite | Situação |
| --- | --- | --- | --- |
| 1 | RMC-02C/C3-A | Corrigir margens/alturas que sobrepõem títulos; manter textos, valores, ações e ordem. Nenhum cartão invade outro grupo em 320/390/768/1024/1280 px | Implementada com autorização do dono; publicação e teste manual pendentes |
| 2 | RMC-02C/C3-B | Valores grandes, texto ampliado, nomes longos e tablet; leitura completa e alvo de toque adequado | Implementada em main; publicação/teste manual pendentes |
| 3 | RMC-04/C4-A | Clareza dos títulos/períodos e ordem dos blocos; manter significado dos totais, neutro entre tipos | Integrada no PR #128; publicação/teste manual pendentes |
| 4 | RMC-04/C4-B | Destino específico dos indicadores, comércio identificado e retorno preservado; reaproveitar Alertas | Integrada no PR #130; publicação/teste manual pendentes |
| 5 | RMC-04/C4-C | Atualização explícita e coerência de leitura parcial, inclusive sino/detalhes; falha nunca vira zero | C4-C1/C4-C2 implementadas; publicação/teste manual pendentes |
| 6 | RMC-04/C4-D | Avaliar necessidade de destaque para decisões/conferências; só implementar após mapear fontes e aprovação | Opcional, não implementada |
| 7 | RMC-06 | Regressão funcional e visual, publicação e homologação do dono em aparelho real | Pendente |

RMC-03/05 e G0–G8 continuam registradas, sem serem concluídas ou executadas por esta auditoria. G5 recebe o achado de custo de leitura. Atualizar a mesma fonte a cada etapa; não tratar C3 anterior como homologada enquanto há sobreposição reproduzida.

## Código proposto apenas para a primeira etapa C3-A

Arquivo funcional previsto: **`src/components/OwnerHome.tsx`**, somente `HomeContent`.

```diff
- <header aria-label="Visão geral" className="-mb-4">
+ <header aria-label="Visão geral">

- className="flex h-full w-full items-center gap-4 rounded-3xl border border-primary/50 bg-primary/10 p-4 text-left transition hover:border-primary">
+ className="flex w-full items-center gap-4 rounded-3xl border border-primary/50 bg-primary/10 p-4 text-left transition hover:border-primary">

- className={`flex h-full w-full items-center gap-4 rounded-3xl border p-4 text-left transition hover:border-primary ${af.faltou > 0 || af.alertas > 0 ? "border-destructive/50 bg-destructive/10" : "border-border bg-secondary/70"}`}>
+ className={`flex w-full items-center gap-4 rounded-3xl border p-4 text-left transition hover:border-primary ${af.faltou > 0 || af.alertas > 0 ? "border-destructive/50 bg-destructive/10" : "border-border bg-secondary/70"}`}>
```

Efeito: conteúdo passa a determinar altura e o cabeçalho deixa de puxar o título seguinte. Cartões podem ter alturas diferentes; a tela poderá ficar mais alta. **Esta etapa não resolve sozinha valores grandes** (C3-B). Não tocar no `h-full` do botão Adicionar comércio.

Arquivos de registro previstos na mesma entrega: `docs/FONTE_DA_VERDADE.md`, `docs/CHECKLIST_PONTA_A_PONTA.md`, `CLAUDE.md` e este relatório. Validação com testes existentes e navegador real; se um teste novo for necessário, apresentar o arquivo antes. Nenhuma migração, dependência, permissão, cálculo, rota ou regra de estoque faz parte de C3-A.

## Evidências, testes e limites

- Chromium real, componente **OwnerApp e CSS atuais**, dados fictícios, rede externa bloqueada. Larguras 320, 390, 768, 1024 e 1280 px; seis tipos de comércio, valores grandes. Zero erros JavaScript nesses cinco carregamentos. Defeitos geométricos e capturas confirmados.
- Fluxos locais: zero comércio leva a Comércios; um/seis exibem escopo; seis em Ver vendas pedem escolher unidade; cancelamento disponível; Repor leva à lista geral; falha de uma entre seis unidades mostra **Subtotal: 5 de 6 comércios** e vendas incompletas. Nenhuma chamada externa foi necessária.
- Experimento C3-A somente no DOM temporário, sem editar o aplicativo: em 390 px o cabeçalho terminou em y=129, o título seguinte passou a y=161 e os dois cartões passaram a terminar exatamente no limite do respectivo contêiner. Isso valida a direção do patch, não encerra a futura regressão nos demais tamanhos.
- Texto a 200% também inspecionado por captura. Este ensaio não representa aparelho real, sessão do dono, CSS efetivamente publicado no Lovable, banco real, acessibilidade completa ou carga de produção. Fonte do navegador: Inter quando disponível, fallback de sistema do ambiente.
- Artefatos locais da auditoria em `/tmp/omni-owner-audit`: scripts, capturas e medidas (`geometry.json`, `actions.json`). Não são dependência do aplicativo nem contêm dados reais.
- `npx tsc --noEmit` duas vezes e `npx vitest run` duas vezes aprovados: **1.049 testes em 101 arquivos em cada rodada**. Nenhum teste alterado/desativado. Não executado build novo: entrega estritamente documental; navegador usou Vite com componente/CSS reais em montagem isolada.

**Roteiro do dono após cada publicação funcional:** abrir em celular normal e com letras maiores; conferir um e vários comércios; tocar cada cartão; verificar nome da unidade, período e retorno; repetir com internet instável; confirmar que vendas/estoque/recebimentos continuam iguais nos fluxos existentes. Não prometer ausência absoluta de regressões: registrar evidência e manter pendência de teste real.

## Entrega C3-A

13/10/2026, base `main 04db8e1` (PR #125). O dono autorizou “Pode fazer a primeira etapa”. Aplicada **exatamente** a proposta de três trechos acima em `src/components/OwnerHome.tsx`; os outros quatro arquivos desta entrega são registros documentais. C3-B/C4 não executadas. Nenhum cálculo, texto, ordem, destino, migração ou teste existente modificado.

Chromium com OwnerApp/CSS reais e dados fictícios, rede externa bloqueada: **25 cenários aprovados**, cruzando cinco larguras (320/390/768/1024/1280) com um comércio, seis de tipos diferentes, falha de uma unidade, valores grandes e texto 200%. Asserções geométricas confirmaram separação cabeçalho/título, cartões dentro dos contêineres, separação do grupo Pendências e dos dois blocos no celular; zero erros JavaScript. Em 390 px cabeçalho termina em y=129 e Resumo começa em y=161.

A primeira versão do script externo usava uma asserção incorreta de empilhamento também para tablet com texto ampliado. Corrigido apenas o script temporário para respeitar a grade real a partir de 768 px; todos os 25 cenários repetidos passaram. Não foi necessário ampliar o patch do aplicativo. Fluxos adicionais preservados: entrada de cadastro sem comércio, seleção/cancelamento de unidade para vendas com seis comércios, Repor para Alertas, subtotal 5/6 e vendas incompletas quando uma unidade falha.

**Limite:** estas asserções não validam o espaço interno entre valor e texto lateral (C3-B); a sobreposição interna de valores/status em tablet continua registrada e exige a etapa seguinte. Dados e autenticação são simulados; não comprova aparelho do dono/publicação real/capacidade de produção. Artefatos: `/tmp/omni-owner-c3a/geometry.json`, `actions.json`, capturas e scripts locais, sem inclusão no aplicativo.

Validação local: `npx tsc --noEmit` **duas vezes** e `npx vitest run` **duas vezes**, com **1.049 testes em 101 arquivos aprovados em cada rodada**; `npm run build` aprovado com Supabase fictício sem acesso a produção. Nenhum teste adicionado, removido ou alterado. A inspeção visual é complementar aos testes existentes.

**Publicação e teste manual pendentes:** no Lovable, Publicar → Atualizar; abrir Início com um/vários comércios; conferir que os títulos não encostam nos cartões; tocar Vendas/Antifurto e voltar; comparar valores e pendências com o comportamento anterior. Esta etapa só encerra após o teste do dono. A próxima é C3-B e exige proposta/arquivos/impactos antes de aplicar.

## Entrega C3-B (13/10/2026)

Autorizada pelo dono. Só apresentação em `OwnerHome.tsx`: Vendas hoje e Faltou este mês ficam lado a lado quando o cartão tem pelo menos 26rem de largura; mais estreito, o valor ganha linha própria (todos os dígitos e centavos, quebra se for preciso) e status/ação vão para baixo com um separador discreto. Decisão pela largura do próprio cartão (container query), não da tela. Pendências: 1 coluna em espaço muito estreito, 2 a partir de 18rem, 4 a partir de 52rem; cartões com `min-w-0` e quebra de texto. Cálculos, textos, nomes acessíveis, botões e destinos iguais. Teste `src/test/rmc-c3b.test.tsx`; tipos e 102 arquivos de teste passaram duas vezes. Conferência visual no navegador com sessão real não feita neste ambiente. **RMC-02C/C3-B — Implementada no código, aguardando publicação e validação manual do proprietário.**

## Entrega em revisão — RMC-04/C4-A (13/10/2026)

**Implementação autorizada pelo proprietário, em branch separada e PR sujeito a revisão.** Base: `main 108332fe865d`. Referência de proposta documental: [PR #127](https://github.com/OmniSafe-360/mock-overlay-magic/pull/127), **não integrado**. Este registro descreve a nova branch de implementação e não encerra a etapa.

- `HomeContent` em `src/components/OwnerHome.tsx`: título da região de “Resumo de hoje” para **“Situação dos comércios”**; sequência visual **Resultado de hoje / Vendas hoje → Pendências que precisam de atenção → Resultado deste mês / Faltou este mês**. Preservados `aria-label="Resumo geral"`, nomes dos indicadores, `aria-label` dos botões, condições de carregamento, valores e `onClick` existentes.
- Descrição do cartão mensal ajustada para **“Valor das faltas identificadas nas diferenças do estoque neste mês”**, alinhada a `alertasAntifurto(...).faltouMes` e ao filtro `ehFalta` de `src/lib/antifurto.ts`. Perdas são registradas separadamente; nenhuma regra de antifurto ou soma foi alterada.
- A grade dinâmica dos quatro KPIs e as classes de container query da C3-B foram preservadas. A realocação dos cartões financeiros demanda nova conferência geométrica em 320/390/768/1024/1280 px e texto ampliado.
- Ajustada exclusivamente a ordem esperada no teste de apresentação C3 de `src/test/rmc-02c.test.tsx`. Adicionado `src/test/rmc-c4a.test.tsx` para título/semântica/ordem, preservação dos valores, subtotal e acesso a Alertas.
- Não houve alteração no banco, SQL, operações das lojas, `StoreSpace.tsx`, `src/lib/resumoGeral.ts`, `src/lib/antifurto.ts`, carga de dados ou destinos da navegação.

**Validação antes da integração:** o workflow de GitHub Actions no PR deve comprovar `tsc --noEmit` e Vitest completos em duas rodadas e `npm run build`. Resultados ainda não confirmados neste registro. A verificação visual completa (incluindo C3-B), a publicação `Publicar → Atualizar` e a homologação no aparelho do proprietário permanecem pendentes. **Não mesclar sem aprovação do proprietário.** C4-B/C4-C/C4-D, RMC-03/05/06 e correção autônoma de Alertas não foram iniciadas.

## Entrega C4-B em revisão — implementação autorizada (13/10/2026)

**Aprovação do proprietário:** implementar a proposta do [PR documental #129](https://github.com/OmniSafe-360/mock-overlay-magic/pull/129) em **branch e PR separados**, executar a suíte completa e **não integrar automaticamente nem iniciar C4-C**. Base de trabalho: `main bf7dae3bb26a`, C4-A aprovada na [verificação 38467066361](https://github.com/OmniSafe-360/mock-overlay-magic/actions/runs/38467066361).

- `OwnerHome.tsx`: os quatro KPIs transmitem uma chave tipada do assunto; `OwnerApp` guarda o filtro quando se entra num comércio e regressa à aba Alertas; menu e sino limpam o filtro. Botão “Ver todos os alertas” retira apenas o recorte visual.
- `AlertasFiltrados`: conserva a listagem antiga **sem filtro** para C4-C; usa os **IDs efetivamente válidos retornados por `disponibilidade` da C2**, com vendas/diferenças obrigatórias em “Para resolver agora”. Contagens por loja e subtotal apenas com dados confirmados; lojas incompletas listadas nominalmente como **sem confirmação**; não apresentar zero como certeza com consulta incompleta. Ordem quantidade de ocorrências ↓, nome, ordem de cadastro.
- `AtencaoHoje.tsx`: prop opcional `assuntoGlobal`, restringindo somente a **apresentação** aos grupos de produtos pertinentes e, em Resolver, aos itens urgentes, contas atrasadas, entregas, vendas sem cadastro e diferenças. Preserva os grupos, detalhes, ações e “Tudo certo!” originais no modo normal. Não conta diretamente os cartões de antifurto como Resolver.
- Teste novo `src/test/rmc-c4b.test.tsx` para indicadores, lojas, subtotal e falha, fornecedores, diferença/vendas, retorno, menu/sino e nenhum efeito operacional; teste existente `rmc-02c.test.tsx` atualizado apenas para verificar o contexto correto do clique.
- Sem mudanças em banco/Supabase, SQL, cálculo de `ResumoComercio`, `StoreSpace.tsx`, controles de vendas, reposição, pedidos, autenticação, RLS ou novos endpoints.

**Status:** implementado na branch de revisão, **ainda não integrado**, aguardando GitHub Actions, inspeção do diff e aprovação do dono. Testes locais e visuais reais não são reivindicados neste registro. **Publicar → Atualizar** e homologar no celular somente depois da aprovação e integração. A aba Alertas normal e o sino continuam com o problema previamente identificado de dados antigos; isso é escopo **C4-C**, não desta etapa.

## Situação conferida no GitHub e próxima proposta C4-C1

Consulta de 13/10/2026, base `main 8aca066`. Este registro atualiza a situação administrativa dos registros históricos acima: **C3-A, C3-B, C4-A e C4-B estão no main**. [PR #128](https://github.com/OmniSafe-360/mock-overlay-magic/pull/128) mesclado às 20h58m44s UTC, CI `38466127017` aprovado; [PR #130](https://github.com/OmniSafe-360/mock-overlay-magic/pull/130) mesclado às 21h35m56s UTC, CI `38469612409` aprovado. As frases anteriores “ainda não integrado/CI pendente” descrevem o momento das entregas, não o estado atual. Não reaplicar essas correções. Não há confirmação nesta tarefa de Publicar → Atualizar ou teste no aparelho do dono; manter os itens abertos para homologação.

**Faltam duas etapas principais do painel:** C4-C (atualização/coerência) e RMC-06 (regressão visual/funcional, publicação e teste manual). C4-D é opcional. RMC-03/05 e frentes G/E permanecem separadas, não encerradas por esta consulta.

Para manter entregas pequenas, C4-C fica dividida:

- **C4-C1, proposta pronta:** Atualizar no Início usando a leitura existente, sem criar chamadas de negócio; desabilitar o botão durante a leitura; sino usa disponibilidade C2 em vez de somar urgências antigas, distinguindo atualização/consulta incompleta; lista Alertas normal exclui produtos/pedidos antigos, preservando os avisos por loja e ações de leitura confirmadas.
- **C4-C2, ainda precisa de proposta:** estados/atualização dos valores financeiros e relatório geral durante leitura em andamento; avaliar a indicação de quando cada leitura foi concluída. Não chamar número em cache de “atualizado agora”. C4-C1 não resolve nem altera esses cartões/relatórios.

### Problema reproduzido e efeito para o dono

Após uma leitura com urgência na unidade B, se a próxima leitura de B falha, `visao.total` e `visao.resumos` ainda podem conter seus produtos antigos. Isso mantém a urgência no sino e a seção de B em Alertas sem filtro, embora o indicador C2/recorte C4-B já exclua B. Reproduzido em teste local do código atual; o botão Atualizar painel também não existe atualmente.

Proposta: sinal amarelo quando a consulta está incompleta, sem apresentar a antiga urgência como confirmada; aviso continua identificando qual comércio não foi confirmado. A seção dessa loja deixa temporariamente a lista geral. As outras lojas confirmadas continuam utilizáveis. Dados guardados não são apagados, “Tudo certo!” não aparece com consulta incompleta e Tentar de novo recupera a seção ao confirmar a leitura. Vendas ou diferenças indisponíveis não impedem mostrar a reposição baseada em produtos/pedidos atuais, mas o aviso de incompletude permanece.

### Arquivos exatos e limites da aplicação futura

1. `src/components/OwnerHome.tsx`: somente composição visual do sino, botão Atualizar em HomeContent e seleção dos dados atuais de Alertas sem filtro.
2. `src/test/rmc-c4c.test.tsx`: novo teste de cinco cenários (falha após sucesso no sino; lista geral/recuperação; clique/bloqueio de Atualizar; produtos confirmados com vendas indisponíveis; conta sem comércios).
3. `docs/auditoria-painel-global-2026-10-13.md`, `docs/FONTE_DA_VERDADE.md`, `docs/CHECKLIST_PONTA_A_PONTA.md`, `CLAUDE.md`: registrar a entrega e evidências.

**Impactos para validação prévia:** uma loja que falhou deixa de aparecer como confirmada em Alertas até uma leitura válida; o sino pode ficar amarelo por consulta incompleta, sem representar urgência de mercadoria confirmada. Atualizar repete leituras e fica indisponível enquanto aguarda. Nenhum ajuste automático, SQL, permissão, saldo, transação, rota, cálculo financeiro, formulário de comércio ou regra de compra/reposição é modificado. Preservar a função original de disponibilidade, os filtros C4-B e o retorno da unidade.

**Esta proposta foi construída apenas em cópia isolada** `/tmp/omni-owner-c4c-proposta/repo`; não está aplicada ao aplicativo oficial nem ao banco. A entrega atual publica somente os quatro registros documentais. O novo teste existe apenas na cópia até aprovação da aplicação.

### Código proposto para C4-C1

```diff
--- a/src/components/OwnerHome.tsx
+++ b/src/components/OwnerHome.tsx
@@ -240,6 +240,12 @@
     const gs = Object.values(geral);
     return { geral, resumos, alertas, decidir, antifurto, total: somaResumos(Object.values(resumos)), carregando: gs.some((g) => g.estado === "carregando"), erro: gs.some((g) => g.estado === "erro" || (g.estado === "ok" && (!g.vendas || !g.dif))) };
   }, [stores, geral, hojeGeral]);
+  // C4-C1: o sino usa os mesmos comércios confirmados de Resolver agora.
+  const dispSino = disponibilidade(stores, visao, true);
+  const urgentesSino = paraResolver(dispSino.soma);
+  const incompletoSino = stores.length > 0 && (dispSino.estado !== "total" || visao.erro);
+  const nomeSino = (urgentesSino ? `Alertas: ${urgentesSino} para resolver agora` : "Alertas")
+    + (visao.carregando ? "; atualizando" : incompletoSino ? "; consulta incompleta" : "");
   const [verAntifurto, setVerAntifurto] = useState(false);
   useEffect(() => { if (tab !== "inicio") setVerAntifurto(false); }, [tab]);
   // RMC-02B: o comércio abre por cima da aba atual; o Voltar devolve à aba (ou ao Antifurto) de origem.
@@ -435,10 +441,10 @@
               <span className="md:hidden"><LogoMark size={36} /></span>
               <p className="truncate text-lg font-bold">{owner ? `Olá, ${owner}` : "Olá!"}</p>
             </div>
-            <button type="button" aria-label={paraResolver(visao.total) ? `Alertas: ${paraResolver(visao.total)} para resolver agora` : "Alertas"} onClick={() => irPara("alertas")}
+            <button type="button" aria-label={nomeSino} onClick={() => irPara("alertas")}
               className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/60 text-foreground hover:border-primary">
               <Bell size={20} />
-              {(paraResolver(visao.total) > 0 || deOlho(visao.total) > 0) && <span className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${paraResolver(visao.total) ? "bg-destructive" : "bg-warning"}`} />}
+              {(urgentesSino > 0 || deOlho(dispSino.soma) > 0 || incompletoSino) && <span className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${urgentesSino ? "bg-destructive" : "bg-warning"}`} />}
             </button>
           </div>
         </header>
@@ -623,9 +629,12 @@
       })()}
       {modo === "inicio" && stores.length > 0 && (
         <section aria-label="Resumo geral">
-          <div className="mb-3 flex items-center justify-between gap-2">
+          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
             <h2 className="text-base font-semibold">Situação dos comércios</h2>
-            {visao.carregando && <span className="text-xs text-muted-foreground">Atualizando…</span>}
+            <button type="button" aria-label="Atualizar painel" disabled={visao.carregando} onClick={onTentar}
+              className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50">
+              {visao.carregando ? "Atualizando…" : "Atualizar"}
+            </button>
           </div>
           {visao.erro && !visao.carregando && (
             <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warning/60 p-3 text-sm">
@@ -848,10 +857,11 @@
   const hoje = useHoje();
   if (assunto) return <AlertasFiltrados stores={stores} visao={visao} suppliers={suppliers} onAbrir={onAbrir} onTentar={onTentar} assunto={assunto} onVerTodos={onVerTodos} hoje={hoje} />;
   const comId = stores.map((s) => ({ s, id: idDe(s) })).filter((x): x is { s: StoreData; id: string } => !!x.id);
-  const prontos = comId.filter((x) => visao.resumos[x.id]);
+  const idsConfirmados = new Set(disponibilidade(stores, visao, false).idsValidos);
+  const prontos = comId.filter((x) => idsConfirmados.has(x.id));
   const comAviso = prontos.filter((x) => paraResolver(visao.resumos[x.id]!) + deOlho(visao.resumos[x.id]!) > 0)
     .sort((a, b) => paraResolver(visao.resumos[b.id]!) - paraResolver(visao.resumos[a.id]!) || deOlho(visao.resumos[b.id]!) - deOlho(visao.resumos[a.id]!));
-  const completo = (id: string) => { const g = visao.geral[id]; return g?.estado === "ok" && !!g.vendas && !!g.dif; };
+  const completo = (id: string) => { const g = visao.geral[id]; return idsConfirmados.has(id) && g?.estado === "ok" && !!g.vendas && !!g.dif; };
   const semAviso = prontos.filter((x) => !comAviso.includes(x) && completo(x.id));
   const faltando = comId.filter((x) => !completo(x.id));
   const comFalha = faltando.some((x) => visao.geral[x.id]?.estado === "erro" || visao.geral[x.id]?.estado === "ok");
```

### Validação da proposta e aceite

- Cópia candidata: tipos duas vezes, **1.066 testes em 105 arquivos duas vezes**, `npm run build` aprovado com Supabase fictício. Os cinco novos testes exercitam comportamento; nenhum teste existente alterado. Focados: **41 testes em quatro arquivos aprovados** (C4-C1, C4-B, C2 e resumo geral).
- Reprodução inicial no código atual: o sino conserva urgência antiga após falha e não há Atualizar painel. Dois seletores do teste inicial eram ambíguos porque menu e sino compartilham “Alertas”; corrigidos somente no novo teste isolado. O primeiro rascunho também apresentou erro de escopo/tipagem; corrigido na cópia antes das duas rodadas completas, sem tocar o aplicativo oficial. Não atribuir essas falhas de preparação ao sistema publicado.
- Chromium: quatro cenários em **320/390/768/1280 px**, seis unidades/tipos, falha depois do sucesso, botão de 44 px, sino incompleto e exclusão da unidade antiga, preservando unidade confirmada. Zero erros JavaScript; componente/CSS reais da proposta, dados fictícios e rede externa bloqueada.
- Artefatos locais: `/tmp/omni-owner-c4c-proposta` (patch, testes/logs, capturas e resultado). Proposta ainda não aplicada; não representa sessão/aparelho do dono, banco real ou capacidade de produção. Os checks do PR documental validam o **código atual**, não aplicam nem publicam a proposta.


Após aplicação aprovada/publicação: tocar Atualizar; verificar bloqueio enquanto aguarda; simular internet instável e conferir nomes das lojas não confirmadas; abrir sino/lista normal e os quatro recortes C4-B; recuperar internet e repetir; conferir retorno e preservar acesso aos módulos operacionais. RMC-06 permanece pendente para aparelho real/volume/fluxos completos.

**Regra de autorização:** seção 0 da fonte: “antes de alterar o aplicativo ou o banco, apresentar o código proposto, a lista exata dos arquivos e os impactos para validação do dono”. O pedido atual autoriza conferir o que falta e preparar esta próxima correção; aplicar o patch acima depende da validação prévia da proposta concreta.

## Entrega C4-C1

13/10/2026, base `main 8ea2c8f` (PR documental #133). O dono aprovou a proposta concreta respondendo **“Pode fazer”**. Aplicado exatamente o patch acima, sem ampliação de escopo, em `src/components/OwnerHome.tsx` e novo `src/test/rmc-c4c.test.tsx`. Quatro documentos de continuidade atualizados. Os registros acima da proposta isolada descrevem a preparação anterior; nesta entrega a C4-C1 está aplicada ao código oficial.

- Atualizar usa `onTentar`/`carregarGeral`, com botão desabilitado durante a leitura; não cria gravação nem função de negócio.
- Sino usa a disponibilidade C2 para as urgências; rótulo distingue “atualizando”/“consulta incompleta” e sinal amarelo comunica consulta incompleta. Não mantém urgência antiga como confirmada após falha.
- Alertas sem filtro só exibe seções com produtos/pedidos confirmados; sem confirmação aparece no aviso pelo nome, Tentar de novo recupera. Falha de vendas/diferenças mantém acesso ao produto confirmado e avisa incompletude. Não retira dados guardados nem mexe em `products`, `pedidos`, banco ou estoque.
- Cálculos, filtros C4-B, regiões da tela, destinos, formulários operacionais e permissões mantidos. Cinco testes novos conforme proposta; nenhum teste existente modificado.

Validação após aplicação ao repositório oficial: `npx tsc --noEmit` **duas vezes**, `npx vitest run` **duas vezes**, **1.066 testes em 105 arquivos aprovados em cada rodada**, e `npm run build` com Supabase fictício aprovado. Comparação byte a byte confirmou que componente/teste aplicado é idêntico à proposta aprovada.

Chromium sobre componente/CSS **do código oficial aplicado**, dados fictícios/rede externa bloqueada: 320/390/768/1280 px, seis tipos de comércio, falha após leitura bem-sucedida, sino incompleto, ausência da unidade com dados antigos na lista, unidade confirmada presente e botão de 44 px; **quatro cenários aprovados, zero erros JavaScript**. Artefatos locais em `/tmp/omni-owner-c4c1`: logs, scripts, medidas e capturas. Sem aparelho/sessão/banco real; não comprova publicação ou carga de produção. Filtros e demais fluxos cobertos pela suíte existente, sem alteração de seus testes.

**Publicação/homologação pendentes:** Publicar → Atualizar no Lovable. No celular: abrir Início, tocar Atualizar e conferir bloqueio/“Atualizando…” enquanto aguarda; abrir Alertas pelo sino e pelo menu; conferir os recortes Repor/Comprar/Validade/Resolver e os retornos; repetir com conexão instável e confirmar que a loja não confirmada está nominalmente no aviso, sem urgência antiga como confirmada; recuperar a conexão e Tentar de novo. Com conta sem comércios, permanece a orientação de cadastro e não aparece Atualizar vazio.

C4-C2 ainda exige proposta própria para estados dos valores financeiros/relatório e eventual horário; **esta entrega não encerra C4-C inteira nem RMC-06**. Sem confirmação de publicação ou teste do dono, o checklist permanece aberto para homologação.

## Proposta C4-C2 — estados dos valores financeiros e relatório geral

13/10/2026, base `main 27393ab` (PR #134, C4-C1 integrada). Pedido do dono: “Sim pode fazer a próxima etapa”. A seção 0 exige mostrar código, arquivos e impactos antes da aplicação funcional. A proposta abaixo foi construída/testada apenas em `/tmp/omni-owner-c4c2-proposta/repo`; **nenhum código oficial aplicado nesta entrega documental**.

### Achado e comportamento proposto

`carregarGeral` preserva dados guardados enquanto marca a leitura como carregando. Hoje, o cartão Vendas considera apenas a existência de `g.vendas`, e as linhas de Antifurto podem conter os alertas anteriores. Isso mantém valores anteriores visíveis como se fossem confirmados durante a nova consulta, inclusive zero antigo.

A C4-C2 reutiliza os IDs confirmados de `disponibilidade` (C2) para criar **somente um recorte de apresentação**, sem alterar `geral`, dados guardados, fórmulas ou funções de leitura:

- Vendas: total completo só quando produtos/pedidos e vendas estiverem confirmados para todas as unidades; enquanto consulta incompleta, continua a política existente “…” consultando ou “—” indisponível. Não introduz subtotal de vendas nem lucro.
- Faltou este mês: soma somente linhas confirmadas; nenhuma disponível mostra “…”/“—”; parte disponível mantém subtotal identificado; todas confirmadas mantêm o valor completo e o zero verdadeiro.
- Relatório Antifurto geral: utiliza o mesmo recorte; durante leitura informa “Consultando: X de Y comércios confirmados”; após falha, mantém “Subtotal de X de Y … consulta incompleta” e aviso nominal. Linhas antigas da unidade pendente ficam fora das faltas/“sem faltas” confirmadas.
- Preservar entradas Vendas/Antifurto, seleção da unidade, retorno, filtros C4-B, sino/Atualizar C4-C1 e resultados das funções `totalAntifurto`, `ehFalta` e resumo geral. A aba Comércios continua usando a visão original.

### Horário de leitura avaliado

Não acrescentar horário nesta correção. A marcação atual não registra uma hora única confiável de leitura completa por módulo; apresentar o relógio do clique ou da primeira resposta como “todos os dados atualizados” seria incorreto em consulta parcial. Exibir apenas os estados comprovados já disponíveis. Se o dono quiser o horário, preparar uma proposta própria com origem, módulo, período, fuso e política de falha, sem alterar movimentações. A ausência dessa opção não impede o aceite dos estados corretos de C4-C2.

### Arquivos exatos e impactos antes de aplicar

1. `src/components/OwnerHome.tsx`: recorte financeiro derivado da disponibilidade C2, seleção do relatório/Início, critério de Vendas completas e texto Consultando do cartão mensal.
2. `src/components/AntifurtoGeral.tsx`: apenas o texto da quantidade de unidades confirmadas durante consulta; mesmas contas/destinos.
3. `src/test/rmc-c4c2.test.tsx`: novo teste de cinco cenários (valores anteriores durante carga; relatório parcial/retorno; zero verdadeiro; falha só de diferenças; falha de todas/recuperação). Nenhum teste existente alterado.
4. `docs/auditoria-painel-global-2026-10-13.md`, `docs/FONTE_DA_VERDADE.md`, `docs/CHECKLIST_PONTA_A_PONTA.md`, `CLAUDE.md`: registros de entrega.

**Impacto visível:** ao tocar Atualizar, números financeiros antigos passam temporariamente a Consultando/“…”; o relatório pode mostrar só unidades já confirmadas e depois completar. Falha final não vira R$ 0. Valores, preços, faltas/perdas consideradas e total final confirmado são os mesmos. Nenhuma venda, baixa, ajuste, operação, migração, permissão, endpoint, dependência ou formulário operacional é modificado. Não apagar registros nem dados guardados.

### Código proposto

```diff
--- a/src/components/OwnerHome.tsx
+++ b/src/components/OwnerHome.tsx
@@ -241,6 +241,10 @@
     return { geral, resumos, alertas, decidir, antifurto, total: somaResumos(Object.values(resumos)), carregando: gs.some((g) => g.estado === "carregando"), erro: gs.some((g) => g.estado === "erro" || (g.estado === "ok" && (!g.vendas || !g.dif))) };
   }, [stores, geral, hojeGeral]);
   // C4-C1: o sino usa os mesmos comércios confirmados de Resolver agora.
+  // C4-C2: recorte de apresentação, sem alterar dados guardados ou cálculos.
+  const idsFinanceiros = new Set(disponibilidade(stores, visao, false).idsValidos);
+  const visaoFinanceira: VisaoGeral = { ...visao, antifurto: visao.antifurto.map((l) =>
+    idsFinanceiros.has(l.id) ? l : { ...l, alertas: null, maisSumiu: null }) };
   const dispSino = disponibilidade(stores, visao, true);
   const urgentesSino = paraResolver(dispSino.soma);
   const incompletoSino = stores.length > 0 && (dispSino.estado !== "total" || visao.erro);
@@ -498,9 +502,9 @@
               onDiferencasMudou={() => { if (sid) { void recarregar(sid); void atualizarAvisos(sid); } }}
               onBack={() => { setOpen(null); setSaved(false); setInicioLoja(undefined); if (voltarPara) { setTab(voltarPara); setVoltarPara(null); } }} onNew={() => openWizard()} onEdit={(p) => openWizard(p)} onDismissSaved={() => setSaved(false)} />
           ) : tab === "inicio" && verAntifurto ? (
-            <AntifurtoGeral linhas={visao.antifurto} carregando={visao.carregando} onAbrir={(s) => abrirLoja(s, { relatorio: true })} onVoltar={() => setVerAntifurto(false)} />
+            <AntifurtoGeral linhas={visaoFinanceira.antifurto} carregando={visao.carregando} onAbrir={(s) => abrirLoja(s, { relatorio: true })} onVoltar={() => setVerAntifurto(false)} />
           ) : tab === "inicio" || tab === "comercios" ? (
-            <HomeContent hoje={hojeGeral} modo={tab} stores={stores} visao={visao} fornecedores={suppliers.length} locais={locais}
+            <HomeContent hoje={hojeGeral} modo={tab} stores={stores} visao={tab === "inicio" ? visaoFinanceira : visao} fornecedores={suppliers.length} locais={locais}
               onPasso={(s, p) => abrirLoja(s, { aba: p.id === "fornecedor" ? "Fornecedores" : p.id === "equipe" ? "Equipe" : p.id === "caixa" ? "Vendas" : "Produtos" })}
               onAdd={() => { setEscolherVendas(false); setVoltarPara(null); setAdding(true); }}
               onOpen={(s) => { if (escolherVendas) { abrirLoja(s, { aba: "Vendas" }); } else { setVoltarPara(null); abrirLoja(s); } }}
@@ -573,13 +577,13 @@
 function HomeContent({ hoje, modo, stores, visao, fornecedores, locais, onPasso, onAdd, onOpen, onAlertas, onVendas, onTentar, onAntifurto, onComercios, escolherVendas = false, onCancelarEscolha }: {
   hoje?: string; modo: "inicio" | "comercios"; onComercios: () => void; stores: StoreData[]; visao: VisaoGeral; fornecedores: number; locais: Record<string, LocaisCadastrados>; onPasso: (s: StoreData, p: Passo) => void; onAdd: () => void; onOpen: (s: StoreData) => void; onAlertas: (assunto: AssuntoAlertaGlobal) => void; onVendas: () => void; onTentar: () => void; onAntifurto: () => void; escolherVendas?: boolean; onCancelarEscolha?: () => void;
 }) {
+  const dispBase = disponibilidade(stores, visao, false);
   const t = visao.total;
   const af = totalAntifurto(visao.antifurto);
   const afPronto = visao.antifurto.some((l) => l.alertas);
-  const vendasCompletas = stores.every((s) => !!visao.geral[idDe(s) ?? ""]?.vendas);
+  const vendasCompletas = stores.every((s) => { const id = idDe(s) ?? ""; return dispBase.idsValidos.includes(id) && !!visao.geral[id]?.vendas; });
   const afCompleto = visao.antifurto.length === stores.length && visao.antifurto.every((l) => !!l.alertas);
   const pronto = Object.keys(visao.resumos).length > 0;
-  const dispBase = disponibilidade(stores, visao, false);
   const dispResolver = disponibilidade(stores, visao, true);
   const kpis = [
     { label: "Para resolver agora", assunto: "resolver" as const, disp: dispResolver, n: paraResolver(dispResolver.soma), Icon: AlertTriangle, cor: "urgente" as const, desc: "Pendências urgentes de vários tipos, não só produtos" },
@@ -696,7 +700,7 @@
               <span className="block text-xs leading-snug text-muted-foreground">Valor das faltas identificadas nas diferenças do estoque neste mês</span>
             </span>
             <span data-testid="status-cartao" className="w-full shrink-0 border-t border-border/60 pt-2 text-left text-xs text-muted-foreground @[26rem]:w-auto @[26rem]:border-0 @[26rem]:pt-0 @[26rem]:text-right">
-              {!afCompleto ? "Consulta incompleta" : af.alertas === 0 ? "Nenhum alerta" : af.alertas === 1 ? "1 alerta" : `${af.alertas} alertas`}
+              {!afCompleto ? visao.carregando ? "Consultando…" : "Consulta incompleta" : af.alertas === 0 ? "Nenhum alerta" : af.alertas === 1 ? "1 alerta" : `${af.alertas} alertas`}
               {afPronto && !afCompleto && <span className="block">Subtotal disponível</span>}
               <span className="block font-semibold text-primary">Ver antifurto</span>
             </span>

--- a/src/components/AntifurtoGeral.tsx
+++ b/src/components/AntifurtoGeral.tsx
@@ -38,7 +38,7 @@
       <section aria-label="Total de todos os comércios" className="rounded-3xl border border-border bg-secondary/40 p-4">
         <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ShieldAlert size={18} className="text-destructive" /> Faltou este mês</p>
         <p className={`mt-1 text-3xl font-bold tabular-nums ${tot.faltou > 0 ? "text-destructive" : ""}`}>{!linhas.some((l) => l.alertas) ? carregando ? "…" : "—" : brl(tot.faltou)}</p>
-        <p className="text-sm text-muted-foreground">{semDados.length ? `Subtotal de ${linhas.length - semDados.length} de ${linhas.length} comércios · consulta incompleta` : `${tot.alertas === 0 ? "Nenhum alerta" : tot.alertas === 1 ? "1 alerta" : `${tot.alertas} alertas`} · ${linhas.length === 1 ? "1 comércio" : `${linhas.length} comércios`}`}</p>
+        <p className="text-sm text-muted-foreground">{semDados.length ? carregando ? `Consultando: ${linhas.length - semDados.length} de ${linhas.length} comércios confirmados` : `Subtotal de ${linhas.length - semDados.length} de ${linhas.length} comércios · consulta incompleta` : `${tot.alertas === 0 ? "Nenhum alerta" : tot.alertas === 1 ? "1 alerta" : `${tot.alertas} alertas`} · ${linhas.length === 1 ? "1 comércio" : `${linhas.length} comércios`}`}</p>
       </section>

       {comFalta.length > 0 && (
```

### Evidências e aceite

Proposta isolada: `npx tsc --noEmit` **duas vezes**, `npx vitest run` **duas vezes**, **1.071 testes em 106 arquivos aprovados em cada rodada**, build com Supabase fictício aprovado. **22 testes focados em três arquivos** aprovados. Cinco casos novos, nenhum teste existente alterado.

Chromium com componente/CSS da proposta, dados fictícios e rede externa bloqueada: **320/390/768/1280 px**, seis tipos, valor de vendas grande/zero mensal anterior, leitura retida artificialmente, valores antigos ocultos no painel/relatório, número de unidades confirmadas e recuperação do zero confirmado; **quatro cenários aprovados e zero erros JavaScript**. Primeiro script procurava “Consultando…” como texto isolado, mas o mesmo contêiner inclui Ver vendas/Ver antifurto; seletor corrigido no script temporário para o botão pelo nome acessível, sem alterar o aplicativo ou ocultar erro. O problema era de seleção no ensaio, não de valor confirmado.

Artefatos locais em `/tmp/omni-owner-c4c2-proposta`: patch, cinco testes, logs, scripts e resultado do navegador. Isso não comprova publicação/aparelho/banco real ou carga de produção. Checks do PR documental validam o código atual (C4-C1); o patch/teste da proposta continuam apenas na cópia até validação prévia.

Depois da aplicação aprovada e Publicar → Atualizar: conferir Vendas/Faltou com um/vários comércios; tocar Atualizar e confirmar Consultando; abrir Antifurto durante a consulta e conferir quantidade de unidades confirmadas; verificar falha/recuperação e zero confirmado; entrar numa unidade e voltar, mantendo origem/relatório. Não registrar como publicado/testado no aparelho sem evidência. RMC-06 permanece pendente para a inspeção final dos fluxos e da versão publicada; C4-D continua opcional.

## Entrega C4-C2

13/10/2026, base `main db35ebf` (PR documental #135). O dono aprovou a proposta concreta respondendo **“Sim”**. Aplicado o patch exato em `OwnerHome.tsx`/`AntifurtoGeral.tsx` e novo `src/test/rmc-c4c2.test.tsx`; comparação byte a byte dos componentes com a proposta aprovada, sem ampliar escopo. Quatro documentos atualizados. Registros da cópia isolada acima descrevem a preparação; nesta entrega o código oficial está corrigido.

- O recorte financeiro reutiliza IDs confirmados da C2; preserva dados guardados e fórmulas.
- Vendas só mostra total completo com leitura atual válida de todos os comércios. Antifurto/relatório considera apenas unidades confirmadas, mantendo subtotal identificado. Durante consulta, valores anteriores/zero antigo ficam fora da confirmação.
- Consulta em andamento, falha final e zero confirmado têm estados distintos; recuperação retorna valores atuais e mantém navegação/retornos. C4-B/C4-C1 e modo Comércios preservados.
- Cinco casos novos: espera/valor anterior, parcial/relatório/retorno, zero, falha de diferenças e falha total/recuperação. Nenhum teste existente alterado. Horário avaliado e não introduzido sem origem confiável; sem mudança de estoque, banco, permissões, fórmulas ou dependências.

Após aplicação oficial: tipos **duas vezes**, **1.071 testes em 106 arquivos duas vezes**, `npm run build` com Supabase fictício aprovado. Componentes e novo teste comparados byte a byte com a proposta aprovada; nenhuma diferença funcional. Nenhum teste existente modificado.

Chromium sobre componente/CSS **do código oficial aplicado**, com dados fictícios e rede externa bloqueada: **320/390/768/1280 px**, seis tipos de comércio, leitura retida, valores antigos ocultos no painel e no relatório, quantidade de unidades confirmadas, recuperação e zero verdadeiro; **quatro cenários aprovados, zero erros JavaScript**. Os testes automatizados cobrem também subtotal/retorno, falha só de diferenças e falha total/recuperação. Artefatos locais em `/tmp/omni-owner-c4c2` (logs, scripts e resultado). Não representa sessão/banco/aparelho real ou capacidade de produção; não comprova Publicar → Atualizar.

**Publicar → Atualizar e testar no celular:** abrir Início; comparar os totais confirmados; tocar Atualizar e conferir Consultando; abrir Antifurto durante leitura e conferir número de unidades confirmadas/subtotal; repetir com internet instável, recuperar e conferir valores/zero verdadeiro; abrir a unidade correta e voltar ao relatório; confirmar recortes/sino/Atualizar da C4-C1. Não apagar registros ou criar ajustes para testar.

**Situação:** cinco das seis etapas principais do painel implementadas no código, todas aguardam evidência de publicação/homologação quando pendente. Próxima principal **RMC-06**, validação da versão consolidada e teste publicado. C4-D opcional; nenhuma funcionalidade adicional ou outra frente iniciada nesta entrega. Não fechar C4-C como homologada com apenas testes locais/CI.


## RMC-06 — regressão consolidada e proposta de navegação (14/10/2026 UTC)

Base oficial: `main 58bf648`, merge do PR #136. Pedido do dono: “Pode fazer a próxima”. Etapa executada como auditoria de leitura, sem aplicar nova correção funcional. Nenhum aplicativo, teste do repositório, SQL, configuração, saldo ou dependência alterado nesta entrega. A regra de validação prévia da seção 0 continua em vigor.

### Evidência e resultado

| Verificação | Resultado | Limite |
| --- | --- | --- |
| TypeScript | Duas execuções aprovadas | Código local da base indicada |
| Regressão | 1.071 testes / 106 arquivos, duas execuções aprovadas | Mocks e ambientes de teste; não certifica produção |
| Build | Aprovado com endereço/chave Supabase fictícios | Não equivale a publicar no Lovable |
| Painel no Chromium | 30 combinações: 320/390/768/1024/1280 px × 0/1/6 comércios × texto 100%/200%; sem rolagem horizontal, cartões financeiros dentro da tela e sem sobreposição entre eles; zero erros JavaScript | Componente/CSS oficiais, dados fictícios, rede externa bloqueada; não é aparelho real |
| Retorno pelo botão interno do Antifurto | Aprovado nos cenários com comércios da matriz | A seta do relatório funciona |
| Atualização retida, valores antigos e recuperação | Aprovado em 320/390/768/1280 px; número anterior oculto e zero confirmado depois da leitura; zero erros JavaScript | Leitura simulada, não falha real de internet |
| Rotas de vendas, quatro recortes, sino/menu, falha parcial e recuperação | Testes existentes aprovados na regressão completa | Sem novas gravações ou teste de venda em produção |
| Início pelo menu dentro do Antifurto | **Defeito confirmado** em 390 e 1280 px | Tocar o mesmo item ativo não fecha o relatório |

Artefatos locais: `/tmp/omni-rmc06` (scripts, logs, medições JSON e capturas 320/768 px com texto 200%). Os scripts tiveram ajuste de seletor para distinguir a seta interna do menu; a falha do menu foi então reproduzida separadamente. Não tratar erro de seletor como defeito visual. Inspeção das capturas complementa as medições; a matriz não certifica toda combinação possível de dados/zoom.

### Defeito e proposta exata — aplicação aguarda aprovação

Abrir **Faltou este mês → Antifurto → Início no menu** mantém o relatório. A seta “Início” dentro do relatório retorna corretamente. `irPara` mantém `verAntifurto`; o efeito existente só o limpa quando a aba muda para outra. O clique em Início, já ativo, não troca a aba.

**Código funcional proposto, somente `src/components/OwnerHome.tsx:74`:**

```diff
- const irPara = (id: Tab) => { setEscolherVendas(false); setVoltarPara(null); setAssuntoAlertas(null); setTab(id); setOpen(null); };
+ const irPara = (id: Tab) => { if (id === "inicio") setVerAntifurto(false); setEscolherVendas(false); setVoltarPara(null); setAssuntoAlertas(null); setTab(id); setOpen(null); };
```

**Teste proposto, acrescentar em `src/test/rmc-02b.test.tsx`, dentro do `describe` atual, sem remover casos existentes:**

```tsx
it.each(["nav", "aside"])("Início no menu %s fecha o relatório geral", async (menu) => {
  render(<OwnerApp userId="u1" owner="Monica" initial={[lojaA, lojaB]} />);
  fireEvent.click(await screen.findByRole("button", { name: /^Faltou este mês:/ }));
  expect(await screen.findByRole("heading", { name: "Antifurto" })).toBeTruthy();
  const inicio = [...document.querySelectorAll(`${menu} button`)]
    .find((button) => button.textContent?.trim() === "Início");
  expect(inicio).toBeTruthy();
  fireEvent.click(inicio!);
  expect(await screen.findByRole("region", { name: "Resumo geral" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Antifurto" })).toBeNull();
});
```

**Arquivos exatos de futura aplicação:** esses dois arquivos, mais os quatro registros existentes: `docs/auditoria-painel-global-2026-10-13.md`, `docs/FONTE_DA_VERDADE.md`, `docs/CHECKLIST_PONTA_A_PONTA.md` e `CLAUDE.md`.

**Impacto para validação:** somente a ação explícita do menu Início passa a fechar o relatório geral e exibir o painel. O Voltar da unidade continua retornando ao relatório de origem; a seta interna continua funcionando; filtros e escolha de vendas continuam sendo limpos pela lógica existente. Não muda cálculos, leitura, estoque, gravação, autorização ou outros menus. Rodar novamente tipos/testes duas vezes, build e regressão de origem/retorno após aplicação autorizada.

Patch preparado **somente em cópia isolada** `/tmp/omni-rmc06/proposta/OwnerHome.tsx`; Chromium 390/1280 px confirma retorno pelo menu e pela seta com a proposta. Não é implementação oficial, nem substitui tipos/regressão da futura aplicação.

### Roteiro de homologação — depois da correção aprovada e publicação

1. No Lovable, **Publicar → Atualizar**. Registrar versão/data e link publicado; merge no GitHub não comprova publicação.
2. No celular, abrir Início com um e vários comércios quando disponíveis. Conferir títulos, valores completos e ausência de texto sobreposto; repetir com fonte maior.
3. Tocar Vendas: uma unidade abre suas vendas; várias pedem a escolha. Cancelar e voltar sem perder a origem.
4. Abrir cada indicador Resolver/Repor/Comprar/Validade; conferir assunto e unidade. Abrir a unidade e voltar; sino/menu mostram todos os alertas.
5. Abrir Faltou este mês, uma unidade e Voltar; retorno ao relatório. Depois usar a seta e o menu Início: ambos devem mostrar o painel.
6. Tocar Atualizar: botão bloqueado durante consulta, números antigos não apresentados como atuais; ao finalizar, dados confirmados. Com conexão instável, identificar consulta incompleta; recuperar e tentar de novo.
7. Confirmar entradas Comércios, Alertas, Equipe e Conta; conferir que cada comércio continua no contexto certo. Não criar venda/ajuste de estoque apenas para esta homologação do painel.
8. Informar “funcionou” ou descrever onde falhou; não encerrar os itens sem essa evidência.

**Situação:** parte local da RMC-06 auditada; há uma correção mínima proposta, aguardando aprovação, e publicação/teste do dono ainda sem confirmação. Manter RMC-06 `[ ]`. Próximo passo concreto: aprovar/aplicar a proposta de navegação acima, revalidar e publicar; depois homologar. C4-D opcional; RMC-03/05 e frentes G/E continuam separadas e abertas. Não declara sistema inteiro pronto, resistência total a ataques ou capacidade para várias lojas/caixas.


## RMC-06 — retorno ao Início aplicado após aprovação (14/10/2026 UTC)

O dono autorizou **“Pode aplicar”** após apresentação do patch, arquivos e impactos no PR #137. Base `main 47de008`. Aplicada exatamente a proposta: uma condição em `irPara` de `src/components/OwnerHome.tsx`, fechando o Antifurto geral somente na ação explícita do menu Início. Acrescentados os dois casos `nav`/`aside` aprovados em `src/test/rmc-02b.test.tsx`; nenhum caso existente removido ou reescrito. Componente oficial comparado byte a byte com a cópia proposta: igual. Quatro registros existentes atualizados, total de seis arquivos previstos.

**Resultado:** no Antifurto, tocar Início no menu agora mostra o painel consolidado, inclusive quando a aba Início já estava ativa. A seta interna continua funcionando. Abrir uma unidade pelo relatório e usar Voltar mantém o relatório de origem; a regressão existente também confirma origens Comércios/Alertas e seleção de vendas. Sem alteração de cálculos, estoques, leituras, banco, permissões ou dependências.

**Verificação desta aplicação:**

- Tipos duas vezes e **1.073 testes / 106 arquivos duas vezes aprovados**; build com Supabase fictício aprovado.
- Contraprova isolada com componente anterior: os dois casos novos falham pela ausência do painel Resumo geral após o clique; seis outros casos não selecionados nessa contraprova. A suite completa sobre o código corrigido aprova os oito casos desse arquivo e os demais testes.
- Chromium com componente/CSS do código oficial aplicado, dados fictícios e rede externa bloqueada: **320/390/768/1280 px**, menu Início e seta interna retornam ao painel em quatro cenários. Não equivale a versão publicada, sessão real ou homologação no telefone.
- Artefatos locais em `/tmp/omni-rmc06-aplicacao`: logs das duas rodadas/tipos/build, configuração/código anterior da contraprova e roteiro/resultado do navegador.

**Situação atual:** correção pronta no código. O histórico acima de proposta aguardando aprovação é anterior a esta autorização. **RMC-06 permanece `[ ]` por falta de Publicar → Atualizar e teste do dono**, sem nova correção funcional identificada nesta entrega. Não encerrar outras frentes ou adicionar C4-D.

**Teste curto depois da publicação:** abrir Início → Faltou este mês → Antifurto → tocar Início no menu; deve aparecer o painel. Reabrir Antifurto → abrir um comércio → Voltar; deve voltar ao relatório. Testar também a seta Início interna. Depois concluir o roteiro consolidado da auditoria e informar o resultado; não alterar estoque para testar navegação.

## Entrega em revisão — Início compacto móvel (autorizada após PR #139, 13/10/2026)

O proprietário aprovou explicitamente a [proposta visual #139](https://github.com/OmniSafe-360/mock-overlay-magic/pull/139) para o **Início sem rolagem habitual no celular**, mantendo todos os elementos acionáveis, regras e acessibilidade. A implementação foi isolada em `codex/rmc-inicio-compacto-implementacao-20261013`, desde `main 4a85d745e543f278af03024ea0cf82b95102d67d` (já contém PRs #134, #136 e #138). **Não usar nem integrar o PR antigo #132**.

**Alteração de código restrita a `src/components/OwnerHome.tsx`, apenas classes CSS responsivas:**
- `<main>`: reduz o padding superior e o espaço inferior **exclusivamente se `tab === "inicio" && !open && !verAntifurto`**, mantendo o espaço seguro da barra fixa; demais abas e Antifurto mantêm a classe original.
- `HomeContent`: somente em `modo === "inicio"` usa `space-y-2.5` no celular e `md:space-y-8` nas telas maiores. Em Comércios mantém `space-y-8` original.
- Resumo do Início: menos margens entre título, Vendas, Pendências e Faltou; botões financeiros com padding/gaps menores e **status + atalho na mesma linha quando couber**, preservando quebra de linha `@[26rem]` da C3-B, o valor completo e o texto de status/ação.
- Os quatro cartões de pendências permanecem na grade original `@[18rem]:grid-cols-2`/`@[52rem]:grid-cols-4`, com padding, distância do ícone ao número e `gap` reduzidos no celular. Suas frases explicativas secundárias e as dos dois cartões financeiros usam `max-md:sr-only` (continuam presentes no DOM para leitores de tela e ficam visíveis no tablet/desktop). Os seis títulos, números, períodos, mensagens de subtotal/erro, botões e destinos continuam visíveis e iguais.
- **Não adicionou** `overflow: hidden`, largura/altura fixa, carrossel, `truncate` nos valores, chamadas de dados, operações ou novos componentes.

**Regressão proposta:** arquivo novo `src/test/rmc-inicio-compacto.test.tsx`, conferindo os seis indicadores, cabeçalhos/ordem, mensagens, classes móveis, preservação das abas Comércios e Alertas, acesso por assunto, valores e status, zero lojas e consulta parcial. Nenhum teste existente substituído/enfraquecido. Arquivos adicionais autorizados: `docs/FONTE_DA_VERDADE.md`, `docs/CHECKLIST_PONTA_A_PONTA.md`, `CLAUDE.md` e este relatório, somente evidências.

**Status desta anotação:** PR/CI, verificações de TypeScript 2×, Vitest completo 2× e build **ainda pendentes de confirmação**. Sem evidência de ensaio geométrico real no Android/Chromium desta branch. A exigência de **não rolar habitualmente em ~390×840/850 CSS px** só pode ser homologada mediante captura no aparelho depois de revisão/merge autorizado e `Publicar → Atualizar`. Em 320px, zoom, fontes ampliadas e erro/subtotal, **rolagem continua permitida como proteção**, sem esconder ações. Não afirmar garantia universal de altura. Não iniciar outras etapas.
