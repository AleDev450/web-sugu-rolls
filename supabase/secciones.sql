-- =====================================================================
-- SUGU ROLLS — Contenido de las secciones de cada página
-- =====================================================================
--
-- Ejecutar DESPUÉS de schema.sql y contenido.sql.
-- Supabase -> SQL Editor -> New query -> Run. Es idempotente.
--
-- Cada fila es una sección editable desde /admin/paginas: el texto pequeño
-- (etiqueta), el título, la palabra manuscrita en rojo, el párrafo, la imagen
-- y los datos propios de esa sección (listas, botones) en `extra`.
-- =====================================================================

create table if not exists public.page_sections (
  id            text primary key,
  pagina        text not null,
  titulo_panel  text not null,
  etiqueta      text not null default '',
  titulo        text not null default '',
  manuscrito    text not null default '',
  bajada        text not null default '',
  imagen        text not null default '',
  extra         jsonb not null default '{}'::jsonb,
  orden         smallint not null default 0,
  updated_at    timestamptz not null default now()
);

comment on table public.page_sections is
  'Textos e imágenes de cada sección de la web, editables desde el panel.';

comment on column public.page_sections.extra is
  'Datos propios de la sección: listas de beneficios, pasos, estadísticas, textos de botones…';

drop trigger if exists page_sections_touch on public.page_sections;
create trigger page_sections_touch before update on public.page_sections
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- RLS — lectura pública, escritura solo del administrador
-- =====================================================================

alter table public.page_sections enable row level security;

drop policy if exists "secciones: lectura publica" on public.page_sections;
create policy "secciones: lectura publica" on public.page_sections
  for select using (true);

drop policy if exists "secciones: escribe admin" on public.page_sections;
create policy "secciones: escribe admin" on public.page_sections
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.page_sections to anon, authenticated;
grant insert, update, delete on public.page_sections to authenticated;

-- =====================================================================
-- CONTENIDO INICIAL — el mismo que la web trae hoy
-- =====================================================================

insert into public.page_sections
  (id, pagina, titulo_panel, etiqueta, titulo, manuscrito, bajada, imagen, extra, orden)
values
  (
    'hero', 'inicio', 'Portada — Cabecera',
    'Makis peruanos · Preparados al momento',
    'Makis que', 'te hacen feliz',
    'En Sugu Rolls combinamos frescura, sabor y pasión en cada roll. Makis preparados al momento con ingredientes seleccionados y mucho sabor para ti.',
    '/imagenes/web/hero-makis.webp',
    '{"beneficios":["Ingredientes frescos","Calidad premium","Delivery rápido"],"boton_principal":"Pedir ahora","boton_secundario":"Ver nuestra carta"}'::jsonb,
    1
  ),
  (
    'accesos', 'inicio', 'Portada — Accesos destacados',
    '', '', '', '', '',
    '{"tarjetas":[{"titulo":"Nuestra Carta","texto":"Descubre todos nuestros makis, bowls, entradas y bebidas.","imagen":"/imagenes/web/carta.webp","href":"/carta"},{"titulo":"Catering","texto":"Lleva el sabor de Sugu Rolls a reuniones, cumpleaños y ocasiones especiales.","imagen":"/imagenes/web/catering.webp","href":"/catering"}],"juego_titulo":"Promociones y Juego","juego_texto":"Juega, gana y disfruta de descuentos, makis gratis y premios exclusivos.","juego_boton":"Jugar ahora"}'::jsonb,
    2
  ),
  (
    'favoritos', 'inicio', 'Portada — Nuestros Favoritos',
    'Los más pedidos', 'Nuestros', 'Favoritos', '', '',
    '{"enlace":"Ver carta completa"}'::jsonb,
    3
  ),
  (
    'paquetes', 'paquetes', 'Paquetes',
    'Para compartir', 'Paquetes para', 'compartir',
    'Elige el paquete perfecto para disfrutar con amigos, familia o compañeros de trabajo.',
    '', '{}'::jsonb, 4
  ),
  (
    'catering', 'catering', 'Catering',
    'Eventos y empresas', 'Catering', 'Sugu Rolls',
    'Creamos experiencias gastronómicas para reuniones corporativas, cumpleaños, celebraciones y eventos privados.',
    '/imagenes/web/catering.webp',
    '{"beneficios":["Bandejas personalizadas","Opciones clásicas, premium y vegetarianas","Entrega programada","Presentación especial","Atención para grupos grandes"],"boton":"Solicitar cotización","dato_valor":"+150","dato_texto":"eventos atendidos"}'::jsonb,
    5
  ),
  (
    'juego', 'promociones', 'Promociones y Juego',
    'Sugu Game', 'Juega y gana con', 'Sugu Rolls',
    'Combina ingredientes, completa pedidos y desbloquea premios exclusivos. Consigue descuentos, productos gratis y muchas sorpresas.',
    '/imagenes/ui/vista-principal.webp',
    '{"pasos":["Ingresa al juego.","Alcanza el puntaje requerido.","Compite por el primer lugar y gana el premio sorpresa."],"boton_principal":"Jugar ahora","boton_secundario":"¿Cómo funciona?"}'::jsonb,
    6
  ),
  (
    'nosotros', 'nosotros', 'Nosotros',
    'Nosotros', 'Pasión en cada', 'roll',
    'En Sugu Rolls preparamos cada pedido al momento, combinando ingredientes frescos, recetas propias y mucha pasión. Buscamos que cada roll tenga sabor, personalidad y una presentación que sorprenda.',
    '/imagenes/web/nosotros.webp',
    '{"estadisticas":[{"valor":"+20","texto":"variedades"},{"valor":"100%","texto":"ingredientes seleccionados"},{"valor":"Al momento","texto":"preparación"},{"valor":"Lima","texto":"delivery"}]}'::jsonb,
    7
  ),
  (
    'testimonios', 'inicio', 'Portada — Testimonios',
    'Testimonios', 'Lo que dicen', 'de nosotros', '', '', '{}'::jsonb, 8
  ),
  (
    'contacto', 'contacto', 'Contacto',
    'Contacto', 'Estamos', 'para ti',
    'Escríbenos para pedidos, cotizaciones o cualquier consulta.',
    '', '{}'::jsonb, 9
  )
on conflict (id) do nothing;
