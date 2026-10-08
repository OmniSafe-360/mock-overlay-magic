# OMNI SAFE 360 — FONTE DA VERDADE

Versão 1.0 — 08/10/2026. Este documento é a referência oficial do sistema. Se qualquer outra instrução, código ou conversa contradisse este documento, vale este documento, a não ser que o dono do projeto diga o contrário por escrito.

> **Para o Claude Code:** leia as seções 1 e 2 antes de tudo. Elas dizem quem é o dono do projeto e quais regras de trabalho são inegociáveis. O banco de dados real (Supabase) é a verdade sobre as tabelas; a seção 9 descreve o que existe hoje.

---

## 1. QUEM É O DONO DO PROJETO E COMO TRABALHAR COM ELE

- O dono do projeto **não é programador**. Explique tudo em português simples, sem jargão. Ensine a testar cada etapa e peça o resultado (funcionou / não funcionou).
- Ele constrói o front-end pelo **Lovable** (mandando prompts) e o banco no **Supabase**. O Claude (chat) também acessa o Supabase.
- Ele quer um sistema **muito fácil de entender e de configurar**. Se o comerciante não entende, ele desiste. Toda tela precisa ser simples, bonita e guiada.
- Ele quer **fechamento perfeito, sem fluxo errado**. Prefere ir por etapas, com teste ao fim de cada uma.

## 2. REGRAS DE TRABALHO (INEGOCIÁVEIS)

1. **Nunca avançar de etapa sem teste.** Cada etapa termina com um roteiro de teste simples que o dono executa, e ele informa o resultado.
2. **Um prompt (uma tarefa) por vez** para o Lovable. Nunca entregar vários prompts juntos.
3. **O Claude nunca envia nada direto ao Lovable.** O dono cola o prompt lá. O Claude só entrega o texto pronto.
4. **Todo prompt para o Lovable inclui uma "PROTEÇÃO DO CORE":** lista do que já funciona e não pode ser alterado, além do escopo pedido.
5. **Mudanças no banco de dados (Supabase):** o Claude pode aplicá-las direto, via ferramenta, **depois de o desenho ter sido aprovado pelo dono**. O dono aprovou até agora as tabelas descritas na seção 9. Qualquer tabela nova precisa de aprovação do desenho.
6. **Segurança sempre ligada (RLS) em toda tabela**, no momento da criação.
7. **Usar somente o Supabase do projeto** (seção 10). **Nunca usar Lovable Cloud.** Nunca colocar chave secreta ou service role no código. Só a chave pública (anon/publishable) pode estar no front-end.
8. **Git:** não reescrever o histórico publicado (sem force push, rebase ou squash de commits já enviados). Commits no branch conectado sincronizam de volta com o Lovable. Manter o branch sempre funcionando.
9. **Auditorias periódicas:** o Claude deve, de vez em quando, pedir ou fazer auditoria (código, banco, segurança, responsividade).
10. **Nunca misturar este projeto com o Zuvvi** (outro sistema do mesmo dono: app de mototáxi). Contas, bancos e repositórios são separados.

---

## 3. VISÃO DO PRODUTO

**Omni Safe 360** é um sistema web (instalável como app, PWA) de **controle de estoque, gôndola, PDV e antifurto** para comércios que têm depósito. O sistema cuida da mercadoria do recebimento até a venda, e aponta quando algum produto está faltando e onde a conta deixou de fechar.

- **Meta de automação:** ~90% automático, só ~10% manual (basicamente o cadastro de produtos).
- **Multi-comércio:** o dono cadastra vários comércios; cada um é independente (produtos, depósito, gôndolas, equipe).
- **Plataformas:** web, Android, iOS e tablet, tudo responsivo, com aparência de **app nativo** no celular (barra de navegação inferior, cabeçalho profissional).
- **Identidade:** nome "Omni Safe 360", slogan "Controle inteligente de estoque", frase da entrada "Controle total do seu comércio, em tempo real." Visual premium, "cara de empresa grande".

## 4. TIPOS DE COMÉRCIO ATENDIDOS (SOMENTE ESTES 6)

Mercado · Farmácia · Loja de roupas · Material de construção · Pet shop · Autopeças.

