# G1.1 — isolamento entre lojas e pessoas

Auditoria de **13/10/2026**, autorizada pelo dono (“Pode fazer”), sobre `main b05339c1d045c9c10b83a3453c8a0804be738036`, conferido com o GitHub. Conteúdo documental inicial `114a00e`. Este relatório apoia a [fonte da verdade](FONTE_DA_VERDADE.md) e o [checklist](CHECKLIST_PONTA_A_PONTA.md); não substitui suas regras.

## Resultado para o dono

**Não foi reproduzido acesso entre lojas nos cenários ensaiados.** Dois donos, três lojas (duas do mesmo dono), quatro funcionários/caixas móveis, três Conectores, dois fornecedores e três clientes do fiado, todos fictícios. Também foi testado um usuário com papel global de gerente, sem loja própria: o papel não concede acesso às lojas dos donos.

**317 casos passaram: 243 diretamente no PostgreSQL e 74 pela API HTTP real do ambiente local.** Acesso correto também foi exigido; não basta que tudo seja negado. A revogação por bloqueio, novo acesso, saída, PIN expirado ou retirada da função de caixa foi comprovada nos caminhos testados. Links antigos de pedido/fiado deixam de valer após a renovação pelo dono.

**G1.1 continua aberta para conferir o banco real.** Não havia `SUPABASE_ACCESS_TOKEN` ativo nem conector administrativo Supabase nesta execução; nenhuma chamada administrativa, ataque externo ou mudança em produção foi feita. A cópia local não comprova que funções, permissões, políticas e configuração do gateway publicado sejam idênticos.

Esta entrega altera somente quatro documentos: relatório, fonte da verdade, checklist e `CLAUDE.md`. Não altera aplicativo, SQL/migrações, permissões, funções de negócio, dados, lock, configuração ou workflow. **Não exige Publicar → Atualizar no Lovable.** G0.1/publicação/teste, G0.2/consumidores e G0.3/proteções/alertas/Lovable permanecem pendentes.

## O que foi comprovado

| Acesso/cenário | Resultado local |
|---|---|
| Dono A lê suas duas lojas; dono B lê somente B | Acesso legítimo preservado; filtro por UUID da outra pessoa retorna vazio |
| Cadastros e operação com loja/produto/ID de outro dono ou outra loja | Recusados; operação de B não é reaproveitada como cadastro de A |
| Perfil e papéis de outro dono; gerente global sem vínculo | Não dão acesso às lojas de outra pessoa |
| Chave do funcionário de A1 com produto, pedido, recebimento, conferência/reposição de A2 ou B1 | Recusado, inclusive entre lojas do mesmo dono |
| Caixa de A1 com venda, cliente ou turno de outra loja/pessoa | Recusado; outro funcionário da mesma loja também não fecha/vende no turno alheio |
| Bloqueio, novo acesso, logout, PIN expirado ou função Caixa retirada | Operações protegidas deixam de funcionar; os retornos nulos/pedido de PIN existentes são preservados |
| Fornecedor usa token A e item do pedido B | Recusado; token válido continua mostrando somente o pedido correspondente |
| Cliente usa token de um fiado e sessão de outro | Recusado; par correto retorna somente seu extrato |
| Escrita direta em estoque, movimentos, operações, vendas e fiado | Recusada pela API e banco nos caminhos testados |
| Helpers internos | 33 helpers com prefixo `_`: EXECUTE negado para anon e authenticated, inclusive com os privilégios padrão do Supabase |
| Tabelas/políticas | 35 tabelas reconstruídas com RLS ligada; anonimato não retorna linhas privadas; leitura legítima do dono confirmada nas tabelas povoadas dos cenários |

`SECURITY DEFINER` executável por anon/authenticated não é falha isoladamente: os endpoints públicos usam chave/token e verificam o objeto/loja antes de operar. Não retirar essas permissões sem preservar o app da equipe, caixa, fornecedor e cliente.

## Diferença confirmada e próximo tratamento

**Loja marcada como inativa:** em transação revertida, `comercios.ativo=false` fez `conector_estado` retornar nulo, mas `funcionario_inicio` e `caixa_produtos` ainda devolveram dados à chave válida. O helper `_caixa_da_chave` verifica loja ativa; `_funcionario_da_chave` não faz essa verificação. Não foi criado um botão de arquivar nem alterada a regra existente.

O tratamento pertence à **G1.2**, que já exige validar revogação/comportamento ao arquivar, junto da proteção dos códigos de entrada/PIN. Antes de corrigir: confirmar a regra de loja inativa, apresentar corpo/arquivos/impactos e comparar as funções reais. Reutilizar os helpers e preservar a leitura de histórico pelo dono; não alterar silenciosamente permissões de receber/repor/conferir. A diferença foi demonstrada na cópia local, não explorada contra lojas reais.

**Lacuna da base de testes antiga:** não emulava todos os privilégios padrão do Supabase. Isso podia transformar uma verificação de RLS em simples falta de GRANT. A cópia local foi refeita com defaults oficiais para tabelas, funções e sequências, preservando os REVOKEs/GRANTs das migrações. A alteração ficou exclusivamente no ambiente descartável. Integrar esse reforço ao CI exige proposta/revisão própria; não modificar a base antiga nesta auditoria como se produção já tivesse sido corrigida.

