# OMNI SAFE 360 — FONTE DA VERDADE

Versão 3.1, de 13/10/2026. Acrescenta o plano de segurança e operação em mercados grandes, com várias lojas e vários caixas, ao plano ponta a ponta. Regras e histórico anteriores permanecem válidos.

Este documento é a referência oficial do sistema. Se qualquer instrução, código ou conversa contradisser este documento, vale este documento. A exceção é quando o dono disser o contrário por escrito; nesse caso, o documento é atualizado.

> **Para qualquer IA (Codex, Claude e outras):** este documento é consultado em **toda ação**, não só no começo. A seção 0 é a lista de conferência obrigatória. As seções 1 a 3 são regras. A seção 13 diz em que etapa estamos. O [checklist ponta a ponta](CHECKLIST_PONTA_A_PONTA.md) detalha tarefas e critérios de conclusão. O banco real (Supabase) é a verdade sobre as tabelas, e o `CLAUDE.md` guarda o registro detalhado de cada entrega.

---

## 0. LISTA DE CONFERÊNCIA — EM TODA AÇÃO

### Antes de começar
1. **Ler, nesta ordem:** este documento (principalmente seção 0), histórico recente no `CLAUDE.md`, [checklist ponta a ponta](CHECKLIST_PONTA_A_PONTA.md), [checklist funcional 2](checklist-funcional-2.md) (os 31 defeitos da análise 2, A1–C3) e [checklist original](checklist-funcional-2026-10-11.md) quando relacionado. Consultar a etapa atual (seção 13) antes de cada tarefa. Conferir se o pedido do dono cabe nela e se falta uma decisão necessária dele (seção 14); pedir somente o dado ou autorização que ainda falta.
2. **Conferir se o `main` mudou** (alguém pode ter gravado direto, como o Codex em 09/10). Se mudou, revisar antes de seguir.
3. **Tabela nova ou mudança de desenho?** Só com o desenho aprovado pelo dono (regra 5).
4. **Decidir o lugar certo** na tela, pelo mapa da seção 3.2. Se não houver lugar coerente, propor ao dono antes.

**Validação prévia, pedido do dono em 12/10/2026:** antes de alterar o aplicativo ou o banco, apresentar o código proposto, a lista exata dos arquivos e os impactos para validação do dono. A autorização para auditar/documentar não autoriza aplicar essas correções. Reutilizar o que existe e preservar os fluxos funcionais.

### Durante
5. **Fácil, bonito, organizado e coerente** (seção 3.1). Cada tela tem uma tarefa clara, botões grandes, frases curtas e os nomes certos para o tipo de comércio.
6. **Uma coisa de cada vez.** Uma entrega por pull request.
7. **No banco:** RLS ligada, gravação só por funções seguras e uma `operacoes` em toda mudança de estoque, na mesma transação. Funções sem login só funcionam com chave ou link secreto.

### Antes de publicar
8. `npx tsc --noEmit` sem erros, **duas vezes**.
9. `npx vitest run` passando, **duas vezes**. Há registro histórico de sensibilidade de tempo no scanner; qualquer falha atual deve ser investigada, não ignorada.
10. **Se mudar o banco:** comparar a função real com a do arquivo, salvar a migração em `supabase/migrations` e simular com `begin … rollback`, incluindo recusas: outro dono, sem login, gravação direta. O SQL de simulação não pode conter a palavra "delete".
11. **Reler a mudança** procurando erro, texto confuso, plural errado ou tela que não cabe no celular (320 px).
12. Conferir os **avisos do Supabase** (segurança e velocidade) depois de mudar o banco.

### Depois
13. Mesclar pelo PR no `main`, informar se precisa **Publicar → Atualizar** no Lovable e dizer **o que deve ser testado**. Mudança somente de documentação não exige atualizar o app. Separar correção no código, publicação e teste do dono; não assumir publicação após o merge.
14. Registrar no `CLAUDE.md` e no item do checklist ponta a ponta; atualizar o checklist original quando relacionado. Se mudou etapa, regra ou decisão, **atualizar este documento**. Item só encerra a validação com evidência; teste real adiado permanece pendente.

### De tempos em tempos (auditoria, regra 9)
- Testes, tipos e os avisos do Supabase.
- Procurar telas com "Em breve", "Dados de exemplo" ou textos de outro tipo de comércio.
- Conferir se a seção 12 (o que está pronto) continua verdadeira.

---

## 1. QUEM É O DONO DO PROJETO E COMO TRABALHAR COM ELE

- O dono **não é programador**. Explicar tudo em português simples, sem jargão. Ensinar a testar cada etapa e pedir o resultado: funcionou ou não funcionou.
- O dono quer um sistema **muito fácil de entender e de configurar**. Se o comerciante não entende, desiste.
- O dono quer **fechamento perfeito, sem fluxo errado**. Prefere ir por etapas, com teste ao fim de cada uma.
- **Desde 09/10/2026 o Claude executa direto no GitHub e no Supabase** (decisão do dono), uma coisa de cada vez:
  - o Claude mescla o pull request no `main` depois de verificar;
  - o dono usa o Lovable para o visual e para publicar.
- 09/10/2026: o dono decidiu **ir arrumando e testar mais à frente**. 10/10/2026: confirmou que **o teste geral fica para quando tudo estiver pronto** (inclusive as vendas pelo caixa); o roteiro de teste é entregue no fim. O Claude continua verificando tudo e mantém a lista do que falta o dono testar (seção 12.3).

## 2. REGRAS DE TRABALHO (INEGOCIÁVEIS)

1. **Nunca dar uma etapa por encerrada sem teste.** Cada etapa termina com um roteiro de teste simples. Enquanto o dono não testa, ela fica como "pronta, falta o teste do dono".
2. **Uma tarefa por vez.**
3. O Claude grava direto no GitHub e no Supabase (desde 09/10/2026). **Prompts para o Lovable** quem cola é o dono, um por vez, sempre com a "PROTEÇÃO DO CORE" (o que já funciona e não pode ser alterado).
4. **Mudanças no banco:** o Claude pode aplicá-las direto, **depois de o desenho ser aprovado pelo dono**. Toda tabela nova precisa de aprovação.
5. **Segurança (RLS) ligada em toda tabela**, no momento da criação. Navegador nunca grava direto em estoque, pedido ou equipe: só por funções seguras.
6. **Usar somente o Supabase do projeto** (seção 11). **Nunca usar Lovable Cloud.** Nunca colocar chave secreta ou service role no código; só a chave pública pode estar no front-end.
7. **Git:**
   - não reescrever o histórico publicado (sem force push, rebase ou squash);
   - o `main` sincroniza com o Lovable e precisa estar sempre funcionando.
8. **Toda mudança de estoque grava uma `operacoes` permanente na mesma transação.** Regra da base consolidada, `docs/base-consolidada.md`.
9. **Auditorias periódicas** (seção 0).
10. **Nunca misturar este projeto com o Zuvvi** (app de mototáxi do mesmo dono). Contas, bancos e repositórios são separados.

## 3. OS PRINCÍPIOS DE TODA ENTREGA

### 3.1 Como tudo tem que ser
- **Fácil:**
  - uma pergunta por tela nos cadastros;
  - a resposta mais comum já vem marcada;
  - o sistema lembra a última escolha;
  - nunca pedir o que o sistema pode descobrir sozinho.
- **Bonito:** paleta e padrões da seção 8. Cores com sentido fixo: vermelho = agir agora; amarelo = ficar de olho; verde = tudo certo; azul = ação principal.
- **Organizado:**
  - cada assunto mora num só lugar (mapa abaixo);
  - a mesma regra é usada em todas as telas (ex.: `situacaoProduto` decide a cor do produto na ficha, na lista, nos locais e no "Atenção hoje").
- **Coerente:**
  - os nomes mudam com o tipo de comércio ("Depósito" e "Gôndola" no mercado e no pet shop; "Estoque" e "Área de venda" nos outros);
  - nunca mostrar exemplo de um tipo em outro;
  - quantidade sempre com a unidade no plural certo.
- **Seguro e cego onde precisa:** o funcionário nunca vê a quantidade esperada.
- **Sem beco sem saída:** todo aviso diz o que fazer, e toda tela tem como voltar.

### 3.2 Mapa — onde cada coisa mora

| Lugar | O que fica ali |
|---|---|
| **App do dono — barra de baixo** | **Início** (vendas de hoje, "Faltou este mês" → tela **Antifurto** de todos os comércios, e resumo de todos os comércios) · **Comércios** · **Alertas** (o que precisa de atenção em todos) · **Equipe** (todas as equipes) · **Conta** |
| **Dentro de um comércio — faixa de navegação** (logo abaixo do nome; corre para os lados com o dedo; ao tocar numa parte, ela vai para o meio e as seguintes aparecem; cada parte com ícone e número de aviso) | **Produtos** ("Atenção hoje" + lista) · **Depósito/Estoque** · **Gôndolas/Área de venda** · **Pedidos** (compras, contas a pagar, recebimentos) · **Fornecedores** · **Equipe** · **Vendas** (caixas e vendas; Fase 3) · **Diferenças** ("Para resolver": perdas e diferenças, com o valor em reais; "Relatório": antifurto do comércio; Fases 4.3 e 5.1) |
| **Ficha do produto** | Tudo de um produto: situação, quanto tem, onde fica, validade, preço, fornecedor, etiqueta |
| **App do funcionário — Omni Operação** (`/funcionario`) | Código + PIN; botões grandes **Receber mercadoria**, **Repor gôndola** e **Conferir depósito** (para todos), e o botão **Registrar perda** (Fase 4.2) |
| **Página do fornecedor** (`/pedido/<link>`) | O fornecedor vê e responde um pedido, sem login |
| **Omni Conector** (`/conector`) | Página no computador do caixa que lê a pasta das notas e envia as vendas finalizadas ao Omni |
| **Caixa no celular** (`/caixa`) | Turno, produtos, venda/pagamento, fiado, retirada de dinheiro, cancelamento e fechamento com PIN |

