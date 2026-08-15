-- =====================================================================
-- 023 — Sabores por categoría en las promociones
-- =====================================================================
-- Una promoción (`packages`) puede pedir que el cliente elija sabores de
-- verdad —productos reales del catálogo— en vez de solo mostrar un texto
-- fijo. Por ejemplo: "Sugu Box 20 piezas" con un grupo que dice "elige tus
-- sabores de Makis", 20 piezas asignadas y 10 piezas por sabor → el cliente
-- tiene que elegir EXACTAMENTE 2 makis de la carta vigente.
--
-- `packages.grupos` guarda esa regla, no la lista de sabores: la lista sale
-- siempre de `products` filtrando por categoría, así que un maki nuevo (o uno
-- que se dio de baja) se refleja solo, sin tocar la promoción.
--
--   [{"titulo":"Elige tus sabores de Makis","categoria":"makis",
--     "piezas_asignadas":20,"piezas_por_sabor":10}]
--
-- La cantidad a elegir NO se guarda: se calcula siempre como
-- piezas_asignadas / piezas_por_sabor, tanto en la web como aquí abajo, para
-- que nunca queden desincronizadas.
--
-- Lo elegido viaja en `order_items.opciones` con la MISMA forma que las
-- opciones de un producto configurable —{"Elige tus sabores de
-- Makis":["California Roll","Acevichado"]}—, así que el mensaje de WhatsApp,
-- el panel de pedidos y "Mis pedidos" lo muestran sin tocar una línea: ya
-- saben leer esa forma.
--
-- Idempotente.
-- =====================================================================

alter table public.packages
  add column if not exists grupos jsonb not null default '[]'::jsonb;

comment on column public.packages.grupos is
  'Grupos de sabores a elegir por categoría: [{"titulo","categoria","piezas_asignadas","piezas_por_sabor"}]. Vacío = promoción sin personalizar, como antes.';

-- ---------------------------------------------------------------------
-- crear_pedido: además de productos, ahora también acepta promociones.
--
-- Antes solo miraba `products`; una promoción en el carrito fallaba con
-- PRODUCTO_NO_DISPONIBLE porque su slug no existe en esa tabla. Ahora, si el
-- slug no es un producto, se prueba como promoción y se valida cada grupo de
-- sabores igual que se validan los grupos de un producto configurable.
--
-- Misma firma que en la migración 020 (jsonb, text, text, text): no hace
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
  v_perfil       public.profiles%rowtype;
  v_order        uuid;
  v_numero       bigint;
  v_total        numeric(10, 2) := 0;
  v_item         jsonb;
  v_prod         public.products%rowtype;
  v_paquete      public.packages%rowtype;
  v_cant         integer;
  v_piezas       integer;
  v_precio       numeric(8, 2);
  v_nombre       text;
  v_opciones     jsonb;
  v_grupo        jsonb;
  v_elegidas     jsonb;
  v_n            integer;
  v_min          integer;
  v_max          integer;
  v_titulo       text;
  v_metodo       text;
  v_opcion_txt   text;
  v_extra        numeric;
  v_categoria    text;
  v_piezas_asig  integer;
  v_piezas_sabor integer;
  v_cant_sabores integer;
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

    if found then
      -- ---- es un producto: precio de la presentación pedida, o el suelto ----
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

    else
      -- ---- no es un producto: se prueba como promoción ----
      select * into v_paquete
      from public.packages
      where packages.slug = (v_item ->> 'slug')
        and packages.activo;

      if not found then
        raise exception 'PRODUCTO_NO_DISPONIBLE'
          using hint = 'Uno de los productos ya no está a la venta';
      end if;

      v_precio := v_paquete.precio;
      v_nombre := v_paquete.nombre;

      -- ---- sabores por categoría: hay que elegir EXACTAMENTE la cantidad calculada ----
      for v_grupo in
        select * from jsonb_array_elements(coalesce(v_paquete.grupos, '[]'::jsonb))
      loop
        v_titulo := v_grupo ->> 'titulo';
        v_categoria := v_grupo ->> 'categoria';
        v_piezas_asig := coalesce((v_grupo ->> 'piezas_asignadas')::integer, 0);
        v_piezas_sabor := greatest(coalesce((v_grupo ->> 'piezas_por_sabor')::integer, 1), 1);
        v_cant_sabores := greatest(v_piezas_asig / v_piezas_sabor, 1);

        v_elegidas := coalesce(v_opciones -> v_titulo, '[]'::jsonb);
        v_n := jsonb_array_length(v_elegidas);

        if v_n <> v_cant_sabores then
          raise exception 'SABORES_INVALIDOS'
            using hint = v_paquete.nombre || ': elige exactamente ' || v_cant_sabores ||
              ' sabores en "' || v_titulo || '"';
        end if;

        for v_opcion_txt in select * from jsonb_array_elements_text(v_elegidas) loop
          if not exists (
            select 1 from public.products
            where products.nombre = v_opcion_txt
              and products.categoria = v_categoria
              and products.activo
          ) then
            raise exception 'OPCION_NO_DISPONIBLE'
              using hint = v_paquete.nombre || ': hay un sabor que ya no está disponible en "' ||
                v_titulo || '"';
          end if;
        end loop;
      end loop;

      -- sin producto único: la línea no queda ligada a ningún product_id
      insert into public.order_items (order_id, product_id, nombre, precio, cantidad, opciones)
      values (v_order, null, v_nombre, v_precio, v_cant, v_opciones);
    end if;

    v_total := v_total + v_precio * v_cant;
  end loop;

  update public.orders set total = v_total where orders.id = v_order;

  id := v_order;
  numero := v_numero;
  total := v_total;
  return next;
end;
$$;
