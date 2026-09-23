-- =====================================================================
-- 037 — La cocina es siempre de un solo cajero
-- =====================================================================
-- En la 036 el nombre del cajero se dejó opcional para no romper los
-- enlaces ya repartidos: sin nombre, la función devolvía la cola entera.
-- Esa compatibilidad resultó ser el problema. Quien abría un enlace
-- antiguo seguía viendo los pedidos de todos mezclados y no había forma de
-- notarlo desde la pantalla: se veía una cocina normal, solo que con
-- pedidos de más.
--
-- Una cocina con dos colas mezcladas no sirve —quien cocina no sabe a
-- quién entregar—, así que aquí deja de ser una opción: sin cajero en el
-- enlace, la función falla y la pantalla pide un enlace nuevo. Es mejor un
-- error claro que una lista silenciosamente equivocada.
--
-- El nombre se compara sin distinguir mayúsculas ni espacios de sobra: lo
-- escribe a mano quien abre la caja, y "alejandro" un día y "Alejandro"
-- otro no pueden acabar siendo dos cocinas distintas.
--
-- Idempotente.
-- =====================================================================

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

  -- sin cajero no hay cocina: antes devolvía la de todos, y eso confundía
  if coalesce(trim(p_vendedor), '') = '' then
    raise exception 'VENDEDOR_REQUERIDO';
  end if;

  return query
    select c.id, c.numero, c.creado, c.cliente, c.vendedor, c.lineas
    from public.caja_pedidos c
    where not c.entregado
      and c.cierre = ''
      and lower(trim(c.vendedor)) = lower(trim(p_vendedor))
    order by c.creado asc
    limit 300;
end;
$$;

grant execute on function public.cocina_pendientes(text, text) to anon, authenticated;
