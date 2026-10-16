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
| M05 — ganho bruto | Implementada (opção A, 15/10/2026), aguarda revisão | `m05-ganho-bruto` + preço/margem/farmácia aprovados; suíte 2× | Capturas responsivas não realizadas | Pendente |
| M06 — mensagem limite caixa | Implementada, aguarda revisão | 1.189 testes 2× | 30 capturas | Pendente |
| M07 — saldo por área | Pendente | Não iniciados | Não realizados | Pendente |
| M08 — busca/resumo | Implementada (16/10/2026), aguarda revisão | atencao-hoje/lista-produtos/menu-comercio + m08 novo; suíte 1.194 2× | 12 capturas 320/390/1280 × 100/200%, com e sem produtos | Pendente |
| M09 — cartões pedidos | Pendente | Não iniciados | Não realizados | Pendente |
| M10 — alcance fornecedor | Pendente | Não iniciados | Não realizados | Pendente |
| M11 — página fornecedor | Pendente | Não iniciados | Não realizados | Pendente |
| M12 — descoberta faixa | Implementada (16/10/2026), pedido do dono "finaliza ela" | `m12-faixa-deslizar` (3 novos) + menu-comercio/tamanhos-tela; suíte 2× | Chromium 320/390/1280 × 100/200% (§23) | Falta o teste do dono |
| M13 — contexto unidade | Implementada, testada e integrada ao main (16/10/2026; revisão técnica aprovada em `ef75121`) | `m13-contexto-unidade` (6 novos); tipos e suíte 2× | Chromium 320/390/768/1280 × 100/200% (32 capturas) | Aguarda publicação e homologação final do dono |
| M14 — progresso cadastro | Implementada (16/10/2026), pedido do dono "faça a etapa M14" | `m14-progresso-cadastro` (2 novos, falham sem a mudança); suíte 2× | Chromium 320/390/1280 × 100/200% (§24) | Falta o teste do dono |
| M15 — campos existentes | Blocos A–D implementados (16/10/2026): código, preço, depósito/área de venda e validade | `m15-campos-legiveis` (7 novos, falham sem a mudança); suíte 2× | Chromium 320/390/1280 × 100/200% (§25–§28) | Falta o teste do dono |
| M16 — convite instalação | Implementada (16/10/2026), pedido do dono "Pode fazer a M16" | `m16-convite-instalacao` (1 novo, falha sem a mudança) + `instalar`; suíte 2× | Chromium 320/390/1280 × 100/200% (§29) | Falta o teste do dono |
| M17 — fases reposição | Implementada (16/10/2026), pedido do dono "Pode fazer a M17" | `m17-fases-reposicao` (2 novos, um falha sem a mudança) + reposição; suíte 2× | Chromium 320/390/1280 × 100/200% (§30) | Falta o teste do dono |
| M18 — estados recebimento | Implementada (16/10/2026), pedido do dono "Pode fazer a M18" | `m18-estados-recebimento` (1 novo, falha sem a mudança) + recebimento; suíte 2× | Chromium 320/390/1280 × 100/200% (§31) | Falta o teste do dono |
| M19 — conferência existente | Implementada (16/10/2026), aguarda revisão | conferência/contagem cega/diferenças/vocabulário + suíte 1.189 2× | 60 capturas 320/390/1280 × 100/200% | Pendente |
| M20 — alvos cadastro | Implementada (16/10/2026), pedido do dono "Pode fazer a M20" | `m20-alvos-cadastro` (2 novos, falham sem a mudança); suíte 2× | Chromium 320/390/1280 × 100/200% (§32) | Falta o teste do dono |
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

## M04-A — textos dos indicadores globais (15/10/2026)

Só textos em OwnerHome.tsx; ver registro em CLAUDE.md. Aguarda revisão do dono; sem merge/publicação; M04-B não iniciada.

## 16. H2 — estabilidade na abertura do Início, execução autorizada — 15/10/2026 UTC

Autorizada exclusivamente pelo proprietário, base `2045a3831ff0`. Arquivos: `src/components/OwnerHome.tsx` (apresentação), `src/test/rmc-h2-abertura.test.tsx` (novo), `src/test/rmc-02c.test.tsx` (somente o caso "todos indisponíveis", autorizado) e registros. Primeira leitura sem resultado confirmado: quadro neutro "Conferindo pendências…" com altura do quadro verde, contador "conferindo resumo…", valores "…"/"Consultando…", sem "—", "Consulta incompleta" ou R$ 0,00 provisórios. H1 preservada (quadro da última consulta tem prioridade). Cálculos, consultas, banco, sino (H3) e M04-B intactos. Verificações: tipos 2×, 1.151 testes 2×, build, segredos/dependências, capturas 320/390/1280 a 100% e 200% com dados fictícios. Pendências: ajuste do caso falha+carregando (proposto, não aplicado), diferença de altura em 320 px a 200%, contador na atualização interna, saudação truncada; revisão do dono, merge, publicação e teste no Android. **Executada/testada; não validada.**

## 17. H3 — indicador do sino durante consultas, execução autorizada — 15/10/2026 UTC

Alterada só a apresentação/semântica do sino em `OwnerHome.tsx`: consulta em andamento ou comércio ainda não consultado não acende a bolinha; falha já identificada (`visao.erro`) e consulta encerrada incompleta acendem amarela; urgência confirmada continua vermelha. Nome acessível: "Alertas[: N para resolver agora][; consulta incompleta][; atualizando]". Sem temporizador; `disponibilidade`, `visao`, consultas e cálculos iguais; H1/H2 preservadas. Limitação conhecida, não tratada: aviso confirmado antes some do sino durante a nova consulta do mesmo comércio (retenção exige nova autorização). Testes: `src/test/rmc-h3-sino.test.tsx` (10). **Implementada no código, aguardando revisão do dono; não publicada.**

- [ ] M04-B (15/10/2026) — unidades nos indicadores, "Soma de todos os comércios" só com dados completos e "Subtotal: X de Y comércios" no antifurto; só apresentação em OwnerHome.tsx + teste rmc-m04b. Pendências separadas: sino durante atualização e contador de resumo completo. Aguarda revisão; sem publicação.


## 18. AC01 — acessibilidade do caixa, correção independente — 15/10/2026 UTC

### Autorização, continuidade e base

O proprietário autorizou: “executar primeiro essa correção independente do caixa, antes da M07”, após a análise técnica e visual dos dois componentes. Escopo: apresentação da tela **Vender** e da indisponibilidade da câmera, sem alteração operacional. Base `main 43658dbe2e0098b5c22a473f2b569cf3a554c3b2`, reconferida no remoto antes de editar; branch exclusiva `codex/caixa-acessibilidade-20261015`. M07–M24 e X01–X10 não iniciadas por esta autorização. Sem merge/publicação automáticos.

Continuidade informada no documento de transferência do dono: M01–M06 e H1–H3 concluídas, publicadas e validadas por ele; última versão informada `43658db`. Implementações presentes no main; Actions `38790121635` aprovado no mesmo SHA, conferido pela API. Publicação/validação física são relato do dono, não nova inspeção de produção nesta execução. Os registros antigos que dizem “aguarda revisão/sem publicação” são históricos; este registro não amplia os aceites para outros fluxos, segurança ou aparelhos. Fonte da Verdade integralmente preservada.

### Alterações aplicadas e limites

