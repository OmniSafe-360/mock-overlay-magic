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

## G1.2 — análise seguinte: entrada e primeiro convite

Pedido do dono: "Pode fazer entao", após explicação de que G1.2 ainda precisa da aplicação real e da barreira de entrada. Nova consulta: main continua `8bb3342`, PR124 continua em rascunho com CI aprovado no commit `7d49b4b`; SUPABASE_ACCESS_TOKEN ausente/has_saved_binding=false. A autorização da correção de loja inativa está recebida e não é solicitada novamente.

### O que já existe e será aproveitado

- `PainelEquipe` já mostra QR, Copiar convite e Enviar pelo WhatsApp. O QR atual usa `linkAcesso(codigo)`, com o mesmo código de seis dígitos no endereço. Não é um segundo segredo. A alternativa de digitar só o código ainda permite criar o primeiro PIN.
- `AppFuncionario` já recebe o código preenchido, cria o PIN e guarda a chave do aparelho. As funções existentes preservam BCrypt, validade de 48h antes do primeiro PIN, cinco erros compartilhados por funcionário/15 minutos e janela de 12h.
- `PainelVendas` já emite instruções para ligar o Conector com código de oito dígitos; o código vence em 24h e é consumido na ligação.
- `src/lib/banco.ts` chama `supabase.rpc` diretamente. Um limite só no React ou em outra URL, deixando a RPC original acessível, pode ser contornado. O cliente administrativo gerado usa service role e não tem consumidor ativo identificado; não é usado neste desenho.

### Desenho para validar com o dono — ainda não aplicado

**Funcionário:** dono gera o convite nos botões existentes → funcionário abre o link/QR → cria o mesmo PIN de quatro números → depois usa o PIN como hoje. O convite acrescenta um segredo aleatório de 32 bytes, com hash armazenado no banco, prazo atual de 48h e consumo ao confirmar o primeiro PIN. Código de seis números continua identificando o funcionário; sozinho deixa de criar o primeiro PIN. Quem já tem PIN/aparelho continua no fluxo existente.

**Conector:** dono envia/copia um convite de ligação → computador abre o link → liga pelo código e pela prova do convite; prazo de 24h e uso único mantidos. O código de oito números sozinho deixa de parear um computador novo.

Usar fragmento do endereço para transportar a prova (`#...`), remover o fragmento após capturar e manter o segredo em memória até concluir; não colocar em query/pathname, logs, telemetria, cache ou banco em texto aberto. Fragmento evita o envio automático no pedido HTTP/referrer; não impede captura por JavaScript/XSS, histórico/compartilhamento ou extensões, que continuam exigindo G1.4. Compartilhar convite é ação do dono, no app; nenhuma mensagem foi enviada por esta auditoria.

Emissão precisa cobrir criar funcionário, novo acesso, desbloqueio pelo dono, criar caixa e código novo do caixa. Novo acesso revoga os convites anteriores junto da regra existente. O segredo retornado ao dono não é recuperável do hash: ao reabrir a ficha, um novo convite depende de ação explícita e informa que o anterior deixa de valer. Não gerar/rotacionar silenciosamente em um render, consulta ou atualização de lista. Esse detalhe da interface ainda precisa ser validado e implementado.

A entrada passa por um serviço do próprio projeto, com quatro ações permitidas. O serviço verifica desafio antiabuso, limita tentativas em contador compartilhado/atômico com TTL e usa acesso exclusivo para essas funções. A identidade usada pelo contador deve vir de origem comprovada na hospedagem; não confiar em cabeçalho IP que o cliente pode escolher. Sem essa comprovação/configuração, recusar entrada em vez de aceitar sem proteção. Limites reais ainda precisam ser calibrados para várias lojas/caixas no mesmo IP; números dos ensaios são ilustrativos.

O papel de entrada não recebe leitura/gravação de tabelas, acesso aos PINs nem permissão de estoque/owner. No desenho local, três wrappers chamam os corpos existentes, sob bloqueio da linha do funcionário/caixa, em uma transação. As quatro RPCs originais de entrada deixam de estar disponíveis para anon/authenticated; o papel do serviço só pode chamar os wrappers e o desbloqueio. Credencial do papel e contador/desafio são exclusivos do servidor, sem service role de amplo acesso no navegador. Provisionamento/compatibilidade do papel, conexão e hospedagem ainda não foram confirmados no Supabase real.

### Arquivos previstos para a proposta final

A lista abaixo é o escopo de implementação a preparar depois de validar o fluxo e a hospedagem; **não é autorização de aplicar um patch de produção**. Código completo definitivo e lista final serão apresentados antes de alterar esses arquivos, conforme seção0 da fonte. Nesta auditoria só os quatro documentos já pertencentes ao PR124 foram atualizados.

