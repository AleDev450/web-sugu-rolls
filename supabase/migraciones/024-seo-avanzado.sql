-- =====================================================================
-- 024 — SEO avanzado: identidad, favicon/logo estables, SEO por página
-- =====================================================================
-- Amplía las metas de SEO de la 022 (título/descripción/imagen) con:
--
--   1. Identidad: nombre del sitio, nombre alterno, favicon y logo.
--   2. index/follow configurables (activados por defecto).
--   3. Plantilla de título para páginas internas.
--   4. `page_seo`: título/descripción propios por ruta, para las páginas que
--      quieran algo distinto de lo que ya traen en el código.
--
-- El favicon y el logo NO se guardan en `site_settings` como una URL con
-- timestamp: se suben a una ruta FIJA del almacén (`secciones/favicon`,
-- `secciones/logo`) con `upsert`, así que reemplazarlos no cambia la URL —
-- necesario para que Google y los navegadores no sigan usando una versión
-- vieja en caché ni traten cada reemplazo como un archivo nuevo.
--
-- Esa URL fija del almacén tampoco es la que se publica: `/icon.png` y
-- `/favicon.ico` (rutas de Next, no archivos) la leen y la sirven en el
-- propio dominio, que es la URL de verdad estable que pide Google.
--
-- Idempotente.
-- =====================================================================

alter table public.site_settings
  add column if not exists seo_nombre_sitio    text not null default 'Sugu Rolls',
  add column if not exists seo_nombre_alterno  text not null default 'SuguRolls',
  add column if not exists seo_favicon         text not null default '',
  add column if not exists seo_logo            text not null default '',
  add column if not exists seo_plantilla_titulo text not null default '%s | Sugu Rolls',
  add column if not exists seo_robots_index    boolean not null default true,
  add column if not exists seo_robots_follow   boolean not null default true;

comment on column public.site_settings.seo_nombre_sitio is
  'Nombre del sitio para Google y los datos estructurados (WebSite.name, Restaurant.name).';
comment on column public.site_settings.seo_nombre_alterno is
  'Nombre alterno/corto (WebSite.alternateName), p. ej. "SuguRolls" sin espacio.';
comment on column public.site_settings.seo_favicon is
  'Ruta pública (en el almacén) del favicon subido. Vacío = se usa el favicon por defecto del código.';
comment on column public.site_settings.seo_logo is
  'Ruta pública (en el almacén) del logo del negocio, para Restaurant.logo y Organization.logo. Vacío = no se declara.';
comment on column public.site_settings.seo_plantilla_titulo is
  'Plantilla del <title> en páginas internas. %s se reemplaza por el título de cada página.';
comment on column public.site_settings.seo_robots_index is
  'Permite que los buscadores indexen el sitio. Desactivarlo pide no aparecer en resultados.';
comment on column public.site_settings.seo_robots_follow is
  'Permite que los buscadores sigan los enlaces del sitio.';

-- ---------------------------------------------------------------------
-- SEO por página: título y descripción propios para una ruta puntual.
-- Fila ausente o campos vacíos = se usa lo que ya trae el código de esa
-- página (`export const metadata` / `generateMetadata` de cada `page.tsx`).
-- ---------------------------------------------------------------------
create table if not exists public.page_seo (
  ruta        text primary key,
  titulo      text not null default '',
  descripcion text not null default '',
  updated_at  timestamptz not null default now()
);

comment on table public.page_seo is
  'Título y descripción propios por ruta, para SEO individual de páginas. Vacío = usa lo del código.';

drop trigger if exists page_seo_touch on public.page_seo;
create trigger page_seo_touch before update on public.page_seo
  for each row execute function public.touch_updated_at();

alter table public.page_seo enable row level security;

drop policy if exists "page_seo: lectura publica" on public.page_seo;
create policy "page_seo: lectura publica" on public.page_seo for select using (true);

drop policy if exists "page_seo: escribe admin" on public.page_seo;
create policy "page_seo: escribe admin" on public.page_seo
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.page_seo to anon, authenticated;
grant insert, update, delete on public.page_seo to authenticated;

-- ---------------------------------------------------------------------
-- El favicon puede subirse como .ico: el bucket `imagenes` (migración 012)
-- solo aceptaba WebP/JPEG/PNG.
-- ---------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array[
  'image/webp', 'image/jpeg', 'image/png',
  'image/x-icon', 'image/vnd.microsoft.icon'
]
where id = 'imagenes';
