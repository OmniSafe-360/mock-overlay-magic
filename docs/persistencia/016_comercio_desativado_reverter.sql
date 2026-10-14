-- REVERSÃO da Correção de segurança 1: volta os corpos de antes — NÃO APLICADA EM PRODUÇÃO.
-- Comércio desativado (comercios.ativo = false): a equipe não confere código, não entra,
-- não destrava o PIN e não executa nenhuma operação, mesmo com o celular já ligado.
-- Corpos copiados de pg_get_functiondef em produção (14/10/2026); única mudança: a checagem de comercios.ativo.
-- Todas as 23 funções da equipe/caixa passam por _funcionario_da_chave (direto ou via
-- _funcionario_caixa/_recebe/_repoe), então a checagem central cobre todas.
-- sair_funcionario continua igual (sair do celular sempre é permitido).
-- A chave do celular NÃO é encerrada: se o dono reativar, o celular volta a funcionar
-- e as vendas guardadas sem internet sobem normalmente.

CREATE OR REPLACE FUNCTION public._funcionario_da_chave(_chave text)
 RETURNS funcionarios
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.conferir_codigo_funcionario(_codigo text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v funcionarios%rowtype;
begin
  if _codigo is null or _codigo !~ '^[0-9]{6}$' then return null; end if;
  select * into v from funcionarios where codigo = _codigo and bloqueado_em is null;
  if not found then return null; end if;
  if v.pin_hash is null then
    if v.codigo_gerado_em < now() - interval '48 hours' then return 'expirado'; end if;
    return 'novo';
  end if;
  return 'pin';
end $function$;

CREATE OR REPLACE FUNCTION public.entrar_funcionario(_codigo text, _pin text, _aparelho text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.funcionario_desbloquear(_chave text, _pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$;
DO $migr$
declare d text; depois text := E'    return null;\n  end;'; antes text := E'    if sqlerrm = ''comercio_desativado'' then raise; end if;\n    return null;\n  end;';
begin
  d := pg_get_functiondef('public.funcionario_inicio(text)'::regprocedure);
  if position(antes in d) = 0 then raise exception 'funcionario_inicio sem a correção; nada a reverter'; end if;
  execute replace(d, antes, depois);
end $migr$;
