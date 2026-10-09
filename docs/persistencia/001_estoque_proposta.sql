-- =====================================================================
-- PROPOSTA DE MIGRAÇÃO — NÃO EXECUTADA. Revisar antes de aplicar.
-- Omni Safe 360 · persistência do cadastro de produto
-- (produto, variações, locais, limites, contagem inicial, validade/lotes)
-- Banco auditado em 09/10/2026: produtos=0, variacoes=0, fornecedores=0,
-- comercios=4. Nada aqui apaga ou reescreve dados existentes.
-- =====================================================================

-- ---------- 0. Tipos ----------
create type public.area_estoque as enum ('deposito', 'venda');
create type public.tipo_movimento as enum (
  'contagem_inicial', 'entrada', 'transferencia', 'ajuste', 'divisao_pendencia'
);

-- ---------- 1. Acesso por comércio (dono hoje; conferente no futuro) ----------
-- Papel global (user_roles) NUNCA autoriza sozinho: sempre exige vínculo com o comércio.
create or replace function public.pode_acessar_comercio(_comercio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from comercios c where c.id = _comercio and c.dono_id = auth.uid());
  -- futuro: OR exists (select 1 from comercio_acessos a where a.comercio_id=_comercio
  --                    and a.user_id=auth.uid() and a.ativo)
$$;
revoke execute on function public.pode_acessar_comercio(uuid) from public, anon;
grant execute on function public.pode_acessar_comercio(uuid) to authenticated;

-- ---------- 2. Produtos: validade e vínculo de fornecedor ----------
alter table public.produtos
  add column controla_validade boolean,            -- null = "Validade não configurada"
  add column avisos_dias smallint[] not null default '{}',
  add constraint produtos_avisos_validos
    check (avisos_dias <@ array[30,60,90]::smallint[]);

-- Fornecedor precisa ser do mesmo dono do comércio (hoje só a RLS confere).
create or replace function public.produtos_fornecedor_mesmo_dono()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fornecedor_id is not null and not exists (
    select 1 from fornecedores f join comercios c on c.dono_id = f.dono_id
    where f.id = new.fornecedor_id and c.id = new.comercio_id) then
    raise exception 'fornecedor_de_outro_dono' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.comercio_id <> old.comercio_id then
    raise exception 'produto_nao_muda_de_comercio' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger produtos_fornecedor_check before insert or update on public.produtos
  for each row execute function public.produtos_fornecedor_mesmo_dono();

-- Variação: permite FK composta (id, produto, comércio) nas tabelas novas.
alter table public.produto_variacoes
  add constraint variacoes_id_produto_comercio_unico unique (id, produto_id, comercio_id);

-- ---------- 3. Código de barras único no comércio (produtos + variações juntos) ----------
create table public.codigos_barras (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  codigo text not null,
  produto_id uuid not null,
  variacao_id uuid,
  primary key (comercio_id, codigo)
);
grant select on public.codigos_barras to authenticated;
grant all on public.codigos_barras to service_role;
alter table public.codigos_barras enable row level security;
create policy "acesso ve codigos" on public.codigos_barras for select to authenticated
  using (public.pode_acessar_comercio(comercio_id));

create or replace function public.sincronizar_codigo_barras()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_var uuid := case when tg_table_name = 'produto_variacoes' then coalesce(new.id, old.id) end;
        v_prod uuid := case when tg_table_name = 'produto_variacoes' then coalesce(new.produto_id, old.produto_id) else coalesce(new.id, old.id) end;
begin
  if tg_op in ('UPDATE','DELETE') and old.codigo_barras is not null then
    delete from codigos_barras where comercio_id = old.comercio_id and codigo = old.codigo_barras
      and produto_id = v_prod and variacao_id is not distinct from v_var;
  end if;
  if tg_op in ('INSERT','UPDATE') and new.codigo_barras is not null then
    insert into codigos_barras values (new.comercio_id, new.codigo_barras, v_prod, v_var);
    -- conflito na PK => 23505 => app mostra "código já usado neste comércio"
  end if;
  return coalesce(new, old);
end $$;
create trigger produtos_codigo_sync after insert or update of codigo_barras or delete on public.produtos
  for each row execute function public.sincronizar_codigo_barras();
create trigger variacoes_codigo_sync after insert or update of codigo_barras or delete on public.produto_variacoes
  for each row execute function public.sincronizar_codigo_barras();

