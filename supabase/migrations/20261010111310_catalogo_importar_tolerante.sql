-- Importador do catálogo: falha de rede (tempo esgotado, conexão) volta como {"erro": ...} em vez de desfazer o lote inteiro.
create or replace function public._catalogo_importar(_q text, _pagina int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; j jsonb; h jsonb; v_cod text; v_nome text; v_marca text; v_qtd text; v_img text;
  v_lidos int := 0; v_gravados int := 0; v_ignorados int := 0; v_url text;
begin
  perform importador.http_set_curlopt('CURLOPT_TIMEOUT', '60');
  perform importador.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '20');
  v_url := 'https://search.openfoodfacts.org/search?q=' || importador.urlencode(_q) || '&page_size=100&page=' || _pagina
        || '&fields=code,product_name,product_name_pt,brands,quantity,image_front_small_url';
  begin
    select * into r from importador.http(('GET', v_url, array[importador.http_header('User-Agent', 'OmniSafe360/1.0 (catalogo de produtos)')], null, null)::importador.http_request);
  exception when others then
    return jsonb_build_object('erro', left(sqlerrm, 120));
  end;
  if r.status <> 200 or r.content_type not like 'application/json%' then
    return jsonb_build_object('erro', r.status);
  end if;
  j := r.content::jsonb;
  for h in select * from jsonb_array_elements(coalesce(j->'hits', '[]')) loop
    v_lidos := v_lidos + 1;
    v_cod := public.gtin_canonico(h->>'code');
    v_nome := left(regexp_replace(btrim(coalesce(nullif(btrim(h->>'product_name_pt'), ''), h->>'product_name', '')), '\s+', ' ', 'g'), 200);
    if v_cod is null or char_length(v_nome) < 2 or v_nome !~ '[[:alpha:]]' then v_ignorados := v_ignorados + 1; continue; end if;
    v_marca := nullif(left(regexp_replace(btrim(case jsonb_typeof(h->'brands') when 'array' then h->'brands'->>0 else split_part(coalesce(h->>'brands', ''), ',', 1) end), '\s+', ' ', 'g'), 120), '');
    v_qtd := nullif(left(regexp_replace(btrim(coalesce(h->>'quantity', '')), '\s+', ' ', 'g'), 60), '');
    v_img := case when h->>'image_front_small_url' like 'https://images.openfoodfacts.org/%' and char_length(h->>'image_front_small_url') <= 300 then h->>'image_front_small_url' end;
    insert into catalogo_produtos (codigo, nome, marca, quantidade, imagem_url, fonte, atualizado_em)
    values (v_cod, v_nome, v_marca, v_qtd, v_img, 'openfoodfacts', now())
    on conflict (codigo) do update set nome = excluded.nome, marca = excluded.marca, quantidade = excluded.quantidade,
      imagem_url = excluded.imagem_url, atualizado_em = now();
    v_gravados := v_gravados + 1;
  end loop;
  return jsonb_build_object('lidos', v_lidos, 'gravados', v_gravados, 'ignorados', v_ignorados, 'total', j->'count', 'paginas', j->'page_count');
end $$;
revoke all on function public._catalogo_importar(text, int) from public, anon, authenticated;
