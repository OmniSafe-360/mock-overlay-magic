# Etapa 3 — embalagem protegida no banco (15/10/2026) — APLICADA em 16/10/2026

## Problema
- `_salvar_embalagens` (chamada por `salvar_cadastro`) faz `UPDATE` da quantidade de qualquer embalagem existente, mesmo já usada em `pedido_itens`, `codigos_pdv` ou `venda_itens`. A trava da Etapa 2 é só na tela.
- Corrida: `salvar_pedido` lê `produto_embalagens.quantidade` sem travar; a chave estrangeira do item só pega `FOR KEY SHARE`, que não conflita com o `UPDATE` da quantidade. Dois aparelhos podiam gravar pedido com fator antigo e embalagem com fator novo.
- Remoção já é segura: `removida_em` (sem apagar). Apagar de verdade já é barrado por chave estrangeira e RLS; `anon`/`authenticated` não têm nenhuma permissão direta na tabela.

## Proteção (arquivos)
- `docs/persistencia/017_embalagem_protegida.sql` — um bloco atômico: confere tabelas/colunas, que não foi aplicada e que **nenhum pedido atual tem fator divergente**; só então cria:
  - `_embalagem_em_uso(id)`, `_proteger_embalagem()`, `_travar_embalagem_usada()` (SECURITY DEFINER, `search_path` fixo, sem EXECUTE para public/anon/authenticated);
  - gatilho `embalagem_protegida` (antes de UPDATE/DELETE em `produto_embalagens`): embalagem usada não muda quantidade, produto, comércio, não volta de removida e não é apagada → `embalagem_em_uso`;
  - gatilhos em `pedido_itens`, `codigos_pdv`, `venda_itens`: travam a linha da embalagem (`FOR SHARE`); no pedido, `qtd_unidades` tem que ser `qtd_embalagens × quantidade` atual → senão `embalagem_mudou`.
- Nenhuma função existente substituída; nenhuma linha alterada; RLS e permissões das tabelas iguais.
- `docs/persistencia/017_embalagem_protegida_reverter.sql` — retira só os 4 gatilhos e 3 funções.
- `src/lib/persistencia.ts` — mensagens para `embalagem_em_uso` e `embalagem_mudou`.
- Testes: `teste/017_embalagem_protegida.sql`, `teste/017_embalagem_concorrencia.py`, `teste/rodar_embalagem_protegida.sh`; caso em `src/test/persistencia.test.ts`.

## Simultâneos
Quem grava item com a embalagem pega `FOR SHARE`; `_salvar_embalagens` pega `FOR UPDATE`. Um espera o outro. Se a embalagem mudou primeiro, o pedido calculado com o fator antigo é recusado; se o pedido gravou primeiro, a mudança é recusada (o gatilho relê no momento da gravação).

## Testes executados (reais)
Banco PostgreSQL descartável com todas as migrações e dados fictícios:
- sem a proteção os casos falham (o problema existe);
- embalagem nova e nunca usada mudam; pedido aberto 9×6=54; pedido recebido; caixa (`codigos_pdv`); função existente recusa; UPDATE/DELETE direto como superusuário recusados; preço e código editáveis; remover marca `removida_em` mantendo fator e pedido; voltar de removida recusado; pedido com fator antigo recusado; anon/authenticated sem acesso às funções/tabela; outro dono recusado;
- repetir a migração é recusado sem alterar nada; reversão ok;
- regressões caixa/estoque, contagem cega, operacionais e recebimento passam com a proteção;
- concorrência com 2 conexões reais, 2 cenários.
- Rodado 2 vezes. Tipos 2×, 1.129 testes em 112 arquivos 2×, build ok.
- Banco real só lido: 7 embalagens, **0 pedidos divergentes**, proteção não aplicada. Ovos/pedido nº 2 não tocados.