-- ---------- 4. Locais (por comércio e por área) ----------
create table public.locais (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  area public.area_estoque not null,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  nome_norm text generated always as (lower(regexp_replace(btrim(nome), '\s+', ' ', 'g'))) stored,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (comercio_id, area, nome_norm),
  unique (id, comercio_id, area)
);
grant select, insert, update on public.locais to authenticated;
grant all on public.locais to service_role;
alter table public.locais enable row level security;
create policy "acesso ve locais" on public.locais for select to authenticated using (public.pode_acessar_comercio(comercio_id));
create policy "acesso cria locais" on public.locais for insert to authenticated with check (public.pode_acessar_comercio(comercio_id));
create policy "acesso edita locais" on public.locais for update to authenticated
  using (public.pode_acessar_comercio(comercio_id)) with check (public.pode_acessar_comercio(comercio_id));
create trigger locais_set_updated_at before update on public.locais for each row execute function public.set_updated_at();

-- ---------- 5. Configuração por produto/variação e área (local + limites) ----------
-- Separada das quantidades: editar limites nunca mexe em estoque.
create table public.produto_areas (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  produto_id uuid not null,
  variacao_id uuid,
  area public.area_estoque not null,
  local_id uuid,                                   -- null = "Definir depois"
  minimo numeric(14,3) check (minimo >= 0),
  maximo numeric(14,3) check (maximo >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (minimo is null or maximo is null or maximo >= minimo),
  unique nulls not distinct (produto_id, variacao_id, area),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id) on delete cascade,
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id) on delete cascade,
  foreign key (local_id, comercio_id, area) references public.locais(id, comercio_id, area)
);

-- ---------- 6. Lotes (validade) ----------
create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  produto_id uuid not null,
  variacao_id uuid,
  numero text check (numero is null or char_length(btrim(numero)) between 1 and 40),
  vencimento date,                                  -- só data; null = validade desconhecida
  created_at timestamptz not null default now(),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id) on delete cascade,
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id) on delete cascade,
  unique (id, produto_id, comercio_id)
);
-- Mesmo número no mesmo produto/variação = um único lote (nas duas áreas).
create unique index lotes_numero_unico on public.lotes (produto_id, coalesce(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid), numero)
  where numero is not null;

-- ---------- 7. Saldos (quantidade atual por lote e área) ----------
create table public.saldos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  produto_id uuid not null,
  variacao_id uuid,
  area public.area_estoque not null,
  lote_id uuid,                                     -- null = produto sem controle de validade
  pendente boolean not null default false,          -- data ou lote a conferir
  origem_id uuid references public.saldos(id),      -- parte dividida de uma pendência
  quantidade numeric(14,3) not null check (quantidade >= 0),
  updated_at timestamptz not null default now(),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id) on delete cascade,
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id) on delete cascade,
  foreign key (lote_id, produto_id, comercio_id) references public.lotes(id, produto_id, comercio_id)
);
create index saldos_produto_idx on public.saldos (produto_id, area);

-- ---------- 8. Movimentos (histórico, só acrescenta) ----------
create table public.movimentos (
  id uuid primary key default gen_random_uuid(),
  operacao_id uuid not null,                        -- id da tentativa de salvamento (idempotência)
  comercio_id uuid not null,
  produto_id uuid not null,
  variacao_id uuid,
  area public.area_estoque not null,
  local_id uuid,
  lote_id uuid,
  saldo_id uuid references public.saldos(id),
  tipo public.tipo_movimento not null,
  quantidade numeric(14,3) not null,               -- positiva entra, negativa sai
  motivo text,
  criado_por uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (produto_id, comercio_id) references public.produtos(id, comercio_id) on delete cascade,
  foreign key (variacao_id, produto_id, comercio_id) references public.produto_variacoes(id, produto_id, comercio_id) on delete cascade,
  foreign key (lote_id, produto_id, comercio_id) references public.lotes(id, produto_id, comercio_id),
  foreign key (local_id, comercio_id, area) references public.locais(id, comercio_id, area)
);
-- Contagem inicial registrada no máximo uma vez por produto/variação/área.
create unique index movimentos_contagem_inicial_unica on public.movimentos
  (produto_id, coalesce(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid), area)
  where tipo = 'contagem_inicial' and saldo_id is null;
create index movimentos_operacao_idx on public.movimentos (operacao_id);

-- Contagem inicial "marcador": uma linha com saldo_id null por área (mesmo com zero),
-- linhas de detalhe por saldo com saldo_id preenchido. Assim zero ≠ não contado.

