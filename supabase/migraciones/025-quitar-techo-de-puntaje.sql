-- =====================================================================
-- 025 — Quita el techo de puntaje según el tiempo jugado
-- =====================================================================
-- 002-antitrampas-puntaje.sql metía un límite: el puntaje no podía superar
-- lo que daría jugar a 400 p/s durante el tiempo que la sesión llevaba
-- abierta, y si alguien se pasaba, `finish_session` rechazaba el registro
-- con PUNTAJE_IMPOSIBLE ("el puntaje no encaja con el tiempo jugado").
--
-- Esa regla se está descartando: rechazaba puntajes legítimos, así que se
-- quita del todo. `finish_session` vuelve a solo validar rango, sesión y
-- datos completos, sin comparar puntaje contra minutos jugados.
--
-- Idempotente.
-- =====================================================================

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
  v_session public.game_sessions%rowtype;
  v_nick    text;
  v_name    text;
  v_phone   text;
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

grant execute on function public.finish_session(uuid, integer, text, text, text) to anon, authenticated;
