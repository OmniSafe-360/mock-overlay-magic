-- App do funcionário pede o PIN toda vez que é aberto (como o dono aprovou: "nas próximas vezes, só o PIN").
-- O celular continua lembrado, mas só funciona por 12 horas depois de digitar o PIN; a tela trava também ao abrir o app
-- e depois de alguns minutos parado.

alter table public.funcionario_aparelhos add column if not exists desbloqueado_ate timestamptz;

/* Funcionário dono da chave, com o PIN digitado há pouco (uso interno das funções do app do funcionário). */
create or replace function public._funcionario_da_chave(_chave text) returns public.funcionarios
language plpgsql security definer set search_path = public, pg_temp as $$
declare a funcionario_aparelhos%rowtype; v funcionarios%rowtype;
begin
  if _chave is null or _chave !~ '^[0-9a-f]{64}$' then raise exception 'acesso_encerrado' using errcode = '42501'; end if;
  select * into a from funcionario_aparelhos where chave_hash = encode(extensions.digest(_chave, 'sha256'), 'hex') and encerrado_em is null;
  if not found then raise exception 'acesso_encerrado' using errcode = '42501'; end if;
  select * into v from funcionarios where id = a.funcionario_id and bloqueado_em is null;
  if not found then raise exception 'acesso_encerrado' using errcode = '42501'; end if;
  if a.desbloqueado_ate is null or a.desbloqueado_ate < now() then raise exception 'pin_necessario' using errcode = '42501'; end if;
  update funcionario_aparelhos set ultimo_uso = now() where id = a.id and ultimo_uso < now() - interval '1 minute';
  update funcionarios set ultimo_acesso = now() where id = v.id and (ultimo_acesso is null or ultimo_acesso < now() - interval '1 minute');
  return v;
end $$;

