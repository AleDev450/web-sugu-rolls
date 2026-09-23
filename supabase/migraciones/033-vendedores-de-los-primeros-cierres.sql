-- =====================================================================
-- 033 — Vendedor de los dos primeros cierres
-- =====================================================================
-- Los cierres "Kelly1642martes" y "ALEJANDRO MARTES" se registraron con la
-- versión de la caja que todavía no preguntaba quién atendía, así que sus
-- pedidos quedaron con `vendedor` vacío y el panel los agrupa bajo
-- "— sin nombre —". Esto les pone el nombre que corresponde.
--
-- Es una corrección de datos de una sola vez. De aquí en adelante no hace
-- falta: la caja pide el nombre antes de dejar cobrar, así que toda venta
-- nueva ya lo trae. Y si hubiera que corregir otro cierre, el panel tiene
-- el botón de asignar vendedor en la tabla "Por cierre" —solo sobre cierres
-- ya hechos, porque sobre la caja abierta manda el celular—.
--
-- El nombre del cierre se compara sin distinguir mayúsculas ni espacios de
-- sobra: se escribió a mano en el puesto y basta una mayúscula distinta
-- para que un `=` exacto no encuentre nada y la migración no haga ruido.
--
-- Idempotente: volver a ejecutarla deja las filas igual.
-- =====================================================================

update public.caja_pedidos
set vendedor = 'Kelly'
where upper(trim(cierre)) = upper('Kelly1642martes')
  and vendedor is distinct from 'Kelly';

update public.caja_pedidos
set vendedor = 'Alejandro'
where upper(trim(cierre)) = upper('ALEJANDRO MARTES')
  and vendedor is distinct from 'Alejandro';

-- Para comprobar el resultado desde el editor SQL:
--   select cierre, vendedor, count(*), sum(total)
--   from public.caja_pedidos
--   group by cierre, vendedor
--   order by cierre;
