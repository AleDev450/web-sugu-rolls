-- =====================================================================
-- 018 — Acceso con Google
-- =====================================================================
-- El alta con Google no pasa por nuestro formulario: los datos los manda
-- Google en `raw_user_meta_data`, y con OTROS nombres. El trigger buscaba
-- `full_name`, `last_name`, `phone` y `address`, así que un cliente que
-- entraba con Google se creaba el perfil PRÁCTICAMENTE VACÍO: sin nombre,
-- solo con el nickname sacado del correo.
--
-- Aquí se amplía el trigger para entender también las claves de Google
-- (`name`, `given_name`, `family_name`), sin tocar nada de lo anterior.
--
-- Lo que NO hace falta tocar:
--   · El enlazado de cuentas. Si alguien ya tenía cuenta con ese mismo
--     correo CONFIRMADO, Supabase le engancha la identidad de Google al
--     usuario que ya existía. No se inserta en auth.users, así que este
--     trigger ni se dispara y el perfil se queda como estaba —con sus
--     puntos y sus pedidos—, que es exactamente lo que se busca.
--   · Teléfono y dirección. Google no los da. El cliente los completa en
--     "Mis datos"; la web se lo pide arriba del todo.
--
-- Idempotente.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nickname text;
  v_nombre   text;
  v_apellido text;
begin
  -- ---------------------------------------------------------------
  -- Nombre y apellido
  --
  -- El formulario propio manda `full_name` y `last_name` por separado.
  -- Google manda el nombre entero en `name`/`full_name` y, según la
  -- cuenta, puede añadir `given_name` y `family_name`. Se prueban en
  -- orden y se cae al primero que traiga algo.
  -- ---------------------------------------------------------------
  v_nombre := coalesce(
    nullif(trim(v_meta ->> 'full_name'), ''),
    nullif(trim(v_meta ->> 'name'), ''),
    nullif(trim(v_meta ->> 'given_name'), '')
  );

  v_apellido := coalesce(
    nullif(trim(v_meta ->> 'last_name'), ''),
    nullif(trim(v_meta ->> 'family_name'), '')
  );

  -- Si Google dio el apellido aparte y el nombre completo ya lo incluye,
  -- se recorta del nombre para no acabar con "Ana Pérez" + "Pérez".
  if v_apellido is not null and v_nombre is not null and v_nombre like '%' || v_apellido then
    v_nombre := nullif(trim(left(v_nombre, length(v_nombre) - length(v_apellido))), '');
  end if;

  -- ---------------------------------------------------------------
  -- Nickname único
  -- ---------------------------------------------------------------
  v_nickname := coalesce(
    nullif(trim(v_meta ->> 'nickname'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'socio'
  );
  -- el nickname tiene un check de 2 a 20 caracteres; un correo tipo
  -- "a@gmail.com" dejaría uno de 1 y reventaría el alta
  if char_length(v_nickname) < 2 then
    v_nickname := v_nickname || floor(random() * 9000 + 1000)::text;
  end if;
  v_nickname := left(v_nickname, 20);

  while exists (select 1 from public.profiles where nickname = v_nickname) loop
    v_nickname := left(v_nickname, 14) || floor(random() * 9000 + 1000)::text;
  end loop;

  insert into public.profiles (id, nickname, full_name, last_name, phone, address)
  values (
    new.id,
    v_nickname,
    v_nombre,
    v_apellido,
    nullif(trim(v_meta ->> 'phone'), ''),
    nullif(trim(v_meta ->> 'address'), '')
  )
  -- si la fila ya existiera (reintento, alta manual previa), no se rompe
  on conflict (id) do nothing;

  return new;
end;
$$;
