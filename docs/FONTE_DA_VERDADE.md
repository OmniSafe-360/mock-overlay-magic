# OMNI SAFE 360 — FONTE DA VERDADE

Versão 2.0, de 10/10/2026. Substitui a versão 1.0 de 08/10/2026, cujo conteúdo foi mantido e atualizado aqui.

Este documento é a referência oficial do sistema. Se qualquer instrução, código ou conversa contradisser este documento, vale este documento. A exceção é quando o dono disser o contrário por escrito; nesse caso, o documento é atualizado.

> **Para o Claude:** este documento é consultado em **toda ação**, não só no começo. A seção 0 é a lista de conferência obrigatória. As seções 1 a 3 são regras. A seção 13 diz em que etapa estamos. O banco real (Supabase) é a verdade sobre as tabelas, e o `CLAUDE.md` guarda o registro detalhado de cada entrega.

---

## 0. LISTA DE CONFERÊNCIA — EM TODA AÇÃO

### Antes de começar
1. **Ler a etapa atual** (seção 13). Conferir se o pedido do dono cabe nela e se não falta uma decisão dele (seção 14). Faltando, perguntar antes de construir.
2. **Conferir se o `main` mudou** (alguém pode ter gravado direto, como o Codex em 09/10). Se mudou, revisar antes de seguir.
3. **Tabela nova ou mudança de desenho?** Só com o desenho aprovado pelo dono (regra 5).
4. **Decidir o lugar certo** na tela, pelo mapa da seção 3.2. Se não houver lugar coerente, propor ao dono antes.

### Durante
5. **Fácil, bonito, organizado e coerente** (seção 3.1). Cada tela tem uma tarefa clara, botões grandes, frases curtas e os nomes certos para o tipo de comércio.
6. **Uma coisa de cada vez.** Uma entrega por pull request.
7. **No banco:** RLS ligada, gravação só por funções seguras e uma `operacoes` em toda mudança de estoque, na mesma transação. Funções sem login só funcionam com chave ou link secreto.

### Antes de publicar
8. `npx tsc --noEmit` sem erros.
9. `npx vitest run` passando, duas vezes. O `scanner.test.tsx` às vezes falha junto com os outros; sozinho passa.
10. **Simular no banco** com `begin … rollback`, incluindo o que deve ser recusado: outro dono, sem login, gravação direta. O texto não pode conter a palavra "delete".
11. **Reler a mudança** procurando erro, texto confuso, plural errado ou tela que não cabe no celular (320 px).
12. Conferir os **avisos do Supabase** (segurança e velocidade) depois de mudar o banco.

### Depois
13. Mesclar no `main`, avisar o dono para **Publicar → Atualizar** no Lovable e dizer **o que ele deve testar**.
14. Registrar no `CLAUDE.md` e, se mudou etapa, regra ou decisão, **atualizar este documento**.

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
| **App do dono — barra de baixo** | **Início** (vendas de hoje e resumo de todos os comércios) · **Comércios** · **Alertas** (o que precisa de atenção em todos) · **Equipe** (todas as equipes) · **Conta** |
| **Dentro de um comércio — abas** | **Produtos** ("Atenção hoje" + lista) · **Depósito/Estoque** · **Gôndolas/Área de venda** · **Pedidos** (compras, contas a pagar, recebimentos) · **Fornecedores** · **Equipe** · **Vendas** (caixas e vendas; Fase 3) · **Diferenças** (perdas para confirmar, diferenças para explicar, com o valor em reais; Fase 4.3) |
| **Ficha do produto** | Tudo de um produto: situação, quanto tem, onde fica, validade, preço, fornecedor, etiqueta |
| **App do funcionário — Omni Operação** (`/funcionario`) | Código + PIN; botões grandes **Receber mercadoria**, **Repor gôndola** e **Conferir depósito** (para todos), e o botão **Registrar perda** (Fase 4.2) |
| **Página do fornecedor** (`/pedido/<link>`) | O fornecedor vê e responde um pedido, sem login |
| **Omni Conector** (`/conector`) | Página no computador do caixa que lê a pasta das notas e envia as vendas finalizadas ao Omni |

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
- **Até 3 contagens:** vale quando duas dão o mesmo número; senão vira **inconsistência** para o dono decidir.
- **Receber:**
  - "Veio quebrado ou vencido" não entra no estoque;
  - produto fora do pedido fica separado, e o dono decide se fica ou se devolve.
