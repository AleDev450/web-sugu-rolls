-- Unidades registradas en la caja abierta del cajero para el resumen de cocina.
-- No devuelve precios, pagos ni datos de clientes.

create or replace function public.cocina_ventas_productos(
  p_clave    text,
  p_vendedor text default null
)
returns table (
  handrolls integer,
  galletas   integer
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
  select
    coalesce(sum(case when l ->> 'producto' = 'handroll'
      then coalesce((l ->> 'cantidad')::int, 0) else 0 end), 0)::int,
    coalesce(sum(case when l ->> 'producto' = 'galleta_suerte'
      then coalesce((l ->> 'cantidad')::int, 0) else 0 end), 0)::int
  from public.caja_pedidos c
  cross join lateral jsonb_array_elements(c.lineas) l
  where c.cierre = ''
    and lower(trim(c.vendedor)) = lower(trim(p_vendedor));
end;
$$;

grant execute on function public.cocina_ventas_productos(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
