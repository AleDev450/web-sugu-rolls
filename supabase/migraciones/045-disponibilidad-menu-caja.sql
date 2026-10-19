-- Disponibilidad de cada presentación en el menú de caja.
-- La fila base (caja = '') se aplica a todas; una fila de cajero puede
-- sobrescribirla. Claves ausentes heredan y, por defecto, están habilitadas.
alter table public.caja_precios
  add column if not exists disponibilidad jsonb not null default '{}'::jsonb;

comment on column public.caja_precios.disponibilidad is
  'Mapa de claves del menú a booleanos: true habilitado, false deshabilitado; ausente hereda.';

notify pgrst, 'reload schema';
