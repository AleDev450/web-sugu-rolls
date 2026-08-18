-- =====================================================================
-- 028 — Temporizador de la partida, ajustable desde el panel
-- =====================================================================
-- Hasta ahora una partida solo terminaba al llenar la caja, así que un
-- jugador bueno podía estar quince minutos y el ranking se decidía por
-- aguante más que por habilidad. Con un límite de tiempo todas las partidas
-- duran lo mismo y se pueden comparar de verdad.
--
-- Se guarda en SEGUNDOS y no en minutos para poder afinar (150 = 2:30).
--
--   0    -> sin límite, se juega hasta llenar la caja (como antes)
--   300  -> 5 minutos (por defecto)
--   3600 -> el techo, una hora
--
-- Idempotente.
-- =====================================================================

alter table public.site_settings
  add column if not exists juego_duracion_seg integer not null default 300;

alter table public.site_settings
  drop constraint if exists juego_duracion_razonable;
alter table public.site_settings
  add constraint juego_duracion_razonable
  check (juego_duracion_seg >= 0 and juego_duracion_seg <= 3600);

comment on column public.site_settings.juego_duracion_seg is
  'Duración de una partida en segundos. 0 = sin límite (se juega hasta llenar la caja).';
