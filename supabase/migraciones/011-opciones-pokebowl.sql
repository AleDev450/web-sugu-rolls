-- =====================================================================
-- 011 — Grupos de opciones para los Poke Bowls
-- =====================================================================
-- Base, toppings, proteína y salsas, tal como se piden en el local.
-- Sin precios: todas las opciones van incluidas.
--
-- Se aplica a los productos de la categoría `bowls`. Si tus poke bowls
-- están en otra categoría, cambia el `where` del final.
--
-- Requiere la 010, que crea la columna.
-- Idempotente: reescribe los mismos grupos, no acumula.
-- =====================================================================

update public.products
set opciones = '[
  {
    "titulo": "Elige tu Base",
    "min": 1,
    "max": 1,
    "opciones": ["Arroz de Sushi", "Mix de Lechugas"]
  },
  {
    "titulo": "Elige tus Toppings",
    "min": 1,
    "max": 8,
    "opciones": [
      "Tiritas de Wantan Frito",
      "Tiritas de Camote Frito",
      "Canchita Chulpi",
      "Pico de Gallo",
      "Pepino",
      "Col",
      "Gari",
      "Palta",
      "Choclo",
      "Mango",
      "Zanahoria"
    ]
  },
  {
    "titulo": "Elige tu Proteína",
    "min": 1,
    "max": 1,
    "opciones": [
      "Pollo al Panko",
      "Tofu Marinado",
      "Tartar de Pescado",
      "Pollo a la Plancha",
      "Salmón Marinado",
      "Ebi Furai"
    ]
  },
  {
    "titulo": "Elige tus Salsas Extras",
    "min": 0,
    "max": 7,
    "opciones": [
      "Acevichado 1 oz",
      "Dulce 1 oz",
      "Salado 1 oz",
      "Honey Mustard 1 oz",
      "Spicy Mayo 1 oz",
      "Maracuyá 1 oz",
      "Ponzu 1 oz"
    ]
  }
]'::jsonb,
    updated_at = now()
where categoria = 'bowls';

-- ---------------------------------------------------------------------
-- Comprobación: qué productos quedaron configurables y con cuántos grupos.
-- ---------------------------------------------------------------------
select nombre,
       categoria,
       jsonb_array_length(opciones) as grupos,
       (select string_agg(g ->> 'titulo', ' · ')
        from jsonb_array_elements(opciones) g) as detalle
from public.products
where jsonb_array_length(opciones) > 0
order by categoria, orden;
