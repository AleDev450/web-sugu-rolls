-- =====================================================================
-- SUGU ROLLS — Tienda: cuentas de cliente, pedidos, puntos y canjes
-- =====================================================================
--
-- Ejecutar DESPUÉS de schema.sql y contenido.sql, en:
-- Supabase -> SQL Editor -> New query -> Run. Es idempotente.
--
-- MODELO
--   profiles       ya existía (schema.sql); aquí se le añaden apellido y dirección
--   orders         un pedido del cliente, con su estado
--   order_items    qué llevaba el pedido, con el precio CONGELADO al comprar
--   point_entries  libro mayor de puntos: cada línea suma o resta
--   rewards        catálogo de canjes que administra el panel
--   redemptions    canjes hechos; si son de descuento, traen su código
--
-- FLUJO
--   1. El cliente se registra           -> Supabase Auth + trigger de profiles
--   2. Arma el carrito y hace el pedido -> crear_pedido()
--   3. Paga por Yape/transferencia/efectivo (fuera de la web)
--   4. El admin confirma el pago        -> admin_confirmar_pago()
--      ...que ACREDITA LOS PUNTOS en el mismo movimiento
--   5. El cliente canjea sus puntos     -> canjear_recompensa()
--
-- POR QUÉ UN LIBRO MAYOR Y NO UN CAMPO `puntos`
--   Un saldo suelto se corrompe en cuanto dos operaciones se pisan, y no deja
--   rastro de por qué alguien tiene lo que tiene. Aquí el saldo es la suma de
--   sus movimientos: siempre cuadra y siempre se puede auditar.
--
-- SEGURIDAD
--   El cliente NUNCA manda precios ni totales: `crear_pedido` los lee de la
--   tabla `products`. Tampoco puede escribir en pedidos, puntos ni canjes;
--   todo pasa por funciones SECURITY DEFINER.
-- =====================================================================

-- =====================================================================
-- 1. DATOS DEL CLIENTE
-- =====================================================================

alter table public.profiles
  add column if not exists last_name text,
  add column if not exists address   text;

comment on column public.profiles.last_name is 'Apellido, pedido en el registro.';
comment on column public.profiles.address is 'Dirección de entrega por defecto.';

-- El trigger de schema.sql ya copiaba nickname, full_name y phone desde los
-- metadatos del registro. Se amplía para los dos campos nuevos.
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

  while exists (select 1 from public.profiles where nickname = v_nickname) loop
    v_nickname := left(v_nickname, 14) || floor(random() * 9000 + 1000)::text;
  end loop;

  insert into public.profiles (id, nickname, full_name, last_name, phone, address)
  values (
    new.id,
    v_nickname,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'address'), '')
  );

  return new;
end;
$$;

-- =====================================================================
-- 2. PEDIDOS
-- =====================================================================

-- ---------------------------------------------------------------------
-- orders — un pedido.
--
-- ESTADOS
--   pendiente  recién hecho, esperando que el cliente pague
--   pagado     el admin confirmó el pago; aquí se acreditan los puntos
--   entregado  ya salió y llegó
--   cancelado  no se concretó (si estaba pagado, se le quitan los puntos)
--
-- `total` se guarda aunque sea derivable de order_items: es el importe que se
-- cobró de verdad, y los precios del catálogo cambian con el tiempo.
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  numero        bigserial unique,
  user_id       uuid not null references public.profiles (id) on delete restrict,
  estado        text not null default 'pendiente',
  total         numeric(10, 2) not null default 0 check (total >= 0),
  -- copia de los datos de entrega al momento del pedido: el perfil puede
  -- cambiar después y el repartidor necesita la dirección de ESE día
  nombre        text not null default '',
  telefono      text not null default '',
  direccion     text not null default '',
  nota          text,
  puntos_dados  integer not null default 0,
  created_at    timestamptz not null default now(),
  paid_at       timestamptz,
  updated_at    timestamptz not null default now(),
  constraint estado_valido check (estado in ('pendiente', 'pagado', 'entregado', 'cancelado'))
);

