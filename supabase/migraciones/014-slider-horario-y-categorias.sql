-- =====================================================================
-- 014 — Slider de portada, horario de tienda y gestión de usuarios
-- =====================================================================
-- Cuatro cosas:
--   1. Tabla `slides` para el carrusel de portada (imagen de escritorio y
--      otra de móvil por cada diapositiva).
--   2. Estado de la tienda: horario de atención + interruptor manual que
--      manda por encima de él.
--   3. `admin_usuarios` deja de listar administradores.
--   4. Borrar un usuario desde el panel.
--
-- Idempotente.
-- =====================================================================

-- =====================================================================
-- 1. SLIDER DE PORTADA
-- =====================================================================
--
-- Dos imágenes por diapositiva a propósito. Una foto de 1920x1080 recortada
-- a pantalla de móvil pierde el centro y suele dejar fuera lo importante;
-- con una versión vertical se controla qué se ve en cada formato.
-- =====================================================================

create table if not exists public.slides (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null default '',
  subtitulo      text not null default '',
  /** 1920x1080 */
  imagen         text not null default '',
  /** vertical, para teléfonos. Si está vacía se usa `imagen` */
  imagen_movil   text not null default '',
  boton_texto    text not null default '',
  boton_enlace   text not null default '',
  orden          smallint not null default 0,
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

comment on table public.slides is
  'Diapositivas del carrusel de portada. `imagen_movil` vacía = se reutiliza la de escritorio.';

create index if not exists slides_visibles_idx on public.slides (orden) where activo;

alter table public.slides enable row level security;

drop policy if exists "slides: lectura publica" on public.slides;
create policy "slides: lectura publica" on public.slides
  for select using (activo or public.is_admin());

drop policy if exists "slides: escribe admin" on public.slides;
create policy "slides: escribe admin" on public.slides
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.slides to anon, authenticated;
grant insert, update, delete on public.slides to authenticated;

-- =====================================================================
-- 2. ESTADO DE LA TIENDA
-- =====================================================================
--
-- `tienda_modo`:
--   auto     -> abierta solo dentro del horario
--   abierta  -> abierta siempre, aunque sea fuera de hora
--   cerrada  -> cerrada siempre, aunque esté en hora
--
-- El modo manual manda sobre el horario, que es lo que se pidió: si el local
-- decide abrir un rato más, se pulsa "abrir" y funciona.
--
-- Las horas se guardan como `time` y se comparan en la zona de Lima. Guardar
-- la zona explícitamente evita que el servidor —que corre en UTC— cierre la
-- tienda cinco horas antes.
-- =====================================================================

alter table public.site_settings
  add column if not exists tienda_modo     text not null default 'auto',
  add column if not exists hora_apertura   time not null default '12:00',
  add column if not exists hora_cierre     time not null default '22:00',
  -- 0 = domingo … 6 = sábado
  add column if not exists dias_atencion   smallint[] not null default '{0,1,2,3,4,5,6}',
  add column if not exists aviso_cerrado   text not null default
    'Estamos cerrados en este momento. Puedes ver la carta y volver en nuestro horario de atención.';

alter table public.site_settings
  drop constraint if exists tienda_modo_valido;
alter table public.site_settings
  add constraint tienda_modo_valido check (tienda_modo in ('auto', 'abierta', 'cerrada'));

comment on column public.site_settings.tienda_modo is
  'auto = por horario · abierta/cerrada = forzado a mano, manda sobre el horario.';

/**
 * ¿La tienda acepta pedidos ahora mismo?
 *
 * Se calcula en la BASE y no en el navegador porque el reloj del cliente se
 * puede cambiar: alguien con la hora adelantada podría pedir de madrugada.
 */
create or replace function public.tienda_abierta()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case s.tienda_modo
    when 'abierta' then true
    when 'cerrada' then false
    else
      -- 'auto': hay que estar en un día de atención y dentro del horario
      extract(dow from (now() at time zone 'America/Lima'))::smallint = any (s.dias_atencion)
      and (now() at time zone 'America/Lima')::time
          between s.hora_apertura and s.hora_cierre
  end
  from public.site_settings s
  where s.id = 1;
$$;

grant execute on function public.tienda_abierta() to anon, authenticated;

-- Un pedido no puede entrar con la tienda cerrada.
create or replace function public.exigir_tienda_abierta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tienda_abierta() then
    raise exception 'TIENDA_CERRADA'
      using hint = 'Ahora mismo no estamos recibiendo pedidos';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_tienda_abierta on public.orders;
create trigger orders_tienda_abierta
  before insert on public.orders
  for each row execute function public.exigir_tienda_abierta();

-- =====================================================================
-- 3. USUARIOS: sin administradores en la lista
-- =====================================================================
--
-- El superadministrador no es un cliente y no debe aparecer entre ellos:
-- ni se le ajustan puntos ni se le borra por error.
-- =====================================================================

create or replace function public.admin_usuarios(
  p_limit   integer default 20,
  p_offset  integer default 0,
  p_buscar  text    default null
)
returns table (
  id uuid, nickname text, full_name text, last_name text, phone text,
  address text, correo text, creado timestamptz, saldo integer, ganados integer,
  nivel text, pedidos bigint, gastado numeric, total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with datos as (
    select
      p.id, p.nickname, p.full_name, p.last_name, p.phone, p.address,
      u.email as correo, p.created_at as creado,
      coalesce((select sum(pe.delta) from public.point_entries pe where pe.user_id = p.id), 0)::integer as saldo,
      coalesce((select sum(pe.delta) from public.point_entries pe where pe.user_id = p.id and pe.motivo <> 'canje'), 0)::integer as ganados,
      coalesce((select count(*) from public.orders o where o.user_id = p.id and o.estado in ('pagado', 'entregado')), 0) as pedidos,
      coalesce((select sum(o.total) from public.orders o where o.user_id = p.id and o.estado in ('pagado', 'entregado')), 0) as gastado
    from public.profiles p
    left join auth.users u on u.id = p.id
    where public.is_admin()
      and not p.is_admin          -- fuera los administradores
      and (
        p_buscar is null or p_buscar = ''
        or p.nickname ilike '%' || p_buscar || '%'
        or coalesce(p.full_name, '') ilike '%' || p_buscar || '%'
        or coalesce(p.last_name, '') ilike '%' || p_buscar || '%'
        or coalesce(p.phone, '') ilike '%' || p_buscar || '%'
        or coalesce(u.email, '') ilike '%' || p_buscar || '%'
      )
  )
  select d.id, d.nickname, d.full_name, d.last_name, d.phone, d.address, d.correo,
         d.creado, d.saldo, d.ganados,
         public.nivel_cliente(d.ganados), d.pedidos, d.gastado,
         count(*) over ()
  from datos d
  order by d.creado desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- =====================================================================
-- 4. BORRAR UN USUARIO
-- =====================================================================
--
-- Borra la cuenta entera: `profiles` y `point_entries` caen por cascada.
-- Los PEDIDOS no: `orders.user_id` es `on delete restrict` a propósito, para
-- que borrar a alguien no haga desaparecer ventas de la contabilidad. Si el
-- cliente tiene pedidos, se avisa en vez de borrar a medias.
-- =====================================================================

create or replace function public.admin_borrar_usuario(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedidos integer;
begin
  if not public.is_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_user = auth.uid() then
    raise exception 'NO_TE_PUEDES_BORRAR' using hint = 'No puedes borrar tu propia cuenta';
  end if;
  if exists (select 1 from public.profiles where id = p_user and is_admin) then
    raise exception 'ES_ADMIN' using hint = 'No se puede borrar a un administrador desde aquí';
  end if;

  select count(*) into v_pedidos from public.orders where user_id = p_user;
  if v_pedidos > 0 then
    raise exception 'TIENE_PEDIDOS'
      using hint = 'Tiene ' || v_pedidos || ' pedidos registrados; borrarlo perdería esas ventas';
  end if;

  delete from auth.users where id = p_user;
end;
$$;

grant execute on function public.admin_borrar_usuario(uuid) to authenticated;
revoke execute on function public.admin_borrar_usuario(uuid) from anon;