- **Repor:**
  - **primeiro** o funcionário conta a prateleira (cega), **depois** o app diz quanto buscar, até o máximo;
  - o produto que vence primeiro sai antes, mantendo o lote.
- **Conferir o depósito (Fase 4.2):** até 5 produtos por dia, revezando; o funcionário conta fardos/caixas fechados e o que está sem embalagem, e o app soma. Cada nova contagem começa do zero.
- **Enquanto as vendas não chegam do caixa,** a contagem da gôndola só acerta o número, sem acusar diferença. Com as vendas chegando (Fase 3), passa a acusar.

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

### 7.6 Vendas — ligação com o caixa do mercado (proposta de 10/10/2026, aguardando o dono)
- O dono pediu que o Omni **se ligue ao sistema de caixa que o mercado já usa**, com vários caixas por loja (5, 6 ou mais), e que **cada venda desconte da gôndola na hora**.
- **Regra do dono (10/10/2026): só desconta quando a venda é FINALIZADA no caixa** (pagamento aprovado e venda fechada). Bipar não desconta nada; venda desistida antes de fechar não desconta; venda cancelada depois devolve.
- Cada marca de caixa é diferente, mas **toda venda finalizada gera a nota fiscal do cupom (NFC-e)** — a nota só existe depois que a venda fecha, o que garante a regra acima: um arquivo com produto, código de barras, quantidade, hora e número do caixa.
- **Caminho principal — Omni Conector:**
  - uma página do Omni instalada como app no computador do caixa;
  - acompanha a pasta das notas e envia cada venda em menos de 1 minuto;
  - a ligação usa um código de 6 números, que vira a chave daquele caixa, e o dono pode desligar qualquer caixa;
  - um conector no computador central pode servir a todos os caixas.
- **Reservas:**
  - (B) chave para o fornecedor do sistema de caixa mandar as vendas direto;
  - (C) caixa próprio do Omni, para quem não tem sistema.
- **Regras:**
  - cada nota só conta uma vez (número único de 44 dígitos);
  - sem internet, as vendas esperam e vão depois;
  - nota cancelada devolve para a gôndola;
  - vender o código da embalagem desconta as unidades dela;
  - o código interno do caixa (incluindo balança) é ligado ao produto uma vez;
  - produto vendido sem cadastro vai para a lista "Vendido sem cadastro";
  - vendas como "Diversos" são contadas por caixa e avisadas;
  - gôndola que ficaria negativa gera aviso amarelo;
  - cada venda grava uma `operacoes`.
- **Situação de cada caixa:** verde enviando, amarelo parado há 30 minutos com a loja aberta, vermelho desligado.
- **Fechamento do dinheiro:** é feito pelo sistema do caixa do mercado. O Omni mostra as vendas de cada caixa em tempo real.

### 7.7 Perdas e diferenças (Fase 4)
- **Registrar perda:**
  - o funcionário marca no app o motivo: quebrou, venceu, consumo da loja ou devolvido ao fornecedor;
  - sai do estoque na hora; o dono confirma na aba **Diferenças** ("Confirmar" ou "Não aconteceu" — recusar vira uma diferença para investigar);
  - o dono também registra perdas ele mesmo (já confirmadas).
- **Aba "Diferenças":** cada diferença com o produto, o lugar, de onde veio (conferência, reposição, perda não confirmada), quem contou, quando e o valor em reais (preço de compra). O dono explica: erro de contagem, quebrou, venceu, usado na loja, sumiu ou outro motivo (este pede uma anotação).
  - Quando as 3 contagens da conferência não bateram, o dono escolhe o número certo (uma das contagens ou "manter o número do sistema"); o estoque é acertado na hora (`resolver_conferencia`).
  - Resumo do mês: "Faltou este mês" (sem o que foi explicado como erro de contagem) e "Perdas este mês".
  - O quadro vermelho **"Perdas e diferenças"** aparece no "Atenção hoje", no menu Alertas e conta em "Para resolver agora" na tela inicial.
