-- =====================================================================
-- 015 — Encuadre y velo de las diapositivas
-- =====================================================================
-- Tres ajustes por diapositiva:
--
--   · `foco` / `foco_movil`: qué parte de la foto se mantiene visible cuando
--     hay que recortarla. Una imagen 1920x1080 en una pantalla de móvil se
--     recorta muchísimo, y sin control el navegador se queda con el centro —
--     que casi nunca es donde está lo importante.
--
--   · `velo`: cuánto se oscurece la foto (0-100). El texto necesita contraste,
--     pero un velo fijo dejaba las fotos claras apagadas y las oscuras
--     ilegibles. Con esto se ajusta por diapositiva.
--
-- El foco se guarda tal cual lo entiende CSS (`object-position`): "50% 50%".
--
-- Idempotente.
-- =====================================================================

alter table public.slides
  add column if not exists foco       text     not null default '50% 50%',
  add column if not exists foco_movil text     not null default '50% 50%',
  add column if not exists velo       smallint not null default 35;

alter table public.slides
  drop constraint if exists velo_valido;
alter table public.slides
  add constraint velo_valido check (velo between 0 and 100);

comment on column public.slides.foco is
  'object-position de la imagen de escritorio: qué zona no se recorta.';
comment on column public.slides.foco_movil is
  'Lo mismo para la versión de móvil.';
comment on column public.slides.velo is
  'Oscurecido de la foto, 0-100. Sube si el texto no se lee; baja si la foto se ve apagada.';