- `src/components/CaixaCelular.tsx`, somente JSX/classes de `Vender`: faixa superior mantém Voltar, câmera e menu; identificação do turno e aviso offline entram na área rolável. Identificação deixa de truncar. Resumo, total e Limpar venda passam ao final dessa área; rodapé contém apenas Receber com o valor atual, mesmas condições/callback.
- Nome de cada produto ocupa a largura completa; controles e subtotal podem quebrar de linha. Removida largura fixa de 80 px do subtotal. Busca e Produto não encontrado usam grade com mínimo em `em`, empilhando quando falta largura para a fonte atual. Mesmos textos, acionadores e efeitos.
- Total detalhado usa `text-2xl` (24 px na referência, 48 px na simulação 200%), em vez de `text-4xl` (36/72 px), para evitar partir o exemplo R$ 6.172,80. Não há teto fixo, escala inversa ou supressão da ampliação. Valor e formatação `brl` não mudam; palavras/valores excepcionalmente longos podem continuar em outra linha, sem ocultação.
- Quantidade/remover item, fechar aviso e Limpar venda recebem alvos mínimos de 48 px. Ícone do Receber fica separado do fluxo do texto para não ocupar uma linha sozinho. Fonte Inter, tokens de cores, fundos, estados, mensagens da M06 e cantos existentes preservados.
- `src/components/LeitorContinuo.tsx`: erro usa altura natural com mínimo de 160 px e mensagem no fluxo; vídeo/carregamento continuam com 160 px. Tentar de novo e Lanterna com mínimo de 48 px. Mesmos efeitos, leitura, pausa, recorte, callbacks, tentativas e condições da câmera/lanterna.
- Nenhuma alteração em `Tela`, `Sheet`, `btnPrimary`, CSS global, testes oficiais, configurações, dependências, cálculos, autenticação/PIN, permissões, banco/Supabase/SQL, estoque, pagamentos, offline, IDs ou integrações. Outros estados/janelas do caixa não foram redesenhados; não afirmar acessibilidade integral de todos eles.
- Documentação: este plano, `CLAUDE.md` e checklist ponta a ponta, somente acréscimos com históricos preservados. Nenhum outro arquivo autorizado implicitamente para correção funcional.

### Verificações concluídas no código final

| Verificação | Resultado e alcance |
|---|---|
| Tipos | `npx --no-install tsc --noEmit`, duas rodadas finais aprovadas. |
| Suíte completa | `npx --no-install vitest run`, duas rodadas finais: **1.189 testes / 118 arquivos aprovados por rodada**, sem erros não tratados no resumo. Inclui caixa, estoque/contagem, mensagens M06, pagamentos, PIN, fiado, recuperação e scanner. Nenhum teste/assertion/timeout editado. |
| Build | `npm run build` aprovado, variáveis fictícias somente no processo; sem publicar nem alterar configuração. |
| Segurança | Sete testes do verificador aprovados; scan de 1.852 blobs sem ocorrências administrativas nos padrões pesquisados; consulta de 554 pacotes sem avisos conhecidos. Não é certificação de segurança integral. |
| Auditoria de código | AST antes/depois: lógica fora do JSX, expressões de conteúdo e todos os atributos exceto `className` iguais. Complemento, não substituto dos testes funcionais. |
| Visual | **96 cenários / 48 pares antes–depois / 204 capturas**, Chromium, componentes reais e CSS real, Inter oficial carregada localmente. 320×568, 390×844 e 1280×900; texto normal e 200%; vazio, carrinho, estoque recusado, câmera desligada, nome/valor longos, 12 linhas, câmera simulada pronta e erro de rede/offline. |
| Geometria | Nenhum estouro horizontal nos elementos verificados depois; alvos envolvidos ≥48 px. Em 320×568/200%, carrinho comum: centro **86 → 363 px**; 390×844/200%: **406 → 687 px**. Cabeçalho/Receber permanecem acessíveis e conteúdo rola entre eles. |
| Equivalência visual | Nos 48 pares: mesmo total, mesmo rascunho e mesmas chamadas/payloads simulados. Data fictícia fixada para comparação. Nenhuma escrita em produção. |
| Fluxos no navegador | Seis roteiros completos (antes/depois × três larguras, fonte normal): ajuda por Entendi/X/Escape, código desconhecido por teclado, busca, menu, câmera sem remontar nas janelas, ligar/desligar, lanterna simulada, −/+, cancelar limpeza, conferir e finalizar em Pix. Mesmas chamadas/payloads, um registro por venda simulada. Fechamento do aviso e cinco unidades preservadas também verificados nos cenários visuais 100/200%. |

Na primeira conferência visual apareceu estouro do botão Produto não encontrado em 320/200%; grade responsiva ajustada dentro do componente autorizado. O total grande partia o valor e o ícone do CTA ficava sozinho; apresentação ajustada, seguida de novas rodadas finais de tipos/testes/capturas. Uma comparação inicial encontrou apenas horários diferentes nas fixtures; relógio fixado somente na bancada. Roteiro de fluxos corrigido por vídeo fictício sem quadro e seletor que procurava “Menu” em diálogo oficialmente chamado “Caixa”. Nenhum app/teste oficial foi alterado para contornar esses problemas da bancada. Logs das tentativas preservados.

Artefatos: `/workspace/entregas/omnisafe-caixa-acessibilidade-2026-10-15/` — capturas, métricas, comparações, fluxos, logs, auditoria e diff completo. Bancada fora do repositório, dados fictícios, APIs simuladas e rede externa bloqueada. Fonte 200% é ampliação simulada de fonte/entrelinha, não teste físico nem zoom nativo do navegador. Câmera/lanterna simuladas não comprovam hardware. Android/iPhone instalados, teclado nativo, safe areas reais e produção não foram verificados. Aumento de rolagem nos estados com mensagem de câmera longa é intencional para preservar a leitura.

### Estado, aceite e próxima ação

**AC01 implementada e testada na branch; aguarda revisão e validação do proprietário. Não integrada nem publicada.** CI do novo PR será registrado separadamente; aprovação local não equivale à do commit remoto. M07 continua pendente, sem autorização automática. Pendências do sino, contador, saudação, cadastro e segurança seguem separadas.

Roteiro do dono, após acesso a uma versão autorizada: abrir o caixa com letra normal e ampliada; conferir Voltar/câmera/menu e identificação; abrir busca/ajuda e retornar sem mudar carrinho; verificar nomes, quantidades, subtotal, resumo e Receber; tentar quantidade acima do saldo e fechar aviso; câmera negada deve mostrar mensagem e Tentar de novo completos por rolagem. Registrar aparelho, navegador/versão publicada e resultado. Não provocar venda real somente para testar aparência. Publicar/mesclar somente após autorização própria. Reversão: patch inverso apenas dos dois componentes, preservando histórico e registros.


## 19. M07 — saldo por área no cartão do produto — 15/10/2026 UTC

**Continuidade AC01:** PR #154 integrado em `main b08fb99cce74969ba23b6c3e5931e8e7d8d94ecb`, em 15/10/2026 às 20h00m37s UTC, confirmado no GitHub; conteúdo idêntico ao head aprovado `ab8bf0c`. Após o roteiro de Publicar → Atualizar e conferência do caixa, o proprietário informou “tudo ok pode ir para a M07”. Aceite restrito a esse roteiro, por relato do dono; publicação relatada nesse contexto, não reinspecionada independentemente. Aparelho, navegador e versão desse teste não foram informados novamente; não ampliar o aceite para offline, hardware, estoque, segurança ou outras funcionalidades. Pendências fora desse roteiro permanecem. Registros anteriores de branch/merge/publicação pendentes são históricos.

### Autorização, base e arquivos

Após receber o diff, riscos e prévias da M07, o dono autorizou “SIM PODE FAZER”. Base remota reconferida antes da edição: `b08fb99cce74969ba23b6c3e5931e8e7d8d94ecb`, sem mudanças desde a proposta. Branch exclusiva `codex/ux-m07-saldo-areas-20261015`. Somente o patch aprovado de `src/components/ListaProdutos.tsx` e acréscimos neste plano, no `CLAUDE.md` e no checklist ponta a ponta. Fonte da Verdade e seus históricos intactos; nenhum teste oficial, dependência, configuração, SQL ou integração alterados.

### Resultado e preservação