Fonte oficial dos defaults: [Supabase/Postgres, revisão 4945c97](https://github.com/supabase/postgres/blob/4945c97e3116360d3871201aed97598d5b4105a8/migrations/db/init-scripts/00000000000000-initial-schema.sql#L39); blob `b32db6b939afc914db36b83bcac245df27f90902`, conferido com o arquivo consultado. Defaults são uma referência de teste, não uma consulta às concessões efetivas deste projeto em produção.

## Ambiente, evidência e limites

- PostgreSQL 17 privado, sem TCP; PostgREST 16.4 escutando somente em loopback, com papel authenticator sem herança e JWT/credenciais de teste. Nenhuma URL, chave ou pessoa real do comércio usada.
- Reutilizados `000_base_simulada.sql`/`000_base_operacional.sql` e **59 migrações atuais**, em ordem. Três migrações de catálogo externo (20261010111223, 20261010111310, 20261010125732) não executadas: dependem da extensão HTTP e não participam destes acessos de loja. Catálogo, Auth/Storage/realtime reais e configuração de schemas publicados continuam fora dessa prova.
- `auth.uid()` da cópia aceita a claim JSON do PostgREST e a forma legada usada pelos testes. Isso é emulação de autenticação, não alteração da função do Supabase publicado.
- Inventário de 122 funções públicas efetivas reconstruídas, assinaturas/ACL/configuração, 35 tabelas/políticas. Bases simuladas não substituem levantamento do esquema real; trigger/permissão/configuração que exista só na produção não foi aprovada aqui.
- Casos SQL executados em `begin … rollback`, incluindo as recusas, sem a palavra proibida no SQL de simulação. Fixtures e três vendas legítimas foram criadas somente no servidor privado para povoar os cenários; todo o banco foi descartado ao final. Comparação de snapshots de saldos/movimentos/operações/vendas/fiado durante as recusas não encontrou alteração nesses registros.
- Falhas iniciais de preparação foram diagnosticadas: defaults ausentes, contador de pedido das fixtures, formato dos retornos nulos/PIN e tabela `fiado_acessos` sem leitura direta por desenho. Expectativas foram alinhadas ao contrato existente, sem mudar funções/políticas do app. Os runners finais falham com status não zero se qualquer caso não passar; roteiro refeito do zero e aprovado.
- Tipos e **1.019 testes em 98 arquivos**, duas vezes, aprovados para esta entrega documental. Frontend/Supabase simulados não substituem teste do dono no app publicado. O check do PR verifica também build/SQL descartável.

## Aceite e continuidade

G1.1 só encerra após comparar funções/ACL/RLS reais com a versão analisada, confirmar schemas/papéis do gateway e completar casos dependentes dessa configuração em ambiente autorizado. Sem acesso administrativo essa parte permanece pendente. A consulta de metadados abaixo é somente leitura e não contém dados de usuários/estoque.

Próxima análise independente: **G1.2 — proteção da entrada, revogação e regra de loja inativa**, com desenho/código/arquivos/impactos apresentados antes de aplicação. G0/G1 não estão encerradas; nenhuma garantia de imunidade ou liberação de grande rede foi dada.

<details>
<summary>Consulta de metadados para comparação com o Supabase real — somente leitura</summary>

```sql
-- Somente metadados. Nao invoca RPCs nem le dados de usuarios/estoque.
select jsonb_build_object(
 'tabelas',(select jsonb_agg(jsonb_build_object('nome',c.relname,'rls',c.relrowsecurity,'anon_select',has_table_privilege('anon',c.oid,'SELECT'),'auth_select',has_table_privilege('authenticated',c.oid,'SELECT')) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'politicas',(select jsonb_agg(jsonb_build_object('tabela',tablename,'nome',policyname,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check) order by tablename,policyname) from pg_policies where schemaname='public'),
 'funcoes',(select jsonb_agg(jsonb_build_object('assinatura',p.oid::regprocedure::text,'corpo_md5',md5(p.prosrc),'definer',p.prosecdef,'config',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'auth_execute',has_function_privilege('authenticated',p.oid,'EXECUTE')) order by p.proname,p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
 'privilegios_padrao',(select jsonb_agg(jsonb_build_object('criador',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'tipo',d.defaclobjtype,'acl',d.defaclacl::text)) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='public')
);
```

</details>

<details>
<summary>Lista individual dos 317 casos e resultados</summary>

| Camada | Caso | Resultado | Sinal confirmado |
|---|---|---|---|
| SQL | helper fechado _acertar_area(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid) anon | Passou | 42501 |
| SQL | helper fechado _acertar_area(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _achar_item_venda(uuid,text,text) anon | Passou | 42501 |
| SQL | helper fechado _achar_item_venda(uuid,text,text) authenticated | Passou | 42501 |
| SQL | helper fechado _baixar_item_venda(uuid) anon | Passou | 42501 |
| SQL | helper fechado _baixar_item_venda(uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _caixa_da_chave(text) anon | Passou | 42501 |
| SQL | helper fechado _caixa_da_chave(text) authenticated | Passou | 42501 |
| SQL | helper fechado _cancelar_venda_celular(uuid,text,text) anon | Passou | 42501 |
| SQL | helper fechado _cancelar_venda_celular(uuid,text,text) authenticated | Passou | 42501 |
| SQL | helper fechado _codigo_caixa_novo() anon | Passou | 42501 |
| SQL | helper fechado _codigo_caixa_novo() authenticated | Passou | 42501 |
| SQL | helper fechado _conferir_limite_fiado() anon | Passou | 42501 |
| SQL | helper fechado _conferir_limite_fiado() authenticated | Passou | 42501 |
| SQL | helper fechado _conferir_pin_dono(uuid,text) anon | Passou | 42501 |
| SQL | helper fechado _conferir_pin_dono(uuid,text) authenticated | Passou | 42501 |
| SQL | helper fechado _devolver_item_venda(uuid) anon | Passou | 42501 |
| SQL | helper fechado _devolver_item_venda(uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _entrar_no_deposito(uuid,jsonb,uuid,uuid) anon | Passou | 42501 |
| SQL | helper fechado _entrar_no_deposito(uuid,jsonb,uuid,uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _fechar_pedido_recebido(uuid) anon | Passou | 42501 |
| SQL | helper fechado _fechar_pedido_recebido(uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _fiado_link(uuid,uuid) anon | Passou | 42501 |
| SQL | helper fechado _fiado_link(uuid,uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _fiado_novo_token() anon | Passou | 42501 |
| SQL | helper fechado _fiado_novo_token() authenticated | Passou | 42501 |
| SQL | helper fechado _funcionario_caixa(text) anon | Passou | 42501 |
| SQL | helper fechado _funcionario_caixa(text) authenticated | Passou | 42501 |
| SQL | helper fechado _funcionario_da_chave(text) anon | Passou | 42501 |
| SQL | helper fechado _funcionario_da_chave(text) authenticated | Passou | 42501 |
| SQL | helper fechado _funcionario_recebe(text) anon | Passou | 42501 |
| SQL | helper fechado _funcionario_recebe(text) authenticated | Passou | 42501 |
| SQL | helper fechado _funcionario_repoe(text) anon | Passou | 42501 |
| SQL | helper fechado _funcionario_repoe(text) authenticated | Passou | 42501 |
| SQL | helper fechado _iniciar_operacao(uuid,uuid,uuid,text,text) anon | Passou | 42501 |
| SQL | helper fechado _iniciar_operacao(uuid,uuid,uuid,text,text) authenticated | Passou | 42501 |
| SQL | helper fechado _lancar_perda(uuid,uuid,uuid,uuid,text,numeric,text,text,uuid,uuid) anon | Passou | 42501 |
| SQL | helper fechado _lancar_perda(uuid,uuid,uuid,uuid,text,numeric,text,text,uuid,uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _lote_da_parte(uuid,uuid,uuid,text,date) anon | Passou | 42501 |
| SQL | helper fechado _lote_da_parte(uuid,uuid,uuid,text,date) authenticated | Passou | 42501 |
| SQL | helper fechado _motivo_sem_reposicao(uuid,uuid) anon | Passou | 42501 |
| SQL | helper fechado _motivo_sem_reposicao(uuid,uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _novo_codigo_funcionario() anon | Passou | 42501 |
| SQL | helper fechado _novo_codigo_funcionario() authenticated | Passou | 42501 |
| SQL | helper fechado _por_saldo(uuid,uuid,uuid,area_estoque,uuid,boolean,boolean,numeric,uuid,uuid,uuid,tipo_movimento,uuid) anon | Passou | 42501 |
| SQL | helper fechado _por_saldo(uuid,uuid,uuid,area_estoque,uuid,boolean,boolean,numeric,uuid,uuid,uuid,tipo_movimento,uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _produto_para_funcionario(uuid,uuid,uuid) anon | Passou | 42501 |
| SQL | helper fechado _produto_para_funcionario(uuid,uuid,uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _produtos_visados(uuid) anon | Passou | 42501 |
| SQL | helper fechado _produtos_visados(uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _registrar_diferenca(uuid,uuid,uuid,area_estoque,text,numeric,numeric,uuid,uuid,jsonb) anon | Passou | 42501 |
| SQL | helper fechado _registrar_diferenca(uuid,uuid,uuid,area_estoque,text,numeric,numeric,uuid,uuid,jsonb) authenticated | Passou | 42501 |
| SQL | helper fechado _resumo_turno(uuid) anon | Passou | 42501 |
| SQL | helper fechado _resumo_turno(uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _saldo_reponivel(uuid,uuid) anon | Passou | 42501 |
| SQL | helper fechado _saldo_reponivel(uuid,uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _salvar_embalagens(uuid,uuid,jsonb) anon | Passou | 42501 |
| SQL | helper fechado _salvar_embalagens(uuid,uuid,jsonb) authenticated | Passou | 42501 |
| SQL | helper fechado _tirar_saldo(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid,tipo_movimento,uuid) anon | Passou | 42501 |
| SQL | helper fechado _tirar_saldo(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid,tipo_movimento,uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _tirar_saldo_reposicao(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid,tipo_movimento,uuid) anon | Passou | 42501 |
| SQL | helper fechado _tirar_saldo_reposicao(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid,tipo_movimento,uuid) authenticated | Passou | 42501 |
| SQL | helper fechado _unidades_item(uuid,uuid,numeric) anon | Passou | 42501 |
| SQL | helper fechado _unidades_item(uuid,uuid,numeric) authenticated | Passou | 42501 |
| SQL | dono sem acesso anon atualizar_funcionario(uuid,text,text) | Passou | 42501 |
| SQL | dono sem acesso anon atualizar_pagamento(uuid,jsonb) | Passou | 42501 |
| SQL | dono sem acesso anon bloquear_funcionario(uuid,boolean) | Passou | 42501 |
| SQL | dono sem acesso anon cancelar_pedido(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon cancelar_venda_celular(uuid,text) | Passou | 42501 |
| SQL | dono sem acesso anon conferir_fechamento_caixa(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon criar_caixa(uuid,text) | Passou | 42501 |
| SQL | dono sem acesso anon criar_funcionario(uuid,text,text) | Passou | 42501 |
| SQL | dono sem acesso anon decidir_perda(uuid,boolean) | Passou | 42501 |
| SQL | dono sem acesso anon definir_caixa_funcionario(uuid,boolean) | Passou | 42501 |
| SQL | dono sem acesso anon definir_limite_faltas(uuid,numeric) | Passou | 42501 |
| SQL | dono sem acesso anon definir_limite_fiado(uuid,numeric,boolean) | Passou | 42501 |
| SQL | dono sem acesso anon definir_pin_dono(text) | Passou | 42501 |
| SQL | dono sem acesso anon desligar_caixa(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon explicar_diferenca(uuid,text,text) | Passou | 42501 |
| SQL | dono sem acesso anon fiado_acesso_info(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon fiado_cliente_link(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon fiado_novo_link(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon fiado_zerar_pin(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon gerar_codigo_interno(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon marcar_pedido_enviado(uuid,text) | Passou | 42501 |
| SQL | dono sem acesso anon novo_acesso_funcionario(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon novo_codigo_caixa(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon novo_link_pedido(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon pode_acessar_comercio(uuid) | Passou | 42501 |
| SQL | dono sem acesso anon receber_fiado(uuid,uuid,numeric,text,text) | Passou | 42501 |
| SQL | dono sem acesso anon registrar_perda(jsonb) | Passou | 42501 |
| SQL | dono sem acesso anon renomear_caixa(uuid,text) | Passou | 42501 |
| SQL | dono sem acesso anon resolver_conferencia(uuid,numeric) | Passou | 42501 |
| SQL | dono sem acesso anon resolver_item_recebimento(uuid,text,integer) | Passou | 42501 |
| SQL | dono sem acesso anon resolver_item_venda(uuid,text,uuid,uuid,uuid) | Passou | 42501 |
| SQL | dono sem acesso anon resolver_pendencia(jsonb) | Passou | 42501 |
| SQL | dono sem acesso anon salvar_cadastro(jsonb) | Passou | 42501 |
| SQL | dono sem acesso anon salvar_cliente_fiado(uuid,uuid,text,text,boolean) | Passou | 42501 |
| SQL | dono sem acesso anon salvar_pedido(jsonb) | Passou | 42501 |
| SQL | dono sem acesso anon salvar_produto(jsonb) | Passou | 42501 |
| SQL | dono sem acesso anon tem_pin_dono() | Passou | 42501 |
| SQL | anon nao le caixa_sangrias | Passou | 42501 |
| SQL | anon nao le caixa_turnos | Passou | 42501 |
| SQL | anon nao le caixas | Passou | 42501 |
| SQL | anon nao le clientes_fiado | Passou | 42501 |
| SQL | anon nao le codigos_barras | Passou | 42501 |
| SQL | anon nao le codigos_pdv | Passou | 42501 |
| SQL | anon nao le comercios | Passou | Retorno conferido |
| SQL | anon nao le conferencias | Passou | 42501 |
| SQL | anon nao le contagens | Passou | 42501 |
| SQL | anon nao le diferencas | Passou | 42501 |
| SQL | anon nao le dono_pin | Passou | 42501 |
| SQL | anon nao le fiado_acessos | Passou | Retorno conferido |
| SQL | anon nao le fiado_movimentos | Passou | 42501 |
| SQL | anon nao le fornecedores | Passou | Retorno conferido |
| SQL | anon nao le funcionario_aparelhos | Passou | 42501 |
| SQL | anon nao le funcionarios | Passou | 42501 |
| SQL | anon nao le locais | Passou | 42501 |
| SQL | anon nao le lotes | Passou | 42501 |
| SQL | anon nao le movimentos | Passou | 42501 |
| SQL | anon nao le operacoes | Passou | 42501 |
| SQL | anon nao le pedido_itens | Passou | Retorno conferido |
| SQL | anon nao le pedidos_compra | Passou | Retorno conferido |
| SQL | anon nao le perdas | Passou | 42501 |
| SQL | anon nao le produto_areas | Passou | 42501 |
| SQL | anon nao le produto_embalagens | Passou | 42501 |
| SQL | anon nao le produto_variacoes | Passou | Retorno conferido |
| SQL | anon nao le produtos | Passou | Retorno conferido |
| SQL | anon nao le profiles | Passou | Retorno conferido |
| SQL | anon nao le recebimento_itens | Passou | 42501 |
| SQL | anon nao le recebimentos | Passou | 42501 |
| SQL | anon nao le reposicoes | Passou | 42501 |
| SQL | anon nao le saldos | Passou | 42501 |
| SQL | anon nao le user_roles | Passou | Retorno conferido |
| SQL | anon nao le venda_itens | Passou | 42501 |
| SQL | anon nao le vendas | Passou | 42501 |
| SQL | owner A nao le B produtos | Passou | Retorno conferido |
| SQL | owner A nao grava direto produtos | Passou | 42501 |
| SQL | owner A nao le B saldos | Passou | Retorno conferido |
| SQL | owner A nao grava direto saldos | Passou | 42501 |
| SQL | owner A nao le B contagens | Passou | Retorno conferido |
| SQL | owner A nao grava direto contagens | Passou | 42501 |
| SQL | owner A nao le B operacoes | Passou | Retorno conferido |
| SQL | owner A nao grava direto operacoes | Passou | 42501 |
| SQL | owner A nao le B movimentos | Passou | Retorno conferido |
| SQL | owner A nao grava direto movimentos | Passou | 42501 |
| SQL | owner A nao le B pedidos_compra | Passou | Retorno conferido |
| SQL | owner A nao grava direto pedidos_compra | Passou | 42501 |
| SQL | owner A nao le B pedido_itens | Passou | Retorno conferido |
| SQL | owner A nao grava direto pedido_itens | Passou | 42501 |
| SQL | owner A nao le B recebimentos | Passou | Retorno conferido |
| SQL | owner A nao grava direto recebimentos | Passou | 42501 |
| SQL | owner A nao le B clientes_fiado | Passou | Retorno conferido |
| SQL | owner A nao grava direto clientes_fiado | Passou | 42501 |
| SQL | owner A nao le B fiado_acessos | Passou | Retorno conferido |
| SQL | owner A nao grava direto fiado_acessos | Passou | 42501 |
| SQL | owner A nao le B vendas | Passou | Retorno conferido |
| SQL | owner A nao grava direto vendas | Passou | 42501 |
| SQL | A enxerga suas duas lojas | Passou | Retorno conferido |
| SQL | B so enxerga B | Passou | Retorno conferido |
| SQL | owner A objeto B criar_funcionario | Passou | 42501 |
| SQL | owner A objeto B criar_caixa | Passou | 42501 |
| SQL | owner A objeto B gerar_codigo_interno | Passou | 42501 |
| SQL | owner A objeto B definir_limite_faltas | Passou | 42501 |
| SQL | owner A objeto B bloquear_funcionario | Passou | 42501 |
| SQL | owner A objeto B novo_acesso_funcionario | Passou | 42501 |
| SQL | owner A objeto B definir_caixa_funcionario | Passou | 42501 |
| SQL | owner A objeto B desligar_caixa | Passou | 42501 |
| SQL | owner A objeto B cancelar_pedido | Passou | 42501 |
| SQL | owner A objeto B novo_link_pedido | Passou | 42501 |
| SQL | owner A objeto B fiado_cliente_link | Passou | 42501 |
| SQL | owner A objeto B fiado_novo_link | Passou | 42501 |
| SQL | owner A objeto B fiado_zerar_pin | Passou | 42501 |
| SQL | owner A objeto B definir_limite_fiado | Passou | 42501 |
| SQL | owner A objeto B salvar_cliente_fiado | Passou | 42501 |
| SQL | produto outra loja contagem deposito a2 | Passou | 42501 |
| SQL | produto outra loja contagem gondola a2 | Passou | 42501 |
| SQL | produto outra loja perda a2 | Passou | 42501 |
| SQL | pedido outra loja a2 | Passou | 42501 |
| SQL | recebimento outra loja a2 | Passou | 42501 |
| SQL | cliente outra loja a2 | Passou | P0001 |
| SQL | link fiado outra loja a2 | Passou | P0001 |
| SQL | cliente UUID outra loja criar a2 | Passou | 42501 |
| SQL | produto outra loja contagem deposito b1 | Passou | 42501 |
| SQL | produto outra loja contagem gondola b1 | Passou | 42501 |
| SQL | produto outra loja perda b1 | Passou | 42501 |
| SQL | pedido outra loja b1 | Passou | 42501 |
| SQL | recebimento outra loja b1 | Passou | 42501 |
| SQL | cliente outra loja b1 | Passou | P0001 |
| SQL | link fiado outra loja b1 | Passou | P0001 |
| SQL | cliente UUID outra loja criar b1 | Passou | 42501 |
| SQL | legitimo inicio equipe | Passou | Retorno conferido |
| SQL | legitimo produtos caixa | Passou | Retorno conferido |
| SQL | bloqueado funcionario_inicio | Passou | Retorno conferido |
| SQL | bloqueado caixa_produtos | Passou | 42501 |
| SQL | bloqueado funcionario_conferencia_lista | Passou | 42501 |
| SQL | novo acesso funcionario_inicio | Passou | Retorno conferido |
| SQL | novo acesso caixa_produtos | Passou | 42501 |
| SQL | novo acesso funcionario_conferencia_lista | Passou | 42501 |
| SQL | logout funcionario_inicio | Passou | Retorno conferido |
| SQL | logout caixa_produtos | Passou | 42501 |
| SQL | logout funcionario_conferencia_lista | Passou | 42501 |
| SQL | pin expirado funcionario_inicio | Passou | Retorno conferido |
| SQL | pin expirado caixa_produtos | Passou | 42501 |
| SQL | pin expirado funcionario_conferencia_lista | Passou | 42501 |
| SQL | modulo receber nao repoe | Passou | 42501 |
| SQL | modulo repor nao recebe | Passou | 42501 |
| SQL | caixa retirado impede leitura | Passou | 42501 |
| SQL | conector desligado | Passou | Retorno conferido |
| SQL | fiado sessao trocada 15 | Passou | 42501 |
| SQL | fiado sessao trocada 16 | Passou | 42501 |
| SQL | fiado sessao trocada 34 | Passou | 42501 |
| SQL | fiado legitimo | Passou | Retorno conferido |
| SQL | fornecedor item outra loja | Passou | 42501 |
| SQL | UUID conferencia outra loja a2 | Passou | 42501 |
| SQL | UUID reposicao outra loja a2 | Passou | 42501 |
| SQL | UUID venda repetida outra loja a2 | Passou | 42501 |
| SQL | UUID venda cancelar outra loja a2 | Passou | 42501 |
| SQL | pedido salvar produto outra loja a2 | Passou | 42501 |
| SQL | UUID conferencia outra loja b1 | Passou | 42501 |
| SQL | UUID reposicao outra loja b1 | Passou | 42501 |
| SQL | UUID venda repetida outra loja b1 | Passou | 42501 |
| SQL | UUID venda cancelar outra loja b1 | Passou | 42501 |
| SQL | pedido salvar produto outra loja b1 | Passou | 42501 |
| SQL | turno fechar outra pessoa a2 | Passou | 42501 |
| SQL | turno venda outra pessoa a2 | Passou | 42501 |
| SQL | turno sangria outra pessoa a2 | Passou | 42501 |
| SQL | turno fechar outra pessoa b1 | Passou | 42501 |
| SQL | turno venda outra pessoa b1 | Passou | 42501 |
| SQL | turno sangria outra pessoa b1 | Passou | 42501 |
| SQL | turno fechar outra pessoa a1-extra | Passou | 42501 |
| SQL | turno venda outra pessoa a1-extra | Passou | 42501 |
| SQL | turno sangria outra pessoa a1-extra | Passou | 42501 |
| SQL | fornecedor link antigo encerrado | Passou | Retorno conferido |
| SQL | cliente link antigo encerrado | Passou | Retorno conferido |
| SQL | dono B nao le perfis A | Passou | Retorno conferido |
| SQL | dono B nao le papeis A | Passou | Retorno conferido |
| SQL | papel global gerente nao abre loja | Passou | Retorno conferido |
| SQL | gerente nao le lojas | Passou | Retorno conferido |
| SQL | gerente nao cria equipe em A | Passou | 42501 |
| SQL | cadastro dono A loja B | Passou | 42501 |
| SQL | cadastro produto A1 movido para A2 | Passou | 42501 |
| SQL | cadastro reusa operacao B em loja A | Passou | 23505 |
| HTTP | owner A duas lojas | Passou | HTTP 200 |
| HTTP | owner B somente B | Passou | HTTP 200 |
| HTTP | HTTP owner A filtra B produtos | Passou | HTTP 200 |
| HTTP | HTTP owner B filtra A produtos | Passou | HTTP 200 |
| HTTP | HTTP owner A filtra B saldos | Passou | HTTP 200 |
| HTTP | HTTP owner B filtra A saldos | Passou | HTTP 200 |
| HTTP | HTTP owner A filtra B contagens | Passou | HTTP 200 |
| HTTP | HTTP owner B filtra A contagens | Passou | HTTP 200 |
| HTTP | HTTP owner A filtra B operacoes | Passou | HTTP 200 |
| HTTP | HTTP owner B filtra A operacoes | Passou | HTTP 200 |
| HTTP | HTTP owner A filtra B pedidos_compra | Passou | HTTP 200 |
| HTTP | HTTP owner B filtra A pedidos_compra | Passou | HTTP 200 |
| HTTP | HTTP owner A filtra B pedido_itens | Passou | HTTP 200 |
| HTTP | HTTP owner B filtra A pedido_itens | Passou | HTTP 200 |
| HTTP | HTTP owner A filtra B recebimentos | Passou | HTTP 200 |
| HTTP | HTTP owner B filtra A recebimentos | Passou | HTTP 200 |
| HTTP | HTTP owner A filtra B clientes_fiado | Passou | HTTP 200 |
| HTTP | HTTP owner B filtra A clientes_fiado | Passou | HTTP 200 |
| HTTP | HTTP owner A filtra B fiado_acessos | Passou | HTTP 200 |
| HTTP | HTTP owner B filtra A fiado_acessos | Passou | HTTP 200 |
| HTTP | HTTP owner A filtra B caixa_turnos | Passou | HTTP 200 |
| HTTP | HTTP owner B filtra A caixa_turnos | Passou | HTTP 200 |
| HTTP | HTTP owner A filtra B vendas | Passou | HTTP 200 |
| HTTP | HTTP owner B filtra A vendas | Passou | HTTP 200 |
| HTTP | equipe A1 positiva | Passou | HTTP 200 |
| HTTP | caixa A1 positivo | Passou | HTTP 200 |
| HTTP | conector A1 positivo | Passou | HTTP 200 |
| HTTP | fornecedor A1 positivo | Passou | HTTP 200 |
| HTTP | fiado A1 positivo | Passou | HTTP 200 |
| HTTP | HTTP contagem troca loja a2 | Passou | HTTP 401 |
| HTTP | HTTP recebimento troca loja a2 | Passou | HTTP 401 |
| HTTP | HTTP cliente troca loja a2 | Passou | HTTP 400 |
| HTTP | HTTP contagem troca loja b1 | Passou | HTTP 401 |
| HTTP | HTTP recebimento troca loja b1 | Passou | HTTP 401 |
| HTTP | HTTP cliente troca loja b1 | Passou | HTTP 400 |
| HTTP | HTTP fiado sessao A token B | Passou | HTTP 401 |
| HTTP | HTTP fornecedor item B token A | Passou | HTTP 401 |
| HTTP | JWT assinatura falsificada | Passou | HTTP 401 |
| HTTP | HTTP helper fechado _funcionario_da_chaveNone | Passou | HTTP 401 |
| HTTP | HTTP helper fechado _funcionario_da_chavedono-a | Passou | HTTP 403 |
| HTTP | HTTP helper fechado _caixa_da_chaveNone | Passou | HTTP 401 |
| HTTP | HTTP helper fechado _caixa_da_chavedono-a | Passou | HTTP 403 |
| HTTP | anon endpoint do dono | Passou | HTTP 401 |
| HTTP | owner A administra equipe B | Passou | HTTP 403 |
| HTTP | owner A altera loja B | Passou | HTTP 204 |
| HTTP | B permanece com seu nome | Passou | HTTP 200 |
| HTTP | HTTP escrita direta fechada saldosNone | Passou | HTTP 401 |
| HTTP | HTTP escrita direta fechada saldosdono-a | Passou | HTTP 403 |
| HTTP | HTTP escrita direta fechada movimentosNone | Passou | HTTP 401 |
| HTTP | HTTP escrita direta fechada movimentosdono-a | Passou | HTTP 403 |
| HTTP | HTTP escrita direta fechada operacoesNone | Passou | HTTP 401 |
| HTTP | HTTP escrita direta fechada operacoesdono-a | Passou | HTTP 403 |
| HTTP | HTTP escrita direta fechada recebimento_itensNone | Passou | HTTP 401 |
| HTTP | HTTP escrita direta fechada recebimento_itensdono-a | Passou | HTTP 403 |
| HTTP | HTTP escrita direta fechada vendasNone | Passou | HTTP 401 |
| HTTP | HTTP escrita direta fechada vendasdono-a | Passou | HTTP 403 |
| HTTP | HTTP escrita direta fechada fiado_movimentosNone | Passou | HTTP 401 |
| HTTP | HTTP escrita direta fechada fiado_movimentosdono-a | Passou | HTTP 403 |
| HTTP | HTTP gerente global nao le lojas | Passou | HTTP 200 |
| HTTP | HTTP perfil dono isolado | Passou | HTTP 200 |
| HTTP | HTTP papeis dono isolados | Passou | HTTP 200 |
| HTTP | HTTP owner A leitura legitima produtos | Passou | HTTP 200 |
| HTTP | HTTP owner A leitura legitima saldos | Passou | HTTP 200 |
| HTTP | HTTP owner A leitura legitima contagens | Passou | HTTP 200 |
| HTTP | HTTP owner A leitura legitima operacoes | Passou | HTTP 200 |
| HTTP | HTTP owner A leitura legitima pedidos_compra | Passou | HTTP 200 |
| HTTP | HTTP owner A leitura legitima pedido_itens | Passou | HTTP 200 |
| HTTP | HTTP owner A leitura legitima recebimentos | Passou | HTTP 200 |
| HTTP | HTTP owner A leitura legitima clientes_fiado | Passou | HTTP 200 |
| HTTP | HTTP owner A leitura legitima caixa_turnos | Passou | HTTP 200 |
| HTTP | HTTP owner A leitura legitima vendas | Passou | HTTP 200 |
| HTTP | HTTP credenciais do fiado nao lidas direto nem pelo dono | Passou | HTTP 200 |
| HTTP | HTTP dono consulta fiado pelo endpoint proprio | Passou | HTTP 200 |
| HTTP | HTTP dono A nao consulta acesso fiado B | Passou | HTTP 403 |

</details>

<details>
<summary>Roteiro e scripts integrais do ensaio local — não são migrações</summary>

Somente em pasta/servidor privado novo. Requer os binários locais de PostgreSQL 17/PostgREST 16.4 que já foram usados neste ambiente; em outro ambiente, ajustar somente os caminhos dos binários e checkout. Os scripts nunca aceitam URL ou credencial de produção. A pasta `/tmp/omni-g11-auditoria` não pode conter um servidor/dados que se queira preservar. Extrair os blocos com os nomes indicados para essa pasta; marcar iniciar.sh/psql.sh executáveis. Não colocar estes blocos em `supabase/migrations` nem executar fixtures no SQL Editor.

```bash
python3 /tmp/omni-g11-auditoria/preparar.py
bash /tmp/omni-g11-auditoria/iniciar.sh
/tmp/omni-g11-auditoria/psql.sh -q -f /tmp/omni-g11-auditoria/base.sql
/tmp/omni-g11-auditoria/psql.sh -q -f /tmp/omni-g11-auditoria/base_extra.sql
python3 /tmp/omni-g11-auditoria/exportar.py
python3 /tmp/omni-g11-auditoria/testar_sql.py
python3 /tmp/omni-g11-auditoria/iniciar_api.py
python3 /tmp/omni-g11-auditoria/testar_http.py
```

**preparar.py**

```python
from pathlib import Path
b=Path('/tmp/omni-g11-auditoria');b.joinpath('socket').mkdir(parents=True,exist_ok=True)
f=Path('/workspace/mock-overlay-magic/docs/persistencia/teste/000_base_simulada.sql').read_text()
ancora='grant usage on schema auth, public to anon, authenticated, service_role;'
assert f.count(ancora)==1
padroes='\nalter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;\nalter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;\nalter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;\n'
b.joinpath('000_base_nativa.sql').write_text(f.replace(ancora,ancora+padroes))
```

**iniciar.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
export PATH="/tmp/omni-pg-runtime/usr/lib/postgresql/17/bin:$PATH"
export LD_LIBRARY_PATH="/tmp/omni-pg-runtime/usr/lib/x86_64-linux-gnu"
base_g11=/tmp/omni-g11-auditoria
repo_g11=/workspace/mock-overlay-magic
initdb -D "$base_g11/dados" -U postgres -A trust --no-locale > "$base_g11/init.log"
pg_ctl -D "$base_g11/dados" -o "-k $base_g11/socket -c listen_addresses=''" -l "$base_g11/servidor.log" start
sql_g11=(psql -h "$base_g11/socket" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q)
for arquivo_g11 in "$base_g11/000_base_nativa.sql" "$repo_g11/docs/persistencia/teste/000_base_operacional.sql"; do
  "${sql_g11[@]}" -1 -f "$arquivo_g11" >>"$base_g11/setup.log" 2>&1
done
for migracao_g11 in "$repo_g11"/supabase/migrations/*.sql; do
  case "$(basename "$migracao_g11")" in 20261010111223_*|20261010111310_*|20261010125732_*) continue;; esac
  "${sql_g11[@]}" -1 -f "$migracao_g11" >>"$base_g11/setup.log" 2>&1 || { tail -12 "$base_g11/setup.log"; exit 1; }
  basename "$migracao_g11" >>"$base_g11/migracoes-aplicadas.txt"
done
```

**psql.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
export LD_LIBRARY_PATH="/tmp/omni-pg-runtime/usr/lib/x86_64-linux-gnu"
exec /tmp/omni-pg-runtime/usr/lib/postgresql/17/bin/psql -h /tmp/omni-g11-auditoria/socket -U postgres -d postgres -v ON_ERROR_STOP=1 -X "$@"
```

**base.sql**

```sql
-- Dados ficticios exclusivos deste PostgreSQL privado.
begin;
create or replace function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
create function pg_temp.u(t text) returns uuid language sql immutable as $$select md5('g11-ficticio-'||t)::uuid$$;
insert into auth.users(id,email) values(pg_temp.u('dono-a'),'g11-a@example.invalid'),(pg_temp.u('dono-b'),'g11-b@example.invalid'),(pg_temp.u('gerente'),'g11-gerente@example.invalid');
insert into user_roles(user_id,role) values(pg_temp.u('dono-a'),'dono'),(pg_temp.u('dono-b'),'dono'),(pg_temp.u('gerente'),'gerente');
insert into profiles(id) values(pg_temp.u('dono-a')),(pg_temp.u('dono-b'));
insert into comercios(id,dono_id,tipo,nome,documento_tipo,documento,telefone,cep,rua,numero,bairro,cidade,uf)
select pg_temp.u(c),pg_temp.u(d),'mercado','Loja ficticia '||c,'cpf','52998224725','11999998888','01001000','Rua ficticia','1','Teste','Sao Paulo','SP'
from (values('a1','dono-a'),('a2','dono-a'),('b1','dono-b')) t(c,d);
insert into fornecedores(id,dono_id,nome) values(pg_temp.u('forn-a'),pg_temp.u('dono-a'),'Fornecedor ficticio A'),(pg_temp.u('forn-b'),pg_temp.u('dono-b'),'Fornecedor ficticio B');
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por,caixa)
select pg_temp.u('f-'||c),pg_temp.u(c),'Equipe ficticia '||c,'ambos',cod,pg_temp.u(d),true from (values('a1','dono-a','912341'),('a2','dono-a','912342'),('b1','dono-b','912343')) t(c,d,cod);
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate)
select pg_temp.u('f-'||c),pg_temp.u(c),encode(extensions.digest(repeat(ch,64),'sha256'),'hex'),now()+interval '1 hour' from (values('a1','a'),('a2','b'),('b1','c'))t(c,ch);
-- Salvar legitimamente pelos mesmos endpoints do app, um produto em cada loja.
select set_config('request.jwt.claim.sub',pg_temp.u('dono-a')::text,true);
set local role authenticated;
select salvar_cadastro(jsonb_build_object('operacao_id',pg_temp.u('op-'||c),'pendencias','[]'::jsonb,
'produto_pedido',jsonb_build_object('operacao_id',pg_temp.u('op-prod-'||c),
'produto',jsonb_build_object('id',pg_temp.u('prod-'||c),'comercio_id',pg_temp.u(c),'nome','Produto ficticio '||c,'categoria','Mercearia','unidade','Unidade','preco_compra',2,'preco_venda',4,'controla_validade',false,'avisos_dias','[]'::jsonb,'detalhes','{}'::jsonb),
'variacoes','[]'::jsonb,'embalagens','[]'::jsonb,
'areas',jsonb_build_array(jsonb_build_object('area','deposito','minimo',5,'maximo',100,'contagem',jsonb_build_object('quantidade',20,'partes','[]'::jsonb)),jsonb_build_object('area','venda','minimo',10,'maximo',100,'contagem',jsonb_build_object('quantidade',8,'partes','[]'::jsonb))))))from(values('a1'),('a2'))t(c);
reset role;
select set_config('request.jwt.claim.sub',pg_temp.u('dono-b')::text,true);
set local role authenticated;
select salvar_cadastro(jsonb_build_object('operacao_id',pg_temp.u('op-b1'),'pendencias','[]'::jsonb,
'produto_pedido',jsonb_build_object('operacao_id',pg_temp.u('op-prod-b1'),
'produto',jsonb_build_object('id',pg_temp.u('prod-b1'),'comercio_id',pg_temp.u('b1'),'nome','Produto ficticio b1','categoria','Mercearia','unidade','Unidade','preco_compra',2,'preco_venda',4,'controla_validade',false,'avisos_dias','[]'::jsonb,'detalhes','{}'::jsonb),
'variacoes','[]'::jsonb,'embalagens','[]'::jsonb,
'areas',jsonb_build_array(jsonb_build_object('area','deposito','minimo',5,'maximo',100,'contagem',jsonb_build_object('quantidade',20,'partes','[]'::jsonb)),jsonb_build_object('area','venda','minimo',10,'maximo',100,'contagem',jsonb_build_object('quantidade',8,'partes','[]'::jsonb))))));
reset role;
insert into pedidos_compra(id,comercio_id,fornecedor_id,numero,situacao,token,criado_por)
select pg_temp.u('ped-'||c),pg_temp.u(c),pg_temp.u(f),1,'enviado',repeat(ch,64),pg_temp.u(d) from(values('a1','forn-a','dono-a','d'),('a2','forn-a','dono-a','e'),('b1','forn-b','dono-b','f'))t(c,f,d,ch);
insert into pedido_itens(id,pedido_id,comercio_id,produto_id,qtd_embalagens,qtd_unidades)
select pg_temp.u('item-'||c),pg_temp.u('ped-'||c),pg_temp.u(c),pg_temp.u('prod-'||c),1,1 from(values('a1'),('a2'),('b1'))t(c);
insert into recebimentos(id,comercio_id,funcionario_id,situacao)
select pg_temp.u('rec-'||c),pg_temp.u(c),pg_temp.u('f-'||c),'contando' from(values('a1'),('a2'),('b1'))t(c);
insert into clientes_fiado(id,comercio_id,nome,telefone)
select pg_temp.u('cliente-'||c),pg_temp.u(c),'Cliente ficticio '||c,'11999991234' from(values('a1'),('a2'),('b1'))t(c);
insert into fiado_acessos(cliente_id,comercio_id,token,pin_hash,sessao_hash,sessao_ate)
select pg_temp.u('cliente-'||c),pg_temp.u(c),repeat(ch,64),extensions.crypt('7391',extensions.gen_salt('bf',8)),encode(extensions.digest(repeat(ses,64),'sha256'),'hex'),now()+interval '1 hour'from(values('a1','1','4'),('a2','2','5'),('b1','3','6'))t(c,ch,ses);
insert into caixas(id,comercio_id,nome,codigo,chave_hash,tipo)
select pg_temp.u('con-'||c),pg_temp.u(c),'Conector ficticio '||c,cod,encode(extensions.digest(repeat(ch,64),'sha256'),'hex'),'computador' from(values('a1','98123101','7'),('a2','98123202','8'),('b1','98123303','9'))t(c,cod,ch);
update comercios set proximo_numero_pedido=2;
commit;
```

**base_extra.sql**

```sql
begin;
create function pg_temp.u(t text) returns uuid language sql immutable as $$select md5('g11-ficticio-'||t)::uuid$$;
insert into funcionarios(id,comercio_id,nome,funcao,codigo,criado_por,caixa) values(pg_temp.u('f-a1-extra'),pg_temp.u('a1'),'Segundo caixa ficticio','ambos','912344',pg_temp.u('dono-a'),true);
insert into funcionario_aparelhos(funcionario_id,comercio_id,chave_hash,desbloqueado_ate)values(pg_temp.u('f-a1-extra'),pg_temp.u('a1'),encode(extensions.digest(repeat('0',64),'sha256'),'hex'),now()+interval '1 hour');
set local role anon;
select caixa_abrir(repeat(ch,64),pg_temp.u('turno-'||c),0)from(values('a1','a'),('a2','b'),('b1','c'),('a1-extra','0'))t(c,ch);
select caixa_registrar_venda(repeat(ch,64),jsonb_build_object('id',pg_temp.u('venda-'||c),'turno_id',pg_temp.u('turno-'||c),'feita_em',now(),
'itens',jsonb_build_array(jsonb_build_object('produto_id',pg_temp.u('prod-'||c),'qtd',1,'preco',4)),
'pagamentos',jsonb_build_array(jsonb_build_object('forma','dinheiro','valor',4))))from(values('a1','a'),('a2','b'),('b1','c'))t(c,ch);
reset role;
insert into conferencias(id,comercio_id,produto_id,funcionario_id,area)
select pg_temp.u('cf-'||c),pg_temp.u(c),pg_temp.u('prod-'||c),pg_temp.u('f-'||c),'deposito'from(values('a2'),('b1'))t(c);
insert into reposicoes(id,comercio_id,produto_id,funcionario_id,contado,esperado,sugerido)
select pg_temp.u('rp-'||c),pg_temp.u(c),pg_temp.u('prod-'||c),pg_temp.u('f-'||c),7,7,0 from(values('a2'),('b1'))t(c);
commit;
```

**exportar.py**

```python
import json,subprocess
from pathlib import Path
base=Path('/tmp/omni-g11-auditoria')
consultas={
'inventario.json':"select jsonb_agg(jsonb_build_object('assinatura',p.oid::regprocedure::text,'args',array(select format_type(t,null) from unnest(p.proargtypes) t),'definer',p.prosecdef,'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'auth',has_function_privilege('authenticated',p.oid,'EXECUTE'),'config',p.proconfig) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'",
'corpos.json':"select jsonb_agg(jsonb_build_object('assinatura',p.oid::regprocedure::text,'corpo',pg_get_functiondef(p.oid)) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'",
 'tabelas.json':"select jsonb_agg(jsonb_build_object('tabela',c.relname,'rls',c.relrowsecurity,'anon_select',has_table_privilege('anon',c.oid,'SELECT'),'auth_select',has_table_privilege('authenticated',c.oid,'SELECT'),'auth_update',has_table_privilege('authenticated',c.oid,'UPDATE')) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
 'politicas.json':"select jsonb_agg(jsonb_build_object('tabela',tablename,'nome',policyname,'papeis',roles,'comando',cmd,'usando',qual,'checagem',with_check) order by tablename,policyname) from pg_policies where schemaname='public'"}
for nome,sql in consultas.items():
 r=subprocess.run([str(base/'psql.sh'),'-Atc',sql],capture_output=True,text=True,check=True);(base/nome).write_text(r.stdout)
f=json.loads((base/'inventario.json').read_text());print('Funcoes:',len(f));print('Helpers publicos:',[x['assinatura'] for x in f if x['assinatura'].startswith('_') and(x['anon'] or x['auth'])])
t=json.loads((base/'tabelas.json').read_text());print('Tabelas:',len(t),'RLS em todas:',all(x['rls'] for x in t))
```

**testar_sql.py**

```python
import hashlib,json,re,subprocess
from pathlib import Path
B=Path('/tmp/omni-g11-auditoria'); resultados=[]
def u(x):return str(__import__('uuid').UUID(hashlib.md5(('g11-ficticio-'+x).encode()).hexdigest()))
def q(x):return "'"+str(x).replace("'","''")+"'"
def uid(x):return q(u(x))+"::uuid"
def executar(nome,sql,papel='anon',dono=None,estado=None,valor=None,prefixo=''):
    texto='begin;'+prefixo+';'
    if dono:texto+='set local request.jwt.claim.sub='+q(u(dono))+';'
    texto+='set local role '+papel+';'+sql+';rollback;'
    assert 'delete' not in texto.lower()
    r=subprocess.run([str(B/'psql.sh'),'-qAt','-P','null=[SQL_NULL]','-v','VERBOSITY=verbose'],input=texto,text=True,capture_output=True)
    m=re.search(r'ERROR:\s+([A-Z0-9]{5}):\s+([^\n]+)',r.stderr)
    atual=m.group(1) if m else None
    ok=(r.returncode!=0 and atual==estado) if estado else r.returncode==0
    if valor is not None and ok:ok=bool(valor(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ''))
    resultados.append({'caso':nome,'passou':ok,'sqlstate':atual,'mensagem':m.group(2) if m else None})
    if not ok:print('FALHOU',nome,atual,m.group(2) if m else r.stdout[-120:])
# Permissoes: todos os helpers internos e endpoints do dono fechados para anon.
inventario=json.loads((B/'inventario.json').read_text())
for f in inventario:
    nome=f['assinatura'].split('(')[0]
    chamada='select public.'+nome+'('+','.join('null::'+x for x in f['args'])+')'
    if nome.startswith('_'):
        for papel in ['anon','authenticated']:executar('helper fechado '+f['assinatura']+' '+papel,chamada,papel,estado='42501')
    if f['auth'] and not f['anon']:executar('dono sem acesso anon '+f['assinatura'],chamada,estado='42501')
# RLS e escrita direta: tabelas anon sempre recusadas; dados reais da outra loja nao aparecem.
for t in json.loads((B/'tabelas.json').read_text()):
    executar('anon nao le '+t['tabela'],'select count(*) from public.'+t['tabela'],estado=None if t['anon_select'] else '42501',valor=(lambda x:x=='0') if t['anon_select'] else None)
for t in ['produtos','saldos','contagens','operacoes','movimentos','pedidos_compra','pedido_itens','recebimentos','clientes_fiado','fiado_acessos','vendas']:
    executar('owner A nao le B '+t,'select count(id) from public.'+t+' where comercio_id='+uid('b1'),'authenticated','dono-a',valor=lambda x:x=='0')
    executar('owner A nao grava direto '+t,'insert into public.'+t+' default values','authenticated','dono-a',estado='42501')
executar('A enxerga suas duas lojas','select count(*) from comercios','authenticated','dono-a',valor=lambda x:x=='2')
executar('B so enxerga B','select count(*) from comercios','authenticated','dono-b',valor=lambda x:x=='1')
# Owner com IDs de outra pessoa: caminhos variados, com parametros validos.
owner=[
('criar_funcionario','('+uid('b1')+",'Nome teste','ambos')",'sem_acesso_ao_comercio'),
('criar_caixa','('+uid('b1')+",'Caixa teste')",'sem_permissao'),
('gerar_codigo_interno','('+uid('b1')+')','sem_acesso_ao_comercio'),
('definir_limite_faltas','('+uid('b1')+',200)','sem_permissao'),
('bloquear_funcionario','('+uid('f-b1')+',true)','sem_acesso_ao_comercio'),
('novo_acesso_funcionario','('+uid('f-b1')+')','sem_acesso_ao_comercio'),
('definir_caixa_funcionario','('+uid('f-b1')+',false)','sem_acesso_ao_comercio'),
('desligar_caixa','('+uid('con-b1')+')','sem_permissao'),
('cancelar_pedido','('+uid('ped-b1')+')','sem_acesso_ao_comercio'),
('novo_link_pedido','('+uid('ped-b1')+')','sem_acesso_ao_comercio'),
('fiado_cliente_link','('+uid('cliente-b1')+')','sem_acesso_ao_comercio'),
('fiado_novo_link','('+uid('cliente-b1')+')','sem_acesso_ao_comercio'),
('fiado_zerar_pin','('+uid('cliente-b1')+')','sem_acesso_ao_comercio'),
('definir_limite_fiado','('+uid('cliente-b1')+',100,false)','sem_permissao'),
('salvar_cliente_fiado','('+uid('cliente-b1')+','+uid('b1')+",'Cliente teste','11999991234',true)",'sem_acesso_ao_comercio')]
for nome,args,_ in owner:executar('owner A objeto B '+nome,'select '+nome+args,'authenticated','dono-a',estado='42501')
# Chave de A1 com objeto A2 (mesmo dono) e B1 (outro dono).
for alvo in ['a2','b1']:
    k=q('a'*64)
    executar('produto outra loja contagem deposito '+alvo,'select funcionario_conferencia_contar('+k+','+uid('teste-conf-'+alvo)+','+uid('prod-'+alvo)+',null,8,1)',estado='42501')
    executar('produto outra loja contagem gondola '+alvo,'select funcionario_reposicao_contar('+k+','+uid('teste-gond-'+alvo)+','+uid('prod-'+alvo)+',null,8,1)',estado='42501')
    executar('produto outra loja perda '+alvo,'select funcionario_registrar_perda('+k+','+uid('perda-'+alvo)+','+uid('prod-'+alvo)+",null,'venda',1,'outro','Motivo ficticio')",estado='42501')
    executar('pedido outra loja '+alvo,'select funcionario_abrir_recebimento('+k+','+uid('rec-nova-'+alvo)+','+uid('ped-'+alvo)+',null)',estado='42501')
    executar('recebimento outra loja '+alvo,'select funcionario_enviar_recebimento('+k+','+uid('rec-'+alvo)+",0,'[]')",estado='42501')
    executar('cliente outra loja '+alvo,'select caixa_cliente_fiado_historico('+k+','+uid('cliente-'+alvo)+')',estado='P0001')
    executar('link fiado outra loja '+alvo,'select caixa_fiado_cliente_link('+k+','+uid('cliente-'+alvo)+')',estado='P0001')
    executar('cliente UUID outra loja criar '+alvo,'select caixa_salvar_cliente_fiado('+k+','+uid('cliente-'+alvo)+",'Nome ficticio','11999991234')",estado='42501')
# Revogacao autentica, expiracao do PIN, permissoes do modulo.
k=q('a'*64)
executar('legitimo inicio equipe','select funcionario_inicio('+k+')',valor=lambda x:'Loja ficticia a1' in x)
executar('legitimo produtos caixa','select jsonb_array_length(caixa_produtos('+k+'))',valor=lambda x:x=='1')
for motivo,prefixo,code in [
('bloqueado','select set_config(\'request.jwt.claim.sub\','+q(u('dono-a'))+',true);select bloquear_funcionario('+uid('f-a1')+',true)', '42501'),
('novo acesso','select set_config(\'request.jwt.claim.sub\','+q(u('dono-a'))+',true);select novo_acesso_funcionario('+uid('f-a1')+')','42501'),
('logout','select sair_funcionario('+k+')','42501'),
('pin expirado','update funcionario_aparelhos set desbloqueado_ate=now()-interval \'1 minute\' where funcionario_id='+uid('f-a1'),'42501')]:
    for func in ['funcionario_inicio','caixa_produtos','funcionario_conferencia_lista']:
        executar(motivo+' '+func,'select '+func+'('+k+')',estado=None if func=='funcionario_inicio' else code,prefixo=prefixo,valor=(lambda x:json.loads(x).get('pin_necessario') is True) if func=='funcionario_inicio' and motivo=='pin expirado' else (lambda x:x=='[SQL_NULL]') if func=='funcionario_inicio' else None)
executar('modulo receber nao repoe','select funcionario_reposicao_lista('+k+')',estado='42501',prefixo="update funcionarios set funcao='receber' where id="+uid('f-a1'))
executar('modulo repor nao recebe','select funcionario_entregas('+k+')',estado='42501',prefixo="update funcionarios set funcao='repor' where id="+uid('f-a1'))
executar('caixa retirado impede leitura','select caixa_produtos('+k+')',estado='42501',prefixo='update funcionarios set caixa=false where id='+uid('f-a1'))
executar('conector desligado','select conector_estado('+q('7'*64)+')',valor=lambda x:x=='[SQL_NULL]',prefixo='select set_config(\'request.jwt.claim.sub\','+q(u('dono-a'))+',true);select desligar_caixa('+uid('con-a1')+')')
# Vinculo de token/sessao: numeros sinteticos sem credencial real.
for token,sessao in [('1','5'),('1','6'),('3','4')]:
    executar('fiado sessao trocada '+token+sessao,'select fiado_publico_extrato('+q(token*64)+','+q(sessao*64)+')',estado='42501')
executar('fiado legitimo','select fiado_publico_extrato('+q('1'*64)+','+q('4'*64)+')',valor=lambda x:'Cliente ficticio a1' in x and 'Cliente ficticio b1' not in x)
executar('fornecedor item outra loja','select responder_pedido('+q('d'*64)+",jsonb_build_object('aceito',true,'previsao_entrega',current_date+1,'itens',jsonb_build_array(jsonb_build_object('id',"+uid('item-b1')+",'qtd_confirmada',1))))",estado='42501')

# Objetos existentes, turno da outra pessoa e referencias do dono.
for alvo in ['a2','b1']:
    executar('UUID conferencia outra loja '+alvo,'select funcionario_conferencia_contar('+k+','+uid('cf-'+alvo)+','+uid('prod-a1')+',null,20,1)',estado='42501')
    executar('UUID reposicao outra loja '+alvo,'select funcionario_reposicao_concluir('+k+','+uid('rp-'+alvo)+',1)',estado='42501')
    executar('UUID venda repetida outra loja '+alvo,'select caixa_registrar_venda('+k+",jsonb_build_object('id',"+uid('venda-'+alvo)+'))',estado='42501')
    executar('UUID venda cancelar outra loja '+alvo,'select caixa_cancelar_venda('+k+','+uid('venda-'+alvo)+",'7391','Motivo ficticio')",estado='42501')
    sql_ped = "select salvar_pedido(jsonb_build_object('id',%s,'comercio_id',%s,'fornecedor_id',%s,'itens',jsonb_build_array(jsonb_build_object('produto_id',%s,'qtd_embalagens',1))))" % (uid('pedido-teste-'+alvo),uid('a1'),uid('forn-a'),uid('prod-'+alvo))
    executar('pedido salvar produto outra loja '+alvo,sql_ped,'authenticated','dono-a',estado='42501')
for alvo in ['a2','b1','a1-extra']:
    executar('turno fechar outra pessoa '+alvo,'select caixa_fechar('+k+','+uid('turno-'+alvo)+",0,'Observacao ficticia')",estado='42501')
    executar('turno venda outra pessoa '+alvo,'select caixa_registrar_venda('+k+",jsonb_build_object('id',"+uid('venda-teste-'+alvo)+",'turno_id',"+uid('turno-'+alvo)+'))',estado='42501')
    executar('turno sangria outra pessoa '+alvo,'select caixa_sangria('+k+','+uid('sangria-'+alvo)+','+uid('turno-'+alvo)+",1,'Motivo ficticio','7391')",estado='42501')
executar('fornecedor link antigo encerrado','select pedido_publico('+q('d'*64)+')',valor=lambda x:x=='[SQL_NULL]',prefixo='set local request.jwt.claim.sub='+q(u('dono-a'))+';select novo_link_pedido('+uid('ped-a1')+')')
executar('cliente link antigo encerrado','select fiado_publico_estado('+q('1'*64)+')',valor=lambda x:json.loads(x)['estado']=='invalido',prefixo='set local request.jwt.claim.sub='+q(u('dono-a'))+';select fiado_novo_link('+uid('cliente-a1')+')')
executar('dono B nao le perfis A','select count(*) from profiles where id='+uid('dono-a'),'authenticated','dono-b',valor=lambda x:x=='0')
executar('dono B nao le papeis A','select count(*) from user_roles where user_id='+uid('dono-a'),'authenticated','dono-b',valor=lambda x:x=='0')

executar('papel global gerente nao abre loja','select pode_acessar_comercio('+uid('a1')+')','authenticated','gerente',valor=lambda x:x=='f')
executar('gerente nao le lojas','select count(*) from comercios','authenticated','gerente',valor=lambda x:x=='0')
executar('gerente nao cria equipe em A','select criar_funcionario('+uid('a1')+",'Nome teste','ambos')",'authenticated','gerente',estado='42501')

def pedido_prod(com,prod,op):
    return {'operacao_id':u(op),'pendencias':[],'produto_pedido':{'operacao_id':u(op+'-prod'),'produto':{'id':u('prod-'+prod),'comercio_id':u(com),'nome':'Produto ficticio '+prod,'categoria':'Mercearia','unidade':'Unidade','preco_compra':2,'preco_venda':4,'controla_validade':False,'avisos_dias':[],'detalhes':{}},'variacoes':[],'embalagens':[],'areas':[]}}
for nome,pedido,code in [
 ('cadastro dono A loja B',pedido_prod('b1','b1','cad-fora-b'),'42501'),
 ('cadastro produto A1 movido para A2',pedido_prod('a2','a1','cad-move'),'42501'),
 ('cadastro reusa operacao B em loja A',pedido_prod('a1','a1','op-b1'),'23505')]:
    executar(nome,'select salvar_cadastro('+q(json.dumps(pedido))+'::jsonb)','authenticated','dono-a',estado=code)
(B/'resultados-sql.json').write_text(json.dumps(resultados,indent=2,ensure_ascii=False))
print('SQL:',len(resultados),'casos;',sum(x['passou'] for x in resultados),'passaram;',sum(not x['passou'] for x in resultados),'falharam')

if any(not x["passou"] for x in resultados):raise SystemExit(1)
```

**iniciar_api.py**

```python
import subprocess,secrets,socket,json,time,urllib.request
from pathlib import Path
b=Path('/tmp/omni-g11-auditoria')
subprocess.run([str(b/'psql.sh'),'-q','-c','create role g11_authenticator login noinherit; grant anon, authenticated to g11_authenticator;'],check=True)
segredo=secrets.token_hex(32)
with socket.socket() as s:s.bind(('127.0.0.1',0));porta=s.getsockname()[1]
b.joinpath('api-config.json').write_text(json.dumps({'porta':porta,'segredo_sintetico':segredo}))
b.joinpath('api.conf').write_text('db-uri = "postgresql://g11_authenticator@/postgres?host=/tmp/omni-g11-auditoria/socket"\ndb-schemas = "public"\ndb-anon-role = "anon"\nserver-host = "127.0.0.1"\nserver-port = '+str(porta)+'\njwt-secret = "'+segredo+'"\n')
with b.joinpath('api.log').open('w') as log:p=subprocess.Popen(['/tmp/omni-postgrest/postgrest',str(b/'api.conf')],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
b.joinpath('api.pid').write_text(str(p.pid))
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
for n in range(60):
 try:
  with opener.open('http://127.0.0.1:'+str(porta)+'/',timeout=1) as r:assert r.status==200;break
 except OSError:time.sleep(.1)
else:raise RuntimeError('API privada nao iniciou')
print('API privada pronta; nenhuma credencial real usada.')
```

**testar_http.py**

```python
import base64,hashlib,hmac,json,time,urllib.request,urllib.error,uuid,subprocess
from pathlib import Path
B=Path('/tmp/omni-g11-auditoria');cfg=json.loads((B/'api-config.json').read_text());base='http://127.0.0.1:'+str(cfg['porta']);http=urllib.request.build_opener(urllib.request.ProxyHandler({}));resultados=[]
def u(x):return str(uuid.UUID(hashlib.md5(('g11-ficticio-'+x).encode()).hexdigest()))
def b64(x):return base64.urlsafe_b64encode(x).decode().rstrip('=')
def jwt(dono,segredo=None):
 h=b64(json.dumps({'alg':'HS256','typ':'JWT'}).encode());p=b64(json.dumps({'role':'authenticated','sub':u(dono),'exp':int(time.time())+3600}).encode());assinatura=hmac.new((segredo or cfg['segredo_sintetico']).encode(),(h+'.'+p).encode(),hashlib.sha256).digest();return h+'.'+p+'.'+b64(assinatura)
def caso(nome,path,body=None,dono=None,status=(200,),validar=lambda d:True,token=None,metodo=None):
 headers={'Content-Type':'application/json'}
 if dono or token:headers['Authorization']='Bearer '+(token or jwt(dono))
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=metodo or('POST'if body is not None else 'GET'))
 try:
  with http.open(req,timeout=10) as r:codigo=r.status;texto=r.read().decode()
 except urllib.error.HTTPError as e:codigo=e.code;texto=e.read().decode()
 try:dados=json.loads(texto) if texto else None
 except json.JSONDecodeError:dados=None
 ok=codigo in status and validar(dados)
 resultados.append({'caso':nome,'passou':ok,'http':codigo,'erro':dados.get('code') if isinstance(dados,dict) else None})
 if not ok:print('FALHOU',nome,codigo,dados)
# Positivos e leitura cruzada real via RLS e JWT.
caso('owner A duas lojas','/comercios?select=id,nome',dono='dono-a',validar=lambda d:{x['id'] for x in d}=={u('a1'),u('a2')})
caso('owner B somente B','/comercios?select=id,nome',dono='dono-b',validar=lambda d:{x['id'] for x in d}=={u('b1')})
for tabela in ['produtos','saldos','contagens','operacoes','pedidos_compra','pedido_itens','recebimentos','clientes_fiado','fiado_acessos','caixa_turnos','vendas']:
 caso('HTTP owner A filtra B '+tabela,'/'+tabela+'?select=id&comercio_id=eq.'+u('b1'),dono='dono-a',validar=lambda d:d==[])
 caso('HTTP owner B filtra A '+tabela,'/'+tabela+'?select=id&comercio_id=eq.'+u('a1'),dono='dono-b',validar=lambda d:d==[])
# Chamada publica sem login so opera com chave da propria loja.
caso('equipe A1 positiva','/rpc/funcionario_inicio',{'_chave':'a'*64},validar=lambda d:d['comercio']['nome']=='Loja ficticia a1')
caso('caixa A1 positivo','/rpc/caixa_produtos',{'_chave':'a'*64},validar=lambda d:len(d)==1 and d[0]['id']==u('prod-a1'))
caso('conector A1 positivo','/rpc/conector_estado',{'_chave':'7'*64},validar=lambda d:d['comercio']['nome']=='Loja ficticia a1')
caso('fornecedor A1 positivo','/rpc/pedido_publico',{'_token':'d'*64},validar=lambda d:d['comercio']['nome']=='Loja ficticia a1' and len(d['itens'])==1 and d['itens'][0]['id']==u('item-a1'))
caso('fiado A1 positivo','/rpc/fiado_publico_extrato',{'_token':'1'*64,'_sessao':'4'*64},validar=lambda d:d['cliente']=='Cliente ficticio a1' and d['comercio']=='Loja ficticia a1')
for destino in ['a2','b1']:
 caso('HTTP contagem troca loja '+destino,'/rpc/funcionario_conferencia_contar',{'_chave':'a'*64,'_id':u('http-'+destino),'_produto':u('prod-'+destino),'_variacao':None,'_contado':8,'_rodada':1},status=(401,403),validar=lambda d:d.get('code')=='42501')
 caso('HTTP recebimento troca loja '+destino,'/rpc/funcionario_abrir_recebimento',{'_chave':'a'*64,'_id':u('http-rec-'+destino),'_pedido':u('ped-'+destino),'_fornecedor':None},status=(401,403),validar=lambda d:d.get('code')=='42501')
 caso('HTTP cliente troca loja '+destino,'/rpc/caixa_cliente_fiado_historico',{'_chave':'a'*64,'_cliente':u('cliente-'+destino)},status=(400,),validar=lambda d:d.get('code')=='P0001')
caso('HTTP fiado sessao A token B','/rpc/fiado_publico_extrato',{'_token':'3'*64,'_sessao':'4'*64},status=(401,403),validar=lambda d:d.get('code')=='42501')
caso('HTTP fornecedor item B token A','/rpc/responder_pedido',{'_token':'d'*64,'r':{'aceito':True,'previsao_entrega':time.strftime('%Y-%m-%d',time.gmtime(time.time()+86400)),'itens':[{'id':u('item-b1'),'qtd_confirmada':1}]}},status=(401,403),validar=lambda d:d.get('code')=='42501')
# Sem assumir sucesso de mock: JWT adulterado e chamadas diretas.
caso('JWT assinatura falsificada','/comercios?select=id',token=jwt('dono-b','assinatura-ficticia-errada'),status=(401,))
for func,args in [('_funcionario_da_chave',{'_chave':'a'*64}),('_caixa_da_chave',{'_chave':'7'*64})]:
 for dono in [None,'dono-a']:caso('HTTP helper fechado '+func+str(dono),'/rpc/'+func,args,dono=dono,status=(401,403,404))
caso('anon endpoint do dono','/rpc/criar_funcionario',{'_comercio':u('a1'),'_nome':'Nome teste','_funcao':'ambos'},status=(401,403))
caso('owner A administra equipe B','/rpc/bloquear_funcionario',{'_id':u('f-b1'),'_bloquear':True},dono='dono-a',status=(403,),validar=lambda d:d.get('code')=='42501')
caso('owner A altera loja B','/comercios?id=eq.'+u('b1'),{'nome':'Tentativa ficticia'},dono='dono-a',metodo='PATCH',status=(204,))
caso('B permanece com seu nome','/comercios?id=eq.'+u('b1')+'&select=nome',dono='dono-b',validar=lambda d:d==[{'nome':'Loja ficticia b1'}])
for tabela in ['saldos','movimentos','operacoes','recebimento_itens','vendas','fiado_movimentos']:
 for dono in [None,'dono-a']:caso('HTTP escrita direta fechada '+tabela+str(dono),'/'+tabela,{},dono=dono,status=(401,403))

caso('HTTP gerente global nao le lojas','/comercios?select=id',dono='gerente',validar=lambda d:d==[])
caso('HTTP perfil dono isolado','/profiles?select=id',dono='dono-a',validar=lambda d:d==[{'id':u('dono-a')}])
caso('HTTP papeis dono isolados','/user_roles?select=user_id,role',dono='dono-a',validar=lambda d:d==[{'user_id':u('dono-a'),'role':'dono'}])

for tabela in ['produtos','saldos','contagens','operacoes','pedidos_compra','pedido_itens','recebimentos','clientes_fiado','caixa_turnos','vendas']:
 caso('HTTP owner A leitura legitima '+tabela,'/'+tabela+'?select=id&comercio_id=eq.'+u('a1'),dono='dono-a',validar=lambda d:isinstance(d,list) and len(d)>0)

caso('HTTP credenciais do fiado nao lidas direto nem pelo dono','/fiado_acessos?select=id&comercio_id=eq.'+u('a1'),dono='dono-a',validar=lambda d:d==[])
caso('HTTP dono consulta fiado pelo endpoint proprio','/rpc/fiado_acesso_info',{'_cliente':u('cliente-a1')},dono='dono-a',validar=lambda d:d['tem_link'] and d['tem_pin'] and 'sessao_hash' not in d and 'pin_hash' not in d)
caso('HTTP dono A nao consulta acesso fiado B','/rpc/fiado_acesso_info',{'_cliente':u('cliente-b1')},dono='dono-a',status=(403,),validar=lambda d:d.get('code')=='42501')
(B/'resultados-http.json').write_text(json.dumps(resultados,ensure_ascii=False,indent=2))
print('HTTP:',len(resultados),'casos;',sum(x['passou'] for x in resultados),'passaram;',sum(not x['passou'] for x in resultados),'falharam')

if any(not x["passou"] for x in resultados):raise SystemExit(1)
```

Ao terminar, encerrar somente o PID do PostgREST criado pelo ensaio (confirmar cmdline/API conf), parar o PostgreSQL com `pg_ctl -D /tmp/omni-g11-auditoria/dados stop -m fast` e descartar somente os dados fictícios desse diretório. A configuração/JWT local contém apenas segredo sintético; não foi publicada neste relatório.

</details>