**Fora do escopo, por decisão do dono:** açougue (carne por quilo perde peso no corte, a conta nunca fecha 100%), padaria (produção própria), "outro tipo de comércio". Na categoria "Mercado", **não** existem as categorias "Açougue" e "Padaria".

O tipo de comércio escolhido define as **unidades de medida, categorias e detalhes do produto** (só os do tipo escolhido, para não misturar):

| Tipo | Unidades | Detalhes do produto |
|---|---|---|
| Mercado | Unidade, Kg, Litro, Pacote, Caixa | marca, peso/volume da embalagem |
| Farmácia | Caixa, Cartela, Frasco, Unidade | princípio ativo, apresentação, marca, controlado (sim/não), lote, validade obrigatória |
| Loja de roupas | Peça, Par | marca, **variações** (tamanho + cor, cada uma com **código de barras próprio**) |
| Material de construção | Unidade, Metro, m², Kg, Saco, Caixa, Lata | marca, medida/especificação |
| Pet shop | Unidade, Kg, Litro, Pacote, Caixa | marca, espécie (cão, gato, outros), peso da embalagem |
| Autopeças | Unidade, Par, Jogo, Kit | código do fabricante (referência), marca, aplicação (marca/modelo/ano), posição |

## 5. PERFIS DE ACESSO

- **Dono:** acesso a tudo. Cria comércios, produtos, fornecedores, equipe e autoriza acessos. Quem cria conta pelo cadastro recebe o papel de dono.
- **Gerente:** acesso apenas às funções que o dono liberar.
- **Repositor/estoquista:** app **híbrido e simples**, com dois botões grandes: **Receber mercadoria** (entrada cega) e **Repor gôndola**. Nome do modo/app ainda **indefinido** (sugestões: Omni Operação, Omni Estoque, Omni Repor, Omni Flow).
- Possível perfil de **caixa** (PDV): a confirmar com o dono.

**Acesso do funcionário (proposta aguardando aprovação do dono):** o dono cadastra o funcionário (nome e função) e o sistema gera um **código pessoal**. Na tela de entrada há a opção "Sou funcionário". O funcionário digita o código **mais um PIN de 4 a 6 dígitos** criado por ele no primeiro acesso (só o código seria inseguro). O dono pode **bloquear** o código a qualquer momento. O dono sempre autoriza.

Papéis ficam em **tabela separada** (`user_roles`); ninguém consegue dar a si mesmo o papel de dono.

---

## 6. REGRAS DE NEGÓCIO

### 6.1 Cadeia do produto
Entrada no depósito → saída do depósito (para a gôndola, ou outro local, conforme o comércio) → venda no PDV (baixa na gôndola). O **antifurto** cruza essas três pontas e aponta o que está faltando e onde a diferença apareceu (ex.: entrou 100, foram 60 para a gôndola, vendeu 50, faltam 10).

### 6.2 Entrada cega e reposição cega
- O funcionário **não vê a quantidade esperada**. Ele conta de verdade e informa.
- Se errar a contagem **2 a 3 vezes**, o sistema marca **inconsistência**.
- A mesma lógica vale na reposição (depósito → gôndola).

### 6.3 Depósito e gôndola
- Depósito e gôndolas são **configuráveis**: local (corredor, prateleira, fileira, nível), conforme o tipo de comércio.
- **Cada produto** tem: local no depósito, local na gôndola, **mínimo e máximo**.
- **Gôndola chegou no mínimo →** gera **pedido de reposição** no app do repositor e avisa no painel do dono.
- **Máximo da gôndola** = o limite da prateleira; a reposição não pode ultrapassar.
- **Depósito chegou no mínimo →** **não repõe**. Gera **pedido de compra** (aviso de que está acabando), mostrado no painel do dono com o fornecedor do produto.

### 6.4 Fornecedores e pedido de compra
- Cadastro de fornecedor com nome, telefone/WhatsApp e e-mail. Cada produto tem um fornecedor.
- O pedido de compra é gerado quando o depósito chega no mínimo e pode ser **enviado ao fornecedor por e-mail ou WhatsApp com um clique** (ou automático).
- Envio automático por WhatsApp exige integração paga (API oficial). Plano inicial: e-mail automático e WhatsApp com um clique.

### 6.5 Validade
- Produto pode ter validade (obrigatória em farmácia). Avisos configuráveis: **90, 30 ou 15 dias antes**, recebidos no painel do dono.

