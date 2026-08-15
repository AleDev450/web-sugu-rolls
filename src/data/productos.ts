/**
 * Catálogo simulado.
 *
 * Sustituir por la consulta a la API/Supabase manteniendo estos tipos: la UI
 * solo depende de la forma de los datos, no de su origen.
 */

/**
 * Ids de categoría. La lista viva está en la tabla `categories` y se edita
 * desde el panel; esta unión es el respaldo local y solo tiene que incluir
 * las que existan ahí para que los tipos no mientan.
 */
export type CategoriaId =
  | 'makis'
  | 'burrito-roll'
  | 'handroll'
  | 'temaki'
  | 'onigiri'
  | 'bowls'
  | 'platos-calientes'
  | 'entradas'
  | 'salsas-extras'
  | 'bebidas';

export interface Categoria {
  id: CategoriaId;
  nombre: string;
  descripcion: string;
}

/** Una cantidad a la venta con su precio: "5 piezas por S/ 18". */
export interface Presentacion {
  piezas: number;
  precio: number;
}

/**
 * Una opción dentro de un grupo, con su costo extra.
 *
 * `precio: 0` = va incluida en el precio base (la mayoría de bases y
 * toppings). `precio > 0` = se suma al precio del producto al elegirla
 * (un extra de verdad, como "Palta extra" o "Queso crema").
 */
export interface OpcionCatalogo {
  nombre: string;
  precio: number;
}

/**
 * Grupo de personalización: base, toppings, proteína, salsas…
 *
 * `min: 0` = el grupo es opcional. `min > 0` = obligatorio, hay que marcar
 * al menos esas. `max` es el tope de opciones que se pueden marcar.
 */
export interface GrupoOpciones {
  titulo: string;
  min: number;
  max: number;
  opciones: OpcionCatalogo[];
}

/** Lo elegido por el cliente, indexado por título de grupo: solo nombres. */
export type OpcionesElegidas = Record<string, string[]>;

/** Una opción elegida, con el precio extra que tenía al momento de elegirla. */
export interface OpcionElegidaConPrecio {
  nombre: string;
  precio: number;
}

/**
 * Lo elegido por el cliente con el precio de cada extra ya pegado.
 *
 * Vive en el carrito y en el mensaje de WhatsApp, donde hace falta mostrar
 * cuánto suma cada extra. Antes de llegar a la base se aplana a
 * `OpcionesElegidas` (solo nombres): el precio final lo recalcula el
 * servidor con el catálogo vigente, nunca se confía en el del cliente.
 */
export type OpcionesConPrecio = Record<string, OpcionElegidaConPrecio[]>;

/** Deja solo los nombres elegidos, para lo que espera la base. */
export function aplanarOpciones(o?: OpcionesConPrecio): OpcionesElegidas | undefined {
  if (!o) return undefined;
  const plano: OpcionesElegidas = {};
  for (const [grupo, elegidas] of Object.entries(o)) {
    plano[grupo] = elegidas.map((e) => e.nombre);
  }
  return plano;
}

/**
 * Texto "Grupo: opción, Extra (+S/ 2.00)" por cada grupo con algo elegido.
 *
 * Se usa tanto en el mensaje de WhatsApp como en el carrito: sin el grupo
 * delante, "Palta, Choclo, Queso crema" no dice si Queso crema es un extra
 * con costo o un topping incluido, y con dos o más grupos ya no se sabe cuál
 * es cuál (base vs. toppings vs. extras).
 */
export function formatoOpciones(o?: OpcionesConPrecio, separador = ' · '): string {
  if (!o) return '';
  return Object.entries(o)
    .filter(([, elegidas]) => elegidas.length > 0)
    .map(
      ([grupo, elegidas]) =>
        `${grupo}: ${elegidas
          .map((e) => (e.precio > 0 ? `${e.nombre} (+${soles(e.precio)})` : e.nombre))
          .join(', ')}`
    )
    .join(separador);
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  /** soles */
  precio: number;
  categoria: CategoriaId;
  imagen: string;
  /** aparece en "Nuestros Favoritos" de la portada */
  destacado?: boolean;
  etiqueta?: 'Nuevo' | 'Más pedido' | 'Picante' | 'Vegetariano';
  /**
   * Cantidades alternativas (por 5, por 10…). Vacío o ausente = precio único
   * y manda `precio`. Se editan desde el panel: no hay cantidades fijas en
   * el código, ni siquiera el 5 y el 10.
   */
  presentaciones?: Presentacion[];
  /**
   * Grupos de personalización. Vacío o ausente = producto simple, que se
   * añade al carrito de un clic sin pasar por el configurador.
   */
  opciones?: GrupoOpciones[];
}

