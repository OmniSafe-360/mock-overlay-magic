-- Catálogo: consulta na hora. O índice de busca do Open Food Facts usado na importação está incompleto (cerca de 22 mil
-- dos ~37 mil produtos do Brasil; ex.: Nescau lata 350 g 7891000412855 ficou de fora). Quando o código não está no catálogo,
-- buscar_catalogo pergunta direto na base principal do Open Food Facts (um código por vez, tempo curto), confere e guarda.

/* Confere e grava um produto vindo do Open Food Facts. Devolve o código gravado, ou null se não serve. Só para uso interno. */
create or replace function public._catalogo_gravar(h jsonb) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cod text; v_nome text; v_marca text; v_qtd text; v_img text;
begin
  v_cod := public.gtin_canonico(h->>'code');
  v_nome := left(regexp_replace(btrim(coalesce(nullif(btrim(h->>'product_name_pt'), ''), h->>'product_name', '')), '\s+', ' ', 'g'), 200);
  if v_cod is null or char_length(v_nome) < 2 or v_nome !~ '[[:alpha:]]' then return null; end if;
  v_marca := nullif(left(regexp_replace(btrim(case jsonb_typeof(h->'brands') when 'array' then h->'brands'->>0 else split_part(coalesce(h->>'brands', ''), ',', 1) end), '\s+', ' ', 'g'), 120), '');
  v_qtd := nullif(left(regexp_replace(btrim(coalesce(h->>'quantity', '')), '\s+', ' ', 'g'), 60), '');
  v_img := case when h->>'image_front_small_url' like 'https://images.openfoodfacts.org/%' and char_length(h->>'image_front_small_url') <= 300 then h->>'image_front_small_url' end;
  insert into catalogo_produtos (codigo, nome, marca, quantidade, imagem_url, fonte, atualizado_em)
  values (v_cod, v_nome, v_marca, v_qtd, v_img, 'openfoodfacts', now())
  on conflict (codigo) do update set nome = excluded.nome, marca = excluded.marca, quantidade = excluded.quantidade,
    imagem_url = excluded.imagem_url, atualizado_em = now();
  return v_cod;
end $$;

/* Pergunta um código à base principal do Open Food Facts (tempo curto: 3 s para conectar, 6 s no total). */
create or replace function public._catalogo_buscar_fora(_cod text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; j jsonb;
begin
  perform importador.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '3');
  perform importador.http_set_curlopt('CURLOPT_TIMEOUT', '6');
  begin
    select * into r from importador.http(('GET', 'https://world.openfoodfacts.org/api/v2/product/' || _cod
      || '.json?fields=code,product_name,product_name_pt,brands,quantity,image_front_small_url',
      array[importador.http_header('User-Agent', 'OmniSafe360/1.0 (catalogo de produtos)')], null, null)::importador.http_request);
  exception when others then
    return null;
  end;
  if r.status <> 200 or r.content_type not like 'application/json%' then return null; end if;
  j := r.content::jsonb;
  if coalesce((j->>'status')::int, 0) <> 1 or j->'product' is null then return null; end if;
  return public._catalogo_gravar(j->'product' || jsonb_build_object('code', _cod));
end $$;

/* Ao bipar: procura no catálogo; se não tiver, pergunta na hora ao Open Food Facts e guarda. Só para quem está logado. */
create or replace function public.buscar_catalogo(_codigo text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_cod text := public.gtin_canonico(_codigo); c catalogo_produtos%rowtype;
begin
  if auth.uid() is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if v_cod is null then return null; end if;
  select * into c from catalogo_produtos where codigo = v_cod;
  if not found then
    if public._catalogo_buscar_fora(v_cod) is null then return null; end if;
    select * into c from catalogo_produtos where codigo = v_cod;
    if not found then return null; end if;
  end if;
  return jsonb_build_object('codigo', c.codigo, 'nome', c.nome, 'marca', c.marca, 'quantidade', c.quantidade, 'imagem_url', c.imagem_url, 'fonte', c.fonte);
end $$;

revoke all on function public._catalogo_gravar(jsonb), public._catalogo_buscar_fora(text), public.buscar_catalogo(text) from public, anon, authenticated;
grant execute on function public.buscar_catalogo(text) to authenticated;
