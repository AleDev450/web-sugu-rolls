-- =====================================================================
-- 027 — Corregir o borrar una partida suelta del ranking
-- =====================================================================
-- Hasta ahora el panel solo podía resetear el ranking ENTERO: si una sola
-- partida traía un puntaje raro, la única salida era borrarlo todo y perder
-- también las partidas legítimas.
--
-- Dos operaciones sobre UNA fila:
--   · admin_editar_puntaje  — corrige el puntaje a mano (anomalía evidente)
--   · admin_borrar_partida  — la saca del ranking del todo
--
-- Los códigos NO se tocan en ninguna de las dos, mismo criterio que
-- `admin_reset_ranking`: el código canjeado sigue marcado como usado para que
-- nadie vuelva a jugar con uno gastado. Borrar la partida solo la quita del
-- ranking; no devuelve la ficha.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PANEL: corregir el puntaje de una partida.
--
-- Se respeta el mismo rango que la restricción `score_razonable` de la tabla
-- (0 a 10.000.000). No se toca `finished_at`: la partida se jugó cuando se
-- jugó, y el ritmo por minuto que pinta el panel tiene que seguir cuadrando.
-- ---------------------------------------------------------------------
create or replace function public.admin_editar_puntaje(
  p_session uuid,
  p_score   integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NO_AUTORIZADO' using hint = 'Solo un administrador puede editar puntajes';
  end if;

  if p_score is null or p_score < 0 or p_score > 10000000 then
    raise exception 'PUNTAJE_INVALIDO' using hint = 'El puntaje debe estar entre 0 y 10000000';
  end if;

  update public.game_sessions
  set score = p_score,
      -- una partida sin terminar que recibe puntaje pasa a contar como jugada:
      -- sin `finished_at` se quedaría fuera del ranking y del cálculo de ritmo
      finished_at = coalesce(finished_at, now())
  where id = p_session;

  if not found then
    raise exception 'PARTIDA_NO_EXISTE';
  end if;

  return p_score;
end;
$$;

-- ---------------------------------------------------------------------
-- PANEL: borrar una partida.
--
-- El código canjeado se queda como está (usado). Si además se quisiera
-- liberar el código habría que borrarlo desde la pantalla de códigos.
-- ---------------------------------------------------------------------
create or replace function public.admin_borrar_partida(p_session uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NO_AUTORIZADO' using hint = 'Solo un administrador puede borrar partidas';
  end if;

  delete from public.game_sessions where id = p_session;

  if not found then
    raise exception 'PARTIDA_NO_EXISTE';
  end if;
end;
$$;

grant execute on function public.admin_editar_puntaje(uuid, integer) to authenticated;
grant execute on function public.admin_borrar_partida(uuid)          to authenticated;
revoke execute on function public.admin_editar_puntaje(uuid, integer) from anon;
revoke execute on function public.admin_borrar_partida(uuid)          from anon;
