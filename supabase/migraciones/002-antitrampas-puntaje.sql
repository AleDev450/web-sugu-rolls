-- =====================================================================
-- 002 — Techo de puntaje según el tiempo jugado
-- =====================================================================
-- El puntaje lo calcula el navegador, así que cualquiera podía llamar a
-- finish_session con la cifra que quisiera. Esto pone un límite: el puntaje
-- no puede superar lo que daría jugar a un ritmo altísimo durante el tiempo
-- que la partida lleva realmente abierta.
--
--    30 s  ->    15.000        30 min ->   723.000
--     5 min ->   123.000         2 h  -> 2.883.000
--
-- El récord real de tu juego fue 216.947, a ~140 puntos/segundo; el techo va
-- a 400 p/s, así que a nadie legítimo le va a saltar. Los intentos
-- rechazados quedan en `code_attempts` con el motivo PUNTAJE_IMPOSIBLE.
--
-- Idempotente.
-- =====================================================================

create or replace function public.tope_puntaje(p_segundos numeric)
returns integer
language sql
immutable
as $$
  select least(10000000, 3000 + greatest(0, coalesce(p_segundos, 0)) * 400)::integer;
$$;

create or replace function public.finish_session(
  p_session_id uuid,
  p_score      integer,
  p_nickname   text default null,
  p_full_name  text default null,
  p_phone      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.game_sessions%rowtype;
  v_nick     text;
  v_name     text;
  v_phone    text;
  v_segundos numeric;
  v_tope     integer;
begin
  if p_score is null or p_score < 0 or p_score > 10000000 then
    raise exception 'PUNTAJE_INVALIDO';
  end if;

  select * into v_session
  from public.game_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'SESION_INVALIDA';
  end if;

  if v_session.score is not null then
    raise exception 'SESION_YA_CERRADA';
  end if;

  -- techo creíble para el tiempo que la partida lleva abierta
  v_segundos := extract(epoch from (now() - v_session.started_at));
  v_tope := public.tope_puntaje(v_segundos);

  if p_score > v_tope then
    insert into public.code_attempts (attempted, reason, user_id)
    values (p_session_id::text || ' -> ' || p_score::text, 'PUNTAJE_IMPOSIBLE', auth.uid());

    raise exception 'PUNTAJE_IMPOSIBLE'
      using hint = 'El puntaje no encaja con el tiempo jugado';
  end if;

  -- la sesión de un usuario logueado solo la cierra ese usuario
  if v_session.player_id is not null and v_session.player_id is distinct from auth.uid() then
    raise exception 'NO_AUTORIZADO';
  end if;

  v_nick  := coalesce(nullif(trim(p_nickname), ''), v_session.nickname);
  v_name  := coalesce(nullif(trim(p_full_name), ''), v_session.full_name);
  v_phone := coalesce(nullif(trim(p_phone), ''), v_session.phone);

  if v_nick is null or v_name is null or v_phone is null then
    raise exception 'DATOS_INCOMPLETOS'
      using hint = 'Nickname, nombre y teléfono son obligatorios';
  end if;

  update public.game_sessions
  set score       = p_score,
      nickname    = v_nick,
      full_name   = v_name,
      phone       = v_phone,
      finished_at = now()
  where id = p_session_id;
end;
$$;

grant execute on function public.tope_puntaje(numeric) to anon, authenticated;
grant execute on function public.finish_session(uuid, integer, text, text, text) to anon, authenticated;
