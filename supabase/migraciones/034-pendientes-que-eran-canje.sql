-- =====================================================================
-- 034 — Los pendientes de los cierres eran canjes
-- =====================================================================
-- Los cierres ya hechos arrastran unos S/ 60 marcados como "por cobrar".
-- No es plata que alguien deba: son productos entregados por canje, que se
-- registraron antes de que la caja tuviera esa forma de pago y quedaron
-- como pendientes por no haber otra opción.
--
-- Pasarlos a canje arregla dos cosas a la vez: deja de figurar una deuda
-- que nadie va a pagar, y el valor entregado se contabiliza donde debe, en
-- su propia línea del arqueo, sin sumarse a lo cobrado.
--
-- Solo toca CIERRES YA HECHOS (`cierre <> ''`). La caja abierta se queda
-- fuera a propósito: ahí manda el celular, sus pendientes pueden ser deudas
-- de verdad del turno en curso, y el siguiente cambio hecho en el puesto
-- pisaría cualquier corrección que se hiciera aquí.
--
-- Al pasar a canje los montos de Yape y efectivo van a 0: por un canje no
-- entró plata por ninguna de las dos vías.
--
-- Idempotente: al terminar ya no quedan pendientes en cierres, así que
-- volver a ejecutarla no cambia nada.
-- =====================================================================

-- Para ver qué se va a tocar ANTES de aplicarlo:
--   select cierre, count(*), sum(total)
--   from public.caja_pedidos
--   where pagado = false and cierre <> ''
--   group by cierre;

update public.caja_pedidos
set metodo         = 'canje',
    pagado         = true,
    monto_yape     = 0,
    monto_efectivo = 0
where pagado = false
  and cierre <> '';

-- Comprobación posterior: el canje debe aparecer con su total y ya no debe
-- quedar nada por cobrar en cierres.
--   select cierre, metodo, pagado, count(*), sum(total)
--   from public.caja_pedidos
--   group by cierre, metodo, pagado
--   order by cierre, metodo;
