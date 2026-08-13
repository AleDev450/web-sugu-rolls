-- =====================================================================
-- 013 — Costo de delivery y comprobante de Yape
-- =====================================================================
-- Dos cosas que faltaban para cerrar un pedido de verdad:
--
--   · `delivery`: el reparto se cobra aparte y depende del distrito, así que
--     no se puede saber al hacer el pedido. El admin lo pone al evaluarlo.
--   · `comprobante`: la captura del Yape que el cliente adjunta para que el
--     pedido se prepare.
--
-- El delivery va en su PROPIA columna y no sumado a `total` a propósito:
--   · los puntos se calculan sobre `total`, y premiar el reparto sería
--     regalar puntos por vivir lejos;
--   · el ranking de gasto por cliente mide comida, no transporte.
-- Lo que se cobra es total + delivery, y así se muestra en todos lados.
--
-- Idempotente.
-- =====================================================================

alter table public.orders
  add column if not exists delivery    numeric(10, 2) not null default 0,
  add column if not exists comprobante text;

alter table public.orders
  drop constraint if exists delivery_razonable;
alter table public.orders
  add constraint delivery_razonable check (delivery >= 0 and delivery <= 1000);

comment on column public.orders.delivery is
  'Costo de reparto, evaluado por distrito. Aparte de `total`: no genera puntos.';
comment on column public.orders.comprobante is
  'Ruta en el bucket `comprobantes` de la captura del Yape.';

-- ---------------------------------------------------------------------
-- PANEL: fijar el costo de delivery de un pedido.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_delivery(p_order uuid, p_monto numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_monto is null or p_monto < 0 or p_monto > 1000 then
    raise exception 'DELIVERY_INVALIDO' using hint = 'Entre 0 y 1000 soles';
  end if;

  update public.orders
  set delivery = p_monto, updated_at = now()
  where id = p_order;

  if not found then
    raise exception 'PEDIDO_NO_EXISTE';
  end if;

  return p_monto;
end;
$$;

-- ---------------------------------------------------------------------
-- CLIENTE: adjuntar el comprobante a SU pedido.
--
-- Solo se puede sobre un pedido propio y que siga pendiente: una vez
-- confirmado el pago, cambiar el comprobante no tendría sentido.
-- ---------------------------------------------------------------------
create or replace function public.adjuntar_comprobante(p_order uuid, p_ruta text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order;
  if not found then
    raise exception 'PEDIDO_NO_EXISTE';
  end if;
  if v_order.user_id is distinct from auth.uid() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_order.estado <> 'pendiente' then
    raise exception 'PEDIDO_YA_PROCESADO';
  end if;

  update public.orders
  set comprobante = nullif(trim(coalesce(p_ruta, '')), ''), updated_at = now()
  where id = p_order;
end;
$$;

-- ---------------------------------------------------------------------
-- Las dos consultas de pedidos devuelven ya los campos nuevos.
-- ---------------------------------------------------------------------
/*
 * HAY QUE BORRARLAS ANTES DE RECREARLAS.
 *
 * `create or replace` no puede cambiar las columnas que devuelve una función:
 * Postgres responde "cannot change return type of existing function". Y aquí
 * se les añaden dos columnas nuevas (delivery y comprobante), así que se
 * eliminan primero. Los permisos se vuelven a dar al final del archivo,
 * porque al borrar una función se pierden sus grants.
 */
drop function if exists public.admin_pedidos(text, integer);
drop function if exists public.mis_pedidos(integer);

create or replace function public.admin_pedidos(
  p_estado text default null,
  p_limit  integer default 200
)
returns table (
  id uuid, numero bigint, estado text, total numeric, delivery numeric,
  comprobante text, nombre text, telefono text, direccion text, nota text,
  correo text, puntos integer, creado timestamptz, pagado timestamptz, items jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.numero, o.estado, o.total, o.delivery, o.comprobante,
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
  order by o.created_at desc
  limit least(coalesce(p_limit, 200), 500);
$$;

create or replace function public.mis_pedidos(p_limit integer default 30)
returns table (
  id uuid, numero bigint, estado text, total numeric, delivery numeric,
  comprobante text, puntos integer, creado timestamptz, items jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.numero, o.estado, o.total, o.delivery, o.comprobante,
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

-- ---------------------------------------------------------------------
-- Almacén de comprobantes: PRIVADO.
--
-- Son capturas de pagos con datos personales; no pueden servirse por una URL
-- pública como las fotos de la carta. El panel los abre con enlaces firmados
-- de un solo uso.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880,
        array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "comprobantes: subir el propio" on storage.objects;
create policy "comprobantes: subir el propio"
  on storage.objects for insert
  with check (bucket_id = 'comprobantes' and auth.uid() is not null);

drop policy if exists "comprobantes: solo admin los ve" on storage.objects;
create policy "comprobantes: solo admin los ve"
  on storage.objects for select
  using (bucket_id = 'comprobantes' and public.is_admin());

-- se vuelven a conceder: al borrar una función se pierden sus permisos
grant execute on function public.admin_pedidos(text, integer)       to authenticated;
grant execute on function public.mis_pedidos(integer)               to authenticated;
grant execute on function public.admin_set_delivery(uuid, numeric)  to authenticated;
grant execute on function public.adjuntar_comprobante(uuid, text)   to authenticated;
revoke execute on function public.admin_set_delivery(uuid, numeric) from anon;
revoke execute on function public.admin_pedidos(text, integer)      from anon;
