-- Checklist item 2: o app publicado já manda a rodada. A versão antiga (sem rodada, que contava o reenvio
-- duas vezes) passa a recusar; um celular com a página antiga aberta recebe "app_desatualizado".
create or replace function public.funcionario_conferencia_contar(_chave text, _id uuid, _produto uuid, _variacao uuid, _contado numeric) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  raise exception 'app_desatualizado' using errcode = '22023';
end $$;
notify pgrst, 'reload schema';