/** Mismo orden y textos que la migración 009; la base manda sobre esto. */
export const CATEGORIAS: Categoria[] = [
  { id: 'makis', nombre: 'Makis', descripcion: 'Nuestros rolls preparados al momento' },
  {
    id: 'burrito-roll',
    nombre: 'Burrito Roll',
    descripcion: 'Rolls grandes tipo burrito, para comer solo',
  },
  {
    id: 'handroll',
    nombre: 'Handroll',
    descripcion: 'Conos de alga rellenos, listos para la mano',
  },
  { id: 'temaki', nombre: 'Temaki', descripcion: 'Conos rellenos al estilo tradicional' },
  { id: 'onigiri', nombre: 'Onigiri', descripcion: 'Bolas de arroz rellenas' },
  { id: 'bowls', nombre: 'Bowls', descripcion: 'Arroz, proteína y toppings en un tazón' },
  {
    id: 'platos-calientes',
    nombre: 'Platos calientes',
    descripcion: 'Salteados y frituras recién hechos',
  },
  { id: 'entradas', nombre: 'Entradas', descripcion: 'Para empezar o compartir' },
  {
    id: 'salsas-extras',
    nombre: 'Salsas y extras',
    descripcion: 'Para acompañar y subir de nivel tu pedido',
  },
  { id: 'bebidas', nombre: 'Bebidas', descripcion: 'Refrescos y limonadas de la casa' },
];

export const PRODUCTOS: Producto[] = [
  {
    id: 'acevichado-roll',
    nombre: 'Acevichado Roll',
    descripcion: 'Pesca del día, palta, cebolla morada y salsa acevichada.',
    precio: 28.9,
    categoria: 'makis',
    imagen: '/imagenes/web/productos/acevichado-roll.webp',
    destacado: true,
    etiqueta: 'Más pedido',
  },
  {
    id: 'sugu-especial',
    nombre: 'Sugu Especial',
    descripcion: 'Langostino tempura, palta y salsa especial.',
    precio: 29.9,
    categoria: 'makis',
    imagen: '/imagenes/web/productos/sugu-especial.webp',
    destacado: true,
  },
  {
    id: 'volcan-roll',
    nombre: 'Volcán Roll',
    descripcion: 'Salmón, queso crema y topping spicy.',
    precio: 30.9,
    categoria: 'makis',
    imagen: '/imagenes/web/productos/volcan-roll.webp',
    destacado: true,
    etiqueta: 'Picante',
  },
  {
    id: 'rock-and-roll',
    nombre: 'Rock & Roll',
    descripcion: 'Pollo crispy, palta y salsa teriyaki.',
    precio: 26.9,
    categoria: 'makis',
    imagen: '/imagenes/web/productos/rock-roll.webp',
    destacado: true,
  },
  {
    id: 'veggie-roll',
    nombre: 'Veggie Roll',
    descripcion: 'Palta, pepino, zanahoria, queso crema y ajonjolí.',
    precio: 22.9,
    categoria: 'makis',
    imagen: '/imagenes/web/productos/veggie-roll.webp',
    destacado: true,
    etiqueta: 'Vegetariano',
  },
  {
    id: 'sugu-bowl',
    nombre: 'Sugu Bowl',
    descripcion: 'Arroz shari, salmón, palta, edamame y sésamo.',
    precio: 27.9,
    categoria: 'bowls',
    imagen: '/imagenes/web/productos/acevichado-roll.webp',
  },
  {
    id: 'ebi-furai',
    nombre: 'Ebi Furai',
    descripcion: 'Langostinos empanizados crocantes con salsa de la casa.',
    precio: 21.9,
    categoria: 'entradas',
    imagen: '/imagenes/web/productos/rock-roll.webp',
  },
  {
    id: 'gyozas',
    nombre: 'Gyozas',
    descripcion: 'Empanaditas japonesas selladas a la plancha (6 unidades).',
    precio: 18.9,
    categoria: 'entradas',
    imagen: '/imagenes/web/productos/sugu-especial.webp',
  },
  {
    id: 'limonada-maracuya',
    nombre: 'Limonada de Maracuyá',
    descripcion: 'Jarra de 1 litro, preparada al momento.',
    precio: 14.9,
    categoria: 'bebidas',
    imagen: '/imagenes/web/productos/veggie-roll.webp',
  },
];