comment on table public.orders is
  'Pedidos de la web. Contiene datos personales: solo accesible vía funciones y RLS.';

create index if not exists orders_por_fecha_idx on public.orders (created_at desc);
create index if not exists orders_por_cliente_idx on public.orders (user_id, created_at desc);
create index if not exists orders_pendientes_idx on public.orders (created_at desc)
  where estado = 'pendiente';

-- ---------------------------------------------------------------------
-- order_items — el detalle, con precio y nombre CONGELADOS.
--
-- Si mañana sube el precio de un maki o se borra del catálogo, el pedido
-- viejo tiene que seguir contando lo que costó ese día.
-- ---------------------------------------------------------------------
create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  nombre       text not null,
  precio       numeric(8, 2) not null check (precio >= 0),
  cantidad     integer not null check (cantidad between 1 and 99)
);

create index if not exists order_items_por_pedido_idx on public.order_items (order_id);

-- =====================================================================
-- 3. PUNTOS
-- =====================================================================

-- ---------------------------------------------------------------------
-- point_entries — libro mayor. Positivo acredita, negativo descuenta.
-- ---------------------------------------------------------------------
create table if not exists public.point_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  delta         integer not null,
  motivo        text not null,
  order_id      uuid references public.orders (id) on delete set null,
  redemption_id uuid,
  created_at    timestamptz not null default now()
);

comment on table public.point_entries is
  'Libro mayor de puntos. El saldo de alguien es la suma de sus deltas.';

create index if not exists point_entries_por_usuario_idx
  on public.point_entries (user_id, created_at desc);

-- un pedido solo puede acreditar puntos UNA vez, pase lo que pase
create unique index if not exists point_entries_compra_unica_idx
  on public.point_entries (order_id)
  where motivo = 'compra';

-- ---------------------------------------------------------------------
-- Cuántos puntos da un pedido. Se guarda en site_settings para que se
-- pueda cambiar desde el panel sin tocar código.
--
-- `puntos_por_sol` = 1 significa: S/ 45.90 de pedido -> 45 puntos.
-- ---------------------------------------------------------------------
alter table public.site_settings
  add column if not exists puntos_por_sol numeric(6, 2) not null default 1;

comment on column public.site_settings.puntos_por_sol is
  'Puntos que gana el cliente por cada sol pagado. Se aplica al confirmar el pago.';

create or replace function public.puntos_de_compra(p_total numeric)
returns integer
language sql
stable
set search_path = public
as $$
  select greatest(
    0,
    floor(coalesce(p_total, 0) * (select puntos_por_sol from public.site_settings where id = 1))
  )::integer;
$$;

-- ---------------------------------------------------------------------
-- Saldo de puntos de un usuario. Sin argumentos = el del que llama.
-- ---------------------------------------------------------------------
create or replace function public.saldo_puntos(p_user uuid default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(pe.delta), 0)::integer
  from public.point_entries pe
  where pe.user_id = coalesce(p_user, auth.uid())
    and (coalesce(p_user, auth.uid()) = auth.uid() or public.is_admin());
$$;

-- ---------------------------------------------------------------------
-- Niveles del Sugu Club: BRONCE -> PLATA -> ORO -> PLATINO -> BLACK.
--
-- El nivel se calcula con los puntos GANADOS DE POR VIDA (la suma de los
-- movimientos positivos), NO con el saldo disponible.
--
-- Es la diferencia que hace que el programa funcione: si el nivel dependiera
-- del saldo, canjear te bajaría de categoría y nadie canjearía nunca. Así el
-- nivel premia cuánto has comprado y el saldo es lo que te queda por gastar,
-- que son dos cosas distintas.
--
-- Con `puntos_por_sol` = 1, los cortes equivalen a S/300, S/800, S/2000 y
-- S/4000 gastados en total.
-- ---------------------------------------------------------------------
create or replace function public.corte_nivel(p_nivel text)
returns integer
language sql
immutable
as $$
  select case p_nivel
    when 'bronce'  then 0
    when 'plata'   then 300
    when 'oro'     then 800
    when 'platino' then 2000
    when 'black'   then 4000
  end;
