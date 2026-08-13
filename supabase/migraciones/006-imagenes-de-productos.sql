-- =====================================================================
-- 006 — Almacén de imágenes de productos
-- =====================================================================
-- Crea el bucket donde el panel sube las fotos de la carta.
--
-- Lectura pública (las ve cualquiera que entre a la web) y escritura solo
-- para administradores: sin esto, cualquiera con la clave pública podría
-- llenar el almacén de archivos.
--
-- Idempotente.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos',
  'productos',
  true,
  -- 3 MB de tope: el panel ya reduce a ~1200x900 WebP antes de subir, así que
  -- una imagen normal pesa 100-250 KB. Este límite es la red de seguridad.
  3145728,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---- lectura: abierta, son fotos de la carta ----
drop policy if exists "productos: ver imagenes" on storage.objects;
create policy "productos: ver imagenes"
  on storage.objects for select
  using (bucket_id = 'productos');

-- ---- escritura: solo el admin ----
drop policy if exists "productos: subir imagenes" on storage.objects;
create policy "productos: subir imagenes"
  on storage.objects for insert
  with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "productos: reemplazar imagenes" on storage.objects;
create policy "productos: reemplazar imagenes"
  on storage.objects for update
  using (bucket_id = 'productos' and public.is_admin())
  with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "productos: borrar imagenes" on storage.objects;
create policy "productos: borrar imagenes"
  on storage.objects for delete
  using (bucket_id = 'productos' and public.is_admin());