/* Entrar: com o código e o PIN (no primeiro acesso, o PIN é criado aqui). Devolve a chave do celular, já destravada. */
create or replace function public.entrar_funcionario(_codigo text, _pin text, _aparelho text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; v_chave text; c comercios%rowtype;
begin
  if _codigo is null or _codigo !~ '^[0-9]{6}$' then raise exception 'codigo_invalido' using errcode = '42501'; end if;
  select * into v from funcionarios where codigo = _codigo and bloqueado_em is null for update;
  if not found then raise exception 'codigo_invalido' using errcode = '42501'; end if;
  if v.travado_ate is not null and v.travado_ate > now() then
    raise exception 'muitas_tentativas:%', ceil(extract(epoch from (v.travado_ate - now())) / 60)::int using errcode = '42501'; end if;
  if _pin is null or _pin !~ '^[0-9]{4}$' then raise exception 'pin_formato' using errcode = '22023'; end if;
  if v.pin_hash is null then
    if v.codigo_gerado_em < now() - interval '48 hours' then raise exception 'codigo_expirado' using errcode = '42501'; end if;
    if _pin ~ '^(\d)\1{3}$' or _pin in ('1234', '4321', '0123', '9876') then raise exception 'pin_facil' using errcode = '23514'; end if;
    update funcionarios set pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf', 8)), pin_criado_em = now() where id = v.id;
  elsif extensions.crypt(_pin, v.pin_hash) <> v.pin_hash then
    if v.pin_tentativas + 1 >= 5 then
      update funcionarios set pin_tentativas = 0, travado_ate = now() + interval '15 minutes' where id = v.id;
      return jsonb_build_object('erro', 'muitas_tentativas:15');
    end if;
    update funcionarios set pin_tentativas = pin_tentativas + 1 where id = v.id;
    return jsonb_build_object('erro', 'pin_errado:' || (5 - v.pin_tentativas - 1));
  end if;
  v_chave := encode(extensions.gen_random_bytes(32), 'hex');
  insert into funcionario_aparelhos (funcionario_id, comercio_id, chave_hash, aparelho, desbloqueado_ate)
  values (v.id, v.comercio_id, encode(extensions.digest(v_chave, 'sha256'), 'hex'), left(nullif(btrim(coalesce(_aparelho, '')), ''), 120), now() + interval '12 hours');
  update funcionarios set pin_tentativas = 0, travado_ate = null, ultimo_acesso = now() where id = v.id;
  select * into c from comercios where id = v.comercio_id;
  return jsonb_build_object('chave', v_chave, 'nome', v.nome, 'funcao', v.funcao, 'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo));
end $$;

/* Destravar o app neste celular com o PIN. Mesma regra de tentativas da entrada (5 erros travam 15 minutos).
   PIN errado devolve {erro} (sem desfazer), para a contagem de tentativas ficar gravada. */
create or replace function public.funcionario_desbloquear(_chave text, _pin text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a funcionario_aparelhos%rowtype; v funcionarios%rowtype;
begin
  if _chave is null or _chave !~ '^[0-9a-f]{64}$' then raise exception 'acesso_encerrado' using errcode = '42501'; end if;
  select * into a from funcionario_aparelhos where chave_hash = encode(extensions.digest(_chave, 'sha256'), 'hex') and encerrado_em is null for update;
  if not found then raise exception 'acesso_encerrado' using errcode = '42501'; end if;
  select * into v from funcionarios where id = a.funcionario_id and bloqueado_em is null for update;
  if not found or v.pin_hash is null then raise exception 'acesso_encerrado' using errcode = '42501'; end if;
  if v.travado_ate is not null and v.travado_ate > now() then
    raise exception 'muitas_tentativas:%', ceil(extract(epoch from (v.travado_ate - now())) / 60)::int using errcode = '42501'; end if;
  if _pin is null or _pin !~ '^[0-9]{4}$' then raise exception 'pin_formato' using errcode = '22023'; end if;
  if extensions.crypt(_pin, v.pin_hash) <> v.pin_hash then
    if v.pin_tentativas + 1 >= 5 then
      update funcionarios set pin_tentativas = 0, travado_ate = now() + interval '15 minutes' where id = v.id;
      return jsonb_build_object('erro', 'muitas_tentativas:15');
    end if;
    update funcionarios set pin_tentativas = pin_tentativas + 1 where id = v.id;
    return jsonb_build_object('erro', 'pin_errado:' || (5 - v.pin_tentativas - 1));
  end if;
  update funcionario_aparelhos set desbloqueado_ate = now() + interval '12 hours', ultimo_uso = now() where id = a.id;
  update funcionarios set pin_tentativas = 0, travado_ate = null, ultimo_acesso = now() where id = v.id;
  return jsonb_build_object('ok', true);
end $$;

/* Tela inicial do funcionário. null = celular desligado; {pin_necessario} = precisa digitar o PIN. */
create or replace function public.funcionario_inicio(_chave text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v funcionarios%rowtype; c comercios%rowtype; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_entregas int; v_hoje_n int; v_repor int;
begin
  begin v := public._funcionario_da_chave(_chave);
  exception when others then
    if sqlerrm = 'pin_necessario' then
      select f.* into v from funcionario_aparelhos a join funcionarios f on f.id = a.funcionario_id
       where a.chave_hash = encode(extensions.digest(_chave, 'sha256'), 'hex') and a.encerrado_em is null and f.bloqueado_em is null;
      select * into c from comercios where id = v.comercio_id;
      return jsonb_build_object('pin_necessario', true, 'nome', v.nome, 'funcao', v.funcao, 'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo));
    end if;
    return null;
  end;
  select * into c from comercios where id = v.comercio_id;
  select count(*), count(*) filter (where previsao_entrega is not null and previsao_entrega <= v_hoje)
    into v_entregas, v_hoje_n
    from pedidos_compra pc where comercio_id = v.comercio_id and situacao in ('enviado', 'aceito', 'aceito_ajustes', 'recebido_parcial')
     and not exists (select 1 from recebimentos r where r.pedido_id = pc.id and r.situacao = 'concluido');
  select count(*) into v_repor from (
    select pa.produto_id, pa.variacao_id
      from produto_areas pa join produtos p on p.id = pa.produto_id and p.ativo
      left join saldos s on s.produto_id = pa.produto_id and s.variacao_id is not distinct from pa.variacao_id and s.area = 'venda'
     where pa.comercio_id = v.comercio_id and pa.area = 'venda' and pa.minimo is not null
     group by pa.produto_id, pa.variacao_id, pa.minimo
    having coalesce(sum(s.quantidade), 0) <= pa.minimo) x;
  return jsonb_build_object('nome', v.nome, 'funcao', v.funcao, 'comercio', jsonb_build_object('nome', c.nome, 'tipo', c.tipo),
    'avisos', jsonb_build_object('entregas', v_entregas, 'entregas_hoje', v_hoje_n, 'repor', v_repor));
end $$;

revoke all on function public.funcionario_desbloquear(text, text) from public, anon, authenticated;
grant execute on function public.funcionario_desbloquear(text, text) to anon, authenticated;
