-- Aplicada no Supabase oficial em 16/10/2026 (versão 20261016133627), depois de simular com rollback no banco real.
-- Reversão: docs/persistencia/017_embalagem_protegida_reverter.sql. Registro: docs/embalagem-protegida-2026-10-15.md.
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
