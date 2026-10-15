# Plano Mestre de UX/UI — OmniSafe 360°

**Preparado em:** 15/10/2026 (UTC). **Versão:** 1.0, proposta documental para avaliação do proprietário.

> **Atualização de execução — M01-A (15/10/2026):** a autorização documental inicial abaixo é histórica. Depois dela, o proprietário autorizou exclusivamente a implementação da M01-A, registrada na seção 12. M01-B e demais etapas continuam sem autorização; merge, publicação e validação do dono permanecem pendentes.

> **Atualização posterior — M01-B (15/10/2026):** M01-A integrada pelo PR #149 e validada pelo proprietário no Android somente nos pontos registrados na seção 13. M01-B autorizada exclusivamente para os dois textos e três expectativas, com acompanhamento nestes três documentos. Registros anteriores de pendência são históricos; M02 não autorizada. Sem merge ou publicação da M01-B.

> **Atualização posterior — M02 (15/10/2026):** implementação expressamente autorizada, restrita à ajuda de produto não encontrado e aos cinco arquivos da seção 14. M01-B integrada pelo PR #150; publicação/validação física não confirmadas. M02 aguarda revisão do dono, sem merge/publicação; M03 não autorizada.

> **Atualização posterior — M03 (15/10/2026):** autorizada exclusivamente a troca de uma frase de `StoreSetup.tsx`, com acompanhamento nos três documentos da seção 15. M02 integrada pelo PR #151 e roteiro aceito por relato do dono, com os limites ali registrados. M03 aguarda revisão/validação do dono; sem merge/publicação/M04.

**Autorização desta entrega:** criar somente este documento. Nenhuma etapa de implementação está autorizada. Não alterar aplicação, testes, dependências, configurações, banco, migrações, Supabase, integrações ou a Fonte da Verdade. Não fazer merge nem publicar.

## 1. Autoridade, referências e controle da versão

A [Fonte da Verdade](FONTE_DA_VERDADE.md) continua sendo a autoridade máxima das regras de negócio. Este plano organiza exclusivamente a futura execução de melhorias de apresentação e usabilidade. Não cria outra fonte de regras, não substitui o [checklist ponta a ponta](CHECKLIST_PONTA_A_PONTA.md) e não encerra suas pendências. Em caso de conflito, preservar a regra oficial e separar a decisão que precisa de aprovação.

### 1.1 Referências efetivamente examinadas

| Referência | Versão e resultado da leitura |
|---|---|
| Fonte oficial no `main` | Leitura integral: versão 3.1, 621 linhas; inclui regras, histórico, reorganização multicomércio e matriz oficial da seção 17. SHA-256: `cbdd2b76478f4e541404521a4bdb0084b865270c5c0bbe561805f21efaa020e7`. |
| Auditoria profissional de UX/UI | `RELATORIO.md`, entrega de 15/10/2026, 389 linhas, lido integralmente. SHA-256: `9feaec861db065a8c2a0083400f799247a79d9baf711614653f3fdbee3900b97`. Achados UX01–UX28 e limitações preservados neste plano. |
| Proposta visual da auditoria | `PROPOSTA_VISUAL.html`: três wireframes com dados fictícios; referência de hierarquia, sem autorização de implementação. Cores, textos e interações do protótipo não constituem especificação aprovada. |
| Continuidade do repositório | `AGENTS.md`, histórico recente de `CLAUDE.md` e checklist ponta a ponta consultados. Não alterar esses arquivos nesta tarefa. |