| Arquivo previsto | Responsabilidade |
|---|---|
| `supabase/migrations/20261013140000_entrada_convite_seguro.sql` | Campos de hash, emissão/revogação, wrappers de convite e permissões mínimas |
| `supabase/functions/entrada/index.ts` | Serviço de entrada com ações fixas, parâmetros e respostas validados |
| `supabase/functions/entrada/limites.ts` | Adaptadores de origem confiável, desafio e contador distribuído |
| `supabase/config.toml` | Configuração explícita da função, após verificar autenticação na hospedagem |
| `src/lib/entrada.ts` | Transporte das quatro ações e mensagem de espera |
| `src/lib/banco.ts` | Direcionar somente entrada/ligação/desbloqueio ao serviço e receber convite do dono |
| `src/lib/funcionario.ts` | Link/fragmento e mensagem da entrada |
| `src/components/PainelEquipe.tsx` | Reutilizar QR/convite e confirmação de regeneração |
| `src/components/PainelVendas.tsx` | Convite do computador no lugar das instruções só com código |
| `src/components/AppFuncionario.tsx` | Capturar prova do convite, desafio e resposta de espera, preservando fila/PIN offline |
| `src/components/OmniConector.tsx` | Ligação por convite e texto de limite claro |
| `src/test/entrada-segura.test.ts` | Recusas/erros/corpos/origem/contadores sem bypass |
| `src/test/entrada-convites.test.tsx` | Emissão/compartilhamento/primeiro PIN, convite vencido e aplicativo antigo |
| `docs/persistencia/teste/017_entrada_segura.sql` | Prova, ACL, revogação, PIN compartilhado e ativação concorrente |
| `docs/persistencia/teste/rodar_caixa_estoque.sh` | Executar as regressões novas no banco descartável |
| Os quatro documentos deste PR | Fonte, checklist, histórico e roteiro |

Tipos do Supabase precisam ser regenerados se a integração tipada final exigir os metadados novos; nunca inventar tipos do banco real. Dependências/runtime, segredos, cotas e adaptadores ainda serão conferidos antes de fechar a lista final.

### Evidências do protótipo isolado

**29 casos SQL passaram**, cada um em begin/rollback, com defaults Supabase nativos e dados fictícios. O baseline reproduziu primeiro PIN aceito só com código, sem sessão do dono. Protótipo: RPC direta negada para anon/authenticated mesmo com código/chave; primeiro PIN sem prova e prova de outro convite recusados; PIN fácil/vencido/inativo recusados; prova consumida após confirmação; entrada com PIN existente preservada; cinco erros mistos entre entrar/desbloquear somam no mesmo funcionário e PIN correto não contorna o bloqueio. Papel de entrada sem leitura de saldos/PIN nem permissão de ajuste.

**Duas conexões PostgreSQL reais disputaram a primeira ativação:** uma criou o PIN/aparelho; a outra não substituiu o PIN e registrou erro. Convite consumido e trilha de estoque/dinheiro idêntica. Fixtures dessa disputa foram confirmadas apenas no banco privado, descartado ao terminar. Nenhuma venda/movimentação/ajuste real foi executado.

**13 testes Node passaram** no protótipo de política do serviço: lista fixa de ações, parâmetros extras recusados, origem/corpo, cabeçalhos IP não aceitos como identidade, quota/desafio falhando sem liberar RPC, respostas sem cache, mensagens preservadas sem expor erro interno e tentativas não revertidas após erro da RPC. O contador e o desafio foram adaptadores simulados: a concorrência no modelo compartilhado **não comprova atomicidade, IP confiável, CAPTCHA ou proteção distribuída do provedor real**. Essas provas de integração continuam pendentes.

O serviço, o papel, os campos e os wrappers existem **somente no protótipo do banco privado**, não no checkout nem no Supabase oficial. Nenhum app, função operacional, teste/runner oficial ou permissão da entrega de loja inativa foi modificado nesta análise. Não declarar G1.2 concluída.

### Impactos e ordem antes de publicar

1. Validar com o dono que código sozinho não cria mais o primeiro PIN/liga computador novo; convite existente será reforçado. Usuários já ativos mantêm PIN e chaves.
2. Fornecer acesso administrativo pelo canal seguro para comparar o banco e verificar os recursos reais. Não solicitar novamente aprovação do PR124; não usar o token antigo revogado.
3. Preparar código final, emissão de convites, adaptadores/segredos/cotas e mostrar arquivos/impactos para aprovação. O código abaixo é protótipo de invariantes, não uma migração completa.
4. Ensaiar em ambiente separado do banco oficial: conexão/papel real, contador compartilhado, desafio de uso único/domínio/ação, NAT com vários caixas, revogação e perda de resposta na ativação, aparelhos e atualização.
5. Publicar aplicativo/serviço de forma coordenada **antes** de fechar as RPCs originais. Aplicativo antigo em cache pode perder a entrada/desbloqueio online após revogação de EXECUTE; preparar atualização e mensagem clara, sem apagar fila/rascunhos nem acrescentar um fallback que contorne a proteção. Novas primeiras ativações com convite antigo precisarão de convite regenerado pelo dono.
6. Operações normais de venda/recebimento/estoque continuam nos endpoints atuais; a fila offline permanece e depende das validações atuais quando sincroniza. Proteção não cancela uma chamada já admitida nem encerra sessões existentes por dedução.

