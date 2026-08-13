-- =====================================================================
-- 010 — Productos configurables (bases, toppings, proteínas, salsas)
-- =====================================================================
-- Un poke bowl no se pide tal cual: se arma eligiendo entre grupos de
-- opciones, cada uno con su regla de cuántas se pueden marcar.
--
-- Formato de `products.opciones`:
--   [
--     {"titulo":"Elige tu Base","min":1,"max":1,
--      "opciones":["Arroz de Sushi","Mix de Lechugas"]},
--     {"titulo":"Elige tus Toppings","min":1,"max":8,
--      "opciones":["Palta","Choclo","Mango"]}
--   ]
--
--   min = 0  -> el grupo es opcional
--   min > 0  -> obligatorio; hay que marcar al menos esas
--
-- Y lo elegido se guarda en `order_items.opciones`:
--   {"Elige tu Base":["Arroz de Sushi"],"Elige tus Toppings":["Palta"]}
--
-- Sin grupos, el producto se pide como siempre. Los que ya existen no
-- cambian de comportamiento.
--
-- Idempotente.
-- =====================================================================

alter table public.products
  add column if not exists opciones jsonb not null default '[]'::jsonb;

alter table public.order_items
  add column if not exists opciones jsonb not null default '{}'::jsonb;

comment on column public.products.opciones is
  'Grupos de personalización: [{"titulo":"…","min":1,"max":8,"opciones":[…]}]. Vacío = producto simple.';
comment on column public.order_items.opciones is
  'Lo que eligió el cliente en cada grupo. Es lo que hay que preparar.';

-- ---------------------------------------------------------------------
-- crear_pedido: acepta y VALIDA las opciones elegidas.
--
-- La validación va aquí y no solo en el navegador por la misma razón que los
-- precios: lo que manda el cliente se puede manipular. Un bowl sin proteína o
-- con quince toppings no debe poder entrar a la cocina.
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
  v_perfil   public.profiles%rowtype;
  v_order    uuid;
  v_numero   bigint;
  v_total    numeric(10, 2) := 0;
  v_item     jsonb;
  v_prod     public.products%rowtype;
  v_cant     integer;
  v_piezas   integer;
  v_precio   numeric(8, 2);
  v_nombre   text;
  v_opciones jsonb;
  v_grupo    jsonb;
  v_elegidas jsonb;
  v_n        integer;
  v_min      integer;
  v_max      integer;
  v_titulo   text;
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
    v_opciones := coalesce(v_item -> 'opciones', '{}'::jsonb);

    select * into v_prod
    from public.products
    where products.slug = (v_item ->> 'slug')
      and products.activo;

    if not found then
      raise exception 'PRODUCTO_NO_DISPONIBLE'
        using hint = 'Uno de los productos ya no está a la venta';
    end if;

    -- ---- precio: de la presentación pedida, o el suelto ----
    v_precio := null;
    v_nombre := v_prod.nombre;

    if v_piezas is not null then
      select (p ->> 'precio')::numeric into v_precio
      from jsonb_array_elements(coalesce(v_prod.presentaciones, '[]'::jsonb)) p
      where (p ->> 'piezas')::integer = v_piezas
      limit 1;

      if v_precio is null then
        raise exception 'PRESENTACION_NO_DISPONIBLE'
          using hint = 'Esa cantidad ya no está a la venta para ' || v_prod.nombre;
      end if;
      v_nombre := v_prod.nombre || ' (' || v_piezas || ' piezas)';
    else
      v_precio := v_prod.precio;
    end if;

    -- ---- opciones: se comprueba grupo por grupo ----
    for v_grupo in
      select * from jsonb_array_elements(coalesce(v_prod.opciones, '[]'::jsonb))
    loop
      v_titulo := v_grupo ->> 'titulo';
      v_min := coalesce((v_grupo ->> 'min')::integer, 0);
      v_max := coalesce((v_grupo ->> 'max')::integer, 99);
      v_elegidas := coalesce(v_opciones -> v_titulo, '[]'::jsonb);
      v_n := jsonb_array_length(v_elegidas);

      if v_n < v_min then
        raise exception 'FALTAN_OPCIONES'
          using hint = v_prod.nombre || ': elige al menos ' || v_min || ' en "' || v_titulo || '"';
      end if;

      if v_n > v_max then
        raise exception 'DEMASIADAS_OPCIONES'
          using hint = v_prod.nombre || ': como máximo ' || v_max || ' en "' || v_titulo || '"';
      end if;

      -- ninguna elección puede estar fuera de la lista del grupo
      if exists (
        select 1
        from jsonb_array_elements_text(v_elegidas) e
        where e not in (
          select jsonb_array_elements_text(coalesce(v_grupo -> 'opciones', '[]'::jsonb))
        )
      ) then
        raise exception 'OPCION_NO_DISPONIBLE'
          using hint = v_prod.nombre || ': hay una opción que ya no existe en "' || v_titulo || '"';
      end if;
    end loop;

    insert into public.order_items (order_id, product_id, nombre, precio, cantidad, opciones)
    values (v_order, v_prod.id, v_nombre, v_precio, v_cant, v_opciones);

    v_total := v_total + v_precio * v_cant;
  end loop;

  update public.orders set total = v_total where orders.id = v_order;

  id := v_order;
  numero := v_numero;
  total := v_total;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- Las opciones elegidas tienen que llegar al panel y al historial: si no,
-- la cocina no sabe qué preparar.
-- ---------------------------------------------------------------------
create or replace function public.admin_pedidos(
  p_estado text default null,
  p_limit  integer default 200
)
returns table (
  id uuid, numero bigint, estado text, total numeric, nombre text, telefono text,
  direccion text, nota text, correo text, puntos integer,
  creado timestamptz, pagado timestamptz, items jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.numero, o.estado, o.total, o.nombre, o.telefono, o.direccion, o.nota,
         u.email, o.puntos_dados, o.created_at, o.paid_at,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'nombre', oi.nombre, 'precio', oi.precio,
                     'cantidad', oi.cantidad, 'opciones', oi.opciones))
            from public.order_items oi where oi.order_id = o.id),
           '[]'::jsonb
         )
  from public.orders o
  left join auth.users u on u.id = o.user_id
  where public.is_admin()
    and (p_estado is null or o.estado = p_estado)
  order by o.created_at desc
  limit least(coalesce(p_limit, 200), 500);
$$;

create or replace function public.mis_pedidos(p_limit integer default 30)
returns table (
  id uuid, numero bigint, estado text, total numeric,
  puntos integer, creado timestamptz, items jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.numero, o.estado, o.total, o.puntos_dados, o.created_at,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'nombre', oi.nombre, 'precio', oi.precio,
                     'cantidad', oi.cantidad, 'opciones', oi.opciones))
            from public.order_items oi where oi.order_id = o.id),
           '[]'::jsonb
         )
  from public.orders o
  where o.user_id = auth.uid()
  order by o.created_at desc
  limit least(coalesce(p_limit, 30), 100);
$$;

grant execute on function public.crear_pedido(jsonb, text, text)  to authenticated;
grant execute on function public.admin_pedidos(text, integer)     to authenticated;
grant execute on function public.mis_pedidos(integer)             to authenticated;
