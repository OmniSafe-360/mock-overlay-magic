-- A1 (análise de 17/10/2026; F02): o lote vencido não sai mais primeiro.
-- Antes, `_tirar_saldo` tirava pela validade mais próxima, sem olhar se já tinha vencido. Numa venda, numa perda
-- "quebrou" ou num acerto de contagem para menos, o sistema dava baixa primeiro no lote vencido. O alerta
-- "vencido à venda" sumia, mas o produto vencido continuava na prateleira.
-- Agora a ordem é: lotes dentro da validade (o que vence primeiro sai primeiro) → sem data → vencidos por último.
-- Exceção: perda com motivo "venceu" tira primeiro o que já venceu.
-- Reposição (_tirar_saldo_reposicao) e cancelamento (devolve as mesmas partes) não mudam.
-- Mesma regra de data de `_saldo_reponivel`: vencido = vencimento antes de hoje no horário de São Paulo.

do $$
begin
  if md5(pg_get_functiondef('public._tirar_saldo(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid,tipo_movimento,uuid)'::regprocedure))
     <> 'b1a29f5c5a41482e8003d32fb874b702' then
    raise exception 'versao_inesperada: _tirar_saldo mudou desde a conferência';
  end if;
end $$;

/* Tira uma quantidade de uma área. Ordem: dentro da validade (validade mais próxima primeiro), sem data, vencidos por último;
   com _vencido_primeiro (perda "venceu"), os vencidos saem primeiro. Pendentes de conferência continuam por último. */
create or replace function public._tirar_saldo_ordem(_com uuid, _prod uuid, _var uuid, _area area_estoque, _qtd numeric, _op uuid, _user uuid, _func uuid,
  _tipo tipo_movimento, _local uuid, _vencido_primeiro boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; v_rest numeric := _qtd; v_q numeric; v_out jsonb := '[]'; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if _qtd <= 0 then return v_out; end if;
  for r in select s.id, s.lote_id, s.pendente, s.pendencia_confirmada, s.quantidade from saldos s left join lotes l on l.id = s.lote_id
            where s.produto_id = _prod and s.variacao_id is not distinct from _var and s.area = _area and s.quantidade > 0
            order by s.pendente,
                     case when coalesce(l.vencimento < v_hoje, false) = _vencido_primeiro then 0 else 1 end,
                     l.vencimento nulls last, s.updated_at
            for update of s loop
    exit when v_rest <= 0;
    v_q := least(r.quantidade, v_rest);
    update saldos set quantidade = quantidade - v_q, updated_at = now() where id = r.id;
    insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, lote_id, saldo_id, tipo, quantidade, criado_por, funcionario_id)
    values (_op, _com, _prod, _var, _area, _local, r.lote_id, r.id, _tipo, -v_q, _user, _func);
    v_out := v_out || jsonb_build_object('lote_id', r.lote_id, 'pendente', r.pendente, 'pendencia_confirmada', r.pendencia_confirmada, 'quantidade', v_q);
    v_rest := v_rest - v_q;
  end loop;
  if v_rest > 0 then raise exception 'saldo_insuficiente' using errcode = '23514'; end if;
  return v_out;
end $$;
revoke all on function public._tirar_saldo_ordem(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid,tipo_movimento,uuid,boolean) from public, anon, authenticated;
grant execute on function public._tirar_saldo_ordem(uuid,uuid,uuid,area_estoque,numeric,uuid,uuid,uuid,tipo_movimento,uuid,boolean) to service_role;

/* Mesma assinatura de antes (venda, acerto de contagem, ajustes): vencidos por último. */
create or replace function public._tirar_saldo(_com uuid, _prod uuid, _var uuid, _area area_estoque, _qtd numeric, _op uuid, _user uuid, _func uuid, _tipo tipo_movimento, _local uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return public._tirar_saldo_ordem(_com, _prod, _var, _area, _qtd, _op, _user, _func, _tipo, _local, false);
end $$;

/* Perda: só o motivo "venceu" tira primeiro o que já venceu. Troca só a linha da baixa, conferindo o trecho. */
do $$
declare v_def text := pg_get_functiondef('public._lancar_perda(uuid,uuid,uuid,uuid,text,numeric,text,text,uuid,uuid)'::regprocedure);
        v_ant text := 'perform public._tirar_saldo(_com, _prod, _var, v_area, v_baixa, v_op, c.dono_id, _func, ''perda'', v_local);';
        v_nov text := 'perform public._tirar_saldo_ordem(_com, _prod, _var, v_area, v_baixa, v_op, c.dono_id, _func, ''perda'', v_local, _motivo = ''venceu'');';
begin
  if position(v_ant in v_def) = 0 or position(v_ant in substr(v_def, position(v_ant in v_def) + 1)) > 0 then
    raise exception 'versao_inesperada: trecho da baixa em _lancar_perda não encontrado uma única vez';
  end if;
  execute replace(v_def, v_ant, v_nov);
end $$;