### 6.6 PDV e caixa
- **Sem integração com maquininha.** O que for **bipado** e marcado como **pago** no PDV conta como venda e **dá baixa no estoque (gôndola)** na hora.
- **Vendas em tempo real** para o dono: quanto está vendendo/ganhando.
- **Fechamento de caixa:** o sistema calcula quanto deve ter no caixa; o valor físico contado precisa bater com o do aplicativo; se não bater, mostra a diferença.

### 6.7 Cadastro de produto (fluxo guiado, uma pergunta por tela)
1. Código (escanear com a câmera ou digitar) e nome.
2. Preços e unidade (preço de compra e de venda **obrigatórios, maiores que zero**; mostrar lucro por unidade e margem %; avisar se venda < compra).
3. Detalhes do tipo de comércio (seção 4).
4. Fornecedor (escolher ou criar na hora).
5. Depósito (local, mínimo, quantidade atual).
6. Gôndola (local, mínimo, máximo, quantidade atual).
7. Validade (se aplicável: data e avisos 90/30/15).
8. Conferir e salvar.
- Etapas 1–4 e o resumo já existem no app (simuladas). Etapas 5–7 são o **Prompt 2** (pendente).
- **Scanner:** lê EAN-13, EAN-8, UPC, Code 128 e QR Code, com a câmera. Opção de digitar. Os produtos usam **código de barras**, não QR.

---

## 7. DESIGN E EXPERIÊNCIA

- **Paleta (usar exatamente):** fundo `#0B1B3A` com degradê até `#071326` · azul `#2F8CFF` · verde-água `#2DE2C4` · texto `#FFFFFF` · texto secundário `#8FA3C2` · bordas/cartões `#1E3358` · erro `#FF5C6C`. Fonte **Inter**. Cantos de 16 a 24 px.
- **Logo:** ícone quadrado de cantos arredondados em degradê azul-marinho (`#16376B` → `#071326`), com **escudo claro** (antifurto) contendo **código de barras** (estoque) cortado por um **feixe de scanner** verde-água, e um **anel de 360°** em degradê verde-água → azul com abertura no topo e um ponto verde-água. Nome "OMNI SAFE 360" em uma linha (OMNI SAFE branco, 360 verde-água), Inter 700, com espaçamento entre letras; linha pequena "CONTROLE INTELIGENTE DE ESTOQUE".
- **Fundo:** brilho radial azul suave e textura sutil de pontos.
- **Padrões de tela:**
  - Fluxos em **etapas, sem rolagem vertical** nas telas de cadastro (altura `100dvh`, inclusive 320×568).
  - Indicador "Passo X de N" com barra em degradê; botões "Voltar" e "Continuar" (Continuar só ativa com a etapa válida).
  - **Teclado aberto:** conteúdo alinhado ao topo, cabeçalho encolhido, e os botões numa barra própria logo acima do teclado, **sem nunca cobrir campos ou caixas**.
  - Mobile: barra de navegação inferior (Início, Comércios, Alertas, Equipe, Conta). Computador/tablet (≥768 px): menu lateral e conteúdo centralizado (máx. ~1100 px); cadastros em cartão central de ~440–480 px.
  - Botões de ao menos 48–52 px, fontes de ao menos 16 px nos campos, áreas seguras do iPhone, `viewport-fit=cover`, `theme-color #0B1B3A`.
  - Linguagem simples, textos de ajuda curtos, erros claros em português.
- **App instalável (PWA):** manifest com nome "Omni Safe 360", `display: standalone`, ícones PNG 192/512, `apple-touch-icon` 180 e favicon (ver pendência na seção 11).

---

## 8. STACK E CÓDIGO ATUAL

- **Front-end:** React 19 + TanStack Start/Router + Vite + Tailwind 4 + TypeScript, zod, react-hook-form, `@zxing/browser` (scanner), vitest. Gerado e mantido pelo **Lovable** (sincroniza com o GitHub).
- **Estrutura:** `src/routes/index.tsx` (entrada e fluxo), `src/components/` (`Logo`, `StoreSetup`, `OwnerHome`, `StoreSpace`, `ProductArea`, `Scanner`, `ui/`).
- **Dados no front hoje:** comércios, produtos e fornecedores vivem **em memória** (estado do React) e **somem ao atualizar**. Nada disso usa banco ainda. Não usa `localStorage`. A única chamada externa é a busca de CEP (ViaCEP).
- **Chaves:** nenhuma chave secreta no código.