<details>
<summary>Código do protótipo SQL — somente ensaio privado, não aplicar em produção</summary>

```sql
-- Prototipo exclusivo do PostgreSQL privado. Executar apenas dentro de begin/rollback.
-- Nao e migracao pronta para producao: emissao de convites e publicacao coordenada ainda precisam de desenho aprovado.
create role omni_entrada nologin nosuperuser nobypassrls;
grant usage on schema public to omni_entrada;
alter table public.funcionarios add column ativacao_hash text;
alter table public.caixas add column ativacao_hash text;
create function public.conferir_codigo_funcionario_com_convite(_codigo text,_ativacao text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare v funcionarios%rowtype;
begin
 select * into v from funcionarios where codigo=_codigo and bloqueado_em is null;
 if not found then return null; end if;
 if v.pin_hash is null and (_ativacao is null or _ativacao !~ '^[0-9a-f]{64}$'
    or v.ativacao_hash is null or v.ativacao_hash<>encode(extensions.digest(_ativacao,'sha256'),'hex')) then return null; end if;
 return public.conferir_codigo_funcionario(_codigo);
end $$;
create function public.entrar_funcionario_com_convite(_codigo text,_pin text,_aparelho text,_ativacao text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v funcionarios%rowtype; r jsonb;
begin
 select * into v from funcionarios where codigo=_codigo and bloqueado_em is null for update;
 if not found then raise exception 'codigo_invalido' using errcode='42501'; end if;
 if v.pin_hash is null and (_ativacao is null or _ativacao !~ '^[0-9a-f]{64}$'
    or v.ativacao_hash is null or v.ativacao_hash<>encode(extensions.digest(_ativacao,'sha256'),'hex')) then
  raise exception 'convite_invalido' using errcode='42501'; end if;
 r:=public.entrar_funcionario(_codigo,_pin,_aparelho);
 if v.pin_hash is null and r ? 'chave' then update funcionarios set ativacao_hash=null where id=v.id; end if;
 return r;
end $$;
create function public.conector_ligar_com_convite(_codigo text,_aparelho text,_ativacao text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare cx caixas%rowtype; r jsonb;
begin
 _codigo:=regexp_replace(coalesce(_codigo,''),'\D','','g');
 select * into cx from caixas where codigo=_codigo and desligado_em is null for update;
 if not found then raise exception 'codigo_invalido' using errcode='42501'; end if;
 if _ativacao is null or _ativacao !~ '^[0-9a-f]{64}$' or cx.ativacao_hash is null
    or cx.ativacao_hash<>encode(extensions.digest(_ativacao,'sha256'),'hex') then
  raise exception 'convite_invalido' using errcode='42501'; end if;
 r:=public.conector_ligar(_codigo,_aparelho);
 update caixas set ativacao_hash=null where id=cx.id;
 return r;
end $$;
revoke all on function public.conferir_codigo_funcionario_com_convite(text,text),
 public.entrar_funcionario_com_convite(text,text,text,text),public.conector_ligar_com_convite(text,text,text)
 from public,anon,authenticated,service_role;
revoke execute on function public.conferir_codigo_funcionario(text),public.entrar_funcionario(text,text,text),
 public.funcionario_desbloquear(text,text),public.conector_ligar(text,text) from public,anon,authenticated;
grant execute on function public.conferir_codigo_funcionario_com_convite(text,text),
 public.entrar_funcionario_com_convite(text,text,text,text),public.conector_ligar_com_convite(text,text,text),
 public.funcionario_desbloquear(text,text) to omni_entrada;
```

</details>

<details>
<summary>Código do protótipo do serviço — adaptadores reais ainda não configurados</summary>

