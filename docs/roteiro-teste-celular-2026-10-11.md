# Roteiro de teste no celular — itens 29 e 30 do checklist

Para o dono fazer com calma, num celular de verdade, depois de **Publicar → Atualizar** no Lovable.
Marque cada passo: ✅ deu certo, ❌ deu errado (mande um print ao Claude dizendo o número do passo).

**Atualização A05 — 19/10/2026:** os passos 29.7–29.9 foram corrigidos para a regra atual. Sem internet, o Caixa mantém o carrinho, mas **não conclui uma nova venda**. Reabrir offline e recuperar um envio sem resposta são testes diferentes. Este ajuste não valida os demais passos nem comprova publicação ou teste físico.

## Antes de começar (no app do dono)
1. Abra o comércio de teste (ex.: Supermercado União) → **Equipe**.
2. Escolha um funcionário (ou crie um) e ligue **Caixa no celular**. Deixe "O que ele faz?" em **Recebe e repõe**.
3. No quadro **Seu PIN do caixa**, crie o seu PIN (4 números, não vale 1111 nem 1234).
4. Toque no funcionário e deixe o **QR Code** aberto na tela (o celular do teste vai ler).
5. Tenha 2 ou 3 produtos com código de barras na mão, com quantidade na gôndola.
6. Use somente comércio, funcionário e turno de teste, sem clientes reais. Anote o número de vendas e o saldo inicial dos produtos; deixe saldo suficiente para as duas vendas previstas. Não misture o teste com vendas de outros operadores. Pix neste roteiro é uma forma de pagamento de teste: não transfira dinheiro real. Não limpe dados nem desinstale o app com carrinho ou envio pendente.

## Item 29 — Caixa no celular
No celular do teste, abra a câmera e leia o QR Code (ou abra o endereço do app em `/funcionario` e digite o código de 6 números).

| # | Faça | O certo é |
|---|------|-----------|
| 29.1 | Crie o PIN do funcionário (4 números, duas vezes) | Abre "Olá, Nome!" com o botão **Caixa** |
| 29.2 | **Caixa** → troco da gaveta R$ 50 → **Abrir caixa** | Abre a tela de vender com a câmera ligada |
| 29.3 | Aponte a câmera para o código de um produto | Bip + vibração; o produto entra na lista com o preço certo |
| 29.4 | Aponte de novo para o mesmo produto (tire e volte) | A quantidade vira 2 (não cria outra linha) |
| 29.5 | **Receber** → **Dinheiro** → dê um valor maior | Mostra o troco certo; **Finalizar venda** → "Venda finalizada" |
| 29.6 | **Mandar comprovante no WhatsApp** | Abre o WhatsApp com o texto da venda |
| 29.7 | Volte ao Caixa → **Próxima venda** → adicione um produto conhecido. Ligue o **modo avião**, desligue também Wi-Fi e dados móveis e toque em **Receber** | O carrinho permanece com produto, quantidade e valor. Mostra orientação para conectar à internet; não abre a conclusão de uma nova venda, não mostra "Venda finalizada" e não deve haver nova venda ou baixa no dono. A apresentação do aviso pode variar conforme o momento em que a perda de rede é detectada |
| 29.8 | Reconecte, mantenha o mesmo carrinho e toque em **Receber** → **Pix** → **Finalizar venda** | Confere o estoque novamente e só mostra "Venda finalizada" após o servidor confirmar. Reconectar, sozinho, não finaliza o carrinho iniciado offline. Se o saldo mudou ou houve recusa, conserve o carrinho e registre o aviso; não force a venda |
| 29.9 | No app do dono, conectado à internet, abra **Vendas** do mesmo comércio/turno de teste e confira também o produto | Sem outras vendas no teste, aparecem exatamente 2 novas vendas confirmadas em relação à anotação inicial (29.5 e 29.8). O estoque da gôndola baixou somente pelas quantidades dessas vendas; a tentativa offline do 29.7 não criou outra venda ou baixa |
| 29.10 | No celular: **Menu** → **Tirar dinheiro da gaveta** R$ 10 com o **seu** PIN | Registra a retirada |
| 29.11 | Modo avião ligado → tente tirar dinheiro de novo | Mensagem "Sem internet. O dinheiro tirado não foi registrado…" (não fala em venda) |
| 29.12 | Desligue o modo avião → **Menu** → **Fechar o caixa**, conte a gaveta | Mostra "Bateu certinho" ou "Faltaram/Sobraram R$ X" |
| 29.13 | No app do dono → **Vendas** → **Caixas do celular** | O fechamento aparece com o mesmo resultado |
| 29.14 | Deixe o celular parado 5 minutos fora do app e volte | Pede o PIN por cima; ao digitar, volta exatamente onde estava |

