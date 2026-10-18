-- Correção autorizada: bloquear somente quantidades não finitas na validação existente.
-- Comparar definição/ACL do Supabase oficial antes da aplicação transacional.
do $patch$
declare d text;
begin
 d := pg_get_functiondef('public.qtd_valida(numeric,text,boolean)'::regprocedure);
 if md5(d) <> 'b832ede361381182ad26d04e3c4e6e24' then raise exception 'versao_inesperada: qtd_valida mudou'; end if;
 if (length(d)-length(replace(d,$trecho$  if _q < 0 then raise exception 'quantidade_negativa' using errcode = '22023'; end if;$trecho$,'')))/length($trecho$  if _q < 0 then raise exception 'quantidade_negativa' using errcode = '22023'; end if;$trecho$) <> 1 then raise exception 'trecho_inesperado: qtd_valida'; end if;
 d := replace(d,$trecho$  if _q < 0 then raise exception 'quantidade_negativa' using errcode = '22023'; end if;$trecho$,$trecho$  if _q in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) then raise exception 'quantidade_invalida' using errcode = '22023'; end if;
  if _q < 0 then raise exception 'quantidade_negativa' using errcode = '22023'; end if;$trecho$);
 execute d;
end $patch$;