```js
// Prototipo de politica, fora do app. Adaptadores reais de hospedagem/quota/desafio/JWT ainda nao configurados.
const OPERACOES = {
 conferir: { rpc: 'conferir_codigo_funcionario_com_convite', campos: { _codigo: /^\d{6}$/, _ativacao: /^[a-f0-9]{64}$/ }, opcionais: ['_ativacao'] },
 entrar: { rpc: 'entrar_funcionario_com_convite', campos: { _codigo: /^\d{6}$/, _pin: /^\d{4}$/, _aparelho: /^.{0,120}$/u, _ativacao: /^[a-f0-9]{64}$/ }, opcionais: ['_ativacao'] },
 desbloquear: { rpc: 'funcionario_desbloquear', campos: { _chave: /^[a-f0-9]{64}$/, _pin: /^\d{4}$/ }, opcionais: [] },
 ligar_caixa: { rpc: 'conector_ligar_com_convite', campos: { _codigo: /^\d{8}$/, _aparelho: /^.{0,120}$/u, _ativacao: /^[a-f0-9]{64}$/ }, opcionais: ['_ativacao'] },
};
function responder(status,body,extras={}) {
 return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer',...extras}});
}
async function lerCorpo(req) {
 if (!req.body) throw Error('corpo');
 const leitor=req.body.getReader();let tamanho=0;const partes=[];
 for (;;) {const p=await leitor.read();if(p.done)break;tamanho+=p.value.byteLength;
  if(tamanho>2048){await leitor.cancel();throw Error('corpo');}partes.push(p.value);}
 const dados=new Uint8Array(tamanho);let offset=0;for(const parte of partes){dados.set(parte,offset);offset+=parte.byteLength;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(dados));
}
export function criarEntrada({origem,lerOrigemConfiavel,consumirQuota,verificarDesafio,rpc}) {
 return async function entrada(req,contexto) {
  if(req.method!=='POST')return responder(405,{erro:'metodo_invalido'},{allow:'POST'});
  // Origin reduz chamadas de outro site; nao e credencial e nao substitui prova/quota/privilegios no banco.
  if(req.headers.get('origin')!==origem)return responder(403,{erro:'origem_invalida'});
  if((req.headers.get('content-type')??'').split(';')[0].trim()!=='application/json')return responder(415,{erro:'formato_invalido'});
  let corpo;try{corpo=await lerCorpo(req);}catch{return responder(400,{erro:'pedido_invalido'});}
  if(!corpo||typeof corpo!=='object'||Array.isArray(corpo)||Object.keys(corpo).some(k=>!['acao','dados','desafio'].includes(k)))return responder(400,{erro:'pedido_invalido'});
  const op=Object.hasOwn(OPERACOES,corpo.acao)?OPERACOES[corpo.acao]:null;
  if(!op||!corpo.dados||typeof corpo.dados!=='object'||Array.isArray(corpo.dados))return responder(400,{erro:'pedido_invalido'});
  if(Object.keys(corpo.dados).some(k=>!Object.hasOwn(op.campos,k)))return responder(400,{erro:'pedido_invalido'});
  for(const [campo,padrao] of Object.entries(op.campos)) {
   const valor=corpo.dados[campo];if(valor==null&&op.opcionais.includes(campo))continue;
   if(typeof valor!=='string'||!padrao.test(valor))return responder(400,{erro:'pedido_invalido'});
  }
  if(typeof corpo.desafio!=='string'||corpo.desafio.length<1||corpo.desafio.length>2048)return responder(400,{erro:'pedido_invalido'});
  // Origem vem do adaptador do provedor, nunca de X-Forwarded-For/campo IP enviado pelo cliente.
  let identidade;try{identidade=await lerOrigemConfiavel(contexto);}catch{return responder(503,{erro:'entrada_indisponivel'});}
  if(!identidade)return responder(503,{erro:'entrada_indisponivel'});
  let quota;try{quota=await consumirQuota({identidade,acao:corpo.acao});}catch{return responder(503,{erro:'entrada_indisponivel'});}
  if(quota?.permitido!==true){
   if(quota?.permitido!==false||!Number.isInteger(quota.esperaSegundos)||quota.esperaSegundos<1||quota.esperaSegundos>900)return responder(503,{erro:'entrada_indisponivel'});
   return responder(429,{erro:'muitas_tentativas',esperaSegundos:quota.esperaSegundos},{'retry-after':String(quota.esperaSegundos)});
  }
  try{if(await verificarDesafio({token:corpo.desafio,acao:corpo.acao,origem,identidade})!==true)return responder(403,{erro:'verificacao_invalida'});}
  catch{return responder(503,{erro:'entrada_indisponivel'});}
  const args=Object.fromEntries(Object.keys(op.campos).map(k=>[k,corpo.dados[k]??null]));
  try{
   const r=await rpc(op.rpc,args);
   if(r.error){const mensagem=String(r.error.message??'');
    if(/^(codigo_invalido|codigo_expirado|convite_invalido|acesso_encerrado|pin_formato|pin_facil|pin_errado:[1-5]|muitas_tentativas:\d{1,3})$/.test(mensagem))return responder(400,{erro:mensagem});
    return responder(500,{erro:'entrada_indisponivel'});
   }
   return responder(200,{dados:r.data});
  }catch{return responder(503,{erro:'entrada_indisponivel'});}
 };
}
```

</details>