### 29.7A — fechar e reabrir com o carrinho offline (R05)

Faça entre 29.7 e 29.8, em Android e iPhone, com o app preparado online e o mesmo turno já aberto:

1. Anote produto, quantidade e total do carrinho. Sem internet, feche e reabra pelo ícone; digite o PIN. O Caixa deve recuperar o carrinho, sem abrir outro turno. A primeira instalação e preparação do app exigem conexão; apenas lembrar o PIN não basta.
2. Tente **Receber** ainda offline: continua exigindo conexão, sem nova venda ou baixa. Se o acesso/cache não puder ser recuperado, registre a tela e reconecte; não apague dados para tentar passar no teste.
3. Reconecte e continue pelo passo 29.8, sem recriar o carrinho. A confirmação e a baixa são conferidas no 29.9.

### Envio sem resposta — teste diferente de começar uma venda offline

Se uma venda foi enviada online e ficou em **Venda sem confirmação**, ela pode já estar no servidor. Use **Conferir envio**, quando não houver envio em andamento, e conserve o mesmo pedido/ID; o reenvio automático também pode confirmar esse pedido quando a conexão voltar. Não crie outra venda igual para contornar a pendência. Uma resposta incerta não prova que a venda deixou de existir.

Provocar perda de resposta deve ser feito somente em cenário técnico controlado com dados fictícios, sem interromper pagamento real. Os testes existentes verificam conservação do ID/conteúdo e resposta repetida. No aparelho, se a pendência ocorrer, anote o resultado e confira no dono uma única venda e baixa. O intervalo de ~20 segundos é uma tentativa periódica de reenvio já existente, não um prazo garantido nem autorização para concluir novas vendas offline.

Registre aparelho, sistema, navegador, versão do app e uso pelo ícone; marque separadamente bloqueio offline, preservação/reabertura do carrinho, conclusão online e eventual recuperação de envio. Falha de armazenamento ou aviso para não fechar o app exige interromper o roteiro e chamar o dono/suporte; não fechar à força para tentar recuperar dados.

## Item 30 — Omni Operação (faça no Android **e** no iPhone)
Antes: no app do dono, faça um **pedido** para um fornecedor e marque como enviado (WhatsApp ou copiar texto).

| # | Faça | O certo é |
|---|------|-----------|
| 30.1 | **Instalar o app no celular** (iPhone: Safari → Compartilhar → Adicionar à Tela de Início) | Aparece o ícone "Omni Operação" |
| 30.2 | Abra pelo ícone | Pede o PIN |
| 30.3 | **Receber mercadoria** → abra o pedido | Mostra os produtos **sem** a quantidade pedida |
| 30.4 | Bipe um produto e conte um número **diferente** do pedido → **Terminei** | Pede "Conte de novo" (a contagem anterior some) |
| 30.5 | Conte de novo o mesmo número | Fica conferido; no dono, o pedido mostra "Recebido por…" e o depósito aumentou |
| 30.6 | No dono, durante uma contagem em andamento, abra o pedido | Mostra quem está conferindo e pede para aguardar |
| 30.7 | **Repor gôndola** → escolha um produto → conte a prateleira | O app diz quanto buscar no depósito |
| 30.8 | Coloque e confirme | "Pronto!"; no dono, gôndola subiu e depósito desceu |
| 30.9 | **Conferir depósito** → conte um produto | "conferido. Obrigado!" ou pede nova contagem |
| 30.10 | Feche o app no meio de uma conferência e abra de novo | A conferência continua em "Contagem 2 de 3" |
| 30.11 | **Registrar perda** → produto → onde → **Venceu** → quantidade | "Registrado! O dono vai confirmar." |
| 30.12 | No dono → **Diferenças** | A perda aparece em "Perdas para confirmar" |
| 30.13 | Na tela inicial, ligue o modo avião por 1 minuto | A tela continua, com aviso amarelo "Sem conexão com o Omni agora" |

## Itens corrigidos hoje que dá para conferir junto
- Cadastro de comércio: digite um CEP, depois troque para um CEP inexistente (ex.: 99999-999) → o endereço antigo some.
- Criar conta com o seu próprio e-mail → "Este e-mail já está cadastrado. Tente entrar."
- Pedido com caixa de R$ 10,00 com 12 unidades → o total salvo é R$ 10,00 (não R$ 9,96).
- Roupa vendida sem tamanho/cor → em Vendas aparece "Vendido sem tamanho/cor: diga qual saiu".