$$;

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
    and pe.delta > 0
    and (coalesce(p_user, auth.uid()) = auth.uid() or public.is_admin());
$$;

create or replace function public.nivel_cliente(p_ganados integer)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_ganados, 0) >= public.corte_nivel('black')   then 'black'
    when coalesce(p_ganados, 0) >= public.corte_nivel('platino') then 'platino'
    when coalesce(p_ganados, 0) >= public.corte_nivel('oro')     then 'oro'
    when coalesce(p_ganados, 0) >= public.corte_nivel('plata')   then 'plata'
    else 'bronce'
  end;
$$;

-- ---------------------------------------------------------------------
-- Todo lo que necesita la tarjeta del perfil, en una sola llamada.
-- ---------------------------------------------------------------------
create or replace function public.mi_tarjeta()
returns table (
  saldo     integer,
  ganados   integer,
  nivel     text,
  siguiente text,
  faltan    integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ganados integer;
begin
  saldo := public.saldo_puntos();
  v_ganados := public.puntos_ganados();
  ganados := v_ganados;
  nivel := public.nivel_cliente(v_ganados);

  siguiente := case nivel
    when 'bronce'  then 'plata'
    when 'plata'   then 'oro'
    when 'oro'     then 'platino'
    when 'platino' then 'black'
    else null
  end;

  faltan := case
    when siguiente is null then 0
    else public.corte_nivel(siguiente) - v_ganados
  end;

  return next;
end;
$$;

-- =====================================================================
-- 4. CANJES
-- =====================================================================

-- ---------------------------------------------------------------------
-- rewards — catálogo de canjes que administra el panel.
--
-- TIPOS
--   descuento  genera un código de X% para el siguiente pedido
--   producto   canjea un producto concreto del catálogo
--   juego      genera un código de partida de Sugu Rolls
-- ---------------------------------------------------------------------
create table if not exists public.rewards (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  descripcion   text not null default '',
  tipo          text not null,
  costo_puntos  integer not null check (costo_puntos > 0),
  -- solo para tipo 'descuento'
  porcentaje    numeric(5, 2) check (porcentaje is null or (porcentaje > 0 and porcentaje <= 100)),
  -- solo para tipo 'producto'
  product_id    uuid references public.products (id) on delete set null,
  imagen        text not null default '',
  activo        boolean not null default true,
  orden         smallint not null default 0,
  created_at    timestamptz not null default now(),
  constraint tipo_valido check (tipo in ('descuento', 'producto', 'juego')),
  constraint descuento_con_porcentaje check (tipo <> 'descuento' or porcentaje is not null),
  constraint producto_con_referencia check (tipo <> 'producto' or product_id is not null)
);

comment on table public.rewards is
  'Catálogo de canjes. Lo ve cualquiera logueado; solo el admin lo edita.';

-- ---------------------------------------------------------------------
-- redemptions — un canje hecho.
--
-- Para 'descuento' y 'juego' se guarda el código que se le entrega al
-- cliente. Para 'producto', el admin lo ve en el panel y lo entrega.
-- ---------------------------------------------------------------------
create table if not exists public.redemptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  reward_id     uuid references public.rewards (id) on delete set null,
  nombre        text not null,
  tipo          text not null,
  costo_puntos  integer not null,
  codigo        text unique,
  porcentaje    numeric(5, 2),
  estado        text not null default 'disponible',
  created_at    timestamptz not null default now(),
  used_at       timestamptz,
  constraint estado_canje_valido check (estado in ('disponible', 'usado', 'entregado'))
);