- Apenas `Linha`: cartão em coluna, bloco próprio com rótulo “Total”, número e unidade atuais; divisão por área após o total, fonte `text-sm` e quebra natural em vez de `truncate`. Mesmo tamanho do total, paleta, Inter, borda, situação e cores. Categoria/nome conservam suas regras preexistentes, fora deste patch.
- Mesmas expressões `s.qtd.total/dep/ven`, `fmtQ`, singular/plural, condição `t != null`, títulos por tipo e `onOpen`. Zero continua zero; desconhecido continua “— / não contado”. Área única e variações seguem a regra atual; não torna saldo físico elegível para venda.
- Busca, filtros, ordem, Novo produto, quantidade adicional de alertas, preço e destino do toque iguais. Sem mudança de API, banco, cálculo, estoque, contagem cega, autenticação, permissão, venda ou navegação. M08 não iniciada.
- Efeito visual aprovado: cartão mais alto e maior rolagem natural. No exemplo Nescau com nome em duas linhas/fonte normal, altura medida de 141 para 229 px na bancada; não há promessa de maior densidade. Demais controles não foram reformulados.

### Verificações e alcance

| Verificação | Resultado |
|---|---|
| Tipos | `npx --no-install tsc --noEmit`, duas rodadas aprovadas. |
| Suíte completa | `npx --no-install vitest run`, duas rodadas: **1.189 testes / 118 arquivos aprovados por rodada**; sem erro não tratado no resumo. Nenhum teste/assertion editado. |
| Específicos | 19 testes em `lista-produtos.test.tsx`, `situacao-uma-area.test.ts`, `vocabulario-tipo.test.tsx` aprovados; executados também na suíte completa. |
| Build | `npm run build` aprovado com variáveis fictícias somente no processo; sem publicar/configurar serviço. |
| Segurança | Sete testes do verificador aprovados; padrões de segredos em 1.857 blobs sem ocorrências; 554 dependências sem avisos conhecidos. Não comprova segurança integral. |
| Auditoria do patch | Arquivo literalmente igual ao protótipo aprovado. AST antes/depois: lógica fora do JSX, expressões e atributos funcionais iguais, excluindo apenas `className`; novo texto estático “Total”. |
| Navegador | **96 cenários / 48 pares / 96 capturas** antes/depois: 320×568, 390×844, 768×1024 e 1280×900; seis tipos de comércio; texto normal/200%. Componente/CSS reais e Inter local, dados fictícios, rede externa bloqueada. |
| Dados e geometria | 11 produtos por cenário: 1.001/1.000/1, zeros, desconhecido em cada área, sem áreas, área única, unidade singular, decimais, valor grande e variação de roupa. Mesmos valores/textos informativos nos 48 pares; sem estouro horizontal dos cartões ou corte da divisão por área nas versões novas medidas; cartões >48 px. |
| Ações | Toque e Enter abrem os mesmos IDs; Novo produto chama o mesmo callback. Em fonte normal, busca por código/nome, sem resultado, Precisam de atenção e retorno a Todos verificados nas duas versões/seis tipos/quatro larguras. Não é nova prova de navegação autenticada/publicada. |

Artefatos locais: `/workspace/entregas/omnisafe-m07-implementacao-2026-10-15/` — comparação visual, capturas, métricas, auditoria, logs e diff completo. Bancada temporária fora do repositório. Fonte 200% é simulação de fonte/entrelinha, não zoom nativo nem aparelho físico. Não foi possível verificar Android/iPhone/PWA instalados, teclado nativo ou dados/sessão de produção. Limitações preexistentes de nome/categoria e demais telas permanecem fora do escopo. CI do commit remoto registrado no PR; aprovação local não equivale a CI ainda pendente.

### Estado e validação seguinte

**M07 implementada/testada na branch; aguarda revisão e validação do dono. Sem merge/publicação automáticos, sem M08.** Os registros antigos de M07 pendente são anteriores a esta execução. Roteiro do dono após acesso a versão autorizada: abrir Produtos, conferir Total e áreas com letra normal/ampliada; buscar/filtrar; abrir e voltar da mesma ficha. Comparar números existentes sem alterar estoque para teste visual. Registrar versão e resultado. Reversão restrita ao patch de Linha, conservando os registros históricos.


## 20. M09 — cartões da lista de pedidos, execução autorizada — 16/10/2026 UTC

### Autorização e continuidade

Depois da proposta completa (diff, quatro arquivos, riscos, prévias e testes), o proprietário respondeu “Pode fazer a próxima”. Autorização aplicada somente à M09 apresentada, sem ampliar para M10. Base `main d40ab1f528235527ca79cdabc05134d1e7e11cab`, reconferida antes de editar, sem mudanças desde a proposta. Branch exclusiva `codex/ux-m09-cartoes-pedidos-20261016`.

Continuidade confirmada no GitHub: PR #155/M07 integrado em `1267d82994744b5a369e13b66a6422caca65fcad`; PR #162/documentação integrado em `d40ab1f`. M08/M19 e F-16A–G já presentes no main por outro acesso, sem reaplicação. Publicação no Lovable e validações manuais não foram confirmadas novamente pelo dono: não encerrar essas pendências. F-16H permanece com as quatro contagens vazias pendentes, sem acesso administrativo ativo nesta execução; consulta somente leitura foi preparada separadamente. Nenhum dado removido nem perda da Dipirona repetida.

### Patch aplicado e preservação

Somente classes de `lista.map` em `src/components/PainelPedidos.tsx`, literalmente iguais ao protótipo aprovado:
- Gap dos grupos de12px para8px, mantendo padding principal16px, tamanhos de fonte, cores, bordas, foco e alvos dos cartões.
- Bloco de valores usa grade com6px entre linhas; estimativa/estimativa parcial, valor do fornecedor e suas condições permanecem separados, com os mesmos números. Segunda divisória com6px de espaço superior.
- Entrega e Pagamento mantêm seus ícones/rótulos/descrições. Rótulo e texto podem ficar na mesma linha quando couber; conteúdo com base flexível de até12em volta à linha seguinte quando faltar espaço. Forma de pagamento continua em linha própria; divisórias superiores8px.
- Orientação completa no rodapé e seta preservadas. Nenhum texto, atributo funcional, callback, estado, condição, dado, cálculo, filtro, busca ou ordem alterado. Não foram acrescentados botões, atalhos financeiros, acordeões ou novas rotas.
- Detalhe, montagem, envio, recebimento, cancelamento e pagamento intactos; sem banco/Supabase/SQL, estoque, permissão, autenticação, integrações, dependências, CSS global ou testes oficiais modificados. Fonte da Verdade intacta. Apenas um componente e acréscimos no Plano Mestre, CLAUDE e checklist.

### Verificações e limites

| Verificação | Resultado |
|---|---|
| Tipos | `npx --no-install tsc --noEmit`, duas rodadas aprovadas, saída0. |
| Suíte completa | `npx --no-install vitest run`, **1.202 testes / 123 arquivos aprovados em cada uma de duas rodadas**, sem erro não tratado no resumo. Nenhum teste/assertion/timeout editado. |
| Específicos | `pedidos-polimento`, `pedidos-conferencia`, `pagamento`:47 testes aprovados; também cobertos nas duas suítes. Incluem recebido a pagar, pago a entregar, busca/filtro/retorno, condições de cancelamento durante contagem e decisão somente após conclusão. |
| Build | `npm run build` aprovado com variáveis fictícias somente no processo; sem publicação ou configuração real. |
| Segurança | Sete testes do verificador aprovados; 1925 blobs sem ocorrências nos padrões de segredos e 554 dependências sem avisos conhecidos. Não certifica segurança integral. |
| Auditoria | Arquivo igual ao diff/protótipo aprovado; AST antes/depois confirma lógica fora do JSX, expressões e atributos não CSS iguais. Paleta, cores dinâmicas e demais trechos preservados. |
| Visual |48 cenários/24 pares/96 capturas:320×568,390×844,768×900,1280×900; fonte100/200; fornecedor normal, longo/valores grandes e não carregado. Componente/CSS reais, Inter local, dados fictícios e rede externa bloqueada. |
| Estados | Oito cartões por cenário: recebido a pagar, pago a entregar, recusado, conferência em andamento, parcial, rascunho sem preço, recebimento aguardando decisão e cancelado. Textos idênticos nos24pares; 23 dos24 cenários novos sem estouro horizontal dos cartões; exceção extrema preexistente e inalterada descrita abaixo; altura dos cartões acima48px. |
| Navegação | Nas versões antes/depois e fonte normal: abrir detalhe/voltar, buscar número, retornar com busca preservada e filtrar contas a pagar. Nenhum callback operacional de salvar/enviar/cancelar/link/pagar foi chamado. |

