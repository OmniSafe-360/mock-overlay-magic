# E1/R05 — reabrir o Caixa sem internet

Entrega no [PR #104](https://github.com/OmniSafe-360/mock-overlay-magic/pull/104), correção `811a4d064df1c40a86ed62f6e0c4e3efc63430c5`. Correção autorizada em 11/10/2026 sobre o `main` `388f0fb5a60993994e22bcde246a03379a86aa78` (PR #103), branch `fix/r05-caixa-reabrir-offline`. **Pronto, falta Publicar → Atualizar no Lovable e o teste do dono em aparelho real.** Próxima tarefa independente: **E2.1 — conta e comércio**. E1 continua sem aceite geral; teste físico de R05 permanece em E6/item antigo 29.

## Falha comprovada e mudança

No build de produção anterior, o Chromium carregou o Caixa online, validou PIN e guardou turno/produtos. Depois de encerrar o navegador por completo e reabri-lo offline, `/caixa` retornou `ERR_INTERNET_DISCONNECTED`, preservando os dados e o cache HTTP do perfil. O service worker antigo não guardava arquivos. Essa reprodução local comprova uma falha nesse cenário; não é um teste em Android/iPhone nem uma nova verificação do app publicado.

O build agora gera a lista dos arquivos públicos da mesma versão (JavaScript e CSS, incluindo arquivos carregados depois), e o worker guarda essa lista e a tela pública limpa de seu app. `/caixa` e `/funcionario` usam caches separados. HTML e lista de arquivos de versões diferentes recusam a instalação. Falha na obtenção/gravação dos arquivos impede ativar uma atualização incompleta e preserva a versão anterior.

O worker atende somente navegação na rota exata de seu app e os arquivos listados no build. Não guarda respostas do Supabase, páginas do dono, requisições de gravação, cookies, chave/PIN ou HTML de links com parâmetros. Links de convite são consultados online; se a rede falha, a única alternativa é a tela pública limpa. As chamadas de negócio continuam no app/banco, com os mesmos IDs. Não há fila de rede no worker.

Atualizações aguardam todas as janelas controladas fecharem; não há troca forçada de versão no meio de uma venda. Na ativação, a limpeza alcança somente versões antigas do mesmo app, sem tocar no armazenamento local, nas vendas pendentes ou no cache do outro app. O registro ocorre somente em produção, sem guardar arquivos de desenvolvimento/HMR.

**Regras existentes preservadas:** acesso validado e conferência local do PIN; bloqueio após cinco erros offline; turno já aberto e produtos guardados online; venda guardada antes do envio; reenvio com mesmo ID; abertura/fechamento/sangria/cancelamento dependentes do banco. Guardar arquivos não autoriza uma pessoa nova nem permite abrir outro turno offline. Outros módulos não ganharam promessa de gravação offline.

Sem SQL, tabela, função de negócio ou dado real alterado. Banco e avisos do Supabase não foram reconsultados; a limitação de R02 permanece.

## Verificações executadas

- **25 testes novos** em `src/test/telas-offline.test.ts`: preparação dos dois apps, arquivos tardios/CSS, versão incompatível, tela inválida, falta de rede/arquivo/espaço, falha de gravação do HTML, proteção do cache anterior/do outro app, convites sem guardar parâmetros, APIs/gravações/páginas privadas fora do cache e geração somente no build cliente. Conjunto com os testes existentes de instalação, equipe e Caixa: **77 testes** (76 antes de acrescentar o último caso de gravação do HTML). Nenhum teste removido/desligado.
- `npx tsc --noEmit` e `npx vitest run` passaram **duas vezes**: **904 testes em 77 arquivos** em cada rodada. `npm run build` aprovado, com worker gerado contendo os arquivos reais do cliente.
- **Chromium em 320 px**, build de produção, perfil persistente e chamadas ao Supabase interceptadas: `/caixa` e `/funcionario` passaram por PIN online, encerramento completo do navegador, reabertura offline com PIN, venda de R$ 10 guardada, outro encerramento/reabertura offline e reconexão. Em cada roteiro: **um envio confirmado, fila removida após confirmação e zero chamadas de abertura de turno**. O teste usa um turno já aberto na simulação; não altera o banco oficial.
- **Chromium em 1280 px:** atualização completa permanece aguardando com a tela aberta; depois do fechamento, a nova versão ativa reabre offline com PIN, mesmo com cache HTTP esvaziado e mantendo CacheStorage/dados do aparelho. A venda pendente e o cache do outro app são preservados. Atualização com arquivo ausente é recusada; versão anterior continua abrindo offline. As esperas conferem o fim do evento de instalação/ativação, não apenas o início da solicitação de atualização.
- Tela sem corte horizontal/exceção nesses roteiros. `git diff --check` aprovado. Câmera física, instalação pelo ícone, encerramento forçado pelo Android/iOS e publicação não foram validados aqui.

A prévia padrão `vite preview` deste ambiente procura `dist/server/server.js`, mas o build gera o worker em `.output/server/index.mjs`. A reprodução usou esse worker e seus arquivos `.output/public` por um adaptador HTTP local fora do repositório; não usou o servidor de desenvolvimento nem alterou scripts/dependências do projeto para contornar a prévia.

## Roteiro do dono, após publicar

Usar um aparelho e um turno destinados à validação. Não lançar vendas fictícias no caixa real da loja.

1. No Lovable, clicar **Publicar → Atualizar**. Com internet, abrir o Omni Caixa/Operação, entrar pelo PIN e aguardar o carregamento. Fechar todas as janelas desse app e reabrir com internet para a versão preparada assumir. A primeira preparação precisa de rede e espaço no aparelho; só guardar o PIN não basta.
2. Com o turno já aberto online e produtos carregados, fechar completamente o app. Desligar Wi-Fi e dados móveis. Abrir novamente pelo ícone: deve pedir PIN e abrir o Caixa com aviso **Sem internet**. Não deve abrir outro turno.
3. Fazer uma venda de teste com valor conhecido. Deve informar que ficou **guardada no celular**. Fechar/reabrir ainda offline: deve exigir PIN e conservar a venda pendente.
4. Voltar a internet, manter o app aberto e conferir a confirmação (o reenvio periódico existente tenta a cada 20 segundos). No painel do dono, verificar uma única venda e sua movimentação de estoque, no mesmo turno. A fila só some após confirmação.
5. Conferir que fechar caixa, tirar dinheiro e cancelar precisam de conexão. PIN incorreto deve recusar; cinco erros offline exigem voltar à internet. Não limpar dados do navegador nem desinstalar com vendas reais pendentes.
6. Repetir o cenário de atualização com venda pendente no aparelho de teste: publicar uma versão posterior, abrir online, fechar/reabrir; o PIN, turno e fila devem permanecer. Registrar Android/iPhone, navegador, uso pelo ícone e resultado **funcionou/não funcionou**. Câmera e fechamento financeiro completos continuam no item 29/E4/E6.

A abertura offline depende de preparação online concluída e de o navegador manter os arquivos e os dados do aparelho. Limpeza de dados, desinstalação, navegação privada ou remoção pelo sistema não foram transformadas em recuperação garantida. R05 permanece com `[ ]` até a publicação e o teste real; não libera piloto nem declara o sistema inteiro aprovado.
