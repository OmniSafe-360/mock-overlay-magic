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
| 2 | RMC-02C/C3-B | Valores grandes, texto ampliado, nomes longos e tablet; leitura completa e alvo de toque adequado | Planejada; apresentar patch próprio |
| 3 | RMC-04/C4-A | Clareza dos títulos/períodos e ordem dos blocos; manter significado dos totais, neutro entre tipos | Planejada |
| 4 | RMC-04/C4-B | Destino específico dos indicadores, comércio identificado e retorno preservado; reaproveitar Alertas | Planejada |
| 5 | RMC-04/C4-C | Atualização explícita e coerência de leitura parcial, inclusive sino/detalhes; falha nunca vira zero | Planejada |
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