**Limitação visual confirmada, fora do patch:** em320px/texto200%, estimativa fictícia deR$12.345.678,90 provoca estouro de68px no cartão, antes e depois (clientWidth278/scrollWidth346, iguais nos oito cartões). O cenário ampliado detectou a limitação na revisão das métricas; não houve regressão de largura por este patch. Não foi corrigida silenciosamente: exigirá proposta visual própria se priorizada. Os outros23 cenários novos medidos não têm esse estouro. Logs/métricas do diagnóstico preservados; não declarar ausência geral de corte ou acessibilidade integral.

Artefatos locais: `/workspace/entregas/omnisafe-m09-implementacao-2026-10-16/` (comparação, capturas, métricas, diff e logs). Não houve gravação em banco real. Fonte200% é simulação de fonte/entrelinha, não zoom nativo nem aparelho físico. Não foi possível verificar Android/iPhone/PWA instalados, leitor de tela, hardware, sessão ou dados reais. Não é redesenho geral de Pedidos: demais seções permanecem como antes. Conteúdo obrigatório continua completo; cartão longo ou fonte grande pode exigir maior rolagem.

### Estado e próxima ação

**M09 implementada/testada na branch; pronta para revisão, falta validação do dono.** CI do commit exato será acompanhado no PR, separado das verificações locais. Sem merge/publicação automáticos; M10 não iniciada. Registros históricos anteriores de pendência são preservados, sem tratá-los como estado atualizado desta execução.

Próximo passo: dono revisar o PR/diff e comparar a prévia; merge somente com autorização própria. Após integração autorizada, Publicar → Atualizar e conferir Pedidos: ler recebido a pagar versus pago a entregar, valores, textos grandes, filtros, abrir detalhe e voltar. Não registrar pagamento, cancelar pedido real ou alterar estoque somente para testar aparência. Registrar versão/aparelho/resultado; até lá, teste físico permanece pendente. Reversão restrita às classes aprovadas, preservando os históricos.


## 21. M10-A — clareza dos fornecedores compartilhados — 16/10/2026 UTC

### Autorização, base e continuidade

Após a proposta completa e o pedido específico de aprovação da M10-A, o dono respondeu “Pode fazer”. Escopo: somente a frase do cabeçalho de `PainelFornecedores.tsx` e acréscimos neste plano, em `CLAUDE.md` e no checklist ponta a ponta. Base remota reconferida: `main 25c888636286d0364c4c9b265ba9530abbde37da`. Branch exclusiva `codex/ux-m10-a-fornecedores-20261016`.

