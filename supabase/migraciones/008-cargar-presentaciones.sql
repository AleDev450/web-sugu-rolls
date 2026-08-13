-- =====================================================================
-- 008 — Cargar presentaciones en todos los productos
-- =====================================================================
--   5 piezas  -> S/ 15
--  10 piezas  -> S/ 25
--  20 piezas  -> S/ 45
--
-- Requiere haber corrido antes la 007, que crea la columna.
--
-- Idempotente: vuelve a dejar los mismos valores, no acumula ni duplica.
-- =====================================================================

update public.products
set presentaciones = '[
      {"piezas": 5,  "precio": 15},
      {"piezas": 10, "precio": 25},
      {"piezas": 20, "precio": 45}
    ]'::jsonb,
    precio = 25,
    updated_at = now()
where true;

-- ---------------------------------------------------------------------
-- SI SOLO QUIERES LOS MAKIS
--
-- La consulta de arriba toca TODO el catálogo, bebidas y entradas incluidas,
-- y "20 piezas de limonada" no tiene mucho sentido. Para limitarlo, usa esta
-- otra en su lugar (borra la de arriba antes de ejecutar):
--
--   update public.products
--   set presentaciones = '[
--         {"piezas": 5,  "precio": 15},
--         {"piezas": 10, "precio": 25},
--         {"piezas": 20, "precio": 45}
--       ]'::jsonb,
--       precio = 25,
--       updated_at = now()
--   where categoria = 'makis';
--
-- Y para dejar una categoría a precio único otra vez:
--
--   update public.products
--   set presentaciones = '[]'::jsonb
--   where categoria = 'bebidas';
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Comprobación: debe salir cada producto con sus tres presentaciones.
-- ---------------------------------------------------------------------
select nombre,
       categoria,
       precio as precio_base,
       jsonb_array_length(presentaciones) as n_presentaciones,
       presentaciones
from public.products
order by categoria, orden;
