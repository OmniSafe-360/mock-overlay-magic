-- Etapa 3 — embalagem protegida no banco — APLICADA no Supabase oficial em 16/10/2026 (migração 20261016133627_embalagem_protegida.sql).
-- Não recria tabela, não altera nenhuma linha existente, não muda RLS nem permissões das tabelas,
-- não substitui nenhuma função existente (salvar_cadastro/_salvar_embalagens/salvar_pedido ficam iguais).
-- Acrescenta só 2 funções de gatilho (sem EXECUTE para anon/authenticated) e 4 gatilhos.
--
-- Regra: embalagem já usada (pedido_itens, codigos_pdv ou venda_itens) não muda
--   quantidade, produto nem comércio e não volta de removida. Apagar já é recusado pelo banco:
--   as 3 chaves estrangeiras para produto_embalagens são NO ACTION (conferido em 16/10/2026),
--   por isso o gatilho cuida só de UPDATE.
--   Tipo, código de barras e preço continuam editáveis. Remover continua sendo
--   marcar removida_em (histórico e pedidos antigos ficam intactos).
-- Corrida: quem grava um item que usa a embalagem trava a linha dela (FOR SHARE).
--   Isso conflita com a gravação da embalagem (FOR UPDATE / UPDATE), então as duas
--   operações acontecem uma depois da outra. No pedido, se a quantidade mudou entre a
--   leitura e a gravação, qtd_unidades não bate e o pedido é recusado (embalagem_mudou).
--
-- Tudo em UM bloco DO (atômico). Primeiro confere compatibilidade; só depois cria.

DO $migr$
begin
  -- ===== Fase 1: conferências, sem alterar nada =====
  if to_regclass('public.produto_embalagens') is null or to_regclass('public.pedido_itens') is null
     or to_regclass('public.codigos_pdv') is null or to_regclass('public.venda_itens') is null then
    raise exception 'compatibilidade: tabelas esperadas ausentes; nada foi alterado';
  end if;
  if (select count(*) from information_schema.columns where table_schema = 'public'
        and ((table_name = 'produto_embalagens' and column_name in ('id','quantidade','produto_id','comercio_id','removida_em'))
          or (table_name = 'pedido_itens' and column_name in ('embalagem_id','qtd_embalagens','qtd_unidades'))
          or (table_name in ('codigos_pdv','venda_itens') and column_name = 'embalagem_id'))) <> 10 then
    raise exception 'compatibilidade: colunas esperadas ausentes; nada foi alterado';
  end if;
  if exists (select 1 from pg_trigger where not tgisinternal and tgname in
      ('embalagem_protegida','pedido_itens_trava_embalagem','codigos_pdv_trava_embalagem','venda_itens_trava_embalagem')) then
    raise exception 'compatibilidade: proteção já aplicada; nada foi alterado';
  end if;
  -- Os dados atuais têm que estar coerentes: nenhum pedido com fator diferente do da embalagem.
  if exists (select 1 from pedido_itens i join produto_embalagens e on e.id = i.embalagem_id
             where i.qtd_unidades <> i.qtd_embalagens * e.quantidade) then
    raise exception 'compatibilidade: há pedido com quantidade diferente da embalagem; revisar antes; nada foi alterado';
  end if;

  -- ===== Fase 2: criar =====
  execute $f$
  create function public._embalagem_em_uso(_id uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $b$
    select exists (select 1 from pedido_itens where embalagem_id = _id)
        or exists (select 1 from codigos_pdv where embalagem_id = _id)
        or exists (select 1 from venda_itens where embalagem_id = _id)
  $b$ $f$;

  execute $f$
  create function public._proteger_embalagem() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $b$
  begin
    if (new.quantidade is distinct from old.quantidade or new.produto_id is distinct from old.produto_id
        or new.comercio_id is distinct from old.comercio_id
        or (old.removida_em is not null and new.removida_em is null))
       and public._embalagem_em_uso(old.id) then
      raise exception 'embalagem_em_uso' using errcode = '23514';
    end if;
    return new;
  end $b$ $f$;

  execute $f$
  create function public._travar_embalagem_usada() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $b$
  declare v_q numeric;
  begin
    if new.embalagem_id is null then return new; end if;
    select quantidade into v_q from produto_embalagens where id = new.embalagem_id for share;
    if tg_table_name <> 'pedido_itens' or v_q is null then return new; end if;
    if new.qtd_unidades <> new.qtd_embalagens * v_q then
      raise exception 'embalagem_mudou' using errcode = '40001';
    end if;
    return new;
  end $b$ $f$;

  revoke all on function public._embalagem_em_uso(uuid) from public, anon, authenticated;
  revoke all on function public._proteger_embalagem() from public, anon, authenticated;
  revoke all on function public._travar_embalagem_usada() from public, anon, authenticated;

  create trigger embalagem_protegida before update on public.produto_embalagens
    for each row execute function public._proteger_embalagem();
  create trigger pedido_itens_trava_embalagem before insert or update of embalagem_id, qtd_embalagens, qtd_unidades on public.pedido_itens
    for each row execute function public._travar_embalagem_usada();
  create trigger codigos_pdv_trava_embalagem before insert or update of embalagem_id on public.codigos_pdv
    for each row execute function public._travar_embalagem_usada();
  create trigger venda_itens_trava_embalagem before insert or update of embalagem_id on public.venda_itens
    for each row execute function public._travar_embalagem_usada();
end $migr$;
