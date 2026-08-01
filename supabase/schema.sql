-- =====================================================================
-- SUGU ROLLS — Esquema de base de datos (Supabase / PostgreSQL)
-- =====================================================================
--
-- Ejecutar completo en: Supabase -> SQL Editor -> New query -> Run.
-- Es idempotente: se puede volver a ejecutar sin romper nada.
--
-- MODELO
--   profiles       Usuarios registrados desde la web (extiende auth.users).
--   access_codes   Códigos que el panel genera, uno por consumo. De un solo uso.
--   game_sessions  Una partida: nace al canjear un código, guarda el puntaje.
--   code_attempts  Bitácora de intentos fallidos (detectar fuerza bruta).
--
-- FLUJO
--   1. El admin genera códigos desde el panel   -> generate_access_codes()
--   2. El jugador (registrado o invitado) canjea -> redeem_code()
--   3. Juega y al perder registra su puntaje     -> finish_session()
--   4. La web muestra la tabla de posiciones     -> get_ranking()
--
-- SEGURIDAD
--   Nadie puede leer access_codes ni game_sessions directamente: los teléfonos
--   y los códigos sin usar quedan fuera del alcance del cliente. Todo pasa por
--   funciones SECURITY DEFINER que exponen solo lo necesario. El ranking
--   público devuelve únicamente nickname y puntaje.
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. TABLAS
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles — usuarios registrados en la web.
-- El registro lo hace Supabase Auth; el trigger de más abajo crea la fila.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nickname    text not null unique,
  full_name   text,
  phone       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint nickname_largo check (char_length(nickname) between 2 and 20)
);

comment on table public.profiles is
  'Usuarios registrados. El nickname es lo único que se muestra en público.';

-- ---------------------------------------------------------------------
-- access_codes — un código por consumo, de un solo uso.
--
-- `label` sirve para saber a qué venta corresponde (nº de boleta, mesa,
-- promoción...). `redeemed_at` no nulo = ya fue usado y no se puede repetir.
-- ---------------------------------------------------------------------
create table if not exists public.access_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  label        text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  redeemed_at  timestamptz,
  redeemed_by  uuid references public.profiles (id) on delete set null,
  constraint code_formato check (code ~ '^[A-Z0-9]{4,12}$')
);

comment on table public.access_codes is
  'Códigos de un solo uso generados por el panel. NUNCA exponer al cliente.';

create index if not exists access_codes_disponibles_idx
  on public.access_codes (created_at desc)
  where redeemed_at is null;

-- ---------------------------------------------------------------------
-- game_sessions — una partida por código canjeado.
--
-- Si el jugador está logueado, `player_id` apunta a su perfil. Si es invitado
-- queda en null y los datos de contacto se guardan en esta misma fila (es lo
-- que permite entregarle el premio).
--
-- `score` nulo = partida empezada pero no terminada (cerró la pestaña).
-- ---------------------------------------------------------------------
create table if not exists public.game_sessions (
  id           uuid primary key default gen_random_uuid(),
  code_id      uuid not null unique references public.access_codes (id) on delete cascade,
  player_id    uuid references public.profiles (id) on delete set null,
  nickname     text,
  full_name    text,
  phone        text,
  score        integer,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  constraint score_razonable check (score is null or (score >= 0 and score <= 10000000))
);

comment on table public.game_sessions is
  'Partidas jugadas. Contiene datos personales: solo accesible vía funciones.';

comment on column public.game_sessions.code_id is
  'UNIQUE: un código = una sola partida, no se puede reutilizar.';

create index if not exists game_sessions_ranking_idx
  on public.game_sessions (score desc, finished_at asc)
  where score is not null;

create index if not exists game_sessions_player_idx
  on public.game_sessions (player_id)
  where player_id is not null;

-- ---------------------------------------------------------------------
-- code_attempts — intentos de canje fallidos.
-- Permite ver si alguien está probando códigos al azar.
-- ---------------------------------------------------------------------
create table if not exists public.code_attempts (
  id          bigserial primary key,
  attempted   text,
  reason      text,
  user_id     uuid,
  created_at  timestamptz not null default now()
);

create index if not exists code_attempts_recientes_idx
  on public.code_attempts (created_at desc);

