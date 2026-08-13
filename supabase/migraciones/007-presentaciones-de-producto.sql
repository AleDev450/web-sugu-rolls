-- =====================================================================
-- 007 — Presentaciones por producto (por 5, por 10, …)
-- =====================================================================
-- Un maki puede venderse en varias cantidades con distinto precio. Las
-- presentaciones son editables desde el panel: no hay nada fijo en "5" ni
-- en "10", se pueden poner las que sean.
--
-- Formato de la columna:
--   [{"piezas": 5, "precio": 18.00}, {"piezas": 10, "precio": 32.00}]
--
-- Un array vacío significa "producto de precio único": sigue usando la
-- columna `precio` de siempre, así que los productos que ya existen no
-- cambian de comportamiento.
--
-- Idempotente.
-- =====================================================================

alter table public.products
  add column if not exists presentaciones jsonb not null default '[]'::jsonb;

comment on column public.products.presentaciones is
  'Cantidades y precios alternativos: [{"piezas":5,"precio":18}]. Vacío = precio único.';

-- ---------------------------------------------------------------------
-- crear_pedido: ahora cada línea puede indicar la presentación elegida.
--
--   [{"slug": "maki-acevichado", "piezas": 10, "cantidad": 2}, ...]
--
-- El precio SIGUE saliendo de la base: se busca la presentación pedida
-- dentro de `presentaciones` y, si no se indica ninguna o no existe, se usa
-- el precio suelto. Nunca se acepta un importe que venga del navegador.
-- ---------------------------------------------------------------------
create or replace function public.crear_pedido(
  p_items     jsonb,
  p_direccion text default null,
  p_nota      text default null
)
returns table (id uuid, numero bigint, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil  public.profiles%rowtype;
  v_order   uuid;
  v_numero  bigint;
  v_total   numeric(10, 2) := 0;
  v_item    jsonb;
  v_prod    public.products%rowtype;
  v_cant    integer;
  v_piezas  integer;
  v_precio  numeric(8, 2);
  v_nombre  text;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTENTICADO' using hint = 'Inicia sesión para pedir';
  end if;

  select * into v_perfil from public.profiles where profiles.id = auth.uid();
  if not found then
    raise exception 'SIN_PERFIL';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'CARRITO_VACIO';
  end if;

  insert into public.orders (user_id, nombre, telefono, direccion, nota)
  values (
    auth.uid(),
    trim(coalesce(v_perfil.full_name, '') || ' ' || coalesce(v_perfil.last_name, '')),
    coalesce(v_perfil.phone, ''),
    coalesce(nullif(trim(coalesce(p_direccion, '')), ''), v_perfil.address, ''),
    nullif(trim(coalesce(p_nota, '')), '')
  )
  returning orders.id, orders.numero into v_order, v_numero;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := greatest(1, least(99, coalesce((v_item ->> 'cantidad')::integer, 1)));
    v_piezas := nullif(v_item ->> 'piezas', '')::integer;

    select * into v_prod
    from public.products
    where products.slug = (v_item ->> 'slug')
      and products.activo;

    if not found then
      raise exception 'PRODUCTO_NO_DISPONIBLE'
        using hint = 'Uno de los productos ya no está a la venta';
    end if;

    v_precio := null;
    v_nombre := v_prod.nombre;

    -- ¿pidió una presentación concreta? se busca su precio en la tabla
    if v_piezas is not null then
      select (p ->> 'precio')::numeric into v_precio
      from jsonb_array_elements(coalesce(v_prod.presentaciones, '[]'::jsonb)) p
      where (p ->> 'piezas')::integer = v_piezas
      limit 1;

      if v_precio is null then
        raise exception 'PRESENTACION_NO_DISPONIBLE'
          using hint = 'Esa cantidad ya no está a la venta para ' || v_prod.nombre;
      end if;

      -- el nombre guarda la presentación: el pedido debe leerse solo
      v_nombre := v_prod.nombre || ' (' || v_piezas || ' piezas)';
    else
      v_precio := v_prod.precio;
    end if;

    insert into public.order_items (order_id, product_id, nombre, precio, cantidad)
    values (v_order, v_prod.id, v_nombre, v_precio, v_cant);

    v_total := v_total + v_precio * v_cant;
  end loop;

  update public.orders set total = v_total where orders.id = v_order;

  id := v_order;
  numero := v_numero;
  total := v_total;
  return next;
end;
$$;

grant execute on function public.crear_pedido(jsonb, text, text) to authenticated;
