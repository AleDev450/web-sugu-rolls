-- =====================================================================
-- 038 — Lo que el cliente pide aparte
-- =====================================================================
-- "Sin palta", "más queso", "para llevar". Antes había que recordarlo o
-- gritárselo a la cocina, que es justo lo que se pierde cuando hay cola.
-- Ahora el cajero lo apunta en el pedido y le llega a quien cocina por la
-- misma pantalla que ya mira.
--
-- Va en el PEDIDO y no en cada línea porque en el mostrador se dice una
-- vez, al final, y casi siempre vale para todo lo que lleva. Partirlo por
-- línea obligaría a preguntar "¿el sin palta es para cuál?" en el peor
-- momento.
--
-- La función de cocina la devuelve junto al resto: sigue sin haber ahí
-- nada de dinero.
--
-- Idempotente.
-- =====================================================================

alter table public.caja_pedidos
  add column if not exists nota text not null default '';

comment on column public.caja_pedidos.nota is
  'Pedido especial del cliente: "sin palta", "para llevar"… Lo escribe el cajero y lo lee la cocina.';

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
  nota     text,
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

  -- sin cajero no hay cocina: una cola mezclada no le sirve a nadie
  if coalesce(trim(p_vendedor), '') = '' then
    raise exception 'VENDEDOR_REQUERIDO';
  end if;

  return query
    select c.id, c.numero, c.creado, c.cliente, c.vendedor, c.nota, c.lineas
    from public.caja_pedidos c
    where not c.entregado
      and c.cierre = ''
      and lower(trim(c.vendedor)) = lower(trim(p_vendedor))
    order by c.creado asc
    limit 300;
end;
$$;

grant execute on function public.cocina_pendientes(text, text) to anon, authenticated;