## 9. BANCO DE DADOS (SUPABASE) — ESTADO ATUAL

Projeto **`omnisafe-360-oficial`**, região São Paulo (sa-east-1), Postgres 17. Migrações aplicadas: `base_autenticacao_perfis_e_papeis`, `has_role_somente_para_o_proprio_usuario`, `comercios_fornecedores_produtos_variacoes`. **Todas as tabelas com RLS ligada; `anon` sem acesso.**

- **`profiles`** (id = auth.users.id): nome, email, telefone, avatar_url, created_at, updated_at. Cada pessoa vê/edita só o próprio.
- **`user_roles`**: user_id, role (`app_role`: `dono` | `gerente` | `repositor`). Pessoa só **lê** os próprios papéis; ninguém altera pelo app. Função `has_role(user, role)` (security definer; só responde para o próprio usuário).
- **Gatilho `handle_new_user`:** ao criar conta (Google ou e-mail), cria o perfil (usa `full_name`/`name`, `phone`, `avatar_url`/`picture`) e o papel `dono`.
- **`comercios`:** dono_id, tipo (`tipo_comercio`: mercado, farmacia, loja_roupas, material_construcao, pet_shop, autopecas), nome, documento_tipo (cnpj|cpf), documento (só dígitos), telefone, telefone_whatsapp, cep, rua, numero, sem_numero, complemento, bairro, cidade, uf, ativo. Único por (dono, documento). RLS: dono vê/cria/edita só os seus; **sem delete** (usar `ativo`).
- **`fornecedores`:** dono_id, nome, telefone, email, ativo. **Compartilhados entre os comércios do mesmo dono.** RLS por dono; sem delete.
- **`produtos`:** comercio_id, fornecedor_id (opcional, deve ser do mesmo dono), codigo_barras (único por comércio), nome, categoria, unidade, preco_compra (>0), preco_venda (>0), marca, detalhes (jsonb, por tipo de comércio), ativo. RLS via comércio do dono; sem delete.
- **`produto_variacoes`** (loja de roupas): comercio_id, produto_id, tamanho, cor, codigo_barras próprio (único por comércio). RLS via comércio do dono; delete permitido ao dono.

**Autenticação (Supabase Auth):** Google habilitado (Google Cloud em modo "Teste", sem logotipo para evitar verificação por enquanto) e e-mail/senha. Configurações recomendadas no painel: confirmar e-mail ligado, senha mínima 8 com maiúscula, minúscula e número, Site URL e Redirect URLs com o endereço publicado. O envio padrão de e-mail do Supabase tem limite baixo por hora (serviço de e-mail próprio será necessário no lançamento). "Leaked password protection" ainda desligado (aviso do Supabase).

**Tabelas ainda NÃO criadas (a desenhar e aprovar antes):** depósito/locais, gôndolas, saldos de estoque (depósito e gôndola), mínimos/máximos por produto, lotes e validades, movimentações (entrada, saída, reposição), contagens cegas e inconsistências, pedidos de reposição, pedidos de compra, vendas e itens de venda, sessões de caixa e fechamento, equipe (funcionários, códigos, PINs, bloqueio), alertas, perfil/ permissões do gerente.

## 10. INFRAESTRUTURA

- **Supabase:** projeto `omnisafe-360-oficial` (ref `bvwjprxfthhreuhovgbk`), organização "OmniSafe-360". Existe um projeto antigo `omnisafe-360` que **não deve ser usado**.
- **Publicação:** `https://mock-overlay-magic.lovable.app` (testar login sempre no endereço publicado ou em outra aba; a prévia dentro do Lovable pode bloquear o login Google). Para o que foi feito aparecer ali é preciso **Mesclar** (se houver rascunho) e **Publicar → Atualizar**.
- **GitHub:** `OmniSafe-360/mock-overlay-magic` (deve ser **privado**).
- **Google Cloud:** projeto próprio do Omni (OAuth tipo "Aplicativo da Web", callback `https://bvwjprxfthhreuhovgbk.supabase.co/auth/v1/callback`).
- Ferramentas do Claude no Supabase: acesso ao `omnisafe-360-oficial`. Sem acesso ao GitHub e ao Lovable do Omni.