-- ---------- 9. Permissões: leitura direta; escrita de estoque só pela função ----------
grant select, insert, update on public.produto_areas to authenticated;
grant select on public.lotes, public.saldos, public.movimentos to authenticated;
grant all on public.produto_areas, public.lotes, public.saldos, public.movimentos to service_role;
alter table public.produto_areas enable row level security;
alter table public.lotes enable row level security;
alter table public.saldos enable row level security;
alter table public.movimentos enable row level security;
create policy "acesso ve config" on public.produto_areas for select to authenticated using (public.pode_acessar_comercio(comercio_id));
create policy "acesso cria config" on public.produto_areas for insert to authenticated with check (public.pode_acessar_comercio(comercio_id));
create policy "acesso edita config" on public.produto_areas for update to authenticated
  using (public.pode_acessar_comercio(comercio_id)) with check (public.pode_acessar_comercio(comercio_id));
create policy "acesso ve lotes" on public.lotes for select to authenticated using (public.pode_acessar_comercio(comercio_id));
create policy "acesso ve saldos" on public.saldos for select to authenticated using (public.pode_acessar_comercio(comercio_id));
create policy "acesso ve movimentos" on public.movimentos for select to authenticated using (public.pode_acessar_comercio(comercio_id));
-- sem políticas de UPDATE/DELETE em movimentos: histórico não se apaga.
create trigger produto_areas_set_updated_at before update on public.produto_areas for each row execute function public.set_updated_at();
create trigger saldos_set_updated_at before update on public.saldos for each row execute function public.set_updated_at();