export const FAVORITOS = PRODUCTOS.filter((p) => p.destacado);

/**
 * Grupo de sabores que el cliente debe elegir dentro de una promoción, de
 * una categoría real de la carta (Makis, Temaki…), no de una lista escrita
 * a mano.
 *
 * La cantidad a elegir no se guarda: sale de `piezas_asignadas /
 * piezas_por_sabor`. Con 20 piezas asignadas y 10 piezas por sabor, el
 * cliente elige exactamente 2 sabores de esa categoría.
 */
export interface GrupoSaboresPromo {
  /** lo que ve el cliente sobre la lista, p. ej. "Elige tus sabores de Makis" */
  titulo: string;
  /**
   * Id de la categoría (`categories.id`). No se tipa como `CategoriaId`
   * porque esa unión es solo el respaldo local; las categorías reales se
   * crean desde el panel y pueden tener cualquier id.
   */
  categoria: string;
  piezas_asignadas: number;
  piezas_por_sabor: number;
}

export interface Paquete {
  id: string;
  nombre: string;
  piezas: number;
  precio: number;
  ideal: string;
  incluye: string[];
  imagen: string;
  masPedido?: boolean;
  /** vacío = promoción sin personalizar, se pide de un clic como siempre */
  grupos?: GrupoSaboresPromo[];
}

/**
 * Cuántos sabores hay que elegir en un grupo. Misma cuenta que hace
 * `crear_pedido` en la base, para que lo que ve el cliente aquí sea
 * exactamente lo que la base va a exigir al confirmar.
 */
export function cantidadSabores(g: GrupoSaboresPromo): number {
  return Math.max(1, Math.floor(g.piezas_asignadas / Math.max(g.piezas_por_sabor, 1)));
}

export const PAQUETES: Paquete[] = [
  {
    id: 'personal',
    nombre: 'Sugu Box Personal',
    piezas: 20,
    precio: 34.9,
    ideal: 'Ideal para una persona',
    incluye: ['20 piezas', '2 sabores a elección', '1 bebida'],
    imagen: '/imagenes/web/productos/veggie-roll.webp',
  },
  {
    id: 'duo',
    nombre: 'Sugu Box Dúo',
    piezas: 40,
    precio: 64.9,
    ideal: 'Ideal para compartir',
    incluye: ['40 piezas', '4 sabores a elección', '2 bebidas'],
    imagen: '/imagenes/web/productos/sugu-especial.webp',
    masPedido: true,
  },
  {
    id: 'party',
    nombre: 'Sugu Box Party',
    piezas: 80,
    precio: 119.9,
    ideal: 'Ideal para reuniones',
    incluye: ['80 piezas', '8 sabores a elección', 'Salsas adicionales'],
    imagen: '/imagenes/web/productos/acevichado-roll.webp',
  },
];

export interface Testimonio {
  nombre: string;
  estrellas: number;
  comentario: string;
}

export const TESTIMONIOS: Testimonio[] = [
  {
    nombre: 'Andrea Ríos',
    estrellas: 5,
    comentario:
      'Los makis llegaron frescos, bien presentados y con bastante relleno. Se nota que los preparan al momento.',
  },
  {
    nombre: 'Diego Salazar',
    estrellas: 5,
    comentario:
      'El acevichado es increíble. Definitivamente volvería a pedir, y el delivery fue bastante rápido.',
  },
  {
    nombre: 'Camila Vargas',
    estrellas: 5,
    comentario:
      'Pedimos una bandeja para una reunión y todos quedaron encantados. La presentación fue espectacular.',
  },
  {
    nombre: 'Luis Fernández',
    estrellas: 5,
    comentario:
      'Buenísima relación precio-calidad. El Sugu Box Dúo nos alcanzó perfecto para dos y sobró.',
  },
];

/** Formatea un precio en soles. */
export function soles(monto: number): string {
  return `S/ ${monto.toFixed(2)}`;
}