---

## 11. ESTADO ATUAL E ROTEIRO

### Pronto e aprovado visualmente (front-end)
- Tela de entrada (abas Entrar / Criar conta, Google, senha forte com barra e regras).
- Cadastro de conta em 4 etapas, sem rolagem.
- "Esqueci minha senha" (tela de recuperar).
- Cadastro do comércio em 4 etapas (tipo com 6 cartões, documento CNPJ/CPF validado, CEP via ViaCEP, resumo e sucesso).
- Home do dono (resumo geral com dados de exemplo, cards de comércios, "+ Adicionar comércio", barra de navegação).
- Espaço do comércio (abas) e cadastro de produto em 5 etapas com scanner (parte 1), tudo **simulado em memória**.

### Em andamento / a verificar (não assumir como feito)
1. **Prompt A — Autenticação real por e-mail e senha** (criar conta sem logar direto, confirmar e-mail, entrar, esqueci senha, sessão, sair). Status: enviado? mesclado? publicado? Verificar no banco se existe conta com senha. Até aqui só existe conta criada pelo Google.
2. **Correções pequenas:** PNGs de ícone (`icon-192`, `icon-512`, `apple-touch-icon`, `favicon` em `public/`, hoje só existe `icon.svg`), remover "Açougue"/"Padaria" das categorias do Mercado, aviso de venda < compra e compra obrigatória.
3. **CEP geral de cidade:** quando o CEP não traz rua/bairro, mostrar cidade/UF e pedir rua e bairro direto (ajuste enviado).
4. **Teclado cobrindo "Este número tem WhatsApp"** na etapa 2 do comércio (ajuste de layout enviado).

### Próximas etapas (cada uma com teste)
- **B.** Ligar comércios, produtos, variações e fornecedores às tabelas já criadas (substitui o estado em memória; cada dono só vê o que é dele).
- **C.** Prompt 2 do produto: depósito, gôndola (local, mínimo, máximo), validade e avisos no painel do dono. Desenhar e aprovar as tabelas antes.
- **D.** Fornecedores completos e pedido de compra (e-mail/WhatsApp).
- **E.** Equipe: cadastrar funcionários, perfis, código + PIN, bloqueio.
- **F.** Modo do repositor: entrada cega e reposição (câmera/scanner).
- **G.** PDV: venda, baixa na gôndola, caixa e fechamento.
- **H.** Antifurto e painel em tempo real do dono (mapa de todos os comércios).
- **I.** Páginas de Termos de uso e Política de Privacidade (exigidas pelo Google para liberar o login ao público e verificar o app) e logotipo no Google Cloud.
- **J.** Serviço de e-mail próprio, auditoria final e testes em computador, tablet, Android e iPhone.

## 12. DECISÕES ABERTAS

1. Nome do app/modo do repositor.
2. Acesso do funcionário: código + PIN (proposta) foi aprovado?
3. Existe perfil de caixa separado?
4. Loja de roupas: confirmar variações com código de barras próprio (já assumido no banco) e fornecedores compartilhados entre comércios do mesmo dono (já assumido no banco).
5. Quantidade inicial de estoque no cadastro do produto e como será a primeira contagem (contagem cega inicial?).
6. Quais funções exatas o gerente pode acessar.
7. Envio de pedido por WhatsApp: com um clique (inicial) ou integração oficial automática (paga).

## 13. HISTÓRICO DAS PRINCIPAIS DECISÕES DO DONO

- Sistema para qualquer comércio com depósito → reduzido aos 6 tipos acima (açougue, padaria e "outro" saíram).
- Login: começou "somente Google" → agora **Google + cadastro normal por e-mail**; criar conta **nunca** loga direto.
- Cadastro de conta e de comércio em **etapas sem rolagem**.
- Primeiro prompt do Lovable (base visual) descartado; o início real foi a tela de entrada.
- A logo é **criada pelo Lovable**, seguindo a descrição desta seção 7 (o Claude não cria a logo para anexar).
- Banco de dados: no início "não gravar nada sem autorização"; depois autorizou usar o Supabase `omnisafe-360-oficial` e criar as tabelas de comércios, produtos e fornecedores com segurança ligada.
- Teste de tudo no celular (Android do dono) e no computador.
