-- =====================================================================
-- 041 — Hora de entrega de cada cobro de caja
-- =====================================================================
-- Las estadísticas de /admin/caja miden el tiempo de atención: desde que
-- se cobró (`creado`) hasta que se tocó "Entregar". Esa segunda hora no
-- existía; `entregado` era solo sí o no.
--
-- La pone la tablet, con su propio reloj, igual que `creado`: una entrega
-- hecha sin señal sube después, y la hora de llegada al servidor no dice
-- nada de cuánto esperó el cliente.
--
-- Queda vacía en lo que se dio por entregado al cerrar la caja (migración
-- 040) y en lo que se cobró antes de esta versión: esos cobros no tienen
-- una hora real de entrega y no entran en el promedio.
--
-- Idempotente.
-- =====================================================================

alter table public.caja_pedidos
  add column if not exists entregado_en timestamptz;

comment on column public.caja_pedidos.entregado_en is
  'Hora en que se tocó "Entregar" en la caja (reloj de la tablet). Vacío si se dio por entregado al cerrar o si es anterior a la 041.';

notify pgrst, 'reload schema';