create index if not exists redemptions_por_usuario_idx
  on public.redemptions (user_id, created_at desc);

-- =====================================================================
-- 5. FUNCIONES DEL CLIENTE
-- =====================================================================

-- ---------------------------------------------------------------------
-- Crear un pedido.
--
-- `p_items` llega como [{"slug": "maki-acevichado", "cantidad": 2}, ...].
--
-- Se identifica por SLUG y no por uuid porque es lo que la web lleva en el
-- carrito (`contenido.ts` expone los productos con su slug como id). El slug
-- es único en `products`, así que sirve igual de bien como referencia.
--
-- Los PRECIOS NO VIENEN DEL CLIENTE: se leen de `products`, porque cualquiera
-- puede editar lo que manda el navegador.
-- ---------------------------------------------------------------------
create or replace function public.crear_pedido(
  p_items     jsonb,
  p_direccion text default null,
  p_nota      text default null
)
returns table (id uuid, numero bigint, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil  public.profiles%rowtype;
  v_order   uuid;
  v_numero  bigint;
  v_total   numeric(10, 2) := 0;
  v_item    jsonb;
  v_prod    public.products%rowtype;
  v_cant    integer;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTENTICADO' using hint = 'Inicia sesión para pedir';
  end if;

  select * into v_perfil from public.profiles where profiles.id = auth.uid();
  if not found then
    raise exception 'SIN_PERFIL';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'CARRITO_VACIO';
  end if;

  insert into public.orders (user_id, nombre, telefono, direccion, nota)
  values (
    auth.uid(),
    trim(coalesce(v_perfil.full_name, '') || ' ' || coalesce(v_perfil.last_name, '')),
    coalesce(v_perfil.phone, ''),
    coalesce(nullif(trim(coalesce(p_direccion, '')), ''), v_perfil.address, ''),
    nullif(trim(coalesce(p_nota, '')), '')
  )
  returning orders.id, orders.numero into v_order, v_numero;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := greatest(1, least(99, coalesce((v_item ->> 'cantidad')::integer, 1)));

    select * into v_prod
    from public.products
    where products.slug = (v_item ->> 'slug')
      and products.activo;

    if not found then
      raise exception 'PRODUCTO_NO_DISPONIBLE'
        using hint = 'Uno de los productos ya no está a la venta';
    end if;

    insert into public.order_items (order_id, product_id, nombre, precio, cantidad)
    values (v_order, v_prod.id, v_prod.nombre, v_prod.precio, v_cant);

    v_total := v_total + v_prod.precio * v_cant;
  end loop;

  update public.orders set total = v_total where orders.id = v_order;

  id := v_order;
  numero := v_numero;
  total := v_total;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- Mis pedidos (los del que llama), con su detalle en JSON.
-- ---------------------------------------------------------------------
create or replace function public.mis_pedidos(p_limit integer default 30)
returns table (
  id         uuid,
  numero     bigint,
  estado     text,
  total      numeric,
  puntos     integer,
  creado     timestamptz,
  items      jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id,
         o.numero,
         o.estado,
         o.total,
         o.puntos_dados,
         o.created_at,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'nombre', oi.nombre, 'precio', oi.precio, 'cantidad', oi.cantidad))
            from public.order_items oi where oi.order_id = o.id),
           '[]'::jsonb
         )
  from public.orders o
  where o.user_id = auth.uid()
  order by o.created_at desc
  limit least(coalesce(p_limit, 30), 100);
$$;

