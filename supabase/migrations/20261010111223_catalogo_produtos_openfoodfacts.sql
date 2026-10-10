-- Catálogo de produtos por código de barras (aprovado pelo dono em 10/10/2026: "vamos fazer somente a do mercado agora
-- para a gente testar... faz no Supabase um local para guardar isso daí para quando bipar ser puxado").
-- Fonte inicial: Open Food Facts (base aberta, licença ODbL — dar o crédito e manter esta parte aberta), produtos do Brasil.
-- Só dados que são iguais em qualquer loja: código, nome, marca, tamanho e foto. Nunca preço, estoque, fornecedor ou local.
-- Ninguém lê a tabela direto: o app consulta um código por vez (buscar_catalogo), ao bipar.

-- A ferramenta de download (extensão http) fica num esquema fechado: visitantes e usuários comuns nem entram nele.
-- (No esquema "extensions" o próprio Supabase libera as funções para todos, e não dá para retirar.)
create schema if not exists importador;
revoke all on schema importador from public, anon, authenticated;
create extension if not exists http with schema importador;

create table public.catalogo_produtos (
  codigo text primary key check (codigo ~ '^([0-9]{8}|[0-9]{13}|[0-9]{14})$'),
  nome text not null check (char_length(nome) between 2 and 200),
  marca text check (char_length(marca) <= 120),
  quantidade text check (char_length(quantidade) <= 60),
  imagem_url text check (imagem_url like 'https://images.openfoodfacts.org/%' and char_length(imagem_url) <= 300),
  fonte text not null default 'openfoodfacts' check (fonte in ('openfoodfacts')),
  atualizado_em timestamptz not null default now()
);
comment on table public.catalogo_produtos is 'Catálogo por código de barras para sugerir o nome ao bipar. Fonte: Open Food Facts (ODbL). Sem preço/estoque.';
alter table public.catalogo_produtos enable row level security;
revoke all on public.catalogo_produtos from public, anon, authenticated;

/* Código de barras na forma única (GTIN-13; EAN-8 e GTIN-14 ficam como estão). Devolve null se o dígito final não confere,
   ou se for código de uso interno (balança, loja: começa com 2; 020–029 e 040–049), que muda de um comércio para outro. */
create or replace function public.gtin_canonico(_c text) returns text
language plpgsql immutable set search_path = public, pg_temp as $$
declare c text := btrim(coalesce(_c, '')); n int; s int := 0; i int;
begin
  if c !~ '^[0-9]+$' then return null; end if;
  n := length(c);
  if n = 12 then c := '0' || c; n := 13; end if;
  if n = 14 and left(c, 1) = '0' then c := substr(c, 2); n := 13; end if;
  if n not in (8, 13, 14) or c ~ '^0+$' then return null; end if;
  for i in 1 .. n - 1 loop
    s := s + substr(c, n - i, 1)::int * (case when i % 2 = 1 then 3 else 1 end);
  end loop;
  if (10 - s % 10) % 10 <> substr(c, n, 1)::int then return null; end if;
  if n = 13 and (left(c, 1) = '2' or left(c, 3) between '020' and '029' or left(c, 3) between '040' and '049') then return null; end if;
  if n = 8 and left(c, 1) in ('0', '2') then return null; end if;
  return c;
end $$;

/* Importa uma página (até 100 produtos) da busca do Open Food Facts. _q = filtro (ex.: countries_tags:"en:brazil" AND code:7891*).
   Confere cada produto antes de gravar; repetir a mesma página não duplica (atualiza). Só para uso interno. */
create or replace function public._catalogo_importar(_q text, _pagina int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; j jsonb; h jsonb; v_cod text; v_nome text; v_marca text; v_qtd text; v_img text;
  v_lidos int := 0; v_gravados int := 0; v_ignorados int := 0; v_url text;
begin
  perform importador.http_set_curlopt('CURLOPT_TIMEOUT', '60');
  v_url := 'https://search.openfoodfacts.org/search?q=' || importador.urlencode(_q) || '&page_size=100&page=' || _pagina
        || '&fields=code,product_name,product_name_pt,brands,quantity,image_front_small_url';
  select * into r from importador.http(('GET', v_url, array[importador.http_header('User-Agent', 'OmniSafe360/1.0 (catalogo de produtos)')], null, null)::importador.http_request);
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

/* Ao bipar: procura um código no catálogo. Só para quem está logado; um código por vez. */
create or replace function public.buscar_catalogo(_codigo text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_cod text := public.gtin_canonico(_codigo); c catalogo_produtos%rowtype;
begin
  if auth.uid() is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if v_cod is null then return null; end if;
  select * into c from catalogo_produtos where codigo = v_cod;
  if not found then return null; end if;
  return jsonb_build_object('codigo', c.codigo, 'nome', c.nome, 'marca', c.marca, 'quantidade', c.quantidade, 'imagem_url', c.imagem_url, 'fonte', c.fonte);
end $$;

revoke all on function public._catalogo_importar(text, int), public.buscar_catalogo(text) from public, anon, authenticated;
grant execute on function public.buscar_catalogo(text) to authenticated;
