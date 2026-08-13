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

export interface Paquete {
  id: string;
  nombre: string;
  piezas: number;
  precio: number;
  ideal: string;
  incluye: string[];
  imagen: string;
  masPedido?: boolean;
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