-- =====================================================================
-- 2. PERFIL AUTOMÁTICO AL REGISTRARSE
-- =====================================================================
-- Cuando alguien se registra en la web, Supabase inserta en auth.users.
-- Este trigger crea su fila en profiles tomando los datos del registro
-- (se envían en `options.data` desde supabase.auth.signUp).
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nickname text;
begin
  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
    split_part(new.email, '@', 1)
  );

  -- si el nickname ya existe, se le añade un sufijo hasta que sea único
  while exists (select 1 from public.profiles where nickname = v_nickname) loop
    v_nickname := left(v_nickname, 14) || floor(random() * 9000 + 1000)::text;
  end loop;

  insert into public.profiles (id, nickname, full_name, phone)
  values (
    new.id,
    v_nickname,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 3. FUNCIONES
-- =====================================================================

-- ---------------------------------------------------------------------
-- ¿El usuario actual es administrador?
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- Genera un código aleatorio legible.
--
-- Alfabeto de 31 caracteres SIN los ambiguos (0/O, 1/I/L): así nadie se
-- equivoca al copiarlo del ticket. Con 6 caracteres son 887 millones de
-- combinaciones — imposible de adivinar probando al azar.
--
-- ¿PREFIERES CÓDIGOS SOLO NUMÉRICOS? El juego hoy tiene un teclado numérico
-- en la ventana del código, así que si no quieres tocar el front, cambia el
-- alfabeto de esta función por '0123456789' y el 31 por 10:
--
--     substr('0123456789', floor(random() * 10)::int + 1, 1)
--
-- Ojo: 6 dígitos son solo 1 millón de combinaciones y sí se pueden barrer con
-- un bot. Si vas por esa vía, usa p_length => 8 al generar los lotes (100
-- millones) y revisa code_attempts de vez en cuando.
-- ---------------------------------------------------------------------
create or replace function public.random_code(p_len integer default 6)
returns text
language sql
volatile
as $$
  select string_agg(
    substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', floor(random() * 31)::int + 1, 1),
    ''
  )
  from generate_series(1, p_len);
$$;

-- ---------------------------------------------------------------------
-- PANEL: genera N códigos nuevos.
--
--   select * from generate_access_codes(50, 'Promo agosto', now() + interval '30 days');
--
-- Devuelve los códigos creados para imprimirlos o exportarlos.
-- ---------------------------------------------------------------------
create or replace function public.generate_access_codes(
  p_count      integer,
  p_label      text default null,
  p_expires_at timestamptz default null,
  p_length     integer default 6
)
returns table (nuevo_codigo text, etiqueta text, vence_el timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text;
  v_tries  integer;
  i        integer;
begin
  if not public.is_admin() then
    raise exception 'NO_AUTORIZADO' using hint = 'Solo un administrador puede generar códigos';
  end if;

  if p_count is null or p_count < 1 or p_count > 5000 then
    raise exception 'CANTIDAD_INVALIDA' using hint = 'Entre 1 y 5000 códigos por lote';
  end if;

  for i in 1..p_count loop
    v_tries := 0;
    loop
      v_code := public.random_code(p_length);
      exit when not exists (select 1 from public.access_codes ac where ac.code = v_code);
      v_tries := v_tries + 1;
      if v_tries > 20 then
        raise exception 'SIN_CODIGOS_LIBRES' using hint = 'Usa códigos más largos (p_length)';
      end if;
    end loop;

    insert into public.access_codes (code, label, expires_at, created_by)
    values (v_code, p_label, p_expires_at, auth.uid());

    nuevo_codigo := v_code;
    etiqueta     := p_label;
    vence_el     := p_expires_at;
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- JUEGO: canjear un código y abrir la partida.
--
-- Lo llama la ventana "INGRESA TU CÓDIGO". Marca el código como usado en el
-- acto (FOR UPDATE evita que dos personas canjeen el mismo a la vez) y
-- devuelve el id de sesión que hará falta para guardar el puntaje.
--
-- Si el código ya se canjeó pero esa partida nunca se cerró y fue hace poco
-- (ver p_reanudar_min), se devuelve la MISMA sesión: así recargar la página o
-- perder la señal no le quema el código al cliente. Como finish_session solo
-- admite un puntaje por sesión, sigue siendo un código = una puntuación.
--
-- Funciona igual para usuarios logueados y para invitados.
--
-- Devuelve `ok` + `error` en vez de lanzar excepción a propósito: una
-- excepción revierte la transacción entera y se perdería el registro del
-- intento fallido en code_attempts.
--
--   ok = true                  -> usar session_id
--   error = 'CODIGO_INVALIDO'  -> no existe
--   error = 'CODIGO_USADO'     -> ya se jugó
--   error = 'CODIGO_EXPIRADO'  -> venció
-- ---------------------------------------------------------------------
create or replace function public.redeem_code(
  p_code          text,
  p_reanudar_min  integer default 120
)
returns table (
  ok               boolean,
  error            text,
  session_id       uuid,
  player_nickname  text,
  player_name      text,
  player_phone     text,
  reanudada        boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code     public.access_codes%rowtype;
  v_clean    text;
  v_session  public.game_sessions%rowtype;
  v_new_id   uuid;
  v_profile  public.profiles%rowtype;
  v_hallada  boolean;
begin
  ok := false;
  error := null;
  session_id := null;
  player_nickname := null;
  player_name := null;
  player_phone := null;
  reanudada := false;

  v_clean := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));

  if v_clean = '' then
    insert into public.code_attempts (attempted, reason, user_id)
    values (p_code, 'VACIO', auth.uid());
    error := 'CODIGO_INVALIDO';
    return next;
    return;
  end if;

  select * into v_code
  from public.access_codes
  where code = v_clean
  for update;

  if not found then
    insert into public.code_attempts (attempted, reason, user_id)
    values (v_clean, 'NO_EXISTE', auth.uid());
    error := 'CODIGO_INVALIDO';
    return next;
    return;
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    insert into public.code_attempts (attempted, reason, user_id)
    values (v_clean, 'EXPIRADO', auth.uid());
    error := 'CODIGO_EXPIRADO';
    return next;
    return;
  end if;

  -- ¿ya se había canjeado?
  if v_code.redeemed_at is not null then
    select * into v_session
    from public.game_sessions
    where code_id = v_code.id;
    v_hallada := found;

    -- partida abierta y reciente -> se reanuda en vez de rechazar
    if v_hallada
       and v_session.score is null
       and v_code.redeemed_at > now() - make_interval(mins => greatest(coalesce(p_reanudar_min, 0), 0))
    then
      ok              := true;
      session_id      := v_session.id;
      player_nickname := v_session.nickname;
      player_name     := v_session.full_name;
      player_phone    := v_session.phone;
      reanudada       := true;
      return next;
      return;
    end if;

    insert into public.code_attempts (attempted, reason, user_id)
    values (v_clean, 'YA_USADO', auth.uid());
    error := 'CODIGO_USADO';
    return next;
    return;
  end if;

  update public.access_codes
  set redeemed_at = now(),
      redeemed_by = auth.uid()
  where id = v_code.id;

  -- si está logueado, se precargan sus datos para no volver a pedirlos
  if auth.uid() is not null then
    select * into v_profile from public.profiles where id = auth.uid();
  end if;

  insert into public.game_sessions (code_id, player_id, nickname, full_name, phone)
  values (v_code.id, auth.uid(), v_profile.nickname, v_profile.full_name, v_profile.phone)
  returning id into v_new_id;

  ok              := true;
  session_id      := v_new_id;
  player_nickname := v_profile.nickname;
  player_name     := v_profile.full_name;
  player_phone    := v_profile.phone;
  reanudada       := false;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- JUEGO: guardar el puntaje al terminar la partida.
--
-- Lo llama la ventana de GAME OVER. Solo se puede escribir UNA vez por
-- sesión: si ya tiene puntaje, se rechaza (evita reenvíos inflados).
--
-- Para invitados los tres datos son obligatorios (son los que permiten
-- entregarle el premio). Para usuarios logueados se completan solos.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- PÚBLICO: tabla de posiciones.
--
-- Devuelve SOLO nickname y puntaje — nunca nombre ni teléfono.
-- Un jugador ocupa un único puesto: se toma su mejor partida (por perfil si
-- está registrado, o por teléfono si es invitado).
-- ---------------------------------------------------------------------
create or replace function public.get_ranking(p_limit integer default 10)
returns table (posicion bigint, jugador text, puntaje integer, fecha timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with mejores as (
    select distinct on (coalesce(gs.player_id::text, gs.phone, gs.id::text))
           gs.nickname    as nick,
           gs.score       as pts,
           gs.finished_at as cuando
    from public.game_sessions gs
    where gs.score is not null
    order by coalesce(gs.player_id::text, gs.phone, gs.id::text),
             gs.score desc,
             gs.finished_at asc
  )
  select row_number() over (order by m.pts desc, m.cuando asc),
         m.nick,
         m.pts,
         m.cuando
  from mejores m
  order by m.pts desc, m.cuando asc
  limit least(coalesce(p_limit, 10), 100);
$$;

-- ---------------------------------------------------------------------
-- PANEL: resumen para el administrador.
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns table (
  codigos_totales     bigint,
  codigos_disponibles bigint,
  codigos_usados      bigint,
  partidas_jugadas    bigint,
  jugadores_unicos    bigint,
  mejor_puntaje       integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.access_codes),
    (select count(*) from public.access_codes where redeemed_at is null),
    (select count(*) from public.access_codes where redeemed_at is not null),
    (select count(*) from public.game_sessions where score is not null),
    (select count(distinct coalesce(player_id::text, phone)) from public.game_sessions where score is not null),
    (select max(score) from public.game_sessions)
  where public.is_admin();
$$;

-- =====================================================================
-- 4. RLS — nadie toca las tablas directamente
-- =====================================================================

alter table public.profiles      enable row level security;
alter table public.access_codes  enable row level security;
alter table public.game_sessions enable row level security;
alter table public.code_attempts enable row level security;

-- ---- profiles ----
drop policy if exists "perfil propio: leer" on public.profiles;
create policy "perfil propio: leer"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "perfil propio: editar" on public.profiles;
create policy "perfil propio: editar"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---- access_codes: solo el admin ve los códigos ----
drop policy if exists "codigos: solo admin" on public.access_codes;
create policy "codigos: solo admin"
  on public.access_codes for select
  using (public.is_admin());

-- ---- game_sessions: cada quien ve las suyas; el admin, todas ----
drop policy if exists "partidas: propias o admin" on public.game_sessions;
create policy "partidas: propias o admin"
  on public.game_sessions for select
  using ((player_id is not null and player_id = auth.uid()) or public.is_admin());

-- ---- code_attempts: solo el admin ----
drop policy if exists "intentos: solo admin" on public.code_attempts;
create policy "intentos: solo admin"
  on public.code_attempts for select
  using (public.is_admin());

-- Sin políticas de INSERT/UPDATE/DELETE a propósito: escribir en estas tablas
-- solo es posible a través de las funciones de arriba.

-- =====================================================================
-- 5. PERMISOS
-- =====================================================================

revoke all on public.access_codes  from anon, authenticated;
revoke all on public.game_sessions from anon, authenticated;
revoke all on public.code_attempts from anon, authenticated;

grant select on public.access_codes  to authenticated;  -- filtrado por RLS (admin)
grant select on public.game_sessions to authenticated;  -- filtrado por RLS
grant select, update on public.profiles to authenticated;

-- funciones abiertas al jugador (registrado o invitado)
grant execute on function public.redeem_code(text, integer)                      to anon, authenticated;
grant execute on function public.finish_session(uuid, integer, text, text, text) to anon, authenticated;
grant execute on function public.get_ranking(integer)                            to anon, authenticated;

-- funciones del panel
grant execute on function public.generate_access_codes(integer, text, timestamptz, integer) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.is_admin()    to anon, authenticated;

revoke execute on function public.random_code(integer) from anon, authenticated;
revoke execute on function public.generate_access_codes(integer, text, timestamptz, integer) from anon;
revoke execute on function public.admin_stats() from anon;

-- =====================================================================
-- 6. PUESTA EN MARCHA
-- =====================================================================
--
-- a) Registra tu usuario admin desde la web (o desde Authentication -> Users)
--    y luego márcalo como administrador:
--
--      update public.profiles set is_admin = true
--      where id = (select id from auth.users where email = 'tu@correo.com');
--
-- b) Genera el primer lote de códigos:
--
--      select * from public.generate_access_codes(20, 'Prueba', now() + interval '90 days');
--
-- c) Prueba el canje (devuelve session_id):
--
--      select * from public.redeem_code('AB23CD');
--
--    Vuelve a ejecutarlo: devuelve la MISMA sesión con reanudada = true.
--    Solo dará CODIGO_USADO cuando esa partida ya tenga puntaje.
--
-- d) Cierra la partida con un puntaje:
--
--      select public.finish_session('<session_id>', 12450, 'SuguFan', 'Ana Pérez', '999111222');
--
-- e) Mira la tabla de posiciones:
--
--      select * from public.get_ranking(10);
--
-- f) Panel: ver los códigos de un lote para imprimirlos
--
--      select code, label, expires_at, redeemed_at
--      from public.access_codes
--      where label = 'Promo agosto'
--      order by created_at;
--
-- g) Panel: ¿alguien está probando códigos al azar?
--
--      select attempted, reason, count(*), max(created_at)
--      from public.code_attempts
--      where created_at > now() - interval '1 day'
--      group by 1, 2
--      order by 3 desc;
--
-- =====================================================================
-- 7. CÓMO SE LLAMA DESDE EL JUEGO (supabase-js)
-- =====================================================================
--
--   // 1) canjear el código
--   const { data, error } = await supabase.rpc('redeem_code', { p_code: '2H7KMP' });
--   const r = data?.[0];
--   if (r?.ok) {
--     guardarSessionId(r.session_id);       // hace falta para el paso 2
--   } else {
--     mostrarError(r?.error);               // CODIGO_INVALIDO | CODIGO_USADO | CODIGO_EXPIRADO
--   }
--
--   // 2) al perder, registrar el puntaje
--   await supabase.rpc('finish_session', {
--     p_session_id: sessionId,
--     p_score:      12450,
--     p_nickname:   'SuguFan',
--     p_full_name:  'Ana Pérez',
--     p_phone:      '999111222',
--   });
--
--   // 3) tabla de posiciones (no necesita login)
--   const { data: top } = await supabase.rpc('get_ranking', { p_limit: 10 });
--
-- =====================================================================