M09 integrada pelo [PR #163](https://github.com/OmniSafe-360/mock-overlay-magic/pull/163), merge `25c888636286d0364c4c9b265ba9530abbde37da`, em 16/10/2026 às 14h33m40s UTC, confirmado no GitHub. Publicação e validação física da M09 continuam sem confirmação. Registros anteriores de branch/merge pendentes são históricos; não reaplicar M09. M08/M19 já presentes no main; contagens vazias de F-16H continuam pendentes de verificação própria, nenhum dado removido e perda da Dipirona não repetida.

### Alteração exata e preservação

Antes: “Valem para todos os seus comércios.”

Depois: “O cadastro e as alterações dos fornecedores valem para todos os seus comércios. Os produtos abaixo são apenas deste comércio.”

O painel já diferenciava produtos locais nos cartões; a frase passa a explicitar também o alcance das alterações do cadastro compartilhado. Mesma tag `p`, mesmas classes, tipografia, paleta, ordem e controles. Comparação literal confirma arquivo inteiro idêntico ao main fora dessa substituição e idêntico ao protótipo aprovado.

Sem mudanças de componentes, formulário SupplierSheet/ProductArea, estados, eventos, filtros, ordenação, links, cálculos, IDs, vínculos, persistência, permissões, autenticação, banco/Supabase/SQL, estoque, pedidos, vendas, configurações, dependências, testes oficiais ou Fonte da Verdade. Documentos anteriores preservados por acréscimo. Eventual explicação dentro do formulário exigirá subetapa própria; M10-B não está automaticamente aprovada.

### Verificações técnicas

- `npx tsc --noEmit` e `npx --no-install tsc --noEmit`: duas rodadas aprovadas, saída 0.
- `npx --no-install vitest run`: **1.202 testes / 123 arquivos aprovados em cada uma das duas rodadas**, sem erro não tratado no resumo. Nenhuma expectativa ou timeout alterado. Inclui os 15 testes existentes de `painel-fornecedores.test.tsx`, `fornecedor.test.ts` e `product-save.test.tsx`.
- `npm run build`: aprovado com variáveis fictícias restritas ao processo, sem publicação. Avisos do build preservados, sem alteração de dependências/configuração para suprimi-los.
- Sete testes de `scripts/verificar-seguranca.test.mjs` aprovados. Não equivale a auditoria integral de segurança.
- Chromium local, componente implementado importado diretamente da branch e componente anterior extraído da base; CSS real/Inter local; dados fictícios e rede externa bloqueada. **36 cenários / 18 pares / 54 capturas**, em 320×568, 390×844 e 1280×900; texto 100%/200%; lista vazia e duas unidades fictícias com fornecedor compartilhado e produtos locais diferentes.
- Explicação sem corte horizontal; Novo fornecedor com pelo menos 52 px de altura nas medições. Textos dos cartões, links e callbacks observados iguais nos 18 pares. Em texto normal: expansão/seleção de produto local sem exibir o produto da outra unidade; edição/criação com falha fictícia mantendo campos e sucesso fictício fechando a janela, mesmos IDs/dados enviados.
- Seis cenários adicionais antes/depois nas três larguras: nome vazio, e-mail inválido e telefone curto bloqueiam salvar; fechar pelo X/Escape funciona e não chama gravação. São serviços simulados, não transações ou testes de isolamento reais no servidor.

### Riscos e limites preservados

A explicação maior aumenta a altura e a rolagem: em 320 px, parágrafo de20→80px com texto normal e de80→320px com texto ampliado a200%. Isso é esperado; não reduzir texto, esconder ações ou alterar layout fora do aprovado.

**Problema preexistente fora do escopo:** atalhos WhatsApp/Ligar/E-mail apresentam sobreposição em320px com fonte200%, tanto antes quanto depois. Os alvos preexistentes de editar/expandir têm44px; não foram aumentados nesta troca de frase. Não declarar acessibilidade geral aprovada. Correção visual desses controles requer proposta/escopo próprios; nenhum controle funcional foi removido.

Fonte200% é simulação de fonte/entrelinha, não validação do zoom nativo. Não foi possível verificar Android/iPhone/PWA instalados, leitor de tela, banco publicado, políticas implantadas ou gravação real. Links externos não acionados. Artefatos locais em `/workspace/entregas/omnisafe-m10-implementacao-2026-10-16/`: comparação, capturas, métricas, diff e logs. Não são automaticamente publicados no GitHub.

### Estado atualizado e próxima ação

| Etapa | Implementação/testes | Merge/publicação | Validação do dono |
|---|---|---|---|
| M09 | Integrada pelo PR163; registros técnicos na seção20 | Merge confirmado; publicação não confirmada | Teste físico não confirmado |
| M10-A | Autorizada, implementada e testada na branch exclusiva | Não realizados; PR para revisão e CI do commit exato separado | **Pronto no código; falta o teste do dono** |

Os registros antigos de pendência mantêm valor histórico; esta seção registra a situação atual. M10 não representa revisão completa do formulário ou dos contatos; M10-B/M11 e demais etapas não iniciadas nesta entrega.

Próximo passo: revisar o PR/diff e as evidências; aguardar autorização própria para merge. Depois de eventual integração autorizada, **Publicar → Atualizar** no Lovable e testar: abrir comércio → Fornecedores, ler o aviso, expandir produtos, abrir e fechar Editar sem salvar; repetir em outro comércio, se houver, verificando os produtos locais e o cadastro compartilhado. Não alterar fornecedor real só para testar o texto. Registrar aparelho/versão/resultado. Reversão restrita à frase, conservando os históricos. Não fazer merge/publicação nem avançar automaticamente.


## 22. M11 — cabeçalho da página do fornecedor, execução autorizada — 16/10/2026 UTC

### Autorização, base e continuidade

Após a proposta específica (diff, quatro arquivos, prévias, riscos e testes), o proprietário respondeu “Pode fazer o proximo”. Autorização aplicada exclusivamente à M11 apresentada, sem ampliar para alterações no formulário ou M12. Base remota reconferida: `main 0d3f91c13955d2706a82d3a646118c06e432d7f9`, sem mudanças desde a proposta. Branch exclusiva `codex/ux-m11-cabecalho-fornecedor-20261016`.

M10-A integrada pelo [PR #164](https://github.com/OmniSafe-360/mock-overlay-magic/pull/164) em16/10/2026 às14h51m40sUTC, merge `0d3f91c13955d2706a82d3a646118c06e432d7f9`, confirmado no GitHub. Publicação e teste físico da M10-A ainda não confirmados; não interpretar pedido da próxima etapa como aceite físico. M09/PR163, M08 e M19 já presentes; não reaplicar. Os registros anteriores de branch/merge pendentes são históricos. F-16H/contagens vazias continua pendente de verificação própria; nenhuma remoção nem perda da Dipirona repetida.

### Patch aplicado e preservação

Somente classes literais dentro de `Cabecalho` em `src/components/PaginaFornecedor.tsx`, exatamente iguais ao protótipo aprovado:

- Espaço entre blocos e entre comércio/fornecedor/telefone:12→8px.
- Grupo número/data e situação: `flex-wrap`, gap8px, identificação com `flex-1 basis-40 min-w-0 break-words`; situação com `max-w-full break-words`, preservando cores e `shrink-0`. A situação passa para baixo quando faltar espaço.
- Endereço e recado: padding horizontal16px preservado; vertical16→12px. Texto do endereço recebe `min-w-0 break-words`; recado recebe `break-words`.

Nenhuma tag, texto, ícone, condição, ordem DOM, estado, evento, campo, valor, link, callback, cálculo ou requisito de envio alterado. Paleta, fontes, tamanhos, bordas, telefone e controles intactos. Comparação sem os atributos className literais resulta em código idêntico; trechos fora de Cabecalho idênticos. Formulario, Resumo, token, acesso, estoque, pedidos/pagamentos, permissões, banco/Supabase/SQL e integrações preservados. Sem recolhimento/revisão adicional, funcionalidade nova, mudança de configuração/dependência/testes oficiais ou Fonte da Verdade. O endereço recolhível do relatório original UX14 continua excluído conforme M11/X04 do Plano.

Apenas um componente e acréscimos neste Plano, CLAUDE e checklist, preservando todo o conteúdo e histórico anteriores.

### Verificações e resultados

| Verificação | Resultado |
|---|---|
| Tipos | `npx --no-install tsc --noEmit`, duas rodadas aprovadas, saída0. |
| Suíte completa | `npx --no-install vitest run`: **1.202 testes / 123 arquivos aprovados em cada uma das duas rodadas**, sem erro não tratado no resumo. Testes/assertions/timeouts não alterados. |
| Relacionados | Os24 testes de `pedido-link.test.tsx` e `resposta-fornecedor-conta.test.ts` integram ambas as suítes: data/prazo, opcionais, resposta por item, recusa, link inválido/cancelado, conferência, erros/reenvio e preservação de conta existente no SQL do repositório. Isso não comprova versão do banco publicado. |
| Build | `npm run build` aprovado com variáveis fictícias somente no processo; sem publicação/configuração real. |
| Auditoria do diff | Aplicação igual ao protótipo aprovado; somente oito linhas de classes dentro de Cabecalho; expressões/ações e restante do arquivo idênticos. |
| Visual | **60 cenários / 30 pares / 60 capturas** no Chromium,320×568/390×844/1280×900 × fonte100/200; contexto normal/longo/mínimo, já respondido e entrega em conferência. Componente implementado importado diretamente da branch, CSS real/Inter local, dados fictícios e rede externa bloqueada. |
| Equivalência | Texto completo da página, links, campos, botões, estados observados e chamadas iguais nos30pares. Nenhum estouro horizontal medido no cabeçalho proposto nos30cenários novos; não é verificação integral de sobreposição/acessibilidade da página. |
| Fluxos | **18 cenários / 9 pares** simulados nas três larguras: aceitar com opcionais vazios; recusa com confirmação/Voltar sem envio; boleto sem prazo bloqueado; resposta parcial, erro preservando data/recado, reenvio idêntico, Alterar e Voltar sem mudar sem envio adicional. Payloads iguais antes/depois; sem gravações reais. |

Exemplo normal/fonte100: cabeçalho320px de539→481px (menos58px),390px de479→447px (menos32px),1280px de439→407px (menos32px), com todas as informações. Número volta a caber em uma linha no exemplo320, situação abaixo; conteúdo longo/fonte ampliada continua exigindo rolagem.

### Riscos e limites

A situação pode mudar de posição vertical conforme largura; palavras longas podem quebrar. Grupos se aproximam, sem remover informação ou proteção. Não prometer que todo o pedido caiba na primeira tela.

**Limitações preexistentes, fora do patch aprovado:** alvos44px e sobreposições nos grupos Tenho/Outra qtd./Não tenho e atalhos de data em320px com fonte200% permanecem no formulário inalterado. Não declarar acessibilidade geral ou48px em todos os controles. Exigem proposta própria se priorizados. A mensagem de erro de abertura existente também fica intacta.

Fonte200% é simulação de fonte/entrelinha, não zoom nativo. Não foi possível verificar aparelhos Android/iPhone/PWA instalados, leitor de tela, teclado nativo, banco publicado ou links reais. Rede externa bloqueada, telefone fictício não acionado. Artefatos locais em `/workspace/entregas/omnisafe-m11-implementacao-2026-10-16/` (comparação, métricas, capturas, payloads, diff e logs); não publicados automaticamente no GitHub. Não há certificação operacional geral ou segurança integral.

### Estado e próxima ação

**M11 implementada/testada na branch; pronta para revisão, falta o teste do dono.** CI do commit exato acompanhado no PR, separado dos resultados locais. Sem merge/publicação automáticos; M12 não iniciada. M10-A integrada, publicação e aceite físico sem confirmação; registros anteriores mantêm caráter histórico.

Próximo: dono revisar PR/diff/evidências e autorizar merge separadamente. Após integração autorizada, **Publicar → Atualizar** e abrir link de pedido de teste: ler número/situação/comércio/endereço/recado, conferir produtos e acesso aos campos/ações, com texto normal/ampliado; sem enviar resposta de pedido real só para testar apresentação. Registrar aparelho/versão/resultado. Reversão restrita às classes aprovadas, preservando históricos. Não avançar automaticamente.


## 23. M12 — descoberta da faixa local, execução — 16/10/2026 UTC

**Pedido do dono:** "Analise a M12, vê o que falta terminar e finaliza ela." Não existia outra M12 no GitHub; a M11 seguia no PR #165, de outro arquivo.

**Escopo:** só apresentação em `src/components/StoreSpace.tsx`.
- As pontas da faixa, que já tinham sombreado quando havia partes escondidas, ganharam uma seta (‹ ou ›, `aria-hidden`) no lado que continua.
- Abaixo da faixa, a linha "Deslize para o lado para ver as 8 partes" aparece só quando alguma parte está escondida (`bordas.esq || bordas.dir`, o mesmo cálculo que já existia).
- O que fica igual: as mesmas 8 entradas, a ordem, os nomes, os avisos, o destaque da parte ativa, a centralização ao tocar, os eventos e os caminhos. Banco, cálculos e outros componentes não mudaram.

**Testes:** novo `src/test/m12-faixa-deslizar.test.tsx`, com 3 casos:
- quando tudo cabe, não aparece seta nem a linha;
- no começo aparece só a seta da direita, no meio as duas e no fim só a da esquerda, sempre com a linha;
- as 8 partes continuam e as setas não são lidas como botões.

Dois desses casos falham sem a mudança. `menu-comercio` e `tamanhos-tela` passaram sem alteração. Tipos 2× e a suíte completa 2× passaram.

**Navegador:** Chromium com bancada isolada, componente/CSS reais e dados fictícios, em 320/390/1280 px com letra 100% e 200%.
- No celular (320 e 390), a seta da direita aparece no começo. Depois de tocar em Diferenças, a faixa vai até o fim, aparece só a seta da esquerda e Diferenças fica ativa.
- No computador (1280) tudo cabe, e não aparece seta nem a linha.
- Nenhuma rolagem lateral da página e nenhum erro de execução.
- Com letra 200%, a linha quebra em duas sem cortar e a seta fica mais discreta.

**Achado anterior, fora desta etapa:** com letra 200% os nomes curtos dos botões da faixa e o nome do comércio no cabeçalho ficam cortados ("Pro…", "Dep…"). Já era assim antes, porque os botões têm largura fixa de 92 px. Fica para a M22 (largura e quebra).

**Pendente:** Publicar → Atualizar e o teste do dono no celular. Roteiro: abrir um comércio no celular; a faixa mostra › e "Deslize para o lado para ver as 8 partes"; deslizar até o fim; aparece ‹; no computador não aparece nada disso.

- 16/10/2026 — **M13 (contexto visual da unidade)**: implementada em `StoreSpace.tsx` com a disposição "alt" aprovada (botões em cima; nome inteiro e cidade/UF em toda a largura; "Área atual" abaixo da faixa M12, sem aria-live). Teste `m13-contexto-unidade.test.tsx`; tipos 2×, 1.211 testes 2× (erro solto conhecido numa rodada), build e verificações ok; 32 capturas do componente real. Limitação: "Supermercado" quebra no meio em 320 px a 200%. Implementada no código; falta revisão do dono; sem publicação; M14 não iniciada.

## 24. M14 — progresso do cadastro de produto, execução — 16/10/2026 UTC

**Pedido do dono (16/10/2026):** conferir as etapas anteriores e, se não houver correção, fazer a M14. Conferido: M11 (#165), M12 (#166) e M13 (direto no main pelo Lovable, `ef75121`) estão no `main` `7406648`; CI verde; tipos e 1.211 testes passaram. Nenhuma correção necessária.

**O que mudou (só apresentação, `src/components/ProductArea.tsx`):**
- Nos passos que se dividem em partes (Depósito/Estoque, Área de venda, Validade), aparece acima da pergunta o nome do passo ("DEPÓSITO", "ÁREA DE VENDA", "VALIDADE"), usando os mesmos nomes de `TITLES` e o mesmo texto por tipo (`T`: farmácia diz "Estoque").
- O contador troca o "· 1/3" por "· parte 1 de 3"; aparece nas mesmas condições de antes.
- A barra passa a usar o mesmo número de partes do contador. Antes, quando o passo era de uma parte só (depósito/área "manter sem configurar" ou validade ainda sem "Sim"), a barra parava em 1/3 ou 1/4 do passo, sem contador. Exemplo: Validade sem resposta, antes 78%, agora 87,5% (7 de 8). Mesmo total, mesma sequência.
- O contador desce para a linha de baixo quando não cabe ao lado do título (antes ficava por cima do título em 320 px com letra 200%).

Sequência dos passos, validações, revisão, salvamento, navegação e banco iguais.

**Provas:** teste novo `src/test/m14-progresso-cadastro.test.tsx` (2 casos: caminho completo do mercado com nome do passo, contador e barra em cada tela, e salvar uma vez; farmácia com "Estoque"); os dois falham sem a mudança. Tipos 2×, 1.213 testes/126 arquivos 2×, build. Chromium (bancada fora do projeto, componente real) em 320/390/1280 × 100/200%, telas Código, Depósito parte 1 e 2, Validade (sem resposta e com Sim) e Conferir: sem rolagem lateral, contador dentro da tela e sem cobrir o título, sem erro.

**Achado anterior, fora desta etapa:** em 320 px com letra 200% o resto da tela do cadastro já não cabe (botão Continuar cortado). Fica para a M22.

**Pendente:** Publicar → Atualizar e o teste do dono. Roteiro: cadastrar um produto novo; no Depósito ver "DEPÓSITO", a pergunta e "Passo 5 de 8 · parte 1 de 3"; avançar e ver "parte 2 de 3"; na Validade, ver a barra cheia até o passo 7 antes de responder.

## 25. M15 — legibilidade dos campos do cadastro, bloco A — 16/10/2026 UTC

**Pedido do dono (16/10/2026):** "Pode fazer a M15". O plano manda fazer um bloco por vez; este é o bloco A (tamanho dos botões pequenos e da letra miúda). Feito sobre a branch da M14 (PR #167), porque mexe no mesmo arquivo.

**O que mudou (só apresentação, `src/components/ProductArea.tsx`):**
- Botão **Escanear** (código do produto, da variação e da embalagem): altura de toque de 36 px para 44 px. Usa margem negativa, então a linha do rótulo não cresce e o botão não encosta no campo.
- Botão **Remover validade** (X em cada linha de validade): de 36 × 36 px para 44 × 44 px, sem crescer a linha. Ganhou `shrink-0`: antes, com letra 200% em 320 px, ele era espremido até 16 px de largura (problema anterior).
- "Fonte: Open Food Facts. Confira antes de salvar." passou de 11 px para o tamanho pequeno padrão (12 px).

Não mudam: textos, campos, cálculos, conversões, validações, travas de embalagem, sequência e banco.

**Provas:**
- Teste novo `src/test/m15-campos-legiveis.test.tsx` com 3 casos: Escanear com 44 px, Remover validade com 44 px sem espremer, e nenhum texto de 11 px nem botão de 36 px no cadastro. Os 3 falham sem a mudança.
- Tipos e 1.216 testes em 127 arquivos, duas vezes; build aprovado.
- Chromium em 320/390/1280 × 100/200%: Escanear com 44 px (88 px com letra 200%) sem cobrir o campo; Remover validade com 44 × 44 (88 × 88 com letra 200%); sem rolagem lateral e sem erro.

**Fica para os próximos blocos da M15:** espaçamento entre rótulo, unidade e ajuda nos passos Preço, Depósito/Área de venda e Validade.

**Pendente:** Publicar → Atualizar e o teste do dono. Roteiro:
1. Em Novo produto → Digitar código, tocar em Escanear e ver se abre a câmera.
2. Na Validade, com duas datas, tocar no X de uma e ver se ela some.

## 26. M15 — legibilidade dos campos do cadastro, bloco B (preço e unidade) — 16/10/2026 UTC

**Pedido do dono (16/10/2026):** "Pode fazer o próximo bloco da M15". Feito sobre o bloco A (PR #168), porque mexe no mesmo arquivo.

**O que mudou (só apresentação, `src/components/ProductArea.tsx`, passo "Preço e unidade"):**
- **Campo "Lucro sobre o custo (%)":** altura de 32 px para 44 px, do tamanho do dedo.
- **Unidade de medida e Categoria:** o nome do campo diminui em tela baixa, como nos outros campos (`short:text-xs`).
- **Explicações "Como você vende este produto." e "Ajuda a organizar a lista.":** escondem com o teclado aberto, como as dos outros campos (`field-hint`).
- **Lista de opções (`Chips`):** também é usada nos detalhes do produto, então os detalhes ganharam o mesmo comportamento.

Não mudam: textos, cálculo do lucro e do preço, unidade travada, validações, sequência e banco.

**Rolagem do passo (medida antes/depois no Chromium):**

| Tela | Letra | Antes | Depois |
|---|---|---|---|
| 320 × 568 | 100% | já rolava 244 px | rola 252 px (+8) |
| 390 × 844 | 100% | não rola | não rola |
| 1280 × 900 | 100% | não rola | não rola |

Com letra 200%, a tela já rolava muito antes (anotado para a M22). Em nenhum caso há rolagem lateral, e não houve erro.

**Provas:**
- Teste novo no `src/test/m15-campos-legiveis.test.tsx`; ele falha sem a mudança.
- Tipos e 1.217 testes, duas vezes; build aprovado.

**Fica para os próximos blocos da M15:** passos Depósito/Área de venda e Validade.

**Pendente:** Publicar → Atualizar e o teste do dono. Roteiro: em Novo produto → Preço, digitar a porcentagem de lucro (o campo agora é maior) e conferir se o preço de venda muda junto.

## 27. M15 — legibilidade dos campos do cadastro, bloco C (depósito e área de venda) — 16/10/2026 UTC

**Pedido do dono (16/10/2026):** "Pode fazer o próximo bloco da M15" (segunda vez). Base: `main` com os blocos A e B (#168, #169).

**O que mudou** (só apresentação, `src/components/ProductArea.tsx`). Nos passos Depósito/Estoque e Área de venda, a loja de roupas ficava diferente dos outros tipos:
- **"Quantidade informada no cadastro":** em cada tamanho/cor aparecia só o número ("2"). Agora traz a unidade ("2 peças"), como já acontecia no quadro de confirmação, com a mesma função `qtdUn`.
- **Resumo dos limites e aviso "Você tem mais que o desejado":** em cada tamanho/cor, tanto no depósito quanto na área de venda, a letra passou de 12 px para 14 px, o mesmo tamanho usado nos outros tipos.
- **Total de cada tamanho/cor na área de venda:** a letra passou de 12 px para 14 px, o mesmo tamanho do total nos outros tipos.

Não mudam: textos (só a unidade foi acrescentada), contas, conversões, validações, travas, sequência e banco. Os outros tipos não mudam.

**Provas:**
- Teste novo no `src/test/m15-campos-legiveis.test.tsx`; ele falha sem a mudança.
- Tipos e 1.218 testes passaram duas vezes; build aprovado.
- Chromium (loja de roupas com dois tamanhos, um com nome de cor longo) em 320/390/1280 px, com letra 100% e 200%: sem rolagem lateral e sem erro.

**Achado anterior, fora desta etapa:** em 320 × 568 com letra 200%, o passo de limites praticamente não mostra os campos, porque o espaço fica com o título e os botões. Já era assim antes; fica para a M22.

**Fica para o próximo bloco da M15:** passo Validade.

**Pendente:** Publicar → Atualizar e o teste do dono. Roteiro: editar uma roupa com tamanhos, ir até "Quanto há no estoque?" e conferir "Quantidade informada no cadastro: 2 peças".

## 28. M15 — legibilidade dos campos do cadastro, bloco D (validade) — 16/10/2026 UTC

**Pedido do dono (16/10/2026):** "Pode fazer o próximo bloco da M15" (terceira vez). Base: `main` com os blocos A, B e C (#168–#170).

**O que mudou (só apresentação, `src/components/ProductArea.tsx`, passo Validade):**
- **"Contado / Distribuído / Falta distribuir":** "Contado" já tinha a unidade e os outros dois mostravam só o número. Agora os três a mostram, com a mesma função `qtdUn`. Exemplo: "Distribuído: 5 caixas · Falta distribuir: 0 caixas".
- **Botão "Desfazer" (pendente de conferência, farmácia):** era um texto pequeno de toque difícil. Agora tem 44 px de altura de toque, com margem negativa para a linha não crescer.
- **Explicação "Registrar esta quantidade como pendente de conferência?…":** a letra passou de 12 px para 14 px, porque é um texto importante para decidir.

Não mudam: textos (só a unidade foi acrescentada), contas, validações, travas, pendências, sequência e banco.

**Provas:**
- Dois testes novos no `src/test/m15-campos-legiveis.test.tsx`; os dois falham sem a mudança.
- Tipos e 1.220 testes passaram duas vezes; build aprovado.
- Chromium (farmácia, validade desconhecida e pendente de conferência) em 320/390/1280 px, com letra 100% e 200%:
  - Desfazer com 44 px de altura (88 px com letra 200%);
  - "Distribuído: 5 caixas · Falta distribuir: 0 caixas";
  - sem rolagem lateral e sem erro.

**Com isso, os quatro blocos da M15 estão feitos:** código, preço e unidade, depósito/área de venda e validade.

**Pendente:** Publicar → Atualizar e o teste do dono. Roteiro:
1. Na farmácia, cadastrar um remédio.
2. Na Validade, marcar "Validade desconhecida".
3. Tocar em "Registrar como pendente de conferência".
4. Tocar em "Desfazer".
5. Conferir "Distribuído: X caixas".

## 29. M16 — convite de instalação compacto — 16/10/2026 UTC

**Pedido do dono (16/10/2026):** "Pode fazer a M16".

**O que mudou** (só apresentação, `src/components/AppFuncionario.tsx`, função `CartaoInstalar`). O cartão "Instale o app no celular" aparece na tela inicial do Omni Operação, antes das tarefas. Agora ocupa menos espaço:
- título e frase juntos;
- os dois botões lado a lado quando cabem;
- borda interna menor.

Continuam iguais:
- **O conteúdo:** os mesmos textos, os mesmos dois botões ("Instalar o app" e "Agora não", ambos com 48 px de toque, a regra do projeto) e o mesmo lugar na tela.
- **Quando aparece:** não aparece se o app já foi instalado ou adiado, e "Agora não" esconde por 7 dias.
- **O que os botões fazem:** instalar com um toque ou mostrar o passo a passo.
- **O botão do rodapé:** "Instalar o app no celular" continua lá.

**Altura do cartão, medida no Chromium (antes → depois):**

| Tela | Letra 100% | Letra 200% |
|---|---|---|
| 320 px | 238 → 166 px | 778 → 778 px |
| 390 px | 218 → 146 px | 650 → 658 px |
| 1280 px | 198 → 106 px | 394 → 250 px |

Primeira versão usou botões de 44 px; o Codex apontou a regra do projeto (botões ≥ 48 px, §5 deste plano) e os botões passaram a 48 px. Com letra 200% o cartão fica do mesmo tamanho ou 8 px maior, porque os dois botões agora têm 48 px (antes "Agora não" tinha 44).

Não houve rolagem lateral em nenhum caso. Com isso, as tarefas aparecem mais cedo na tela.

**Provas:**
- Teste novo: `src/test/m16-convite-instalacao.test.tsx`. Ele falha sem a mudança.
- Os testes antigos de `instalar.test.tsx` continuam passando: passo a passo, instalar com um toque, "Agora não" e cartão escondido com o app instalado.
- Tipos e 1.219 testes passaram duas vezes; build aprovado.

**Pendente:** Publicar → Atualizar e o teste do dono. Roteiro:
1. Abrir o Omni Operação pelo navegador do celular, sem o app instalado.
2. O cartão deve aparecer menor, com "Instalar o app" e "Agora não".
3. "Agora não" faz o cartão sumir.

### 28.1 Correção da M15: botões de 48 px — 16/10/2026 UTC

Na revisão da M16 (PR #172), o Codex apontou que a regra do projeto pede **botões de pelo menos 48 px** (§5 deste plano), e não 44 px. Os botões que a M15 aumentou tinham ficado com 44 px. Agora têm 48 px (`src/components/ProductArea.tsx`):
- **Escanear** (código do produto, da variação e da embalagem): 48 px. A linha do rótulo cresce 4 px e o botão não cobre o campo.
- **Remover validade:** 48 × 48 px.
- **Desfazer** (pendente de conferência): 48 px.

O campo "Lucro sobre o custo (%)" continua com 44 px. Ele é um campo, não um botão, e o texto tem 16 px, como a regra pede para campos. Os outros botões de 44 px do cadastro já eram assim antes da M15 (por exemplo, "Não tem código" e "Usar este nome"); ficam para a M20, que trata os alvos de toque do cadastro.

**Provas:**
- O teste `m15-campos-legiveis` foi atualizado para 48 px.
- Tipos e 1.220 testes passaram duas vezes; build aprovado.
- Medido no Chromium (farmácia), em 320, 390 e 1280 px de largura, com letra a 100% e a 200%: Escanear, Remover validade e Desfazer têm 48 px (96 px com letra a 200%); Escanear não cobre o campo; sem rolagem lateral e sem erro.

## 30. M17 — fases da reposição — 16/10/2026 UTC

**Pedido do dono (16/10/2026):** "Pode fazer a M17".

**O que mudou** (só apresentação, `src/components/ReporGondola.tsx`, app da equipe → Repor):
- **Faixa de fases.** Mostra as três fases que já existiam na reposição: **"1. Conte → 2. Busque → 3. Confirme o que levou"**. A fase atual fica em destaque (azul) e a que já passou ganha um ✓ verde.
  - Na ida à prateleira e na contagem, o destaque é "Conte".
  - Na tela do depósito, onde a pessoa busca e informa quanto colocou, o destaque é "Busque" e "Confirme o que levou", porque as duas acontecem na mesma tela.
  - Quando a prateleira está cheia ou não há o que buscar, a faixa não aparece.
  - A faixa só mostra a fase: não muda de tela quando tocada.
  - **Envio do "Coloquei" sem resposta** (a internet caiu depois de levar): "Busque" aparece como feita (✓) e só "Confirme o que levou" fica em destaque, para ninguém buscar a mercadoria de novo (achado do Codex no PR #174).
  - Para o leitor de tela, só uma fase é marcada como atual (`aria-current`), mesmo quando duas aparecem em destaque (achado do Codex no PR #174).
- **Local do depósito** na tela de busca: letra maior (de 14 para 16 px), com quebra de linha para nomes longos.

Não mudam: as fases, a contagem cega (o funcionário não vê o número do sistema), o pedido ao servidor, a confirmação, o rascunho guardado no celular e a retomada depois de fechar o app. Nenhuma fila ou fase nova.

**Provas:**
- Teste novo `src/test/m17-fases-reposicao.test.tsx`:
  - fase certa em cada tela e o envio do "Coloquei" com o mesmo número;
  - envio sem resposta com "Busque" feita e só "Confirme" atual;
  - prateleira cheia sem a faixa.
  - Os dois primeiros casos falham sem a mudança.
- Os testes da reposição continuam passando: `reposicao`, `reposicao-retomada` e `reposicao-vendas-meio`.
- Tipos e 1.224 testes rodados duas vezes; build aprovado.
- Chromium em 320/390/1280 px, com letra 100% e 200%: faixa dentro da tela, sem rolagem lateral e sem erro.

**Observação:** em 320 px com letra 200%, a faixa ocupa várias linhas (344 px), porque cada fase vira um bloco. O resto da tela já era grande nesse tamanho; fica para a M22.

**Pendente:** Publicar → Atualizar e o teste do dono. Roteiro:
1. No celular da equipe, abrir Repor e escolher um produto. Deve aparecer "1. Conte" em destaque.
2. Contar e confirmar. Na tela do depósito devem aparecer "✓ 1. Conte", "2. Busque" e "3. Confirme o que levou".
3. Informar quanto colocou e tocar em "Coloquei".

## 32. M20 — alvos de toque do cadastro — 16/10/2026 UTC

**Pedido do dono (16/10/2026):** "Pode fazer a M20".

**O que mudou** (só apresentação, `src/components/ProductArea.tsx`). Todos os botões do cadastro de produto passam a ter pelo menos **48 px**, a regra do projeto:
- **Editar variação e Remover variação** (grade de tamanhos/cores da roupa): passaram de 32 px para 48 px. O "Remover" ganhou `shrink-0`. Antes, em celular de 320 px, ele chegava a 17–32 px de largura, espremido pelo texto da variação.
- **"Não tem código", "Usar este nome", "Não é este", nomes sugeridos de local e "Apagar e deixar sem código":** passaram de 44 px para 48 px.
- **Opção "Validade desconhecida":** a área de toque passou de 44 px para 48 px.

Os campos já tinham texto de 16 px. O campo "Lucro sobre o custo (%)" continua com 44 px de altura e texto de 16 px, porque é um campo e não um botão.

Não mudam: as ações, os textos, a ordem, as travas, os cálculos e o banco. O `styles.css` não foi alterado.

**Provas:**
- Teste novo `src/test/m20-alvos-cadastro.test.tsx`: editar e remover variação com 48 px e abrindo a mesma janela; nenhum botão do arquivo com menos de 48 px. Os 2 casos falham sem a mudança.
- Tipos e 1.223 testes rodados duas vezes; build aprovado.
- Chromium (roupa com 3 variações, uma com nome de cor longo) em 320, 390 e 1280 px, com letra 100% e 200%: editar com 48 px ou mais; remover com 48 × 48 px (96 × 96 px com letra 200%); sem rolagem lateral; sem erro.

**Achado anterior, fora desta etapa:** com letra 200% em 320 e 390 px, os cartões de variação passam da borda da tela. Isso já acontecia antes; fica para a M22 (largura e quebra).

**Pendente:** Publicar → Atualizar e o teste do dono. Roteiro: editar uma roupa, ir até "Detalhes do produto" e tocar no lápis e no X de uma variação. Os botões devem estar maiores e fazer o mesmo de antes.

## 31. M18 — estados do recebimento — 16/10/2026 UTC

**Pedido do dono (16/10/2026):** "Pode fazer a M18".

**O que mudou** (só apresentação, `src/components/ReceberMercadoria.tsx`, app da equipe → Receber mercadoria). A lista de produtos da entrega era uma lista só; agora fica separada pelos estados que já existiam, cada grupo com o número de produtos:
- **Para contar:** "Conte de novo" e "Falta contar".
- **Pronto para enviar:** contado, mas ainda não enviado. Aviso: "Ainda não foi enviado: use o botão no fim da tela."
- **Já enviado:** conferido, contagem enviada, aguardando decisão do dono ou recusado. Aviso: "O que for aceito só entra no depósito quando a entrega for concluída." Esse aviso substitui a frase solta que aparecia antes, quando havia produto conferido.

Os grupos sem produto não aparecem. A ordem dentro de cada grupo, os textos de cada produto, as cores e o toque em cada produto continuam iguais.

Ao salvar uma contagem, o produto muda de grupo. O foco do teclado volta para ele no grupo novo, em vez de se perder (achado do Codex no PR #175).

**Não mudam:**
- a contagem cega (o funcionário não vê o que foi pedido);
- o aceite e a recontagem, o mesmo id e o mesmo envio;
- os estados parciais e a decisão do dono;
- o rascunho guardado no celular.

Nenhuma conta nova.

**Provas:**
- Teste novo `src/test/m18-estados-recebimento.test.tsx`. Os produtos passam por Para contar, depois Pronto para enviar e depois Já enviado, com os números e os avisos, e a quantidade esperada não aparece. O teste falha sem a mudança.
- Os testes do recebimento continuam passando: `recebimento`, `-rascunho`, `-dois-celulares`, `-motivo` e `-sem-pedido`.
- Tipos e 1.222 testes, duas vezes; build aprovado.
- Chromium em 320, 390 e 1280 px, com letra 100% e 200%: grupos certos antes e depois de enviar, sem rolagem lateral e sem erro.

**Pendente:** Publicar → Atualizar e o teste do dono. Roteiro:
1. No celular da equipe, abrir uma entrega e contar um produto. Ele deve passar para "Pronto para enviar".
2. Tocar em "Enviar contagens". O produto deve ir para "Já enviado", e o que falta continua em "Para contar".
