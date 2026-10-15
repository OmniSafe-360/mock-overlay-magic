# Etapa 3 — embalagem protegida no banco (15/10/2026) — PREPARADA, NÃO APLICADA

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

**Precisa mudar o banco de produção para valer — aguardando autorização expressa.**