- **Antifurto (Fase 5):** o que "sumiu" alimenta os relatórios por produto, lugar, dia e horário, com o valor em reais.

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
- **Apps instaláveis:** "Omni Safe 360" (dono) e "Omni Operação" (funcionário, escopo `/funcionario`), cada um com o próprio manifesto.

## 9. ONDE ESTÁ O CÓDIGO

- **Front-end:** React 19 + TanStack Start/Router + Vite + Tailwind 4 + TypeScript + vitest. Leitor de código `@zxing/browser`; QR `qrcode-generator`.
- **Rotas:**
  - `src/routes/index.tsx` — entrada e app do dono;
  - `src/routes/funcionario.tsx` — Omni Operação;
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

Projeto **`omnisafe-360-oficial`** (ref `bvwjprxfthhreuhovgbk`), São Paulo, Postgres 17. **29 tabelas, todas com RLS ligada.**

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
| Fechar a conta | `perdas`, `conferencias`, `diferencas` | só funções do app do funcionário e do dono |

- **Velocidade (10/10/2026):** toda ligação entre tabelas tem atalho de busca (índice) e as regras de RLS usam `(select auth.uid())`, calculado uma vez por consulta. Tabela ou regra nova segue o mesmo padrão. O aviso "índice não usado" do Supabase é esperado enquanto há poucos dados.
- **Funções sem login, de propósito** (o aviso do Supabase sobre elas é esperado): a página do fornecedor (`pedido_publico`, `responder_pedido`, que exigem o link secreto) e o app do funcionário (exigem o código e o PIN, ou a chave do celular).
- **Autenticação:**
  - Google e e-mail/senha;
  - o envio de e-mail do Supabase tem limite baixo, por isso o "Esqueci minha senha" falhou; precisa de serviço de e-mail próprio;
  - a "proteção contra senhas vazadas" está **desligada**: o dono liga no painel do Supabase.
- **Vendas (Fase 3, desde 10/10/2026):** `caixas` (código de 8 números para ligar, chave do computador do caixa guardada só como resumo), `vendas` (uma por nota, chave de 44 números única), `venda_itens` (cada item com quanto saiu da gôndola, quanto "faltou" e de quais saldos saiu) e `codigos_pdv` (código do caixa ligado a um produto, ou "não controlar"). O computador do caixa usa `conector_ligar`, `conector_estado`, `conector_enviar_venda` e `conector_cancelar_venda`; o dono, `criar_caixa`, `renomear_caixa`, `novo_codigo_caixa`, `desligar_caixa` e `resolver_item_venda`.
- **Fechar a conta (Fase 4, desde 10/10/2026):** `perdas` (sai do estoque na hora; o dono confirma ou recusa), `conferencias` (contagem cega do depósito, até 3 vezes) e `diferencas` (o que o sistema tinha × o que foi contado, com o valor em reais; o dono explica o motivo). Funcionário: `funcionario_registrar_perda`, `funcionario_conferencia_lista`, `funcionario_conferencia_contar`; dono: `registrar_perda`, `decidir_perda`, `explicar_diferenca`, `resolver_conferencia` (escolher a contagem certa). A reposição gera diferença na gôndola quando o comércio tem um caixa ligado.

## 11. INFRAESTRUTURA

- **Supabase:** `omnisafe-360-oficial`. O projeto antigo `omnisafe-360` **não deve ser usado**.
- **Publicação:** `https://mock-overlay-magic.lovable.app`. Para aparecer: **Publicar → Atualizar** no Lovable.
- **GitHub:** `OmniSafe-360/mock-overlay-magic`, **público por decisão do dono** (08/10/2026). Trabalho no branch `claude/system-analysis-5lb6d6`, com pull request mesclado no `main`.
- **Google Cloud:** projeto próprio do Omni (OAuth "Aplicativo da Web"), em modo teste.
- **Acessos do Claude:** GitHub, Supabase e Lovable. O endereço publicado não abre a partir do ambiente do Claude.