O relatório e o HTML estão na entrega local `/workspace/entregas/omnisafe-ux-ui-2026-10-15/`, fora do repositório. Este documento registra sua identificação e os achados para continuidade; não presume que esses anexos estejam publicados no GitHub. Se faltarem em outra sessão, recuperar a entrega pela identificação acima; não afirmar que foram relidos sem acesso. A Fonte oficial pode ser recuperada no [commit examinado](https://github.com/OmniSafe-360/mock-overlay-magic/blob/ade999e444a94f1470bb306c6fed442a8f01a9b4/docs/FONTE_DA_VERDADE.md).

### 1.2 Auditoria versus `main` atual

| Verificação em 15/10/2026 | Resultado |
|---|---|
| Commit examinado pela auditoria | `ade999e444a94f1470bb306c6fed442a8f01a9b4` |
| Ponta de `main` consultada no remoto | `ade999e444a94f1470bb306c6fed442a8f01a9b4` |
| Comparação dos dois commits | Idênticos: zero commits posteriores e zero arquivos diferentes. |
| Versão publicada do aplicativo | **Não foi possível verificar nesta tarefa.** Igualdade do código não comprova publicação nem validação real. |

O checkout de trabalho estava em `codex/auditoria-completa-20261014`, commit `947299367c968784a82507dd35393147e515bf34`, anterior ao `main`. Já havia uma edição não publicada de `docs/FONTE_DA_VERDADE.md` (versão 3.2) e o arquivo não rastreado `docs/auditoria-completa-2026-10-14.md`. Foram preservados, sem reconciliação, sobrescrita ou publicação. A referência deste plano é o `main` oficial, não uma promoção silenciosa desses rascunhos. Antes de implementar, preparar uma base atualizada sem perder trabalho anterior e conferir os deltas documentais.

Este registro é uma fotografia da comparação, não uma afirmação permanente de que `main` continuará igual. Toda autorização futura exige nova consulta ao remoto.

## 2. Diagnóstico e limites da evidência

O sistema possui identidade visual reconhecível, separação global/local e proteções operacionais que justificam uma evolução pontual. O principal atrito observado é a organização da complexidade: alcance dos indicadores pouco explícito, áreas locais escondidas na faixa horizontal, cartões extensos, muitos subpassos e mensagens que nem sempre distinguem solicitação, confirmação e conclusão.

**Não foi reproduzida sobreposição de letras no Início atual** nos cenários da auditoria com 320, 390 e 1280 px, seis comércios e nomes longos. Não tratar um relato histórico como defeito atual confirmado, nem concluir que todos os aparelhos estão livres do problema. Reproduzir a combinação concreta antes de propor correção.

### 2.1 O que deve ser preservado

- Paleta, Inter, identidade da marca, vocabulário por tipo de comércio e ícones com significado reconhecível.
- Início global com indicadores; Comércios com identificação e entrada das unidades. A compactação do Início e os ajustes RMC já presentes não devem ser refeitos como se faltassem.
- Distinção entre compra, entrega, recebimento, pagamento, reposição e conferência. Nenhuma reorganização pode fundir essas ações.
- Contagem cega, confirmações físicas, recontagens, bloqueios, decisão do dono, autoria e histórico.
- Carrinho preservado, recusa de excesso, proteção contra envio duplicado e estados de resposta incerta.
- Textos recentes de preços/conversão de embalagens, trava de embalagem usada, melhorias do scanner e saída do primeiro cadastro já implementados.
- Comportamento de foco/Escape do `Sheet` nos estados em que já funciona; não substituir componentes funcionais por preferência estética.

### 2.2 O que a auditoria confirma e o que permanece pendente

As evidências visuais são de componentes reais executados localmente, CSS real, dados fictícios e serviços simulados. Houve leitura de código e reproduções isoladas, sem operação em produção. As siglas usadas adiante são: **C** código; **V** observação visual local; **R** reprodução isolada; **P** validação pendente. C+V não significa que todas as combinações foram executadas.

**Não foi possível verificar:** aplicativo autenticado publicado, dados reais, permissões implantadas, Google/e-mail reais, todos os estados com grande volume, câmera/leitor/balança/impressora físicos, Voltar e teclado nativos, instalação PWA em Android/iPhone ou leitor de tela real. Nenhuma nota de “100% funcional”, certificação de acessibilidade ou imunidade a ataques decorre deste plano.

## 3. Inventário das telas, componentes e fluxos

Os caminhos desta seção foram conferidos na cópia do `main` examinado. São candidatos de leitura e delimitação, não uma lista autorizada de edições. Componentes internos montados por estado não são automaticamente novas rotas.

### 3.1 Endereços e alcance

| Entrada existente | Arquivo | Alcance e preservação |
|---|---|---|
| `/` | `src/routes/index.tsx` | Entrada/criação/recuperação, primeiro comércio e ambiente do dono. Preservar sessão, isolamento e saída. |
| `/funcionario` | `src/routes/funcionario.tsx` | Autorização/PIN e tarefas da equipe; capacidades reais, não perfis inventados. |
| `/caixa` | `src/routes/caixa.tsx` | Turno, venda, pagamento, fiado, comprovante e fechamento. |
| `/conector` | `src/routes/conector.tsx` | Integração com vendas externas/XML; não confundir com venda móvel. |
| `/pedido/$token` | `src/routes/pedido/$token.tsx` | Resposta do fornecedor por link secreto. |
| `/fiado/$token` | `src/routes/fiado/$token.tsx` | Acesso do cliente ao fiado por link e proteção existentes. |
| Erro e recuperação de rota | `src/routes/__root.tsx` | Preservar recuperação e proteção dos relatórios de erro. Manifesto de instalação não é uma tela comercial. |

### 3.2 Cobertura e pendências por área

Todos os componentes abaixo ficam em `src/components/`, salvo indicação. A auditoria inventariou 36 componentes principais, além das peças compartilhadas; a tabela agrupa suas responsabilidades, sem somar peças como módulos novos.

| Área e componentes existentes | Estado examinado | Pendência de validação operacional |
|---|---|---|
| Primeiro comércio: `StoreSetup` | C+V, seleção inicial | Quatro passos completos, CEP, teclado, erro e troca de conta no publicado. |
| Global: `OwnerHome`, `AntifurtoGeral`, `PrimeirosPassos` | C+V, seis lojas | Zero/uma loja, dados parciais, retomada dos primeiros passos e relatório real. |
| Unidade: `StoreSpace` | C+V, oito áreas | Voltar nativo/PWA, continuidade de contexto e interrupção. |
| Produtos: `ListaProdutos`, `FichaProduto`, `ProductArea` | C+V, lista/ficha e parte do cadastro | Todos os subpassos nos seis tipos, grande volume, variantes e teclado. |
| Locais: `PainelLocais`; atenção: `AtencaoHoje` | C+V | Muitos locais, expansão, categorias de alerta e retornos. |
| Fornecedores: `PainelFornecedores`; `SupplierSheet` interno de `ProductArea` | C+V, lista | Edição compartilhada, seleção e falhas reais. |
| Compra: `PainelPedidos`, `PaginaFornecedor` | C+V, lista/formulário | Pedido multiforn., resposta, recusa, reenvio, entrega e pagamento completos. |
| Gestão da equipe: `PainelEquipe` | C+V, estrutura/lista vazia | QR, código, autorização, bloqueio e PIN em dois aparelhos. |
| Operação: `AppFuncionario` | C+V, PIN/início | Capacidades, instalação, relogin e envio pendente reais. |
| Receber: `ReceberMercadoria` | C+V, lista; estados lidos | Lote, avaria, recontagens, decisão e retomada. |
| Repor: `ReporGondola` | C+V, início | Contar, buscar, levar, confirmar e disputa entre operadores. |
| Conferir: `ConferirDeposito` | C+V, entrada/contagem | Bloqueio, contagem cega e decisão do dono no dispositivo. |
| Perda: `RegistrarPerda`; diferenças: `PainelDiferencas` | C+V, entrada/painel | Registro/efeito real, motivo, decisão, falha e retomada. |
| Relatórios: `RelatorioAntifurto`, `AntifurtoGeral` | C; global parcialmente V | Períodos/dados reais e entendimento dos termos. |
| Vendas: `PainelVendas`, `CaixaCelular`, `OmniConector` | C+V, estados iniciais | Pagamento misto/peso/fechamento, XML e dispositivos reais. |
| Fiado: `PainelFiado`, `AcessoClienteFiado`, `CompartilharFiado` | C; reprodução isolada do acesso | Consulta padrão, recebimento, compartilhamento e respostas atrasadas. |
| Cliente: `PaginaFiadoCliente`, `InstalarCliente`; conta: `ContaPerfil` | C | PIN, extrato, instalação, perfil e saída reais. |
| Leitura: `Scanner`, `LeitorContinuo`; impressão: `Etiqueta` | C+V, indisponibilidade/janela | Permissão, luz, bip, impressão A4/térmica e teclado reais. |
| Peças: `parts/Sheet`, `CampoQtd`, `parts/Contador`, `Logo`, `QrCode`; `src/styles.css` | C; alguns estados V | Foco, zoom, semântica, toque e texto ampliado sistemáticos. |

Não foi verificado painel completo de gerente nem papel dedicado de conferente. Não existe uma entrada independente completa de “Conferir gôndola” na inicial examinada. Não apresentar essas propostas como implementadas.

### 3.3 Fluxos a preservar de ponta a ponta

| Fluxo | Sequência de referência | O que não pode mudar por modernização visual |
|---|---|---|
| Entrada | Entrar/criar → autenticar → selecionar/criar comércio → ambiente | Sessão, confirmação de dados, recuperação e isolamento entre contas. |
| Produto | Identificar → preços/unidade → detalhes/fornecedor/embalagem → áreas → validade → revisar → salvar → lista | Campos, validações, conversões, persistência e identidade do reenvio. |
| Compra | Sugestão/manual → fornecedor → pedido → compartilhar → resposta → entrega/conferência → pagamento | Estados independentes, valores e ordem de confirmação. |
| Recebimento | Entrega/sem pedido → contar/lote/avaria → enviar → recontar/concluir/aguardar dono | Critérios próprios, cegueira, parcialidade e retomada. |
| Reposição | Local → contar → buscar → registrar levado → confirmar | Nenhum movimento automático ou eliminação de etapa física. |
| Contagem | Tarefa → contagem cega → recontagens → resultado/pendência → dono | Esperado oculto, bloqueios, movimentos intervenientes, decisão e trilha. |
| Validade | Alerta → produto/lote/local → ação existente | FEFO, quantidade, prazo e diferença entre saldo físico e elegibilidade. |
| Venda | Ler/buscar → quantidade → receber → pagamento → finalizar → comprovante | Limite da área de venda, confirmação real e recuperação de envio incerto. |
| Perda/diferença | Registrar → efeito/pendência previstos → análise do dono → histórico | Não prometer outro momento de baixa; preservar motivo e autoria. |
| Gestão | Vendas/fiado/fechamento/relatório → detalhe → retorno | Escopo, valores, períodos, proteção de links e permissões. |

## 4. Rastreabilidade dos achados da auditoria

**V:** candidato a apresentação, sujeito à aprovação da etapa. **F:** mudança funcional separada. **A:** depende de decisão específica antes de desenhar o patch. Um mesmo achado pode conter parcelas V e F; aprovar V não autoriza F.

| ID / evidência | Problema e prejuízo | Recomendação delimitada e benefício | Classe / prioridade / destino |
|---|---|---|---|
| UX01 C+V | Global/local repetidos, alcance pouco evidente; risco de operar na loja errada. | Destacar contexto já disponível e área ativa; preservar retorno/troca existentes. | V P1: M04/M13. Nova troca/contexto persistente: F, X02. |
| UX02 C+V | Faixa de oito áreas com cerca de 832 px; destinos pouco descobertos em 320 px. | Indicação textual de rolagem e seleção legível; menu completo só em proposta própria. | V P1: M12. Novo menu: F, X02. |
| UX03 C+V | Telas internas por estado mantêm URL; Voltar pode surpreender. | Definir contrato de retorno e proteção de dados antes de integrar histórico. | F P1: X02; sem mudança de rotas no plano visual. |
| UX04 C+V | Totais misturam categorias e descrições somem no móvel. | Explicitar unidade/alcance usando os números existentes; não deduzir lojas afetadas. | V P1: M04. Novos agregados: F, X03. |
| UX05 C+V | Atenção antes da busca aumenta rolagem na operação. | Busca/ação existentes antes do resumo, sem esconder alertas nem criar expansão. | V P1: M08. Novo recolhimento: F, X04. |
| UX06 C+V | Total forte, divisão por área secundária/truncada. | Identificar “Total” e áreas legíveis com mesmos dados; reduzir interpretação errada. | V P1: M07. |
| UX07 C+V | Oito passos principais contêm até 15 estados/subpassos. | Explicar progresso real sem pular, unir ou reordenar validações. | V P1: M14. Índice clicável/atalhos: F, X04. |
| UX08 C | Sair de formulário pode perder trabalho; comportamento precisa revisão. | Desenhar cancelamento/rascunho com regras de envio e retomada próprias. | F P1: X04; não inserir confirmação automaticamente. |
| UX09 C+V parcial | Unidade/embalagem pode ficar distante da decisão. | Manter os textos de conversão já existentes junto ao campo; não recalcular. | V P1: M15/M17/M18/M19. Novo cálculo: F, X05. |
| UX10 C+R | Alerta de validade ordenado por nome, não urgência. | Propor ordenação por lote/data com regra e testes específicos. | F P1: X05. Não mudar comparador como “layout”. |
| UX11 C | “Lucro” pode ser entendido como líquido. | Explicar ganho bruto antes de despesas/impostos; manter fórmula e base percentual. | V P2: M05. Renomear indicador: A. |
| UX12 C+V | Cartões de pedido longos; demora para comparar e agir. | Compactar a mesma informação mantendo entrega/pagamento distintos. | V P2: M09. Novo acordeão/tabela interativa: F, X04. |
| UX13 C+V | Fornecedor compartilhado, itens locais; alcance secundário. | Explicitar escopo na edição e lista; reduzir alteração inadvertida. | V P1: M10. Busca/filtros novos: F, X04. |
| UX14 C+V | Contexto do fornecedor externo prolonga o formulário. | Compactar cabeçalho sem ocultar dados, campos, recusa ou avisos. | V P2: M11. Nova revisão/recolhimento: F, X04. |
| UX15 C+V | Conferência urgente não tem entrada/contador equivalentes no início. | Filas de conferência separadas de Repor, com contrato de dados e permissão. | F P1: X01, não é mera criação de botão. |
| UX16 C+V | Instalação concorre com tarefas e se repete. | Reduzir espaço do convite preservando ambas as entradas e adiamento existentes. | V P2: M16. Remover entrada/mudar preferência: F, X04. |
| UX17 C | Cinco perfis desejados não equivalem às capacidades implementadas. | Descrever acesso real sem anunciar gerente/conferente completo. | V P1: M01. Novos papéis/permissões: F, X01. |
| UX18 C+V | “Nunca veem preços” contradiz caixa autorizado. | Explicar cegueira das contagens e preço visível ao caixa autorizado. | V P1: M01. |
| UX19 C | Linguagem pode insinuar causa/autoria sem prova. | Explicação factual da diferença, sem acusação; manter nomes oficiais e cálculo. | V P1/P2: M04/M05 quando pertinente. Renomeações: A, X09. |
| UX20 C+V | Câmera indisponível ocupa área grande. | Revisar dimensões do estado existente, mantendo acionadores e opções. | V P2: M22 se incluído expressamente. Auto-recolher/preferência: F, X04. |
| UX21 C+V | “Sem cadastro” sugere alternativa de venda. | “Produto não encontrado” e orientação ao dono, com o mesmo acionador/efeito. | V P1: M02. |
| UX22 C | Aviso correto, porém longo; pode confundir solicitação com notificação. | Texto curto e fiel à resposta existente, mantendo carrinho e bloqueio. | V P2: M06. Nova confirmação/notificação: F, X03. |
| UX23 C | Fiado vazio retorna `null`, reduz descoberta. | Avaliar entrada vazia discreta sem novo cadastro implícito. | F P2: X04; muda condição de exibição, fora das etapas visuais. |
| UX24 V | Branco/azul medido em cerca de 3,38:1 para texto comum. | Apresentar alternativas pontuais e comparar contraste, antes de qualquer cor nova. | A P1: X08; paleta atual preservada. |
| UX25 C+V | Etiqueta manual não fecha com Escape e foco alcança fundo. | Correção de interação/acessibilidade com impressão e envio protegidos. | F P1: X07. Não substituir componente só por estética. |
| UX26 C | Microtextos, alvos de 32 px, ajuda/erro sem associação completa. | Botões ≥48 px, inputs ≥16 px; associar erro/ajuda existentes semanticamente. | V P1: M20/M21. Gestão de foco nova: F, X07. |
| UX27 C | Erro genérico “Sem conexão”; recuperação desigual. | Dizer “Não foi possível carregar” se causa desconhecida, preservando acesso negado. | V P1: M01/M06 conforme escopo. Novo retry/data: F, X03/X04. |
| UX28 C | Termos como `span`; “mudar tudo depois” excede editor disponível. | Corrigir promessa textual sem inventar editor; termos reais exigem conteúdo aprovado. | V P1: M03. Termos/editor: F, X06. |

### 4.1 Problemas funcionais não resolvidos por aparência

| Registro herdado | Evidência e impacto relatados | Tratamento neste plano |
|---|---|---|
| F01 — peso decimal | Reprodução isolada de `1.5` interpretado como `15`, afetando quantidade/valor. | P0, revisão funcional própria do campo/parser. Não corrigir cálculos dentro de M02/M06/M22. |
| F02 — vencido/disponibilidade | Reprodução SQL local aceitou saída de lote vencido. | P0, definição de disponibilidade e comparação com banco real antes de alterar regra. |
| F03 — decisão e motivo | Resolver e explicar em chamadas separadas: ajuste pode persistir se motivo falhar. | P0, atomicidade funcional própria; não maquiar erro como sucesso. |
| F04 — consulta de fiado | Dependência instável da API provocou reconsultas na reprodução isolada. | P1, correção funcional própria e teste com API padrão. |
| Integridade numérica | RPC autenticada local aceitou `NaN` na auditoria técnica. | Fila funcional de integridade, não apenas máscara do input. |

Os trechos correspondentes foram confrontados com a versão auditada; não são nova comprovação no banco publicado. Consultar o status oficial antes de escolher qualquer correção. Se um desses defeitos impedir validar um fluxo, registrar a dependência e suspender apenas a etapa afetada; não ampliar escopo nem considerar o fluxo aprovado.

## 5. Padrões de apresentação e limites operacionais

### 5.1 Paleta e identidade — preservar

| Papel | Referência da Fonte, seção 8 | Regra de execução |
|---|---|---|
| Fundo | `#0B1B3A` → `#071326` | Preservar degradê e tokens existentes. |
| Ação principal | `#2F8CFF` | Não escurecer automaticamente para contraste. |
| Destaque/confirmado | `#2DE2C4` | Preservar significado e tokens. |
| Texto principal | `#FFFFFF` | Legível; não depender só de cor para estado. |
| Texto secundário | `#8FA3C2` | Não transformar instrução essencial em microtexto. |
| Bordas/cartões | `#1E3358` | Agrupar por função; evitar cartão para cada frase. |
| Erro | `#FF5C6C` | Mensagem com texto e ícone quando aplicável. |
| Atenção | Token amarelo já existente | Não inventar hexadecimal novo nem uniformizar sem aprovação. |

O CSS atual emprega valores em OKLCH; a tabela não autoriza converter ou reescrever tokens. Diferenças entre referência histórica hexadecimal e cor renderizada devem ser medidas e apresentadas, não “normalizadas”. Fonte Inter e cantos de 16–24 px permanecem. O HTML de proposta usa cores próprias de protótipo: **não copiar sua folha de estilos para a aplicação**.

### 5.2 Regras comuns

- Botões com alvo mínimo de **48 px**; campos com texto de pelo menos **16 px**, conforme Fonte. O alvo de 44 px sugerido no relatório não prevalece sobre essa regra.
- Hierarquia: contexto → título/ação principal → informação necessária à decisão → apoio/histórico. Não esconder permanentemente funções para reduzir ruído.
- Uma ação principal por decisão; ações secundárias visualmente subordinadas, sem perder acesso nem proteção. Não converter ação perigosa em atalho de um toque.
- Textos curtos com verbo concreto e efeito real: “Contagem enviada” não equivale a “Estoque ajustado”; “Pagamento registrado” não equivale a confirmação bancária.
- Preservar nomes por tipo: depósito/gôndola e estoque/área de venda conforme cadastro. Somente os seis tipos oficiais; não ampliar categorias neste trabalho.
- Espaçamentos coerentes dentro dos componentes existentes, usando a escala atual; título, valor, unidade e próxima ação distinguíveis. Nomes longos e dinheiro não podem se sobrepor ou sumir por truncamento do dado necessário.
- Estado ativo identificado por texto/semântica além de cor; foco visível; rótulo de campo permanente; erro ligado ao campo com ajuda compreensível. Não adicionar autoavanço, autofocus, validação, anúncio ou fechamento automático sem avaliar a mudança de interação.
- Preservar estado vazio, carregamento, falha, acesso negado, dados parciais e envio incerto. Não mostrar zero para dado desconhecido, esconder erro nem retirar controles de recuperação existentes.
- Nada de conteúdo fictício, notas de implementação do wireframe, promessas de causa de perda, notificações não comprovadas ou “tudo atualizado” sem evidência na interface de produção.

### 5.3 Navegação e organização propostas

```text
DONO — alcance global
Início       indicadores do conjunto + destinos existentes
Comércios    identificar unidade → abrir área existente
Alertas      pendências, com alcance confirmado
Equipe       gestão existente, capacidades descritas corretamente
Conta        perfil e ações existentes

DENTRO DA UNIDADE — nome + área ativa sempre reconhecíveis
Produtos | Depósito/Estoque | Gôndolas/Área de venda | Pedidos
Fornecedores | Equipe | Vendas | Diferenças
                             └ fiado/fechamentos   └ relatório

EQUIPE — entradas atuais conforme capacidades
Caixa | Receber | Repor | Conferir depósito | Registrar perda
Conferir área de venda/filas próprias: proposta funcional separada, X01
```

Não mover pagamento para novo módulo; pertence ao pedido. Não duplicar lista de unidades no Início. Não adicionar busca global, novo menu “Todas as áreas”, filtro, rota, botão de troca ou histórico do navegador dentro de uma etapa visual. O desenho desses recursos pode ser apresentado separadamente, com tratamento de formulário/envio em andamento.

Comparação de hierarquia candidata para Produtos, sem novos controles:

```text
Atual examinado                       Proposta M07/M08
Nome da unidade + faixa de áreas       Mesmo contexto e faixa
Atenção hoje                          Busca + Novo produto existentes
Busca + Novo produto                   Resumo de atenção, mesmas ações
Filtros existentes                    Mesmos filtros
Lista com total destacado             Lista: Total + divisão legível por área
```

A mudança de ordem só poderá ocorrer se mantiver instâncias, dados, callbacks, sequência de teclado coerente e todas as ações. Se exigir remount com perda de estado ou nova comunicação entre componentes, interromper e reapresentar o escopo.

### 5.4 Formulários, contagens e confirmação

- Cadastro de produto: até oito passos principais, uma pergunta por tela; subpassos existentes não podem ser suprimidos para aparentar menos etapas. O caminho completo pode ter 15 estados. Progresso deve representar o estado real, sem índice clicável novo.
- Cadastros sem rolagem vertical na referência 320×568, com Voltar/Continuar e validação existentes; listas podem rolar naturalmente. Preservar regra do teclado não cobrir campo/ação. Com fonte ampliada, teclado ou combinações que tornem as exigências incompatíveis, registrar o caso e pedir decisão própria, sem reduzir fonte, ocultar campo ou retirar botão para simular conformidade.
- Embalagem/unidade e preço permanecem ligados aos dados/cálculos atuais. Não trocar fator, arredondamento, margem, PMC, variação ou interpretação de decimal para conseguir um layout melhor.
- Conferência continua cega: não mostrar saldo esperado, diferença numérica que o revele nem contador que permita deduzi-lo ao conferente. O dono vê apenas o que sua permissão já autoriza.
- C5/C6 e as regras da Fonte continuam: recontagens, duas iguais divergentes/três diferentes e espera do dono nos casos previstos; não criar tentativa nova trocando ID/dia nem liberar bloqueio pelo fechamento do aviso.
- **Não redefinir o momento de baixa:** a Fonte prevê contagem inicial desconhecida como referência e perda registrada pela equipe com baixa imediata e confirmação posterior. A regra genérica de “todo ajuste só depois do dono” não pode apagar essas exceções silenciosamente. Eventual mudança exige projeto funcional próprio.
- Reenvio com mesmo identificador/payload, estoque atual de `saldos`, desconhecido `null`, trilha `operacoes`, lotes/FEFO e movimentos intervenientes ficam intactos. Não criar API ou cálculo de reconciliação no front-end.

### 5.5 Dispositivos e acessibilidade

| Contexto | Requisito de desenho e verificação futura |
|---|---|
| Celular 320×568 e 390×844 | Ações alcançáveis, 48 px, texto dos inputs ≥16 px, nomes/valores sem sobreposição; cabeçalho e pagamento não cobrem conteúdo; safe area preservada. |
| Tablet 768×1024 | Manter navegação lateral/centro a partir de 768 px conforme Fonte; testar orientação e ausência de competição entre barra local/global. |
| Computador 1024×768 e 1280×900 | Usar largura disponível mantendo ordem de leitura; foco visível e percurso de teclado; não criar tabela com novas ações apenas para preencher espaço. |
| Fonte/zoom 100%, 150%, 200% | Nenhum controle necessário inacessível; registrar conflito com cadastro sem rolagem para aprovação, em vez de esconder conteúdo. Não afirmar certificação WCAG. |
| Android/iPhone/PWA | Testar teclado, Voltar, safe areas, minimizar/retomar, câmera/leitor e instalação em aparelho. Não confundir emulação Chromium com prova física. |
| Acessibilidade | Medir contraste real, nomes acessíveis, ajuda/erro, foco e leitura em tela. Contraste que exija cor nova e mudança de foco/fechamento seguem X08/X07. |

## 6. Plano de execução — 24 etapas pequenas

Todas são **propostas pendentes**, sem autorização de código. A ordem indica prioridade de planejamento, não execução automática. Uma etapa = um escopo apresentado e aprovado; se houver dois arquivos/estados independentes, subdividir antes do patch. A estimativa de esforço é relativa (**B** baixo, **M** médio), sem prazo prometido.

Para cada etapa, os critérios abaixo se somam aos portões da seção 8. “Mesmo comportamento” exige verificar callbacks, payloads, estados e resultados; uma captura bonita não basta. Os testes citados são existentes e candidatos de regressão, não autorização para alterá-los nesta entrega.

### Frente 1 — Textos, instruções e mensagens

**M01 — Acesso da equipe e falha de abertura — P1 / B.** Atual: `PainelEquipe` afirma “nunca veem preços”; `AppFuncionario` pode atribuir falha desconhecida à conexão. Resultado: explicar que a contagem não mostra o esperado e que o caixa autorizado vê preço; mensagem neutra para falha sem causa conhecida. Arquivos candidatos: `src/components/PainelEquipe.tsx` e `src/components/AppFuncionario.tsx`, em subetapas se necessário. Risco: texto sugerir acesso novo ou confundir recusa com rede. Testes: `equipe.test.tsx`, `app-routing.test.tsx`, casos de abertura/falha/permissão. Concluída quando cada capacidade/erro descrito corresponder à condição existente, com mesma quantidade de chamadas e mesmos caminhos de recuperação. Sem alterar permissões.

**M02 — Ajuda para produto não encontrado — P1 / B.** Atual: “Sem cadastro” abre orientação, não venda avulsa. Resultado: rótulo “Produto não encontrado” e explicação simples sobre pedir cadastro ao dono. Arquivo: `src/components/CaixaCelular.tsx`. Risco: texto longo estourar botão ou sugerir bypass. Testes: `caixa.test.tsx`, `caixa-estoque-contagem.test.tsx`; abrir/fechar ajuda com carrinho. Concluída com o mesmo acionador/efeito, carrinho intacto, sem produto/saída fictícios e alvo de toque preservado em 320 px.

**M03 — Promessa do primeiro cadastro — P1 / B.** Atual: “Você pode mudar tudo depois” não corresponde ao editor completo disponível. Resultado: instrução limitada ao que existe, sem promessa de futura edição. Arquivo: `src/components/StoreSetup.tsx`. Risco: alterar instruções de campos obrigatórios ou a saída já entregue. Testes: `cadastro-sair.test.tsx`, `comercio-salvamento.test.tsx`, `cadastro-etapa1-textos.test.ts`; quatro passos e erro. Concluída sem mudar passos, validação, autenticação ou salvamento. Termos e editor ficam em X06.

**M04 — Indicadores globais e explicação factual — P1 / B–M.** Atual: números/descrições nem sempre deixam clara unidade e alcance. Resultado: rótulos compreensíveis para dados já calculados e explicação de diferença sem presumir causa. Arquivo: `src/components/OwnerHome.tsx`; qualquer ajuste em `AntifurtoGeral.tsx` exige subescopo próprio. Risco: mudar significado de soma, nomes oficiais ou quebrar compactação atual. Testes: `resumo-geral.test.tsx`, `rmc-02b.test.tsx`, `rmc-inicio-compacto.test.tsx`, `rmc-c4c2.test.tsx`; zero/uma/seis lojas e dados parciais. Concluída com valores/destinos iguais, descrições legíveis e nenhuma nova contagem de lojas afetadas. Preservar “Faltou este mês” e termos oficiais até decisão específica.

**M05 — Explicação de ganho bruto — P2 / B.** Atual: “Lucro” pode parecer resultado líquido. Resultado: ajuda curta “Ganho bruto por unidade, antes de impostos e despesas”, conservando nomes/fórmulas oficiais. Arquivo: `src/components/ProductArea.tsx`. Risco: confundir margem sobre venda com percentual sobre custo. Testes: `preco-margem.test.tsx`, `preco.test.ts`, `farmacia-tarja-pmc.test.tsx`. Concluída quando exemplos e valores antes/depois forem idênticos, sem novo arredondamento, cálculo ou renomeação não aprovada.

**M06 — Aviso existente de limite do caixa — P2 / B.** Atual: cartão único em fluxo normal já preserva carrinho/bloqueio, mas é longo. Resultado: título e texto curtos, distinguindo quantidade recusada de solicitação confirmada; nenhuma alegação de notificação entregue sem dado. Arquivo: `src/components/CaixaCelular.tsx`. Risco: anunciar sucesso indevido, expor esperado em contagem ou sugerir venda bloqueada inteira quando só incremento foi recusado. Testes: `caixa-estoque-contagem.test.tsx`, `caixa.test.tsx`; incremento, fechamento do aviso, finalização recusada e erro de rede. Concluída com estados corretos para cada contexto, mesma recusa, mesmo carrinho e nenhum texto sobre campos/pagamento. Não criar novo acordeão.

### Frente 2 — Informação e redução de poluição visual

**M07 — Saldo por área no cartão de produto — P1 / B.** Atual: total domina e áreas podem truncar. Resultado: “Total” explícito e depósito/gôndola legíveis com dados existentes. Arquivo: `src/components/ListaProdutos.tsx`. Risco: confundir total com vendável ou transformar desconhecido em zero. Testes: `lista-produtos.test.tsx`, `situacao-uma-area.test.ts`, `vocabulario-tipo.test.tsx`; total 1.001/1.000/1, unidade única, nulos e nomes longos. Concluída sem modificar soma, origem do dado, destino do toque ou adaptação por tipo.

**M08 — Busca antes do resumo em Produtos — P1 / M.** Atual: `AtencaoHoje` antecede busca/novo produto. Resultado: hierarquia da seção 5.3, mantendo todas as ações e o resumo no fluxo. Arquivos: `src/components/StoreSpace.tsx`, `src/components/ListaProdutos.tsx`, `src/components/AtencaoHoje.tsx`, somente se a composição realmente exigir. Risco: remount, perda de busca/filtro, tabulação incoerente ou alteração de props. Testes: `atencao-hoje.test.tsx`, `lista-produtos.test.tsx`, `menu-comercio.test.tsx`; comparar chamadas, filtro, retorno e foco. Concluída com busca antes do resumo na ordem visual e de leitura e todas as ações equivalentes. Necessidade de novo estado/comunicação interrompe a etapa.

**M09 — Densidade dos cartões de pedido — P2 / M.** Atual: estados, valores e contexto consomem muita altura. Resultado: agrupar informações e reduzir repetição espacial sem remover/recolher campos ou criar nova navegação. Arquivo: `src/components/PainelPedidos.tsx`. Risco: aproximar comandos perigosos ou fundir entrega/pagamento. Testes: `pedidos-polimento.test.tsx`, `pedidos-conferencia.test.tsx`, `pagamento.test.tsx`; entregue a pagar, pago a entregar, recusa e pendência. Concluída com todos os dados/controles e diferenças entre estados preservados, sem mudar filtro, ordem ou requisição.

**M10 — Alcance de fornecedor e itens — P1 / B.** Atual: fornecedor global e produtos locais pouco destacados. Resultado: título/instrução sobre fornecedor compartilhado entre comércios e produtos desta unidade. Arquivo: `src/components/PainelFornecedores.tsx`; `SupplierSheet` em `ProductArea.tsx` somente em subetapa aprovada. Risco: sugerir edição local de cadastro compartilhado. Testes: `painel-fornecedores.test.tsx`, `fornecedor.test.ts`, `product-save.test.tsx`; duas unidades, seleção e falha. Concluída com mesmos UUIDs/vínculos e nenhum fornecedor duplicado ou filtro novo.

**M11 — Cabeçalho do fornecedor externo — P2 / M.** Atual: blocos de contexto alongam a resposta. Resultado: ajustar espaçamento/agrupamento, mantendo comércio, endereço, recado, itens, data, recusa e pagamento acessíveis sem novo recolhimento. Arquivo: `src/components/PaginaFornecedor.tsx`. Risco: esconder condição obrigatória, preço opcional parecer obrigatório ou mudar aceite. Testes: `pedido-link.test.tsx`, `resposta-fornecedor-conta.test.ts`; responder/recusar/erro/reenvio. Concluída com contrato e condições de envio idênticos e campos/ação sem sobreposição em 320/390 px.

### Frente 3 — Encontrar funções e reconhecer contexto

**M12 — Descoberta da faixa local existente — P1 / B–M.** Atual: oito destinos não cabem na largura móvel. Resultado: indicação simples de que a faixa pode ser deslizada e área ativa identificável; mesmas oito entradas. Arquivo: `src/components/StoreSpace.tsx`. Risco: novo aviso competir com conteúdo ou ocultar destino. Testes: `menu-comercio.test.tsx`, `tamanhos-tela.test.tsx`, `vocabulario-tipo.test.tsx`; percorrer as oito áreas. Concluída com todos os destinos alcançáveis por toque/teclado, sem nova rota, menu, gesto programático ou mudança de callback. “Todas as áreas” fica em X02.

**M13 — Contexto visual de unidade — P1 / B.** Atual: saudação global e cabeçalhos locais repetem contexto. Resultado: realçar nome da unidade e área ativa usando informações já disponíveis, sem nova troca/retorno. Arquivos: `src/components/StoreSpace.tsx`, com `OwnerHome.tsx` apenas se confirmado no patch. Risco: afetar Início ou exibir unidade antiga durante carga. Testes: `identidade-tela.test.tsx`, `rmc-unificacao.test.tsx`, `dono-nao-desvia.test.tsx`; uma/seis unidades, nomes longos, mudança e consulta parcial. Concluída com alcance reconhecível, mesmos destinos e nenhum estado antigo apresentado como confirmado.

### Frente 4 — Cadastros e formulários

**M14 — Progresso fiel do cadastro de produto — P1 / B–M.** Atual: passos principais e subpassos causam impressão de avanço pouco claro. Resultado: título de bloco/subpasso coerente com índice atual, sem introduzir cálculo de avanço ou navegação novos. Arquivo: `src/components/ProductArea.tsx`. Risco: texto indicar etapa errada ou reduzir artificialmente total. Testes: `product-save.test.tsx`, `embalagem-tela.test.tsx`, testes de opções dos seis tipos e `validade-por-tipo.test.tsx`; percorrer caminho completo. Concluída com mesma sequência, validações, revisão, payload e até oito passos principais. Índice clicável/atalhos ficam em X04.

**M15 — Legibilidade dos campos existentes — P1 / M.** Atual: ajuda/unidade/conversão e botões pequenos variam entre subpassos. Resultado: agrupar rótulo, unidade e ajuda já existentes com espaçamento uniforme, fonte adequada e conversões preservadas. Arquivo: `src/components/ProductArea.tsx`, um bloco por patch. Risco: contrariar cadastro sem rolagem ou alterar embalagem usada. Testes: `embalagem-usada-etapa2.test.tsx`, `embalagem-tela.test.tsx`, `trocar-embalagem.test.ts`, `product-save.test.tsx`; teclado e nomes longos. Concluída sem nova fórmula, campo, dependência, validação ou mudança de trava; conflitos de espaço são documentados, não contornados.

### Frente 5 — Tarefas dos funcionários

**M16 — Convite de instalação compacto — P2 / B–M.** Atual: cartão grande antecede tarefas e há outra entrada ao fim. Resultado: reduzir espaço do cartão atual, preservando opções, posição lógica, ambas as entradas e preferência de adiamento. Arquivo: `src/components/AppFuncionario.tsx`. Risco: afetar instalação, condição por aparelho ou primeiro acesso. Testes: `instalar.test.tsx`, `app-routing.test.tsx`; instalado/não instalado/adiado e capacidades. Concluída com mesmas condições e efeitos de instalação/adiamento, tarefas mais legíveis. Mover/remover entrada ou mudar preferência requer X04.

**M17 — Fases da reposição — P1 / B.** Atual: várias tarefas físicas no fluxo guiado. Resultado: instruções “Conte”, “Busque” e “Confirme o que levou” correspondentes às fases já existentes; local/unidade legíveis. Arquivo: `src/components/ReporGondola.tsx`. Risco: sugerir reposição automática ou revelar esperado. Testes: `reposicao.test.tsx`, `reposicao-retomada.test.tsx`, `reposicao-vendas-meio.test.ts`; interrupção e venda no intervalo. Concluída sem remover fase, requisição, confirmação ou preservação da carga/rascunho. Não criar fila nova.

**M18 — Estados do recebimento — P1 / B.** Atual: contagem, avaria, lote, recontagem e espera do dono têm efeitos distintos. Resultado: textos e agrupamento visual dos estados atuais, distinguindo concluído de pendente sem calcular novos totais. Arquivo: `src/components/ReceberMercadoria.tsx`. Risco: prometer entrada total quando parte aguarda dono ou alterar regras próprias. Testes: `recebimento.test.tsx`, `recebimento-rascunho.test.tsx`, `recebimento-dois-celulares.test.tsx`, `recebimento-motivo.test.tsx`; sem pedido e perda de resposta. Concluída com cegueira, critérios de aceite/recontagem, mesmo ID/payload e estados parciais preservados.

**M19 — Clareza da conferência existente — P1 / B.** Atual: “Conferir estoque/depósito” existe, mas não equivale a duas filas de investigação. Resultado: instrução objetiva de contar o local indicado sem ver o esperado; mensagens atuais de recontagem/aguardar dono mais claras. Arquivo: `src/components/ConferirDeposito.tsx`. Risco: expor esperado, liberar bloqueio ou alterar três tentativas. Testes: `contagem-cega-regra.test.tsx`, `conferir-perda.test.tsx`, `diferencas.test.tsx`; zero real, desconhecido, repetição e bloqueio. Concluída com mesmas tentativas/efeitos/permissões e nenhum novo contador ou ajuste. Filas de gôndola/depósito ficam em X01.

### Frente 6 — Padronização e acessibilidade sem nova interação

**M20 — Alvos de toque do cadastro — P1 / M.** Atual: editar/remover variação tem alvo de 32 px e há campos compactos. Resultado: botões ≥48 px e inputs com texto ≥16 px, começando pelas exceções do cadastro; não diminuir os controles já adequados. Arquivo: `src/components/ProductArea.tsx`. Risco: clique atingir ação vizinha ou quebrar limite de tela. Testes: `variations.test.ts`, `roupas-options.test.tsx`, `tamanhos-tela.test.tsx`; medir caixas reais, editar/remover/cancelar por toque/teclado. Concluída com medidas verificadas, mesmo resultado das ações e sem alteração global indiscriminada de `styles.css`.

**M21 — Associação de ajuda e erro — P1 / B–M.** Atual: `StoreSetup.Field` usa `aria-invalid`, mas a mensagem não é ligada automaticamente por `aria-describedby`. Resultado: associar rótulo/ajuda/erro já presentes com IDs estáveis, sem mudar quando validam. Arquivo: `src/components/StoreSetup.tsx`. Risco: IDs repetidos ou referência a elemento inexistente. Testes: `comercio-salvamento.test.tsx`, `cep-comercio.test.tsx`; verificar DOM acessível e leitura em tela. Concluída com referências válidas em todos os campos/estados, mesmo foco, sequência e disparo de validação. Nova gestão de foco fica em X07.

### Frente 7 — Adaptação aos dispositivos e validação

**M22 — Largura e quebra de conteúdo — P2 / M.** Atual: cartões precisam funcionar de celular a computador sem alongar demais nem cortar dados. Resultado: ajustar apenas layout responsivo de um componente por subetapa. Começar por `src/components/ListaProdutos.tsx`; `CaixaCelular.tsx` e `LeitorContinuo.tsx` são candidatos posteriores separados para dimensões do estado de câmera indisponível. Risco: CSS afetar scanner/foco ou desviar da navegação lateral existente. Testes: `lista-produtos.test.tsx`, `tamanhos-tela.test.tsx`, `scanner.test.tsx` se incluído; matriz de telas, teclado e zoom. Concluída sem novos filtros/tabela interativa, mudanças de câmera ou preferência, com todos os dados e acionadores acessíveis.

**M23 — Geometria do primeiro cadastro no celular — P1 / M.** Atual: exige quatro passos, saída e ações alcançáveis com teclado. Resultado: revisar somente espaçamento/quebra de texto de `src/components/StoreSetup.tsx`, preservando mecanismo de teclado e fluxo. Risco: botão encoberto, perda da saída ou conflito com cadastro sem rolagem. Testes: `cadastro-sair.test.tsx`, `comercio-salvamento.test.tsx`, `tamanhos-tela.test.tsx`; 320×568/390×844 e aparelhos reais com teclado. Concluída sem sobreposição e com todos os controles necessários; incompatibilidade com fonte ampliada exige decisão separada, não redução de fonte/controle.

**M24 — Validação integrada da modernização — P1 / M.** Atual: há evidências locais parciais e pendências reais na seção 3. Resultado: executar roteiros aprovados, consolidar medidas/antes-depois e registrar limitações, sem alterar código nesta etapa de validação. Arquivos candidatos de aplicação: nenhum; registro futuro somente neste plano, conforme autorização. Risco: confundir mock com produção ou um perfil com todos. Testes: matriz da seção 8, cinco capacidades/perfis reais, seis tipos, zero/uma/seis lojas e aparelhos. Concluída somente com evidências por etapa, aceite do dono e pendências identificadas; não declarar gerente/conferente dedicado existente nem fechar etapas sem teste real.

## 7. Fila separada — propostas funcionais ou condicionadas

Nada nesta fila está autorizado. A prioridade funcional pode bloquear validação visual específica, mas não permite ampliar um patch. Cada proposta precisa de estado atual, contrato, arquivos, permissões, riscos, teste, reversão e aprovação próprios, consultando a Fonte antes. Não criar funções ou tabelas sem demonstrar que as existentes não atendem.

| ID | Proposta e dependências | Limite / prioridade |
|---|---|---|
| X01 | Filas independentes de conferência de área de venda/depósito, origem caixa, contadores/estados; desenho de gerente/conferente se solicitado. Reutilizar contagens e trilha existentes; verificar API e acesso sem revelar esperado. | Funcional P1. Não é criar cartão com número fictício. Não alterar Repor nem permissões por CSS. |
| X02 | Histórico de Voltar, preservar origem/filtro/posição, troca segura de unidade e novo menu “Todas as áreas”. | Funcional P1. Proteger formulário/envio; arquitetura/rotas somente em aprovação própria. |
| X03 | Novos agregados de lojas afetadas, horários de atualização e prova de notificação/conferência entregue. | Funcional P1/P2. Só mostrar dados confirmados; não criar inferência no texto. |
| X04 | Confirmação de saída, rascunho novo, índice clicável, busca/filtros/paginação, acordeões, retry, fiado vazio, auto-recolher câmera, preferências/novas condições de instalação. | Funcional P1/P2. Mesmo sem banco novo, muda interação/visibilidade; separar por recurso. |
| X05 | Ordenar vencimentos por urgência, rever disponibilidade de vencidos, conversões novas. | Funcional P0/P1 conforme risco; separar regra de saldo físico, lote e elegibilidade; F02 relacionado. |
| X06 | Termos reais/conteúdo jurídico aprovado, editor completo de comércio e eventual recuperação não implementada. | Funcional/conteúdo P1. Não criar links que prometam conteúdo inexistente. |
| X07 | Corrigir foco/Escape da Etiqueta, consistência de diálogos e nova gestão de foco/fechamento. | Mudança de interação P1, mesmo motivada por acessibilidade. Preservar impressão e estados críticos. |
| X08 | Ajuste pontual de contraste com comparação dos pares atuais/propostos, hover/foco/desabilitado e impacto em todos os usos. | Decisão visual condicionada P1. **Nenhuma alteração de paleta autorizada.** Aprovação específica antes do patch. |
| X09 | Renomear “Antifurto”, “Faltou este mês” ou termos oficiais; redefinir momento de ajuste/perda. | Decisão de significado/regra; preservar original enquanto não aprovada. Texto explicativo neutro não muda cálculo. |
| X10 | F01, F03, F04 e integridade numérica, cada um em seu projeto funcional; F02 em X05. | P0/P1. Não são escopo de modernização visual nem correções realizadas por este documento. |

Para a investigação de mercadoria, o desenho futuro é: excesso recusado → solicitação existente → conferência cega da área de venda → depósito quando necessário → conciliar movimentos → dono analisa e confirma a decisão prevista. Contar não prova furto, não identifica autor e não autoriza ajuste automático. A implementação desse encadeamento e suas lacunas dependem de X01/X05/X10, não de M19.

## 8. Segurança da execução, testes e critérios de aceite

### 8.1 Protocolo obrigatório para cada autorização futura

1. Consultar integralmente a Fonte atual e este plano; consultar histórico/checklist relacionado. Resolver divergência de versões sem sobrescrever trabalho existente.
2. Consultar a ponta remota de `main`, registrar commit e comparar com a base auditada e a última etapa. Ler os arquivos alterados posteriormente; não reutilizar proposta antiga como se a base não tivesse mudado.
3. Confirmar arquivos, trechos, estados e consumidores reais. Apresentar **o que muda, por quê, código/diff proposto, o que deve permanecer, riscos, regressões e como confirmar** antes de modificar código.
4. Obter aprovação expressa desse escopo. “Aprovar o plano” não aprova todas as implementações. Uma etapa não autoriza a seguinte.
5. Aplicar somente o aprovado em trabalho isolado, preservando alterações de terceiros. Não tocar API, banco, cálculos, payloads, IDs, permissões, autenticação, integrações, estados ou regras sob rótulo de visual.
6. Se surgir risco de funcionamento ou arquivo fora do escopo, interromper a parte afetada, apresentar achado/novo patch e pedir aprovação própria. Não enfraquecer teste, esconder erro ou ampliar silenciosamente.
7. Executar regressões adequadas e verificações obrigatórias. Registrar versão, comando, resultado e limites; corrigir somente dentro do escopo aprovado. Reversão por patch pequeno, sem reescrever histórico nem desfazer trabalho alheio.
8. Apresentar antes/depois, comprovação e pendências; atualizar este registro quando autorizado e aguardar validação do proprietário. Distinguir código, testes, merge, publicação e aceite. Merge/publicação dependem de autorização própria; nunca são consequência automática da próxima etapa.

### 8.2 Portões objetivos para qualquer etapa de código

| Portão | Evidência exigida |
|---|---|
| Escopo | Diff contém somente arquivos/trechos aprovados; nenhuma mudança funcional escondida; nenhum segredo ou dado real nas capturas/logs. |
| Tipos e regressão | Antes de eventual publicação: `npx tsc --noEmit` **duas vezes** e `npx vitest run` **duas vezes**, conforme regras do projeto; build. Falhas existentes devem ser identificadas, não omitidas. Não há contagem histórica de testes usada como prova nova. |
| Testes específicos | Executar os testes existentes relacionados citados na etapa e os consumidores compartilhados. Adicionar teste novo somente se necessário para comportamento relevante, sem espelhar classes/texto por conveniência nem alterar testes nesta entrega documental. |
| Equivalência | Mesmas chamadas/callbacks, payloads, IDs de reenvio, efeitos, regras de habilitação e destinos; comparação nos estados normal/erro/parcial/bloqueado. Se mudar qualquer um, reclassificar. |
| Apresentação | Capturas antes/depois com fixtures iguais, mesmas larguras, nomes longos e valores relevantes; medidas de alvos/fonte; sem sobreposição nem funcionalidade perdida. |
| Teclado/acessibilidade | Ordem visual/DOM coerente, foco visível, rótulo acessível, erro ligado; Escape/foco existentes preservados. Mudança de interação exige X07. |
| Validação real | Roteiro e versão apresentados ao dono. Sem teste no app publicado/aparelho, registrar **“Pronto no código; falta o teste do dono”**, nunca “validado”. |

Esta tarefa é documental: não executa os portões de aplicação, não justifica rodar operações reais e não afirma ausência de regressões do produto. A verificação desta entrega é restrição de arquivos, integridade das referências e coerência do plano.

### 8.3 Matriz mínima de regressão dos fluxos atingidos

| Área | Cenários obrigatórios quando afetada |
|---|---|
| Dono/global/unidade | Zero/uma/seis lojas de tipos diferentes; nome longo; consulta completa/parcial/erro; unidade correta; cinco destinos globais e oito locais; retorno existente. |
| Cadastro/edição | Seis tipos; todas as combinações relevantes de subpasso; embalagem já usada; variante removida; nulo versus zero; preço e margem; revisar/voltar/sair; erro e resposta perdida sem duplicação. |
| Compras/fornecedor | Pedido multiforn.; compartilhamento sem prometer envio; resposta/recusa; entrega e pagamento independentes; fornecedor global/itens locais; reenvio e acesso negado. |
| Receber/repor/conferir | Contagem cega; unidade/embalagem; avaria/lote; recontagem; bloqueio; espera do dono; movimento no intervalo; minimizar/PIN; retomada com mesmo identificador; sem revelação de esperado. |
| Caixa | Produto encontrado/não encontrado; incremento até limite/acima; estoque mudou; não cadastrado; erro de leitura/envio; carrinho preservado; finalização/pagamento/fiado/fechamento existentes. F01/F02 impedindo validação devem ser registrados. |
| Perda/diferenças | Mesmo momento de baixa e confirmação; autoria, justificativa, histórico; decisão e erro; nenhum sucesso falso após chamada parcial. F03 é dependência funcional separada. |
| Dispositivos | 320/390/768/1024/1280, teclado físico/móvel, zoom/texto ampliado, safe areas; câmera/leitor/impressora/PWA reais quando afetados. |
| Dados/segurança | Sessão/conta/comércio corretos; recusa de permissão mantida; links secretos fora de capturas/logs; nenhum esperado exposto; nenhuma mutação real em validação visual. |

Testes locais devem usar dados fictícios e serviços controlados. Teste no publicado só com ambiente/roteiro seguros e autorização aplicável; documentar quando não puder executar. Preservar controles de segurança, mesmo que acrescentem passos.

## 9. Registro de aprovação, execução e validação

Estados são independentes: **Pendente** (proposta), **Aprovada** (escopo/patch explicitamente autorizado), **Executada** (código aplicado), **Testada** (evidências técnicas), **Validada** (aceite do dono). Publicação/merge são registros próprios, não sinônimos de teste. Etapa suspensa deve indicar motivo/dependência, sem receber marca de concluída.

| Etapa | Aprovação de implementação | Execução / testes de aplicação | Merge/publicação | Validação do dono |
|---|---|---|---|---|
| DOC-01 — este plano | Somente documentação autorizada | Documento criado; nenhuma implementação | Não realizados | Pendente |
| M01 — textos equipe/erro | M01-A e M01-B autorizadas em escopos próprios | Ambas integradas; M01-B pelo PR #150 (§14) | M01-A: merge confirmado/publicação relatada. M01-B: merge confirmado/publicação não confirmada | M01-A: aceite Android restrito (§13). M01-B: validação física não confirmada |
| M02 — produto não encontrado | Autorizada exclusivamente em 15/10/2026, com ajustes do dono (§14) | Integrada pelo PR #151 (§15) | Merge confirmado; publicação não verificada independentemente | Roteiro aceito por relato do dono; aparelho/versão não informados (§15) |
| M03 — promessa primeiro cadastro | Autorizada exclusivamente em 15/10/2026 (§15) | Implementada/testada na branch exclusiva (§15) | Não realizados | Aguarda revisão/validação do dono |
| M04 — indicadores globais | Pendente | Não iniciados | Não realizados | Pendente |
| M05 — ganho bruto | Pendente | Não iniciados | Não realizados | Pendente |
| M06 — mensagem limite caixa | Pendente | Não iniciados | Não realizados | Pendente |
| M07 — saldo por área | Pendente | Não iniciados | Não realizados | Pendente |
| M08 — busca/resumo | Pendente | Não iniciados | Não realizados | Pendente |
| M09 — cartões pedidos | Pendente | Não iniciados | Não realizados | Pendente |
| M10 — alcance fornecedor | Pendente | Não iniciados | Não realizados | Pendente |
| M11 — página fornecedor | Pendente | Não iniciados | Não realizados | Pendente |
| M12 — descoberta faixa | Pendente | Não iniciados | Não realizados | Pendente |
| M13 — contexto unidade | Pendente | Não iniciados | Não realizados | Pendente |
| M14 — progresso cadastro | Pendente | Não iniciados | Não realizados | Pendente |
| M15 — campos existentes | Pendente | Não iniciados | Não realizados | Pendente |
| M16 — convite instalação | Pendente | Não iniciados | Não realizados | Pendente |
| M17 — fases reposição | Pendente | Não iniciados | Não realizados | Pendente |
| M18 — estados recebimento | Pendente | Não iniciados | Não realizados | Pendente |
| M19 — conferência existente | Pendente | Não iniciados | Não realizados | Pendente |
| M20 — alvos cadastro | Pendente | Não iniciados | Não realizados | Pendente |
| M21 — associação erro/ajuda | Pendente | Não iniciados | Não realizados | Pendente |
| M22 — largura/quebra | Pendente | Não iniciados | Não realizados | Pendente |
| M23 — geometria cadastro | Pendente | Não iniciados | Não realizados | Pendente |
| M24 — validação integrada | Pendente | Não iniciados | Não realizados | Pendente |
| X01–X10 — fila separada | Não autorizada; análise própria | Não iniciados | Não realizados | Pendente |

Ao atualizar uma etapa futuramente, registrar: data UTC; autorização e escopo exato; commit base/final; arquivos; diff; evidências antes/depois; comandos/resultados; dependências; riscos residuais; reversão; PR/merge/publicação quando autorizados; roteiro do aparelho; aceite do dono e próxima etapa proposta. Não preencher campos por inferência.

## 10. Conflitos identificados e decisão de preservação

| Divergência entre propostas e referência | Decisão deste plano |
|---|---|
| Protótipo/auditoria sugerem azul de ação diferente para contraste. | Paleta original preservada; X08 precisa de aprovação pontual. Não copiar CSS do HTML. |
| Auditoria sugere alvo de 44 px e texto operacional 14–16 px. | Fonte prevalece: botão ≥48 px; texto dos campos ≥16 px. Não confundir medida ergonômica com certificação WCAG. |
| Sugestões de conteúdo rolável e cadastro mais curto. | Listas podem rolar; cadastros seguem passos/ausência de rolagem da Fonte. Não fundir passos nem esconder campos. Conflitos de acessibilidade precisam de decisão explícita. |
| Wireframe sugere novas filas, contadores e entradas da equipe. | X01/X03, projeto funcional separado, sem número fictício ou exposição do esperado. |
| Melhorar navegação com Voltar, menus, buscas e acordeões novos. | X02/X04: não são simples espaçamentos. Preservar interações atuais nas etapas M. |
| Vocabulário neutro versus nomes oficiais de antifurto/indicadores. | Acrescentar explicação factual sem mudar nomes/calculadores; renomeações em X09. |
| Regra genérica de confirmação prévia versus exceções de contagem inicial/perda da Fonte. | Manter regras atuais; redefinição de efeito exige X09 e aprovação funcional. |
| Histórico da Fonte/checklist versus commits posteriores já presentes no código. | Não reimplementar entregas nem declarar publicação. Conferir por commit e registrar diferença; este documento não corrige status da Fonte. |
| Procedimento antigo pede atualizar Fonte/CLAUDE e mesclar entrega. | A autorização atual limita-se a este arquivo e proíbe alterar Fonte, merge e publicação. Esses passos não são executados nesta tarefa. |
| Fonte local não publicada diverge da oficial de `main`. | Preservar rascunhos e base oficial identificada; reconciliação posterior somente em escopo próprio. |

## 11. Próxima decisão e continuidade

Primeira candidata: **M01**, começando apenas pelo texto de `PainelEquipe.tsx`, por impacto na compreensão das permissões e baixo esforço. Antes de qualquer código, verificar novamente `main`, confirmar trechos, apresentar patch e roteiro e aguardar autorização expressa. Não iniciar M02 automaticamente.

As 24 etapas são um roteiro de modernização, não uma estimativa do que falta para tornar todo o sistema funcional. A fila funcional, a segurança, o banco real, a publicação e as validações pendentes continuam sob a Fonte e seus checklists. Este plano não promete “100%”, não altera essas regras e não registra melhoria visual como correção de integridade.


## 12. Execução autorizada — M01-A, 15/10/2026 UTC

**Autorização expressa:** “Autorizo a implementação exclusivamente da M01-A, conforme a proposta apresentada.” O proprietário determinou branch/PR exclusivos, sem merge/publicação e sem avanço à M01-B. Este registro não autoriza outra etapa nem encerra as frentes E/G/RMC.

### Base, arquivos e patch aplicado

- `main` conferido novamente antes de editar: `ade999e444a94f1470bb306c6fed442a8f01a9b4`, igual à base da proposta. Fonte, CLAUDE, checklists e componente conferidos contra os arquivos lidos na preparação. Nenhuma melhoria posterior desse texto encontrada.
- Branch exclusiva: `codex/ux-m01-a-texto-equipe-20261015`, preparada em checkout limpo; checkout anterior e rascunhos preservados.
- Aplicação: somente `src/components/PainelEquipe.tsx`, uma substituição literal. Documentos previstos: este plano, `CLAUDE.md` e `docs/CHECKLIST_PONTA_A_PONTA.md`. O plano criado na entrega documental ainda não estava no remoto: entra neste PR com o conteúdo anterior preservado e este acompanhamento.
- Antes: “Eles nunca veem preços nem quanto deveria ter.”
- Depois: “Nas contagens, a equipe não vê a quantidade esperada. Quem tem acesso ao caixa vê os preços de venda.”
- Mesmos elementos, classes, paleta, fonte, ícone, botões, eventos, carregamento e condições. O cartão continua restrito ao uso interno com `titulo=false`; a visão global com `titulo=true` não ganha aviso novo.
- Nenhum arquivo de teste, dependência, configuração, API, banco, migração, Supabase, autenticação, permissão, estoque, cálculo, venda, pedido, integração ou PWA alterado. A Fonte da Verdade permaneceu intacta.

### Evidências técnicas e limites

| Verificação da implementação | Resultado |
|---|---|
| `npx tsc --noEmit` | Duas rodadas aprovadas, código de saída 0. |
| `npx vitest run` | Duas rodadas completas aprovadas: 1.129 testes em 112 arquivos em cada rodada; sem editar testes/assertions/timeouts. Inclui regressões de equipe, QR/código, edição, novo acesso, bloqueio/desbloqueio, habilitação de caixa, PIN e rotas. |
| `npm run build` | Aprovado, código de saída 0; variáveis fictícias no processo, sem alterar `.env` ou configuração. |
| Chromium, componente implementado e CSS reais | 18 cenários: seis estados × 320×568, 390×844 e 1280×900. Estados vazio, equipe ativa, bloqueada, carregando, falha e uso global. Sem corte horizontal/sobreposição ou erro JavaScript nos cenários. |
| Controles existentes em navegador | Adicionar funcionário com um envio simulado, QR/código; habilitar Caixa; bloqueio só após confirmação. Nenhuma escrita real. |
| Teclado e texto ampliado | Nas três larguras: Tab → Enter abre Adicionar; Escape fecha e devolve foco; texto 200% sem corte horizontal ou sobreposição, com rolagem natural. |
| Alvo principal | Adicionar funcionário: 52 px no texto normal; continua acima de 48 px com texto ampliado. Nenhuma classe alterada. |
| Escopo | Conteúdo de PainelEquipe comprovadamente igual à base após somente a substituição aprovada; demais diferenças restritas aos três documentos. |

O roteiro temporário de navegador foi ajustado para selecionar “Fechar” dentro do diálogo correto, pois há mais de um controle com esse nome. Não houve mudança no aplicativo, fixture de produção ou teste oficial para fazer o roteiro passar.

Artefatos locais de entrega: `/workspace/entregas/omnisafe-m01-a-implementacao-2026-10-15/` (capturas das três larguras/estados, `visual.json`, `complementos.json`, logs e diff final). O roteiro usa serviços fictícios e rede externa bloqueada. Não é prova de sessão/banco de produção, publicação ou aparelho físico Android/iPhone; esses itens não foram verificados nesta entrega. O texto maior pode aumentar a altura do cartão no celular; o conteúdo seguinte permanece no fluxo, sem sobreposição.

### Estado e validação do proprietário

**M01-A: implementada e testada na branch; aguarda revisão/validação do dono. Sem merge e sem publicação.** M01 completa permanece aberta: M01-B não iniciada e não autorizada. A criação do PR não encerra nenhuma validação no aplicativo publicado.

Roteiro simples do dono, quando houver versão de teste acessível: Comércios → escolher unidade → Equipe → ler a explicação; abrir Adicionar funcionário e voltar sem salvar. Confirmar que distingue contagem cega de acesso ao caixa e que o texto/botão não se sobrepõem. Registrar aparelho, versão e “funcionou/não funcionou”. Android/iPhone físicos e publicação permanecem pendentes; não publicar automaticamente para obter esse teste.

Próxima ação: proprietário revisar exclusivamente M01-A. Aguardar validação; não iniciar M01-B/M02, mesclar ou publicar sem nova autorização. Registros posteriores de PR/commit devem ser acrescentados sem substituir este histórico.

**Rastreabilidade da entrega:** [PR #149](https://github.com/OmniSafe-360/mock-overlay-magic/pull/149), commit de implementação `1d18c92`. PR aberto para revisão, sem merge/publicação. Verificação automática do GitHub em andamento no momento da criação; não confundir os testes locais aprovados com um CI ainda sem resultado.


## 13. M01-A: aceite restrito; M01-B: execução autorizada — 15/10/2026 UTC

### Validação anterior, sem ampliação de alcance

O proprietário informou que a M01-A foi publicada e testada por ele no Android: a nova explicação apareceu corretamente, a aparência original foi preservada, a janela Adicionar funcionário abriu e o botão X a fechou. O merge do PR #149 foi confirmado no GitHub em 15/10/2026 às 08h06m05s UTC, commit `a1564ba6cb15b3da412232abb03739e835351fcd`. Publicação e teste no aparelho são relato do proprietário; não foram repetidos nesta execução. Modelo, versão instalada e horário exato do teste não informados. Esse aceite não valida cadastro/salvamento de funcionário, PIN, permissões, vendas nem outras funcionalidades.

### M01-B: escopo e preservação

Autorização expressa do proprietário para implementar somente a proposta M01-B. Base `main a1564ba6cb15b3da412232abb03739e835351fcd`, reconferida no remoto antes da edição; branch exclusiva `codex/ux-m01-b-mensagem-abertura-20261015`.

- `src/components/AppFuncionario.tsx`: somente “Sem conexão” → “Não foi possível abrir o app”; “Confira a internet do celular e tente de novo.” → “Tente de novo. Se o problema continuar, peça ajuda ao dono do comércio.”
- `src/test/equipe.test.tsx`: somente três expectativas com o título novo (duas ausências e uma presença); nenhuma verificação funcional, descrição de teste ou timeout alterado.
- Documentação: este plano, `CLAUDE.md` e `docs/CHECKLIST_PONTA_A_PONTA.md`, preservando registros anteriores. Fonte da Verdade intacta.
- Estrutura, classes, paleta, botão, eventos, estados, chamadas, autenticação, PIN, permissões, armazenamento, offline, banco/Supabase e operações intactos. Mensagem separada de falha na atualização do Início preservada literalmente.

A falha genérica deixa de atribuir uma causa não comprovada à internet. Não foi acrescentada classificação de erros: resposta nula continua levando ao código com o aviso de acesso encerrado; comércio desativado mantém a tela específica; falha de rede com cópia válida de Caixa mantém o caminho offline/PIN. Erros lançados de permissão ou HTTP 401/403 que já chegavam ao estado genérico continuam nele, agora com texto neutro, sem liberar acesso nem serem anunciados como falta de internet. Não declarar que toda falha de autenticação passou a ter diagnóstico específico.

### Verificações e evidências

- Tipos: `npx tsc --noEmit`, duas rodadas aprovadas.
- Testes: `npx vitest run`, duas rodadas completas aprovadas, 1.129 testes em 112 arquivos por rodada; mantém verificações de PIN, recuperação offline, acesso revogado e falha separada na atualização do Início.
- Build: `npm run build` aprovado com variáveis fictícias no processo; nenhuma configuração ou dependência alterada.
- Chromium local, componente/CSS reais da branch e API simulada: 30 cenários em 320×568, 390×844 e 1280×900. Falha desconhecida, rede sem cópia, permissão, HTTP 401, HTTP 403, acesso revogado, comércio desativado, PIN, offline com cópia/PIN e nova tentativa. Sem corte horizontal ou erro JavaScript; botão Tentar de novo de 52 px. Nova tentativa: duas chamadas ao Início, exige PIN e não chama desbloqueio antes dele. Revogação apaga chave; demais cenários preservam conforme comportamento existente.
- Comparação literal contra a base: aplicação equivalente a somente duas substituições; teste equivalente a somente três substituições. Diff limitado aos cinco arquivos previstos; sem mudança de Fonte, SQL, banco, configuração ou lógica.

Artefatos locais: `/workspace/entregas/omnisafe-m01-b-implementacao-2026-10-15/` (capturas, métricas, logs e diff). Rede externa bloqueada nos cenários visuais; nenhuma operação no banco real. Chromium responsivo não comprova aparelho físico, instalação PWA, Android/iPhone reais ou sessão publicada. O texto pode ocupar uma linha adicional; classes e fluxo visual permanecem iguais.

**Estado:** M01-B implementada e verificada na branch, pronta para revisão; falta validação do dono. Sem merge/publicação; M02 não iniciada. M01 completa não é declarada validada antes do aceite da M01-B.

Roteiro de aceite: em versão de teste disponível, provocar falha de abertura; ler título e orientação, tocar Tentar de novo e confirmar recuperação pelo caminho habitual, sem pular PIN. Registrar aparelho e versão. Não publicar automaticamente para executar esse roteiro. Reversão: reverter apenas as duas frases e três expectativas, mantendo a rastreabilidade documental.

Rastreabilidade M01-B: [PR #150](https://github.com/OmniSafe-360/mock-overlay-magic/pull/150), implementação `808394d`. Aberto para revisão, sem merge/publicação; CI remoto pendente na abertura, separado das verificações locais aprovadas.


## 14. M02 — ajuda para produto não encontrado, execução autorizada — 15/10/2026 UTC

### Continuidade da M01-B

M01-B integrada ao GitHub pelo PR #150 em 15/10/2026 às 08h37m02s UTC, merge `560b2d7a8c6fb54559857dfaa407b16aab6bbfc6`, confirmado no remoto. Publicação e validação física da M01-B não confirmadas; não declarar aceite geral. Os registros anteriores de PR aberto/sem merge são históricos.

### Autorização, base e arquivos

O dono autorizou exclusivamente a proposta M02, com duas revisões: orientar a **verificar o cadastro** em vez de pedir cadastro novo e conservar “O carrinho atual continua preservado.”. Base `main 560b2d7a8c6fb54559857dfaa407b16aab6bbfc6`, reconferida no remoto antes da edição. Branch própria `codex/ux-m02-produto-nao-encontrado-20261015`; sem merge/publicação/M03.

Somente cinco arquivos: `src/components/CaixaCelular.tsx`, `src/test/caixa.test.tsx`, este plano, `CLAUDE.md` e `docs/CHECKLIST_PONTA_A_PONTA.md`. Fonte da Verdade e demais documentos/regras intactos; históricos anteriores preservados.

### Patch e comportamento preservado

- Botão “Sem cadastro” e título “Produto sem cadastro” → “Produto não encontrado”.
- Ajuda sem código: “Este produto precisa ser identificado.” → “Não encontrou o produto?”. Com código: “O código [código] não está no Omni.” → “O código [código] não foi encontrado no caixa.”.
- Orientação aprovada: “Peça ao dono para verificar o cadastro do produto e a área de venda antes de vender.”. Frase do carrinho mantida literalmente.
- Somente o ícone desse botão ganha `shrink-0`, preservando seus 18 px; nenhuma outra classe, paleta, fonte, componente ou geometria alterada.
- Teste `caixa.test.tsx`: duas expectativas textuais atualizadas (código desconhecido e orientação revisada). Nenhuma verificação funcional, descrição, timeout ou configuração alterada. `caixa-estoque-contagem.test.tsx` executado sem edição.
- Mesmo acionador, estados, callbacks, fechamento, pesquisa, leitor, pausa de leitura, autenticação, permissões, preços, estoque, pagamentos, vendas e recuperação offline. Sem cadastro automático, venda avulsa, API, SQL, banco/Supabase ou integração alterados. Aviso separado “Código … não está cadastrado” e ausência de resultado por nome mantidos.

### Verificações e limites

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | Duas rodadas aprovadas, saída 0. |
| `npx vitest run` | Duas rodadas completas aprovadas: 1.129 testes em 112 arquivos por rodada; sem falhas ou erros não tratados no resumo. Inclui caixa, estoque/contagem, pagamentos, recusas e recuperação. |
| `npm run build` | Aprovado, saída 0, variáveis fictícias somente no processo; sem configuração/dependências alteradas. |
| Chromium, componente e CSS reais da branch | 320×568, 390×844 e 1280×900: 15 capturas (ajuda vazia, carrinho, ajuda preenchida, código desconhecido, recusa de estoque). Sem corte horizontal ou erro JS na rodada concluída. |
| Dimensões | Nas três larguras, botão 48 px de altura, rótulo em duas linhas, ícone 18×18 px; X com 48 px e Entendi ≥48 px; janela dentro da tela. |
| Operações simuladas | Ajuda vazia/preenchida; Entendi/X/Escape/fundo; busca por nome com/sem resultado, busca sem acento; códigos desconhecidos por entrada manual e teclado; leitura ignorada na janela; sem preço avulso. Ajuda/códigos desconhecidos não chamam abrir/conferir/registrar. |
| Carrinho e estoque | Dois produtos, três unidades e R$ 20,97 preservados, com rascunho literalmente igual antes/depois da ajuda. Excesso acima de cinco unidades de Bala mantém cinco, solicita conferência uma vez e não registra venda. |
| Auditoria do diff | Aplicação equivalente somente às substituições aprovadas e classe do ícone; testes equivalentes somente às duas expectativas. Demais diferenças restritas aos três documentos autorizados. |

A primeira tentativa do roteiro visual parou ao procurar a busca após fechamento; o log do Vite registra otimização de dependências e recarga da bancada. Com o servidor estabilizado, o mesmo roteiro passou nas três larguras, sem alterar aplicação/testes para contornar a falha; apenas diagnóstico temporário no roteiro externo. Isso não é evidência de defeito do fluxo publicado.

Artefatos locais: `/workspace/entregas/omnisafe-m02-implementacao-2026-10-15/` (capturas, `visual.json`, logs e diff final). API fictícia, rede externa bloqueada nos cenários visuais, sem escrita em banco real. Não foi possível verificar aparelho físico, câmera/leitor físico, publicação, instalação Android/iPhone ou dados reais nesta entrega. CI remoto será acompanhado no PR; não confundir verificações locais com um CI ainda pendente.

### Estado e aceite

**M02: pronta no código da branch e testada; falta revisão/validação do dono. Sem merge/publicação, sem avanço para M03.** M01-B mantém apenas a integração confirmada; demais frentes E/G/RMC preservadas.

Roteiro do dono em versão de teste autorizada: com carrinho vazio e preenchido, abrir Produto não encontrado; conferir instrução, código quando houver e frase do carrinho; fechar por Entendi/X; verificar itens, quantidades e total. Em 320 px, confirmar botão de duas linhas sem corte e ícone preservado. Não publicar automaticamente para obter esse teste. Reversão restrita: reverter textos/classe e as duas expectativas, preservando acompanhamento histórico.

Rastreabilidade M02: [PR #151](https://github.com/OmniSafe-360/mock-overlay-magic/pull/151), implementação `a16695a`. Aberto para revisão; sem merge/publicação, CI remoto pendente na abertura. Não avançar à M03.


## 15. M03 — explicação do cadastro, execução autorizada — 15/10/2026 UTC

### Continuidade da M02

M02 integrada pelo PR #151 em 15/10/2026 às 09h36m21s UTC, merge `12e72e42d7daef1eab601cb322a9757063ed1e0b`, confirmado no GitHub. Depois do roteiro apresentado, o dono informou “Sim passou mande o M03”. Registrar somente esse aceite do roteiro da M02, sem estender a outras funcionalidades. Aparelho, versão instalada e horário do teste não informados; publicação e teste físico não verificados independentemente. Registros anteriores de PR aberto/sem merge são históricos.

### Autorização e patch exato

O proprietário autorizou exclusivamente substituir a frase do cadastro e atualizar os três documentos de acompanhamento, sem editar testes/Fonte da Verdade, sem merge/publicação e sem iniciar M04. `main` reconferido antes da edição: `12e72e42d7daef1eab601cb322a9757063ed1e0b`; nenhuma mudança posterior da frase encontrada. Branch exclusiva `codex/ux-m03-explicacao-cadastro-20261015`.

- `src/components/StoreSetup.tsx`: “Leva menos de 2 minutos. Você pode mudar tudo depois.” → “Informe os dados do seu comércio para começar.”.
- Documentos autorizados: este Plano Mestre, `CLAUDE.md` e `docs/CHECKLIST_PONTA_A_PONTA.md`, preservando históricos anteriores. Fonte da Verdade intacta.
- Nenhuma outra frase, classe, elemento, paleta, tipografia, componente, passo, campo, validação, evento, estado, botão, salvamento, cancelamento, saída, autenticação, permissão, banco/Supabase ou integração alterados. Não cria editor de comércio nem promete prazo de preenchimento.
- Todos os arquivos de teste, dependências, configurações, SQL e migrações permanecem intactos.

### Verificações e evidências

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | Duas rodadas aprovadas, saída 0. |
| `npx vitest run` | Duas rodadas completas aprovadas, 1.129 testes em 112 arquivos por rodada; sem editar testes/assertions/timeouts. Inclui `cadastro-sair.test.tsx`, `comercio-salvamento.test.tsx` e `cadastro-etapa1-textos.test.ts`. |
| `npm run build` | Aprovado, saída 0; variáveis fictícias no processo, sem mudança de configuração. |
| Chromium, componente/CSS reais da branch | 320×568, 390×844 e 1280×900: quatro passos em `first` e `add`, sucesso do primeiro cadastro; complemento 320×844 para leitura da frase. Total de 28 capturas; sem corte horizontal ou erro JavaScript nos cenários examinados. Continuar/Cadastrar mantêm alvo ≥48 px e ficam dentro da tela. |
| Navegação e validação | Voltar/Continuar mantém seleção; passo sem tipo/dados não avança; CPF inválido recusado; nome/documento/telefone/CEP/número aceitos pelos caminhos existentes. CEP simulado; revisão mostra os dados. |
| Cancelamento e saída | Cancelar em `add` após revisão chama callback uma vez e não insere; Sair da conta no primeiro passo de `first` chama callback de saída uma vez, sem inserção. Autenticação/saída reais cobertas pelos testes existentes com serviços simulados, não por sessão real nesta tarefa. |
| Salvamento | `first`: uma inserção simulada, confirmação de sucesso e um `onFinish` ao ir ao painel; sem gravação em banco real. A suíte existente cobre falhas de sessão/salvamento, bloqueios durante envio e conservação dos campos. |
| Auditoria do diff | Aplicação literalmente igual à base após somente uma substituição de frase; demais diferenças limitadas aos três documentos. Todos os testes e a Fonte da Verdade intactos. |

A classe preexistente `tiny:hidden` oculta esta explicação em alturas até 620 px: em 320×568 ela continua oculta, sem remover/alterar a regra para forçar sua exibição. O complemento 320×844 confirma o novo texto visível em duas linhas. Em 390×844 e 1280×900 a frase aparece sem corte. Truncamentos/visibilidades preexistentes de outros elementos não foram reformulados nesta etapa.

Artefatos locais: `/workspace/entregas/omnisafe-m03-implementacao-2026-10-15/` (capturas, `visual.json`, logs e diff). Bancada temporária fora do repositório, componente/CSS reais, Supabase/CEP simulados e rede externa bloqueada, sem alteração de aplicação para executar o roteiro. Não foi possível verificar instalação PWA, teclado/câmera/aparelho Android/iPhone físicos, Google ou sessão/banco reais. Verificação automática do GitHub deve ser acompanhada no PR; aprovação local não equivale a CI remoto ainda pendente.

### Estado e próximo aceite

**M03 pronta no código da branch e testada, falta revisão/validação do dono. Sem merge/publicação; M04 não iniciada.** Demais frentes E/G/RMC e validações pendentes preservadas.

Roteiro para versão de teste autorizada: abrir primeiro cadastro ou Adicionar comércio; quando houver altura disponível, conferir “Informe os dados do seu comércio para começar.”; passar e voltar pelas quatro etapas, sem envio real desnecessário, e confirmar aparência/controles. Registrar resultado/aparelho/versão; não presumir publicação. Reversão restrita à frase, conservando o acompanhamento documental.

Rastreabilidade M03: [PR #152](https://github.com/OmniSafe-360/mock-overlay-magic/pull/152), implementação `b9924e4`. Aberto para revisão; sem merge/publicação, CI remoto pendente na abertura. Não avançar à M04.
