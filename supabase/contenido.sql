-- =====================================================================
-- SUGU ROLLS — Contenido editable desde el panel de administración
-- =====================================================================
--
-- Ejecutar DESPUÉS de schema.sql (necesita la tabla `profiles` y la
-- función `is_admin()` que se crean allí).
--
-- Supabase -> SQL Editor -> New query -> Run. Es idempotente.
--
-- MODELO
--   site_settings  Ajustes del sitio (teléfono, horario, redes…). Fila única.
--   categories     Categorías de la carta.
--   products       Productos: makis, bowls, entradas, bebidas.
--   packages       Paquetes para compartir (Sugu Box).
--   testimonials   Reseñas de clientes.
--
-- SEGURIDAD
--   Cualquiera puede LEER lo publicado (la web es pública).
--   Solo un administrador puede escribir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ajustes del sitio. Una sola fila (id = 1) para editarla sin complicar.
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  id           smallint primary key default 1,
  nombre       text not null default 'Sugu Rolls',
  eslogan      text not null default 'Makis que te hacen feliz',
  descripcion  text not null default 'Makis preparados al momento con ingredientes frescos.',
  telefono     text not null default '+51 999 123 456',
  whatsapp     text not null default '51999123456',
  correo       text not null default 'hola@sugurolls.com.pe',
  direccion    text not null default 'Lima, Perú',
  horario      text not null default 'Lunes a domingo: 12:00 p. m. a 11:00 p. m.',
  instagram    text default 'https://instagram.com/sugurolls',
  facebook     text default 'https://facebook.com/sugurolls',
  tiktok       text default 'https://tiktok.com/@sugurolls',
  updated_at   timestamptz not null default now(),
  constraint fila_unica check (id = 1)
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Categorías de la carta
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          text primary key,
  nombre      text not null,
  descripcion text,
  orden       smallint not null default 0,
  activa      boolean not null default true
);

insert into public.categories (id, nombre, descripcion, orden) values
  ('makis',    'Makis',    'Nuestros rolls preparados al momento', 1),
  ('bowls',    'Bowls',    'Arroz, proteína y toppings en un tazón', 2),
  ('entradas', 'Entradas', 'Para empezar o compartir', 3),
  ('bebidas',  'Bebidas',  'Refrescos y limonadas de la casa', 4)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Productos
--
-- `destacado` los saca en "Nuestros Favoritos" de la portada.
-- `activo` en false los oculta sin borrarlos.
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  nombre       text not null,
  descripcion  text not null default '',
  precio       numeric(8, 2) not null check (precio >= 0),
  categoria    text not null references public.categories (id) on update cascade,
  imagen       text not null default '',
  etiqueta     text,
  destacado    boolean not null default false,
  activo       boolean not null default true,
  orden        smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint etiqueta_valida check (
    etiqueta is null or etiqueta in ('Nuevo', 'Más pedido', 'Picante', 'Vegetariano')
  )
);

create index if not exists products_visibles_idx
  on public.products (categoria, orden)
  where activo;

create index if not exists products_destacados_idx
  on public.products (orden)
  where activo and destacado;

-- ---------------------------------------------------------------------
-- Paquetes para compartir
-- ---------------------------------------------------------------------
create table if not exists public.packages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nombre      text not null,
  piezas      smallint not null default 0,
  precio      numeric(8, 2) not null check (precio >= 0),
  ideal       text not null default '',
  incluye     text[] not null default '{}',
  imagen      text not null default '',
  mas_pedido  boolean not null default false,
  activo      boolean not null default true,
  orden       smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Testimonios
-- ---------------------------------------------------------------------
create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  comentario  text not null,
  estrellas   smallint not null default 5 check (estrellas between 1 and 5),
  activo      boolean not null default true,
  orden       smallint not null default 0,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- `updated_at` automático
-- =====================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists packages_touch on public.packages;
create trigger packages_touch before update on public.packages
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- RLS — lectura pública de lo activo, escritura solo del administrador
-- =====================================================================

alter table public.site_settings enable row level security;
alter table public.categories    enable row level security;
alter table public.products      enable row level security;
alter table public.packages      enable row level security;
alter table public.testimonials  enable row level security;

-- ---- lectura pública ----
drop policy if exists "ajustes: lectura publica" on public.site_settings;
create policy "ajustes: lectura publica" on public.site_settings for select using (true);

drop policy if exists "categorias: lectura publica" on public.categories;
create policy "categorias: lectura publica" on public.categories for select using (true);

drop policy if exists "productos: lectura publica" on public.products;
create policy "productos: lectura publica" on public.products
  for select using (activo or public.is_admin());

drop policy if exists "paquetes: lectura publica" on public.packages;
create policy "paquetes: lectura publica" on public.packages
  for select using (activo or public.is_admin());

drop policy if exists "testimonios: lectura publica" on public.testimonials;
create policy "testimonios: lectura publica" on public.testimonials
  for select using (activo or public.is_admin());

-- ---- escritura solo admin ----
drop policy if exists "ajustes: escribe admin" on public.site_settings;
create policy "ajustes: escribe admin" on public.site_settings
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categorias: escribe admin" on public.categories;
create policy "categorias: escribe admin" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "productos: escribe admin" on public.products;
create policy "productos: escribe admin" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "paquetes: escribe admin" on public.packages;
create policy "paquetes: escribe admin" on public.packages
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "testimonios: escribe admin" on public.testimonials;
create policy "testimonios: escribe admin" on public.testimonials
  for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- PERMISOS
-- =====================================================================

grant select on public.site_settings, public.categories, public.products,
                public.packages, public.testimonials to anon, authenticated;

