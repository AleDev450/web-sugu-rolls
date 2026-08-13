-- =====================================================================
-- 003 — Términos y política de privacidad editables desde el panel
-- =====================================================================
-- Añade dos campos de texto largo a site_settings. Se redactan en
-- Panel -> Términos y privacidad, y se publican en /terminos y /privacidad.
--
-- El texto va en Markdown ligero (### títulos, - viñetas, **negrita**); la
-- web lo pinta como elementos, nunca como HTML crudo.
--
-- Idempotente.
-- =====================================================================

alter table public.site_settings
  add column if not exists terminos            text not null default '',
  add column if not exists privacidad          text not null default '',
  add column if not exists legales_actualizado date;

comment on column public.site_settings.terminos is
  'Términos y condiciones en Markdown ligero. Se muestra en /terminos.';
comment on column public.site_settings.privacidad is
  'Política de privacidad en Markdown ligero. Se muestra en /privacidad.';
