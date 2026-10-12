CREATE OR REPLACE FUNCTION public.caixa_salvar_cliente_fiado(_chave text, _id uuid, _nome text, _telefone text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype; cl clientes_fiado%rowtype;
  v_nome text := btrim(coalesce(_nome, ''));
  v_tel text := nullif(regexp_replace(coalesce(_telefone, ''), '\D', '', 'g'), '');
begin
  v := public._funcionario_caixa(_chave);
  if _id is null then raise exception 'id_obrigatorio' using errcode = '22023'; end if;
  if char_length(v_nome) not between 2 and 60 then raise exception 'nome_cliente_invalido' using errcode = '23514'; end if;
  if v_tel is not null and v_tel !~ '^[0-9]{10,11}$' then raise exception 'telefone_cliente_invalido' using errcode = '23514'; end if;
  select * into cl from clientes_fiado where id = _id for update;
  if found then
    if cl.comercio_id <> v.comercio_id then raise exception 'sem_permissao' using errcode = '42501'; end if;
    if cl.nome is distinct from v_nome or cl.telefone is distinct from v_tel then
      raise exception 'operacao_repetida_com_outros_dados' using errcode = 'P0001';
    end if;
  else
    insert into clientes_fiado (id, comercio_id, nome, telefone, ativo, criado_por_funcionario)
    values (_id, v.comercio_id, v_nome, v_tel, true, v.id);
  end if;
  return jsonb_build_object('id', _id, 'nome', v_nome, 'telefone', v_tel);
end $function$;
REVOKE ALL ON FUNCTION public.caixa_salvar_cliente_fiado(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.caixa_salvar_cliente_fiado(text, uuid, text, text) TO anon, authenticated;