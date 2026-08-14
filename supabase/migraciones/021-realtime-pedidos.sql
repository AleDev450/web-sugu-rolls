-- =====================================================================
-- 021 — Aviso en vivo de pedidos nuevos
-- =====================================================================
-- El panel toca un timbre y muestra un aviso apenas entra un pedido, para
-- que cocina se entere sin depender de que el cliente llegue a enviar el
-- WhatsApp (el checkout solo lo abre con el mensaje listo para enviar; si
-- el cliente cierra la pestaña antes de pulsar enviar, nunca llega).
--
-- Para que el panel reciba el evento en vivo, la tabla `orders` tiene que
-- estar en la publicación `supabase_realtime` — por defecto ninguna tabla
-- lo está. La política de RLS ya existente ("pedidos: propios o admin")
-- sigue aplicando: Realtime solo entrega la fila a quien pueda verla, así
-- que un admin recibe todos los pedidos y un cliente no recibe los ajenos.
--
-- Idempotente: si la tabla ya está en la publicación, no hace nada.
-- =====================================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
