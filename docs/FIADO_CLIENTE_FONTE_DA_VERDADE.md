# Fiado do cliente — fonte da verdade (12/10/2026)

Pedido do dono: ao compartilhar o fiado pelo WhatsApp, mandar algo mais completo: dívida total, datas e horários das compras e pagamentos, avisos. O cliente cria um PIN e entra numa página para ver os próprios débitos. Tem que ser fácil para o cliente entender. **Sem mexer no núcleo nem em outras partes do sistema.**

## Hoje
- Dono: "Cobrar pelo WhatsApp" em `PainelFiado` manda só uma frase com o valor.
- Caixa: comprovante da venda (não fala do total devido).

## Como vai funcionar (para o cliente)
1. O dono (ou o caixa) toca **Compartilhar com o cliente**. O WhatsApp abre com um resumo:
   - nome do comércio, "Você deve R$ X", desde quando, últimas compras/pagamentos com data e hora;
   - "Veja tudo aqui: {link}".
2. No primeiro acesso, o cliente confirma os **4 últimos números do telefone** cadastrado e **cria um PIN de 4 números** (recusa 1111, 1234…).
3. Depois, só o PIN. A página mostra, em letras grandes:
   - **Total que você deve** e desde quando;
   - lista simples: "Comprou · 10/10 às 18:42 · R$ 23,50 (venda nº 41)" com os itens; "Pagou · 11/10 às 09:10 · R$ 20,00 · Pix";
   - limite (se o dono definiu) e quanto ainda pode comprar;
   - telefone/WhatsApp do comércio para falar com o dono.
4. **Avisos** dentro da página (sem e-mail/SMS automático nesta frente): "Nova compra em 12/10", "Pagamento recebido", "Dívida há mais de 30 dias". O WhatsApp é sempre mandado pelo dono/caixa com um toque (não há envio automático).

O cliente **só vê**; não paga nem muda nada pela página.

## Segurança
- Link secreto por cliente (64 letras), como o link do pedido do fornecedor. Dono pode **gerar novo link** (o antigo para de valer) e **zerar o PIN**.
- PIN guardado embaralhado (bcrypt), ninguém lê. 5 erros travam 15 min.
- A página só mostra dados daquele cliente; nada de estoque, preço de compra ou outros clientes.

## Etapas (uma por vez, cada uma com aprovação)
- [x] (12/10/2026, aprovado e aplicado) **P1 Banco — acesso do cliente**: `fiado_acessos` (cliente, link, pin_hash, tentativas, trava, criado/último acesso); RLS ligada, sem leitura direta. Funções: `fiado_cliente_link` (dono/caixa obtém ou cria o link), `fiado_novo_link` e `fiado_zerar_pin` (só dono), `fiado_publico_estado(link)` (novo/pin/inválido), `fiado_publico_entrar(link, final_tel, pin)`, `fiado_publico_extrato(link, sessão)` (só leitura).
- [x] (12/10/2026) **P2 Página do cliente** `/fiado/$link`: criar PIN, entrar, extrato fácil (total, lista com data e hora, itens da compra, limite, contato). Mobile primeiro.
- [x] (12/10/2026) **P3 Mensagem completa no WhatsApp**: substituir o texto simples de "Cobrar pelo WhatsApp" por resumo + link; mesmo botão no "Clientes do fiado" do caixa.
- [x] (12/10/2026) **P4 Avisos na página**: faixa com novidades desde o último acesso e dívida antiga.
- **P5 Controles do dono**: na conta do cliente, "Gerar novo link", "Zerar PIN do cliente", "Último acesso do cliente".

## Não muda
Vendas, caixa, fiado (cálculo, limite, cancelamento), estoque e demais módulos. Nenhum dado real alterado sem lista confirmada.