grant insert, update, delete on public.categories, public.products,
                                public.packages, public.testimonials to authenticated;
grant update on public.site_settings to authenticated;

-- =====================================================================
-- CONTENIDO INICIAL (el mismo que trae la web hoy)
-- =====================================================================

insert into public.products (slug, nombre, descripcion, precio, categoria, imagen, etiqueta, destacado, orden) values
  ('acevichado-roll', 'Acevichado Roll', 'Pesca del día, palta, cebolla morada y salsa acevichada.', 28.90, 'makis', '/imagenes/web/productos/acevichado-roll.webp', 'Más pedido', true, 1),
  ('sugu-especial', 'Sugu Especial', 'Langostino tempura, palta y salsa especial.', 29.90, 'makis', '/imagenes/web/productos/sugu-especial.webp', null, true, 2),
  ('volcan-roll', 'Volcán Roll', 'Salmón, queso crema y topping spicy.', 30.90, 'makis', '/imagenes/web/productos/volcan-roll.webp', 'Picante', true, 3),
  ('rock-and-roll', 'Rock & Roll', 'Pollo crispy, palta y salsa teriyaki.', 26.90, 'makis', '/imagenes/web/productos/rock-roll.webp', null, true, 4),
  ('veggie-roll', 'Veggie Roll', 'Palta, pepino, zanahoria, queso crema y ajonjolí.', 22.90, 'makis', '/imagenes/web/productos/veggie-roll.webp', 'Vegetariano', true, 5),
  ('sugu-bowl', 'Sugu Bowl', 'Arroz shari, salmón, palta, edamame y sésamo.', 27.90, 'bowls', '/imagenes/web/productos/acevichado-roll.webp', null, false, 6),
  ('ebi-furai', 'Ebi Furai', 'Langostinos empanizados crocantes con salsa de la casa.', 21.90, 'entradas', '/imagenes/web/productos/rock-roll.webp', null, false, 7),
  ('gyozas', 'Gyozas', 'Empanaditas japonesas selladas a la plancha (6 unidades).', 18.90, 'entradas', '/imagenes/web/productos/sugu-especial.webp', null, false, 8),
  ('limonada-maracuya', 'Limonada de Maracuyá', 'Jarra de 1 litro, preparada al momento.', 14.90, 'bebidas', '/imagenes/web/productos/veggie-roll.webp', null, false, 9)
on conflict (slug) do nothing;

insert into public.packages (slug, nombre, piezas, precio, ideal, incluye, imagen, mas_pedido, orden) values
  ('personal', 'Sugu Box Personal', 20, 34.90, 'Ideal para una persona', array['20 piezas','2 sabores a elección','1 bebida'], '/imagenes/web/productos/veggie-roll.webp', false, 1),
  ('duo', 'Sugu Box Dúo', 40, 64.90, 'Ideal para compartir', array['40 piezas','4 sabores a elección','2 bebidas'], '/imagenes/web/productos/sugu-especial.webp', true, 2),
  ('party', 'Sugu Box Party', 80, 119.90, 'Ideal para reuniones', array['80 piezas','8 sabores a elección','Salsas adicionales'], '/imagenes/web/productos/acevichado-roll.webp', false, 3)
on conflict (slug) do nothing;

insert into public.testimonials (nombre, comentario, estrellas, orden)
select * from (values
  ('Andrea Ríos', 'Los makis llegaron frescos, bien presentados y con bastante relleno. Se nota que los preparan al momento.', 5::smallint, 1::smallint),
  ('Diego Salazar', 'El acevichado es increíble. Definitivamente volvería a pedir, y el delivery fue bastante rápido.', 5, 2),
  ('Camila Vargas', 'Pedimos una bandeja para una reunión y todos quedaron encantados. La presentación fue espectacular.', 5, 3),
  ('Luis Fernández', 'Buenísima relación precio-calidad. El Sugu Box Dúo nos alcanzó perfecto para dos y sobró.', 5, 4)
) as nuevos(nombre, comentario, estrellas, orden)
where not exists (select 1 from public.testimonials);

-- =====================================================================
-- LISTO
--
-- Recuerda marcarte como administrador (ver schema.sql):
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'tu@correo.com');
-- =====================================================================

-- =====================================================================
-- MÓDULOS DE LA WEB
-- =====================================================================
--
-- Cada bandera enciende o apaga una parte del sitio desde el panel, sin
-- desplegar nada. `solo_juego` es el interruptor maestro: con él activo la
-- web entera queda en pausa y todo lleva a /juego, que es el modo para
-- campañas donde solo interesa el juego.
--
-- Son columnas y no una tabla aparte porque son ocho valores fijos que se
-- leen SIEMPRE junto al resto de ajustes: en una tabla obligarían a una
-- segunda consulta en cada carga de página para nada.
-- =====================================================================

alter table public.site_settings
  add column if not exists mod_carta       boolean not null default true,
  add column if not exists mod_paquetes    boolean not null default true,
  add column if not exists mod_catering    boolean not null default true,
  add column if not exists mod_promociones boolean not null default true,
  add column if not exists mod_nosotros    boolean not null default true,
  add column if not exists mod_contacto    boolean not null default true,
  add column if not exists mod_cuenta      boolean not null default true,
  add column if not exists mod_juego       boolean not null default true,
  add column if not exists solo_juego      boolean not null default false;

comment on column public.site_settings.mod_cuenta is
  'Cuentas de cliente: registro, perfil, puntos y canjes. Apagarlo también oculta el cierre de pedido con cuenta.';

comment on column public.site_settings.solo_juego is
  'Modo campaña: apaga la web y deja solo /juego. Manda por encima de las demás banderas.';
