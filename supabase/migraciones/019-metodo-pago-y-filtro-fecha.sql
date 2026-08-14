-- =====================================================================
-- 019 — Método de pago (Yape/Plin/Tarjeta) y filtro por fecha en el panel
-- =====================================================================
-- Dos cosas:
--
--   · `metodo_pago`: el cliente elige cómo va a pagar al cerrar el pedido.
--     Con Yape o Plin sigue subiendo su captura como comprobante (ya
--     existía para Yape, ahora también vale para Plin). Con tarjeta no hay
--     pasarela conectada: el admin genera el link a mano en su proveedor
--     de siempre y lo pega en `link_pago`; desde ahí se lo manda al
--     cliente por WhatsApp con un clic.
--
--   · `admin_pedidos` gana `p_desde`/`p_hasta` para que el panel filtre por
--     rango de fechas, además del estado que ya tenía.
--
-- Idempotente.
-- =====================================================================

alter table public.orders
  add column if not exists metodo_pago text,
  add column if not exists link_pago   text;

alter table public.orders
  drop constraint if exists metodo_pago_valido;
alter table public.orders
  add constraint metodo_pago_valido
    check (metodo_pago is null or metodo_pago in ('yape', 'plin', 'tarjeta'));

comment on column public.orders.metodo_pago is
  'Cómo dijo el cliente que iba a pagar: yape, plin o tarjeta.';
comment on column public.orders.link_pago is
  'Enlace de pago con tarjeta, pegado a mano por el admin (no hay pasarela conectada).';

-- ---------------------------------------------------------------------
-- crear_pedido: ahora recibe el método de pago elegido.
-- ---------------------------------------------------------------------
drop function if exists public.crear_pedido(jsonb, text, text);

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
  v_metodo   text;
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
-- PANEL: pega el enlace de pago con tarjeta, generado a mano.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_link_pago(p_order uuid, p_link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;

  update public.orders
  set link_pago = nullif(trim(coalesce(p_link, '')), ''), updated_at = now()
  where id = p_order;

  if not found then
    raise exception 'PEDIDO_NO_EXISTE';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_pedidos: suma metodo_pago/link_pago y el rango de fechas.
-- mis_pedidos: suma metodo_pago/link_pago (para que el cliente vea su
-- enlace de pago con tarjeta sin depender de encontrar el WhatsApp).
--
-- Se borran antes de recrearlas: cambian las columnas que devuelven.
-- ---------------------------------------------------------------------
drop function if exists public.admin_pedidos(text, integer);
drop function if exists public.mis_pedidos(integer);

create or replace function public.admin_pedidos(
  p_estado text default null,
  p_limit  integer default 200,
  p_desde  timestamptz default null,
  p_hasta  timestamptz default null
)
returns table (
  id uuid, numero bigint, estado text, total numeric, delivery numeric,
  comprobante text, metodo_pago text, link_pago text,
  nombre text, telefono text, direccion text, nota text,
  correo text, puntos integer, creado timestamptz, pagado timestamptz, items jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.numero, o.estado, o.total, o.delivery, o.comprobante,
         o.metodo_pago, o.link_pago,
         o.nombre, o.telefono, o.direccion, o.nota,
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
    and (p_desde is null or o.created_at >= p_desde)
    and (p_hasta is null or o.created_at < p_hasta)
  order by o.created_at desc
  limit least(coalesce(p_limit, 200), 500);
$$;

create or replace function public.mis_pedidos(p_limit integer default 30)
returns table (
  id uuid, numero bigint, estado text, total numeric, delivery numeric,
  comprobante text, metodo_pago text, link_pago text,
  puntos integer, creado timestamptz, items jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.numero, o.estado, o.total, o.delivery, o.comprobante,
         o.metodo_pago, o.link_pago,
         o.puntos_dados, o.created_at,
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

-- se vuelven a conceder: al borrar una función se pierden sus permisos
grant execute on function public.crear_pedido(jsonb, text, text, text)            to authenticated;
grant execute on function public.admin_pedidos(text, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.mis_pedidos(integer)                             to authenticated;
grant execute on function public.admin_set_link_pago(uuid, text)                  to authenticated;
revoke execute on function public.admin_pedidos(text, integer, timestamptz, timestamptz) from anon;
revoke execute on function public.admin_set_link_pago(uuid, text)                  from anon;
