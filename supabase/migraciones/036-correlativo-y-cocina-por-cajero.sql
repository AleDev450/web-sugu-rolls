-- =====================================================================
-- 036 — Correlativo del pedido y una cocina por cajero
-- =====================================================================
-- Dos cambios que vienen del mostrador:
--
--   1. CORRELATIVO. Cada pedido necesita un número que se pueda cantar al
--      entregar: 001, 002, 003… Se cuenta dentro de la caja abierta y
--      vuelve a empezar en cada cierre, así que dos cajeros del mismo día
--      pueden tener los dos un pedido 001 sin pisarse: lo que los separa es
--      el vendedor. Por eso NO es una secuencia de la base —una secuencia
--      sería única para todos y daría 001 a uno y 145 al otro—, sino un
--      número que calcula la caja al registrar, que además es lo único que
--      funciona sin señal.
--
--   2. UNA COCINA POR CAJERO. Antes el enlace mostraba la cola entera. Con
--      dos puestos atendiendo a la vez eso mezcla pedidos de ambos y quien
--      cocina no sabe a cuál entregar. Ahora el enlace lleva el nombre del
--      cajero y la pantalla lista solo lo suyo.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Correlativo
-- ---------------------------------------------------------------------

alter table public.caja_pedidos
  add column if not exists numero integer not null default 0;

comment on column public.caja_pedidos.numero is
  'Correlativo dentro de la caja abierta (1, 2, 3…). Lo asigna el celular y se reinicia en cada cierre; único junto al vendedor, no por sí solo.';

/*
 * Numerar lo que ya está guardado. Se reparte por vendedor y cierre —que es
 * el alcance de un correlativo— y en orden de cobro, que es como se habrían
 * dado en el puesto. Solo toca lo que está en cero, así que volver a
 * ejecutar la migración no renumera nada.
 */
with numerados as (
  select id,
         row_number() over (
           partition by vendedor, cierre
           order by creado, id
         ) as correlativo
  from public.caja_pedidos
  where numero = 0
)
update public.caja_pedidos c
set numero = n.correlativo
from numerados n
where c.id = n.id;

-- ---------------------------------------------------------------------
-- 2. La cocina, filtrada por cajero
--
-- Se borra la versión de un solo argumento antes de crear la nueva: añadir
-- un parámetro no reemplaza la función, crea una sobrecarga, y quedarían
-- las dos vivas.
-- ---------------------------------------------------------------------

drop function if exists public.cocina_pendientes(text);

create or replace function public.cocina_pendientes(
  p_clave    text,
  p_vendedor text default null
)
returns table (
  id       uuid,
  numero   integer,
  creado   timestamptz,
  cliente  text,
  vendedor text,
  lineas   jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(p_clave, '') = ''
     or not exists (select 1 from public.caja_cocina k where k.id = 1 and k.clave = p_clave)
  then
    raise exception 'CLAVE_INVALIDA';
  end if;

  return query
    select c.id, c.numero, c.creado, c.cliente, c.vendedor, c.lineas
    from public.caja_pedidos c
    where not c.entregado
      and c.cierre = ''
      -- sin vendedor en el enlace se devuelve todo, como antes
      and (coalesce(p_vendedor, '') = '' or c.vendedor = p_vendedor)
    order by c.creado asc
    limit 300;
end;
$$;

grant execute on function public.cocina_pendientes(text, text) to anon, authenticated;