Regra: **coisa nova entra no lugar do mapa.** Se não couber em nenhum, o mapa é discutido com o dono antes.

---

## 4. VISÃO DO PRODUTO

**Omni Safe 360** é um sistema web, instalável como app (PWA), de **controle de estoque, gôndola, vendas e antifurto** para comércios que têm depósito. Cuida da mercadoria do recebimento até a venda e aponta **o que está faltando e onde a conta deixou de fechar**.

- **Meta:** cerca de 90% automático; o manual é basicamente o cadastro de produtos.
- **Multi-comércio:** o dono cadastra vários comércios, cada um independente (produtos, depósito, gôndolas, equipe, caixas). Os fornecedores são do dono e valem para todos os comércios dele.
- **Plataformas:** web, Android, iOS e tablet, com aparência de app nativo.
- **Identidade:** "Omni Safe 360", slogan "Controle inteligente de estoque", frase da entrada "Controle total do seu comércio, em tempo real."

## 5. TIPOS DE COMÉRCIO (SOMENTE ESTES 6)

Mercado · Farmácia · Loja de roupas · Material de construção · Pet shop · Autopeças.

**Fora do escopo:** açougue, padaria e "outro tipo". No mercado não existem as categorias "Açougue" e "Padaria".

**Onde estão as listas:** unidades, categorias, detalhes, opções e tamanhos de cada tipo ficam em `src/lib/listas.ts` e, iguais, no banco (`validar_tipo`). O teste `listas-banco` falha se um lado mudar sem o outro. Os exemplos de cada tipo ficam em `src/lib/exemplos.ts`.

Particularidades por tipo:
- **Farmácia:** tarja, lote, PMC, local pela tarja, validade com avisos de 30/60/90 dias.
- **Loja de roupas:** variações com tamanho, cor e código próprios; não tem passo de validade.
- **Construção e autopeças:** validade sugerida pela categoria.
- **Embalagens por tipo** (caixa, fardo, display, saco, pallet, milheiro…).

## 6. PERFIS E APPS

- **Dono:** acesso a tudo. Quem cria conta recebe o papel de dono. Os papéis ficam em `user_roles` e ninguém se dá o papel de dono.
- **Funcionário — app Omni Operação** (aprovado em 09/10/2026):
  - o dono cadastra nome e função (receber, repor ou ambos) e o sistema gera um código de 6 números e um QR Code;
  - o funcionário cria um PIN de 4 números;
  - o celular fica lembrado, mas **o app pede o PIN toda vez que abre e depois de 5 minutos fora da tela**, e o banco só aceita o celular por 12 horas depois do PIN;
  - 5 erros de PIN travam por 15 minutos;
  - o dono bloqueia ou gera um acesso novo a qualquer momento.
- **Fornecedor:** sem conta; usa o link secreto de cada pedido.
- **Caixa (PDV):** ver 7.6. O operador de caixa usa o sistema de caixa do próprio mercado.
- **Gerente:** existe no banco (`app_role`), mas as funções liberadas ainda não foram decididas (seção 14).

---

## 7. REGRAS DE NEGÓCIO

### 7.1 Cadeia do produto e a conta do antifurto
O produto passa por três pontas, e cada uma é conferida por **contagem cega**:

```
FORNECEDOR ──(receber, cego)──▶ DEPÓSITO ──(repor, cego)──▶ GÔNDOLA ──(venda no caixa)──▶ CLIENTE
```

- **Depósito deveria ter** = tinha + recebido − levado para a gôndola − perdas registradas.
- **Gôndola deveria ter** = tinha + reposto − vendido no caixa − perdas registradas.
- A diferença entre o que **deveria ter** e o que **foi contado** diz **onde** a mercadoria sumiu. Exemplo: entrou 100, foram 60 para a gôndola, vendeu 50 → a prateleira deveria ter 10; contaram 4 → **faltam 6 na gôndola**.
- **A conta só fecha se:**
  - toda entrada passa pelo recebimento;
  - toda reposição passa pelo app;
  - toda venda passa pelo caixa;
  - toda perda é registrada.

  O que fugir disso aparece como diferença. Isso é o sistema mostrando o furo, e o app deve deixar essas regras claras para a equipe.

### 7.2 Contagem cega (receber, repor e conferir)
- O funcionário **nunca vê a quantidade esperada**. Ele conta e informa.
- **Depósito e gôndola, até 3 contagens (decisão do dono em 12/10/2026):** quando bate com o saldo conhecido, conclui. Quando diverge, pede nova contagem em branco. Duas contagens iguais com diferença ou três diferentes ficam **bloqueadas, aguardando o dono**, sem acerto automático e sem liberar reposição. O dono escolhe um número informado ou mantém o esperado; somente essa decisão pode ajustar o saldo. Outra operação, celular ou dia não contorna a pendência. Reenvio da mesma rodada não conta como tentativa nova. Área ainda não contada ganha referência inicial; zero já contado continua sendo referência conhecida. Critério do recebimento permanece no próximo tópico.
- **Receber:**
  - aceita quando a quantidade bate com o pedido ou repete uma tentativa anterior. Três números diferentes, sem nenhum bater, esperam a decisão do dono; sem pedido para comparar, aceita a quantidade informada. A equipe nunca vê a quantidade esperada;
  - enviar contagens parciais não conclui a entrega. Produto conferido aguarda a conclusão do recebimento para entrar no depósito. Toda recontagem pendente precisa ser resolvida, mesmo que não esteja no último envio;
  - "Veio quebrado ou vencido" não entra no estoque;
  - produto fora do pedido fica separado, e o dono decide se fica ou se devolve.
- **Repor:**
  - **primeiro** o funcionário conta a prateleira (cega), **depois** o app diz quanto buscar, até o máximo;
  - o produto que vence primeiro sai antes, mantendo o lote.
  - registrar a contagem sem transferir produto não é reposição concluída. Sem estoque disponível, distinguir entrega em conferência, estoque aguardando liberação/validade, depósito sem estoque e depósito ainda não contado;
- **Conferir o depósito (Fase 4.2):** até 5 produtos por dia, revezando; o funcionário conta fardos/caixas fechados e o que está sem embalagem, e o app soma. Cada nova contagem começa do zero.
- **Mesmo sem caixa ligado**, uma contagem da gôndola diferente do saldo conhecido segue a regra de recontagem e decisão do dono. O bloqueio impede nova contagem/reposição daquele produto/variação na área pendente; não impede recebimentos/vendas legítimos. A decisão conserva movimentos posteriores à fotografia da diferença.

### 7.3 Depósito e gôndola
- Os locais são configuráveis por comércio, com sugestões por tipo.
- Cada produto tem local, mínimo e máximo no depósito e na área de venda.
- **Gôndola no mínimo:** vira reposição no app do funcionário e aviso para o dono.
- **Máximo da gôndola** = limite da prateleira; a reposição não passa dele.
- **Depósito no mínimo:** não repõe; vira **sugestão de compra** com o fornecedor.
- O estoque é sempre guardado em **unidades de venda**. As embalagens só convertem.

### 7.4 Fornecedores, pedido de compra e pagamento
- **Pedido sugerido:** completa até o máximo do depósito, em embalagens fechadas (sem máximo: o dobro do mínimo).
- **Envio:** pelo WhatsApp ou pelo e-mail do celular, com o **link secreto** do pedido. O fornecedor responde se tem cada item, a entrega, o valor e o pagamento.
- **Situações do pedido:** rascunho → enviado → aceito / aceito com ajustes / recusado → recebido (ou recebido em parte).
- **Contas a pagar:** de "a pagar" para "pago", com os avisos "atrasado" e "vence hoje" no "Atenção hoje".
- O estoque **só aumenta no recebimento**.
- E-mail automático e WhatsApp automático (pago) ficam para depois.

### 7.5 Validade
- Pode ser obrigatória (farmácia), sugerida pela categoria ou não existir (roupas).
- Avisos de 30, 60 ou 90 dias.
- Produto vencido na área de venda gera alerta vermelho.

### 7.6 Vendas — Omni Conector e Caixa no celular (desenho aprovado e implementado; validação real pendente)
- O dono pediu que o Omni **se ligue ao sistema de caixa que o mercado já usa**, com vários caixas por loja (5, 6 ou mais), e que **cada venda desconte da gôndola na hora**.
- **Regra do dono (10/10/2026): só desconta quando a venda é FINALIZADA no caixa** (pagamento aprovado e venda fechada). Bipar não desconta nada; venda desistida antes de fechar não desconta; venda cancelada depois devolve.
- Cada marca de caixa é diferente. O caminho implementado do Conector lê XML compatível de NFC-e/SAT com venda finalizada: produto, código, quantidade, hora e caixa. Validar com o PDV real do piloto; não presumir que toda venda ou marca disponibiliza esses arquivos.
- **Caminho principal — Omni Conector:**
  - uma página do Omni instalada como app no computador do caixa;
  - acompanha a pasta das notas e envia cada venda em menos de 1 minuto;
  - a ligação usa um código de **8 números**, que vira a chave daquele caixa, e o dono pode desligar qualquer caixa;
  - um conector no computador central pode servir a todos os caixas.
