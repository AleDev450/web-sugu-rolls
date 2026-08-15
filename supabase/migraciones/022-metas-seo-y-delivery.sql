-- =====================================================================
-- 022 — Metadatos para Google y costo de delivery por distancia
-- =====================================================================
-- Dos cosas sin relación entre sí que llegaron en el mismo pedido:
--
-- 1) Metas de SEO editables desde el panel (/admin/seo): título,
--    descripción e imagen que Google muestra en el resultado de búsqueda.
--    Vacías = se usa el texto que ya trae el código (layout.tsx), así que
--    esta migración no cambia nada hasta que alguien las llene.
--
-- 2) Coordenadas del local y tarifa de delivery, para estimar el costo
--    según la distancia cuando el cliente elige su dirección con el
--    autocompletado de Google Maps. Sin coordenadas del local (NULL) la
--    web sigue funcionando igual que antes: solo pide la dirección y el
--    costo real se confirma por WhatsApp, como siempre.
--
-- Idempotente.
-- =====================================================================

alter table public.site_settings
  add column if not exists meta_titulo text not null default '',
  add column if not exists meta_descripcion text not null default '',
  add column if not exists meta_imagen text not null default '';

comment on column public.site_settings.meta_titulo is
  'Título que Google muestra en el resultado de búsqueda. Vacío = usa el del código.';
comment on column public.site_settings.meta_descripcion is
  'Descripción bajo el título en el resultado de Google. Vacío = usa la del código.';
comment on column public.site_settings.meta_imagen is
  'Imagen para compartir en redes y como miniatura de búsqueda (Open Graph). Vacío = usa la del código.';

alter table public.site_settings
  add column if not exists tienda_lat double precision,
  add column if not exists tienda_lng double precision,
  add column if not exists delivery_tarifa_base numeric(10, 2) not null default 0,
  add column if not exists delivery_tarifa_km numeric(10, 2) not null default 0;

comment on column public.site_settings.tienda_lat is
  'Latitud del local, para calcular la distancia de reparto. NULL = no se calcula.';
comment on column public.site_settings.tienda_lng is
  'Longitud del local, para calcular la distancia de reparto. NULL = no se calcula.';
comment on column public.site_settings.delivery_tarifa_base is
  'Costo fijo de delivery en soles, antes de sumar la distancia.';
comment on column public.site_settings.delivery_tarifa_km is
  'Soles adicionales por cada kilómetro entre el local y la dirección del cliente.';
