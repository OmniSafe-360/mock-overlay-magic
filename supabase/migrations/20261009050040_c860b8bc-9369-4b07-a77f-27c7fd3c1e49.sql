-- Correção de permissões da migração de estoque (somente objetos criados por ela).
revoke all on public.codigos_barras, public.operacoes, public.locais, public.produto_areas,
  public.contagens, public.lotes, public.saldos, public.movimentos from public, anon, authenticated;
grant select on public.codigos_barras, public.operacoes, public.locais, public.produto_areas,
  public.contagens, public.lotes, public.saldos, public.movimentos to authenticated;
grant all on public.codigos_barras, public.operacoes, public.locais, public.produto_areas,
  public.contagens, public.lotes, public.saldos, public.movimentos to service_role;

revoke execute on function
  public.unidade_fracionada(text),
  public.qtd_valida(numeric, text, boolean),
  public.normalizar_lote(text),
  public.validar_tipo(public.tipo_comercio, text, text, jsonb),
  public.saldo_chave(uuid, uuid, public.area_estoque),
  public.produtos_vinculos(),
  public.sync_codigo(),
  public.checar_vinculos(),
  public.bloquear_alteracao(),
  public._iniciar_operacao(uuid, uuid, uuid, text, text),
  public._lote_da_parte(uuid, uuid, uuid, text, date)
from public, anon, authenticated;
grant execute on function
  public.unidade_fracionada(text),
  public.qtd_valida(numeric, text, boolean),
  public.normalizar_lote(text),
  public.validar_tipo(public.tipo_comercio, text, text, jsonb),
  public.saldo_chave(uuid, uuid, public.area_estoque),
  public.produtos_vinculos(),
  public.sync_codigo(),
  public.checar_vinculos(),
  public.bloquear_alteracao(),
  public._iniciar_operacao(uuid, uuid, uuid, text, text),
  public._lote_da_parte(uuid, uuid, uuid, text, date)
to service_role;

-- Funções públicas do app: só usuários logados.
revoke execute on function public.salvar_produto(jsonb), public.resolver_pendencia(jsonb),
  public.pode_acessar_comercio(uuid) from public, anon;
grant execute on function public.salvar_produto(jsonb), public.resolver_pendencia(jsonb),
  public.pode_acessar_comercio(uuid) to authenticated, service_role;