# Fiado no Caixa do celular — fonte da verdade (plano por etapas)

Pedido do dono em 11/10/2026: analisar o fiado no Caixa do celular de ponta a ponta,
ter cadastro de clientes e um lugar para o funcionário consultar quanto cada cliente deve,
fácil de entender, usando o que já existe, em etapas pequenas.

**Regras desta frente (valem para todas as etapas):**
- Consultar este arquivo antes e depois de cada etapa; marcar `[x]` com data e o que foi feito.
- Uma etapa por vez. Mexer **somente** no Caixa do celular (`CaixaCelular.tsx`, `src/lib/caixa.ts`,
  `src/lib/fiado.ts`) e nas funções de banco do caixa/fiado citadas aqui. Nenhuma outra parte do sistema.
- Proteger o que já funciona: venda, troco, Pix/cartão, fila sem internet, cancelamento com PIN,
  sangria, fechamento, comprovante, fiado no app do dono (`PainelFiado.tsx`). Nenhum teste existente pode quebrar.
- Função nova ou tabela nova no banco só com aprovação escrita do dono (a etapa diz quando precisa).
- Antes de publicar: tipos e testes completos duas vezes. Banco: comparar com a versão real, simular, sem DELETE/DROP.
- Registrar em `CLAUDE.md` e informar se precisa **Publicar → Atualizar**.

---

## 1. Como está hoje (análise ponta a ponta)

| Parte | Situação hoje |
|---|---|
| Vender no fiado | ✅ Em "Receber", botão **Fiado** abre a lista de clientes; escolhe ou cria "Cliente novo" (nome + telefone) e o valor que falta vai para a conta. |
| Cliente novo | ⚠️ Só é criado **dentro de uma venda**. Não há lugar no caixa para cadastrar cliente sem vender. |
| Lista de clientes no caixa | ⚠️ `caixa_clientes_fiado` devolve só nome e telefone. **O funcionário não vê quanto cada um deve.** |
| Consultar dívida no caixa | ❌ Não existe. Só o dono vê (aba Vendas → Fiado). |
| Receber pagamento do fiado no caixa | ❌ Só o dono dá baixa (`receber_fiado`, exige login do dono). Cliente que paga no balcão não tem como ser registrado pelo funcionário — e o dinheiro entra na gaveta sem constar no fechamento. |
| Limite de crédito / cliente bloqueado | ❌ Não existe. Qualquer cliente pode comprar fiado sem limite. |
| Editar nome/telefone | ⚠️ Só no app do dono. |
| Cancelar venda fiado | ✅ Com PIN do dono; o valor sai da conta, sem virar crédito (A5). |
| Sem internet | ✅ Lista de clientes usa cópia guardada; cliente novo vai junto com a venda guardada. Sem saldo na cópia. |
| Comprovante | ✅ WhatsApp do cliente já vem preenchido no fiado. |
| Fechamento do caixa | ✅ Mostra "Fiado" separado; não conta como dinheiro na gaveta. |
| App do dono | ✅ Lista quem deve, há quanto tempo, Recebeu, Cobrar pelo WhatsApp, histórico. |

## 2. Fluxo correto desejado (coerente)

```text
Caixa (menu ☰)
 ├─ Clientes do fiado            ← NOVO: lista com quanto cada um deve
 │   ├─ procurar por nome/telefone
 │   ├─ Cadastrar cliente        ← NOVO: sem precisar vender
 │   └─ abrir cliente → deve R$ X, desde quando, últimas compras/pagamentos
 │        └─ Recebeu pagamento   ← NOVO: dinheiro/Pix/cartão, entra no fechamento
 └─ Vender → Receber → Fiado
      └─ lista mostra quanto cada cliente já deve e quanto vai ficar devendo
```

