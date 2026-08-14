-- =====================================================================
-- 016 — Separación extra del slider
-- =====================================================================
-- Cuánto baja el carrusel POR DEBAJO del header, en píxeles.
--
-- El slider ya arranca donde termina la barra (`--header-alto`, que el propio
-- header mide). Esto es un ajuste fino encima de eso, para dejar aire cuando
-- la imagen lo pide, sin tener que tocar código cada vez.
--
-- 0 = pegado al header. La altura visible se descuenta sola, así que el
-- carrusel nunca se sale de la pantalla por mucho que se baje.
--
-- Idempotente.
-- =====================================================================

alter table public.site_settings
  add column if not exists slider_margen smallint not null default 0;

alter table public.site_settings
  drop constraint if exists slider_margen_valido;
alter table public.site_settings
  add constraint slider_margen_valido check (slider_margen between 0 and 300);

comment on column public.site_settings.slider_margen is
  'Píxeles extra entre el header y el slider. 0 = pegado.';
