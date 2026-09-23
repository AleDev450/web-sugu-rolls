-- =====================================================================
-- 032 — Formas de pago: tarjeta y canje
-- =====================================================================
-- En el puesto aparecen dos casos más:
--
--   · TARJETA. Es plata que entra, pero no al cajón ni al Yape. Si se
--     contara como efectivo, el arqueo del cierre no cuadraría nunca.
--
--   · CANJE. Un producto entregado contra un premio o un código: se sirve
--     igual, se cocina igual, pero NO entra plata. Su valor se registra
--     para saber cuánto se regaló, no para sumarlo a lo cobrado.
--
-- No hace falta una columna nueva. `monto_yape` y `monto_efectivo` siguen
-- siendo el reparto de esos dos medios —y quedan en 0 para tarjeta y
-- canje—, así que lo cobrado por tarjeta y el valor canjeado se deducen del
-- método y del total. Sumar las dos columnas de monto sigue dando
-- exactamente la plata que pasó por Yape y por el cajón.
--
-- Idempotente.
-- =====================================================================

alter table public.caja_pedidos drop constraint if exists caja_metodo_valido;
alter table public.caja_pedidos
  add constraint caja_metodo_valido
  check (metodo in ('efectivo', 'yape', 'mixto', 'tarjeta', 'canje'));

comment on column public.caja_pedidos.metodo is
  'efectivo | yape | mixto | tarjeta | canje. En tarjeta y canje los montos de Yape y efectivo van en 0.';
