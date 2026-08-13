-- =====================================================================
-- 012 — Almacén de imágenes para todo el contenido
-- =====================================================================
-- Amplía lo de la 006: además de productos, ahora se suben imágenes de
-- paquetes y de las secciones de las páginas (hero, nosotros, catering…).
--
-- Un solo bucket con carpetas dentro (productos/, paquetes/, secciones/) en
-- vez de uno por tipo: mismas reglas de acceso para todo y un único sitio
-- donde mirar cuando algo falte.
--
-- El bucket `productos` de la 006 se deja como está: las imágenes ya subidas
-- siguen sirviéndose desde ahí y sus URL no deben romperse.
--
-- Idempotente.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imagenes',
  'imagenes',
  true,
  3145728,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "contenido: ver imagenes" on storage.objects;
create policy "contenido: ver imagenes"
  on storage.objects for select
  using (bucket_id = 'imagenes');

drop policy if exists "contenido: subir imagenes" on storage.objects;
create policy "contenido: subir imagenes"
  on storage.objects for insert
  with check (bucket_id = 'imagenes' and public.is_admin());

drop policy if exists "contenido: reemplazar imagenes" on storage.objects;
create policy "contenido: reemplazar imagenes"
  on storage.objects for update
  using (bucket_id = 'imagenes' and public.is_admin())
  with check (bucket_id = 'imagenes' and public.is_admin());

drop policy if exists "contenido: borrar imagenes" on storage.objects;
create policy "contenido: borrar imagenes"
  on storage.objects for delete
  using (bucket_id = 'imagenes' and public.is_admin());
