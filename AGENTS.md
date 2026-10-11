<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Product saves go through the single DB function salvar_cadastro (product + pending splits in one transaction); a send with no response is retried with the exact same request and id before any new form data is sent, so retries never duplicate.
- Loaded product/supplier IDs are database UUIDs. Current quantities come from saldos; contagens only marks an initial count. Unknown quantities stay null. Inventory mutations must insert a permanent operacoes record in the same transaction: the reader checks this revision to reject mixed snapshots. Product/order requests are stored before sending and recovered per user, commerce and module (see docs/base-consolidada.md).

## Plano obrigatório de continuidade (pedido do dono em 11/10/2026)

- Antes de cada tarefa, leia `docs/FONTE_DA_VERDADE.md` (seção 0), o histórico recente em `CLAUDE.md`, `docs/CHECKLIST_PONTA_A_PONTA.md` e, quando relacionado, `docs/checklist-funcional-2026-10-11.md`. Confira o `main` atual antes de escolher a próxima correção.
- A fonte da verdade contém as regras; o checklist ponta a ponta contém etapas, pendências, critérios de conclusão e a próxima tarefa. O checklist original mantém os números 1–30 e seu histórico. Não reabra item entregue nem crie outra fonte concorrente.
- Uma correção por vez, em um PR. Preserve os fluxos existentes; função de negócio nova ou tabela nova exige o desenho autorizado pelo dono. Não altere dados de teste/reais sem confirmar a lista concreta quando a tarefa exigir autorização.
- Antes de publicar, `npx tsc --noEmit` e `npx vitest run`, ambos duas vezes. Não esconda falhas dos testes. Alteração de banco exige comparar a função real com o arquivo, simular `begin … rollback` sem a palavra proibida pelo dono no SQL de simulação, salvar a migração e verificar RLS/`operacoes`.
- Atualize o registro do item/etapa e `CLAUDE.md`; atualize a fonte da verdade se mudar etapa/regra e o checklist antigo quando aplicável. Distinga corrigido no código, publicado e validado pelo dono. Sem resultado do teste real, registre “pronto, falta o teste do dono”.
- Mescle pelo PR sem reescrever histórico e informe se precisa **Publicar → Atualizar** no Lovable. Mudança só de documentação não exige atualizar o app. Fale com o dono em português simples.
