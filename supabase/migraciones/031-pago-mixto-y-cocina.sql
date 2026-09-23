-- =====================================================================
-- 031 — Pago mitad y mitad, y pantalla de cocina
-- =====================================================================
-- Dos cosas que pide el puesto:
--
--   1. Hay clientes que pagan una parte con Yape y otra en efectivo. Antes
--      el método era uno solo, así que ese cobro entraba mal en el arqueo.
--      Ahora cada pedido guarda CUÁNTO entró por cada vía; para los pagos
--      de un solo medio se rellena solo, de modo que sumar la columna de
--      efectivo da la plata que de verdad hay en la caja.
--
--   2. La cocina necesita ver qué preparar, en vivo, desde otro equipo. Y
--      quien cocina no tiene cuenta del panel: se le pasa un enlace y
--      listo. Por eso el acceso va por una clave larga en la URL, validada
--      por una función `security definer`.
--
-- La clave NO puede vivir en `site_settings`: esa tabla tiene lectura
-- pública (`using (true)`), así que cualquiera podría leerla. Va en tabla
-- propia, cerrada al administrador.
--
-- La función de cocina devuelve SOLO lo que hace falta para cocinar —hora,
-- cliente y líneas—. Ni totales, ni método de pago, ni si está cobrado:
-- con el enlace no se puede espiar la caja.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Pago mixto
-- ---------------------------------------------------------------------

alter table public.caja_pedidos
  add column if not exists monto_yape     numeric(10, 2) not null default 0,
  add column if not exists monto_efectivo numeric(10, 2) not null default 0;

comment on column public.caja_pedidos.monto_yape is
  'Parte del total cobrada por Yape. En un pago de un solo medio es 0 o el total.';
comment on column public.caja_pedidos.monto_efectivo is
  'Parte del total cobrada en efectivo. Sumar esta columna da la plata en caja.';

-- el método ahora admite 'mixto'
alter table public.caja_pedidos drop constraint if exists caja_metodo_valido;
alter table public.caja_pedidos
  add constraint caja_metodo_valido check (metodo in ('efectivo', 'yape', 'mixto'));

/*
 * Relleno de lo ya cobrado. Solo toca las filas que aún están en cero para
 * que volver a ejecutar la migración no pise un reparto hecho a mano.
 */
update public.caja_pedidos
set monto_efectivo = total
where metodo = 'efectivo' and monto_yape = 0 and monto_efectivo = 0;

update public.caja_pedidos
set monto_yape = total
where metodo = 'yape' and monto_yape = 0 and monto_efectivo = 0;

-- ---------------------------------------------------------------------
-- 2. Clave de la pantalla de cocina
-- ---------------------------------------------------------------------

create table if not exists public.caja_cocina (
  id         smallint primary key default 1,
  /** va en la URL que se le pasa a quien cocina; se puede rotar cuando sea */
  clave      text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  constraint caja_cocina_fila_unica check (id = 1)
);

insert into public.caja_cocina (id) values (1) on conflict (id) do nothing;

comment on table public.caja_cocina is
  'Clave del enlace de cocina. Cerrada al admin: si se filtrara, cualquiera vería la cola de preparación.';

alter table public.caja_cocina enable row level security;

drop policy if exists "cocina: solo admin" on public.caja_cocina;
create policy "cocina: solo admin"
  on public.caja_cocina for all
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.caja_cocina from anon, authenticated;
grant select, update on public.caja_cocina to authenticated;  -- filtrado por RLS

-- ---------------------------------------------------------------------
-- 3. Lo que ve la cocina
--
-- `security definer` porque quien mira no tiene sesión: la función pasa por
-- encima de RLS, pero solo después de comprobar la clave, y nunca devuelve
-- una columna de dinero.
--
-- Se listan los pedidos de cajas ABIERTAS que todavía no se entregaron, del
-- más antiguo al más nuevo: es el orden en que hay que cocinarlos. Cuando
-- el cajero marca "Entregado", el pedido deja de salir aquí solo.
-- ---------------------------------------------------------------------
create or replace function public.cocina_pendientes(p_clave text)
returns table (
  id       uuid,
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

  return query
    select c.id, c.creado, c.cliente, c.vendedor, c.lineas
    from public.caja_pedidos c
    where not c.entregado
      and c.cierre = ''
    order by c.creado asc
    limit 300;
end;
$$;

grant execute on function public.cocina_pendientes(text) to anon, authenticated;
