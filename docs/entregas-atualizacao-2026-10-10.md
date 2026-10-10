# Atualização das entregas do Omni Operação — 10/10/2026

O dono mostrou a lista "Receber mercadoria" vazia após gerar um pedido. A imagem não mostra a situação do pedido nem o comércio ligado ao funcionário. O pedido específico em produção não foi consultado nesta etapa.

## Falha comprovada no código

`ListaEntregas` consultava `funcionario_entregas` apenas ao montar. Um pedido enviado enquanto essa lista permanecia aberta não aparecia; voltar de outro app ou recuperar a internet também não atualizava a lista. Uma consulta inicial com erro não oferecia uma nova tentativa na própria tela.

Quatro testes reproduziram essas falhas e reprovaram antes da correção.

## Correção limitada à lista

- A lista consulta novamente a cada 30 segundos enquanto visível e com internet, ao voltar à tela e quando a conexão retorna.
- Botão "Atualizar" permite conferir imediatamente, inclusive depois de um erro.
- Só uma consulta fica em andamento por vez. Se falhar, a lista anterior é preservada e o erro aparece. O resultado de um acesso anterior não entra no novo acesso.
- Ao sair da lista, o intervalo e os eventos são removidos; respostas atrasadas são ignoradas. A tela de contagem mantém seu fluxo e seu rascunho.
- O aviso de lista vazia explica que o pedido deve ter sido enviado ao fornecedor pelo dono, neste comércio. Não aparece durante uma falha de atualização.

## Regras preservadas

A função do banco continua mostrando pedidos do comércio do funcionário nas situações `enviado`, `aceito`, `aceito_ajustes` e `recebido_parcial`, sem recebimento já concluído. Um pedido apenas salvo (`rascunho`, "Não enviado" no app do dono) não é uma entrega esperada. A confirmação do fornecedor não é obrigatória para um pedido enviado aparecer.

Nenhuma migração, função de banco, permissão, envio de pedido, contagem, rascunho, saldo ou regra de estoque foi alterada. O funcionário continua sem ver as quantidades esperadas.

## Validação

- 11 testes novos: atualização automática, botão, retorno ao app, internet, lista após erro, tentativa após erro inicial, consultas simultâneas, saída e troca de acesso.
- Tipos e build aprovados.
- 726 testes em 69 arquivos aprovados em duas execuções completas.
- Chromium, tela real do app em 320 × 568 e 1280 × 900, com respostas de banco simuladas: desbloquear com PIN, abrir Receber mercadoria, lista vazia, pedido enviado aparecendo sem sair da lista, atualização manual, falha temporária e recuperação da conexão. Sem rolagem horizontal ou exceções de tela. Nenhum recebimento foi aberto ou enviado nesse teste.

O teste visual usa dados simulados; não comprova a situação do pedido da imagem nem o vínculo do funcionário em produção.

## Teste do dono

1. No Lovable, Publicar → Atualizar. Atualize também o Omni Operação.
2. No app do dono, abra o comércio → Pedidos e confira a situação. Se estiver "Não enviado", use Enviar no detalhe e escolha o canal.
3. No Omni Operação desse mesmo comércio, abra Receber mercadoria e toque em Atualizar. O pedido enviado deve aparecer; com a lista aberta, a atualização ocorre em até 30 segundos.
4. Se continuar vazio, conferir o número e a situação do pedido e o comércio mostrado no início do Omni Operação. Não usar "Chegou sem pedido" para substituir um pedido existente sem investigar esse vínculo.
