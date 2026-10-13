# G1.2 — bloqueio operacional de loja inativa

Estado: **proposta aprovada pelo dono ("Próxima pode fazer"), aplicada aos sete arquivos em branch separada; [PR #124](https://github.com/OmniSafe-360/mock-overlay-magic/pull/124) de rascunho aguardando comparação com o banco real**. Nenhum SQL de produção ou configuração publicada foi alterado. Base: `8bb33423786e311ebd97d4ea6c8524d049a16b82`, remoto conferido em 13/10/2026.

O Conector já exige comércio ativo. A equipe e o Caixa móvel aceitam a mesma loja inativa na versão atual. A proposta alinha quatro funções existentes sem alterar regras de estoque, dinheiro, PIN ou histórico. Não há função de negócio nem tabela nova.

## Sete arquivos aprovados

1. `supabase/migrations/20261013130000_acesso_loja_inativa.sql` — novo arquivo; quatro definições existentes com uma verificação acrescentada em cada corpo.
2. `docs/persistencia/teste/016_acesso_loja_inativa.sql` — teste transacional novo com dados fictícios e 35 asserções.
3. `docs/persistencia/teste/rodar_caixa_estoque.sh` — executar o novo caso entre begin/rollback; runner existente mantido.
4. `docs/acesso-loja-inativa-2026-10-13.md` — este registro/roteiro.
5. `docs/FONTE_DA_VERDADE.md` — registrar entrega parcial em branch e comparação real pendente, sem encerrar a etapa.
6. `docs/CHECKLIST_PONTA_A_PONTA.md` — evidências, limites e pendências no mesmo checklist.
7. `CLAUDE.md` — histórico da proposta, aprovação/aplicação/teste real em estados separados.

## Código e contratos preservados

Migração completa em [20261013130000_acesso_loja_inativa.sql](../supabase/migrations/20261013130000_acesso_loja_inativa.sql). Alterações de corpo: sete linhas novas, sem remover linhas existentes.

- `_funcionario_da_chave`: recusa com `acesso_encerrado`/42501 antes de consultar a janela do PIN ou atualizar horários de uso.
- `conferir_codigo_funcionario`: devolve null para loja inativa, como código indisponível.
- `entrar_funcionario`: recusa com `codigo_invalido`/42501 antes de criar PIN/chave, somar tentativas ou renovar acesso.
- `funcionario_desbloquear`: recusa com `acesso_encerrado`/42501 antes de somar tentativas ou renovar janela.

O teste compara o contrato existente do app. As telas e as mensagens atuais continuam sendo usadas. Não é criada mensagem que revele se um código corresponde a uma loja desativada. A mensagem atual de saída menciona bloqueio/novo acesso; uma redação específica para loja inativa exigiria outra proposta de interface.

## Impactos apresentados e aprovados

**Enquanto ativo=false**, novas chamadas online da equipe/Caixa móvel que usam o helper passam a ser recusadas, inclusive recebimento, contagem, reposição, perda e envio de vendas. Não significa bloquear todo endpoint público: fornecedores/fiado têm seus próprios controles, analisados separadamente. O dono continua consultando os registros históricos pelas políticas existentes. A segunda loja do mesmo dono segue funcionando. O logout permanece disponível.

A proposta não muda ativo=false para ninguém. Ela verifica o estado já gravado. Não há tela de arquivamento implementada por esta entrega. Reativar o comércio torna elegíveis novamente as chaves ainda não encerradas, sujeitas ao PIN e às permissões anteriores. Revogação definitiva continua usando bloquear funcionário/novo acesso/logout; não há encerramento automático de aparelhos por esta proposta.

Um aparelho sem internet não recebe imediatamente a mudança de estado: o funcionamento offline/fila é preservado, mas o servidor recusa novas chamadas com a loja inativa. Não se garante cancelamento de chamada admitida antes da desativação ou em fotografia transacional anterior. Fechamento instantâneo incluindo operações em andamento exige desenho de concorrência próprio.

Nenhum ajuste de estoque, alteração financeira, transferência ou decisão de divergência é executado pela migração. ACL, donos das funções, SECURITY DEFINER, search_path, RLS e políticas permaneceram idênticos no ensaio nativo. CREATE OR REPLACE conserva as permissões anteriores; não se acrescentam GRANTs.

## Evidências locais

- PostgreSQL17 privado com defaults Supabase emulados, dados fictícios: o teste novo **falha antes**, no acesso por código com PIN da loja inativa; passa depois, **35 asserções**. Executado sempre entre begin/rollback, sem a palavra proibida no SQL de simulação.
- **243 casos SQL +74 HTTP/PostgREST16.4** anteriores passam após aplicar a proposta somente no banco descartável.
- Runner proposto: regressões existentes de Caixa/contagens/recebimento e **quatro disputas reais entre conexões** passam, incluindo a nova suíte.
- **Tipos e 1.019 testes em 98 arquivos passaram duas vezes.** Na preparação, o checkout oficial permanecia sem alteração; os testes SQL/HTTP verificaram a proposta no banco privado. A verificação posterior da branch aprovada fica registrada abaixo. Não são teste do aplicativo publicado nem aceitação do dono.

## Proteções existentes e limites de G1.2

O código inicial do funcionário vence em 48 horas enquanto ainda não existe PIN; depois continua sendo identificador de entrada junto do PIN. O código de ligação do Conector vence em 24 horas e é consumido quando ligado. O PIN existente tem cinco erros/15 minutos de espera, hash BCrypt e janela de aparelho de 12 horas. Esses mecanismos não limitam, por si só, tentativas distribuídas de descobrir códigos ou de tomar a ativação inicial.

Falta desenhar e verificar a barreira contra abuso nos endpoints de entrada/ativação, com origem confiável no gateway, sem confiar em IP fornecido pelo navegador e sem bloquear globalmente comerciantes legítimos. Esta correção **não encerra G1.2 nem declara imunidade contra ataques**. Auth/MFA/gateway publicados e isolamento real permanecem pendentes nos subitens próprios.

## Antes de mesclar e aplicar no Supabase

1. **Aprovação recebida:** após apresentação de código, sete arquivos e impactos, o dono respondeu "Próxima pode fazer". Não solicitar novamente a mesma aprovação.
2. Comparar as quatro funções reais, permissões e políticas com a base auditada. Se houver diferença, manter o PR em rascunho e revisar a proposta; nenhuma migração histórica é sobrescrita.
3. Aplicar os sete arquivos aprovados em branch, repetir os checks exigidos e abrir um PR de rascunho. Não mesclar nem aplicar SQL oficial enquanto a comparação real estiver pendente.
4. Aplicação no banco real e consulta de avisos dependem de acesso administrativo pelo canal seguro; nenhuma credencial é pedida em conversa. SUPABASE_ACCESS_TOKEN ausente no runtime e has_saved_binding=false na configuração conferida; nenhum conector administrativo está disponível. Para liberar comparação/aplicação, preencher a declaração já existente nas configurações seguras do ambiente; não criar declaração duplicada nem enviar valores na conversa. Ausência atual desse acesso impede implantação/validação de produção.
5. Só registrar aplicada/publicada após evidência. Não requer novo build do front-end por si só; atualizações anteriores do Lovable continuam pendentes quando registradas.

## Roteiro do dono, quando estiver aplicada

Em lojas de teste autorizadas: confirmar entrada/PIN/Caixa ativos; marcar apenas a loja de teste como inativa pelo procedimento autorizado; confirmar recusas online para equipe/caixa e histórico visível ao dono. Confirmar outra loja ativa funcionando, saída do aparelho, reativação/PIN e acesso antigo encerrado após bloqueio/novo acesso. Não manipular loja real para testar sem lista/autorização concreta. **Falta o teste do dono no app publicado.**

## Registro da aplicação autorizada na branch

Em 13/10/2026, base local/remota `8bb3342` conferida e patch aprovado com SHA256 `c77dcfd13323817a159593fb00de8ff1620065650531f10e1c2c5dc154d40f16` aplicado em `codex/g12-acesso-loja-inativa`, commit `e7a8c9e`, [PR #124](https://github.com/OmniSafe-360/mock-overlay-magic/pull/124). Os três arquivos de SQL/teste/runner são idênticos aos da proposta; somente os quatro documentos registram aprovação, execução e pendências. Nenhuma configuração, aplicativo, migração histórica ou regra de estoque adicional foi alterada.

**Verificação pós-aplicação aprovada:** tipos e 1.019 testes/98 arquivos duas vezes, build com Supabase fictício, runner com 35 novas asserções/regressões/quatro disputas e ensaio nativo Supabase com 243 SQL/74 HTTP. O teste novo reproduziu a falha antes de aplicar no banco privado e passou depois. ACL, dono/search_path/SECURITY DEFINER das funções, RLS e políticas ficaram iguais; reexecução da migração também preservou permissões. Nenhum banco oficial ou dado real usado.

A fonte, checklist e registro estão na mesma branch/PR para não publicar no main a migração antes da comparação requerida. O main e o Supabase continuam na versão anterior. G1.2 e o teste do dono permanecem abertos.

## Comparação administrativa pendente

Referências calculadas no PostgreSQL17 nativo a partir do main auditado. O resumo por hash não substitui a leitura do corpo e das permissões; qualquer diferença real exige revisão antes da aplicação.

| Função | md5(prosrc) antes | md5(prosrc) corrigida | EXECUTE anon/authenticated |
|---|---|---|---|
| `_funcionario_da_chave(text)` | `09fb71d9a86d11a89810feb7f46dd7d5` | `16d4f52076256842c1ab01cb14f5e111` | false/false |
| `conferir_codigo_funcionario(text)` | `985472515ff18db343e1cc590c449b5b` | `9f561edcf3fdcd4563aeb11405817a8b` | true/true |
| `entrar_funcionario(text,text,text)` | `6b0a7c9a469348b6b2a2ccd8eb2e5ca1` | `d676443695f59e583a2e1c5ad11fc411` | true/true |
| `funcionario_desbloquear(text,text)` | `a791a27822cd772565c8abd013319eac` | `c60a4bc0278bc03af5b961434bbcdf7f` | true/true |

Consulta somente de metadados, sem ler registros comerciais nem executar funções de negócio, para acesso administrativo autorizado:

```sql
select p.oid::regprocedure::text as assinatura,
       md5(p.prosrc) as md5_prosrc,
       pg_get_functiondef(p.oid) as definicao,
       p.proacl as permissoes,
       pg_get_userbyid(p.proowner) as dono,
       p.prosecdef as security_definer,
       p.proconfig as configuracao,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
where p.oid in (
  'public._funcionario_da_chave(text)'::regprocedure,
  'public.conferir_codigo_funcionario(text)'::regprocedure,
  'public.entrar_funcionario(text,text,text)'::regprocedure,
  'public.funcionario_desbloquear(text,text)'::regprocedure
)
order by assinatura;
```

A consulta não foi executada no Supabase oficial nesta entrega. A referência mais ampla de RLS/políticas/defaults está no [roteiro G1.1](isolamento-acessos-2026-10-13.md). Se a versão corrigida já estiver no banco por outro acesso, não repetir aplicação; comparar os corpos e registrar a evidência.
