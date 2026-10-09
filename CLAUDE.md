# Instruções para o Claude — Omni Safe 360

**Antes de qualquer ação, leia `docs/FONTE_DA_VERDADE.md`** (seções 1 e 2 primeiro) e confira cada decisão contra ela. Se algo contradisser o documento, vale o documento, a não ser que o dono diga o contrário por escrito.

## Como trabalhar (combinado com o dono)

- O dono não é programador: fale em português simples, sem jargão.
- **Desde 09/10/2026 o Claude executa direto no GitHub e no Supabase** (decisão do dono), **uma coisa de cada vez**. Antes de publicar: rodar `npx tsc --noEmit` e `npx vitest run`, simular no banco com `begin … rollback` e reler a mudança. O Lovable continua sendo usado pelo dono para o visual.
- O Claude **mescla o pull request no `main`** depois de verificar (o dono autorizou em 09/10/2026) e avisa o dono para **Publicar → Atualizar** no Lovable.
- 09/10/2026: o dono decidiu **primeiro ir arrumando e testar mais à frente**. O Claude continua verificando cada mudança (tipos, testes, simulação no banco) e anota o que fica para o dono testar.
- Banco (Supabase `omnisafe-360-oficial`, ref `bvwjprxfthhreuhovgbk`): tabela nova só com desenho aprovado pelo dono; RLS sempre ligada.
- Git: nunca reescrever histórico publicado (sem force push, rebase ou squash). O branch `main` sincroniza com o Lovable: mantê-lo sempre funcionando.
- **Haverá um segundo app, para funcionários**: receber mercadoria de fornecedores (entrada cega) e repor gôndola. Todo desenho de banco e de tela deve servir a esse app também (ver seções 5 e 6.2 da fonte da verdade).
- O teste `src/test/scanner.test.tsx` às vezes falha só quando roda junto com todos (sensível a tempo); sozinho passa. Não é erro do app.

## Decisões registradas depois da versão 1.0 do documento

- 08/10/2026: o dono decidiu **manter o repositório GitHub público** (contraria a seção 10, por decisão escrita do dono).
- 08/10/2026: o Claude agora tem acesso ao GitHub, ao Lovable e ao Supabase, mas a regra 3 continua: o dono é quem cola os prompts no Lovable.
- Busca de CEP usa ViaCEP e, como reserva, BrasilAPI (seção 8 cita só ViaCEP).
- 09/10/2026: o Lovable criou sozinho (sem desenho aprovado) as tabelas de estoque: locais, produto_areas, contagens, lotes, saldos, movimentos, codigos_barras, operacoes, e as funções salvar_cadastro/salvar_produto/resolver_pendencia. Produto e variações só são gravados por essas funções. Revisado pelo Claude (seguro). **O dono decidiu manter tudo como o Lovable fez**, inclusive: variação de roupas com código de barras e quantidade obrigatórios; avisos de validade 30/60/90 dias (em vez de 90/30/15); área "venda" no lugar de gôndola.
- 09/10/2026: corrigido fornecedor com telefone (ia com máscara; o banco só aceita números).
- 09/10/2026: **preço pela margem** = "quanto quero ganhar em cima da compra" (ex.: compra R$ 10,00 + 30% = venda R$ 13,00). O quadro do preço mostra "Lucro por unidade" e o campo "Quero ganhar %"; a antiga "Margem %" (lucro ÷ venda) saiu da tela. Decisão do dono. Regras em `src/lib/preco.ts`.
- 09/10/2026: **lembrar a última escolha** — produto novo começa com unidade, categoria, fornecedor, local do depósito, local da área de venda e validade (ligada/avisos) do último produto cadastrado no mesmo comércio. Nunca copia código, nome, preços, detalhes, quantidades, mínimos e máximos. Regras em `src/lib/ultimaEscolha.ts`.
- Etapa B1 (comércios no banco) testada e aprovada pelo dono. Prompt A aprovado, exceto "Esqueci minha senha", que falhou por limite de e-mails do Supabase (refazer).
