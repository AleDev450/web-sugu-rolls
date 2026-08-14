-- =====================================================================
-- 020 — Extras con precio adicional en productos configurables
-- =====================================================================
-- Hasta ahora una opción de un grupo (base, topping, proteína…) era solo un
-- texto: "Palta", "Choclo". No había forma de cobrar más por un extra
-- ("Palta extra", "Queso crema") sin crearlo como producto aparte.
--
-- `products.opciones` cambia de:
--   [{"titulo":"Toppings","min":0,"max":3,"opciones":["Palta","Choclo"]}]
-- a:
--   [{"titulo":"Toppings","min":0,"max":3,
--     "opciones":[{"nombre":"Palta","precio":0},{"nombre":"Choclo extra","precio":2}]}]
--
-- `order_items.opciones` (lo que el cliente eligió) NO cambia de forma:
-- sigue siendo {"Toppings":["Palta","Choclo extra"]}, solo nombres — es lo
-- que necesita la cocina, el precio ya quedó sumado en `order_items.precio`.
--
-- Idempotente: la conversión de products.opciones no vuelve a tocar un grupo
-- que ya tenga sus opciones como objeto.
-- =====================================================================

update public.products
set opciones = (
  select coalesce(jsonb_agg(
    jsonb_set(
      grupo,
      '{opciones}',
      (
        select coalesce(jsonb_agg(
          case jsonb_typeof(opcion)
            when 'string' then jsonb_build_object('nombre', opcion #>> '{}', 'precio', 0)
            else opcion
          end
        ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(grupo -> 'opciones', '[]'::jsonb)) opcion
      )
    )
  ), '[]'::jsonb)
  from jsonb_array_elements(opciones) grupo
)
where opciones is not null
  and opciones <> '[]'::jsonb
  -- ya convertido: al menos un grupo con al menos una opción-objeto
  and exists (
    select 1
    from jsonb_array_elements(opciones) g,
         jsonb_array_elements(coalesce(g -> 'opciones', '[]'::jsonb)) o
    where jsonb_typeof(o) = 'string'
  );

comment on column public.products.opciones is
  'Grupos de personalización: [{"titulo":"…","min":1,"max":8,"opciones":[{"nombre":"…","precio":0}]}]. precio > 0 = extra con costo. Vacío = producto simple.';

-- ---------------------------------------------------------------------
-- crear_pedido: valida las opciones IGUAL que antes, pero ahora cada una
-- puede sumar un extra al precio de la línea.
--
-- Misma firma que en la migración 019 (jsonb, text, text, text): no hace
-- falta borrar la función, solo reemplazar el cuerpo.
-- ---------------------------------------------------------------------
create or replace function public.crear_pedido(
  p_items       jsonb,
  p_direccion   text default null,
  p_nota        text default null,
  p_metodo_pago text default null
)
returns table (id uuid, numero bigint, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil     public.profiles%rowtype;
  v_order      uuid;
  v_numero     bigint;
  v_total      numeric(10, 2) := 0;
  v_item       jsonb;
  v_prod       public.products%rowtype;
  v_cant       integer;
  v_piezas     integer;
  v_precio     numeric(8, 2);
  v_nombre     text;
  v_opciones   jsonb;
  v_grupo      jsonb;
  v_elegidas   jsonb;
  v_n          integer;
  v_min        integer;
  v_max        integer;
  v_titulo     text;
  v_metodo     text;
  v_opcion_txt text;
  v_extra      numeric;
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

  v_metodo := nullif(trim(coalesce(p_metodo_pago, '')), '');
  if v_metodo is not null and v_metodo not in ('yape', 'plin', 'tarjeta') then
    raise exception 'METODO_PAGO_INVALIDO';
  end if;

  insert into public.orders (user_id, nombre, telefono, direccion, nota, metodo_pago)
  values (
    auth.uid(),
    trim(coalesce(v_perfil.full_name, '') || ' ' || coalesce(v_perfil.last_name, '')),
    coalesce(v_perfil.phone, ''),
    coalesce(nullif(trim(coalesce(p_direccion, '')), ''), v_perfil.address, ''),
    nullif(trim(coalesce(p_nota, '')), ''),
    coalesce(v_metodo, 'yape')
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

    -- ---- opciones: se comprueba grupo por grupo, y se suman los extras ----
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

      -- cada elección tiene que existir en el grupo; si existe, se suma su extra
      for v_opcion_txt in select * from jsonb_array_elements_text(v_elegidas) loop
        select (x ->> 'precio')::numeric into v_extra
        from jsonb_array_elements(coalesce(v_grupo -> 'opciones', '[]'::jsonb)) x
        where x ->> 'nombre' = v_opcion_txt
        limit 1;

        if not found then
          raise exception 'OPCION_NO_DISPONIBLE'
            using hint = v_prod.nombre || ': hay una opción que ya no existe en "' || v_titulo || '"';
        end if;

        v_precio := v_precio + coalesce(v_extra, 0);
      end loop;
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
