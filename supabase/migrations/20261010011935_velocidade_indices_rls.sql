-- Fase 2.3 — velocidade do banco (sugestões do próprio Supabase). Nada muda no que cada pessoa pode ver ou gravar.
-- 1) Atalhos de busca (índices) para as ligações entre tabelas que ainda não tinham.
-- 2) Regras de segurança (RLS) calculam quem está entrando uma vez por consulta, e não linha por linha:
--    auth.uid() passa a ser (select auth.uid()). As condições são as mesmas.

create index if not exists contagens_operacao_fk_idx on public.contagens (operacao_id);
create index if not exists contagens_produto_comercio_fk_idx on public.contagens (produto_id, comercio_id);
create index if not exists contagens_variacao_produto_comercio_fk_idx on public.contagens (variacao_id, produto_id, comercio_id);
create index if not exists funcionario_aparelhos_comercio_fk_idx on public.funcionario_aparelhos (comercio_id);
create index if not exists lotes_produto_comercio_fk_idx on public.lotes (produto_id, comercio_id);
create index if not exists lotes_variacao_produto_comercio_fk_idx on public.lotes (variacao_id, produto_id, comercio_id);
create index if not exists movimentos_funcionario_fk_idx on public.movimentos (funcionario_id);
create index if not exists movimentos_local_comercio_area_fk_idx on public.movimentos (local_id, comercio_id, area);
create index if not exists movimentos_lote_fk_idx on public.movimentos (lote_id);
create index if not exists movimentos_operacao_fk_idx on public.movimentos (operacao_id);
create index if not exists movimentos_produto_comercio_fk_idx on public.movimentos (produto_id, comercio_id);
create index if not exists movimentos_variacao_produto_comercio_fk_idx on public.movimentos (variacao_id, produto_id, comercio_id);
create index if not exists operacoes_comercio_fk_idx on public.operacoes (comercio_id);
create index if not exists operacoes_funcionario_fk_idx on public.operacoes (funcionario_id);
create index if not exists pedido_itens_comercio_fk_idx on public.pedido_itens (comercio_id);
create index if not exists pedido_itens_embalagem_fk_idx on public.pedido_itens (embalagem_id);
create index if not exists pedido_itens_variacao_fk_idx on public.pedido_itens (variacao_id);
create index if not exists pedidos_compra_fornecedor_fk_idx on public.pedidos_compra (fornecedor_id);
create index if not exists produto_areas_local_comercio_area_fk_idx on public.produto_areas (local_id, comercio_id, area);
create index if not exists produto_areas_produto_comercio_fk_idx on public.produto_areas (produto_id, comercio_id);
create index if not exists produto_areas_variacao_produto_comercio_fk_idx on public.produto_areas (variacao_id, produto_id, comercio_id);
create index if not exists produto_embalagens_produto_comercio_fk_idx on public.produto_embalagens (produto_id, comercio_id);
create index if not exists produto_variacoes_produto_comercio_fk_idx on public.produto_variacoes (produto_id, comercio_id);
create index if not exists recebimento_itens_produto_comercio_fk_idx on public.recebimento_itens (produto_id, comercio_id);
create index if not exists recebimento_itens_variacao_produto_comercio_fk_idx on public.recebimento_itens (variacao_id, produto_id, comercio_id);
create index if not exists recebimentos_fornecedor_fk_idx on public.recebimentos (fornecedor_id);
create index if not exists recebimentos_funcionario_fk_idx on public.recebimentos (funcionario_id);
create index if not exists reposicoes_funcionario_fk_idx on public.reposicoes (funcionario_id);
create index if not exists reposicoes_operacao_fk_idx on public.reposicoes (operacao_id);
create index if not exists reposicoes_produto_comercio_fk_idx on public.reposicoes (produto_id, comercio_id);
create index if not exists reposicoes_variacao_produto_comercio_fk_idx on public.reposicoes (variacao_id, produto_id, comercio_id);
create index if not exists saldos_lote_fk_idx on public.saldos (lote_id);
create index if not exists saldos_origem_fk_idx on public.saldos (origem_id);
create index if not exists saldos_produto_comercio_fk_idx on public.saldos (produto_id, comercio_id);
create index if not exists saldos_variacao_produto_comercio_fk_idx on public.saldos (variacao_id, produto_id, comercio_id);

alter policy "dono cria seus comercios" on public.comercios
  with check ((dono_id = (select auth.uid())) and public.has_role((select auth.uid()), 'dono'::public.app_role));
alter policy "dono edita seus comercios" on public.comercios
  using (dono_id = (select auth.uid()))
  with check (dono_id = (select auth.uid()));
alter policy "dono ve seus comercios" on public.comercios
  using (dono_id = (select auth.uid()));
alter policy "dono cria seus fornecedores" on public.fornecedores
  with check ((dono_id = (select auth.uid())) and public.has_role((select auth.uid()), 'dono'::public.app_role));
alter policy "dono edita seus fornecedores" on public.fornecedores
  using (dono_id = (select auth.uid()))
  with check (dono_id = (select auth.uid()));
alter policy "dono ve seus fornecedores" on public.fornecedores
  using (dono_id = (select auth.uid()));
alter policy "dono ve operacoes" on public.operacoes
  using (user_id = (select auth.uid()));
alter policy "dono apaga variacoes dos seus produtos" on public.produto_variacoes
  using (exists (select 1 from public.comercios c where c.id = produto_variacoes.comercio_id and c.dono_id = (select auth.uid())));
alter policy "dono cria variacoes nos seus produtos" on public.produto_variacoes
  with check (exists (select 1 from public.comercios c where c.id = produto_variacoes.comercio_id and c.dono_id = (select auth.uid())));
alter policy "dono edita variacoes dos seus produtos" on public.produto_variacoes
  using (exists (select 1 from public.comercios c where c.id = produto_variacoes.comercio_id and c.dono_id = (select auth.uid())))
  with check (exists (select 1 from public.comercios c where c.id = produto_variacoes.comercio_id and c.dono_id = (select auth.uid())));
alter policy "dono ve variacoes dos seus produtos" on public.produto_variacoes
  using (exists (select 1 from public.comercios c where c.id = produto_variacoes.comercio_id and c.dono_id = (select auth.uid())));
alter policy "dono cria produtos nos seus comercios" on public.produtos
  with check ((exists (select 1 from public.comercios c where c.id = produtos.comercio_id and c.dono_id = (select auth.uid()))) and (fornecedor_id is null or exists (select 1 from public.fornecedores f where f.id = produtos.fornecedor_id and f.dono_id = (select auth.uid()))));
alter policy "dono edita produtos dos seus comercios" on public.produtos
  using (exists (select 1 from public.comercios c where c.id = produtos.comercio_id and c.dono_id = (select auth.uid())))
  with check ((exists (select 1 from public.comercios c where c.id = produtos.comercio_id and c.dono_id = (select auth.uid()))) and (fornecedor_id is null or exists (select 1 from public.fornecedores f where f.id = produtos.fornecedor_id and f.dono_id = (select auth.uid()))));
alter policy "dono ve produtos dos seus comercios" on public.produtos
  using (exists (select 1 from public.comercios c where c.id = produtos.comercio_id and c.dono_id = (select auth.uid())));
alter policy "Editar o proprio perfil" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
alter policy "Ver o proprio perfil" on public.profiles
  using ((select auth.uid()) = id);
alter policy "Ver os proprios papeis" on public.user_roles
  using ((select auth.uid()) = user_id);