- **Caixa no celular já implementado** (`/caixa`): turno, venda, pagamento, troco, fiado, retirada de dinheiro, cancelamento, fila local e fechamento com PIN. Falta teste completo no aparelho e no piloto. Vendas também chegam por esse caminho.
- **Futuro, a combinar:** chave para o fornecedor do sistema de caixa enviar diretamente e eventual caixa adicional no computador. Não confundir esses projetos com o Caixa no celular existente.
- **Regras:**
  - cada nota só conta uma vez (número único de 44 dígitos);
  - no Conector, sem internet as vendas externas já finalizadas esperam e vão depois; no Caixa móvel, o carrinho fica guardado e novas vendas só finalizam com confirmação online do banco;
  - nota cancelada devolve para a gôndola;
  - vender o código da embalagem desconta as unidades dela;
  - o código interno do caixa (incluindo balança) é ligado ao produto uma vez;
  - vendas externas sem cadastro vão para "Vendido sem cadastro"; no Caixa móvel, cadastrar/conferir o produto antes de vender;
  - vendas como "Diversos" são contadas por caixa e avisadas;
  - no Conector, falta para uma venda externa já finalizada fica registrada; no Caixa móvel, quantidade acima da área de venda bloqueia a venda inteira e solicita conferência cega, sem baixa ou dinheiro/fiado;
  - cada venda grava uma `operacoes`.
- **Situação de cada caixa:** verde enviando, amarelo parado há 30 minutos com a loja aberta, vermelho desligado.
- **C6, decisão de 12/10/2026:** diferença confirmada na gôndola solicitada pelo caixa pede conferência do depósito. O dono aceita a diferença da gôndola após resolver o depósito; manter o esperado continua permitido. Não há reposição/acerto automático. Reenvios conservam ID; conclusão só após confirmação. Conferências vinculadas em revisão ou com total preservado não viram falta total automática. [Detalhes e teste](caixa-estoque-contagens-2026-10-12.md).
- **Fechamento do dinheiro:** para caixa externo ligado ao Conector, continua no sistema do mercado; no Caixa no celular, o turno e seu fechamento são feitos no Omni. Conferir o caminho usado pelo piloto.

### 7.7 Perdas e diferenças (Fase 4)
- **Registrar perda:**
  - o funcionário marca no app o motivo: quebrou, venceu, consumo da loja ou devolvido ao fornecedor;
  - sai do estoque na hora; o dono confirma na aba **Diferenças** ("Confirmar" ou "Não aconteceu" — recusar vira uma diferença para investigar);
  - o dono também registra perdas ele mesmo (já confirmadas).
- **Aba "Diferenças":** cada diferença com o produto, o lugar, de onde veio (conferência, reposição, perda não confirmada), quem contou, quando e o valor em reais (preço de compra). O dono explica: erro de contagem, quebrou, venceu, usado na loja, sumiu ou outro motivo (este pede uma anotação).
  - Quando as 3 contagens da conferência não bateram, o dono escolhe o número certo (uma das contagens ou "manter o número do sistema"); o estoque é acertado na hora (`resolver_conferencia`).
  - Resumo do mês: "Faltou este mês" (sem o que foi explicado como erro de contagem) e "Perdas este mês".
  - O quadro vermelho **"Perdas e diferenças"** aparece no "Atenção hoje", no menu Alertas e conta em "Para resolver agora" na tela inicial.
- **Antifurto (Fase 5, desenho aprovado em 10/10/2026: "Pode fazer", com as 4 recomendações):**
  - **5.1 Relatório do comércio** (aba Diferenças → "Relatório"): este mês / mês passado / últimos 3 meses; total que faltou (falta = diferença negativa, sem as explicadas como erro de contagem e sem contagem para escolher), por motivo, perdas registradas e erros de contagem à parte; **produtos que mais somem** (tocar mostra cada falta com o intervalo "entre a contagem de … e a de …"); **lugares com mais faltas**; **dia da semana** em que a falta foi descoberta; **equipe** ("contou X faltas", "registrou Y perdas" — quem conta não é culpado). O sistema sabe quando a falta foi descoberta, não a hora exata: o intervalo vai da contagem anterior do mesmo produto no mesmo lugar até a que achou a falta.
  - **5.2 Alertas** (quadros amarelos no "Atenção hoje" e no menu Alertas; contam em "de olho" na tela inicial; tocar abre o Relatório): **produto visado** (3 faltas ou mais em 30 dias, com a última nos últimos 7 dias), **lugar com muitas faltas** (3 produtos diferentes ou mais faltando no mesmo lugar em 30 dias) e **faltou no mês** acima do limite do comércio (padrão R$ 200; o dono muda no Relatório; R$ 0 desliga). O produto visado entra **primeiro na conferência do depósito, todo dia**, além dos 5 do revezamento, até passar 7 dias sem faltar — o funcionário não sabe que é visado;
  - **5.3 Antifurto de todos os comércios:** quadro **"Faltou este mês"** na tela inicial (soma de todos, com o nº de alertas); tocar abre a tela **Antifurto**: total, cada comércio com falta (o pior primeiro) com o valor, "passou do limite", produtos visados, lugares com muitas faltas e "Mais sumiu"; "Sem faltas este mês"; tocar num comércio abre o Relatório dele.

### 7.8 Cadastro de produto
- **Até 8 passos,** com uma pergunta por tela:
  1. código e nome;
  2. preços e unidade;
  3. detalhes do tipo;
  4. fornecedor e embalagens;
  5. depósito;
  6. área de venda;
  7. validade (não aparece em roupas);
  8. conferir e salvar.
- **Preço:** "Quero ganhar %" em cima da compra. Vender com prejuízo pede confirmação.
- **Produto sem código:** o sistema gera o código interno "29…".
- **Scanner:** EAN-13, EAN-8, UPC, Code 128 e QR, pela câmera, ou digitar.
- **Etiquetas:** A4 com 21 etiquetas ou térmica.

---

## 8. DESIGN E EXPERIÊNCIA

- **Paleta (usar exatamente):** fundo `#0B1B3A` com degradê até `#071326` · azul `#2F8CFF` · verde-água `#2DE2C4` · texto `#FFFFFF` · texto secundário `#8FA3C2` · bordas/cartões `#1E3358` · erro `#FF5C6C`. Fonte **Inter**. Cantos de 16 a 24 px.
- **Logo:** escudo claro com código de barras e feixe de scanner verde-água, anel de 360° em degradê e "OMNI SAFE 360" em uma linha.
- **Padrões de tela:**
  - **Cadastros:** fluxos em etapas, sem rolagem vertical (inclusive 320×568); "Passo X de N" com barra em degradê; botões Voltar e Continuar (Continuar só ativa com a etapa válida).
  - **Teclado aberto:** nunca cobre campos nem botões.
  - **Celular:** barra de navegação embaixo. **Computador e tablet (≥ 768 px):** menu lateral e conteúdo centralizado.
  - **Botões e campos:** botões de pelo menos 48 px e campos com fonte de pelo menos 16 px.
  - **iPhone:** respeitar as áreas seguras.
  - **Textos:** linguagem simples, ajudas curtas e erros claros em português.
- **Apps instaláveis:** "Omni Safe 360" (dono), "Omni Operação" (`/funcionario`) e Caixa (`/caixa`), com manifestos próprios. Instalação, retomada e funcionamento offline aplicável precisam de prova nos aparelhos (E6 do checklist).

## 9. ONDE ESTÁ O CÓDIGO

- **Front-end:** React 19 + TanStack Start/Router + Vite + Tailwind 4 + TypeScript + vitest. Leitor de código `@zxing/browser`; QR `qrcode-generator`.
- **Rotas:**
  - `src/routes/index.tsx` — entrada e app do dono;
  - `src/routes/funcionario.tsx` — Omni Operação;
  - `src/routes/caixa.tsx` — Caixa no celular;
  - `src/routes/conector.tsx` — Omni Conector;
  - `src/routes/pedido/$token.tsx` — página do fornecedor.
- **Telas** (`src/components/`):
  - `OwnerHome` (barra de baixo), `StoreSpace` (abas do comércio), `ProductArea` (cadastro);
  - `FichaProduto`, `ListaProdutos`, `AtencaoHoje`, `PainelLocais`, `PainelPedidos`, `PainelFornecedores`, `PainelEquipe`;
  - `AppFuncionario`, `ReceberMercadoria`, `ReporGondola`, `PaginaFornecedor`, `Etiqueta`, `Scanner`, `QrCode`.
- **Regras** (`src/lib/`):
  - banco: `banco.ts` (todas as chamadas ao banco), `persistencia.ts` (envios e recuperação);
  - situação e estoque: `situacao.ts` (cor e avisos de cada produto), `deposito.ts`, `validade.ts`, `embalagem.ts`;
  - preço e etiqueta: `preco.ts`, `codigoBarras.ts`, `etiqueta.ts`;
  - pedidos: `pedido.ts`, `pagamento.ts`;
  - funcionário: `funcionario.ts`, `recebimento.ts`, `instalar.ts`;
  - listas e textos por tipo: `listas.ts`, `exemplos.ts`, `farmacia.ts`, `ultimaEscolha.ts`.
- **Banco:** migrações em `supabase/migrations/` (uma por entrega, com o mesmo número aplicado no Supabase).
- **Registro detalhado de cada entrega:** `CLAUDE.md`.

