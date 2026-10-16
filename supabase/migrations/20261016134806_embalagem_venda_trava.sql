-- Aplicada no Supabase oficial em 16/10/2026 (versão 20261016134806), depois de reproduzir a falha e testar a correção com 2 conexões reais em banco descartável e simular com rollback no banco real.
-- Embalagem protegida, parte da venda (revisão do Codex no PR #161): as vendas (caixa do celular, Omni Conector
-- e "Ligar" de vendido sem cadastro) calculam as unidades em _unidades_item ANTES de gravar o item. Se a quantidade
-- da embalagem mudasse nesse instante, a venda podia usar o fator antigo. Agora _unidades_item trava a linha da
-- embalagem (FOR SHARE) antes de ler: quem muda espera a venda (e depois é recusado, embalagem_em_uso), ou a venda
-- espera a mudança e já calcula com o fator novo. FOR SHARE exige função VOLATILE; os 3 chamadores já são VOLATILE.
-- Confere a versão do banco (md5) antes de trocar; um único comando atômico; permissões mantidas (CREATE OR REPLACE).
DO $migr$
declare
  d text := pg_get_functiondef('public._unidades_item(uuid,uuid,numeric)'::regprocedure);
  a1 constant text := E' STABLE SECURITY DEFINER\n';
  a2 constant text := 'select quantidade into v_mult from produto_embalagens where id = _emb and produto_id = _prod;';
begin
  if md5(d) <> 'a27126aecca199609c7e0365f6404711' then
    raise exception 'compatibilidade: _unidades_item diferente da versão conferida (md5 %); nada foi alterado', md5(d);
  end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 or (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1 then
    raise exception 'compatibilidade: trechos de _unidades_item não encontrados 1 vez; nada foi alterado';
  end if;
  d := replace(d, a1, E' VOLATILE SECURITY DEFINER\n');
  d := replace(d, a2, replace(a2, ';', ' for share;'));
  execute d;
  d := pg_get_functiondef('public._unidades_item(uuid,uuid,numeric)'::regprocedure);
  if position('for share' in d) = 0 or (select provolatile from pg_proc where oid = 'public._unidades_item(uuid,uuid,numeric)'::regprocedure) <> 'v' then
    raise exception 'conferência final: _unidades_item sem a trava; tudo desfeito';
  end if;
end $migr$;