---

## 12. ESTADO ATUAL (10/10/2026)

### 12.1 Pronto e testado pelo dono
- Entrada, criar conta, cadastro do comércio e comércios no banco (Etapa B1).
- Cadastro de produto, testado no mercado e na farmácia, com as correções desses testes.
- Primeiro acesso do funcionário (código, QR e PIN), que levou à correção do PIN ao abrir.

### 12.2 Pronto, falta o teste do dono
- Ver o estoque: ficha, lista, Depósito, Gôndolas e "Atenção hoje".
- Fornecedores (aba), pedido de compra, link do fornecedor e contas a pagar.
- Equipe (QR, bloquear, novo acesso) e app Omni Operação: instalar, PIN ao abrir, receber mercadoria, repor gôndola, conferir depósito e registrar perda (10/10/2026).
- Aba **Diferenças** do comércio: confirmar perdas, explicar diferenças, escolher a contagem certa e registrar perda pelo dono (10/10/2026).
- Tela inicial com números reais ("Resumo de hoje" e situação de cada comércio), menus **Comércios** e **Alertas** (10/10/2026).
- Aba **Vendas** do comércio: ligar caixas com código, situação de cada caixa e vendas do dia (10/10/2026; as vendas só chegam com o Omni Conector, Fase 3.3).

### 12.3 Ainda não existe ou está incompleto
- "Esqueci minha senha", que falha por falta de e-mail próprio.
- Código de barras do Arroz, que parece digitado errado (aguarda o número certo do dono).

---

## 13. ROTEIRO — O PLANO

Cada fase termina com o roteiro de teste para o dono.

| Fase | O que é | Situação |
|---|---|---|
| **1. Base** | Contas, comércios, cadastro, estoque, pedidos, equipe, receber, repor | ✅ feita (parte falta testar, 12.2) |
| **2. Arrumação** | 2.1 este documento ✅ · 2.2 tela inicial com números reais e os menus Comércios e Alertas ✅ · 2.3 velocidade do banco ✅ | ✅ feita |
| **3. Vendas pelo caixa** | 3.1 banco das vendas ✅ · 3.2 aba Vendas e caixas ✅ · 3.3 Omni Conector ✅ · 3.4 "Vendas hoje" e "Vendido sem cadastro" ✅ · piloto num mercado real junto com o teste geral | ✅ feita (falta o piloto) |
| **4. Fechar a conta** | 4.1 banco (perdas, conferência do depósito, diferenças; reposição acusando diferença) ✅ · 4.2 app da equipe: Registrar perda e Conferir depósito ✅ · 4.3 aba Diferenças do dono ✅ | ✅ concluída em 10/10/2026 (falta o teste do dono) |
| **5. Antifurto** | Relatórios do que sumiu (produto, lugar, horário, valor), alertas, painel de todos os comércios | **▶ PRÓXIMA ETAPA** (desenho a apresentar ao dono) |
| **6. Lançamento** | E-mail próprio ("Esqueci minha senha"), Termos e Privacidade, proteção de senhas, Google verificado, teste em computador, tablet, Android e iPhone | antes de abrir ao público |
| **7. Depois** | Caixa próprio do Omni · chave para o fornecedor do caixa · gerente · balança do mercado · WhatsApp/e-mail automáticos | a combinar |

## 14. DECISÕES ABERTAS (PERGUNTAR AO DONO)

1. ~~Vendas: caminho da seção 7.6~~ — aprovado em 10/10/2026. Para o piloto no fim: um mercado real, o arquivo `.xml` de uma nota e se o computador do caixa tem Chrome.
5. ~~Perdas~~ — decidido em 10/10/2026: sai do estoque na hora e o dono confirma (recusar vira diferença).
6. **Gerente:** quais funções pode usar?
7. **Android:** o app do dono estava instalado no celular onde o Omni Operação não oferecia instalar?
8. Número certo do código de barras do **Arroz**.

## 15. HISTÓRICO DAS PRINCIPAIS DECISÕES DO DONO

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