## 10. BANCO DE DADOS (SUPABASE)

Projeto **`omnisafe-360-oficial`** (ref `bvwjprxfthhreuhovgbk`), São Paulo, Postgres 17. **RLS obrigatória em todas as tabelas.** O mapa abaixo inclui os módulos atuais; contagem e configuração reais devem ser conferidas no banco quando a tarefa exigir, sem tratar um número histórico de tabelas como inventário atualizado.

| Grupo | Tabelas | Quem grava |
|---|---|---|
| Contas | `profiles`, `user_roles` | gatilho na criação da conta; ninguém se dá papel |
| Comércio | `comercios`, `fornecedores` | o dono, pelas regras de RLS (sem apagar; usa `ativo`) |
| Produtos | `produtos`, `produto_variacoes`, `codigos_barras` (lista única por comércio), `produto_embalagens` | só `salvar_cadastro`/`salvar_produto` |
| Estoque | `locais`, `produto_areas` (local/mín./máx.), `contagens` (contagem inicial), `lotes`, `saldos` (quantidade atual), `movimentos`, `operacoes` (registro permanente) | só funções; cada mudança grava uma `operacoes` |
| Compras | `pedidos_compra`, `pedido_itens` | `salvar_pedido`, `marcar_pedido_enviado`, `cancelar_pedido`, `responder_pedido` (link), `atualizar_pagamento` |
| Equipe | `funcionarios` (PIN embaralhado, ilegível até para o dono), `funcionario_aparelhos` (só o resumo da chave do celular) | só funções |
| Operação | `recebimentos`, `recebimento_itens`, `reposicoes` | só funções do app do funcionário (com a chave do celular e o PIN em dia) |
| Vendas | `caixas`, `vendas`, `venda_itens`, `codigos_pdv` | só funções do computador do caixa (com a chave do caixa) e do dono |
| Caixa no celular e fiado | `caixa_turnos`, `caixa_sangrias`, `clientes_fiado`, `fiado_movimentos`, `dono_pin` | funções do caixa/equipe e dono; PIN e chaves conforme acesso |
| Catálogo de produtos | `catalogo_produtos` (código de barras → nome, marca, tamanho, foto; fonte Open Food Facts, licença ODbL: dar o crédito e manter aberta) | ninguém lê direto; o dono logado consulta um código por vez (`buscar_catalogo`); a importação (`_catalogo_importar`, extensão `http` no esquema fechado `importador`) é só interna |
| Fechar a conta | `perdas`, `conferencias`, `diferencas` | só funções do app do funcionário e do dono |

- **Velocidade (10/10/2026):** toda ligação entre tabelas tem atalho de busca (índice) e as regras de RLS usam `(select auth.uid())`, calculado uma vez por consulta. Tabela ou regra nova segue o mesmo padrão. O aviso "índice não usado" do Supabase é esperado enquanto há poucos dados.
- **Funções sem login, de propósito** (o aviso do Supabase sobre elas é esperado): a página do fornecedor (`pedido_publico`, `responder_pedido`, que exigem o link secreto) e o app do funcionário (exigem o código e o PIN, ou a chave do celular).
- **Autenticação:**
  - Google e e-mail/senha;
  - a interface de recuperação de senha existe; houve falha por limite de envio. Serviço de e-mail próprio e teste real de confirmação/recuperação continuam na preparação do lançamento; configuração atual ainda precisa ser conferida;
  - a "proteção contra senhas vazadas" foi relatada como **desligada** na revisão de 11/10/2026 às 07h57 UTC: o dono confere/liga no painel do Supabase (E5).
- **Vendas (Fase 3, desde 10/10/2026):** `caixas` (código de 8 números para ligar, chave do computador do caixa guardada só como resumo), `vendas` (uma por nota, chave de 44 números única), `venda_itens` (cada item com quanto saiu da gôndola, quanto "faltou" e de quais saldos saiu) e `codigos_pdv` (código do caixa ligado a um produto, ou "não controlar"). O computador do caixa usa `conector_ligar`, `conector_estado`, `conector_enviar_venda` e `conector_cancelar_venda`; o dono, `criar_caixa`, `renomear_caixa`, `novo_codigo_caixa`, `desligar_caixa` e `resolver_item_venda`.
- **Fechar a conta (Fase 4, desde 10/10/2026):** `perdas` (sai do estoque na hora; o dono confirma ou recusa), `conferencias` (contagem cega do depósito e da gôndola, até 3 vezes) e `diferencas` (o que o sistema tinha × o que foi contado, com o valor em reais; o dono explica o motivo). Funcionário: `funcionario_registrar_perda`, `funcionario_conferencia_lista`, `funcionario_conferencia_contar`; dono: `registrar_perda`, `decidir_perda`, `explicar_diferenca`, `resolver_conferencia` (escolher a contagem certa), `definir_limite_faltas` (coluna `comercios.limite_faltas_mes`). Antifurto: `_produtos_visados` (usada pela lista da conferência). A contagem da reposição também registra pendência na gôndola sem caixa ligado quando diverge do saldo conhecido (regra 7.2, decisão de 12/10/2026).

## 11. INFRAESTRUTURA

- **Supabase:** `omnisafe-360-oficial`. O projeto antigo `omnisafe-360` **não deve ser usado**.
- **Publicação:** `https://mock-overlay-magic.lovable.app`. Para aparecer: **Publicar → Atualizar** no Lovable.
- **GitHub:** `OmniSafe-360/mock-overlay-magic`, **público por decisão do dono** (08/10/2026). `main` é a versão oficial; cada tarefa usa branch próprio e PR mesclado sem reescrever histórico.
- **Google Cloud:** projeto próprio do Omni (OAuth "Aplicativo da Web"); último registro informa modo de teste. Conferir estado e redirecionamentos antes de abertura pública (E5).
- **Acessos de cada ambiente:** verificar a disponibilidade na tarefa atual. Ter acesso ao GitHub não comprova acesso administrativo ao Supabase ou ao app publicado; não declarar teste que não foi executado.

---

## 12. ESTADO ATUAL (11/10/2026)

