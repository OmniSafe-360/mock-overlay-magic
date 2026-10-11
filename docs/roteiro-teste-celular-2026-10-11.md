# Roteiro de teste no celular — itens 29 e 30 do checklist

Para o dono fazer com calma, num celular de verdade, depois de **Publicar → Atualizar** no Lovable.
Marque cada passo: ✅ deu certo, ❌ deu errado (mande um print ao Claude dizendo o número do passo).

## Antes de começar (no app do dono)
1. Abra o comércio de teste (ex.: Supermercado União) → **Equipe**.
2. Escolha um funcionário (ou crie um) e ligue **Caixa no celular**. Deixe "O que ele faz?" em **Recebe e repõe**.
3. No quadro **Seu PIN do caixa**, crie o seu PIN (4 números, não vale 1111 nem 1234).
4. Toque no funcionário e deixe o **QR Code** aberto na tela (o celular do teste vai ler).
5. Tenha 2 ou 3 produtos com código de barras na mão, com quantidade na gôndola.

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
| 29.7 | Ligue o **modo avião** e faça outra venda (Pix) | Faixa amarela "Sem internet"; a venda finaliza e fica "guardada no celular" |
| 29.8 | Desligue o modo avião e espere ~20 segundos | O aviso de vendas guardadas some (a venda subiu) |
| 29.9 | No app do dono → **Vendas** | As 2 vendas aparecem; o estoque da gôndola baixou |
| 29.10 | No celular: **Menu** → **Tirar dinheiro da gaveta** R$ 10 com o **seu** PIN | Registra a retirada |
| 29.11 | Modo avião ligado → tente tirar dinheiro de novo | Mensagem "Sem internet. O dinheiro tirado não foi registrado…" (não fala em venda) |
| 29.12 | Desligue o modo avião → **Menu** → **Fechar o caixa**, conte a gaveta | Mostra "Bateu certinho" ou "Faltaram/Sobraram R$ X" |
| 29.13 | No app do dono → **Vendas** → **Caixas do celular** | O fechamento aparece com o mesmo resultado |
| 29.14 | Deixe o celular parado 5 minutos fora do app e volte | Pede o PIN por cima; ao digitar, volta exatamente onde estava |

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