-- ---------------------------------------------------------------------
-- Canjear una recompensa.
--
-- Descuenta los puntos y crea el canje en la MISMA transacción, con el saldo
-- bloqueado: si alguien pulsa dos veces, la segunda se queda sin saldo en vez
-- de generar dos cupones.
-- ---------------------------------------------------------------------
create or replace function public.canjear_recompensa(p_reward uuid)
returns table (ok boolean, error text, codigo text, canje uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.rewards%rowtype;
  v_saldo  integer;
  v_codigo text;
  v_id     uuid;
  v_try    integer := 0;
begin
  ok := false; error := null; codigo := null; canje := null;

  if auth.uid() is null then
    error := 'NO_AUTENTICADO';
    return next; return;
  end if;

  select * into v_reward from public.rewards where rewards.id = p_reward and rewards.activo;
  if not found then
    error := 'CANJE_NO_DISPONIBLE';
    return next; return;
  end if;

  -- bloquea las líneas del usuario: evita canjear dos veces con el mismo saldo
  perform 1 from public.point_entries where user_id = auth.uid() for update;

  select coalesce(sum(delta), 0)::integer into v_saldo
  from public.point_entries where user_id = auth.uid();

  if v_saldo < v_reward.costo_puntos then
    error := 'PUNTOS_INSUFICIENTES';
    return next; return;
  end if;

  -- descuento y juego entregan un código; producto lo entrega el local
  if v_reward.tipo in ('descuento', 'juego') then
    loop
      v_codigo := public.random_code(8);
      exit when not exists (select 1 from public.redemptions r where r.codigo = v_codigo)
                and not exists (select 1 from public.access_codes ac where ac.code = v_codigo);
      v_try := v_try + 1;
      if v_try > 20 then raise exception 'SIN_CODIGOS_LIBRES'; end if;
    end loop;
  end if;

  insert into public.redemptions (user_id, reward_id, nombre, tipo, costo_puntos, codigo, porcentaje)
  values (auth.uid(), v_reward.id, v_reward.nombre, v_reward.tipo,
          v_reward.costo_puntos, v_codigo, v_reward.porcentaje)
  returning redemptions.id into v_id;

  insert into public.point_entries (user_id, delta, motivo, redemption_id)
  values (auth.uid(), -v_reward.costo_puntos, 'canje', v_id);

  -- un canje de tipo juego es un código de partida de verdad
  if v_reward.tipo = 'juego' then
    insert into public.access_codes (code, label)
    values (v_codigo, 'Canje por puntos');
  end if;

  ok := true; codigo := v_codigo; canje := v_id;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- Mis canjes.
-- ---------------------------------------------------------------------
create or replace function public.mis_canjes(p_limit integer default 50)
returns table (
  id           uuid,
  nombre       text,
  tipo         text,
  costo_puntos integer,
  codigo       text,
  porcentaje   numeric,
  estado       text,
  creado       timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.nombre, r.tipo, r.costo_puntos, r.codigo, r.porcentaje, r.estado, r.created_at
  from public.redemptions r
  where r.user_id = auth.uid()
  order by r.created_at desc
  limit least(coalesce(p_limit, 50), 200);
$$;

-- =====================================================================
-- 6. FUNCIONES DEL PANEL
-- =====================================================================

-- ---------------------------------------------------------------------
-- Confirmar el pago de un pedido. ES AQUÍ donde se acreditan los puntos.
--
-- El índice único sobre point_entries(order_id) donde motivo = 'compra'
-- garantiza que confirmar dos veces no acredite el doble.
-- ---------------------------------------------------------------------
create or replace function public.admin_confirmar_pago(p_order uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders%rowtype;
  v_puntos integer;
begin
  if not public.is_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;

  select * into v_order from public.orders where orders.id = p_order for update;
  if not found then raise exception 'PEDIDO_NO_EXISTE'; end if;

  if v_order.estado in ('pagado', 'entregado') then
    raise exception 'PEDIDO_YA_PAGADO';
  end if;
  if v_order.estado = 'cancelado' then
    raise exception 'PEDIDO_CANCELADO';
  end if;

  v_puntos := public.puntos_de_compra(v_order.total);

  update public.orders
  set estado = 'pagado', paid_at = now(), puntos_dados = v_puntos, updated_at = now()
  where orders.id = p_order;

  if v_puntos > 0 then
    insert into public.point_entries (user_id, delta, motivo, order_id)
    values (v_order.user_id, v_puntos, 'compra', p_order)
    on conflict do nothing;
  end if;

  return v_puntos;
end;
$$;

-- ---------------------------------------------------------------------
-- Cambiar el estado de un pedido.
--
-- Cancelar un pedido YA PAGADO le retira los puntos que dio: si no, se podría
-- pedir, cobrar los puntos, cancelar y quedarse con ellos.
-- ---------------------------------------------------------------------
create or replace function public.admin_estado_pedido(p_order uuid, p_estado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_estado not in ('pendiente', 'pagado', 'entregado', 'cancelado') then
    raise exception 'ESTADO_INVALIDO';
  end if;

  select * into v_order from public.orders where orders.id = p_order for update;
  if not found then raise exception 'PEDIDO_NO_EXISTE'; end if;

  if p_estado = 'pagado' then
    perform public.admin_confirmar_pago(p_order);
    return;
  end if;

  if p_estado = 'cancelado' and v_order.puntos_dados > 0 then
    insert into public.point_entries (user_id, delta, motivo, order_id)
    values (v_order.user_id, -v_order.puntos_dados, 'anulacion', p_order);
    update public.orders set puntos_dados = 0 where orders.id = p_order;
  end if;

  update public.orders set estado = p_estado, updated_at = now() where orders.id = p_order;
end;
$$;

-- ---------------------------------------------------------------------
-- Lista de pedidos para el panel, con cliente, detalle y saldo de puntos.
-- ---------------------------------------------------------------------
create or replace function public.admin_pedidos(
  p_estado text default null,
  p_limit  integer default 200
)
returns table (
  id          uuid,
  numero      bigint,
  estado      text,
  total       numeric,
  nombre      text,
  telefono    text,
  direccion   text,
  nota        text,
  correo      text,
  puntos      integer,
  creado      timestamptz,
  pagado      timestamptz,
  items       jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.numero, o.estado, o.total, o.nombre, o.telefono, o.direccion, o.nota,
         u.email,
         o.puntos_dados,
         o.created_at,
         o.paid_at,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'nombre', oi.nombre, 'precio', oi.precio, 'cantidad', oi.cantidad))
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

-- ---------------------------------------------------------------------
-- Canjes hechos por los clientes, para que el local sepa qué entregar.
-- ---------------------------------------------------------------------
create or replace function public.admin_canjes(p_limit integer default 200)
returns table (
  id           uuid,
  nombre       text,
  tipo         text,
  costo_puntos integer,
  codigo       text,
  estado       text,
  cliente      text,
  telefono     text,
  correo       text,
  creado       timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.nombre, r.tipo, r.costo_puntos, r.codigo, r.estado,
         trim(coalesce(p.full_name, '') || ' ' || coalesce(p.last_name, '')),
         p.phone,
         u.email,
         r.created_at
  from public.redemptions r
  join public.profiles p on p.id = r.user_id
  left join auth.users u on u.id = r.user_id
  where public.is_admin()
  order by r.created_at desc
  limit least(coalesce(p_limit, 200), 500);
$$;

-- ---------------------------------------------------------------------
-- Marcar un canje como entregado/usado.
-- ---------------------------------------------------------------------
create or replace function public.admin_estado_canje(p_canje uuid, p_estado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_estado not in ('disponible', 'usado', 'entregado') then
    raise exception 'ESTADO_INVALIDO';
  end if;

  update public.redemptions
  set estado = p_estado,
      used_at = case when p_estado = 'disponible' then null else now() end
  where id = p_canje;
end;
$$;

-- =====================================================================
-- 7. RLS
-- =====================================================================

alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.point_entries enable row level security;
alter table public.rewards       enable row level security;
alter table public.redemptions   enable row level security;

-- ---- pedidos: cada quien los suyos; el admin, todos ----
drop policy if exists "pedidos: propios o admin" on public.orders;
create policy "pedidos: propios o admin"
  on public.orders for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "detalle: propio o admin" on public.order_items;
create policy "detalle: propio o admin"
  on public.order_items for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or public.is_admin())
  ));

-- ---- puntos: cada quien ve sus movimientos ----
drop policy if exists "puntos: propios o admin" on public.point_entries;
create policy "puntos: propios o admin"
  on public.point_entries for select
  using (user_id = auth.uid() or public.is_admin());

-- ---- canjes: el catálogo activo lo ve cualquiera logueado ----
drop policy if exists "recompensas: visibles" on public.rewards;
create policy "recompensas: visibles"
  on public.rewards for select
  using (activo or public.is_admin());

drop policy if exists "recompensas: escribe el admin" on public.rewards;
create policy "recompensas: escribe el admin"
  on public.rewards for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "canjes: propios o admin" on public.redemptions;
create policy "canjes: propios o admin"
  on public.redemptions for select
  using (user_id = auth.uid() or public.is_admin());

-- Sin políticas de INSERT/UPDATE/DELETE en pedidos, puntos ni canjes: se
-- escriben SOLO por las funciones de arriba.

-- =====================================================================
-- 8. PERMISOS
-- =====================================================================

revoke all on public.orders        from anon, authenticated;
revoke all on public.order_items   from anon, authenticated;
revoke all on public.point_entries from anon, authenticated;
revoke all on public.redemptions   from anon, authenticated;
revoke all on public.rewards       from anon, authenticated;

grant select on public.orders        to authenticated;
grant select on public.order_items   to authenticated;
grant select on public.point_entries to authenticated;
grant select on public.redemptions   to authenticated;
grant select on public.rewards       to authenticated;
grant insert, update, delete on public.rewards to authenticated;  -- filtrado por RLS (admin)

-- cliente
grant execute on function public.crear_pedido(jsonb, text, text)   to authenticated;
grant execute on function public.mis_pedidos(integer)              to authenticated;
grant execute on function public.mis_canjes(integer)               to authenticated;
grant execute on function public.canjear_recompensa(uuid)          to authenticated;
grant execute on function public.saldo_puntos(uuid)                to authenticated;
grant execute on function public.puntos_ganados(uuid)              to authenticated;
grant execute on function public.mi_tarjeta()                      to authenticated;
grant execute on function public.nivel_cliente(integer)            to anon, authenticated;
grant execute on function public.corte_nivel(text)                 to anon, authenticated;

-- panel
grant execute on function public.admin_confirmar_pago(uuid)        to authenticated;
grant execute on function public.admin_estado_pedido(uuid, text)   to authenticated;
grant execute on function public.admin_pedidos(text, integer)      to authenticated;
grant execute on function public.admin_canjes(integer)             to authenticated;
grant execute on function public.admin_estado_canje(uuid, text)    to authenticated;

revoke execute on function public.admin_confirmar_pago(uuid)      from anon;
revoke execute on function public.admin_estado_pedido(uuid, text) from anon;
revoke execute on function public.admin_pedidos(text, integer)    from anon;
revoke execute on function public.admin_canjes(integer)           from anon;
revoke execute on function public.admin_estado_canje(uuid, text)  from anon;

-- =====================================================================
-- 9. CANJES DE EJEMPLO (se pueden borrar desde el panel)
-- =====================================================================

insert into public.rewards (nombre, descripcion, tipo, costo_puntos, porcentaje, orden)
select '10% de descuento', 'Un código con 10% de descuento para tu siguiente pedido.',
       'descuento', 200, 10, 1
where not exists (select 1 from public.rewards);

insert into public.rewards (nombre, descripcion, tipo, costo_puntos, orden)
select 'Partida de Sugu Rolls', 'Un código para jugar y entrar al ranking.', 'juego', 80, 2
where not exists (select 1 from public.rewards where tipo = 'juego');
