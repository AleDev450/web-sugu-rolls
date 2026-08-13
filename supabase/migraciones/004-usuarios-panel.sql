-- =====================================================================
-- 004 — Listado de usuarios registrados para el panel
-- =====================================================================
-- Devuelve los clientes con su nivel de tarjeta, sus puntos y su actividad,
-- paginado desde la base (no se traen todos para cortarlos en el navegador).
--
-- Va como función SECURITY DEFINER y no como consulta directa porque necesita
-- leer `auth.users` para el correo, y esa tabla no está —ni debe estar— al
-- alcance del cliente.
--
-- `total` viaja en cada fila con una función de ventana: así el panel sabe
-- cuántas páginas hay sin hacer una segunda consulta de conteo.
--
-- Idempotente.
-- =====================================================================

create or replace function public.admin_usuarios(
  p_limit   integer default 20,
  p_offset  integer default 0,
  p_buscar  text    default null
)
returns table (
  id          uuid,
  nickname    text,
  full_name   text,
  last_name   text,
  phone       text,
  address     text,
  correo      text,
  creado      timestamptz,
  saldo       integer,
  ganados     integer,
  nivel       text,
  pedidos     bigint,
  gastado     numeric,
  total       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with datos as (
    select
      p.id,
      p.nickname,
      p.full_name,
      p.last_name,
      p.phone,
      p.address,
      u.email as correo,
      p.created_at as creado,
      -- saldo = todos los movimientos; ganados = solo los positivos
      coalesce((select sum(pe.delta) from public.point_entries pe where pe.user_id = p.id), 0)::integer as saldo,
      coalesce((select sum(pe.delta) from public.point_entries pe where pe.user_id = p.id and pe.delta > 0), 0)::integer as ganados,
      coalesce((select count(*) from public.orders o where o.user_id = p.id and o.estado in ('pagado', 'entregado')), 0) as pedidos,
      coalesce((select sum(o.total) from public.orders o where o.user_id = p.id and o.estado in ('pagado', 'entregado')), 0) as gastado
    from public.profiles p
    left join auth.users u on u.id = p.id
    where public.is_admin()
      and (
        p_buscar is null
        or p_buscar = ''
        or p.nickname ilike '%' || p_buscar || '%'
        or coalesce(p.full_name, '') ilike '%' || p_buscar || '%'
        or coalesce(p.last_name, '') ilike '%' || p_buscar || '%'
        or coalesce(p.phone, '') ilike '%' || p_buscar || '%'
        or coalesce(u.email, '') ilike '%' || p_buscar || '%'
      )
  )
  select
    d.id, d.nickname, d.full_name, d.last_name, d.phone, d.address, d.correo, d.creado,
    d.saldo, d.ganados,
    public.nivel_cliente(d.ganados) as nivel,
    d.pedidos, d.gastado,
    count(*) over () as total
  from datos d
  order by d.creado desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.admin_usuarios(integer, integer, text) to authenticated;
revoke execute on function public.admin_usuarios(integer, integer, text) from anon;
