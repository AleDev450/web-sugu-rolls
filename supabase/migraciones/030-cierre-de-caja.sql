-- =====================================================================
-- 030 — Cerrar la caja de feria con un nombre
-- =====================================================================
-- Al terminar una feria se "cierra caja": se cuenta lo vendido y se le pone
-- nombre a esa jornada —"Feria Pueblo Libre", "Sábado noche"— para poder
-- volver a buscarla después. Eso es esta columna.
--
-- Vacío significa CAJA ABIERTA: son los cobros del turno en curso, los que
-- la tablet muestra mientras se atiende. Al cerrar, todos los abiertos se
-- sellan con el mismo nombre de una vez y la caja vuelve a cero sin borrar
-- nada: lo cerrado sigue aquí y en el historial de la tablet.
--
-- Es texto y no una tabla de cierres a propósito: el nombre lo escribe
-- quien atiende, en el puesto, a veces sin señal. Una tabla aparte
-- obligaría a crear la fila del cierre ANTES de poder cerrar, que es justo
-- lo que no se puede garantizar ahí.
--
-- Idempotente.
-- =====================================================================

alter table public.caja_pedidos
  add column if not exists cierre text not null default '';

comment on column public.caja_pedidos.cierre is
  'Nombre del cierre de caja al que pertenece el cobro. Vacío = caja todavía abierta en la tablet.';

-- el panel agrupa y filtra por cierre; los abiertos se consultan aparte
create index if not exists caja_pedidos_cierre_idx
  on public.caja_pedidos (cierre, creado desc)
  where cierre <> '';
