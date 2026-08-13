-- =====================================================================
-- 005 — Ajuste manual de puntos desde el panel
-- =====================================================================
-- Permite al administrador sumar o restar puntos a un cliente (una cortesía,
-- una corrección, un premio de sorteo) dejando siempre constancia del motivo.
--
-- No se toca ningún saldo directamente: se añade una línea más al libro mayor
-- `point_entries`, igual que hacen las compras y los canjes. El saldo sigue
-- siendo la suma de los movimientos, así que nunca se descuadra y el ajuste
-- queda registrado con su fecha y su explicación.
--
-- ADEMÁS corrige cómo se calculan los puntos GANADOS (los que dan nivel).
-- Antes eran "la suma de los movimientos positivos", que tenía dos fallos:
--   · un pedido cancelado seguía contando para el nivel
--   · restar puntos por error no se podía deshacer: el nivel quedaba inflado
-- Ahora son "todo lo que no sea un canje", que es lo que de verdad significa
-- haber ganado: las compras suman, las anulaciones y los ajustes restan, y
-- gastar puntos en un canje no baja de categoría.
--
-- Idempotente.
-- =====================================================================

create or replace function public.puntos_ganados(p_user uuid default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(pe.delta), 0)::integer
  from public.point_entries pe
  where pe.user_id = coalesce(p_user, auth.uid())
    and pe.motivo <> 'canje'
    and (coalesce(p_user, auth.uid()) = auth.uid() or public.is_admin());
$$;

-- ---------------------------------------------------------------------
-- Sumar o restar puntos a mano.
--
--   select public.admin_ajustar_puntos('<uuid>',  500, 'Premio del sorteo');
--   select public.admin_ajustar_puntos('<uuid>', -200, 'Corrección de un error');
--
-- Devuelve el saldo que queda.
-- ---------------------------------------------------------------------
create or replace function public.admin_ajustar_puntos(
  p_user   uuid,
  p_delta  integer,
  p_motivo text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo integer;
  v_nota  text;
begin
  if not public.is_admin() then
    raise exception 'NO_AUTORIZADO' using hint = 'Solo un administrador puede ajustar puntos';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'AJUSTE_VACIO' using hint = 'Indica cuántos puntos sumar o restar';
  end if;

  -- tope de cordura: evita un cero de más al teclear
  if abs(p_delta) > 100000 then
    raise exception 'AJUSTE_EXCESIVO' using hint = 'El ajuste no puede pasar de 100.000 puntos';
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'USUARIO_NO_EXISTE';
  end if;

  -- se bloquean sus líneas para que dos ajustes a la vez no se pisen
  perform 1 from public.point_entries where user_id = p_user for update;

  select coalesce(sum(delta), 0)::integer into v_saldo
  from public.point_entries where user_id = p_user;

  -- nadie puede quedar con saldo negativo
  if v_saldo + p_delta < 0 then
    raise exception 'SALDO_INSUFICIENTE'
      using hint = 'El cliente tiene ' || v_saldo || ' puntos; no se pueden restar tantos';
  end if;

  v_nota := nullif(trim(coalesce(p_motivo, '')), '');

  insert into public.point_entries (user_id, delta, motivo)
  values (p_user, p_delta, 'ajuste' || coalesce(': ' || v_nota, ''));

  return v_saldo + p_delta;
end;
$$;

grant execute on function public.admin_ajustar_puntos(uuid, integer, text) to authenticated;
revoke execute on function public.admin_ajustar_puntos(uuid, integer, text) from anon;
grant execute on function public.puntos_ganados(uuid) to authenticated;
