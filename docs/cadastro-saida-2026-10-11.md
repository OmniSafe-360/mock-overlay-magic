# E2.1 — sair do primeiro cadastro e trocar a conta

Correção pedida pelo dono com o print `71820.png`, em **11/10/2026**, sobre `main` `0492fdd`, branch `fix/e21-sair-primeiro-cadastro`. Regras na [fonte da verdade](FONTE_DA_VERDADE.md), etapa no [checklist ponta a ponta](CHECKLIST_PONTA_A_PONTA.md) e registro adicional C4 no [checklist funcional 2](checklist-funcional-2.md). **Pronto no código, falta publicação e o teste do dono.**

## Problema e mudança

Quem entrava pela primeira vez, inclusive pelo Google, chegava ao cadastro do comércio sem opção para sair e usar outro e-mail. Um teste da página real falhou antes da mudança por ausência de **Sair da conta**.

- As quatro etapas do primeiro cadastro agora mostram **Sair da conta**, abaixo do botão principal. A ação encerra a sessão neste navegador e volta à entrada do dono, onde é possível usar outro e-mail.
- **Saindo...** bloqueia outra saída, avanço e salvamento. Se a tentativa falhar mantendo a sessão aberta, a tela conserva os campos, mostra aviso e permite tentar novamente. O SDK pode encerrar a sessão local mesmo quando o servidor falha; nesse caso o app confere que não há mais sessão e permanece na entrada. Isso não comprova revogação no servidor durante a falha.
- O endereço fica identificado como entrada do dono (`?dono`), evitando o desvio para `/funcionario` quando o mesmo navegador guarda acesso da equipe, inclusive ao recarregar depois de sair. O acesso da equipe não é apagado.
- Google recebe `prompt=select_account`, pedindo escolha de conta. A tela real do Google continua sendo um serviço externo a testar pelo dono.
- Enquanto cadastra/salva o comércio, a saída permanece bloqueada. **Cancelar** comércio adicional continua voltando ao painel, sem encerrar a conta. O sucesso do primeiro cadastro mantém seu caminho existente para o painel.

Nenhum comércio é criado, alterado ou removido pela saída. Dados preenchidos ainda não enviados deixam de estar no formulário ao sair com sucesso; não foi criado armazenamento de rascunho. Não houve mudança no banco, migração, função de negócio, regra de estoque/dinheiro ou dependência.

## Verificação e limites

- **Oito testes novos**: sair/entrar com B com acesso da equipe guardado, falha mantendo campos/nova tentativa, resposta atrasada/cliques repetidos, Google pedindo escolha de conta, sessão local já encerrada após erro do servidor, saída bloqueada durante salvamento, salvamento bloqueado durante saída e cancelamento adicional preservado.
- **43 testes focados** de saída, salvamento, sessão e desvio do dono aprovados.
- `npx tsc --noEmit` e `npx vitest run`, **ambos duas vezes após a última mudança**: **979 testes em 92 arquivos**, sem erros. `npm run build` aprovado.
- Chromium com build de produção em **320 × 568, 390 × 844 e 1280 × 900**: quatro etapas com saída acessível, logout/recarga sem reabrir conta antiga ou desviar para equipe, entrada com e-mail B, parâmetro de escolha do Google, HTTP 503 no logout com sessão local encerrada, armazenamento inacessível com aviso/campos mantidos e saída bloqueada até confirmar o cadastro. Sem corte horizontal/exceção; imagens do botão e do erro inspecionadas. API/CEP/Auth simulados, incluindo uma inserção sintética; nenhuma escrita real.
- O teste do navegador inicialmente expôs que o SDK remove a sessão local mesmo com erro do servidor; tratamento e teste ajustados à implementação real da biblioteca, sem alterar a biblioteca. Escolha de conta no Google foi verificada pelo parâmetro enviado, não pela tela externa real.
- Serviços e gravações dos testes são simulados; nenhuma conta/comércio real foi utilizado. Banco e avisos não reconsultados, pois esta entrega não altera SQL.

E2.1 permanece aberta; não se encerra E1/E6 nem a validação geral por esta entrega. B13 foi marcado corrigido por outro acesso no `main` atual: a próxima verificação deve conferir essa implementação, retomada e retornos, sem reaplicar correções já marcadas.

## Roteiro do dono

1. No Lovable, clicar em **Publicar → Atualizar**.
2. Com uma conta que ainda não tem comércio, conferir **Sair da conta** no cadastro. Tocar: deve abrir a entrada, sem cadastrar nada.
3. Entrar com outro e-mail. Ao escolher Google, selecionar a conta desejada na tela do Google. Se sair falhar mantendo a sessão aberta, o app deve explicar e manter o formulário para nova tentativa.

Falta confirmar publicação e resultado desse teste no app, incluindo Google real. Não criar comércios extras somente para testar a saída.