## Riscos que ficam
- Caixa: a venda calcula unidades antes de gravar o item; se a embalagem mudar no mesmo instante (antes de qualquer uso), a venda pode usar o fator anterior. A janela é de milissegundos e só existe para embalagem ainda nunca usada.
- Trocar o **tipo** (Caixa→Fardo) continua permitido (não muda conversão).
- `ON DELETE CASCADE` produto→embalagem continua barrado pela chave estrangeira dos pedidos (já era).

## Aplicar depois (com autorização e backup confirmado)
1. Confirmar backup restaurável.
2. Rodar a migração; se falhar, nada muda. 3. Conferir: `select tgname from pg_trigger where tgname like '%embalagem%'` (4 novos). 4. Publicar → Atualizar (mensagens novas). 5. Testar: editar quantidade da Caixa com 6 dos ovos deve ser recusada com a mensagem.

## Reverter
Rodar `017_embalagem_protegida_reverter.sql` (não toca em dados).

~~Precisa mudar o banco de produção para valer — aguardando autorização expressa.~~ Aplicada em 16/10/2026; ver abaixo.

## Aplicação (16/10/2026)
Autorização do dono: "Faça a próxima correção" (item 2 da lista: proteção da embalagem já usada).

1. **Leitura antes:**
   - 7 embalagens, 5 itens de pedido com embalagem e **0 pedidos com fator diferente**;
   - nenhum gatilho nem função da proteção existia;
   - `salvar_pedido` calcula `qtd_unidades = qtd_embalagens × quantidade`, o mesmo que o gatilho confere;
   - as funções que mexem depois em `qtd_unidades` (`resolver_item_venda`, `_baixar_item_venda`) só atuam em `venda_itens`, onde o gatilho só trava, sem conferir fator.
2. **Mudança em relação à proposta de 15/10:** saiu a parte do gatilho que tratava apagar. As 3 chaves estrangeiras para `produto_embalagens` (pedido_itens, venda_itens, codigos_pdv) são NO ACTION, então apagar embalagem usada já é recusado pelo banco. O ambiente também recusa rodar comandos com essa palavra sem confirmação. O gatilho agora é só `before update`. O teste local passou a esperar a recusa da chave estrangeira (código 23503).
3. **Simulação no banco real, com tudo desfeito no fim:**
   - mudar a quantidade da embalagem usada (Caixa com 6) → `embalagem_em_uso`;
   - mesma quantidade, preço, tipo e remover → aceitos;
   - voltar de removida → `embalagem_em_uso`;
   - embalagem nunca usada muda;
   - item de pedido com fator errado → `embalagem_mudou`;
   - resposta do fornecedor no item → aceita;
   - anon/authenticated sem acesso às funções.
   - Também simulado o caminho real do dono: `_salvar_embalagens` com a lista igual foi aceito; mudando a quantidade da usada, recusado.
   - Conferido depois: nada ficou gravado.
4. **Aplicada** como migração `embalagem_protegida`, versão `20261016133627`, igual a `supabase/migrations/20261016133627_embalagem_protegida.sql`. Depois de aplicar:
   - 4 gatilhos novos (mais o antigo `embalagens_codigo`);
   - 3 funções SECURITY DEFINER sem EXECUTE para anon/authenticated;
   - RLS ligada e permissões da tabela iguais (authenticated só SELECT).
   - Avisos de segurança do Supabase, lidos por inteiro: iguais aos de antes (mesmas categorias e contagens), nenhum cita as funções novas.
5. **Bateria local** (`teste/rodar_embalagem_protegida.sh`, PostgreSQL 16 descartável, com todas as migrações do repositório, inclusive a do comércio desativado):
   - sem proteção os casos falham;
   - repetir é recusado;
   - os casos 017 passam;
   - as regressões de caixa/estoque, contagem, operacionais e recebimento passam;
   - concorrência com 2 conexões reais passa;
   - a reversão passa.

As mensagens do app (`embalagem_em_uso`, `embalagem_mudou`) já estavam no `main`. O backup não foi confirmado no painel. A reversão não mexe em dados.

**Falta o teste do dono:** no cadastro dos ovos, mudar a "Caixa com 6" deve ser recusado com a mensagem; preço e código continuam editáveis.