-- ---------- 10. Salvamento atômico ----------
-- Uma chamada = uma transação: ou grava tudo, ou nada.
-- Entrada (jsonb), ids gerados no app (crypto.randomUUID) e reaproveitados ao repetir:
-- { operacao_id, produto:{id, comercio_id, nome, ..., controla_validade, avisos_dias},
--   variacoes:[{id, tamanho, cor, codigo_barras}],
--   areas:[{area, variacao_id, local:{id?|nome?}|null, minimo, maximo,
--           contagem: null | { quantidade, partes:[{lote:{numero, vencimento}|null, pendente, quantidade}] } }] }
create or replace function public.salvar_produto(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_op uuid := (p->>'operacao_id')::uuid;
  v_prod jsonb := p->'produto';
  v_id uuid := (v_prod->>'id')::uuid;
  v_com uuid := (v_prod->>'comercio_id')::uuid;
  a jsonb; pt jsonb; v_var uuid; v_area area_estoque; v_local uuid; v_lote uuid; v_saldo uuid; v_soma numeric;
begin
  if not public.pode_acessar_comercio(v_com) then raise exception 'sem_acesso' using errcode = '42501'; end if;
  if exists (select 1 from movimentos where operacao_id = v_op) then return v_id; end if; -- repetição

  insert into produtos (id, comercio_id, fornecedor_id, codigo_barras, nome, categoria, unidade,
                        preco_compra, preco_venda, marca, detalhes, controla_validade, avisos_dias)
  values (v_id, v_com, (v_prod->>'fornecedor_id')::uuid, v_prod->>'codigo_barras', v_prod->>'nome',
          v_prod->>'categoria', v_prod->>'unidade', (v_prod->>'preco_compra')::numeric,
          (v_prod->>'preco_venda')::numeric, v_prod->>'marca', coalesce(v_prod->'detalhes','{}'),
          (v_prod->>'controla_validade')::boolean,
          coalesce(array(select jsonb_array_elements_text(v_prod->'avisos_dias'))::smallint[], '{}'))
  on conflict (id) do update set
    fornecedor_id = excluded.fornecedor_id, codigo_barras = excluded.codigo_barras, nome = excluded.nome,
    categoria = excluded.categoria, preco_compra = excluded.preco_compra, preco_venda = excluded.preco_venda,
    marca = excluded.marca, detalhes = excluded.detalhes, controla_validade = excluded.controla_validade,
    avisos_dias = excluded.avisos_dias
    -- unidade não muda depois de haver estoque (regra do app; reforçar com trigger se desejado)
  where produtos.comercio_id = v_com;  -- RLS + trigger impedem trocar de comércio

  for a in select * from jsonb_array_elements(coalesce(p->'variacoes','[]')) loop
    insert into produto_variacoes (id, comercio_id, produto_id, tamanho, cor, codigo_barras)
    values ((a->>'id')::uuid, v_com, v_id, a->>'tamanho', a->>'cor', a->>'codigo_barras')
    on conflict (id) do update set tamanho = excluded.tamanho, cor = excluded.cor, codigo_barras = excluded.codigo_barras
    where produto_variacoes.produto_id = v_id;
  end loop;

  for a in select * from jsonb_array_elements(coalesce(p->'areas','[]')) loop
    v_var := (a->>'variacao_id')::uuid; v_area := (a->>'area')::area_estoque; v_local := null;
    if a->'local' is not null and a->'local' <> 'null' then
      v_local := (a->'local'->>'id')::uuid;
      if v_local is null then
        insert into locais (comercio_id, area, nome) values (v_com, v_area, a->'local'->>'nome')
        on conflict (comercio_id, area, nome_norm) do update set nome = locais.nome returning id into v_local;
      end if;
    end if;
    insert into produto_areas (comercio_id, produto_id, variacao_id, area, local_id, minimo, maximo)
    values (v_com, v_id, v_var, v_area, v_local, (a->>'minimo')::numeric, (a->>'maximo')::numeric)
    on conflict (produto_id, variacao_id, area) do update
      set local_id = excluded.local_id, minimo = excluded.minimo, maximo = excluded.maximo;

    -- Contagem inicial: só se ainda não existe para esta chave (editar nunca reconta).
    if a->'contagem' is not null and a->'contagem' <> 'null' and not exists (
      select 1 from movimentos where produto_id = v_id and variacao_id is not distinct from v_var
        and area = v_area and tipo = 'contagem_inicial') then
      v_soma := 0;
      for pt in select * from jsonb_array_elements(coalesce(a->'contagem'->'partes','[]')) loop
        if (pt->>'quantidade')::numeric <= 0 then raise exception 'parte_sem_quantidade' using errcode='23514'; end if;
        v_lote := null;
        if pt->'lote' is not null and pt->'lote' <> 'null' then
          if pt->'lote'->>'numero' is not null then
            select id into v_lote from lotes where produto_id = v_id and variacao_id is not distinct from v_var
              and numero = pt->'lote'->>'numero';
            if v_lote is not null and (select vencimento from lotes where id = v_lote)
                 is distinct from (pt->'lote'->>'vencimento')::date then
              raise exception 'lote_com_datas_diferentes' using errcode='23514';
            end if;
          end if;
          if v_lote is null then
            insert into lotes (comercio_id, produto_id, variacao_id, numero, vencimento)
            values (v_com, v_id, v_var, pt->'lote'->>'numero', (pt->'lote'->>'vencimento')::date) returning id into v_lote;
          end if;
        end if;
        insert into saldos (comercio_id, produto_id, variacao_id, area, lote_id, pendente, quantidade)
        values (v_com, v_id, v_var, v_area, v_lote, coalesce((pt->>'pendente')::boolean,false), (pt->>'quantidade')::numeric)
        returning id into v_saldo;
        insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, lote_id, saldo_id, tipo, quantidade)
        values (v_op, v_com, v_id, v_var, v_area, v_local, v_lote, v_saldo, 'contagem_inicial', (pt->>'quantidade')::numeric);
        v_soma := v_soma + (pt->>'quantidade')::numeric;
      end loop;
      -- Produto sem validade: uma parte só, sem lote. Soma precisa bater com o contado.
      if v_soma <> (a->'contagem'->>'quantidade')::numeric then
        raise exception 'soma_diferente_da_contagem' using errcode='23514';
      end if;
      insert into movimentos (operacao_id, comercio_id, produto_id, variacao_id, area, local_id, tipo, quantidade)
      values (v_op, v_com, v_id, v_var, v_area, v_local, 'contagem_inicial', v_soma); -- marcador (aceita zero)
    end if;
  end loop;
  return v_id;
end $$;
revoke execute on function public.salvar_produto(jsonb) from public, anon;
grant execute on function public.salvar_produto(jsonb) to authenticated;
-- security invoker: lotes/saldos/movimentos não têm política de escrita para o usuário,
-- então na revisão final esta função passa a SECURITY DEFINER (mantendo a checagem
-- pode_acessar_comercio no início), ou ganha políticas de INSERT restritas. Decidir na revisão.

-- Completar/dividir pendência ao editar: função separada (fase 2), que exige
-- soma das partes = quantidade da pendência de origem e grava 'divisao_pendencia'.
