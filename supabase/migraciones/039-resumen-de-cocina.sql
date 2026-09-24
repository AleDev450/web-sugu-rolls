-- =====================================================================
-- 039 — Cuánto lleva preparado la cocina
-- =====================================================================
-- La pantalla de cocina solo recibe la cola pendiente, así que puede decir
-- cuánto FALTA pero no cuánto lleva. Y lo que se quiere saber al final del
-- día es lo segundo: cuántos rolls salieron.
--
-- Esta función devuelve el acumulado de la caja abierta de ese cajero,
-- entregado o no. Es una fila con tres números y nada más: ni precios, ni
-- clientes, ni cobros. El enlace de cocina sigue sin servir para espiar la
-- caja.
--
-- Cuenta ROLLS, no pedidos. Un maki Personal es un roll y un Dúo son dos:
-- contar tickets no dice cuánto hay que cortar, y esa es justo la medida
-- que le interesa a quien prepara.
--
-- Idempotente.
-- =====================================================================

create or replace function public.cocina_resumen(
  p_clave    text,
  p_vendedor text default null
)
returns table (
  rolls     integer,
  onigiris  integer,
  pokebowls integer,
  pedidos   integer
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

  if coalesce(trim(p_vendedor), '') = '' then
    raise exception 'VENDEDOR_REQUERIDO';
  end if;

  return query
  with abiertos as (
    select c.id, c.lineas
    from public.caja_pedidos c
    where c.cierre = ''
      and lower(trim(c.vendedor)) = lower(trim(p_vendedor))
  ),
  /*
   * Las líneas viven en jsonb, así que hay que abrirlas para sumar. El
   * `left join lateral` conserva los pedidos sin líneas —no debería
   * haberlos, pero perderlos falsearía el conteo de pedidos—.
   */
  renglones as (
    select a.id, l
    from abiertos a
    left join lateral jsonb_array_elements(a.lineas) l on true
  )
  select
    coalesce(
      sum(
        case
          when l ->> 'producto' = 'maki'
          then coalesce((l ->> 'cantidad')::int, 0)
               * case when l ->> 'promo' = 'duo' then 2 else 1 end
          else 0
        end
      ),
      0
    )::int,
    coalesce(
      sum(case when l ->> 'producto' = 'onigiri' then coalesce((l ->> 'cantidad')::int, 0) else 0 end),
      0
    )::int,
    coalesce(
      sum(case when l ->> 'producto' = 'pokebowl' then coalesce((l ->> 'cantidad')::int, 0) else 0 end),
      0
    )::int,
    count(distinct renglones.id)::int
  from renglones;
end;
$$;

grant execute on function public.cocina_resumen(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Para comprobarlo con una caja abierta:
--   select * from public.cocina_resumen(
--     (select clave from public.caja_cocina where id = 1), 'Alejandro');
