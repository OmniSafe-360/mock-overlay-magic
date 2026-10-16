-- F03: preparação para implantação separada; não executar no banco oficial sem autorização.
-- As duas funções legadas são chamadas dentro da mesma transação implícita.
create or replace function public.resolver_conferencia_com_motivo(
  _diferenca uuid, _contado numeric, _motivo text, _observacao text
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_resultado jsonb; v_diferenca numeric;
begin
  v_resultado := public.resolver_conferencia(_diferenca, _contado);
  if v_resultado->>'situacao' = 'aguardando_deposito' then
    return v_resultado;
  end if;
  if jsonb_typeof(v_resultado->'diferenca') is distinct from 'number' then
    raise exception 'resposta_resolucao_invalida' using errcode = '22023';
  end if;
  v_diferenca := (v_resultado->>'diferenca')::numeric;
  if v_diferenca <> 0 then
    if _motivo is null or _motivo not in ('quebra','vencido','erro_contagem','sumiu','consumo','outro') then
      raise exception 'motivo_invalido' using errcode = '22023';
    end if;
    if _motivo = 'outro' and length(btrim(coalesce(_observacao,''))) < 3 then
      raise exception 'observacao_obrigatoria' using errcode = '22023';
    end if;
    perform public.explicar_diferenca(_diferenca, _motivo, _observacao);
  end if;
  return v_resultado;
end $$;
revoke all on function public.resolver_conferencia_com_motivo(uuid,numeric,text,text) from public, anon, authenticated;
grant execute on function public.resolver_conferencia_com_motivo(uuid,numeric,text,text) to authenticated;
-- O RPC antigo permanece para clientes publicados ainda não atualizados; retirada requer etapa separada.