Regras do fluxo:
1. O funcionário **vê** o saldo; quem decide perdoar/apagar continua sendo só o dono.
2. Pagamento recebido no caixa **não pode passar do que o cliente deve** (mesma regra de `receber_fiado`).
3. Pagamento em dinheiro recebido no caixa **entra no "deveria ter" da gaveta** no fechamento; Pix/cartão aparecem separados.
4. Repetir o envio (internet caiu) **não registra o pagamento duas vezes** (id gerado no celular, como nas vendas).
5. Sem internet: consulta mostra o saldo da última cópia com aviso "valores da última atualização";
   receber pagamento **precisa de internet** (evita saldo errado).
6. O app do dono continua igual e passa a mostrar quem recebeu (funcionário ou dono).

## 3. Etapas (uma de cada vez)

- [x] **F1 — Saldo na lista do fiado (banco, só leitura).** Alterar `caixa_clientes_fiado` (função existente,
  a partir de `pg_get_functiondef`) para devolver também `deve` e `desde`. Mesma chave/permissões; sem tabela nova.
  Testes: saldo = compras − pagamentos − cancelamentos, nunca negativo; outro comércio recusado.
- [ ] **F2 — Mostrar o saldo ao vender fiado (tela).** Na janela Fiado do "Receber": cada cliente com
  "Deve R$ X" (ou "Em dia") e, ao escolher, "Vai ficar devendo R$ Y". Cópia sem internet guarda o saldo com aviso.
  Não muda a venda nem a fila.
- [ ] **F3 — "Clientes do fiado" no menu do caixa (tela, só consulta).** Lista ordenada por quem deve mais,
  busca, total a receber, cliente com mais de 30 dias em amarelo (mesma regra de `src/lib/fiado.ts`).
  Detalhe: saldo, desde quando, telefone. Reaproveitar `contasFiado`/`resumoFiado`/`haQuantoTempo`.
- [ ] **F4 — Histórico do cliente no caixa (banco + tela).** Precisa de **função nova** de leitura pela chave do
  caixa (`caixa_cliente_fiado_historico`) — **aguarda aprovação do dono**. Últimos movimentos sem mostrar dados de outros clientes.
- [ ] **F5 — Cadastrar cliente no caixa sem vender.** Precisa de **função nova** `caixa_salvar_cliente_fiado`
  (pela chave, função Caixa; mesmas validações de nome/telefone de `salvar_cliente_fiado`; repetir não duplica)
  — **aguarda aprovação do dono**. Editar nome/telefone continua só no dono (decisão a confirmar).
- [ ] **F6 — Receber pagamento do fiado no caixa.** Precisa de **função nova** `caixa_receber_fiado`
  (chave + turno aberto; grava em `fiado_movimentos` com `funcionario_id` e o turno; não passa do que deve;
  id do celular). Ajustar `_resumo_turno`/`caixa_fechar` para somar o dinheiro recebido no fiado ao esperado da gaveta
  — **aguarda aprovação do dono** (mexe no fechamento: maior cuidado; testar fechamento antigo igual).
- [ ] **F7 — Fechamento e app do dono mostram os recebimentos.** Fechamento: linha "Recebido do fiado".
  App do dono: histórico diz "Pagou em dinheiro · no caixa (Maria)". Sem mudar as regras atuais do dono.
- [ ] **F8 — (opcional, decisão do dono) Limite de fiado por cliente / cliente bloqueado.** Exige coluna nova
  em `clientes_fiado` — só se o dono pedir.

## 4. Decisões abertas para o dono

1. Aprovar as funções novas de F4, F5 e F6 (sem tabela nova; usam `clientes_fiado` e `fiado_movimentos`).
2. Funcionário pode editar nome/telefone do cliente? (sugestão: não, só o dono).
3. Quer limite de fiado por cliente (F8)?

## 5. Registro

- 11/10/2026: análise e plano criados. Nenhum código ou banco alterado.
- 12/10/2026: **F1 feita** — `caixa_clientes_fiado` (a partir da versão do banco) devolve também `deve` (compras − pagamentos − cancelamentos, nunca negativo) e `desde` (só quando deve). Mesma chave, SECURITY DEFINER, search_path e permissões conferidos depois. Campos antigos iguais: o app atual continua funcionando. Sem tela nova; não precisa Publicar. Não deu para simular com rollback antes (o ambiente aplica direto). Próxima: **F2**.