Revisão ponta a ponta sobre o `main` no commit `a8f05ad` (PR #98): **itens 1–25 do checklist original corrigidos**. Restam 26–28 (dados autorizados pelo dono) e 29–30 (aparelhos reais). Não voltar ao item 12 por causa de registro antigo no histórico.

O [checklist ponta a ponta](CHECKLIST_PONTA_A_PONTA.md) registra limitações adicionais e critérios de validação conjunta. Nesta revisão, tipos e **828 testes em 73 arquivos passaram duas vezes**; o build também passou. Isso comprova o código testado, não todas as funções/dados atuais do banco ou os fluxos no app publicado. Publicação e aceite geral do dono **não confirmados nesta revisão**.

### 12.1 Pronto e testado pelo dono
- Entrada, criar conta, cadastro do comércio e comércios no banco (Etapa B1).
- Cadastro de produto, testado no mercado e na farmácia, com as correções desses testes.
- Primeiro acesso do funcionário (código, QR e PIN), que levou à correção do PIN ao abrir.

### 12.2 Pronto, falta o teste do dono

13/10/2026: **G0.1 — atualização mínima de dependências aprovada pelo dono:** `shell-quote`, as duas linhas de `brace-expansion`, `js-yaml`, `nanoid` e `source-map-js` atualizados somente no `bun.lock`. A consulta dos 554 nomes do lock retornou zero avisos conhecidos; tipos/1.019 testes em 98 arquivos duas vezes, build e verificações locais de abertura/arquivos offline aprovados. `package.json`, configuração e código de negócio preservados; sem banco/dados alterados. **Pronto no código, falta Publicar → Atualizar e teste do dono.** [Registro e roteiro](dependencias-seguranca-2026-10-13.md). G0.2/G0.3 e demais etapas continuam pendentes.

12/10/2026: **C6 / E3–E4 — caixa respeita saldo da área de venda e solicita contagens**, pedido do dono após `72034.png`. Validação no carrinho e na transação final, embalagens/variações somadas, confirmação antes de concluir, solicitações cegas deduplicadas e depósito solicitado após diferença confirmada. Dono resolve os dois locais; total preservado não vira falta automática. Offline mantém carrinho, novas vendas exigem conexão; sem cadastro exige cadastrar/conferir; filas antigas recusadas permanecem para conciliação. Sem tabelas/funções SQL novas e sem alterar saldo real. Conector preservado. **Pronto, falta Publicar → Atualizar e teste do dono.** [Registro, migração e roteiro](caixa-estoque-contagens-2026-10-12.md). E3/E4 permanecem abertas.



12/10/2026: **C6 — clareza e visual do aviso do caixa**, pedido após `72039.png`: aviso único em cartão na área de rolagem, quantidade confirmada/unidade quando disponíveis, próximo passo e carrinho mantido; cabeçalho/pagamento com espaço próprio. Fechar aviso não libera excesso. Sem SQL ou mudança de regra. Tipos/1.019 testes duas vezes, build e navegador de produção 320×568/390×844/1280×900 aprovados com API simulada. O relato/print do dono valida o bloqueio da quantidade extra na interface; demais aceites continuam pendentes. **Precisa Publicar → Atualizar e conferir o novo aviso no aparelho.** [Registro e roteiro](caixa-estoque-contagens-2026-10-12.md). [PR #112](https://github.com/OmniSafe-360/mock-overlay-magic/pull/112).

12/10/2026: **E3 / C5 — contagem cega exige decisão do dono**, autorizada após o caso do Nescau: depósito/gôndola recontam em branco, duas iguais divergentes ou três diferentes aguardam o dono, mesmo sem caixa ligado. Bloqueio no banco por produto/variação/área; outro ID/aparelho/dia não contorna. Decisão e transferência não duplicam; movimentos posteriores preservados. Migração `20261012003349` simulada com rollback e aplicada; seis funções iguais ao arquivo, RLS/permissões/auxiliares preservados e dados reais iguais imediatamente antes/depois. Nescau permanece 1.000 no depósito e 1 na gôndola. Tipos/990 testes duas vezes, 41 asserções SQL, seis disputas reais e Chromium de produção 320/1280 px com API simulada aprovados. Avisos automáticos: HTTP 403 por falta de `advisors_read`; metadados conferidos diretamente. **Precisa Publicar → Atualizar; falta o teste do dono.** [Registro e roteiro](contagem-cega-decisao-dono-2026-10-12.md). [PR #110](https://github.com/OmniSafe-360/mock-overlay-magic/pull/110), correção `aa6728c`. Regra 7.2 atualizada; E3 continua aberta e próxima verificação independente E2.1 preservada.

11/10/2026: **E2.1 / C4 — saída do primeiro cadastro**, pedida pelo dono no print `71820.png`: botão Sair da conta nas quatro etapas, saída local e entrada disponível para outro e-mail; Google pede escolha de conta. Salvamento/saída protegidos, erro com sessão ainda aberta mantém campos e permite repetir; sessão local já encerrada não reabre por erro do servidor. Oito testes novos; tipos e 979 testes em 92 arquivos duas vezes, build e Chromium de produção 320/390/1280 px com serviços simulados aprovados. Sem SQL/dados reais alterados. **Precisa Publicar → Atualizar; falta o teste do dono com Google real.** [Registro e roteiro](cadastro-saida-2026-10-11.md). A1–C3 da análise 2 chegaram corrigidos por outro acesso no `main` `0492fdd`, incluindo B13; não reaplicar. E2.1 permanece aberta para conferência dessa implementação, retomada e retornos, além das validações reais.

11/10/2026: **E2.1 — salvamento e confirmação do cadastro de comércio**: cinco falhas reproduzidas antes. Bloqueio de navegação/envio repetido enquanto salva, conferência da sessão do dono, ID confirmado obrigatório e mensagem “Cadastro salvo na sua conta.”. Dados enviados/mostrados concordam; erro mantém campos e libera controles; respostas de tela desmontada ignoradas. **13 testes novos; tipos e 937 testes em 79 arquivos duas vezes**, build e oito roteiros no Chromium de produção 320/1280 px com serviços simulados aprovados. Sem SQL/dados reais alterados. **Precisa Publicar → Atualizar; falta o teste do dono.** [Registro e roteiro](comercio-salvamento-2026-10-11.md). E2.1 permanece aberta: próxima tarefa é verificar perda de resposta e retomada do cadastro; duas abas e editor de comércio já salvo também pendentes. Editor novo requer desenho autorizado.

11/10/2026: **E2.1 — isolamento da conta ao entrar/sair/trocar usuário**: cinco falhas reproduzidas no main anterior. Respostas e agendamentos antigos ignorados; perfil/lista confirmados juntos, comércios filtrados por dono e erro de leitura com Tentar de novo. Entrada repetida/renovação preserva a tela. **20 testes novos; tipos e 924 testes em 78 arquivos duas vezes**, build e oito roteiros no Chromium de produção 320/1280 px com Auth/Supabase simulados aprovados. Sem SQL/dados reais alterados. **Precisa Publicar → Atualizar; falta o teste do dono.** [Registro e roteiro](conta-isolamento-2026-10-11.md). E2.1 permanece aberta; o salvamento do cadastro tem entrega parcial própria acima. Serviços e aparelhos reais continuam pendentes.

11/10/2026: **E1/R05 — Caixa reabre sem internet no cenário verificado**: falha reproduzida no Chromium com build de produção, PIN/turno guardados e navegador encerrado. Worker passa a guardar tela pública limpa e arquivos completos da mesma versão, incluindo imports tardios, em caches separados para Caixa/Operação; APIs, páginas privadas e HTML de convites fora do cache. Atualização espera fechar, preserva fila/PIN e recusa arquivos incompletos. **25 testes novos; tipos e 904 testes em 77 arquivos duas vezes**, build e Chromium 320/1280 px com Supabase simulado aprovados: reabertura offline/PIN, venda conservada após outro encerramento, um envio confirmado/zero novas aberturas de turno, troca de versão e falha de atualização. Sem SQL/dados reais alterados. **Precisa Publicar → Atualizar; falta o teste do dono em aparelho real**, junto de E6/item 29. [Registro e roteiro](caixa-reabertura-offline-2026-10-11.md). E1 continua sem aceite geral; próxima tarefa independente: E2.1, conta e comércio.

11/10/2026: **E1/R04 — falha ao guardar contagem de recebimento visível**: armazenamento cheio/inacessível informa que as últimas alterações podem se perder, também na ficha; Tentar guardar de novo grava os números atuais somente no aparelho. Leitura validada distingue ausência de rascunho ilegível/inacessível, preservando os dados e a fila; tela que não recuperou a contagem não substitui dados não lidos. Reenvio sem resposta mantém recebimento, rodada e itens originais; separação por acesso/pedido/fornecedor e “Não sei” dos itens 9–10 preservada. Três falhas reproduzidas antes, 20 testes novos; **tipos e 879 testes em 76 arquivos duas vezes**, Chromium 320/1280 px com Supabase simulado aprovados. Sem SQL/dados reais alterados. **Precisa Publicar → Atualizar; falta o teste do dono no app publicado.** [Registro e roteiro](recebimento-rascunho-2026-10-11.md). Entrega de R04 preservada; próxima tarefa independente atual: E2.1. Teste físico de R05 continua pendente.

11/10/2026: **E1/R03 — consulta do fiado com aviso de falha**: primeira leitura com erro não inventa saldo zero; dados anteriores ficam identificados na lista e conta aberta, com Tentar de novo. Resposta atrasada não substitui a recente; mudar comércio descarta o estado anterior. Pagamento confirmado continua confirmado se a leitura posterior falhar; nova tentativa consulta, sem repetir pagamento. **Tipos e 859 testes em 75 arquivos duas vezes**, build e Chromium 320/1280 px com serviços simulados aprovados. Sem alteração no banco. **Precisa Publicar → Atualizar; falta o teste do dono no app publicado.** [Registro e roteiro](fiado-consulta-2026-10-11.md). Entrega de R03 preservada; próxima tarefa independente atual: E2.1.

11/10/2026: **E1/R02 — pedido protegido durante conferência**: falha reproduzida no banco local; cancelamento, reenvio, renovação de link e resposta do fornecedor recusados após bloquear o pedido na transação. Link informa contagem; reenvio só confirma após sucesso. Migração `20261011144500` simulada com rollback e aplicada no Supabase oficial; cinco funções iguais ao arquivo, três funções da equipe intactas, RLS/políticas/permissões preservadas. **851 testes/tipos duas vezes**, build, SQL local, 13 disputas reais entre conexões e Chromium 320/1280 px aprovados. Avisos automáticos não consultados: API HTTP 403 por falta de `advisors_read`; verificação de metadados feita diretamente. **Precisa Publicar → Atualizar; falta o teste do dono no app publicado.** [Registro e roteiro](pedido-conferencia-banco-2026-10-11.md). Entrega de R02 preservada; próxima tarefa independente atual: E2.1.

11/10/2026: **E1/R01 — retomada da reposição após fechar o app**: produto, etapa, números e ID guardados no mesmo aparelho/acesso; envio sem resposta recupera os mesmos dados antes de qualquer novo envio, sem repetir a transferência. Cliques repetidos, aba antiga, resposta atrasada e falhas de armazenamento verificados. Tipos e **846 testes em 74 arquivos passaram duas vezes**, build e testes operacionais locais aprovados; Chromium em 320/1280 px com serviços simulados. Nenhuma alteração no banco. **Precisa Publicar → Atualizar no Lovable; falta o teste do dono no app publicado.** Ver [registro e roteiro](reposicao-retomada-2026-10-11.md). Entrega de R01 preservada; próxima tarefa independente atual: E2.1.

11/10/2026: **itens 12–25 também mesclados no GitHub** por outro acesso, conforme checklist/histórico: fechamento antigo, atualização do fiado, avulso sem código, navegação, PIN, tela inicial da equipe, variações removidas, mensagens de roupa/caixa, total de compra, CEP, e-mail repetido e recusas claras. Não reaplicar suas correções. Os roteiros E2–E6 cobrem a validação conjunta; `[x]` na lista antiga não significa aceite geral no app.

11/10/2026: **checklist item 11 — conferência da entrega visível no pedido**: a leitura inclui recebimentos em contagem; o dono vê quem está conferindo, sem controles de reenvio/cancelamento. Decisões e alertas do dono aguardam a conclusão. Atualização pelos caminhos existentes, sem migração; **falta o teste do dono no app publicado**. Ver [registro e roteiro](pedidos-conferencia-2026-10-11.md).

11/10/2026: **checklist item 10 — recebimento sem pedido**: rascunhos separados por acesso e fornecedor, incluindo "Não sei"; escolha de continuar ou descartar contagens ainda não enviadas. Envios sem resposta exigem confirmação e não podem ser descartados. Rascunhos antigos preservados para retomada no fornecedor correto. Sem migração; **falta o teste do dono no app publicado**. Ver [registro e roteiro](recebimento-sem-pedido-2026-10-11.md).

11/10/2026: **checklist item 9 — variação de roupa removida depois do pedido**: correção testada e aplicada no Supabase oficial, migração `20261011120000` registrada e três funções conferidas. A equipe conclui a entrega deixando a variação removida para o dono; aceitar restaura antes de registrar peças boas, devolver não entra no estoque. RLS/permissões preservadas. Avisos do Supabase conferidos por outro acesso em 11/10/2026 às 07h57 UTC, conforme relato do dono, sem aviso novo causado pela correção. Item 9 marcado como feito por orientação do dono; **falta o teste do dono no app publicado**. Ver [registro e roteiro](recebimento-variacao-removida-2026-10-11.md).

11/10/2026: **organização da tela de Pedidos**, com entrega e pagamento separados, orientação sobre o que fazer e pendências de recebimento antes dos produtos. Fluxo e regras preservados; nenhuma alteração no banco. Ver [registro e roteiro](pedidos-organizacao-2026-10-11.md).

10/10/2026: correção da **coerência do recebimento e da reposição**, autorizada após os prints do Kapo: envio parcial, conferência e conclusão aparecem separados; avisos atuais; sem falso sucesso quando não há transferência. A proteção de todas as recontagens pendentes e os motivos detalhados de indisponibilidade estão na migração `20261010183000_coerencia_recebimento.sql`, **preparada e testada; em 11/10/2026 o Claude conferiu que as 4 funções no banco já estão idênticas ao arquivo (aplicada antes, sem registro) e registrou a versão `20261010183000` no histórico do banco, junto com `20261010161000` (caixa no celular)**. Critério de aceite existente preservado. Ver [registro e roteiro](coerencia-recebimento-2026-10-10.md).
- Ver o estoque: ficha, lista, Depósito, Gôndolas e "Atenção hoje".
- Fornecedores (aba), pedido de compra, link do fornecedor e contas a pagar.
- Equipe (QR, bloquear, novo acesso) e app Omni Operação: instalar, PIN ao abrir, receber mercadoria, repor gôndola, conferir depósito e registrar perda (10/10/2026).
- Aba **Diferenças** do comércio: confirmar perdas, explicar diferenças, escolher a contagem certa e registrar perda pelo dono (10/10/2026).
- **Relatório antifurto** do comércio (aba Diferenças → Relatório), com alertas, produto visado conferido todo dia e limite do mês; quadro "Faltou este mês" e tela Antifurto de todos os comércios (10/10/2026).
- Tela inicial com números reais ("Resumo de hoje" e situação de cada comércio), menus **Comércios** e **Alertas** (10/10/2026).
- Aba **Vendas** do comércio: caixas, vendas, fechamento e fiado. Vendas chegam pelo Omni Conector ou pelo Caixa no celular; ambos existem, com validação real ainda pendente.

### 12.3 Ainda não existe ou está incompleto
- **Caixa e contagens C6/E3–E4:** correção entregue; publicação, teste físico nos aparelhos e conciliação de eventual fila antiga recebida/recusada continuam pendentes. [Roteiro](caixa-estoque-contagens-2026-10-12.md).

- **Contagem cega (C5/E3):** banco corrigido; falta publicar a interface e validar recontagem/bloqueio/decisão do dono. A unidade antiga do Nescau continua pendente de conferência física e decisão, sem acerto automático nesta entrega. [Roteiro](contagem-cega-decisao-dono-2026-10-12.md).
- **Conta e comércio (E2.1):** isolamento durante o carregamento corrigido; publicação/teste do dono e demais cenários da etapa ainda pendentes. Próxima verificação: conferir B13 já corrigido no main atual, retomada e retornos das telas. Não considerar entrada/e-mail/Google reais novamente validados pela simulação.
- **Confiabilidade (E1):** R01–R05 corrigidos no código; publicação e teste do dono pendentes na seção 12.2. R05 ainda exige validar a reabertura do Caixa sem internet em aparelhos reais; E1 não está validada por completo.
- **A validar em aparelho real:** R05, incluindo instalação pelo ícone, encerramento completo offline e atualização com venda pendente. A falha local de carregamento dos arquivos foi reproduzida/corrigida; o teste automatizado não substitui Android/iPhone.
- **Validação completa:** jornadas do dono, operação, estoque, dinheiro/fiado, alertas e antifurto em conjunto; Android/iPhone/tablet/computador; piloto com conciliação física (E2–E4, E6 e E8).
- **Lançamento:** e-mail próprio e teste real de recuperação, Google, proteção de senhas, Termos/Privacidade e procedimento de backup/recuperação (E5). Parte depende do dono/painéis/serviços; não foi reconsultada nesta revisão.
- **Dados:** código físico do Arroz, situação da Dipirona, comércios de teste e recebimentos avulsos antigos (26–28/E7). Confirmar situação atual e autorização específica antes de alterar.

---

## 13. ROTEIRO — O PLANO

**Prioridade atual, definida pelo dono em 13/10/2026:** preparar operação em **várias lojas e vários caixas**, pelas etapas **G0–G8** no [mesmo checklist](CHECKLIST_PONTA_A_PONTA.md#plano-para-mercados-grandes-g0-a-g8). A [auditoria de 13/10/2026](auditoria-mercados-seguranca-2026-10-13.md) registra evidências e limites; é um relatório de apoio, não outra fonte de regras. **G0.1 — dependências corrigidas no código após validação explícita do dono em 13/10/2026**, com seis resoluções pontuais no lockfile, tipos/testes duas vezes, build e consulta de avisos aprovados. **Pronto, falta Publicar → Atualizar e teste do dono.** [Registro e roteiro](dependencias-seguranca-2026-10-13.md). **G0.2: inventário concluído e revogação informada pelo dono em 13/10/2026**, sem testar a chave antiga por API ou divulgar valor. Configuração `SUPABASE_ACCESS_TOKEN` continua sem acesso ativo. **Pendência de encerramento: confirmar uso exclusivo de manutenção e app normal, ou substituir/validar outros consumidores se existirem. G0.3 — checks aprovados/aplicados no PR #117, CI remoto aprovado; proteção obrigatória e acesso Lovable ainda pendentes. G1.1: auditoria local com 317 casos aprovada; comparação administrativa do banco real pendente. Próxima análise independente: G1.2, proteção da entrada/revogação e regra de loja inativa.** Não pedir nova revogação do mesmo token nem presumir novo token necessário para tarefas de GitHub/documentação. [Procedimento e limites](credenciais-seguranca-2026-10-13.md). G0.3 (proteção de publicação/fornecimento) também permanece aberta; G0 não está encerrada. E1–E8 e os aceites pendentes continuam válidos; E2.1/B13 é retomada em G4, sem reaplicar itens entregues.

“Operacional” exige conciliar estoque/dinheiro e aprovar fluxos, carga, recuperação e segurança no cenário registrado. Não existe promessa de proteção de 100% contra ataques. C5/C6 já entregues são preservadas: o novo fluxo de **Conferir gôndola/área de venda**, independente de **Repor**, e sua investigação ficam em G3, sem implementação aprovada. Ajustes de contagem exigem decisão explícita do dono; contagens iniciais e perdas têm comportamento anterior diferente e precisam de proposta/validação específica antes de mudar. Vendas, recebimentos e transferências legítimas não serão silenciosamente transformados em ajustes ou bloqueados pela documentação.


**Plano anterior, preservado e abrangido pelas etapas G, pedido do dono em 11/10/2026:** [CHECKLIST_PONTA_A_PONTA.md](CHECKLIST_PONTA_A_PONTA.md). **Análise 2 (11/10/2026, tarde):** 31 defeitos confirmados em fluxos existentes, listados em [checklist-funcional-2.md](checklist-funcional-2.md) (A1–A12 graves, B1–B16 números/telas, C1–C3 menores; A12 já resolvido por R01, B13 dentro de E2.1). **A1–C3 estão marcados corrigidos por outro acesso no main atual; falta validação conjunta.** C4 (saída do primeiro cadastro), C5 (contagem cega com decisão do dono) e C6 (bloqueio do caixa e conferências vinculadas) acrescentados por pedido do dono, com entregas próprias na seção 12.2. **Verificação independente anterior, agora em G4.1: continuar E2.1 — conferir B13 já corrigido, retomada e retornos das telas.** Isolamento da conta e salvamento/confirmação do cadastro corrigidos no código; falta publicação/teste do dono. Editor de comércio já salvo não foi encontrado; requer desenho autorizado antes de função nova. E2.1 permanece aberta.  R01–R05 corrigidos no código, R02 aplicada no banco; falta publicação/teste do dono (seção 12.2). **E1 permanece sem aceite geral:** R05 foi corrigida após reprodução local, mas exige teste no app instalado em aparelhos reais, junto de E6/item antigo 29. O dono autorizou adiar o teste geral; avançar em E2 não encerra os itens pendentes. Depois seguem E2 dono/compras, E3 estoque/operação, E4 caixa/fiado, E5 lançamento/acesso, E6 aparelhos, E7 dados autorizados e E8 piloto. Consultar a indicação atual antes de cada tarefa, executar um item por PR e registrar resultado/limites. R02 verificou a concorrência e comparou as funções reais antes/depois do SQL; consulta automática de avisos continua pendente por falta de leitura no token disponível.

As fases abaixo são o histórico de construção do produto. “Feita” indica implementação, com testes do dono ainda pendentes onde registrado; **não substitui o checklist ativo nem declara validação geral concluída**.

10/10/2026: o dono pediu **nome e foto editáveis na Conta**. Implementação usa o perfil existente e atualiza a saudação, com confirmação do banco; nenhuma tabela ou regra de estoque nova. Registro e roteiro em [perfil-2026-10-10.md](perfil-2026-10-10.md). Falta o teste com a conta do dono no app publicado.

10/10/2026: o dono autorizou a primeira melhoria dos **códigos do Mercado**: ITF-14 e equivalência UPC-A/EAN-13, preservando os códigos salvos. O código e os testes estão no [registro da entrega](codigos-mercado-2026-10-10.md). A migração (versão `20261010150302`) foi **aplicada em produção em 10/10/2026**, junto com a consolidação da reposição (`20261010150241`, reposição só com estoque dentro da validade). Balança e catálogo permanecem para outra entrega; a Fase 6 continua pendente.

Cada fase termina com o roteiro de teste para o dono.

| Fase | O que é | Situação |
|---|---|---|
| **1. Base** | Contas, comércios, cadastro, estoque, pedidos, equipe, receber, repor | ✅ feita (parte falta testar, 12.2) |
| **2. Arrumação** | 2.1 este documento ✅ · 2.2 tela inicial com números reais e os menus Comércios e Alertas ✅ · 2.3 velocidade do banco ✅ | ✅ feita |
| **3. Vendas pelo caixa** | 3.1 banco das vendas ✅ · 3.2 aba Vendas e caixas ✅ · 3.3 Omni Conector ✅ · 3.4 "Vendas hoje" e "Vendido sem cadastro" ✅ · piloto num mercado real junto com o teste geral | ✅ feita (falta o piloto) |
| **4. Fechar a conta** | 4.1 banco (perdas, conferência do depósito, diferenças; reposição acusando diferença) ✅ · 4.2 app da equipe: Registrar perda e Conferir depósito ✅ · 4.3 aba Diferenças do dono ✅ | ✅ concluída em 10/10/2026 (falta o teste do dono) |
| **5. Antifurto** | 5.1 relatório do comércio ✅ · 5.2 alertas e produto visado na conferência diária ✅ · 5.3 painel de todos os comércios na tela inicial ✅ | ✅ concluída em 10/10/2026 (falta o teste do dono) |
| **6. Lançamento** | E-mail próprio ("Esqueci minha senha"), Termos e Privacidade, proteção de senhas, Google verificado, teste em computador, tablet, Android e iPhone | Pendente; detalhado em E5/E6 do plano ativo |
| **7. Depois** | Eventual caixa adicional no computador · chave para o fornecedor do caixa · gerente · balança do mercado · WhatsApp/e-mail automáticos | A combinar; o Caixa no celular já existe |

## 14. DECISÕES ABERTAS (PERGUNTAR AO DONO)

Para G0–G8, o dono confirmou **várias lojas e vários caixas**. Ainda faltam: número máximo de lojas, produtos/variações e caixas simultâneos; pico de vendas e tamanho das filas; PDV/fiscal e equipamentos usados; atribuições do gerente; prazo tolerável de parada/perda de dados e orçamento de infraestrutura. Esses números são definidos em G5/G6, sem impedir as correções de segurança. A aprovação de ajustes de contagem, referência inicial e perdas deve distinguir os efeitos atuais e os propostos em G3.

**Entrega de manutenção autorizada em 10/10/2026:** melhorias de confiabilidade, organização do código e clareza das telas, sem novos módulos nem alteração dos passos. Registro em [melhorias-base-2026-10-10.md](melhorias-base-2026-10-10.md). Correção SQL de reposição e reenvios aplicada em produção em 10/10/2026 (versão `20261010150241`). A Fase 6 não foi iniciada nesta entrega.

1. ~~Vendas: caminho da seção 7.6~~ — aprovado em 10/10/2026. Para o piloto no fim: um mercado real, o arquivo `.xml` de uma nota e se o computador do caixa tem Chrome.
5. ~~Perdas~~ — decidido em 10/10/2026: sai do estoque na hora e o dono confirma (recusar vira diferença).
6. **Gerente:** quais funções pode usar?
7. **Android:** o app do dono estava instalado no celular onde o Omni Operação não oferecia instalar?
8. Número certo do código de barras do **Arroz**.

## 15. HISTÓRICO DAS PRINCIPAIS DECISÕES DO DONO

- **13/10/2026 — mercados grandes e segurança:** análise ponta a ponta e plano por etapas para várias lojas/vários caixas. Mantida esta fonte central; G0–G8 acrescentadas ao checklist, sem apagar E1–E8. Auditoria e documentação autorizadas; correções continuam sujeitas à apresentação prévia de código/arquivos/impactos. Não declarar sistema imune a ataques nem marcar testes de produção/carga/recuperação como executados sem evidência.

- **11/10/2026 — plano ponta a ponta:** o dono pediu checklist por etapas no GitHub e consulta da fonte da verdade antes de cada etapa. Mantida esta referência central, ligado o checklist detalhado, preservados os 30 itens originais e separado corrigido/publicado/validado. Nenhuma nova função de negócio ou alteração de dados autorizada apenas por constar no plano.

- **Escopo e login:**
  - sistema para qualquer comércio com depósito → reduzido aos 6 tipos;
  - login: "somente Google" → **Google + e-mail**; criar conta nunca entra direto;
  - cadastros em **etapas sem rolagem**;
  - a logo é criada pelo Lovable.
- **Banco:** autorizou o Supabase `omnisafe-360-oficial`, com segurança ligada.
- **08/10/2026:** repositório **público**; o Claude ganhou acesso ao GitHub, ao Lovable e ao Supabase.
- **09/10/2026 — forma de trabalhar:**
  - o Claude executa direto e mescla no `main`;
  - o dono testa mais à frente;
  - o dono manteve as tabelas de estoque que o Lovable criou.
- **09/10/2026 — produto e compras:**
  - preço pela margem sobre a compra;
  - lembrar a última escolha;
  - código interno "29…";
  - etiquetas;
  - embalagens;
  - "Ver o estoque" em 4 partes;
  - pedido de compra com link do fornecedor e pagamento.
- **09/10/2026 — funcionário:**
  - app **Omni Operação** com código + PIN e contagem cega até 3 vezes;
  - reposição conta primeiro e depois diz quanto buscar;
  - app instalável;
  - PIN ao abrir.
- **10/10/2026:**
  - o caixa deve **se ligar ao sistema de caixa do mercado** (vários caixas por loja), descontando da gôndola na hora — proposta na seção 7.6;
  - pedido do dono: **"tudo fácil para o comerciante, bonito, organizado e coerente no lugar onde for implantado"** — virou a seção 3 e a lista da seção 0.


**13/10/2026 — G0.3, implementação aprovada pelo dono:** consulta atual confirma `main protected=false` e rulesets vazios; permissões administrativas de Actions respondem 403 e não foram verificadas. Proposta de oito arquivos aprovada explicitamente (“Sim”) e aplicada: workflow de verificações, Dependabot e verificadores de segredos/dependências, sem alterar aplicativo, SQL, dados, package.json ou lock oficial. [Arquivos, impactos e critérios](publicacao-seguranca-2026-10-13.md). **Entrega no [PR #117](https://github.com/OmniSafe-360/mock-overlay-magic/pull/117), código `9830590`, [CI remoto aprovado](https://github.com/OmniSafe-360/mock-overlay-magic/actions/runs/38381015645): checks funcionando no GitHub. Proteções/alertas administrativos e compatibilidade das regras com o Lovable pendentes; G0.3 permanece aberta.** Proteção obrigatória depende da primeira execução remota e validação do acesso Lovable; não ativar bloqueio de push direto sem considerar sua sincronização. G0.3/G0 continuam abertas; G0.1/publicação/teste e G0.2/aceite operacional permanecem pendentes.


**13/10/2026 — G1.1, auditoria de isolamento autorizada:** base `main b05339c`/PR #117 conferida. 243 casos SQL e 74 HTTP (PostgREST local), todos aprovados; dois donos/três lojas/quatro caixas/equipe/fornecedores/fiado/gerente global, UUIDs cruzados, revogação e acessos legítimos. Defaults oficiais Supabase emulados apenas na cópia privada; 122 funções/35 tabelas, 33 helpers fechados. [Evidências, limites e roteiro](isolamento-acessos-2026-10-13.md). **G1.1 permanece aberta:** comparar ACL/RLS/funções e gateway reais depende de leitura administrativa segura, indisponível nesta execução. Diferença local de loja inativa: Conector recusa, equipe/caixa móvel ainda consultam; pertence à G1.2 e requer proposta/validação antes de corrigir. Nenhum app, migração, permissão de produção, dado ou workflow alterado. G0.1/G0.2/G0.3 mantêm seus aceites pendentes; próxima análise independente G1.2. Não exige atualizar app no Lovable.

---

## 16. REORGANIZAÇÃO MULTICOMÉRCIO — RMC

Registrada em 13/10/2026 (RMC-00), sobre o `main` `8bb3342` (PR #123). **Esta seção descreve uma reorganização planejada, não uma implementação já realizada.** O mapa atual da seção 3.2 e o estado da seção 12 continuam valendo até que cada mudança correspondente seja autorizada, implementada e validada pelo dono; só então eles são atualizados.

**Objetivo:** separar o Painel Geral do Proprietário do ambiente individual de cada comércio. O painel geral passa a funcionar principalmente como central de todos os estabelecimentos, sem repetir sem necessidade as informações operacionais exibidas dentro de cada unidade.

**Regras:**

1. O painel geral representa o conjunto dos comércios do proprietário.
2. Cada comércio mantém suas operações e informações específicas.
3. Conforme revisão RMC-02B reafirmada pelo dono em 13/10/2026, Início prioriza indicadores do conjunto dos comércios; nome, identificação, localização, situação e entrada de cada unidade ficam em Comércios. Não duplicar a lista no painel global.
4. Não repetir no painel geral listas operacionais, cadastros completos, equipes individuais ou detalhes de estoque.
5. Não eliminar informações importantes nem funcionalidades existentes. Toda funcionalidade permanece acessível em um local coerente.
6. Recursos realmente consolidados de vários comércios (ex.: relatórios gerais, antifurto geral) têm seu destino avaliado antes de qualquer retirada.
7. Manter a identidade visual OmniSafe 360°, a responsividade e a facilidade de navegação (seção 8 e memória do projeto).
8. Preservar integralmente o isolamento de dados por comércio e o compartilhamento de fornecedores conforme as regras atuais.
9. Preservar todas as regras financeiras, operacionais e de segurança.
10. Mudanças executadas individualmente, com inspeção de código, testes automáticos e validação manual.
11. Nenhuma alteração de banco de dados faz parte desta reorganização.
12. Uma etapa só é concluída após aprovação expressa do proprietário.

**Controle obrigatório antes de cada etapa RMC:** conferir esta fonte e o estado atual do GitHub; apresentar o problema, a mudança proposta e a lista exata de arquivos; explicar o impacto nos fluxos existentes; aguardar aprovação do dono para mudança funcional; alterar só o aprovado; rodar `npx tsc --noEmit` e `npx vitest run` duas vezes cada (etapas com código), build e testes específicos; verificar regressões de navegação e fluxos protegidos; registrar resultados reais; informar se precisa Publicar → Atualizar; fornecer roteiro de teste manual; não iniciar a próxima etapa sem autorização; manter o histórico Git sem force push, rebase ou reescrita. Se surgir necessidade de alterar código fora do escopo, interromper e justificar.

**Etapas** (detalhe e situação no [checklist ponta a ponta](CHECKLIST_PONTA_A_PONTA.md), frente RMC): RMC-00 registro documental; RMC-01 cartões dos comércios; RMC-02 unificação visual e de navegação entre Início e Comércios; RMC-03 Equipe e Primeiros passos; RMC-04 resumos e alertas, preservando relatórios e acessos; RMC-05 navegação geral do proprietário × navegação interna da unidade; RMC-06 regressão e homologação. As frentes E1–E8 e G0–G8 continuam inalteradas.

**Revisão do proprietário (13/10/2026, RMC-02B):** a decisão da RMC-02 de unificar Início e Comércios foi revista pelo dono. Vale agora: **Início = somente indicadores consolidados** (vendas, antifurto, resumo e alertas); **Comércios = cartões e administração das unidades** (lista/grade da RMC-01, produtos, situação, Adicionar e, provisoriamente, Primeiros passos). Menu: Início | Comércios | Alertas | Equipe | Conta. O comércio abre por cima da aba de origem e o Voltar devolve a ela (Comércios, Alertas, Antifurto; vendas pedidas no Início voltam ao Início). O histórico da RMC-01 e da RMC-02 fica preservado no checklist.

**RMC-02C / C1 (13/10/2026):** o Início identifica que os números são do conjunto dos comércios ("Visão geral dos seus comércios", cadastrados e com dados completos) e explica cada indicador em uma frase; nenhum cálculo mudou. Comércio só conta como completo quando produtos, vendas e diferenças estão disponíveis.

**RMC-02C / C2 (13/10/2026):** os quatro indicadores menores do Início somam apenas comércios com dados confirmados na leitura atual; com parte dos comércios mostram "Subtotal: X de Y comércios", sem nenhum mostram "—" (ou "…" carregando). Números antigos de comércio que falhou nunca entram como confirmados.

**RMC-02C / C3 — organização visual** (13/10/2026): Início agrupado em "Resultado de hoje" (Vendas hoje, etiqueta "Hoje · dd/mm"), "Resultado deste mês" (Faltou este mês, "Mês de <mês>") e "Pendências que precisam de atenção" (quatro indicadores); etiquetas pela data de referência já usada (`useHoje`, America/Sao_Paulo); celular empilhado, computador lado a lado e 4 colunas. C1/C2, cálculos, nomes acessíveis e ações iguais. +3 testes; tipos duas vezes, 1.049 testes nas duas rodadas, build. Conferência visual no navegador não feita (sem sessão de teste neste ambiente). Sem banco. **Implementada no código, aguardando validação manual**; precisa Publicar → Atualizar. C4/RMC-03 não iniciadas.


**Auditoria do painel global (13/10/2026, base `e169e89`):** o dono reafirmou Início como painel consolidado para um ou vários comércios de tipos diferentes. [Análise, evidências e proposta de pequenas etapas](auditoria-painel-global-2026-10-13.md), parte desta frente RMC. Sobreposição reproduzida no Chromium com componente/CSS reais e dados fictícios: margem negativa do cabeçalho, altura integral dos cartões somada aos títulos e valores grandes invadindo texto lateral. Primeira entrega proposta **C3-A**, apenas margens/alturas; depois C3-B (valores/responsividade), C4-A/B/C (clareza, destinos e atualização), C4-D opcional e RMC-06. **Somente documentação nesta auditoria; correções aguardam validação prévia.** Preservar cálculos, relatórios, menu e isolamento; nenhuma alteração de banco. RMC-03 continua pendente; priorizar a legibilidade antes de avançar.


**RMC-02C/C3-A (13/10/2026), autorizada pelo dono:** aplicada somente a proposta de três trechos em `OwnerHome.tsx` para margem/altura. Cabeçalho e grupos não se sobrepõem nos 25 cenários locais verificados no Chromium; preservados os cálculos, textos, ordem, destinos, cadastro, menu e botão Adicionar. Sem mudança de banco. **Pronto no código, falta Publicar → Atualizar e o teste do dono**; conferir títulos no Início com um/vários comércios. C3-B permanece pendente para valores/status em telas estreitas e letras ampliadas, com proposta prévia obrigatória antes da aplicação. [Registro de entrega](auditoria-painel-global-2026-10-13.md#entrega-c3-a).

- 13/10/2026: **RMC-02C/C3-B** — cartões do Início se reorganizam pela largura do próprio cartão (valor completo em linha própria quando estreito; pendências em 1/2/4 colunas). Só apresentação; sem banco. Implementada no código, aguardando publicação e validação manual do proprietário. Ver docs/auditoria-painel-global-2026-10-13.md.

**RMC-04/C4-A (13/10/2026), implementação em PR para revisão do dono:** autorizada nova ordem do Início: Resultado de hoje/Vendas → Pendências → Resultado deste mês/Faltou. “Resumo de hoje” passa a “Situação dos comércios”, mantendo a região acessível “Resumo geral”. A descrição de Faltou este mês passa a explicar as faltas provenientes de diferenças do estoque filtradas pela regra atual, **sem incluir automaticamente perdas separadas**. Mesmas fórmulas, estados de consulta, acessos, proteção de dados e fluxos. Implementação proposta em branch separada, sem integração automática; testes CI, verificação visual em aparelho real e publicação pendentes. Ver [registro da C4-A](auditoria-painel-global-2026-10-13.md#entrega-em-revisão--rmc-04c4-a-13102026). C4-B/C4-C e demais etapas não iniciadas.

**RMC-04/C4-B (13/10/2026), código em PR separado aguardando validação e aprovação:** o proprietário autorizou que cada um dos quatro indicadores do Início abra a aba Alertas no assunto correspondente, com identificação das lojas e acesso a “Ver todos os alertas”, usando exclusivamente leituras confirmadas pelos critérios da C2. Ao abrir uma loja, o Voltar preserva o filtro; menu/sino abrem Alertas sem filtro. Nenhuma mudança em cálculos, fontes operacionais, banco ou permissões. A lista geral sem filtro e o sino ainda exigem auditoria de dados antigos na C4-C; não alegar correção antecipada. Evidências de CI, publicação no Lovable e teste manual continuam pendentes. Ver [registro da C4-B](auditoria-painel-global-2026-10-13.md#entrega-c4-b-em-revisão--implementação-autorizada-13102026).

**13/10/2026 — Atualização posterior aos registros de C4-A/C4-B:** o registro de “PR para revisão” acima descreve o estado no momento em que foi escrito e **não é o estado atual**. C4-A foi integrada no [PR #128](https://github.com/OmniSafe-360/mock-overlay-magic/pull/128), `main bf7dae3bb26a`, CI pós-merge aprovado; C4-B foi integrada no [PR #130](https://github.com/OmniSafe-360/mock-overlay-magic/pull/130), `main 8aca0661b7af`, CI pós-merge aprovado, 1.061 testes duas vezes/tipos/build no PR. O dono relatou “Deu certo” no teste da C4-B; **testes de todos os cenários e aparelhos da RMC-06 permanecem abertos**. Próximo item recomendado: **auditoria/proposta C4-C1** para não tratar dados antigos do sino/Alertas sem filtro como atuais; detalhes, código, arquivos, riscos e aceites no [relatório de auditoria](auditoria-painel-global-2026-10-13.md). Nenhum código da C4-C foi autorizado a partir deste registro documental; preservar a exigência de aprovação prévia da seção 0.
