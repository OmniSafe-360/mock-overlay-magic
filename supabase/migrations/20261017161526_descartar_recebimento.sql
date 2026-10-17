-- A10 (checklist funcional 3): contagem de recebimento abandonada. Se a equipe começa a contar uma entrega e larga no meio,
-- a contagem fica "contando" para sempre: o pedido não pode ser cancelado, reenviado nem receber de novo, e o dono não tinha
-- como encerrar. Agora o dono encerra a contagem (descartar_recebimento): nada do que foi contado entra no estoque
-- (o estoque só entra quando a entrega conclui), e o pedido volta a esperar a entrega. O celular que tinha a contagem
-- guardada é avisado (recebimento_descartado) e começa outra do zero.
-- Sem tabela nova: um valor novo na situação ('descartado') e a coluna descartado_em.

do $$
begin
  if md5(pg_get_functiondef('public._fechar_pedido_recebido(uuid)'::regprocedure)) <> 'dfbb36ba67a4e871e4ca8721931c76cf'
     or md5(pg_get_functiondef('public._pedido_recebe_resto(uuid)'::regprocedure)) <> 'b7323fc248ad5f043f0a1b5c18b049a1'
     or md5(pg_get_functiondef('public.funcionario_abrir_recebimento(text,uuid,uuid,uuid)'::regprocedure)) <> '7358bdb42a0d186cc93a50ae6d1762dc'
     or md5(pg_get_functiondef('public.funcionario_enviar_recebimento(text,uuid,integer,jsonb)'::regprocedure)) <> '9bdeb9fe0bfb79016aedea7c04458b7a' then
    raise exception 'versao_inesperada: funções do recebimento mudaram desde a conferência';
  end if;
end $$;

alter table public.recebimentos drop constraint recebimentos_situacao_check;
alter table public.recebimentos add constraint recebimentos_situacao_check check (situacao in ('contando', 'concluido', 'descartado'));
alter table public.recebimentos add column descartado_em timestamptz;
comment on column public.recebimentos.descartado_em is 'A10: o dono encerrou a contagem largada no meio; nada dela entrou no estoque.';

/* Trechos conferidos: cada um tem de aparecer o número de vezes indicado na versão conferida acima. */
do $$
declare
  v_fe text := pg_get_functiondef('public._fechar_pedido_recebido(uuid)'::regprocedure);
  v_rr text := pg_get_functiondef('public._pedido_recebe_resto(uuid)'::regprocedure);
  v_ab text := pg_get_functiondef('public.funcionario_abrir_recebimento(text,uuid,uuid,uuid)'::regprocedure);
  v_ev text := pg_get_functiondef('public.funcionario_enviar_recebimento(text,uuid,integer,jsonb)'::regprocedure);
  a_fe1 text := $a$where r.pedido_id = _pedido and ri.no_pedido and ri.situacao = 'aceito'$a$;
  b_fe1 text := $b$where r.pedido_id = _pedido and r.situacao <> 'descartado' and ri.no_pedido and ri.situacao = 'aceito'$b$;
  a_fe2 text := $a$where r.pedido_id = _pedido and ri.situacao = 'inconsistente'$a$;
  b_fe2 text := $b$where r.pedido_id = _pedido and r.situacao <> 'descartado' and ri.situacao = 'inconsistente'$b$;
  a_rr text := $a$where r.pedido_id = pc.id and ri.situacao in ('inconsistente', 'fora_do_pedido')$a$;
  b_rr text := $b$where r.pedido_id = pc.id and r.situacao <> 'descartado' and ri.situacao in ('inconsistente', 'fora_do_pedido')$b$;
  a_ab text := $a$raise exception 'recebimento_de_outro_comercio' using errcode = '42501'; end if;
  end if;$a$;
  b_ab text := $b$raise exception 'recebimento_de_outro_comercio' using errcode = '42501'; end if;
  end if;
  -- A10: o dono encerrou esta contagem; o celular começa outra.
  if r.situacao = 'descartado' then raise exception 'recebimento_descartado' using errcode = '23514'; end if;$b$;
  a_ev text := $a$raise exception 'recebimento_nao_encontrado' using errcode = '42501'; end if;$a$;
  b_ev text := $b$raise exception 'recebimento_nao_encontrado' using errcode = '42501'; end if;
  if r.situacao = 'descartado' then raise exception 'recebimento_descartado' using errcode = '23514'; end if;$b$;
begin
  if (length(v_fe) - length(replace(v_fe, a_fe1, ''))) / length(a_fe1) <> 1
     or (length(v_fe) - length(replace(v_fe, a_fe2, ''))) / length(a_fe2) <> 1
     or (length(v_rr) - length(replace(v_rr, a_rr, ''))) / length(a_rr) <> 1
     or (length(v_ab) - length(replace(v_ab, a_ab, ''))) / length(a_ab) <> 1
     or (length(v_ev) - length(replace(v_ev, a_ev, ''))) / length(a_ev) <> 1 then
    raise exception 'versao_inesperada: trecho não encontrado uma única vez';
  end if;
  execute replace(replace(v_fe, a_fe1, b_fe1), a_fe2, b_fe2);
  execute replace(v_rr, a_rr, b_rr);
  execute replace(v_ab, a_ab, b_ab);
  execute replace(v_ev, a_ev, b_ev);
end $$;

/* Dono: encerra a contagem largada no meio. Nada entra no estoque; o pedido volta a esperar a entrega. */
create function public.descartar_recebimento(_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r recebimentos%rowtype;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into r from recebimentos where id = _id for update;
  if not found or not public.pode_acessar_comercio(r.comercio_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if r.situacao = 'descartado' then return jsonb_build_object('situacao', 'repetida'); end if;
  if r.situacao <> 'contando' then raise exception 'recebimento_ja_concluido' using errcode = '23514'; end if;
  update recebimentos set situacao = 'descartado', descartado_em = now() where id = r.id;
  return jsonb_build_object('situacao', 'descartado');
end $$;
revoke all on function public.descartar_recebimento(uuid) from public, anon;
grant execute on function public.descartar_recebimento(uuid) to authenticated, service_role;
