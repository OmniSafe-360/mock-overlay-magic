-- Reversão da Etapa 3. Não toca em nenhuma linha de dados; só retira os gatilhos e as funções criadas.
DO $rev$
begin
  drop trigger if exists embalagem_protegida on public.produto_embalagens;
  drop trigger if exists pedido_itens_trava_embalagem on public.pedido_itens;
  drop trigger if exists codigos_pdv_trava_embalagem on public.codigos_pdv;
  drop trigger if exists venda_itens_trava_embalagem on public.venda_itens;
  drop function if exists public._proteger_embalagem();
  drop function if exists public._travar_embalagem_usada();
  drop function if exists public._embalagem_em_uso(uuid);
end $rev$;
