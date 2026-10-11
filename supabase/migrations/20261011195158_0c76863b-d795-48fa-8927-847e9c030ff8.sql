do $mig$
declare d text; antigo text := $a$begin select * into t from caixa_turnos where id = (_venda->>'turno_id')::uuid and funcionario_id = v.id;
  exception when others then raise exception 'turno_invalido' using errcode = '22023'; end;
  if t.id is null then raise exception 'turno_invalido' using errcode = '42501'; end if;$a$;
novo text := $n$begin select * into t from caixa_turnos where id = (_venda->>'turno_id')::uuid and funcionario_id = v.id for update;
  exception when others then raise exception 'turno_invalido' using errcode = '22023'; end;
  if t.id is null then raise exception 'turno_invalido' using errcode = '42501'; end if;
  if t.situacao <> 'aberto' then raise exception 'turno_fechado' using errcode = '23514'; end if;$n$;
begin
  select pg_get_functiondef('public.caixa_registrar_venda(text,jsonb)'::regprocedure) into d;
  if position(antigo in d) = 0 then raise exception 'trecho_nao_encontrado'; end if;
  execute replace(d, antigo, novo);
end $mig$;